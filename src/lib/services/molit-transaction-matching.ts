import {
  normalizeApartmentNameForMolit,
  type MolitApartmentTrade,
} from "../data-providers/molit-transactions";

export type MolitAddressHints = {
  lotNumbers: string[];
  roadBuildingNumbers: string[];
  legalDongNames: string[];
};

export type MolitMatchReason =
  | "lot_exact"
  | "road_exact"
  | "name_exact"
  | "name_similar";

export type MolitTransactionCandidate = {
  name: string;
  aptSeq: string | null;
  count: number;
  latestDealDate: string;
  addresses: Array<{ address: string; count: number }>;
  score: number;
  nameSimilarity: number;
  matchReasons: MolitMatchReason[];
};

type MolitSourceEvidence = {
  lotExact: boolean;
  roadExact: boolean;
  nameExact: boolean;
  nameSimilarity: number;
};

export function filterMatchingMolitTransactions({
  addressHints,
  allowFuzzyNameMatch = true,
  legalDongCd,
  sourceNames,
  transactions,
}: {
  transactions: MolitApartmentTrade[];
  sourceNames: string[];
  legalDongCd: string | null;
  addressHints: MolitAddressHints;
  allowFuzzyNameMatch?: boolean;
}) {
  const evaluatedTransactions = transactions
    .filter((transaction) => matchesLegalDong(transaction, legalDongCd))
    .map((transaction) => ({
      transaction,
      evidence: evaluateSourceEvidence(transaction, sourceNames, addressHints),
    }));
  const exactAddressSourceNames = new Set(
    evaluatedTransactions
      .filter(({ evidence }) => evidence.lotExact || evidence.roadExact)
      .map(({ transaction }) => getSourceNameKey(transaction.apartmentNameFromSource))
      .filter(Boolean),
  );

  return evaluatedTransactions
    .filter(({ transaction, evidence }) => {
      const hasAddressExact = evidence.lotExact || evidence.roadExact;

      if (evidence.nameExact) {
        return !isBroadShortSourceName(transaction.apartmentNameFromSource) || hasAddressExact;
      }

      const sourceNameKey = getSourceNameKey(transaction.apartmentNameFromSource);
      const hasUniqueExactAddressSource =
        exactAddressSourceNames.size === 1 && exactAddressSourceNames.has(sourceNameKey);
      const canAutoMatch = hasAddressExact && evidence.nameSimilarity >= 0.45;

      return (
        allowFuzzyNameMatch && canAutoMatch && hasUniqueExactAddressSource
      );
    })
    .map(({ transaction }) => transaction);
}

