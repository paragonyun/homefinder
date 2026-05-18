export type ApartmentStatus =
  | "candidate"
  | "interested"
  | "visit_planned"
  | "visited"
  | "on_hold"
  | "excluded";

export type DataConfidence = "high" | "medium" | "low" | "manual" | "unknown";

export type DataSourceStamp = {
  sourceName: string;
  sourceRef?: string;
  fetchedAt?: string;
  confidenceLevel: DataConfidence;
};
