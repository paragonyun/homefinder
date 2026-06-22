import { NextResponse } from "next/server";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import {
  fetchKaptApartmentList,
  fetchKaptApartmentListByLegalDong,
  fetchKaptApartmentListBySigungu,
  type KaptApartmentListFetchResult,
  type KaptApartmentListItem,
} from "@/lib/data-providers/kapt-apartment-list";
import {
  fetchKaptBasicInfoJson,
  parseKaptBasicInfoResponse,
} from "@/lib/data-providers/kapt-basic-info";
import {
  kaptDirectoryRowsToListItems,
  toKaptDirectoryUpsertRows,
  type KaptCodeDirectoryRow,
} from "@/lib/services/kapt-code-directory";
import {
  buildKaptResolveRawResponsePayload,
  dedupeKaptItems,
  KAPT_DIRECTORY_ENDPOINT,
  KAPT_DIRECTORY_SOURCE_NAME,
  KAPT_LIST_SOURCE_NAME,
  mergeKaptListResults,
  toPublicKaptCandidate,
  type KaptListResult,
} from "@/lib/services/apartment-kapt-code-sync";
import { resolveKaptCodeCandidate } from "@/lib/services/kapt-code-resolver";
import {
  createSupabaseRouteClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/server";

type SupabaseRouteClient = NonNullable<ReturnType<typeof createSupabaseRouteClient>>;

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
      { error: "K-apt 코드 탐색은 운영자만 실행할 수 있습니다." },
      { status: 403 },
    );
  }

  const { id: apartmentId } = await context.params;
  const body = await readJsonBody(request);
  const { data: apartment, error: apartmentError } = await supabase
    .from("apartments")
    .select("id,user_id,name,display_name,address,road_address,lawd_cd,kapt_code")
    .eq("id", apartmentId)
    .maybeSingle();

  if (apartmentError) {
    return NextResponse.json({ error: apartmentError.message }, { status: 500 });
  }

  if (!apartment) {
    return NextResponse.json({ error: "단지를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!apartment.lawd_cd) {
    return NextResponse.json(
      { error: "K-apt 코드 탐색을 위해 법정동코드가 필요합니다." },
      { status: 400 },
    );
  }

  const selectedKaptCode =
    typeof body.kaptCode === "string" ? body.kaptCode.trim() : null;
  const [aliasResult, transactionResult] = await Promise.all([
    supabase
      .from("apartment_aliases")
      .select("alias,source")
      .eq("apartment_id", apartmentId),
    supabase
      .from("apartment_transactions")
      .select("apartment_name_from_source,address_from_source")
      .eq("apartment_id", apartmentId)
      .order("deal_date", { ascending: false })
      .limit(100),
  ]);

  if (aliasResult.error && !isMissingTableError(aliasResult.error)) {
    return NextResponse.json({ error: aliasResult.error.message }, { status: 500 });
  }

  if (transactionResult.error && !isMissingTableError(transactionResult.error)) {
    return NextResponse.json(
      { error: transactionResult.error.message },
      { status: 500 },
    );
  }

  const aliases = (aliasResult.data ?? []) as Array<{ alias: string | null }>;
  const transactions = (transactionResult.data ?? []) as Array<{
    apartment_name_from_source: string | null;
    address_from_source: string | null;
  }>;
  let listResult = await fetchDirectoryCandidates(supabase, apartment.lawd_cd);

  if (selectedKaptCode) {
    let selected: KaptApartmentListItem | null =
      listResult.items.find(
      (candidate) => candidate.kaptCode === selectedKaptCode,
    ) ?? null;

    if (!selected) {
      const externalResult = await fetchAndCacheExternalCandidates({
        supabase,
        serviceKey: process.env.KAPT_API_KEY,
        lawdCd: apartment.lawd_cd,
      });

      listResult = mergeKaptListResults([listResult, externalResult]);
      selected =
        listResult.items.find(
          (candidate) => candidate.kaptCode === selectedKaptCode,
        ) ?? null;
    }

    if (!selected) {
      selected = await validateSelectedKaptCode({
        serviceKey: process.env.KAPT_API_KEY,
        kaptCode: selectedKaptCode,
      });
    }

    if (!selected) {
      return NextResponse.json(
        { error: "선택한 K-apt 코드를 공식 API에서 확인하지 못했습니다." },
        { status: 400 },
      );
    }

    const { error: updateError } = await supabase
      .from("apartments")
      .update({ kapt_code: selected.kaptCode })
      .eq("id", apartmentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      applied: true,
      selected: toPublicKaptCandidate({
        ...selected,
        score: 0,
        reasons: ["사용자 선택"],
      }),
      candidates: [],
      reason: "선택한 K-apt 코드를 저장했습니다.",
    });
  }

  let resolution = resolveKaptCodeCandidate({
    apartment,
    aliases,
    transactions,
    candidates: listResult.items,
  });
  let externalErrorMessage: string | null = null;

  if (resolution.status !== "auto") {
    try {
      const externalResult = await fetchAndCacheExternalCandidates({
        supabase,
        serviceKey: process.env.KAPT_API_KEY,
        lawdCd: apartment.lawd_cd,
      });

      listResult = mergeKaptListResults([listResult, externalResult]);
      resolution = resolveKaptCodeCandidate({
        apartment,
        aliases,
        transactions,
        candidates: listResult.items,
      });
    } catch (error) {
      externalErrorMessage = getErrorMessage(error);
    }
  }

  const rawWarning = await insertRawResolutionLog({
    supabase,
    apartmentId,
    userId: user.id,
    lawdCd: apartment.lawd_cd,
    listResult,
    resolution,
    externalErrorMessage,
  });

  if (resolution.status === "auto") {
    const { error: updateError } = await supabase
      .from("apartments")
      .update({ kapt_code: resolution.selected.kaptCode })
      .eq("id", apartmentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    applied: resolution.status === "auto",
    selected: resolution.selected ? toPublicKaptCandidate(resolution.selected) : null,
    candidates: resolution.candidates.map(toPublicKaptCandidate),
    reason:
      resolution.status === "none" && externalErrorMessage
        ? `K-apt 후보를 찾지 못했습니다. 목록 API 오류: ${externalErrorMessage}`
        : resolution.reason,
    warning: rawWarning,
  });
}

