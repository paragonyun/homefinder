import { describe, expect, it } from "vitest";
import { encodeCommuteSourceMetadata } from "./commute-source-metadata";
import {
  buildCommuteAccessSummaryByApartment,
  buildCommuteSummaryByApartment,
} from "./commute-summary";

describe("buildCommuteSummaryByApartment", () => {
  it("keeps the latest transit commute per destination", () => {
    const summaries = buildCommuteSummaryByApartment([
      {
        apartment_id: "apt-1",
        destination_key: "yeouido_station",
        destination_name: "여의도역",
        transport_type: "transit",
        duration_minutes: 31,
        transfer_count: 1,
        source_name: "manual",
        source_ref: null,
        query_datetime: null,
        confidence_level: "manual",
        fetched_at: "2026-05-28T10:00:00.000Z",
      },
      {
        apartment_id: "apt-1",
        destination_key: "yeouido_station",
        destination_name: "여의도역",
        transport_type: "transit",
        duration_minutes: 28,
        transfer_count: 0,
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
        transport_type: "walking",
        duration_minutes: 200,
        transfer_count: null,
        source_name: "manual",
        source_ref: null,
        query_datetime: null,
        confidence_level: "manual",
        fetched_at: "2026-05-29T10:00:00.000Z",
      },
    ]);

    expect(summaries.get("apt-1")?.yeouido_station).toMatchObject({
      destinationKey: "yeouido_station",
      destinationName: "여의도역",
      transportType: "transit",
      durationMinutes: 28,
      transferCount: 0,
      sourceName: "manual",
      sourceRef: null,
      queryDatetime: null,
      confidenceLevel: "manual",
      fetchedAt: "2026-05-29T10:00:00.000Z",
      distanceMeters: null,
      walkDistanceMeters: null,
      fareKrw: null,
      expiresAt: null,
      routeSteps: [],
    });
    expect(summaries.get("apt-1")?.gangnam_station).toBeNull();
  });
});

describe("buildCommuteAccessSummaryByApartment", () => {
  it("merges transit and driving commute details with cached route metadata", () => {
    const sourceRef = encodeCommuteSourceMetadata({
      version: 1,
      provider: "tmap",
      distanceMeters: 12000,
      walkDistanceMeters: 600,
      fareKrw: 1500,
      expiresAt: "2999-05-30T10:00:00.000Z",
      routeSteps: [
        {
          mode: "subway",
          title: "지하철",
          detail: "염창역 승차 → 강남역 하차",
          durationMinutes: 32,
          distanceMeters: 11000,
          routeName: "9호선",
          startName: "염창역",
          endName: "강남역",
          stopCount: 8,
        },
      ],
    });

    const summaries = buildCommuteAccessSummaryByApartment([
      {
        apartment_id: "apt-1",
        destination_key: "gangnam_station",
        destination_name: "강남역",
        transport_type: "transit",
        duration_minutes: 42,
        transfer_count: 1,
        source_name: "tmap-transit",
        source_ref: sourceRef,
        query_datetime: "2026-06-01T07:30:00+09:00",
        confidence_level: "high",
        fetched_at: "2026-05-31T10:00:00.000Z",
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
        query_datetime: "2026-06-01T07:30:00+09:00",
        confidence_level: "high",
        fetched_at: "2026-05-31T10:00:00.000Z",
      },
    ]);

    const access = summaries.get("apt-1")?.gangnam_station;

    expect(access?.transit).toMatchObject({
      durationMinutes: 42,
      distanceMeters: 12000,
      walkDistanceMeters: 600,
      fareKrw: 1500,
      routeSteps: [
        expect.objectContaining({
          mode: "subway",
          routeName: "9호선",
        }),
      ],
      isExpired: false,
    });
    expect(access?.driving).toMatchObject({
      durationMinutes: 35,
      transportType: "driving",
    });
  });
});
