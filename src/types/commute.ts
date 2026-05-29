export const commuteDestinationKeys = [
  "yeouido_station",
  "gangnam_station",
] as const;

export type CommuteDestinationKey = (typeof commuteDestinationKeys)[number];

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
  transportType: "transit" | "walking" | "driving";
  durationMinutes?: number;
  transferCount?: number;
  sourceName?: string;
  sourceRef?: string;
  queryDatetime?: string;
  fetchedAt?: string;
  confidenceLevel?: "high" | "medium" | "low" | "manual" | "unknown";
};
