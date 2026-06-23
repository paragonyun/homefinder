import { describe, expect, it } from "vitest";
import { encodeCommuteSourceMetadata } from "./commute-source-metadata";
import { findFreshTmapCommuteCache } from "./commute-refresh-cache";

type TestCommuteRow = Parameters<typeof findFreshTmapCommuteCache>[0][number];

function commuteRow(
  overrides: Partial<TestCommuteRow> = {},
): TestCommuteRow {
  return {
    id: "row-id",
    apartment_id: "apt-1",
    destination_key: "yeouido_station",
    transport_type: "transit",
    duration_minutes: 30,
    source_ref: encodeCommuteSourceMetadata({
      version: 1,
      provider: "tmap",
      distanceMeters: 10_000,
      walkDistanceMeters: 600,
      fareKrw: 1_500,
      expiresAt: "2026-06-24T00:00:00.000Z",
      routeSteps: [],
    }),
    fetched_at: "2026-06-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("findFreshTmapCommuteCache", () => {
  it("returns the latest complete four-route cache when none of it is expired", () => {
    const result = findFreshTmapCommuteCache(
      [
        commuteRow({
          id: "old",
          destination_key: "yeouido_station",
          transport_type: "transit",
          fetched_at: "2026-06-22T00:00:00.000Z",
        }),
        commuteRow({
          id: "yeouido-transit",
          destination_key: "yeouido_station",
          transport_type: "transit",
          fetched_at: "2026-06-23T01:00:00.000Z",
        }),
        commuteRow({
          id: "yeouido-driving",
          destination_key: "yeouido_station",
          transport_type: "driving",
        }),
        commuteRow({
          id: "gangnam-transit",
          destination_key: "gangnam_station",
          transport_type: "transit",
        }),
        commuteRow({
          id: "gangnam-driving",
          destination_key: "gangnam_station",
          transport_type: "driving",
        }),
      ],
      new Date("2026-06-23T12:00:00.000Z"),
    );

    expect(result.cached).toBe(true);
    expect(result.rows.map((row) => row.id).sort()).toEqual([
      "gangnam-driving",
      "gangnam-transit",
      "yeouido-driving",
      "yeouido-transit",
    ]);
    expect(result.expiresAt).toBe("2026-06-24T00:00:00.000Z");
  });

  it("does not reuse cache when a required route is missing or expired", () => {
    const result = findFreshTmapCommuteCache(
      [
        commuteRow({
          destination_key: "yeouido_station",
          transport_type: "transit",
        }),
        commuteRow({
          destination_key: "yeouido_station",
          transport_type: "driving",
        }),
        commuteRow({
          destination_key: "gangnam_station",
          transport_type: "transit",
          source_ref: encodeCommuteSourceMetadata({
            version: 1,
            provider: "tmap",
            distanceMeters: null,
            walkDistanceMeters: null,
            fareKrw: null,
            expiresAt: "2026-06-22T00:00:00.000Z",
            routeSteps: [],
          }),
        }),
      ],
      new Date("2026-06-23T12:00:00.000Z"),
    );

    expect(result.cached).toBe(false);
    expect(result.missingKeys).toEqual([
      "gangnam_station:transit",
      "gangnam_station:driving",
    ]);
  });
});
