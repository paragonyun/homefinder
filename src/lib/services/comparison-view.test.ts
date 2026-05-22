import { describe, expect, it } from "vitest";
import type { ApartmentComparisonRow } from "./apartment-comparison";
import { filterComparisonRows, getComparisonMetrics } from "./comparison-view";

const rows: ApartmentComparisonRow[] = [
  {
    id: "a",
    name: "염창 동아 3차",
    address: "서울 강서구",
    lawdCd: "1150013200",
    status: "interested",
    memo: "주차 확인",
    latestDealDate: "2026-05-01",
    latestPriceKrw: 1_370_000_000,
    latestAreaBucket: "84",
    transactionCount: 1,
    householdCount: 570,
    parkingCount: 620,
    approvalDate: "1999-01-01",
    basicInfoFetchedAt: "2026-05-21T00:00:00Z",
    areaSummaries: [],
  },
  {
    id: "b",
    name: "보라매경남아너스빌",
    address: "서울 영등포구",
    lawdCd: "1156013200",
    status: "candidate",
    memo: null,
    latestDealDate: null,
    latestPriceKrw: null,
    latestAreaBucket: null,
    transactionCount: 0,
    householdCount: null,
    parkingCount: null,
    approvalDate: null,
    basicInfoFetchedAt: null,
    areaSummaries: [],
  },
];

describe("comparison view helpers", () => {
  it("filters by search, status, and data availability", () => {
    expect(
      filterComparisonRows(rows, {
        query: "염창",
        status: "interested",
        data: "has-kapt",
      }).map((row) => row.id),
    ).toEqual(["a"]);

    expect(
      filterComparisonRows(rows, {
        query: "",
        status: "all",
        data: "missing-price",
      }).map((row) => row.id),
    ).toEqual(["b"]);
  });

  it("counts data completeness metrics", () => {
    expect(getComparisonMetrics(rows)).toEqual({
      total: 2,
      withPrice: 1,
      withKapt: 1,
      needsSync: 1,
    });
  });
});
