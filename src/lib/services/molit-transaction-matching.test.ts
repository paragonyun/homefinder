import { describe, expect, it } from "vitest";
import type { MolitApartmentTrade } from "../data-providers/molit-transactions";
import {
  buildMolitTransactionCandidates,
  filterMatchingMolitTransactions,
} from "./molit-transaction-matching";

const baseTrade: MolitApartmentTrade = {
  dealYear: 2026,
  dealMonth: 5,
  dealDay: 1,
  dealDate: "2026-05-01",
  exclusiveAreaM2: 84.9,
  floor: 10,
  dealAmountManwon: 100_000,
  dealAmountKrw: 1_000_000_000,
  apartmentNameFromSource: "건영",
  addressFromSource: "상도동 414",
  lotNumberFromSource: "414",
  roadAddressFromSource: null,
  cancelYn: null,
  cancelDate: null,
  aptSeq: "apt-1",
  umdCd: "10200",
};

const sangdoAddressHints = {
  lotNumbers: ["414"],
  roadBuildingNumbers: [] as string[],
  legalDongNames: ["상도동"],
};

const donamAddressHints = {
  lotNumbers: ["15-1"],
  roadBuildingNumbers: ["24"],
  legalDongNames: ["돈암동"],
};

describe("filterMatchingMolitTransactions", () => {
  it("matches a short operator-selected source name only at the saved address", () => {
    const matching = filterMatchingMolitTransactions({
      transactions: [
        baseTrade,
        {
          ...baseTrade,
          dealDay: 2,
          dealDate: "2026-05-02",
          addressFromSource: "상도동 111",
          lotNumberFromSource: "111",
        },
      ],
      sourceNames: ["상도건영", "건영"],
      legalDongCd: "10200",
      addressHints: sangdoAddressHints,
    });

    expect(matching).toHaveLength(1);
    expect(matching[0].addressFromSource).toBe("상도동 414");
  });

  it("does not treat a road building number as a substring of a legal lot number", () => {
    const matching = filterMatchingMolitTransactions({
      transactions: [
        {
          ...baseTrade,
          apartmentNameFromSource: "일신건영휴먼빌아파트",
          addressFromSource: "돈암동 524",
          lotNumberFromSource: "524",
          umdCd: "10700",
        },
        {
          ...baseTrade,
          apartmentNameFromSource: "구현대",
          addressFromSource: "돈암동 624",
          lotNumberFromSource: "624",
          umdCd: "10700",
        },
      ],
      sourceNames: ["돈암삼성아파트", "돈암삼성"],
      legalDongCd: "10700",
      addressHints: {
        lotNumbers: [],
        roadBuildingNumbers: ["24"],
        legalDongNames: ["돈암동"],
      },
    });

    expect(matching).toEqual([]);
  });

  it("matches a fuzzy source name only with unique exact-address evidence", () => {
    const matching = filterMatchingMolitTransactions({
      transactions: [
        {
          ...baseTrade,
          apartmentNameFromSource: "돈암동삼성",
          addressFromSource: "돈암동 15-1",
          lotNumberFromSource: "15-1",
          aptSeq: "donam-samsung",
          umdCd: "10700",
        },
        {
          ...baseTrade,
          apartmentNameFromSource: "일신건영휴먼빌아파트",
          addressFromSource: "돈암동 524",
          lotNumberFromSource: "524",
          umdCd: "10700",
        },
        {
          ...baseTrade,
          apartmentNameFromSource: "구현대",
          addressFromSource: "돈암동 624",
          lotNumberFromSource: "624",
          umdCd: "10700",
        },
      ],
      sourceNames: ["돈암삼성아파트", "돈암삼성"],
      legalDongCd: "10700",
      addressHints: donamAddressHints,
    });

    expect(matching.map((transaction) => transaction.apartmentNameFromSource)).toEqual([
      "돈암동삼성",
    ]);
  });

  it("does not auto-match fuzzy names when an exact address has multiple source names", () => {
    const matching = filterMatchingMolitTransactions({
      transactions: [
        {
          ...baseTrade,
          apartmentNameFromSource: "돈암동삼성",
          addressFromSource: "돈암동 15-1",
          lotNumberFromSource: "15-1",
          umdCd: "10700",
        },
        {
          ...baseTrade,
          apartmentNameFromSource: "돈암삼성빌라",
          addressFromSource: "돈암동 15-1",
          lotNumberFromSource: "15-1",
          umdCd: "10700",
        },
      ],
      sourceNames: ["돈암삼성"],
      legalDongCd: "10700",
      addressHints: donamAddressHints,
    });

    expect(matching).toEqual([]);
  });

  it("rejects otherwise matching transactions from a different supplied legal dong", () => {
    const matching = filterMatchingMolitTransactions({
      transactions: [
        {
          ...baseTrade,
          apartmentNameFromSource: "돈암삼성",
          addressFromSource: "돈암동 15-1",
          lotNumberFromSource: "15-1",
          umdCd: "99999",
        },
      ],
      sourceNames: ["돈암삼성"],
      legalDongCd: "10700",
      addressHints: donamAddressHints,
    });

    expect(matching).toEqual([]);
  });

  it("keeps a supplied transaction legal dong eligible when the target code is unavailable", () => {
    const transaction: MolitApartmentTrade = {
      ...baseTrade,
      apartmentNameFromSource: "돈암삼성",
      addressFromSource: "돈암동 15-1",
      lotNumberFromSource: "15-1",
      umdCd: "10700",
    };
    const matching = filterMatchingMolitTransactions({
      transactions: [transaction],
      sourceNames: ["돈암삼성"],
      legalDongCd: null,
      addressHints: donamAddressHints,
    });

    expect(matching).toEqual([transaction]);
  });

  it("keeps a transaction without a supplied legal dong eligible for a coded target", () => {
    const transaction: MolitApartmentTrade = {
      ...baseTrade,
      apartmentNameFromSource: "돈암삼성",
      addressFromSource: "돈암동 15-1",
      lotNumberFromSource: "15-1",
      umdCd: undefined,
    };
    const matching = filterMatchingMolitTransactions({
      transactions: [transaction],
      sourceNames: ["돈암삼성"],
      legalDongCd: "10700",
      addressHints: donamAddressHints,
    });

    expect(matching).toEqual([transaction]);
  });

  it("uses an exact road address to support a unique fuzzy-name match", () => {
    const transaction: MolitApartmentTrade = {
      ...baseTrade,
      apartmentNameFromSource: "돈암동삼성",
      addressFromSource: "돈암동 999",
      lotNumberFromSource: "999",
      roadAddressFromSource: "동소문로34길 24",
      umdCd: "10700",
    };
    const matching = filterMatchingMolitTransactions({
      transactions: [transaction],
      sourceNames: ["돈암삼성"],
      legalDongCd: "10700",
      addressHints: {
        lotNumbers: [],
        roadBuildingNumbers: ["24"],
        legalDongNames: ["돈암동"],
      },
    });

    expect(matching).toEqual([transaction]);
  });
});

