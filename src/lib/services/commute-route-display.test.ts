import { describe, expect, it } from "vitest";
import {
  buildTransitRouteHeadline,
  buildTransitRouteSegments,
} from "./commute-route-display";
import type { CommuteRouteStep } from "../../types/commute";

const routeSteps = [
  {
    mode: "walk",
    title: "도보",
    detail: "출발지에서 염창까지 이동",
    durationMinutes: 10,
    distanceMeters: 598,
    routeName: null,
    startName: "출발지",
    endName: "염창",
    stopCount: null,
  },
  {
    mode: "subway",
    title: "지하철",
    detail: "염창 승차 → 고속터미널 하차",
    durationMinutes: 19,
    distanceMeters: 13500,
    routeName: "수도권9호선(급행)",
    startName: "염창",
    endName: "고속터미널",
    stopCount: 5,
  },
  {
    mode: "transfer",
    title: "환승",
    detail: "고속터미널에서 다음 교통수단으로 환승",
    durationMinutes: null,
    distanceMeters: null,
    routeName: null,
    startName: "고속터미널",
    endName: "고속터미널",
    stopCount: null,
  },
  {
    mode: "bus",
    title: "버스",
    detail: "고속터미널 승차 → 강남역 하차",
    durationMinutes: 10,
    distanceMeters: 3300,
    routeName: "간선:640",
    startName: "고속터미널",
    endName: "강남역",
    stopCount: 4,
  },
] satisfies CommuteRouteStep[];

describe("buildTransitRouteSegments", () => {
  it("builds compact route-bar segments for walk, transit, and transfer steps", () => {
    expect(buildTransitRouteSegments(routeSteps)).toEqual([
      {
        mode: "walk",
        label: "도보",
        durationMinutes: 10,
        flexGrow: 10,
      },
      {
        mode: "subway",
        label: "수도권9호선(급행)",
        durationMinutes: 19,
        flexGrow: 19,
      },
      {
        mode: "transfer",
        label: "환승",
        durationMinutes: null,
        flexGrow: 1,
      },
      {
        mode: "bus",
        label: "간선:640",
        durationMinutes: 10,
        flexGrow: 10,
      },
    ]);
  });
});

describe("buildTransitRouteHeadline", () => {
  it("summarizes public transit routes in travel order", () => {
    expect(buildTransitRouteHeadline(routeSteps)).toBe(
      "수도권9호선(급행) → 간선:640",
    );
  });
});
