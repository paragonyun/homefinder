import { describe, expect, it, vi } from "vitest";
import type {
  MolitApartmentTrade,
  MolitApartmentTradePage,
} from "../data-providers/molit-transactions";
import {
  buildMolitTransactionSourceNames,
  collapseMolitTransactions,
  collectMolitTransactionSyncResult,
  getMolitAddressHints,
  getMatchedDealYmds,
  resolveMolitTransactionSyncWindow,
  toMolitTransactionPayload,
} from "./apartment-transaction-sync";

const baseTrade: MolitApartmentTrade = {
  dealYear: 2026,
  dealMonth: 5,
  dealDay: 1,
  dealDate: "2026-05-01",
  exclusiveAreaM2: 84.9,
  floor: 10,
  dealAmountManwon: 120_000,
  dealAmountKrw: 1_200_000_000,
  apartmentNameFromSource: "Alpha Heights",
  addressFromSource: "Sangdo-dong 414",
  lotNumberFromSource: "414",
  roadAddressFromSource: null,
  cancelYn: null,
  cancelDate: null,
  aptSeq: "apt-1",
  aptDong: "101",
  umdCd: "10200",
};

const sangdoAddressHints = {
  lotNumbers: ["414"],
  roadBuildingNumbers: [] as string[],
  legalDongNames: ["상도동"],
};

function makePage(
  dealYmd: string,
  transactions: MolitApartmentTrade[],
): MolitApartmentTradePage {
  return {
    pageNo: 1,
    rawXml: `<response dealYmd="${dealYmd}" />`,
    totalCount: transactions.length,
    transactions,
  };
}

function makeRecentDealYmds(months: number) {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(2026, 4 - index, 1));

    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

describe("buildMolitTransactionSourceNames", () => {
  it("normalizes and dedupes apartment names, aliases, and selected candidates", () => {
    expect(
      buildMolitTransactionSourceNames({
        apartmentName: "Alpha Heights",
        displayName: "Alpha Heights ",
        aliases: ["Alpha Heights", "AlphaHeights"],
        selectedCandidateName: "Alpha Heights Tower",
      }),
    ).toEqual(["alphaheights", "alphaheightstower"]);
  });
});

describe("getMolitAddressHints", () => {
  it("separates legal lots, road building numbers, and legal dong names", () => {
    expect(
      getMolitAddressHints({
        legalAddresses: ["서울특별시 성북구 돈암동 15-1 돈암삼성"],
        roadAddresses: ["서울특별시 성북구 동소문로34길 24"],
        fallbackAddresses: [],
      }),
    ).toEqual({
      lotNumbers: ["15-1"],
      roadBuildingNumbers: ["24"],
      legalDongNames: ["돈암동"],
    });
  });

  it("classifies fallback addresses and normalizes leading zeroes per number segment", () => {
    expect(
      getMolitAddressHints({
        legalAddresses: [],
        roadAddresses: [],
        fallbackAddresses: [
          "서울특별시 성북구 돈암동 0015-01 돈암삼성",
          "서울특별시 성북구 동소문로34길 0024",
        ],
      }),
    ).toEqual({
      lotNumbers: ["15-1"],
      roadBuildingNumbers: ["24"],
      legalDongNames: ["돈암동"],
    });
  });

  it("uses the final rural locality immediately before the legal lot number", () => {
    expect(
      getMolitAddressHints({
        legalAddresses: ["경기도 가평군 조종면 현리 산 0015-01"],
        roadAddresses: [],
        fallbackAddresses: [],
      }),
    ).toEqual({
      lotNumbers: ["15-1"],
      roadBuildingNumbers: [],
      legalDongNames: ["현리"],
    });
  });
});

describe("resolveMolitTransactionSyncWindow", () => {
  it("uses a 36-month fallback window only for the default request", () => {
    const defaultWindow = resolveMolitTransactionSyncWindow({
      now: new Date("2026-05-19T00:00:00Z"),
    });
    const explicitWindow = resolveMolitTransactionSyncWindow({
      months: 2,
      now: new Date("2026-05-19T00:00:00Z"),
    });

    expect(defaultWindow.dealYmds.ok).toBe(true);

    if (!defaultWindow.dealYmds.ok) {
      return;
    }

    expect(defaultWindow.dealYmds.dealYmds).toHaveLength(36);
    expect(defaultWindow.primaryMonthCount).toBe(12);
    expect(explicitWindow).toMatchObject({
      dealYmds: {
        ok: true,
        mode: "recent",
        dealYmds: ["202605", "202604"],
      },
      primaryMonthCount: undefined,
    });
  });
});

