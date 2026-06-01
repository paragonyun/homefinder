import { describe, expect, it } from "vitest";
import {
  buildApartmentSchoolAccessRows,
  resolveSchoolSearchRegion,
} from "./school-access";

describe("resolveSchoolSearchRegion", () => {
  it("extracts region and district names from Seoul addresses", () => {
    expect(
      resolveSchoolSearchRegion([
        "서울특별시 관악구 성현로 80",
        "서울 관악구 봉천동 1712",
      ]),
    ).toEqual({
      regionName: "서울특별시",
      districtName: "관악구",
    });
  });

  it("normalizes short Seoul addresses and returns null for unusable input", () => {
    expect(resolveSchoolSearchRegion(["서울 영등포구 여의대방로 25"])).toEqual({
      regionName: "서울특별시",
      districtName: "영등포구",
    });

    expect(resolveSchoolSearchRegion([null, ""])).toEqual({
      regionName: null,
      districtName: null,
    });
  });
});

describe("buildApartmentSchoolAccessRows", () => {
  it("computes distance and marks nearest school by type", () => {
    const rows = buildApartmentSchoolAccessRows({
      apartmentId: "apt-1",
      apartmentLat: 37.48,
      apartmentLng: 126.95,
      schools: [
        {
          id: "school-1",
          school_type: "elementary",
          lat: 37.481,
          lng: 126.951,
        },
        {
          id: "school-2",
          school_type: "elementary",
          lat: 37.5,
          lng: 126.98,
        },
        {
          id: "school-3",
          school_type: "middle",
          lat: null,
          lng: null,
        },
      ],
      sourceName: "neis-school-info",
      fetchedAt: "2026-06-01T00:00:00.000Z",
      userId: "user-1",
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      apartment_id: "apt-1",
      school_id: "school-1",
      school_type: "elementary",
      is_nearest_by_type: true,
      source_name: "neis-school-info",
      user_id: "user-1",
    });
    expect(rows[0].distance_meters).toBeGreaterThan(100);
    expect(rows[0].walk_minutes).toBeGreaterThan(1);
    expect(rows[1]).toMatchObject({
      school_id: "school-2",
      is_nearest_by_type: false,
    });
    expect(rows[2]).toMatchObject({
      school_id: "school-3",
      distance_meters: null,
      walk_minutes: null,
      confidence_level: "medium",
    });
  });

  it("keeps school links without distance when apartment coordinates are missing", () => {
    const rows =
      buildApartmentSchoolAccessRows({
        apartmentId: "apt-1",
        apartmentLat: null,
        apartmentLng: null,
        schools: [
          {
            id: "school-1",
            school_type: "elementary",
            lat: 37.481,
            lng: 126.951,
          },
        ],
        sourceName: "neis-school-info",
        fetchedAt: "2026-06-01T00:00:00.000Z",
        userId: "user-1",
      });

    expect(rows).toEqual([
      {
        apartment_id: "apt-1",
        confidence_level: "medium",
        distance_meters: null,
        fetched_at: "2026-06-01T00:00:00.000Z",
        is_nearest_by_type: false,
        school_id: "school-1",
        school_type: "elementary",
        source_name: "neis-school-info",
        source_ref: null,
        user_id: "user-1",
        walk_minutes: null,
      },
    ]);
  });
});
