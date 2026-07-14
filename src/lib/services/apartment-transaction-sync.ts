import { createHash } from "node:crypto";
import {
  fetchMolitApartmentTradePages,
  MOLIT_APARTMENT_TRADE_DETAIL_ENDPOINT,
  normalizeApartmentNameForMolit,
  resolveMolitDealYmds,
  type MolitApartmentTrade,
  type MolitApartmentTradePage,
  type ResolveMolitDealYmdsResult,
} from "../data-providers/molit-transactions";
import {
  buildMolitTransactionCandidates,
  filterMatchingMolitTransactions,
  normalizeMolitAddressNumber,
  type MolitAddressHints,
  type MolitRoadAddressPair,
  type MolitTransactionCandidate,
} from "./molit-transaction-matching";

export const MOLIT_TRANSACTION_SOURCE_NAME = "molit-apt-trade-detail";
// Bound provider fan-out while keeping 36-month syncs within the route budget.
export const MOLIT_MONTH_FETCH_CONCURRENCY = 4;

type ResolvedMolitDealYmds = Extract<ResolveMolitDealYmdsResult, { ok: true }>;
type FetchMolitTransactionPages = typeof fetchMolitApartmentTradePages;
type FetchedMolitTransactionBatch = {
  dealYmd: string;
  pages: MolitApartmentTradePage[];
  transactions: MolitApartmentTrade[];
};

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
  matchedSourceNames: string[];
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

export function getMolitAddressHints({
  fallbackAddresses,
  legalAddresses,
  roadAddresses,
}: {
  legalAddresses: Array<string | null | undefined>;
  roadAddresses: Array<string | null | undefined>;
  fallbackAddresses: Array<string | null | undefined>;
}): MolitAddressHints {
  const lotNumbers = new Set<string>();
  const roadAddressPairs = new Map<string, MolitRoadAddressPair>();
  const legalDongNames = new Set<string>();

  for (const address of legalAddresses) {
    addLegalAddressHints(address, lotNumbers, legalDongNames);
  }

  for (const address of roadAddresses) {
    addRoadAddressHint(address, roadAddressPairs);
  }

  for (const address of fallbackAddresses) {
    if (isRoadAddress(address)) {
      addRoadAddressHint(address, roadAddressPairs);
    } else {
      addLegalAddressHints(address, lotNumbers, legalDongNames);
    }
  }

  return {
    lotNumbers: Array.from(lotNumbers),
    roadAddressPairs: Array.from(roadAddressPairs.values()),
    legalDongNames: Array.from(legalDongNames),
  };
}

export function resolveMolitTransactionSyncWindow({
  dealYmd,
  months,
  now,
}: {
  dealYmd?: unknown;
  months?: unknown;
  now?: Date;
}) {
  const hasExplicitScope = dealYmd !== undefined || months !== undefined;

  return {
    dealYmds: resolveMolitDealYmds({
      dealYmd,
      months: hasExplicitScope ? months : 36,
      now,
    }),
    primaryMonthCount: hasExplicitScope ? undefined : 12,
  };
}

export async function collectMolitTransactionSyncResult({
  addressHints,
  dealYmds,
  fetchPages = fetchMolitApartmentTradePages,
  legalDongCd,
  molitLawdCd,
  primaryMonthCount,
  serviceKey,
  sourceNames,
}: {
  serviceKey: string;
  molitLawdCd: string;
  legalDongCd: string | null;
  sourceNames: string[];
  addressHints: MolitAddressHints;
  dealYmds: ResolvedMolitDealYmds;
  primaryMonthCount?: number;
  fetchPages?: FetchMolitTransactionPages;
}): Promise<MolitTransactionSyncResult> {
  const requestedDealYmds =
    dealYmds.mode === "manual"
      ? dealYmds.dealYmds.slice(0, 1)
      : dealYmds.dealYmds;
  const resolvedPrimaryMonthCount =
    dealYmds.mode === "recent" && primaryMonthCount !== undefined
      ? Math.min(
          requestedDealYmds.length,
          Math.max(0, Math.trunc(primaryMonthCount)),
        )
      : requestedDealYmds.length;
  const fetchedBatches: FetchedMolitTransactionBatch[] = [];
  fetchedBatches.push(
    ...(await fetchMolitTransactionBatches({
      dealYmds: requestedDealYmds.slice(0, resolvedPrimaryMonthCount),
      fetchPages,
      molitLawdCd,
      serviceKey,
    })),
  );

  let result = buildMolitTransactionSyncResult({
    addressHints,
    fetchedBatches,
    legalDongCd,
    mode: dealYmds.mode,
    sourceNames,
  });

  if (
    dealYmds.mode === "recent" &&
    result.transactions.length === 0 &&
    resolvedPrimaryMonthCount < requestedDealYmds.length
  ) {
    fetchedBatches.push(
      ...(await fetchMolitTransactionBatches({
        dealYmds: requestedDealYmds.slice(resolvedPrimaryMonthCount),
        fetchPages,
        molitLawdCd,
        serviceKey,
      })),
    );

    result = buildMolitTransactionSyncResult({
      addressHints,
      fetchedBatches,
      legalDongCd,
      mode: dealYmds.mode,
      sourceNames,
    });
  }

  return result;
}

async function fetchMolitTransactionBatches({
  dealYmds,
  fetchPages,
  molitLawdCd,
  serviceKey,
}: {
  dealYmds: string[];
  fetchPages: FetchMolitTransactionPages;
  molitLawdCd: string;
  serviceKey: string;
}) {
  const batches: FetchedMolitTransactionBatch[] = [];

  for (
    let index = 0;
    index < dealYmds.length;
    index += MOLIT_MONTH_FETCH_CONCURRENCY
  ) {
    const chunk = dealYmds.slice(index, index + MOLIT_MONTH_FETCH_CONCURRENCY);
    const fetchedChunk = await Promise.all(
      chunk.map(async (dealYmd): Promise<FetchedMolitTransactionBatch> => {
        const pages = await fetchPages({
          serviceKey,
          lawdCd: molitLawdCd,
          dealYmd,
        });

        return {
          dealYmd,
          pages,
          transactions: pages.flatMap((page) => page.transactions),
        };
      }),
    );

    batches.push(...fetchedChunk);
  }

  return batches;
}

