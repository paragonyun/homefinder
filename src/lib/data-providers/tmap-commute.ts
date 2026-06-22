import type {
  CommuteRouteStep,
  CommuteTransportType,
} from "@/types/commute";
import { fetchWithTimeout } from "./http";

export const TMAP_TRANSIT_ROUTES_ENDPOINT =
  "https://apis.openapi.sk.com/transit/routes";
export const TMAP_DRIVING_ROUTES_ENDPOINT =
  "https://apis.openapi.sk.com/tmap/routes";
export const TMAP_FULL_ADDR_GEOCODE_ENDPOINT =
  "https://apis.openapi.sk.com/tmap/geo/fullAddrGeo";

type Coordinate = {
  lat: number;
  lng: number;
};

export type TmapCommuteResult = {
  transportType: Extract<CommuteTransportType, "transit" | "driving">;
  durationMinutes: number;
  transferCount: number | null;
  distanceMeters: number | null;
  walkDistanceMeters: number | null;
  fareKrw: number | null;
  routeSteps: CommuteRouteStep[];
};

export async function fetchTmapTransitRoute({
  apiKey,
  destination,
  searchDttm,
  start,
}: {
  apiKey: string;
  destination: Coordinate;
  searchDttm: string;
  start: Coordinate;
}) {
  const response = await fetchWithTimeout(
    TMAP_TRANSIT_ROUTES_ENDPOINT,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        appKey: apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        startX: String(start.lng),
        startY: String(start.lat),
        endX: String(destination.lng),
        endY: String(destination.lat),
        lang: 0,
        format: "json",
        count: 1,
        searchDttm,
      }),
    },
    { label: "TMAP transit API" },
  );
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(formatTmapError("대중교통", response.status, body));
  }

  return parseTmapTransitRoute(body);
}

export function parseTmapTransitRoute(body: unknown): TmapCommuteResult {
  throwIfTmapResultError("대중교통", body);

  const plan = getRecord(getRecord(body)?.metaData)?.plan;
  const itineraries = getArray(getRecord(plan)?.itineraries);
  const itinerary = itineraries
    .map(getRecord)
    .filter(Boolean)
    .sort(
      (left, right) =>
        (readNumber(left?.totalTime) ?? Number.MAX_SAFE_INTEGER) -
        (readNumber(right?.totalTime) ?? Number.MAX_SAFE_INTEGER),
    )[0];

  if (!itinerary) {
    throw new Error("TMAP 대중교통 경로를 찾지 못했습니다.");
  }

  const legs = getArray(itinerary.legs).map(getRecord).filter(Boolean);
  const totalSeconds =
    readNumber(itinerary.totalTime) ??
    legs.reduce((sum, leg) => sum + (readNumber(leg?.sectionTime) ?? 0), 0);
  const publicLegCount = legs.filter((leg) => isPublicTransitMode(leg?.mode)).length;
  const transferCount =
    readNumber(itinerary.transferCount) ?? Math.max(publicLegCount - 1, 0);
  const routeSteps = normalizeTransitLegs(legs);
  const walkDistanceMeters = routeSteps
    .filter((step) => step.mode === "walk")
    .reduce((sum, step) => sum + (step.distanceMeters ?? 0), 0);
  const distanceMeters = routeSteps.reduce(
    (sum, step) => sum + (step.distanceMeters ?? 0),
    0,
  );
  const regularFare = getRecord(getRecord(itinerary.fare)?.regular);
  const fareKrw = readNumber(regularFare?.totalFare);

  return {
    transportType: "transit",
    durationMinutes: secondsToMinutes(totalSeconds),
    transferCount,
    distanceMeters: distanceMeters || null,
    walkDistanceMeters: walkDistanceMeters || null,
    fareKrw,
    routeSteps,
  };
}