describe("collectMolitTransactionSyncResult", () => {
  it("keeps manual month raw pages and candidate names when no transaction matches", async () => {
    const fetchPages = vi.fn(async ({ dealYmd }: { dealYmd: string }) => [
      makePage(dealYmd, [
        {
          ...baseTrade,
          apartmentNameFromSource: "Candidate Tower",
          addressFromSource: "Sangdo-dong 414",
        },
      ]),
    ]);

    const result = await collectMolitTransactionSyncResult({
      serviceKey: "service-key",
      molitLawdCd: "11590",
      legalDongCd: "10200",
      sourceNames: ["savedname"],
      addressHints: sangdoAddressHints,
      dealYmds: {
        ok: true,
        mode: "manual",
        dealYmds: ["202605", "202604"],
      },
      fetchPages,
    });

    expect(fetchPages).toHaveBeenCalledTimes(1);
    expect(result.selectedDealYmd).toBe("202605");
    expect(result.transactions).toEqual([]);
    expect(result.matchedPageRecords).toHaveLength(1);
    expect(result.candidateNames).toEqual([
      {
        name: "Candidate Tower",
        aptSeq: "apt-1",
        count: 1,
        latestDealDate: "2026-05-01",
        addresses: [{ address: "Sangdo-dong 414", count: 1 }],
        score: 100,
        nameSimilarity: 0,
        matchReasons: ["lot_exact"],
      },
    ]);
  });

  it("collects matched transactions across recent months and summarizes deal months", async () => {
    const fetchPages = vi.fn(async ({ dealYmd }: { dealYmd: string }) => [
      makePage(dealYmd, [
        {
          ...baseTrade,
          dealMonth: Number(dealYmd.slice(4, 6)),
          dealDate: `${dealYmd.slice(0, 4)}-${dealYmd.slice(4, 6)}-01`,
        },
      ]),
    ]);

    const result = await collectMolitTransactionSyncResult({
      serviceKey: "service-key",
      molitLawdCd: "11590",
      legalDongCd: "10200",
      sourceNames: ["alphaheights"],
      addressHints: sangdoAddressHints,
      dealYmds: {
        ok: true,
        mode: "recent",
        dealYmds: ["202605", "202604"],
      },
      fetchPages,
    });

    expect(fetchPages).toHaveBeenCalledTimes(2);
    expect(result.transactions).toHaveLength(2);
    expect(result.selectedDealYmd).toBe("202605");
    expect(result.matchedDealYmds).toEqual(["202605", "202604"]);
  });

  it("evaluates the full primary window before stopping the fallback search", async () => {
    const dealYmds = makeRecentDealYmds(36);
    const fetchPages = vi.fn(async ({ dealYmd }: { dealYmd: string }) => [
      makePage(dealYmd, [
        {
          ...baseTrade,
          dealMonth: Number(dealYmd.slice(4, 6)),
          dealDate: `${dealYmd.slice(0, 4)}-${dealYmd.slice(4, 6)}-01`,
        },
      ]),
    ]);

    const result = await collectMolitTransactionSyncResult({
      serviceKey: "service-key",
      molitLawdCd: "11590",
      legalDongCd: "10200",
      sourceNames: ["alphaheights"],
      addressHints: sangdoAddressHints,
      primaryMonthCount: 12,
      dealYmds: {
        ok: true,
        mode: "recent",
        dealYmds,
      },
      fetchPages,
    });

    expect(fetchPages).toHaveBeenCalledTimes(12);
    expect(
      fetchPages.mock.calls.map(([input]) => input.dealYmd),
    ).toEqual(dealYmds.slice(0, 12));
    expect(result.transactions).toHaveLength(12);
    expect(result.matchedSourceNames).toEqual(["Alpha Heights"]);
  });

  it("evaluates fallback months together with the primary window when primary has no match", async () => {
    const dealYmds = makeRecentDealYmds(36);
    const fetchPages = vi.fn(async ({ dealYmd }: { dealYmd: string }) => {
      const index = dealYmds.indexOf(dealYmd);
      const transaction =
        index === 12
          ? {
              ...baseTrade,
              apartmentNameFromSource: "돈암동삼성",
              addressFromSource: "돈암동 15-1",
              lotNumberFromSource: "15-1",
              umdCd: "10700",
            }
          : {
              ...baseTrade,
              apartmentNameFromSource: "무관단지",
              addressFromSource: "돈암동 524",
              lotNumberFromSource: "524",
              umdCd: "10700",
            };

      return [makePage(dealYmd, [transaction])];
    });

    const result = await collectMolitTransactionSyncResult({
      serviceKey: "service-key",
      molitLawdCd: "11290",
      legalDongCd: "10700",
      sourceNames: ["돈암삼성"],
      addressHints: {
        lotNumbers: ["15-1"],
        roadBuildingNumbers: ["24"],
        legalDongNames: ["돈암동"],
      },
      primaryMonthCount: 12,
      dealYmds: {
        ok: true,
        mode: "recent",
        dealYmds,
      },
      fetchPages,
    });

    expect(fetchPages).toHaveBeenCalledTimes(36);
    expect(result.transactions).toHaveLength(1);
    expect(result.matchedSourceNames).toEqual(["돈암동삼성"]);
  });

  it("keeps exact-address fuzzy names from different months as ambiguous candidates", async () => {
    const fetchPages = vi.fn(async ({ dealYmd }: { dealYmd: string }) => [
      makePage(dealYmd, [
        {
          ...baseTrade,
          dealMonth: Number(dealYmd.slice(4, 6)),
          dealDate: `${dealYmd.slice(0, 4)}-${dealYmd.slice(4, 6)}-01`,
          apartmentNameFromSource:
            dealYmd === "202605" ? "돈암동삼성" : "돈암삼성빌라",
          addressFromSource: "돈암동 15-1",
          lotNumberFromSource: "15-1",
          umdCd: "10700",
        },
      ]),
    ]);

    const result = await collectMolitTransactionSyncResult({
      serviceKey: "service-key",
      molitLawdCd: "11290",
      legalDongCd: "10700",
      sourceNames: ["돈암삼성"],
      addressHints: {
        lotNumbers: ["15-1"],
        roadBuildingNumbers: ["24"],
        legalDongNames: ["돈암동"],
      },
      dealYmds: {
        ok: true,
        mode: "recent",
        dealYmds: ["202605", "202604"],
      },
      fetchPages,
    });

    expect(result.transactions).toEqual([]);
    expect(result.candidateNames.map((candidate) => candidate.name)).toEqual([
      "돈암삼성빌라",
      "돈암동삼성",
    ]);
  });

});

