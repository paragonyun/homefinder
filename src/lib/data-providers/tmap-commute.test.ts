import { describe, expect, it } from "vitest";
import {
  getNextWeekday0730SearchDttm,
  parseTmapDrivingRoute,
  parseTmapTransitRoute,
} from "./tmap-commute";

describe("parseTmapTransitRoute", () => {
  it("normalizes walking, subway, transfer, fare, and stop details", () => {
    const result = parseTmapTransitRoute({
      metaData: {
        plan: {
          itineraries: [
            {
              totalTime: 2580,
              fare: {
                regular: {
                  totalFare: 1500,
                },
              },
              legs: [
                {
                  mode: "WALK",
                  sectionTime: 360,
                  distance: 420,
                  start: { name: "출발지" },
                  end: { name: "염창역" },
                },
                {
                  mode: "SUBWAY",
                  route: "9호선",
                  sectionTime: 1200,
                  distance: 8200,
                  start: { name: "염창역" },
                  end: { name: "당산역" },
                  passStopList: {
                    stationList: [{ stationName: "역1" }, { stationName: "역2" }],
                  },
                },
                {
                  mode: "SUBWAY",
                  route: "2호선",
                  sectionTime: 900,
                  distance: 6400,
                  start: { name: "당산역" },
                  end: { name: "강남역" },
                },
                {
                  mode: "WALK",
                  sectionTime: 120,
                  distance: 130,
                  start: { name: "강남역" },
                  end: { name: "도착지" },
                },
              ],
            },
          ],
        },
      },
    });

    expect(result).toMatchObject({
      transportType: "transit",
      durationMinutes: 43,
      transferCount: 1,
      distanceMeters: 15150,
      walkDistanceMeters: 550,
      fareKrw: 1500,
    });
    expect(result.routeSteps.map((step) => step.mode)).toEqual([
      "walk",
      "subway",
      "transfer",
      "subway",
      "walk",
    ]);
    expect(result.routeSteps[1]).toMatchObject({
      title: "지하철",
      routeName: "9호선",
      stopCount: 2,
    });
  });
});

describe("parseTmapDrivingRoute", () => {
  it("normalizes seconds and meters into a driving result", () => {
    const result = parseTmapDrivingRoute({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            totalDistance: 12345,
            totalTime: 1880,
            totalFare: 0,
          },
        },
      ],
    });

    expect(result).toMatchObject({
      transportType: "driving",
      durationMinutes: 32,
      distanceMeters: 12345,
      fareKrw: 0,
      transferCount: null,
    });
  });
});

describe("getNextWeekday0730SearchDttm", () => {
  it("uses the same weekday when 07:30 has not passed in Seoul", () => {
    expect(
      getNextWeekday0730SearchDttm(new Date("2026-06-01T21:00:00.000Z")),
    ).toBe("202606020730");
  });

  it("skips weekends", () => {
    expect(
      getNextWeekday0730SearchDttm(new Date("2026-06-05T23:00:00.000Z")),
    ).toBe("202606080730");
  });
});