export async function fetchTmapDrivingRoute({
  apiKey,
  destination,
  start,
}: {
  apiKey: string;
  destination: Coordinate;
  start: Coordinate;
}) {
  const url = new URL(TMAP_DRIVING_ROUTES_ENDPOINT);

  url.searchParams.set("version", "1");
  url.searchParams.set("format", "json");

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        appKey: apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        startX: String(start.lng),
        startY: String(start.lat),
        endX: String(destination.lng),
        endY: String(destination.lat),
        reqCoordType: "WGS84GEO",
        resCoordType: "WGS84GEO",
        searchOption: "0",
        carType: "0",
        trafficInfo: "N",
      }),
    },
    { label: "TMAP driving API" },
  );
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(formatTmapError("자동차", response.status, body));
  }

  return parseTmapDrivingRoute(body);
}

export function parseTmapDrivingRoute(body: unknown): TmapCommuteResult {
  throwIfTmapResultError("자동차", body);

  const features = getArray(getRecord(body)?.features).map(getRecord).filter(Boolean);
  const summary = features
    .map((feature) => getRecord(feature?.properties))
    .find(
      (properties) =>
        readNumber(properties?.totalTime) !== null ||
        readNumber(properties?.totalDistance) !== null,
    );

  if (!summary) {
    throw new Error("TMAP 자동차 경로를 찾지 못했습니다.");
  }

  const totalSeconds = readNumber(summary.totalTime);
  const totalDistance = readNumber(summary.totalDistance);

  if (totalSeconds === null) {
    throw new Error("TMAP 자동차 소요시간을 읽지 못했습니다.");
  }

  return {
    transportType: "driving",
    durationMinutes: secondsToMinutes(totalSeconds),
    transferCount: null,
    distanceMeters: totalDistance,
    walkDistanceMeters: null,
    fareKrw: readNumber(summary.totalFare),
    routeSteps: [
      {
        mode: "driving",
        title: "자동차",
        detail: "실시간 교통 기준 경로",
        durationMinutes: secondsToMinutes(totalSeconds),
        distanceMeters: totalDistance,
        routeName: null,
        startName: "출발지",
        endName: "도착지",
        stopCount: null,
      },
    ],
  };
}

export async function geocodeAddressWithTmap({
  address,
  apiKey,
}: {
  address: string;
  apiKey: string;
}) {
  const url = new URL(TMAP_FULL_ADDR_GEOCODE_ENDPOINT);

  url.searchParams.set("version", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressFlag", "F00");
  url.searchParams.set("coordType", "WGS84GEO");
  url.searchParams.set("page", "1");
  url.searchParams.set("count", "1");
  url.searchParams.set("fullAddr", address);

  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        accept: "application/json",
        appKey: apiKey,
      },
    },
    { label: "TMAP geocode API" },
  );
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(formatTmapError("주소 좌표 변환", response.status, body));
  }

  const coordinateInfo = getRecord(getRecord(body)?.coordinateInfo);
  const coordinate = getArray(coordinateInfo?.coordinate).map(getRecord)[0];
  const lng = readNumber(coordinate?.lon) ?? readNumber(coordinate?.newLon);
  const lat = readNumber(coordinate?.lat) ?? readNumber(coordinate?.newLat);

  if (lat === null || lng === null) {
    throw new Error("주소를 좌표로 변환하지 못했습니다.");
  }

  return { lat, lng };
}

export function getNextWeekday0730SearchDttm(now = new Date()) {
  const candidate = getNextWeekday0730Kst(now);
  const parts = getKstParts(candidate);

  return `${parts.year}${pad2(parts.month)}${pad2(parts.day)}0730`;
}

function getNextWeekday0730Kst(now: Date) {
  const nowParts = getKstParts(now);
  let candidate = fromKstParts({
    day: nowParts.day,
    hour: 7,
    minute: 30,
    month: nowParts.month,
    year: nowParts.year,
  });

  while (candidate <= now || isWeekendKst(candidate)) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }

  return candidate;
}

