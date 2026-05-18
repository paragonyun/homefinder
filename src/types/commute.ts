export type CommuteTime = {
  apartmentId: string;
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
