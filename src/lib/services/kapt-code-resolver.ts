import type { KaptApartmentListItem } from "../data-providers/kapt-apartment-list";
import {
  isMolitApartmentNameCandidate,
  isMolitApartmentNameMatch,
} from "../data-providers/molit-transactions";

export type KaptCodeResolverApartment = {
  name: string | null;
  display_name: string | null;
  address: string | null;
  road_address: string | null;
  lawd_cd: string | null;
};

export type KaptCodeResolverAlias = {
  alias: string | null;
};

export type KaptCodeResolverTransaction = {
  apartment_name_from_source: string | null;
  address_from_source: string | null;
};

export type ScoredKaptCodeCandidate = KaptApartmentListItem & {
  score: number;
  reasons: string[];
};

export type KaptCodeResolution =
  | {
      status: "auto";
      selected: ScoredKaptCodeCandidate;
      candidates: ScoredKaptCodeCandidate[];
      reason: string;
    }
  | {
      status: "needs_selection";
      selected: null;
      candidates: ScoredKaptCodeCandidate[];
      reason: string;
    }
  | {
      status: "none";
      selected: null;
      candidates: [];
      reason: string;
    };

export function resolveKaptCodeCandidate({
  apartment,
  aliases,
  transactions,
  candidates,
}: {
  apartment: KaptCodeResolverApartment;
  aliases: KaptCodeResolverAlias[];
  transactions: KaptCodeResolverTransaction[];
  candidates: KaptApartmentListItem[];
}): KaptCodeResolution {
  const filteredCandidates = filterCandidatesByLawd(candidates, apartment.lawd_cd);

  if (candidates.length === 0) {
    return {
      status: "none",
      selected: null,
      candidates: [],
      reason: "법정동코드에 맞는 K-apt 후보를 찾지 못했습니다.",
    };
  }

  const nameHints = getNameHints(apartment, aliases, transactions);
  const addressHints = getAddressHints(apartment, transactions);
  const isLawdFiltered = filteredCandidates.length > 0;
  const candidatesToScore = isLawdFiltered ? filteredCandidates : candidates;
  const scoredCandidates = candidatesToScore
    .map((candidate) =>
      scoreCandidate(candidate, {
        lawdCd: apartment.lawd_cd,
        nameHints,
        addressHints,
      }),
    )
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.kaptName.localeCompare(right.kaptName),
    )
    .slice(0, 5);

  if (scoredCandidates.length === 0) {
    return {
      status: "none",
      selected: null,
      candidates: [],
      reason: "K-apt 후보 점수가 충분하지 않습니다.",
    };
  }

  const [top, second] = scoredCandidates;

  if (shouldAutoSelect(top, second, scoredCandidates.length)) {
    return {
      status: "auto",
      selected: top,
      candidates: scoredCandidates,
      reason: "K-apt 후보가 명확해 자동 저장할 수 있습니다.",
    };
  }

  return {
    status: "needs_selection",
    selected: null,
    candidates: scoredCandidates,
    reason: "K-apt 후보가 여러 개이거나 확신이 낮아 선택이 필요합니다.",
  };
}

function filterCandidatesByLawd(
  candidates: KaptApartmentListItem[],
  lawdCd: string | null,
) {
  if (!lawdCd) {
    return candidates;
  }

  if (lawdCd.length === 10) {
    const exact = candidates.filter((candidate) => candidate.bjdCode === lawdCd);

    if (exact.length > 0) {
      return exact;
    }
  }

  const prefix = lawdCd.slice(0, 5);
  return candidates.filter((candidate) => candidate.bjdCode?.startsWith(prefix));
}

function scoreCandidate(
  candidate: KaptApartmentListItem,
  context: {
    lawdCd: string | null;
    nameHints: string[];
    addressHints: string[];
  },
): ScoredKaptCodeCandidate {
  const reasons: string[] = [];
  let score = 0;

  if (context.lawdCd && candidate.bjdCode === context.lawdCd) {
    score += 60;
    reasons.push("법정동코드 일치");
  } else if (
    context.lawdCd &&
    candidate.bjdCode?.startsWith(context.lawdCd.slice(0, 5))
  ) {
    score += 35;
    reasons.push("시군구 코드 일치");
  }

  if (isMolitApartmentNameMatch(candidate.kaptName, context.nameHints)) {
    score += 50;
    reasons.push("단지명 일치");
  } else if (isMolitApartmentNameCandidate(candidate.kaptName, context.nameHints)) {
    score += 35;
    reasons.push("단지명 후보");
  }

  if (
    context.addressHints.some(
      (hint) =>
        candidate.eupmyeondong?.includes(hint) ||
        candidate.ri?.includes(hint) ||
        Boolean(candidate.eupmyeondong && hint.includes(candidate.eupmyeondong)),
    )
  ) {
    score += 10;
    reasons.push("주소 단서 일치");
  }

  return {
    ...candidate,
    score,
    reasons,
  };
}

function shouldAutoSelect(
  top: ScoredKaptCodeCandidate,
  second: ScoredKaptCodeCandidate | undefined,
  candidateCount: number,
) {
  const hasNameEvidence = top.reasons.some((reason) => reason.startsWith("단지명"));
  const hasLawdEvidence = top.reasons.some((reason) => reason.includes("코드 일치"));

  if (!hasNameEvidence || !hasLawdEvidence) {
    return false;
  }

  if (candidateCount === 1 && top.score >= 85) {
    return true;
  }

  return top.score >= 100 && (!second || top.score - second.score >= 25);
}

function getNameHints(
  apartment: KaptCodeResolverApartment,
  aliases: KaptCodeResolverAlias[],
  transactions: KaptCodeResolverTransaction[],
) {
  return Array.from(
    new Set(
      [
        apartment.name,
        apartment.display_name,
        ...aliases.map((alias) => alias.alias),
        ...transactions.map((transaction) => transaction.apartment_name_from_source),
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

function getAddressHints(
  apartment: KaptCodeResolverApartment,
  transactions: KaptCodeResolverTransaction[],
) {
  return Array.from(
    new Set(
      [apartment.address, apartment.road_address]
        .concat(transactions.map((transaction) => transaction.address_from_source))
        .flatMap((value) => value?.match(/[가-힣]+동|[가-힣]+읍|[가-힣]+면|[가-힣]+리/g) ?? []),
    ),
  );
}
