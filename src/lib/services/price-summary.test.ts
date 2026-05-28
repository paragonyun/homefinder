import { describe, expect, it } from "vitest";
import {
  buildMonthlyPriceTrendLines,
  filterTransactionsByMonth,
  getLatestTransactionMonth,
  summarizeApartmentPrices,
  summarizeMonthlyTrendWindow,
} from "./price-summary";

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

  it("builds recent monthly trend lines without dropping area buckets", () => {
    const lines = buildMonthlyPriceTrendLines(
      [
        {
          month: "2025-01",
          areaBucket: "59",
          averagePriceKrw: 900_000_000,
          transactionCount: 1,
        },
        {
          month: "2025-01",
          areaBucket: "84",
          averagePriceKrw: 1_200_000_000,
          transactionCount: 2,
        },
        {
          month: "2025-02",
          areaBucket: "59",
          averagePriceKrw: 930_000_000,
          transactionCount: 1,
        },
        {
          month: "2025-02",
          areaBucket: "84",
          averagePriceKrw: 1_250_000_000,
          transactionCount: 1,
        },
        {
          month: "2025-03",
          areaBucket: "84",
          averagePriceKrw: 1_280_000_000,
          transactionCount: 1,
        },
      ],
      2,
    );

    expect(lines).toEqual([
      {
        areaBucket: "59",
        points: [
          {
            month: "2025-02",
            averagePriceKrw: 930_000_000,
            transactionCount: 1,
          },
        ],
        totalTransactionCount: 1,
        isSparse: true,
      },
      {
        areaBucket: "84",
        points: [
          {
            month: "2025-02",
            averagePriceKrw: 1_250_000_000,
            transactionCount: 1,
          },
          {
            month: "2025-03",
            averagePriceKrw: 1_280_000_000,
            transactionCount: 1,
          },
        ],
        totalTransactionCount: 2,
        isSparse: true,
      },
    ]);
  });

  it("keeps a single-month single-price trend line renderable", () => {
    expect(
      buildMonthlyPriceTrendLines([
        {
          month: "2025-03",
          areaBucket: "84",
          averagePriceKrw: 1_250_000_000,
          transactionCount: 1,
        },
      ]),
    ).toEqual([
      {
        areaBucket: "84",
        points: [
          {
            month: "2025-03",
            averagePriceKrw: 1_250_000_000,
            transactionCount: 1,
          },
        ],
        totalTransactionCount: 1,
        isSparse: true,
      },
    ]);
  });

  it("filters table transactions to the latest deal month while preserving chart history", () => {
    const transactions = [
      {
        deal_date: "2025-05-15",
        exclusive_area_m2: 84.96,
        deal_amount_krw: 1_200_000_000,
        cancel_yn: null,
      },
      {
        deal_date: "2025-05-01",
        exclusive_area_m2: 59.97,
        deal_amount_krw: 1_070_000_000,
        cancel_yn: null,
      },
      {
        deal_date: "2025-04-23",
        exclusive_area_m2: 84.96,
        deal_amount_krw: 1_180_000_000,
        cancel_yn: null,
      },
    ];

    const latestMonth = getLatestTransactionMonth(transactions);

    expect(latestMonth).toBe("2025-05");
    expect(filterTransactionsByMonth(transactions, latestMonth)).toHaveLength(2);
    expect(summarizeApartmentPrices(transactions).monthlyTrend).toEqual([
      {
        month: "2025-04",
        areaBucket: "84",
        averagePriceKrw: 1_180_000_000,
        transactionCount: 1,
      },
      {
        month: "2025-05",
        areaBucket: "59",
        averagePriceKrw: 1_070_000_000,
        transactionCount: 1,
      },
      {
        month: "2025-05",
        areaBucket: "84",
        averagePriceKrw: 1_200_000_000,
        transactionCount: 1,
      },
    ]);
  });

  it("summarizes the visible trend window with weighted monthly averages", () => {
    const lines = buildMonthlyPriceTrendLines([
      {
        month: "2025-04",
        areaBucket: "59",
        averagePriceKrw: 1_000_000_000,
        transactionCount: 1,
      },
      {
        month: "2025-04",
        areaBucket: "84",
        averagePriceKrw: 1_300_000_000,
        transactionCount: 2,
      },
      {
        month: "2025-05",
        areaBucket: "59",
        averagePriceKrw: 1_100_000_000,
        transactionCount: 1,
      },
    ]);

    expect(summarizeMonthlyTrendWindow(lines)).toMatchObject({
      firstMonth: "2025-04",
      latestMonth: "2025-05",
      monthCount: 2,
      pointCount: 3,
      firstAveragePriceKrw: 1_200_000_000,
      latestAveragePriceKrw: 1_100_000_000,
      changeKrw: -100_000_000,
    });
  });
});