async function fetchDirectoryCandidates(
  supabase: SupabaseRouteClient,
  lawdCd: string,
): Promise<KaptListResult> {
  const exactItems =
    lawdCd.length === 10
      ? await readDirectoryCandidates(supabase, lawdCd, "exact")
      : [];
  const sigunguItems =
    lawdCd.length >= 5
      ? await readDirectoryCandidates(supabase, lawdCd.slice(0, 5), "prefix")
      : [];
  const fallbackItems =
    exactItems.length === 0 && sigunguItems.length === 0
      ? await readDirectoryCandidates(supabase, lawdCd.slice(0, 2), "prefix")
      : [];

  return {
    endpoint: KAPT_DIRECTORY_ENDPOINT,
    source: KAPT_DIRECTORY_SOURCE_NAME,
    totalCount: exactItems.length + sigunguItems.length + fallbackItems.length,
    items: dedupeKaptItems([...exactItems, ...sigunguItems, ...fallbackItems]),
  };
}

async function readDirectoryCandidates(
  supabase: SupabaseRouteClient,
  code: string,
  match: "exact" | "prefix",
) {
  let query = supabase
    .from("kapt_code_directory")
    .select(
      "kapt_code,kapt_name,normalized_kapt_name,bjd_code,sido,sigungu,eupmyeondong,ri,legal_address,road_address,source,source_endpoint,last_synced_at",
    )
    .limit(1000);

  query =
    match === "exact" ? query.eq("bjd_code", code) : query.like("bjd_code", `${code}%`);

  const { data, error } = await query;

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    throw error;
  }

  return kaptDirectoryRowsToListItems((data ?? []) as KaptCodeDirectoryRow[]);
}

async function fetchAndCacheExternalCandidates({
  supabase,
  serviceKey,
  lawdCd,
}: {
  supabase: SupabaseRouteClient;
  serviceKey: string;
  lawdCd: string;
}) {
  const listResult = await fetchKaptCandidates({ serviceKey, lawdCd });
  await cacheKaptCandidates({ supabase, listResult });
  return listResult;
}

