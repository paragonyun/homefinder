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
        fieldNoteDate: null,
        fieldNoteRating: null,
        fieldNoteConclusion: null,
        fieldNoteRecheck: null,
        fieldNoteUpdatedAt: null,
        score: expect.objectContaining({
          totalScore: expect.any(Number),
        }),
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
        fieldNoteDate: null,
        fieldNoteRating: null,
        fieldNoteConclusion: null,
        fieldNoteRecheck: null,
        fieldNoteUpdatedAt: null,
        score: expect.objectContaining({
          totalScore: expect.any(Number),
        }),
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

  it("treats zero building density values as missing in comparison rows", () => {
    const rows = buildApartmentComparisonRows(
      [
        {
          id: "apt-1",
          name: "apt",
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
          floor_area_ratio: 0,
          building_coverage_ratio: 0,
          fetched_at: "2026-06-01T10:00:00.000Z",
        },
      ],
    );

    expect(rows[0]).toMatchObject({
      floorAreaRatio: null,
      buildingCoverageRatio: null,
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

  it("merges the latest field note summary into comparison rows", () => {
    const rows = buildApartmentComparisonRows(
      [
        {
          id: "apt-1",
          name: "관악드림타운",
          display_name: null,
          address: null,
          lawd_cd: null,
          status: "interested",
          memo: null,
        },
      ],
      [],
      [],
      [],
      [],
      [
        {
          apartment_id: "apt-1",
          visit_date: "2026-05-30",
          overall_rating: 3,
          revisit_intention: "보류",
          overall_memo: "주차 재확인",
          bad_points: null,
          parking_note: null,
          noise_note: null,
          slope_note: null,
          created_at: "2026-05-30T10:00:00.000Z",
          updated_at: "2026-05-30T10:00:00.000Z",
        },
        {
          apartment_id: "apt-1",
          visit_date: "2026-06-02",
          overall_rating: 4,
          revisit_intention: "관심 유지",
          overall_memo: "비 오는 날 경사 체감 다시 확인",
          bad_points: null,
          parking_note: null,
          noise_note: null,
          slope_note: null,
          created_at: "2026-06-02T10:00:00.000Z",
          updated_at: "2026-06-02T11:00:00.000Z",
        },
      ],
    );

    expect(rows[0]).toMatchObject({
      fieldNoteDate: "2026-06-02",
      fieldNoteRating: 4,
      fieldNoteConclusion: "관심 유지",
      fieldNoteRecheck: "비 오는 날 경사 체감 다시 확인",
      fieldNoteUpdatedAt: "2026-06-02T11:00:00.000Z",
    });
  });

  it("adds apartment score breakdown to comparison rows", () => {
    const rows = buildApartmentComparisonRows(
      [
        {
          id: "apt-1",
          name: "test apt",
          display_name: null,
          address: null,
          lawd_cd: null,
          status: "interested",
          memo: null,
        },
      ],
      [
        {
          apartment_id: "apt-1",
          deal_date: "2026-05-01",
          exclusive_area_m2: 84.9,
          deal_amount_krw: 950_000_000,
          cancel_yn: null,
        },
      ],
      [
        {
          apartment_id: "apt-1",
          household_count: 800,
          building_count: 10,
          parking_count: 900,
          approval_date: "2004-01-01",
          fetched_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      [
        {
          apartment_id: "apt-1",
          destination_key: "yeouido_station",
          destination_name: "여의도역",
          transport_type: "transit",
          duration_minutes: 28,
          transfer_count: 1,
          source_name: "tmap-transit",
          source_ref: null,
          query_datetime: null,
          confidence_level: "high",
          fetched_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      [
        {
          apartment_id: "apt-1",
          floor_area_ratio: 230,
          building_coverage_ratio: 18,
          fetched_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      [
        {
          apartment_id: "apt-1",
          visit_date: "2026-06-01",
          overall_rating: 5,
          station_walk_rating: 4,
          slope_rating: 4,
          complex_condition_rating: 4,
          parking_rating: 4,
          noise_rating: 5,
          night_mood_rating: 5,
          commercial_area_rating: 4,
          revisit_intention: "관심 유지",
          overall_memo: null,
          bad_points: null,
          parking_note: null,
          noise_note: null,
          slope_note: null,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z",
        },
      ],
    );

    expect(rows[0].score.totalScore).toBeGreaterThan(60);
    expect(rows[0].score.categories.budget.maxScore).toBe(25);
    expect(rows[0].score.categories.access.maxScore).toBe(20);
    expect(rows[0].score.evidence).toContain("임장 긍정");
  });
});