function normalizeTransitLegs(
  legs: Array<Record<string, unknown> | null>,
): CommuteRouteStep[] {
  const routeSteps: CommuteRouteStep[] = [];
  let hasPublicLeg = false;

  for (const leg of legs) {
    if (!leg) {
      continue;
    }

    const mode = String(leg.mode ?? "").toUpperCase();
    const startName = readPlaceName(leg.start) ?? "출발지";
    const endName = readPlaceName(leg.end) ?? "도착지";
    const durationMinutes = secondsToMinutes(readNumber(leg.sectionTime) ?? 0);
    const distanceMeters = readNumber(leg.distance);

    if (mode === "WALK") {
      routeSteps.push({
        mode: "walk",
        title: "도보",
        detail: `${startName}에서 ${endName}까지 이동`,
        durationMinutes,
        distanceMeters,
        routeName: null,
        startName,
        endName,
        stopCount: null,
      });
      continue;
    }

    if (isPublicTransitMode(mode)) {
      if (hasPublicLeg) {
        routeSteps.push({
          mode: "transfer",
          title: "환승",
          detail: `${startName}에서 다음 교통수단으로 환승`,
          durationMinutes: null,
          distanceMeters: null,
          routeName: null,
          startName,
          endName: startName,
          stopCount: null,
        });
      }

      hasPublicLeg = true;
      routeSteps.push({
        mode: toRouteStepMode(mode),
        title: toRouteStepTitle(mode),
        detail: `${startName} 승차 → ${endName} 하차`,
        durationMinutes,
        distanceMeters,
        routeName: readRouteName(leg),
        startName,
        endName,
        stopCount: readStopCount(leg),
      });
    }
  }

  return routeSteps;
}

function isPublicTransitMode(value: unknown) {
  const mode = String(value ?? "").toUpperCase();

  return [
    "BUS",
    "SUBWAY",
    "TRAIN",
    "EXPRESSBUS",
    "AIRPLANE",
    "FERRY",
  ].includes(mode);
}

function toRouteStepMode(mode: string): CommuteRouteStep["mode"] {
  if (mode === "BUS" || mode === "EXPRESSBUS") {
    return "bus";
  }

  if (mode === "SUBWAY") {
    return "subway";
  }

  return "train";
}

function toRouteStepTitle(mode: string) {
  if (mode === "BUS" || mode === "EXPRESSBUS") {
    return "버스";
  }

  if (mode === "SUBWAY") {
    return "지하철";
  }

  return "대중교통";
}

function readRouteName(leg: Record<string, unknown>) {
  const directRoute = readString(leg.route);

  if (directRoute) {
    return directRoute;
  }

  const lane = getArray(leg.lane).map(getRecord).filter(Boolean)[0];

  return readString(lane?.route);
}

function readStopCount(leg: Record<string, unknown>) {
  const passStopList = getRecord(leg.passStopList);
  const stationList = getArray(passStopList?.stationList);

  return stationList.length > 0 ? stationList.length : null;
}

function readPlaceName(value: unknown) {
  return readString(getRecord(value)?.name);
}

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function formatTmapError(
  label: string,
  status: number,
  body: unknown,
) {
  const message =
    readTmapResultError(body)?.message ??
    readString(getRecord(getRecord(body)?.error)?.message) ??
    readString(getRecord(body)?.message);

  return `TMAP ${label} API request failed with ${status}${
    message ? `: ${message}` : ""
  }`;
}

function throwIfTmapResultError(label: string, body: unknown) {
  const error = readTmapResultError(body);

  if (!error) {
    return;
  }

  const status = error.status !== null ? ` ${error.status}` : "";

  throw new Error(`TMAP ${label} API error${status}: ${error.message}`);
}

function readTmapResultError(body: unknown) {
  const result = getRecord(getRecord(body)?.result);

  if (!result) {
    return null;
  }

  const status = readNumber(result.status);
  const message = readString(result.message);

  if (status === null && !message) {
    return null;
  }

  return {
    status,
    message: message ?? "Unknown error",
  };
}

function secondsToMinutes(seconds: number) {
  return Math.max(1, Math.ceil(seconds / 60));
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getKstParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday,
  };
}

function fromKstParts({
  day,
  hour,
  minute,
  month,
  year,
}: {
  day: number;
  hour: number;
  minute: number;
  month: number;
  year: number;
}) {
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0));
}

function isWeekendKst(date: Date) {
  const weekday = getKstParts(date).weekday;

  return weekday === "Sat" || weekday === "Sun";
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}
