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
  cancelYn: null,
  cancelDate: null,
  umdCd: "10200",
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
        },
      ],
      sourceNames: ["상도건영", "건영"],
      legalDongCd: "10200",
      addressTokens: ["414"],
    });

    expect(matching).toHaveLength(1);
    expect(matching[0].addressFromSource).toBe("상도동 414");
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
        },
      ],
      sourceNames: ["상도건영", "건영아파트"],
      legalDongCd: "10200",
      addressTokens: ["414"],
    });

    expect(candidates).toEqual([
      {
        name: "건영",
        count: 2,
        latestDealDate: "2026-05-03",
        addresses: [{ address: "상도동 414", count: 2 }],
      },
    ]);
  });
});