describe("toMolitTransactionPayload", () => {
  it("builds a stable DB payload with the existing conflict hash inputs", () => {
    const payload = toMolitTransactionPayload(baseTrade, {
      apartmentId: "apt-id",
      rawApiResponseId: "raw-id",
      userId: "user-id",
      fetchedAt: "2026-06-22T00:00:00.000Z",
    });

    expect(payload).toMatchObject({
      user_id: "user-id",
      apartment_id: "apt-id",
      raw_api_response_id: "raw-id",
      source_name: "molit-apt-trade-detail",
      deal_date: "2026-05-01",
      exclusive_area_m2: 84.9,
      deal_amount_manwon: 120_000,
      apartment_name_from_source: "Alpha Heights",
      address_from_source: "Sangdo-dong 414",
      confidence_level: "high",
      fetched_at: "2026-06-22T00:00:00.000Z",
    });
    expect(payload.source_hash).toHaveLength(64);
  });
});

describe("collapseMolitTransactions", () => {
  it("collapses an active and cancelled version of the same trade into the cancelled row", () => {
    const cancelledTrade: MolitApartmentTrade = {
      ...baseTrade,
      cancelYn: "O",
      cancelDate: "2026-06-01",
    };

    expect(
      collapseMolitTransactions([baseTrade, cancelledTrade], "apt-id"),
    ).toEqual([cancelledTrade]);
  });
});

describe("getMatchedDealYmds", () => {
  it("returns unique matched months in descending order", () => {
    expect(
      getMatchedDealYmds([
        baseTrade,
        { ...baseTrade, dealMonth: 4, dealDate: "2026-04-30" },
        { ...baseTrade, dealDay: 2, dealDate: "2026-05-02" },
      ]),
    ).toEqual(["202605", "202604"]);
  });
});
