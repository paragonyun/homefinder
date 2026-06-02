import {
  isMolitApartmentNameCandidate,
  isMolitApartmentNameMatch,
  normalizeApartmentNameForMolit,
  type MolitApartmentTrade,
} from "../data-providers/molit-transactions";

export type MolitTransactionCandidate = {
  name: string;
  count: number;
  latestDealDate: string;
  addresses: Array<{ address: string; count: number }>;
};

export function filterMatchingMolitTransactions({
  addressTokens,
  legalDongCd,
  sourceNames,
  transactions,
}: {
  transactions: MolitApartmentTrade[];
  sourceNames: string[];
  legalDongCd: string | null;
  addressTokens: string[];
}) {
  return transactions.filter((transaction) => {
    if (!matchesLegalDong(transaction, legalDongCd)) {
      return false;
    }

    if (!isMolitApartmentNameMatch(transaction.apartmentNameFromSource, sourceNames)) {
      return false;
    }

    if (isBroadShortSourceName(transaction.apartmentNameFromSource)) {
      return hasAddressTokenMatch(transaction, addressTokens);
    }

    return true;
  });
}

export function buildMolitTransactionCandidates({
  addressTokens,
  legalDongCd,
  sourceNames,
  transactions,
}: {
  transactions: MolitApartmentTrade[];
  sourceNames: string[];
  legalDongCd: string | null;
  addressTokens: string[];
}) {
  const byName = new Map<
    string,
    {
      count: number;
      latestDealDate: string;
      addresses: Map<string, number>;
    }
  >();

  for (const transaction of transactions) {
    const sourceName = transaction.apartmentNameFromSource;

    if (!sourceName || !matchesLegalDong(transaction, legalDongCd)) {
      continue;
    }

    const hasAddressMatch = hasAddressTokenMatch(transaction, addressTokens);
    const hasNameCandidate = isMolitApartmentNameCandidate(
      sourceName,
      sourceNames,
    );

    if (!hasAddressMatch && !hasNameCandidate) {
      continue;
    }

    const current = byName.get(sourceName) ?? {
      count: 0,
      latestDealDate: transaction.dealDate,
      addresses: new Map<string, number>(),
    };
    current.count += 1;

    if (transaction.dealDate > current.latestDealDate) {
      current.latestDealDate = transaction.dealDate;
    }

    if (transaction.addressFromSource && hasAddressMatch) {
      current.addresses.set(
        transaction.addressFromSource,
        (current.addresses.get(transaction.addressFromSource) ?? 0) + 1,
      );
    }

    byName.set(sourceName, current);
  }

  return Array.from(byName.entries())
    .map(([name, candidate]) => ({
      name,
      count: candidate.count,
      latestDealDate: candidate.latestDealDate,
      addresses: Array.from(candidate.addresses.entries())
        .sort(
          (left, right) =>
            right[1] - left[1] || left[0].localeCompare(right[0], "ko-KR"),
        )
        .slice(0, 3)
        .map(([address, count]) => ({ address, count })),
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.name.localeCompare(right.name, "ko-KR"),
    )
    .slice(0, 12);
}

function matchesLegalDong(
  transaction: MolitApartmentTrade,
  legalDongCd: string | null,
) {
  return !legalDongCd || !transaction.umdCd || transaction.umdCd === legalDongCd;
}

function hasAddressTokenMatch(
  transaction: MolitApartmentTrade,
  addressTokens: string[],
) {
  return (
    addressTokens.length > 0 &&
    addressTokens.some((token) => transaction.addressFromSource?.includes(token))
  );
}

function isBroadShortSourceName(value: string | null | undefined) {
  const normalized = normalizeApartmentNameForMolit(value);

  return normalized.length > 0 && normalized.length < 4 && !/\d/.test(normalized);
}
