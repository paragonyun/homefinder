import { describe, expect, it, vi } from "vitest";
import type {
  MolitApartmentTrade,
  MolitApartmentTradePage,
} from "../data-providers/molit-transactions";
import {
  buildMolitTransactionSourceNames,
  collapseMolitTransactions,
  collectMolitTransactionSyncResult,
  getAddressNumberTokens,
  getMatchedDealYmds,
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
  cancelYn: null,
  cancelDate: null,
  aptSeq: "apt-1",
  aptDong: "101",
  umdCd: "10200",
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

describe("getAddressNumberTokens", () => {
  it("extracts unique lot number tokens from address hints", () => {
    expect(
      getAddressNumberTokens(["Seoul Sangdo-dong 414", "Sangdo-ro 1-20", null]),
    ).toEqual(["414", "1-20"]);
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
      addressTokens: ["414"],
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
        count: 1,
        latestDealDate: "2026-05-01",
        addresses: [{ address: "Sangdo-dong 414", count: 1 }],
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
      addressTokens: ["414"],
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
