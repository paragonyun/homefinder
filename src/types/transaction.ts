export type ApartmentTransaction = {
  id: string;
  apartmentId: string;
  dealDate: string;
  exclusiveAreaM2: number;
  floor?: number;
  dealAmountKrw: number;
  sourceName: string;
  sourceRef?: string;
  fetchedAt: string;
  confidenceLevel: "high" | "medium" | "low" | "manual" | "unknown";
};
