export type ApartmentScoreFieldNote = {
  overallRating?: number | null;
  stationWalkRating?: number | null;
  slopeRating?: number | null;
  parkingRating?: number | null;
  noiseRating?: number | null;
  nightMoodRating?: number | null;
  commercialAreaRating?: number | null;
  revisitIntention?: string | null;
};

export type ApartmentScoreInput = {
  latestPriceKrw?: number | null;
  commuteToYeouidoTransitMinutes?: number | null;
  commuteToYeouidoDrivingMinutes?: number | null;
  commuteToGangnamTransitMinutes?: number | null;
  commuteToGangnamDrivingMinutes?: number | null;
  householdCount?: number | null;
  parkingPerHousehold?: number | null;
  buildingAgeYears?: number | null;
  floorAreaRatio?: number | null;
  transactionCount?: number | null;
  fieldNote?: ApartmentScoreFieldNote | null;
};

export type ApartmentScoreCategory = {
  label: string;
  score: number;
  maxScore: number;
};

export type ApartmentScoreResult = {
  totalScore: number;
  maxScore: 100;
  categories: {
    budget: ApartmentScoreCategory;
    access: ApartmentScoreCategory;
    complex: ApartmentScoreCategory;
    market: ApartmentScoreCategory;
    field: ApartmentScoreCategory;
  };
  evidence: string[];
  warnings: string[];
};

export function scoreApartmentCandidate(
  input: ApartmentScoreInput,
): ApartmentScoreResult {
  const evidence: string[] = [];
  const warnings: string[] = [];
  const budget = scoreBudget(input.latestPriceKrw ?? null, evidence, warnings);
  const access = scoreAccess(input, evidence, warnings);
  const complex = scoreComplex(input, evidence, warnings);
  const market = scoreMarket(input, evidence, warnings);
  const field = scoreField(input.fieldNote ?? null, evidence, warnings);
  const totalScore = roundScore(
    budget.score + access.score + complex.score + market.score + field.score,
  );

  return {
    totalScore,
    maxScore: 100,
    categories: {
      budget,
      access,
      complex,
      market,
      field,
    },
    evidence: Array.from(new Set(evidence)),
    warnings: Array.from(new Set(warnings)),
  };
}

function scoreBudget(
  latestPriceKrw: number | null,
  evidence: string[],
  warnings: string[],
): ApartmentScoreCategory {
  let score = 0;

  if (latestPriceKrw === null) {
    score = 8;
    warnings.push("가격 미확인");
  } else if (latestPriceKrw <= 800_000_000) {
    score = 25;
    evidence.push("예산 여유");
  } else if (latestPriceKrw <= 1_000_000_000) {
    const ratio = (latestPriceKrw - 800_000_000) / 200_000_000;
    score = interpolate(25, 18, ratio);
    evidence.push("예산 검토권");
  } else if (latestPriceKrw <= 1_100_000_000) {
    const ratio = (latestPriceKrw - 1_000_000_000) / 100_000_000;
    score = interpolate(10, 3, ratio);
    evidence.push("예산 초과 감점");
    warnings.push("예산 초과");
  } else {
    score = 0;
    evidence.push("예산 초과 감점");
    warnings.push("예산 크게 초과");
  }

  return category("자금", score, 25);
}

function scoreAccess(
  input: ApartmentScoreInput,
  evidence: string[],
  warnings: string[],
): ApartmentScoreCategory {
  const yeouidoScore = scoreDestinationAccess({
    transitMinutes: input.commuteToYeouidoTransitMinutes ?? null,
    drivingMinutes: input.commuteToYeouidoDrivingMinutes ?? null,
    maxScore: 12,
  });
  const gangnamScore = scoreDestinationAccess({
    transitMinutes: input.commuteToGangnamTransitMinutes ?? null,
    drivingMinutes: input.commuteToGangnamDrivingMinutes ?? null,
    maxScore: 8,
  });

  if (
    input.commuteToYeouidoTransitMinutes === null &&
    input.commuteToYeouidoDrivingMinutes === null &&
    input.commuteToGangnamTransitMinutes === null &&
    input.commuteToGangnamDrivingMinutes === null
  ) {
    warnings.push("접근성 미조회");
  } else {
    evidence.push("접근성 반영");
  }

  return category("접근성", yeouidoScore + gangnamScore, 20);
}

function scoreDestinationAccess({
  drivingMinutes,
  maxScore,
  transitMinutes,
}: {
  transitMinutes: number | null;
  drivingMinutes: number | null;
  maxScore: number;
}) {
  return (
    scoreDuration(transitMinutes, 20, 60) * maxScore * 0.7 +
    scoreDuration(drivingMinutes, 15, 45) * maxScore * 0.3
  );
}

