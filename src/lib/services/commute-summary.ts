import {
  commuteDestinationKeys,
  defaultCommuteDestinations,
  type CommuteDestinationKey,
  type CommuteRouteStep,
  type CommuteTransportType,
} from "../../types/commute";
import { decodeCommuteSourceMetadata } from "./commute-source-metadata";

export type CommuteTimeLike = {
  apartment_id: string;
  destination_key: CommuteDestinationKey;
  destination_name: string | null;
  transport_type: CommuteTransportType;
  duration_minutes: number | null;
  transfer_count: number | null;
  source_name: string | null;
  source_ref: string | null;
  query_datetime: string | null;
  confidence_level: "high" | "medium" | "low" | "manual" | "unknown";
  fetched_at: string | null;
};

export type CommuteSummary = {
  destinationKey: CommuteDestinationKey;
  destinationName: string;
  transportType: CommuteTransportType;
  durationMinutes: number;
  transferCount: number | null;
  sourceName: string | null;
  sourceRef: string | null;
  queryDatetime: string | null;
  confidenceLevel: "high" | "medium" | "low" | "manual" | "unknown";
  fetchedAt: string | null;
  distanceMeters: number | null;
  walkDistanceMeters: number | null;
  fareKrw: number | null;
  expiresAt: string | null;
  routeSteps: CommuteRouteStep[];
  isExpired: boolean;
};

export type CommuteAccessSummary = Record<
  CommuteDestinationKey,
  {
    transit: CommuteSummary | null;
    driving: CommuteSummary | null;
  }
>;

export function buildCommuteSummaryByApartment(
  commuteTimes: CommuteTimeLike[],
) {
  const accessSummaries = buildCommuteAccessSummaryByApartment(commuteTimes);
  const summaries = new Map<
    string,
    Record<CommuteDestinationKey, CommuteSummary | null>
  >();

  for (const [apartmentId, accessSummary] of accessSummaries) {
    summaries.set(apartmentId, {
      yeouido_station: accessSummary.yeouido_station.transit,
      gangnam_station: accessSummary.gangnam_station.transit,
    });
  }

  return summaries;
}

export function buildCommuteAccessSummaryByApartment(
  commuteTimes: CommuteTimeLike[],
) {
  const summaries = new Map<string, CommuteAccessSummary>();

  for (const commuteTime of commuteTimes) {
    if (!commuteDestinationKeys.includes(commuteTime.destination_key)) {
      continue;
    }

    if (
      commuteTime.transport_type !== "transit" &&
      commuteTime.transport_type !== "driving"
    ) {
      continue;
    }

    const summary = toCommuteSummary(commuteTime);

    if (!summary) {
      continue;
    }

    const current =
      summaries.get(commuteTime.apartment_id) ?? emptyAccessSummary();
    const transportKey =
      commuteTime.transport_type === "driving" ? "driving" : "transit";
    const previous = current[commuteTime.destination_key][transportKey];

    if (!previous || compareCommuteFreshness(summary, previous) > 0) {
      current[commuteTime.destination_key] = {
        ...current[commuteTime.destination_key],
        [transportKey]: summary,
      };
      summaries.set(commuteTime.apartment_id, current);
    }
  }

  return summaries;
}

export function getDefaultDestinationName(key: CommuteDestinationKey) {
  return (
    defaultCommuteDestinations.find((destination) => destination.key === key)
      ?.name ?? key
  );
}

function toCommuteSummary(
  commuteTime: CommuteTimeLike,
): CommuteSummary | null {
  if (commuteTime.duration_minutes === null) {
    return null;
  }

  const metadata = decodeCommuteSourceMetadata(commuteTime.source_ref);
  const expiresAt = metadata?.expiresAt ?? null;

  return {
    destinationKey: commuteTime.destination_key,
    destinationName:
      commuteTime.destination_name ??
      getDefaultDestinationName(commuteTime.destination_key),
    transportType: commuteTime.transport_type,
    durationMinutes: commuteTime.duration_minutes,
    transferCount: commuteTime.transfer_count,
    sourceName: commuteTime.source_name,
    sourceRef: commuteTime.source_ref,
    queryDatetime: commuteTime.query_datetime,
    confidenceLevel: commuteTime.confidence_level,
    fetchedAt: commuteTime.fetched_at,
    distanceMeters: metadata?.distanceMeters ?? null,
    walkDistanceMeters: metadata?.walkDistanceMeters ?? null,
    fareKrw: metadata?.fareKrw ?? null,
    expiresAt,
    routeSteps: metadata?.routeSteps ?? [],
    isExpired: expiresAt ? Date.parse(expiresAt) <= Date.now() : false,
  };
}

function emptyAccessSummary() {
  return {
    yeouido_station: { transit: null, driving: null },
    gangnam_station: { transit: null, driving: null },
  } satisfies CommuteAccessSummary;
}

function compareCommuteFreshness(
  left: CommuteSummary,
  right: CommuteSummary,
) {
  const leftFreshness = left.fetchedAt ?? left.queryDatetime ?? "";
  const rightFreshness = right.fetchedAt ?? right.queryDatetime ?? "";

  return leftFreshness.localeCompare(rightFreshness);
}
