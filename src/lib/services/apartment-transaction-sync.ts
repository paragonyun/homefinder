import { createHash } from "node:crypto";
import {
  fetchMolitApartmentTradePages,
  MOLIT_APARTMENT_TRADE_DETAIL_ENDPOINT,
  normalizeApartmentNameForMolit,
  type MolitApartmentTrade,
  type MolitApartmentTradePage,
  type ResolveMolitDealYmdsResult,
} from "../data-providers/molit-transactions";
import {
  buildMolitTransactionCandidates,
  filterMatchingMolitTransactions,
  type MolitTransactionCandidate,
} from "./molit-transaction-matching";

export const MOLIT_TRANSACTION_SOURCE_NAME = "molit-apt-trade-detail";

type ResolvedMolitDealYmds = Extract<ResolveMolitDealYmdsResult, { ok: true }>;
type FetchMolitTransactionPages = typeof fetchMolitApartmentTradePages;

export type MolitTransactionSyncAttempt = {
  dealYmd: string;
  totalCount: number;
  matchedCount: number;
  pageCount: number;
};

export type MolitMatchedPageRecord = {
  dealYmd: string;
  page: MolitApartmentTradePage;
};

export type MolitTransactionSyncResult = {
  attempts: MolitTransactionSyncAttempt[];
  candidateNames: MolitTransactionCandidate[];
  matchedDealYmds: string[];
  matchedPageRecords: MolitMatchedPageRecord[];
  selectedDealYmd: string | null;
  totalCount: number;
  transactions: MolitApartmentTrade[];
};

export function buildMolitTransactionSourceNames({
  aliases,
  apartmentName,
  displayName,
  selectedCandidateName,
}: {
  apartmentName: string | null;
  displayName: string | null;
  aliases: Array<string | null>;
  selectedCandidateName: string;
}) {
  return Array.from(
    new Set(
      [
        apartmentName,
        displayName,
        ...aliases,
        selectedCandidateName || null,
      ]
        .map((value) => normalizeApartmentNameForMolit(value))
        .filter(Boolean),
    ),
  );
}

export function getAddressNumberTokens(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => value?.match(/\d{1,4}(?:-\d{1,4})?/g) ?? [])
        .filter((value) => value.length >= 2),
    ),
  );
}

export async function collectMolitTransactionSyncResult({
  addressTokens,
  dealYmds,
  fetchPages = fetchMolitApartmentTradePages,
  legalDongCd,
  molitLawdCd,
  serviceKey,
  sourceNames,
}: {
  serviceKey: string;
  molitLawdCd: string;
  legalDongCd: string | null;
  sourceNames: string[];
  addressTokens: string[];
  dealYmds: ResolvedMolitDealYmds;
  fetchPages?: FetchMolitTransactionPages;
}): Promise<MolitTransactionSyncResult> {
  const attempts: MolitTransactionSyncAttempt[] = [];
  const matchedPageRecords: MolitMatchedPageRecord[] = [];
  const candidateTransactions: MolitApartmentTrade[] = [];
  let selectedDealYmd: string | null = null;
  const transactions: MolitApartmentTrade[] = [];

  for (const dealYmd of dealYmds.dealYmds) {
    const pages = await fetchPages({
      serviceKey,
      lawdCd: molitLawdCd,
      dealYmd,
    });
    const pageTransactions = pages.flatMap((page) => page.transactions);
    const matchedTransactions = filterMatchingMolitTransactions({
      transactions: pageTransactions,
      sourceNames,
      legalDongCd,
      addressTokens,
    });

    if (matchedTransactions.length === 0) {
      candidateTransactions.push(...pageTransactions);
    }

    attempts.push({
      dealYmd,
      totalCount: pages[0]?.totalCount ?? 0,
      matchedCount: matchedTransactions.length,
      pageCount: pages.length,
    });

    if (matchedTransactions.length > 0) {
      selectedDealYmd ??= dealYmd;
      matchedPageRecords.push(...pages.map((page) => ({ dealYmd, page })));
      transactions.push(...matchedTransactions);
    }

    if (dealYmds.mode === "manual") {
      if (!selectedDealYmd) {
        selectedDealYmd = dealYmd;
        matchedPageRecords.push(...pages.map((page) => ({ dealYmd, page })));
      }

      break;
    }
  }

  const candidateNames = buildMolitTransactionCandidates({
    transactions: candidateTransactions,
    sourceNames,
    legalDongCd,
    addressTokens,
  });

  return {
    attempts,
    candidateNames,
    matchedDealYmds: getMatchedDealYmds(transactions),
    matchedPageRecords,
    selectedDealYmd,
    totalCount: attempts.reduce((sum, attempt) => sum + attempt.totalCount, 0),
    transactions,
  };
}

export function getMatchedDealYmds(transactions: MolitApartmentTrade[]) {
  return Array.from(
    new Set(
      transactions.map(
        (transaction) =>
          `${transaction.dealYear}${String(transaction.dealMonth).padStart(2, "0")}`,
      ),
    ),
  ).sort((left, right) => right.localeCompare(left));
}

export function toMolitTransactionPayload(
  transaction: MolitApartmentTrade,
  context: {
    apartmentId: string;
    rawApiResponseId: string;
    userId: string;
    fetchedAt?: string;
  },
) {
  return {
    user_id: context.userId,
    apartment_id: context.apartmentId,
    raw_api_response_id: context.rawApiResponseId,
    source_name: MOLIT_TRANSACTION_SOURCE_NAME,
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
    fetched_at: context.fetchedAt ?? new Date().toISOString(),
  };
}

export function collapseMolitTransactions(
  transactions: MolitApartmentTrade[],
  apartmentId: string,
) {
  const bySourceHash = new Map<string, MolitApartmentTrade>();

  for (const transaction of transactions) {
    const sourceHash = getTransactionSourceHash(apartmentId, transaction);
    const current = bySourceHash.get(sourceHash);

    if (!current || (!current.cancelYn && transaction.cancelYn)) {
      bySourceHash.set(sourceHash, transaction);
    }
  }

  return Array.from(bySourceHash.values());
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

export function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