export function buildMolitTransactionCandidates({
  addressHints,
  legalDongCd,
  sourceNames,
  transactions,
}: {
  transactions: MolitApartmentTrade[];
  sourceNames: string[];
  legalDongCd: string | null;
  addressHints: MolitAddressHints;
}) {
  const byName = new Map<
    string,
    {
      aptSeq: string | null;
      count: number;
      latestDealDate: string;
      addresses: Map<string, number>;
      lotExact: boolean;
      roadExact: boolean;
      nameExact: boolean;
      nameSimilarity: number;
    }
  >();

  for (const transaction of transactions) {
    const sourceName = transaction.apartmentNameFromSource?.trim();

    if (!sourceName || !matchesLegalDong(transaction, legalDongCd)) {
      continue;
    }

    const evidence = evaluateSourceEvidence(transaction, sourceNames, addressHints);
    const current = byName.get(sourceName) ?? {
      aptSeq: null,
      count: 0,
      latestDealDate: transaction.dealDate,
      addresses: new Map<string, number>(),
      lotExact: false,
      roadExact: false,
      nameExact: evidence.nameExact,
      nameSimilarity: evidence.nameSimilarity,
    };

    current.count += 1;
    current.aptSeq ??= transaction.aptSeq ?? null;
    current.lotExact ||= evidence.lotExact;
    current.roadExact ||= evidence.roadExact;
    current.nameExact ||= evidence.nameExact;
    current.nameSimilarity = Math.max(current.nameSimilarity, evidence.nameSimilarity);

    if (transaction.dealDate > current.latestDealDate) {
      current.latestDealDate = transaction.dealDate;
    }

    if (transaction.addressFromSource) {
      addAddressEvidence(current.addresses, transaction.addressFromSource);
    }

    if (transaction.roadAddressFromSource) {
      addAddressEvidence(current.addresses, transaction.roadAddressFromSource);
    }

    byName.set(sourceName, current);
  }

  return Array.from(byName.entries())
    .map(([name, candidate]): MolitTransactionCandidate => {
      const hasAddressExact = candidate.lotExact || candidate.roadExact;
      const score =
        (hasAddressExact ? 100 : 0) +
        (candidate.nameExact ? 80 : Math.round(candidate.nameSimilarity * 50));

      return {
        name,
        aptSeq: candidate.aptSeq,
        count: candidate.count,
        latestDealDate: candidate.latestDealDate,
        addresses: Array.from(candidate.addresses.entries())
          .sort(
            (left, right) =>
              right[1] - left[1] || left[0].localeCompare(right[0], "ko-KR"),
          )
          .slice(0, 3)
          .map(([address, count]) => ({ address, count })),
        score,
        nameSimilarity: candidate.nameSimilarity,
        matchReasons: getMatchReasons(candidate),
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.nameSimilarity - left.nameSimilarity ||
        right.count - left.count ||
        left.name.localeCompare(right.name, "ko-KR"),
    )
    .slice(0, 20);
}

export function normalizeMolitAddressNumber(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || !/^\d+(?:-\d+)?$/.test(trimmed)) {
    return null;
  }

  return trimmed
    .split("-")
    .map((segment) => String(Number.parseInt(segment, 10)))
    .join("-");
}

function evaluateSourceEvidence(
  transaction: MolitApartmentTrade,
  sourceNames: string[],
  addressHints: MolitAddressHints,
): MolitSourceEvidence {
  const lotNumber = normalizeMolitAddressNumber(
    transaction.lotNumberFromSource ?? extractLegalLotNumber(transaction.addressFromSource),
  );
  const roadBuildingNumber = extractRoadBuildingNumber(
    transaction.roadAddressFromSource,
  );
  const lotExact =
    lotNumber !== null &&
    addressHints.lotNumbers.some(
      (candidate) => normalizeMolitAddressNumber(candidate) === lotNumber,
    );
  const roadExact =
    roadBuildingNumber !== null &&
    addressHints.roadBuildingNumbers.some(
      (candidate) => normalizeMolitAddressNumber(candidate) === roadBuildingNumber,
    );
  const { exact: nameExact, similarity: nameSimilarity } = evaluateNameSimilarity(
    transaction.apartmentNameFromSource,
    sourceNames,
    addressHints.legalDongNames,
  );

  return {
    lotExact,
    roadExact,
    nameExact,
    nameSimilarity,
  };
}

function evaluateNameSimilarity(
  sourceName: string | null | undefined,
  targetNames: string[],
  legalDongNames: string[],
) {
  const sourceVariants = getComparableNameVariants(sourceName, legalDongNames);
  const targetVariants = targetNames.flatMap((targetName) =>
    getComparableNameVariants(targetName, legalDongNames),
  );
  let similarity = 0;

  for (const source of sourceVariants) {
    for (const target of targetVariants) {
      if (source === target) {
        return { exact: true, similarity: 1 };
      }

      similarity = Math.max(similarity, getDiceBigramSimilarity(source, target));
    }
  }

  return { exact: false, similarity };
}

function getComparableNameVariants(
  value: string | null | undefined,
  legalDongNames: string[],
) {
  const normalized = normalizeApartmentNameForMolit(value);

  if (!normalized) {
    return [];
  }

  const variants = new Set([normalized]);
  const pending = [normalized];
  const localityPrefixes = legalDongNames
    .map((name) => normalizeApartmentNameForMolit(name))
    .filter(Boolean);

  while (pending.length > 0) {
    const candidate = pending.pop() as string;

    for (const suffix of ["아파트", "apt", "타운"]) {
      if (candidate.endsWith(suffix)) {
        addPendingNameVariant(candidate.slice(0, -suffix.length), variants, pending);
      }
    }

    for (const prefix of localityPrefixes) {
      if (candidate.startsWith(prefix)) {
        addPendingNameVariant(candidate.slice(prefix.length), variants, pending);
      }
    }
  }

  return Array.from(variants);
}

function addPendingNameVariant(
  value: string,
  variants: Set<string>,
  pending: string[],
) {
  if (value && !variants.has(value)) {
    variants.add(value);
    pending.push(value);
  }
}

function getDiceBigramSimilarity(left: string, right: string) {
  if (left === right) {
    return 1;
  }

  if (left.length < 2 || right.length < 2) {
    return 0;
  }

  const leftBigrams = getBigramCounts(left);
  const rightBigrams = getBigramCounts(right);
  let overlap = 0;

  for (const [bigram, leftCount] of leftBigrams) {
    overlap += Math.min(leftCount, rightBigrams.get(bigram) ?? 0);
  }

  return (2 * overlap) / (left.length - 1 + right.length - 1);
}

function getBigramCounts(value: string) {
  const counts = new Map<string, number>();

  for (let index = 0; index < value.length - 1; index += 1) {
    const bigram = value.slice(index, index + 2);
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }

  return counts;
}

function getMatchReasons(candidate: {
  lotExact: boolean;
  roadExact: boolean;
  nameExact: boolean;
  nameSimilarity: number;
}): MolitMatchReason[] {
  const reasons: MolitMatchReason[] = [];

  if (candidate.lotExact) {
    reasons.push("lot_exact");
  }

  if (candidate.roadExact) {
    reasons.push("road_exact");
  }

  if (candidate.nameExact) {
    reasons.push("name_exact");
  } else if (candidate.nameSimilarity > 0) {
    reasons.push("name_similar");
  }

  return reasons;
}

function matchesLegalDong(
  transaction: MolitApartmentTrade,
  legalDongCd: string | null,
) {
  return (
    !legalDongCd || !transaction.umdCd || transaction.umdCd === legalDongCd
  );
}

function extractLegalLotNumber(value: string | null | undefined) {
  const match = value?.match(/(?:^|\s)(\d+(?:-\d+)?)(?:\s|$)/);
  return match?.[1] ?? null;
}

function extractRoadBuildingNumber(value: string | null | undefined) {
  const match = value?.match(/(?:^|\s)\S*(?:로|길)\s+(\d+(?:-\d+)?)(?:\s|$)/);
  return normalizeMolitAddressNumber(match?.[1]);
}

function addAddressEvidence(addresses: Map<string, number>, address: string) {
  addresses.set(address, (addresses.get(address) ?? 0) + 1);
}

function getSourceNameKey(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function isBroadShortSourceName(value: string | null | undefined) {
  const normalized = normalizeApartmentNameForMolit(value);

  return normalized.length > 0 && normalized.length < 4 && !/\d/.test(normalized);
}