function buildMolitTransactionSyncResult({
  addressHints,
  fetchedBatches,
  legalDongCd,
  mode,
  sourceNames,
}: {
  addressHints: MolitAddressHints;
  fetchedBatches: FetchedMolitTransactionBatch[];
  legalDongCd: string | null;
  mode: ResolvedMolitDealYmds["mode"];
  sourceNames: string[];
}): MolitTransactionSyncResult {
  const attempts: MolitTransactionSyncAttempt[] = [];
  const matchedPageRecords: MolitMatchedPageRecord[] = [];
  const allFetchedTransactions = fetchedBatches.flatMap(
    (batch) => batch.transactions,
  );
  const matchedTransactionSet = new Set(
    filterMatchingMolitTransactions({
      transactions: allFetchedTransactions,
      sourceNames,
      legalDongCd,
      addressHints,
    }),
  );
  const candidateTransactions: MolitApartmentTrade[] = [];
  let selectedDealYmd: string | null = null;
  const transactions: MolitApartmentTrade[] = [];

  for (const batch of fetchedBatches) {
    const matchedTransactions = batch.transactions.filter((transaction) =>
      matchedTransactionSet.has(transaction),
    );

    attempts.push({
      dealYmd: batch.dealYmd,
      totalCount: batch.pages[0]?.totalCount ?? 0,
      matchedCount: matchedTransactions.length,
      pageCount: batch.pages.length,
    });

    if (matchedTransactions.length > 0) {
      selectedDealYmd ??= batch.dealYmd;
      matchedPageRecords.push(
        ...batch.pages.map((page) => ({ dealYmd: batch.dealYmd, page })),
      );
      transactions.push(...matchedTransactions);
    } else {
      candidateTransactions.push(...batch.transactions);
    }
  }

  if (mode === "manual" && !selectedDealYmd) {
    const manualBatch = fetchedBatches[0];

    if (manualBatch) {
      selectedDealYmd = manualBatch.dealYmd;
      matchedPageRecords.push(
        ...manualBatch.pages.map((page) => ({
          dealYmd: manualBatch.dealYmd,
          page,
        })),
      );
    }
  }

  const candidateNames = buildMolitTransactionCandidates({
    transactions: candidateTransactions,
    sourceNames,
    legalDongCd,
    addressHints,
  });

  return {
    attempts,
    candidateNames,
    matchedDealYmds: getMatchedDealYmds(transactions),
    matchedPageRecords,
    matchedSourceNames: getMatchedMolitSourceNames(transactions),
    selectedDealYmd,
    totalCount: attempts.reduce((sum, attempt) => sum + attempt.totalCount, 0),
    transactions,
  };
}

function getMatchedMolitSourceNames(transactions: MolitApartmentTrade[]) {
  return Array.from(
    new Set(
      transactions
        .map((transaction) => transaction.apartmentNameFromSource?.trim() ?? "")
        .filter(Boolean),
    ),
  );
}

function addLegalAddressHints(
  value: string | null | undefined,
  lotNumbers: Set<string>,
  legalDongNames: Set<string>,
) {
  const tokens = getAddressTokens(value);
  const localityIndex = findFinalLegalLocalityIndex(tokens);

  if (localityIndex < 0) {
    return;
  }

  legalDongNames.add(tokens[localityIndex]);

  const lotTokenIndex =
    tokens[localityIndex + 1] === "산" ? localityIndex + 2 : localityIndex + 1;
  const lotNumber = normalizeMolitAddressNumber(tokens[lotTokenIndex]);

  if (lotNumber) {
    lotNumbers.add(lotNumber);
  }
}

function addRoadAddressHint(
  value: string | null | undefined,
  roadAddressPairs: Map<string, MolitRoadAddressPair>,
) {
  const tokens = getAddressTokens(value);
  const roadIndex = tokens.findIndex(isRoadNameToken);

  if (roadIndex < 0) {
    return;
  }

  const roadName = normalizeApartmentNameForMolit(tokens[roadIndex]);
  const buildingNumber = normalizeMolitAddressNumber(tokens[roadIndex + 1]);

  if (roadName && buildingNumber) {
    roadAddressPairs.set(`${roadName}|${buildingNumber}`, {
      roadName,
      buildingNumber,
    });
  }
}

function getAddressTokens(value: string | null | undefined) {
  return (
    value
      ?.trim()
      .split(/\s+/)
      .map((token) => token.replace(/^[([{]+|[)\]},]+$/g, ""))
      .filter(Boolean) ?? []
  );
}

function isLegalLocalityToken(value: string) {
  return /^[가-힣][가-힣0-9·]*(?:동|읍|면|리)$/.test(value);
}

function findFinalLegalLocalityIndex(tokens: string[]) {
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (!isLegalLocalityToken(tokens[index])) {
      continue;
    }

    const lotTokenIndex =
      tokens[index + 1] === "산" ? index + 2 : index + 1;

    if (normalizeMolitAddressNumber(tokens[lotTokenIndex])) {
      return index;
    }
  }

  return -1;
}

function isRoadNameToken(value: string) {
  return /[가-힣0-9·]+(?:로|길)$/.test(value);
}

function isRoadAddress(value: string | null | undefined) {
  return getAddressTokens(value).some(isRoadNameToken);
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
