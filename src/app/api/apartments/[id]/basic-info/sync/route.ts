import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import {
  fetchKaptBasicInfoJson,
  KAPT_BASIC_INFO_SOURCE_REF,
  parseKaptBasicInfoResponse,
  type KaptBasicInfo,
} from "@/lib/data-providers/kapt-basic-info";
import {
  createSupabaseRouteClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/server";

const KAPT_SOURCE_NAME = "kapt-basic-info";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  if (!process.env.KAPT_API_KEY) {
    return NextResponse.json(
      { error: "KAPT_API_KEY가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = createSupabaseRouteClient(accessToken);

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase 연결을 만들 수 없습니다." },
      { status: 503 },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (!isAdminRole(getRoleFromAppMetadata(user.app_metadata))) {
    return NextResponse.json(
      { error: "K-apt 기본정보 동기화는 운영자만 실행할 수 있습니다." },
      { status: 403 },
    );
  }

  const { id: apartmentId } = await context.params;
  const { data: apartment, error: apartmentError } = await supabase
    .from("apartments")
    .select("id,user_id,name,display_name,kapt_code")
    .eq("id", apartmentId)
    .maybeSingle();

  if (apartmentError) {
    return NextResponse.json({ error: apartmentError.message }, { status: 500 });
  }

  if (!apartment) {
    return NextResponse.json({ error: "단지를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!apartment.kapt_code) {
    return NextResponse.json(
      { error: "단지의 K-apt 코드가 필요합니다." },
      { status: 400 },
    );
  }

  let rawResponse: unknown;
  let basicInfo: KaptBasicInfo | null;

  try {
    rawResponse = await fetchKaptBasicInfoJson({
      serviceKey: process.env.KAPT_API_KEY,
      kaptCode: apartment.kapt_code,
    });
    basicInfo = parseKaptBasicInfoResponse(rawResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "K-apt 기본정보 조회에 실패했습니다.",
      },
      { status: 502 },
    );
  }

  const { data: rawRow, error: rawError } = await supabase
    .from("raw_api_responses")
    .insert({
      provider: "kapt",
      endpoint: KAPT_BASIC_INFO_SOURCE_REF,
      request_hash: hashText(
        JSON.stringify({
          apartmentId,
          kaptCode: apartment.kapt_code,
        }),
      ),
      request_params: {
        apartmentId,
        kaptCode: apartment.kapt_code,
      },
      response_body: rawResponse,
      apartment_id: apartmentId,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (rawError) {
    return NextResponse.json({ error: rawError.message }, { status: 500 });
  }

  if (!basicInfo) {
    return NextResponse.json(
      { error: "K-apt 기본정보를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const fetchedAt = new Date().toISOString();
  const { error: upsertError } = await supabase
    .from("apartment_basic_info")
    .upsert(toBasicInfoPayload(basicInfo, {
      apartmentId,
      rawApiResponseId: rawRow.id,
      userId: user.id,
      fetchedAt,
    }), {
      onConflict: "apartment_id,source_name",
    });

  if (upsertError) {
    if (isMissingTableError(upsertError)) {
      return NextResponse.json(
        {
          error:
            "apartment_basic_info migration이 아직 적용되지 않았습니다.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    synced: true,
    kaptCode: basicInfo.kaptCode ?? apartment.kapt_code,
    kaptName: basicInfo.kaptName,
    fetchedAt,
  });
}

function toBasicInfoPayload(
  basicInfo: KaptBasicInfo,
  context: {
    apartmentId: string;
    rawApiResponseId: string;
    userId: string;
    fetchedAt: string;
  },
) {
  return {
    user_id: context.userId,
    apartment_id: context.apartmentId,
    raw_api_response_id: context.rawApiResponseId,
    source_name: KAPT_SOURCE_NAME,
    source_ref: KAPT_BASIC_INFO_SOURCE_REF,
    kapt_code: basicInfo.kaptCode,
    kapt_name_from_source: basicInfo.kaptName,
    legal_address_from_source: basicInfo.legalAddress,
    road_address_from_source: basicInfo.roadAddress,
    household_count: basicInfo.householdCount,
    building_count: basicInfo.buildingCount,
    approval_date: basicInfo.approvalDate,
    heating_type: basicInfo.heatingType,
    management_type: basicInfo.managementType,
    sale_type: basicInfo.saleType,
    parking_count: basicInfo.parkingCount,
    elevator_count: basicInfo.elevatorCount,
    gross_floor_area_m2: basicInfo.grossFloorAreaM2,
    confidence_level: "high",
    fetched_at: context.fetchedAt,
  };
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function isMissingTableError(error: { code?: string }) {
  return error.code === "42P01" || error.code === "PGRST205";
}
