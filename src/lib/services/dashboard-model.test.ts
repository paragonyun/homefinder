import { describe, expect, it } from "vitest";
import {
  buildDashboardModel,
  type DashboardApartment,
  type DashboardBasicInfo,
  type DashboardBuildingInfo,
  type DashboardCommuteTime,
  type DashboardNeighborhood,
  type DashboardTransaction,
} from "./dashboard-model";

const neighborhoods: DashboardNeighborhood[] = [
  {
    id: "gwanak",
    name: "관악",
    description: "강남 접근성과 대단지 후보를 같이 보는 권역",
    updated_at: "2026-05-30T00:00:00.000Z",
  },
  {
    id: "yeomchang",
    name: "염창",
    description: "여의도 접근성을 우선 확인하는 권역",
    updated_at: "2026-05-29T00:00:00.000Z",
  },
];

const apartments: DashboardApartment[] = [
  {
    id: "dream",
    neighborhood_id: "gwanak",
    name: "관악드림타운",
    display_name: null,
    address: "서울 관악구 성현로 80",
    status: "interested",
    memo: "대단지, 강남 접근성 확인",
  },
  {
    id: "honors",
    neighborhood_id: "gwanak",
    name: "보라매경남아너스빌",
    display_name: "보라매경남아너스빌",
    address: "서울 영등포구 여의대방로 25",
    status: "candidate",
    memo: null,
  },
  {
    id: "dong-a",
    neighborhood_id: "yeomchang",
    name: "염창 동아 3차",
    display_name: null,
    address: "서울 강서구 양천로 731",
    status: "interested",
    memo: "여의도 접근성 우수",
  },
];

const transactions: DashboardTransaction[] = [
  {
    apartment_id: "dream",
    deal_amount_krw: 1_200_000_000,
    deal_date: "2026-05-15",
  },
  {
    apartment_id: "honors",
    deal_amount_krw: 1_310_000_000,
    deal_date: "2026-04-23",
  },
];

const basicInfos: DashboardBasicInfo[] = [
  {
    apartment_id: "dream",
    household_count: 3_544,
    parking_count: 5_404,
    approval_date: "2003-09-30",
    fetched_at: "2026-05-27T00:00:00.000Z",
  },
];

const buildingInfos: DashboardBuildingInfo[] = [
  {
    apartment_id: "dream",
    floor_area_ratio: 249.35,
    building_coverage_ratio: 18.42,
    fetched_at: "2026-06-01T00:00:00.000Z",
  },
];

const commuteTimes: DashboardCommuteTime[] = [
  {
    apartment_id: "dream",
    destination_key: "gangnam_station",
    transport_type: "transit",
    duration_minutes: 31,
  },
  {
    apartment_id: "dream",
    destination_key: "yeouido_station",
    transport_type: "transit",
    duration_minutes: 42,
  },
  {
    apartment_id: "dong-a",
    destination_key: "yeouido_station",
    transport_type: "transit",
    duration_minutes: 28,
  },
];

describe("buildDashboardModel", () => {
  it("summarizes neighborhood portfolios with price ranges and representative apartments", () => {
    const model = buildDashboardModel({
      apartments,
      basicInfos,
      buildingInfos,
      commuteTimes,
      neighborhoods,
      transactions,
    });

    expect(model.summary).toEqual({
      neighborhoods: 2,
      activeApartments: 3,
      withCommute: 2,
      withPrice: 2,
    });
    expect(model.neighborhoods[0]).toMatchObject({
      id: "gwanak",
      apartmentCount: 2,
      interestedCount: 1,
      priceRangeLabel: "12억~13.1억",
      gangnamSummary: "대중교통 31분",
      yeouidoSummary: "대중교통 42분",
      missingBadges: [],
    });
    expect(model.neighborhoods[0].apartmentSummaries.map((item) => item.id)).toEqual([
      "dream",
      "honors",
    ]);
    expect(model.neighborhoods[0].representativeApartments).toHaveLength(2);
    expect(model.neighborhoods[0].representativeApartments[0]).toMatchObject({
      id: "dream",
      name: "관악드림타운",
      parkingPerHousehold: 5_404 / 3_544,
      floorAreaRatio: 249.35,
      buildingCoverageRatio: 18.42,
      evidence: expect.arrayContaining(["최근 거래 있음", "강남 31분"]),
    });
  });

  it("keeps missing-data badges small and ranks priority candidates by usable evidence", () => {
    const model = buildDashboardModel({
      apartments,
      basicInfos,
      buildingInfos,
      commuteTimes,
      neighborhoods,
      transactions,
    });

    const yeomchang = model.neighborhoods.find((item) => item.id === "yeomchang");

    expect(yeomchang).toMatchObject({
      apartmentCount: 1,
      priceRangeLabel: "가격 미확인",
      gangnamSummary: "강남 미확인",
      yeouidoSummary: "대중교통 28분",
      missingBadges: ["가격 미확인"],
    });
    expect(model.priorityApartments.map((item) => item.id)).toEqual([
      "dream",
      "dong-a",
      "honors",
    ]);
    expect(model.priorityApartments[0].evidence).toEqual(
      expect.arrayContaining(["관심", "최근 거래 있음", "강남 31분", "1,000세대 이상"]),
    );
  });

  it("does not surface zero building density values as usable evidence", () => {
    const model = buildDashboardModel({
      apartments: [
        {
          id: "apt-zero",
          neighborhood_id: "gwanak",
          name: "apt zero",
          display_name: null,
          address: null,
          status: "candidate",
          memo: null,
        },
      ],
      basicInfos: [],
      buildingInfos: [
        {
          apartment_id: "apt-zero",
          floor_area_ratio: 0,
          building_coverage_ratio: 0,
          fetched_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      commuteTimes: [],
      neighborhoods,
      transactions: [],
    });

    expect(model.priorityApartments[0]).toMatchObject({
      floorAreaRatio: null,
      buildingCoverageRatio: null,
    });
    expect(model.priorityApartments[0].evidence.join(" ")).not.toContain("0%");
  });
});
