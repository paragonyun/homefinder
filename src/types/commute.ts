export const commuteDestinationKeys = [
  "yeouido_station",
  "gangnam_station",
] as const;

export type CommuteDestinationKey = (typeof commuteDestinationKeys)[number];

export const commuteTransportTypes = ["transit", "walking", "driving"] as const;

export type CommuteTransportType = (typeof commuteTransportTypes)[number];

export type CommuteRouteStepMode =
  | "walk"
  | "bus"
  | "subway"
  | "train"
  | "transfer"
  | "driving";

export type CommuteRouteStep = {
  mode: CommuteRouteStepMode;
  title: string;
  detail: string | null;
  durationMinutes: number | null;
  distanceMeters: number | null;
  routeName: string | null;
  startName: string | null;
  endName: string | null;
  stopCount: number | null;
};

export type CommuteSourceMetadata = {
  version: 1;
  provider: "tmap";
  distanceMeters: number | null;
  walkDistanceMeters: number | null;
  fareKrw: number | null;
  expiresAt: string;
  routeSteps: CommuteRouteStep[];
};

export const defaultCommuteDestinations = [
  {
    key: "yeouido_station",
    name: "여의도역",
    lat: 37.521624,
    lng: 126.924191,
  },
  {
    key: "gangnam_station",
    name: "강남역",
    lat: 37.497952,
    lng: 127.027619,
  },
] as const satisfies ReadonlyArray<{
  key: CommuteDestinationKey;
  name: string;
  lat: number;
  lng: number;
}>;

export type CommuteTime = {
  apartmentId: string;
  destinationKey: CommuteDestinationKey;
  destinationName: string;
  transportType: CommuteTransportType;
  durationMinutes?: number;
  transferCount?: number;
  sourceName?: string;
  sourceRef?: string;
  queryDatetime?: string;
  fetchedAt?: string;
  confidenceLevel?: "high" | "medium" | "low" | "manual" | "unknown";
};
