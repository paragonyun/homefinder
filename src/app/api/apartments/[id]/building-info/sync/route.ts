import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import {
  fetchBuildingRegisterInfo,
  type BuildingRegisterInfo,
} from "@/lib/data-providers/building-register";
import {
  resolveBuildingRegisterQuery,
  type BuildingRegisterAddressHint,
  type BuildingRegisterBjdCodeHint,
} from "@/lib/services/building-register-resolver";
import {
  createSupabaseRouteClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/server";

const BUILDING_REGISTER_SOURCE_NAME = "molit-building-register";

type ApartmentBuildingSyncRow = {
  id: string;
  user_id: string;
  address: string | null;
  road_address: string | null;
  lawd_cd: string | null;
  kapt_code: string | null;
};

type BasicInfoAddressRow = {
  legal_address_from_source: string | null;
  road_address_from_source: string | null;
};

type KaptDirectoryAddressRow = {
  bjd_code: string | null;
  legal_address: string | null;
  road_address: string | null;
};

type TransactionAddressRow = {
  address_from_source: string | null;
};

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

  const apiKey =
    process.env.MOLIT_BUILDING_API_KEY ?? process.env.MOLIT_API_KEY ?? null;

  if (!apiKey) {
    return NextResponse.json(
      { error: "MOLIT_BUILDING_API_KEY 또는 MOLIT_API_KEY가 필요합니다." },
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
      { error: "건축물대장 동기화는 운영자만 실행할 수 있습니다." },
      { status: 403 },
    );
  }

  const { id: apartmentId } = await context.params;
  const { data: apartment, error: apartmentError } = await supabase
    .from("apartments")
    .select("id,user_id,address,road_address,lawd_cd,kapt_code")
    .eq("id", apartmentId)
    .maybeSingle();

  if (apartmentError) {
    return NextResponse.json({ error: apartmentError.message }, { status: 500 });
  }

  if (!apartment) {
    return NextResponse.json({ error: "단지를 찾을 수 없습니다." }, { status: 404 });
  }

  const apartmentRow = apartment as ApartmentBuildingSyncRow;
  let basicInfo: BasicInfoAddressRow | null;
  let directoryInfo: KaptDirectoryAddressRow | null;
  let transactionAddresses: TransactionAddressRow[];

  try {
    [basicInfo, directoryInfo, transactionAddresses] = await Promise.all([
      loadLatestBasicInfoAddress(supabase, apartmentId),
      loadKaptDirectoryAddress(supabase, apartmentRow.kapt_code),
      loadTransactionAddresses(supabase, apartmentId),
    ]);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
  const bjdCodes = buildBjdCodeHints(directoryInfo);
  const addresses = buildAddressHints({
    apartment: apartmentRow,
    basicInfo,
    directoryInfo,
    transactionAddresses,
  });
  const resolution = resolveBuildingRegisterQuery({
    lawdCd: apartmentRow.lawd_cd,
    bjdCodes,
    addresses,
  });

  if (!resolution.ok) {
    return NextResponse.json({ error: resolution.error }, { status: 400 });
  }

  let fetched;

  try {
    fetched = await fetchBuildingRegisterInfo({
      serviceKey: apiKey,
      query: resolution.query,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "건축물대장 조회에 실패했습니다.",
      },
      { status: 502 },
    );
  }

  const { data: rawRow, error: rawError } = await supabase
    .from("raw_api_responses")
    .insert({
      provider: "molit",
      endpoint: fetched.endpoint,
      request_hash: hashText(
        JSON.stringify({
          apartmentId,
          query: resolution.query,
          matchedAddress: resolution.matchedAddress,
          addressSource: resolution.addressSource,
          bjdCodeSource: resolution.bjdCodeSource,
        }),
      ),
      request_params: {
        apartmentId,
        query: resolution.query,
        matchedAddress: resolution.matchedAddress,
        addressSource: resolution.addressSource,
        bjdCodeSource: resolution.bjdCodeSource,
      },
      response_body: {
        endpoint: fetched.endpoint,
        totalCount: fetched.parsed.totalCount,
        selected: fetched.selected,
        items: fetched.parsed.items,
        rawResponse: fetched.rawResponse,
      },
      apartment_id: apartmentId,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (rawError) {
    return NextResponse.json({ error: rawError.message }, { status: 500 });
  }

  if (!fetched.selected) {
    return NextResponse.json(
      { error: "건축물대장 표제부에서 용적률/건폐율 정보를 찾지 못했습니다." },
      { status: 404 },
    );
  }

  const fetchedAt = new Date().toISOString();
  const { error: upsertError } = await supabase
    .from("apartment_building_info")
    .upsert(
      toBuildingInfoPayload(fetched.selected, {
        apartmentId,
        fetchedAt,
        rawApiResponseId: rawRow.id,
        sourceRef: fetched.endpoint,
        userId: user.id,
      }),
      {
        onConflict: "apartment_id,source_name",
      },
    );

  if (upsertError) {
    if (isMissingTableError(upsertError)) {
      return NextResponse.json(
        {
          error:
            "apartment_building_info migration이 아직 적용되지 않았습니다.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    synced: true,
    fetchedAt,
    endpoint: fetched.endpoint,
    matchedAddress: resolution.matchedAddress,
    addressSource: resolution.addressSource,
    bjdCodeSource: resolution.bjdCodeSource,
    floorAreaRatio: fetched.selected.floorAreaRatio,
    buildingCoverageRatio: fetched.selected.buildingCoverageRatio,
  });
}

async function loadLatestBasicInfoAddress(
  supabase: NonNullable<ReturnType<typeof createSupabaseRouteClient>>,
  apartmentId: string,
) {
  const { data, error } = await supabase
    .from("apartment_basic_info")
    .select("legal_address_from_source,road_address_from_source")
    .eq("apartment_id", apartmentId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && !isMissingTableError(error)) {
    throw new Error(error.message);
  }

  return error ? null : ((data as BasicInfoAddressRow | null) ?? null);
}

async function loadKaptDirectoryAddress(
  supabase: NonNullable<ReturnType<typeof createSupabaseRouteClient>>,
  kaptCode: string | null,
) {
  if (!kaptCode) {
    return null;
  }

  const { data, error } = await supabase
    .from("kapt_code_directory")
    .select("bjd_code,legal_address,road_address")
    .eq("kapt_code", kaptCode)
    .maybeSingle();

  if (error && !isMissingTableError(error)) {
    throw new Error(error.message);
  }

  return error ? null : ((data as KaptDirectoryAddressRow | null) ?? null);
}

async function loadTransactionAddresses(
  supabase: NonNullable<ReturnType<typeof createSupabaseRouteClient>>,
  apartmentId: string,
) {
  const { data, error } = await supabase
    .from("apartment_transactions")
    .select("address_from_source")
    .eq("apartment_id", apartmentId)
    .not("address_from_source", "is", null)
    .order("deal_date", { ascending: false })
    .limit(20);

  if (error && !isMissingTableError(error)) {
    throw new Error(error.message);
  }

  return error ? [] : ((data ?? []) as TransactionAddressRow[]);
}

function buildBjdCodeHints(directoryInfo: KaptDirectoryAddressRow | null) {
  const hints: BuildingRegisterBjdCodeHint[] = [];

  if (directoryInfo?.bjd_code) {
    hints.push({
      value: directoryInfo.bjd_code,
      source: "kapt_code_directory",
    });
  }

  return hints;
}

function buildAddressHints({
  apartment,
  basicInfo,
  directoryInfo,
  transactionAddresses,
}: {
  apartment: ApartmentBuildingSyncRow;
  basicInfo: BasicInfoAddressRow | null;
  directoryInfo: KaptDirectoryAddressRow | null;
  transactionAddresses: TransactionAddressRow[];
}) {
  const hints: BuildingRegisterAddressHint[] = [
    {
      value: basicInfo?.legal_address_from_source,
      source: "apartment_basic_info.legal_address_from_source",
    },
    {
      value: directoryInfo?.legal_address,
      source: "kapt_code_directory.legal_address",
    },
    ...transactionAddresses.map((row) => ({
      value: row.address_from_source,
      source: "apartment_transactions.address_from_source",
    })),
    {
      value: apartment.address,
      source: "apartments.address",
    },
    {
      value: basicInfo?.road_address_from_source,
      source: "apartment_basic_info.road_address_from_source",
    },
    {
      value: directoryInfo?.road_address,
      source: "kapt_code_directory.road_address",
    },
    {
      value: apartment.road_address,
      source: "apartments.road_address",
    },
  ];
  const seen = new Set<string>();

  return hints.filter((hint) => {
    const key = hint.value?.trim();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function toBuildingInfoPayload(
  info: BuildingRegisterInfo,
  context: {
    apartmentId: string;
    fetchedAt: string;
    rawApiResponseId: string;
    sourceRef: string;
    userId: string;
  },
) {
  return {
    user_id: context.userId,
    apartment_id: context.apartmentId,
    raw_api_response_id: context.rawApiResponseId,
    source_name: BUILDING_REGISTER_SOURCE_NAME,
    source_ref: context.sourceRef,
    legal_address_from_source: info.legalAddress,
    road_address_from_source: info.roadAddress,
    land_area_m2: info.landAreaM2,
    building_area_m2: info.buildingAreaM2,
    gross_floor_area_m2: info.grossFloorAreaM2,
    floor_area_ratio: info.floorAreaRatio,
    building_coverage_ratio: info.buildingCoverageRatio,
    main_use: info.mainUse,
    highest_floor: info.highestFloor,
    lowest_floor: info.lowestFloor,
    structure_type: info.structureType,
    confidence_level: "high",
    fetched_at: context.fetchedAt,
  };
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "건축물대장 동기화에 실패했습니다.";
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isMissingTableError(error: { code?: string }) {
  return error.code === "42P01" || error.code === "PGRST205";
}
