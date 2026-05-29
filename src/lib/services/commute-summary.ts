import {
  commuteDestinationKeys,
  defaultCommuteDestinations,
  type CommuteDestinationKey,
} from "../../types/commute";

export type CommuteTimeLike = {
  apartment_id: string;
  destination_key: CommuteDestinationKey;
  destination_name: string | null;
  transport_type: "transit" | "walking" | "driving";
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
  durationMinutes: number;
  transferCount: number | null;
  sourceName: string | null;
  sourceRef: string | null;
  queryDatetime: string | null;
  confidenceLevel: "high" | "medium" | "low" | "manual" | "unknown";
  fetchedAt: string | null;
};

export function buildCommuteSummaryByApartment(
  commuteTimes: CommuteTimeLike[],
) {
  const summaries = new Map<
    string,
    Record<CommuteDestinationKey, CommuteSummary | null>
  >();

  for (const commuteTime of commuteTimes) {
    if (!commuteDestinationKeys.includes(commuteTime.destination_key)) {
      continue;
    }

    const summary = toCommuteSummary(commuteTime);

    if (!summary) {
      continue;
    }

    const current = summaries.get(commuteTime.apartment_id) ?? emptySummary();
    const previous = current[commuteTime.destination_key];

    if (!previous || compareCommuteFreshness(summary, previous) > 0) {
      current[commuteTime.destination_key] = summary;
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
  if (
    commuteTime.transport_type !== "transit" ||
    commuteTime.duration_minutes === null
  ) {
    return null;
  }

  return {
    destinationKey: commuteTime.destination_key,
    destinationName:
      commuteTime.destination_name ??
      getDefaultDestinationName(commuteTime.destination_key),
    durationMinutes: commuteTime.duration_minutes,
    transferCount: commuteTime.transfer_count,
    sourceName: commuteTime.source_name,
    sourceRef: commuteTime.source_ref,
    queryDatetime: commuteTime.query_datetime,
    confidenceLevel: commuteTime.confidence_level,
    fetchedAt: commuteTime.fetched_at,
  };
}

function emptySummary() {
  return {
    yeouido_station: null,
    gangnam_station: null,
  } satisfies Record<CommuteDestinationKey, CommuteSummary | null>;
}

function compareCommuteFreshness(
  left: CommuteSummary,
  right: CommuteSummary,
) {
  const leftFreshness = left.fetchedAt ?? left.queryDatetime ?? "";
  const rightFreshness = right.fetchedAt ?? right.queryDatetime ?? "";

  return leftFreshness.localeCompare(rightFreshness);
}
