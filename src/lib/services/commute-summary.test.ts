import { describe, expect, it } from "vitest";
import { buildCommuteSummaryByApartment } from "./commute-summary";

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

    expect(summaries.get("apt-1")).toEqual({
      yeouido_station: {
        destinationKey: "yeouido_station",
        destinationName: "여의도역",
        durationMinutes: 28,
        transferCount: 0,
        sourceName: "manual",
        sourceRef: null,
        queryDatetime: null,
        confidenceLevel: "manual",
        fetchedAt: "2026-05-29T10:00:00.000Z",
      },
      gangnam_station: null,
    });
  });
});
