import { describe, expect, it } from "vitest";
import {
  calculateDashboardMapViewport,
  getDashboardMapPins,
  shouldStartDashboardMapDrag,
} from "./dashboard-map";

describe("getDashboardMapPins", () => {
  it("keeps only apartments with finite coordinates", () => {
    expect(
      getDashboardMapPins([
        {
          id: "apt-1",
          name: "Apt 1",
          address: "Seoul",
          lat: 37.5,
          lng: 126.9,
          status: "interested",
          latestPriceKrw: null,
          latestDealDate: null,
          gangnamMinutes: null,
          yeouidoMinutes: null,
          score: 71,
        },
        {
          id: "apt-2",
          name: "Apt 2",
          address: null,
          lat: null,
          lng: 127,
          status: "candidate",
          latestPriceKrw: null,
          latestDealDate: null,
          gangnamMinutes: null,
          yeouidoMinutes: null,
          score: 50,
        },
      ]),
    ).toEqual([
      {
        id: "apt-1",
        name: "Apt 1",
        address: "Seoul",
        lat: 37.5,
        lng: 126.9,
        status: "interested",
        latestPriceKrw: null,
        latestDealDate: null,
        gangnamMinutes: null,
        yeouidoMinutes: null,
        score: 71,
      },
    ]);
  });
});

describe("calculateDashboardMapViewport", () => {
  it("fits multiple Seoul pins into a medium zoom viewport", () => {
    const viewport = calculateDashboardMapViewport([
      {
        id: "west",
        name: "West",
        address: null,
        lat: 37.55,
        lng: 126.85,
        status: "interested",
        latestPriceKrw: null,
        latestDealDate: null,
        gangnamMinutes: null,
        yeouidoMinutes: null,
        score: 60,
      },
      {
        id: "east",
        name: "East",
        address: null,
        lat: 37.49,
        lng: 127.05,
        status: "candidate",
        latestPriceKrw: null,
        latestDealDate: null,
        gangnamMinutes: null,
        yeouidoMinutes: null,
        score: 58,
      },
    ]);

    expect(viewport.centerLat).toBeCloseTo(37.52, 2);
    expect(viewport.centerLng).toBeCloseTo(126.95, 2);
    expect(viewport.zoom).toBe(11);
  });

  it("uses a Seoul fallback when there are no pins", () => {
    expect(calculateDashboardMapViewport([])).toEqual({
      centerLat: 37.5665,
      centerLng: 126.978,
      zoom: 11,
    });
  });
});

describe("shouldStartDashboardMapDrag", () => {
  it("starts dragging only from the map background with the primary button", () => {
    expect(
      shouldStartDashboardMapDrag({
        button: 0,
        targetIsInteractive: true,
      }),
    ).toBe(false);
    expect(
      shouldStartDashboardMapDrag({
        button: 0,
        targetIsInteractive: false,
      }),
    ).toBe(true);
    expect(
      shouldStartDashboardMapDrag({
        button: 2,
        targetIsInteractive: false,
      }),
    ).toBe(false);
  });
});
