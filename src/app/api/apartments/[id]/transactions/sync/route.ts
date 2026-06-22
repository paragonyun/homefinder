import { NextResponse } from "next/server";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import {
  MOLIT_APARTMENT_TRADE_DETAIL_ENDPOINT,
  resolveMolitDealYmds,
} from "@/lib/data-providers/molit-transactions";
import {
  buildMolitTransactionSourceNames,
  collectMolitTransactionSyncResult,
  getAddressNumberTokens,
  hashText,
  toMolitTransactionPayload,
} from "@/lib/services/apartment-transaction-sync";
import {
  createSupabaseRouteClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/server";

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

  if (!process.env.MOLIT_API_KEY) {
    return NextResponse.json(
      { error: "MOLIT_API_KEY가 설정되지 않았습니다." },
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
      { error: "실거래가 동기화는 운영자만 실행할 수 있습니다." },
      { status: 403 },
    );
  }

  const { id: apartmentId } = await context.params;
  const body = await readJsonBody(request);
  const dealYmds = resolveMolitDealYmds({
    dealYmd: body.dealYmd,
    months: body.months,
  });

  if (!dealYmds.ok) {
    return NextResponse.json({ error: dealYmds.error }, { status: 400 });
  }

  const { data: apartment, error: apartmentError } = await supabase
    .from("apartments")
    .select("id,user_id,name,display_name,address,road_address,lawd_cd")
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
      { error: "단지의 법정동코드가 필요합니다." },
      { status: 400 },
    );
  }

  if (!/^\d{5}(\d{5})?$/.test(apartment.lawd_cd)) {
    return NextResponse.json(
      { error: "법정동코드는 5자리 숫자여야 합니다." },
      { status: 400 },
    );
  }

  const molitLawdCd = apartment.lawd_cd.slice(0, 5);
  const legalDongCd =
    apartment.lawd_cd.length === 10 ? apartment.lawd_cd.slice(5) : null;
  const { data: aliasRows, error: aliasError } = await supabase
    .from("apartment_aliases")
    .select("alias,source")
    .eq("apartment_id", apartmentId)
    .or("source.is.null,source.eq.molit");

  if (aliasError && aliasError.code !== "42P01") {
    return NextResponse.json({ error: aliasError.message }, { status: 500 });
  }

  const selectedCandidateName =
    typeof body.selectedCandidateName === "string"
      ? body.selectedCandidateName.trim()
      : "";

  const uniqueSourceNames = buildMolitTransactionSourceNames({
    apartmentName: apartment.name,
    displayName: apartment.display_name,
    aliases: ((aliasRows ?? []) as Array<{ alias: string | null }>).map(
      (alias) => alias.alias,
    ),
    selectedCandidateName,
  });
  const addressTokens = getAddressNumberTokens([
    apartment.address,
    apartment.road_address,
  ]);
  let syncResult: Awaited<ReturnType<typeof collectMolitTransactionSyncResult>>;

  try {
    syncResult = await collectMolitTransactionSyncResult({
      serviceKey: process.env.MOLIT_API_KEY,
      molitLawdCd,
      legalDongCd,
      sourceNames: uniqueSourceNames,
      addressTokens,
      dealYmds,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "국토부 실거래가 조회에 실패했습니다.",
      },
      { status: 502 },
    );
  }

  const { data: rawResponse, error: rawError } = await supabase
    .from("raw_api_responses")
    .insert({
      provider: "molit",
      endpoint: MOLIT_APARTMENT_TRADE_DETAIL_ENDPOINT,
      request_hash: hashText(
        JSON.stringify({
          apartmentId,
          lawdCd: apartment.lawd_cd,
          molitLawdCd,
          legalDongCd,
          mode: dealYmds.mode,
          dealYmds: dealYmds.dealYmds,
          sourceNames: uniqueSourceNames,
          selectedCandidateName,
        }),
      ),
      request_params: {
        apartmentId,
        lawdCd: apartment.lawd_cd,
        molitLawdCd,
        legalDongCd,
        mode: dealYmds.mode,
        dealYmds: dealYmds.dealYmds,
        sourceNames: uniqueSourceNames,
        selectedCandidateName: selectedCandidateName || null,
        attempts: syncResult.attempts,
      },
      response_body: {
        totalCount: syncResult.totalCount,
        matchedCount: syncResult.transactions.length,
        matchedDealYmd: syncResult.selectedDealYmd,
        matchedDealYmds: syncResult.matchedDealYmds,
        candidateNames: syncResult.candidateNames,
        attempts: syncResult.attempts,
        pages: syncResult.matchedPageRecords.map(({ dealYmd, page }) => ({
          dealYmd,
          pageNo: page.pageNo,
          rawXml: page.rawXml,
        })),
      },
      apartment_id: apartmentId,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (rawError) {
    return NextResponse.json({ error: rawError.message }, { status: 500 });
  }

  if (syncResult.transactions.length > 0) {
    const { error: upsertError } = await supabase
      .from("apartment_transactions")
      .upsert(
        syncResult.transactions.map((transaction) =>
          toMolitTransactionPayload(transaction, {
            apartmentId,
            rawApiResponseId: rawResponse.id,
            userId: user.id,
          }),
        ),
        { onConflict: "apartment_id,source_name,source_hash" },
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    if (selectedCandidateName) {
      const { error: aliasUpsertError } = await supabase
        .from("apartment_aliases")
        .upsert(
          {
            user_id: user.id,
            apartment_id: apartmentId,
            alias: selectedCandidateName,
            source: "molit",
          },
          { onConflict: "apartment_id,source,alias" },
        );

      if (aliasUpsertError && aliasUpsertError.code !== "42P01") {
        return NextResponse.json(
          { error: aliasUpsertError.message },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({
    matchedCount: syncResult.transactions.length,
    totalCount: syncResult.totalCount,
    dealYmd: syncResult.selectedDealYmd,
    matchedDealYmds: syncResult.matchedDealYmds,
    monthsChecked: syncResult.attempts.length,
    mode: dealYmds.mode,
    candidateNames: syncResult.candidateNames,
  });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as {
      dealYmd?: unknown;
      months?: unknown;
      selectedCandidateName?: unknown;
    };
  } catch {
    return {};
  }
}
