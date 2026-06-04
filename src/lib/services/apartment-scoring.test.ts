import { describe, expect, it } from "vitest";
import { scoreApartmentCandidate } from "./apartment-scoring";

describe("scoreApartmentCandidate", () => {
  it("keeps over-budget apartments but applies a strong affordability penalty", () => {
    const base = {
      commuteToGangnamTransitMinutes: 35,
      commuteToYeouidoTransitMinutes: 30,
      householdCount: 1_200,
      parkingPerHousehold: 1.1,
      buildingAgeYears: 20,
      floorAreaRatio: 240,
      transactionCount: 8,
      fieldNote: {
        overallRating: 4,
        stationWalkRating: 4,
        slopeRating: 4,
        parkingRating: 4,
        noiseRating: 4,
        nightMoodRating: 4,
        commercialAreaRating: 4,
        revisitIntention: "관심 유지",
      },
    };

    const inBudget = scoreApartmentCandidate({
      ...base,
      latestPriceKrw: 950_000_000,
    });
    const overBudget = scoreApartmentCandidate({
      ...base,
      latestPriceKrw: 1_080_000_000,
    });

    expect(overBudget.categories.budget.score).toBeLessThan(
      inBudget.categories.budget.score - 8,
    );
    expect(overBudget.warnings).not.toContain("예산 초과로 제외");
    expect(overBudget.evidence).toContain("예산 초과 감점");
  });

  it("weights Yeouido access 6 and Gangnam access 4 inside the access score", () => {
    const yeouidoFast = scoreApartmentCandidate({
      latestPriceKrw: 950_000_000,
      commuteToYeouidoTransitMinutes: 20,
      commuteToGangnamTransitMinutes: 60,
      householdCount: 700,
      transactionCount: 4,
    });
    const gangnamFast = scoreApartmentCandidate({
      latestPriceKrw: 950_000_000,
      commuteToYeouidoTransitMinutes: 60,
      commuteToGangnamTransitMinutes: 20,
      householdCount: 700,
      transactionCount: 4,
    });

    expect(yeouidoFast.categories.access.score).toBeGreaterThan(
      gangnamFast.categories.access.score,
    );
  });

  it("redistributes complex-quality weight when floor area ratio is missing", () => {
    const withFloorAreaRatio = scoreApartmentCandidate({
      latestPriceKrw: 950_000_000,
      householdCount: 1_100,
      parkingPerHousehold: 1.05,
      buildingAgeYears: 22,
      floorAreaRatio: 230,
      transactionCount: 6,
    });
    const withoutFloorAreaRatio = scoreApartmentCandidate({
      latestPriceKrw: 950_000_000,
      householdCount: 1_100,
      parkingPerHousehold: 1.05,
      buildingAgeYears: 22,
      floorAreaRatio: null,
      transactionCount: 6,
    });

    expect(withFloorAreaRatio.categories.complex.maxScore).toBe(20);
    expect(withoutFloorAreaRatio.categories.complex.maxScore).toBe(20);
    expect(withoutFloorAreaRatio.warnings).toContain("용적률 수기 확인 필요");
    expect(Math.abs(withFloorAreaRatio.categories.complex.score - withoutFloorAreaRatio.categories.complex.score)).toBeLessThan(3);
  });

  it("penalizes apartments below the 500-household preference", () => {
    const small = scoreApartmentCandidate({
      latestPriceKrw: 850_000_000,
      householdCount: 320,
      parkingPerHousehold: 1.2,
      buildingAgeYears: 15,
      floorAreaRatio: 220,
      transactionCount: 5,
    });
    const midSized = scoreApartmentCandidate({
      latestPriceKrw: 850_000_000,
      householdCount: 650,
      parkingPerHousehold: 1.2,
      buildingAgeYears: 15,
      floorAreaRatio: 220,
      transactionCount: 5,
    });

    expect(midSized.categories.complex.score).toBeGreaterThan(
      small.categories.complex.score,
    );
    expect(small.warnings).toContain("500세대 미만");
  });

  it("strongly reflects field notes and revisit intention", () => {
    const liked = scoreApartmentCandidate({
      latestPriceKrw: 900_000_000,
      householdCount: 900,
      transactionCount: 5,
      fieldNote: {
        overallRating: 5,
        stationWalkRating: 5,
        slopeRating: 4,
        parkingRating: 4,
        noiseRating: 5,
        nightMoodRating: 5,
        commercialAreaRating: 4,
        revisitIntention: "관심 유지",
      },
    });
    const disliked = scoreApartmentCandidate({
      latestPriceKrw: 900_000_000,
      householdCount: 900,
      transactionCount: 5,
      fieldNote: {
        overallRating: 2,
        stationWalkRating: 2,
        slopeRating: 2,
        parkingRating: 2,
        noiseRating: 2,
        nightMoodRating: 2,
        commercialAreaRating: 2,
        revisitIntention: "제외",
      },
    });

    expect(liked.categories.field.score).toBeGreaterThan(
      disliked.categories.field.score + 12,
    );
    expect(liked.evidence).toContain("임장 긍정");
    expect(disliked.warnings).toContain("임장 재검토 필요");
  });
});
