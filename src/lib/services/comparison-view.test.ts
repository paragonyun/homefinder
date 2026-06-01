import { describe, expect, it } from "vitest";
import type { ApartmentComparisonRow } from "./apartment-comparison";
import {
  filterComparisonRows,
  getComparisonMetrics,
  hasCommuteInfo,
} from "./comparison-view";

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
    buildingCount: 8,
    parkingCount: 620,
    parkingPerHousehold: 620 / 570,
    floorAreaRatio: 248.5,
    buildingCoverageRatio: 21.4,
    approvalDate: "1999-01-01",
    buildingAgeYears: 27,
    basicInfoFetchedAt: "2026-05-21T00:00:00Z",
    buildingInfoFetchedAt: "2026-06-01T00:00:00Z",
    commuteToYeouido: {
      destinationKey: "yeouido_station",
      destinationName: "여의도역",
      transportType: "transit",
      durationMinutes: 32,
      transferCount: 1,
      sourceName: "manual",
      sourceRef: null,
      queryDatetime: null,
      confidenceLevel: "manual",
      fetchedAt: "2026-05-29T00:00:00Z",
      distanceMeters: null,
      walkDistanceMeters: null,
      fareKrw: null,
      expiresAt: null,
      routeSteps: [],
      isExpired: false,
    },
    commuteToGangnam: null,
    driveToYeouido: null,
    driveToGangnam: null,
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
    buildingCount: null,
    parkingCount: null,
    parkingPerHousehold: null,
    floorAreaRatio: null,
    buildingCoverageRatio: null,
    approvalDate: null,
    buildingAgeYears: null,
    basicInfoFetchedAt: null,
    buildingInfoFetchedAt: null,
    commuteToYeouido: null,
    commuteToGangnam: null,
    driveToYeouido: null,
    driveToGangnam: {
      destinationKey: "gangnam_station",
      destinationName: "강남역",
      transportType: "driving",
      durationMinutes: 41,
      transferCount: null,
      sourceName: "tmap-driving",
      sourceRef: null,
      queryDatetime: null,
      confidenceLevel: "high",
      fetchedAt: "2026-05-29T00:00:00Z",
      distanceMeters: 15000,
      walkDistanceMeters: null,
      fareKrw: null,
      expiresAt: null,
      routeSteps: [],
      isExpired: false,
    },
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
        data: "missing-commute",
      }).map((row) => row.id),
    ).toEqual([]);
  });

  it("counts data completeness metrics", () => {
    expect(getComparisonMetrics(rows)).toEqual({
      total: 2,
      withPrice: 1,
      withKapt: 1,
      withCommute: 2,
      needsSync: 1,
    });
  });

  it("detects rows with either transit or driving commute data", () => {
    expect(hasCommuteInfo(rows[0])).toBe(true);
    expect(hasCommuteInfo(rows[1])).toBe(true);
  });
});
