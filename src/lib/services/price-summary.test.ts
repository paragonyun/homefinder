import { describe, expect, it } from "vitest";
import { summarizeApartmentPrices } from "./price-summary";

describe("summarizeApartmentPrices", () => {
  it("groups active transactions by area bucket with latest and aggregate prices", () => {
    const summary = summarizeApartmentPrices([
      {
        deal_date: "2025-01-20",
        exclusive_area_m2: 84.98,
        deal_amount_krw: 1_280_000_000,
        cancel_yn: null,
      },
      {
        deal_date: "2025-03-15",
        exclusive_area_m2: 84.12,
        deal_amount_krw: 1_350_000_000,
        cancel_yn: null,
      },
      {
        deal_date: "2025-02-08",
        exclusive_area_m2: 59.92,
        deal_amount_krw: 920_000_000,
        cancel_yn: null,
      },
      {
        deal_date: "2025-04-01",
        exclusive_area_m2: 84.51,
        deal_amount_krw: 1_100_000_000,
        cancel_yn: "O",
      },
    ]);

    expect(summary.areaSummaries).toEqual([
      {
        areaBucket: "84",
        exclusiveAreaMinM2: 84.12,
        exclusiveAreaMaxM2: 84.98,
        latestDealDate: "2025-03-15",
        latestPriceKrw: 1_350_000_000,
        averagePriceKrw: 1_315_000_000,
        minPriceKrw: 1_280_000_000,
        maxPriceKrw: 1_350_000_000,
        transactionCount: 2,
      },
      {
        areaBucket: "59",
        exclusiveAreaMinM2: 59.92,
        exclusiveAreaMaxM2: 59.92,
        latestDealDate: "2025-02-08",
        latestPriceKrw: 920_000_000,
        averagePriceKrw: 920_000_000,
        minPriceKrw: 920_000_000,
        maxPriceKrw: 920_000_000,
        transactionCount: 1,
      },
    ]);
  });

  it("builds month-level trend points in chronological order", () => {
    const summary = summarizeApartmentPrices([
      {
        deal_date: "2025-03-15",
        exclusive_area_m2: 84.12,
        deal_amount_krw: 1_350_000_000,
        cancel_yn: null,
      },
      {
        deal_date: "2025-01-20",
        exclusive_area_m2: 84.98,
        deal_amount_krw: 1_280_000_000,
        cancel_yn: null,
      },
      {
        deal_date: "2025-01-22",
        exclusive_area_m2: 84.98,
        deal_amount_krw: 1_300_000_000,
        cancel_yn: null,
      },
    ]);

    expect(summary.monthlyTrend).toEqual([
      {
        month: "2025-01",
        areaBucket: "84",
        averagePriceKrw: 1_290_000_000,
        transactionCount: 2,
      },
      {
        month: "2025-03",
        areaBucket: "84",
        averagePriceKrw: 1_350_000_000,
        transactionCount: 1,
      },
    ]);
  });
});
