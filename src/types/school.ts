export type School = {
  id: string;
  name: string;
  schoolType: "elementary" | "middle" | "high" | "unknown";
  address?: string;
  lat?: number;
  lng?: number;
  sourceName?: string;
  sourceRef?: string;
  fetchedAt?: string;
  confidenceLevel?: "high" | "medium" | "low" | "manual" | "unknown";
};
