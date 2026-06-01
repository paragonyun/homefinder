import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import {
  fetchNeisSchoolInfoPages,
  NEIS_SCHOOL_INFO_ENDPOINT,
  type NeisSchool,
} from "@/lib/data-providers/neis-schools";
import {
  buildApartmentSchoolAccessRows,
  filterSchoolsByDistrict,
  resolveSchoolSearchRegion,
} from "@/lib/services/school-access";
import {
  createSupabaseRouteClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/server";

const NEIS_SOURCE_NAME = "neis-school-info";
const SCHOOL_KIND_NAMES = ["초등학교", "중학교", "고등학교"] as const;

type ApartmentSchoolSyncRow = {
  id: string;
  user_id: string;
  address: string | null;
  road_address: string | null;
  lat: number | null;
  lng: number | null;
};

type SchoolUpsertRow = {
  id: string;
  school_code: string;
  school_type: "elementary" | "middle" | "high" | "unknown";
  lat: number | null;
  lng: number | null;
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

  if (!process.env.NEIS_API_KEY) {
    return NextResponse.json(
      { error: "NEIS_API_KEY가 설정되지 않았습니다." },
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
      { error: "학군 정보 동기화는 운영자만 실행할 수 있습니다." },
      { status: 403 },
    );
  }

  const { id: apartmentId } = await context.params;
  const { data: apartment, error: apartmentError } = await supabase
    .from("apartments")
    .select("id,user_id,address,road_address,lat,lng")
    .eq("id", apartmentId)
    .maybeSingle();

  if (apartmentError) {
    return NextResponse.json({ error: apartmentError.message }, { status: 500 });
  }

  if (!apartment) {
    return NextResponse.json({ error: "단지를 찾을 수 없습니다." }, { status: 404 });
  }

  const apartmentRow = apartment as ApartmentSchoolSyncRow;
  const { regionName, districtName } = resolveSchoolSearchRegion([
    apartmentRow.address,
    apartmentRow.road_address,
  ]);

  if (!regionName) {
    return NextResponse.json(
      { error: "NEIS 학교 조회에 사용할 시도명을 주소에서 찾지 못했습니다." },
      { status: 400 },
    );
  }

  const allSchools: NeisSchool[] = [];
  const rawPages: unknown[] = [];

  try {
    for (const schoolKindName of SCHOOL_KIND_NAMES) {
      const result = await fetchNeisSchoolInfoPages({
        apiKey: process.env.NEIS_API_KEY,
        regionName,
        schoolKindName,
      });

      rawPages.push(...result.pages);
      allSchools.push(...result.schools);
    }
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "NEIS 학교기본정보 조회에 실패했습니다.") },
      { status: 502 },
    );
  }

  const schools = filterSchoolsByDistrict(allSchools, districtName);
  const fetchedAt = new Date().toISOString();
  const { data: rawRow, error: rawError } = await supabase
    .from("raw_api_responses")
    .insert({
      provider: "neis",
      endpoint: NEIS_SCHOOL_INFO_ENDPOINT,
      request_hash: hashText(
        JSON.stringify({
          apartmentId,
          regionName,
          districtName,
          schoolKindNames: SCHOOL_KIND_NAMES,
        }),
      ),
      request_params: {
        apartmentId,
        regionName,
        districtName,
        schoolKindNames: SCHOOL_KIND_NAMES,
      },
      response_body: {
        totalFetchedCount: allSchools.length,
        matchedCount: schools.length,
        pages: rawPages,
      },
      apartment_id: apartmentId,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (rawError) {
    return NextResponse.json({ error: rawError.message }, { status: 500 });
  }

  if (schools.length === 0) {
    return NextResponse.json({
      synced: true,
      schoolCount: 0,
      accessCount: 0,
      regionName,
      districtName,
      fetchedAt,
      message: "주소와 같은 구의 학교를 찾지 못했습니다.",
    });
  }

  const { data: upsertedSchools, error: schoolUpsertError } = await supabase
    .from("schools")
    .upsert(
      schools.map((school) =>
        toSchoolPayload(school, {
          fetchedAt,
          rawApiResponseId: rawRow.id,
          userId: user.id,
        }),
      ),
      { onConflict: "user_id,source_name,school_code" },
    )
    .select("id,school_code,school_type,lat,lng");

  if (schoolUpsertError) {
    if (isMissingTableError(schoolUpsertError)) {
      return NextResponse.json(
        { error: "schools migration이 아직 적용되지 않았습니다." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: schoolUpsertError.message }, { status: 500 });
  }

  const accessRows = buildApartmentSchoolAccessRows({
    apartmentId,
    apartmentLat: apartmentRow.lat,
    apartmentLng: apartmentRow.lng,
    fetchedAt,
    schools: (upsertedSchools ?? []) as SchoolUpsertRow[],
    sourceName: NEIS_SOURCE_NAME,
    sourceRef: NEIS_SCHOOL_INFO_ENDPOINT,
    userId: user.id,
  });

  if (accessRows.length > 0) {
    const { error: accessUpsertError } = await supabase
      .from("apartment_school_access")
      .upsert(accessRows, {
        onConflict: "apartment_id,school_id,source_name",
      });

    if (accessUpsertError) {
      if (isMissingTableError(accessUpsertError)) {
        return NextResponse.json(
          {
            error:
              "apartment_school_access migration이 아직 적용되지 않았습니다.",
          },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { error: accessUpsertError.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    synced: true,
    schoolCount: schools.length,
    accessCount: accessRows.length,
    regionName,
    districtName,
    fetchedAt,
  });
}

function toSchoolPayload(
  school: NeisSchool,
  context: {
    fetchedAt: string;
    rawApiResponseId: string;
    userId: string;
  },
) {
  return {
    user_id: context.userId,
    source_name: NEIS_SOURCE_NAME,
    source_ref: `${NEIS_SCHOOL_INFO_ENDPOINT}#${context.rawApiResponseId}`,
    school_code: school.schoolCode,
    office_code: school.officeCode,
    office_name: school.officeName,
    school_name: school.schoolName,
    school_type: school.schoolType,
    school_kind_name: school.schoolKindName,
    region_name: school.regionName,
    district_office_name: school.districtOfficeName,
    address: school.address,
    road_address: school.roadAddress,
    homepage_url: school.homepageUrl,
    phone: school.phone,
    coeducation_type: school.coeducationType,
    founded_date: school.foundedDate,
    confidence_level: "high",
    fetched_at: context.fetchedAt,
  };
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isMissingTableError(error: { code?: string }) {
  return error.code === "42P01" || error.code === "PGRST205";
}