function scoreComplex(
  input: ApartmentScoreInput,
  evidence: string[],
  warnings: string[],
): ApartmentScoreCategory {
  const hasFloorAreaRatio =
    typeof input.floorAreaRatio === "number" && input.floorAreaRatio > 0;
  const weights = hasFloorAreaRatio
    ? { household: 5, parking: 4, age: 4, floorAreaRatio: 5, volume: 2 }
    : { household: 6, parking: 5, age: 5, floorAreaRatio: 0, volume: 4 };
  const householdScore =
    scoreHouseholds(input.householdCount ?? null, warnings) * weights.household;
  const parkingScore =
    scoreParking(input.parkingPerHousehold ?? null, warnings) * weights.parking;
  const ageScore = scoreAge(input.buildingAgeYears ?? null, warnings) * weights.age;
  const floorAreaRatioScore = hasFloorAreaRatio
    ? scoreFloorAreaRatio(input.floorAreaRatio ?? null) * weights.floorAreaRatio
    : 0;
  const volumeScore =
    scoreTransactionVolume(input.transactionCount ?? null, warnings) *
    weights.volume;

  if (!hasFloorAreaRatio) {
    warnings.push("용적률 수기 확인 필요");
  } else {
    evidence.push("용적률 반영");
  }

  if ((input.householdCount ?? 0) >= 500) {
    evidence.push("500세대 이상");
  }

  return category(
    "단지",
    householdScore + parkingScore + ageScore + floorAreaRatioScore + volumeScore,
    20,
  );
}

function scoreMarket(
  input: ApartmentScoreInput,
  evidence: string[],
  warnings: string[],
): ApartmentScoreCategory {
  const hasPrice = input.latestPriceKrw !== null && input.latestPriceKrw !== undefined;
  const volumeRatio = scoreTransactionVolume(input.transactionCount ?? null, warnings);
  const score = (hasPrice ? 4 : 0) + volumeRatio * 6;

  if (hasPrice) {
    evidence.push("최근 거래 있음");
  }

  return category("거래", score, 10);
}

function scoreField(
  fieldNote: ApartmentScoreFieldNote | null,
  evidence: string[],
  warnings: string[],
): ApartmentScoreCategory {
  if (!fieldNote) {
    warnings.push("임장 후기 없음");
    return category("임장", 0, 25);
  }

  const rawScore =
    scoreRating(fieldNote.overallRating ?? null) * 8 +
    scoreRating(fieldNote.stationWalkRating ?? null) * 4 +
    scoreRating(fieldNote.slopeRating ?? null) * 3 +
    scoreRating(fieldNote.noiseRating ?? null) * 3 +
    scoreRating(fieldNote.parkingRating ?? null) * 3 +
    scoreRating(fieldNote.nightMoodRating ?? null) * 2 +
    scoreRating(fieldNote.commercialAreaRating ?? null) * 2 +
    scoreRevisitIntention(fieldNote.revisitIntention ?? null);
  const score = clamp(rawScore, 0, 25);

  if (score >= 18) {
    evidence.push("임장 긍정");
  } else if (score <= 10) {
    warnings.push("임장 재검토 필요");
  }

  return category("임장", score, 25);
}

function scoreHouseholds(value: number | null, warnings: string[]) {
  if (value === null) {
    warnings.push("세대수 미확인");
    return 0.25;
  }

  if (value >= 2_000) {
    return 1;
  }

  if (value >= 1_000) {
    return 0.85;
  }

  if (value >= 500) {
    return 0.6;
  }

  warnings.push("500세대 미만");
  return 0.25;
}

function scoreParking(value: number | null, warnings: string[]) {
  if (value === null) {
    warnings.push("주차/세대 미확인");
    return 0.25;
  }

  if (value >= 1.3) {
    return 1;
  }

  if (value >= 1) {
    return 0.75;
  }

  if (value >= 0.8) {
    return 0.45;
  }

  return 0.2;
}

function scoreAge(value: number | null, warnings: string[]) {
  if (value === null) {
    warnings.push("연식 미확인");
    return 0.25;
  }

  if (value <= 15) {
    return 1;
  }

  if (value <= 30) {
    return 0.75;
  }

  if (value <= 40) {
    return 0.5;
  }

  return 0.25;
}

function scoreFloorAreaRatio(value: number | null) {
  if (value === null || value <= 0) {
    return 0;
  }

  if (value <= 200) {
    return 1;
  }

  if (value <= 250) {
    return 0.8;
  }

  if (value <= 300) {
    return 0.55;
  }

  if (value <= 350) {
    return 0.3;
  }

  return 0.1;
}

function scoreTransactionVolume(value: number | null, warnings: string[]) {
  if (value === null || value <= 0) {
    warnings.push("거래량 미확인");
    return 0;
  }

  if (value >= 10) {
    return 1;
  }

  if (value >= 5) {
    return 0.7;
  }

  return 0.4;
}

function scoreDuration(value: number | null, ideal: number, poor: number) {
  if (value === null || value <= 0) {
    return 0;
  }

  return clamp((poor - value) / (poor - ideal), 0, 1);
}

function scoreRating(value: number | null) {
  if (value === null) {
    return 0;
  }

  return clamp(value / 5, 0, 1);
}

function scoreRevisitIntention(value: string | null) {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return 0;
  }

  if (/제외|싫|아님|불가|안\s*감/.test(normalized)) {
    return -5;
  }

  if (/관심|좋|재방문|다시|유지/.test(normalized)) {
    return 3;
  }

  return 0;
}

function interpolate(start: number, end: number, ratio: number) {
  return start + (end - start) * clamp(ratio, 0, 1);
}

function category(
  label: string,
  score: number,
  maxScore: number,
): ApartmentScoreCategory {
  return {
    label,
    score: roundScore(clamp(score, 0, maxScore)),
    maxScore,
  };
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
