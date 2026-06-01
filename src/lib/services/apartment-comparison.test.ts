import { describe, expect, it } from "vitest";
import { buildApartmentComparisonRows } from "./apartment-comparison";

describe("buildApartmentComparisonRows", () => {
  it("summarizes latest active transactions for each apartment", () => {
    const rows = buildApartmentComparisonRows(
      [
        {
          id: "apt-1",
          name: "관악드림타운",
          display_name: null,
          address: "서울 관악구 봉천동",
          lawd_cd: "1162010100",
          status: "interested",
          memo: "출퇴근 확인",
        },
        {
          id: "apt-2",
          name: "마곡엠밸리3차",
          display_name: "마곡 엠밸리3차",
          address: null,
          lawd_cd: "1150010100",
          status: "candidate",
          memo: null,
        },
      ],
      [
        {
          apartment_id: "apt-1",
          deal_date: "2025-01-10",
          exclusive_area_m2: 84.9,
          deal_amount_krw: 1_200_000_000,
          cancel_yn: null,
        },
        {
          apartment_id: "apt-1",
          deal_date: "2025-03-20",
          exclusive_area_m2: 59.8,
          deal_amount_krw: 950_000_000,
          cancel_yn: "O",
        },
        {
          apartment_id: "apt-2",
          deal_date: "2025-02-05",
          exclusive_area_m2: 59.9,
          deal_amount_krw: 900_000_000,
          cancel_yn: null,
        },
      ],
    );

    expect(rows).toEqual([
      {
        id: "apt-1",
        name: "관악드림타운",
        address: "서울 관악구 봉천동",
        lawdCd: "1162010100",
        status: "interested",
        memo: "출퇴근 확인",
        latestDealDate: "2025-01-10",
        latestPriceKrw: 1_200_000_000,
        latestAreaBucket: "84",
        transactionCount: 1,
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
        driveToGangnam: null,
        areaSummaries: [
          {
            areaBucket: "84",
            latestDealDate: "2025-01-10",
            latestPriceKrw: 1_200_000_000,
            averagePriceKrw: 1_200_000_000,
            transactionCount: 1,
          },
        ],
      },
      {
        id: "apt-2",
        name: "마곡 엠밸리3차",
        address: null,
        lawdCd: "1150010100",
        status: "candidate",
        memo: null,
        latestDealDate: "2025-02-05",
        latestPriceKrw: 900_000_000,
        latestAreaBucket: "59",
        transactionCount: 1,
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
        driveToGangnam: null,
        areaSummaries: [
          {
            areaBucket: "59",
            latestDealDate: "2025-02-05",
            latestPriceKrw: 900_000_000,
            averagePriceKrw: 900_000_000,
            transactionCount: 1,
          },
        ],
      },
    ]);
  });

  it("merges the latest K-apt basic info into comparison rows", () => {
    const rows = buildApartmentComparisonRows(
      [
        {
          id: "apt-1",
          name: "관악드림타운",
          display_name: null,
          address: null,
          lawd_cd: null,
          status: "candidate",
          memo: null,
        },
      ],
      [],
      [
        {
          apartment_id: "apt-1",
          household_count: 3_544,
          building_count: 44,
          parking_count: 4_102,
          approval_date: "2003-09-30",
          fetched_at: "2026-05-19T10:00:00.000Z",
        },
        {
          apartment_id: "apt-1",
          household_count: 3_500,
          building_count: 42,
          parking_count: 4_000,
          approval_date: "2003-09-01",
          fetched_at: "2026-05-18T10:00:00.000Z",
        },
      ],
    );

    expect(rows[0]).toMatchObject({
      householdCount: 3_544,
      buildingCount: 44,
      parkingCount: 4_102,
      approvalDate: "2003-09-30",
      basicInfoFetchedAt: "2026-05-19T10:00:00.000Z",
    });
    expect(rows[0].parkingPerHousehold).toBeCloseTo(4_102 / 3_544, 5);
    expect(rows[0].buildingAgeYears).toBeGreaterThanOrEqual(20);
  });

  it("merges the latest building density info into comparison rows", () => {
    const rows = buildApartmentComparisonRows(
      [
        {
          id: "apt-1",
          name: "관악드림타운",
          display_name: null,
          address: null,
          lawd_cd: null,
          status: "candidate",
          memo: null,
        },
      ],
      [],
      [],
      [],
      [
        {
          apartment_id: "apt-1",
          floor_area_ratio: 249.35,
          building_coverage_ratio: 18.42,
          fetched_at: "2026-06-01T10:00:00.000Z",
        },
        {
          apartment_id: "apt-1",
          floor_area_ratio: 240,
          building_coverage_ratio: 20,
          fetched_at: "2026-05-31T10:00:00.000Z",
        },
      ],
    );

    expect(rows[0]).toMatchObject({
      floorAreaRatio: 249.35,
      buildingCoverageRatio: 18.42,
      buildingInfoFetchedAt: "2026-06-01T10:00:00.000Z",
    });
  });

  it("merges commute times for Yeouido and Gangnam access comparison", () => {
    const rows = buildApartmentComparisonRows(
      [
        {
          id: "apt-1",
          name: "관악드림타운",
          display_name: null,
          address: null,
          lawd_cd: null,
          status: "candidate",
          memo: null,
        },
      ],
      [],
      [],
      [
        {
          apartment_id: "apt-1",
          destination_key: "yeouido_station",
          destination_name: "여의도역",
          transport_type: "transit",
          duration_minutes: 32,
          transfer_count: 1,
          source_name: "manual",
          source_ref: null,
          query_datetime: null,
          confidence_level: "manual",
          fetched_at: "2026-05-29T10:00:00.000Z",
        },
        {
          apartment_id: "apt-1",
          destination_key: "gangnam_station",
          destination_name: "강남역",
          transport_type: "transit",
          duration_minutes: 47,
          transfer_count: 2,
          source_name: "manual",
          source_ref: null,
          query_datetime: null,
          confidence_level: "manual",
          fetched_at: "2026-05-29T10:00:00.000Z",
        },
        {
          apartment_id: "apt-1",
          destination_key: "gangnam_station",
          destination_name: "강남역",
          transport_type: "driving",
          duration_minutes: 35,
          transfer_count: null,
          source_name: "tmap-driving",
          source_ref: null,
          query_datetime: null,
          confidence_level: "high",
          fetched_at: "2026-05-29T10:00:00.000Z",
        },
      ],
    );

    expect(rows[0].commuteToYeouido).toMatchObject({
      destinationName: "여의도역",
      durationMinutes: 32,
      transferCount: 1,
    });
    expect(rows[0].commuteToGangnam).toMatchObject({
      destinationName: "강남역",
      durationMinutes: 47,
      transferCount: 2,
    });
    expect(rows[0].driveToGangnam).toMatchObject({
      destinationName: "강남역",
      durationMinutes: 35,
      transportType: "driving",
    });
  });
});