describe("buildMolitTransactionCandidates", () => {
  it("returns address evidence for same-address source-name candidates", () => {
    const candidates = buildMolitTransactionCandidates({
      transactions: [
        baseTrade,
        {
          ...baseTrade,
          dealDay: 3,
          dealDate: "2026-05-03",
          addressFromSource: "상도동 414",
        },
        {
          ...baseTrade,
          dealDay: 4,
          dealDate: "2026-05-04",
          addressFromSource: "상도동 111",
          lotNumberFromSource: "111",
        },
      ],
      sourceNames: ["상도건영", "건영아파트"],
      legalDongCd: "10200",
      addressHints: sangdoAddressHints,
    });

    expect(candidates).toEqual([
      {
        name: "건영",
        aptSeq: "apt-1",
        count: 3,
        latestDealDate: "2026-05-04",
        addresses: [
          { address: "상도동 414", count: 2 },
          { address: "상도동 111", count: 1 },
        ],
        score: 180,
        nameSimilarity: 1,
        matchReasons: ["lot_exact", "name_exact"],
      },
    ]);
  });

  it("retains representative source addresses without exact address evidence", () => {
    const candidates = buildMolitTransactionCandidates({
      transactions: [
        {
          ...baseTrade,
          apartmentNameFromSource: "한신",
          addressFromSource: "돈암동 777",
          lotNumberFromSource: "777",
          roadAddressFromSource: "아리랑로5길 10",
          aptSeq: "same-dong-candidate",
          umdCd: "10700",
        },
      ],
      sourceNames: ["돈암삼성"],
      legalDongCd: "10700",
      addressHints: donamAddressHints,
    });

    expect(candidates[0].addresses).toEqual(
      expect.arrayContaining([
        { address: "돈암동 777", count: 1 },
        { address: "아리랑로5길 10", count: 1 },
      ]),
    );
  });

  it("ranks exact-address fuzzy matches above higher-volume name-only candidates", () => {
    const highVolumeNameOnly = Array.from({ length: 30 }, (_, index) => ({
      ...baseTrade,
      dealDay: (index % 28) + 1,
      dealDate: `2026-05-${String((index % 28) + 1).padStart(2, "0")}`,
      apartmentNameFromSource: "돈암삼성빌라",
      addressFromSource: "돈암동 524",
      lotNumberFromSource: "524",
      aptSeq: "high-volume",
      umdCd: "10700",
    }));
    const candidates = buildMolitTransactionCandidates({
      transactions: [
        ...highVolumeNameOnly,
        {
          ...baseTrade,
          apartmentNameFromSource: "돈암동삼성",
          addressFromSource: "돈암동 15-1",
          lotNumberFromSource: "15-1",
          aptSeq: "donam-samsung",
          umdCd: "10700",
        },
        {
          ...baseTrade,
          apartmentNameFromSource: "구현대",
          addressFromSource: "돈암동 624",
          lotNumberFromSource: "624",
          aptSeq: "old-hyundai",
          umdCd: "10700",
        },
      ],
      sourceNames: ["돈암삼성아파트", "돈암삼성"],
      legalDongCd: "10700",
      addressHints: donamAddressHints,
    });

    expect(candidates[0]).toMatchObject({
      name: "돈암동삼성",
      aptSeq: "donam-samsung",
      count: 1,
      addresses: [{ address: "돈암동 15-1", count: 1 }],
      matchReasons: ["lot_exact", "name_similar"],
    });
    expect(candidates[0].nameSimilarity).toBeGreaterThanOrEqual(0.45);
    expect(candidates[0].score).toBeGreaterThan(candidates[1].score);
    expect(candidates[1]).toMatchObject({
      name: "돈암삼성빌라",
      count: 30,
    });
  });

  it("keeps ambiguous exact-address source names as manual candidates", () => {
    const candidates = buildMolitTransactionCandidates({
      transactions: [
        {
          ...baseTrade,
          apartmentNameFromSource: "돈암동삼성",
          addressFromSource: "돈암동 15-1",
          lotNumberFromSource: "15-1",
          umdCd: "10700",
        },
        {
          ...baseTrade,
          apartmentNameFromSource: "돈암삼성빌라",
          addressFromSource: "돈암동 15-1",
          lotNumberFromSource: "15-1",
          umdCd: "10700",
        },
      ],
      sourceNames: ["돈암삼성"],
      legalDongCd: "10700",
      addressHints: donamAddressHints,
    });

    expect(candidates.map((candidate) => candidate.name)).toEqual([
      "돈암삼성빌라",
      "돈암동삼성",
    ]);
    expect(candidates.every((candidate) => candidate.matchReasons.includes("lot_exact"))).toBe(
      true,
    );
  });

  it("caps scored candidates at 20", () => {
    const candidates = buildMolitTransactionCandidates({
      transactions: Array.from({ length: 25 }, (_, index) => ({
        ...baseTrade,
        apartmentNameFromSource: `돈암삼성${index + 1}차`,
        addressFromSource: "돈암동 15-1",
        lotNumberFromSource: "15-1",
        aptSeq: `candidate-${index + 1}`,
        umdCd: "10700",
      })),
      sourceNames: ["돈암삼성"],
      legalDongCd: "10700",
      addressHints: donamAddressHints,
    });

    expect(candidates).toHaveLength(20);
  });

  it("reports exact road evidence for a fuzzy-name candidate", () => {
    const candidates = buildMolitTransactionCandidates({
      transactions: [
        {
          ...baseTrade,
          apartmentNameFromSource: "돈암동삼성",
          addressFromSource: "돈암동 999",
          lotNumberFromSource: "999",
          roadAddressFromSource: "동소문로34길 24",
          aptSeq: "donam-road",
          umdCd: "10700",
        },
      ],
      sourceNames: ["돈암삼성"],
      legalDongCd: "10700",
      addressHints: {
        lotNumbers: [],
        roadBuildingNumbers: ["24"],
        legalDongNames: ["돈암동"],
      },
    });

    expect(candidates[0]).toMatchObject({
      name: "돈암동삼성",
      aptSeq: "donam-road",
      matchReasons: ["road_exact", "name_similar"],
    });
    expect(candidates[0].addresses).toEqual(
      expect.arrayContaining([
        { address: "돈암동 999", count: 1 },
        { address: "동소문로34길 24", count: 1 },
      ]),
    );
  });

  it("keeps the highest-scored candidate when applying the 20-candidate cap", () => {
    const lowScoreTransactions = Array.from({ length: 20 }, (_, index) => ({
      ...baseTrade,
      apartmentNameFromSource: `무관단지${index + 1}`,
      addressFromSource: `돈암동 ${500 + index}`,
      lotNumberFromSource: String(500 + index),
      aptSeq: `unrelated-${index + 1}`,
      umdCd: "10700",
    }));
    const candidates = buildMolitTransactionCandidates({
      transactions: [
        ...lowScoreTransactions,
        {
          ...baseTrade,
          apartmentNameFromSource: "돈암동삼성",
          addressFromSource: "돈암동 15-1",
          lotNumberFromSource: "15-1",
          aptSeq: "highest-score",
          umdCd: "10700",
        },
      ],
      sourceNames: ["돈암삼성"],
      legalDongCd: "10700",
      addressHints: donamAddressHints,
    });

    expect(candidates).toHaveLength(20);
    expect(candidates[0]).toMatchObject({
      name: "돈암동삼성",
      aptSeq: "highest-score",
      matchReasons: ["lot_exact", "name_similar"],
    });
  });
});