async function fetchKaptCandidates({
  serviceKey,
  lawdCd,
}: {
  serviceKey: string;
  lawdCd: string;
}): Promise<KaptListResult> {
  const results: KaptListResult[] = [];
  const errors: string[] = [];

  if (lawdCd.length === 10) {
    const legalDongResult = await tryFetchKaptList(() =>
      fetchKaptApartmentListByLegalDong({
        serviceKey,
        bjdCode: lawdCd,
      }),
    );

    collectExternalFetchResult(results, errors, legalDongResult, "legal-dong");
  }

  if (lawdCd.length >= 5) {
    const sigunguResult = await tryFetchKaptList(() =>
      fetchKaptApartmentListBySigungu({
        serviceKey,
        sigunguCode: lawdCd.slice(0, 5),
      }),
    );

    collectExternalFetchResult(results, errors, sigunguResult, "sigungu");
  }

  if (results.every((result) => result.items.length === 0)) {
    const sidoResult = await tryFetchKaptList(() =>
      fetchKaptApartmentList({
        serviceKey,
        sidoCode: lawdCd.slice(0, 2),
      }),
    );

    collectExternalFetchResult(results, errors, sidoResult, "sido");
  }

  if (results.some((result) => result.items.length > 0) || errors.length === 0) {
    return mergeKaptListResults(results);
  }

  throw new Error(errors.join(" / ") || "K-apt 단지 목록 조회에 실패했습니다.");
}

async function tryFetchKaptList(
  fetcher: () => Promise<KaptApartmentListFetchResult>,
) {
  try {
    return { result: await fetcher(), error: null };
  } catch (error) {
    return { result: null, error: getErrorMessage(error) };
  }
}

function collectExternalFetchResult(
  results: KaptListResult[],
  errors: string[],
  fetchResult: Awaited<ReturnType<typeof tryFetchKaptList>>,
  sourceSuffix: string,
) {
  if (fetchResult.result) {
    results.push({
      ...fetchResult.result,
      source: `${KAPT_LIST_SOURCE_NAME}-${sourceSuffix}`,
    });
  } else if (fetchResult.error) {
    errors.push(`${sourceSuffix}: ${fetchResult.error}`);
  }
}

async function cacheKaptCandidates({
  supabase,
  listResult,
}: {
  supabase: SupabaseRouteClient;
  listResult: KaptListResult;
}) {
  const rows = toKaptDirectoryUpsertRows({
    items: listResult.items,
    source: listResult.source,
    endpoint: listResult.endpoint,
  });

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("kapt_code_directory")
    .upsert(rows, { onConflict: "kapt_code" });

  if (error && !isMissingTableError(error)) {
    console.warn("Failed to cache K-apt directory rows", error);
  }
}

async function validateSelectedKaptCode({
  serviceKey,
  kaptCode,
}: {
  serviceKey: string;
  kaptCode: string;
}): Promise<KaptApartmentListItem | null> {
  try {
    const response = await fetchKaptBasicInfoJson({ serviceKey, kaptCode });
    const basicInfo = parseKaptBasicInfoResponse(response);

    if (!basicInfo?.kaptCode || !basicInfo.kaptName) {
      return null;
    }

    return {
      kaptCode: basicInfo.kaptCode,
      kaptName: basicInfo.kaptName,
      bjdCode: null,
      sido: null,
      sigungu: null,
      eupmyeondong: null,
      ri: null,
      legalAddress: basicInfo.legalAddress,
      roadAddress: basicInfo.roadAddress,
    };
  } catch {
    return null;
  }
}

async function insertRawResolutionLog({
  supabase,
  apartmentId,
  userId,
  lawdCd,
  listResult,
  resolution,
  externalErrorMessage,
}: {
  supabase: SupabaseRouteClient;
  apartmentId: string;
  userId: string;
  lawdCd: string;
  listResult: KaptListResult;
  resolution: ReturnType<typeof resolveKaptCodeCandidate>;
  externalErrorMessage: string | null;
}) {
  const { error } = await supabase.from("raw_api_responses").insert(
    buildKaptResolveRawResponsePayload({
      apartmentId,
      externalErrorMessage,
      lawdCd,
      listResult,
      resolution,
      userId,
    }),
  );

  if (!error) {
    return null;
  }

  console.warn("Failed to store K-apt resolve raw response", error);
  return error.message;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as { kaptCode?: unknown };
  } catch {
    return {};
  }
}

function isMissingTableError(error: { code?: string }) {
  return error.code === "42P01" || error.code === "PGRST205";
}
