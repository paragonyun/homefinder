import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import {
  fetchMolitApartmentTradePages,
  isMolitApartmentNameMatch,
  MOLIT_APARTMENT_TRADE_DETAIL_ENDPOINT,
  normalizeApartmentNameForMolit,
  resolveMolitDealYmds,
  type MolitApartmentTrade,
  type MolitApartmentTradePage,
} from "@/lib/data-providers/molit-transactions";
import {
  createSupabaseRouteClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/server";

const MOLIT_SOURCE_NAME = "molit-apt-trade-detail";

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
    .select("id,user_id,name,display_name,lawd_cd")
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
  const sourceNames = [
    normalizeApartmentNameForMolit(apartment.name),
    normalizeApartmentNameForMolit(apartment.display_name),
  ].filter(Boolean);
  const attempts: Array<{
    dealYmd: string;
    totalCount: number;
    matchedCount: number;
    pageCount: number;
  }> = [];
  let selectedDealYmd: string | null = null;
  let selectedPages: MolitApartmentTradePage[] = [];
  let transactions: MolitApartmentTrade[] = [];

  try {
    for (const dealYmd of dealYmds.dealYmds) {
      const pages = await fetchMolitApartmentTradePages({
        serviceKey: process.env.MOLIT_API_KEY,
        lawdCd: molitLawdCd,
        dealYmd,
      });
      const matchedTransactions = getMatchingTransactions(
        pages,
        sourceNames,
        legalDongCd,
      );

      attempts.push({
        dealYmd,
        totalCount: pages[0]?.totalCount ?? 0,
        matchedCount: matchedTransactions.length,
        pageCount: pages.length,
      });

      if (matchedTransactions.length > 0 || dealYmds.mode === "manual") {
        selectedDealYmd = dealYmd;
        selectedPages = pages;
        transactions = matchedTransactions;
        break;
      }
    }
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
          sourceNames,
        }),
      ),
      request_params: {
        apartmentId,
        lawdCd: apartment.lawd_cd,
        molitLawdCd,
        legalDongCd,
        mode: dealYmds.mode,
        dealYmds: dealYmds.dealYmds,
        sourceNames,
        attempts,
      },
      response_body: {
        totalCount: attempts.reduce((sum, attempt) => sum + attempt.totalCount, 0),
        matchedCount: transactions.length,
        matchedDealYmd: selectedDealYmd,
        attempts,
        pages: selectedPages.map((page) => ({
          dealYmd: selectedDealYmd,
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

  if (transactions.length > 0) {
    const { error: upsertError } = await supabase
      .from("apartment_transactions")
      .upsert(
        transactions.map((transaction) =>
          toTransactionPayload(transaction, {
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
  }

  return NextResponse.json({
    matchedCount: transactions.length,
    totalCount: attempts.reduce((sum, attempt) => sum + attempt.totalCount, 0),
    dealYmd: selectedDealYmd,
    monthsChecked: attempts.length,
    mode: dealYmds.mode,
  });
}

function getMatchingTransactions(
  pages: MolitApartmentTradePage[],
  sourceNames: string[],
  legalDongCd: string | null,
) {
  return pages
    .flatMap((page) => page.transactions)
    .filter((transaction) =>
      matchesLegalDong(transaction, legalDongCd) &&
      isMolitApartmentNameMatch(transaction.apartmentNameFromSource, sourceNames),
    );
}

function matchesLegalDong(
  transaction: MolitApartmentTrade,
  legalDongCd: string | null,
) {
  return !legalDongCd || !transaction.umdCd || transaction.umdCd === legalDongCd;
}

function toTransactionPayload(
  transaction: MolitApartmentTrade,
  context: {
    apartmentId: string;
    rawApiResponseId: string;
    userId: string;
  },
) {
  return {
    user_id: context.userId,
    apartment_id: context.apartmentId,
    raw_api_response_id: context.rawApiResponseId,
    source_name: MOLIT_SOURCE_NAME,
    source_ref: MOLIT_APARTMENT_TRADE_DETAIL_ENDPOINT,
    source_hash: getTransactionSourceHash(context.apartmentId, transaction),
    deal_year: transaction.dealYear,
    deal_month: transaction.dealMonth,
    deal_day: transaction.dealDay,
    deal_date: transaction.dealDate,
    exclusive_area_m2: transaction.exclusiveAreaM2,
    floor: transaction.floor,
    deal_amount_krw: transaction.dealAmountKrw,
    deal_amount_manwon: transaction.dealAmountManwon,
    apartment_name_from_source: transaction.apartmentNameFromSource,
    address_from_source: transaction.addressFromSource,
    cancel_yn: transaction.cancelYn,
    cancel_date: transaction.cancelDate,
    confidence_level: "high",
    fetched_at: new Date().toISOString(),
  };
}

function getTransactionSourceHash(
  apartmentId: string,
  transaction: MolitApartmentTrade,
) {
  return hashText(
    [
      apartmentId,
      transaction.aptSeq ?? "",
      transaction.aptDong ?? "",
      transaction.dealDate,
      transaction.exclusiveAreaM2,
      transaction.floor ?? "",
      transaction.dealAmountManwon,
      normalizeApartmentNameForMolit(transaction.apartmentNameFromSource),
      transaction.addressFromSource ?? "",
    ].join("|"),
  );
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
    return (await request.json()) as { dealYmd?: unknown; months?: unknown };
  } catch {
    return {};
  }
}
