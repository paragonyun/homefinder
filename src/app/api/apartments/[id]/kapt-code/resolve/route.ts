import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import {
  fetchKaptApartmentList,
  KAPT_APARTMENT_LIST_ENDPOINT,
} from "@/lib/data-providers/kapt-apartment-list";
import {
  resolveKaptCodeCandidate,
  type ScoredKaptCodeCandidate,
} from "@/lib/services/kapt-code-resolver";
import {
  createSupabaseRouteClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/server";

const KAPT_LIST_SOURCE_NAME = "kapt-apartment-list";

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

  let listResult: Awaited<ReturnType<typeof fetchKaptApartmentList>>;

  try {
    listResult = await fetchKaptApartmentList({
      serviceKey: process.env.KAPT_API_KEY,
      sidoCode: apartment.lawd_cd.slice(0, 2),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "K-apt 단지 목록 조회에 실패했습니다.",
      },
      { status: 502 },
    );
  }

  const selectedKaptCode =
    typeof body.kaptCode === "string" ? body.kaptCode.trim() : null;

  if (selectedKaptCode) {
    const selected = listResult.items.find(
      (candidate) => candidate.kaptCode === selectedKaptCode,
    );

    if (!selected) {
      return NextResponse.json(
        { error: "선택한 K-apt 코드를 단지 목록에서 찾지 못했습니다." },
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
      selected: toPublicCandidate({ ...selected, score: 0, reasons: ["사용자 선택"] }),
      candidates: [],
      reason: "선택한 K-apt 코드를 저장했습니다.",
    });
  }

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

  const resolution = resolveKaptCodeCandidate({
    apartment,
    aliases: (aliasResult.data ?? []) as Array<{ alias: string | null }>,
    transactions: (transactionResult.data ?? []) as Array<{
      apartment_name_from_source: string | null;
      address_from_source: string | null;
    }>,
    candidates: listResult.items,
  });
  const { error: rawError } = await supabase.from("raw_api_responses").insert({
    provider: "kapt",
    endpoint: KAPT_APARTMENT_LIST_ENDPOINT,
    request_hash: hashText(
      JSON.stringify({
        apartmentId,
        lawdCd: apartment.lawd_cd,
        source: KAPT_LIST_SOURCE_NAME,
      }),
    ),
    request_params: {
      apartmentId,
      lawdCd: apartment.lawd_cd,
      source: KAPT_LIST_SOURCE_NAME,
    },
    response_body: {
      totalCount: listResult.totalCount,
      status: resolution.status,
      selected: resolution.selected ? toPublicCandidate(resolution.selected) : null,
      candidates: resolution.candidates.map(toPublicCandidate),
      reason: resolution.reason,
    },
    apartment_id: apartmentId,
    user_id: user.id,
  });

  if (rawError) {
    return NextResponse.json({ error: rawError.message }, { status: 500 });
  }

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
    selected: resolution.selected ? toPublicCandidate(resolution.selected) : null,
    candidates: resolution.candidates.map(toPublicCandidate),
    reason: resolution.reason,
  });
}

function toPublicCandidate(candidate: ScoredKaptCodeCandidate) {
  return {
    kaptCode: candidate.kaptCode,
    kaptName: candidate.kaptName,
    bjdCode: candidate.bjdCode,
    sido: candidate.sido,
    sigungu: candidate.sigungu,
    eupmyeondong: candidate.eupmyeondong,
    ri: candidate.ri,
    score: candidate.score,
    reasons: candidate.reasons,
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
