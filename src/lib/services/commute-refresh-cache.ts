import {
  commuteDestinationKeys,
  type CommuteDestinationKey,
} from "../../types/commute";
import { decodeCommuteSourceMetadata } from "./commute-source-metadata";

type CacheTransportType = "transit" | "driving";

export type CommuteCacheRow = {
  id?: string;
  apartment_id: string;
  destination_key: CommuteDestinationKey;
  transport_type: "transit" | "walking" | "driving";
  duration_minutes: number | null;
  source_ref: string | null;
  fetched_at: string | null;
};

type RequiredCacheKey = `${CommuteDestinationKey}:${CacheTransportType}`;

export type FreshTmapCommuteCacheResult =
  | {
      cached: true;
      expiresAt: string;
      fetchedAt: string | null;
      rows: CommuteCacheRow[];
      missingKeys: [];
    }
  | {
      cached: false;
      expiresAt: null;
      fetchedAt: null;
      rows: [];
      missingKeys: RequiredCacheKey[];
    };

const cacheTransportTypes = ["transit", "driving"] as const;

export function findFreshTmapCommuteCache(
  rows: CommuteCacheRow[],
  now = new Date(),
): FreshTmapCommuteCacheResult {
  const latestFreshByKey = new Map<RequiredCacheKey, CommuteCacheRow>();
  const nowTime = now.getTime();

  for (const row of rows) {
    if (row.transport_type !== "transit" && row.transport_type !== "driving") {
      continue;
    }

    if (row.duration_minutes === null) {
      continue;
    }

    const metadata = decodeCommuteSourceMetadata(row.source_ref);
    const expiresAtTime = metadata?.expiresAt
      ? Date.parse(metadata.expiresAt)
      : Number.NaN;

    if (!Number.isFinite(expiresAtTime) || expiresAtTime <= nowTime) {
      continue;
    }

    const key = toCacheKey(row.destination_key, row.transport_type);
    const current = latestFreshByKey.get(key);

    if (!current || compareFetchedAt(row, current) > 0) {
      latestFreshByKey.set(key, row);
    }
  }

  const missingKeys = getRequiredCacheKeys().filter(
    (key) => !latestFreshByKey.has(key),
  );

  if (missingKeys.length > 0) {
    return {
      cached: false,
      expiresAt: null,
      fetchedAt: null,
      rows: [],
      missingKeys,
    };
  }

  const freshRows = getRequiredCacheKeys().map((key) => latestFreshByKey.get(key)!);
  const expiresAt = freshRows.reduce<string | null>((earliest, row) => {
    const rowExpiresAt = decodeCommuteSourceMetadata(row.source_ref)?.expiresAt;

    if (!rowExpiresAt) {
      return earliest;
    }

    return !earliest || rowExpiresAt < earliest ? rowExpiresAt : earliest;
  }, null);
  const fetchedAt = freshRows.reduce<string | null>(
    (latest, row) =>
      row.fetched_at && (!latest || row.fetched_at > latest)
        ? row.fetched_at
        : latest,
    null,
  );

  return {
    cached: true,
    expiresAt: expiresAt ?? new Date(nowTime).toISOString(),
    fetchedAt,
    rows: freshRows,
    missingKeys: [],
  };
}

function getRequiredCacheKeys(): RequiredCacheKey[] {
  return commuteDestinationKeys.flatMap((destinationKey) =>
    cacheTransportTypes.map((transportType) =>
      toCacheKey(destinationKey, transportType),
    ),
  );
}

function toCacheKey(
  destinationKey: CommuteDestinationKey,
  transportType: CacheTransportType,
): RequiredCacheKey {
  return `${destinationKey}:${transportType}`;
}

function compareFetchedAt(left: CommuteCacheRow, right: CommuteCacheRow) {
  return (left.fetched_at ?? "").localeCompare(right.fetched_at ?? "");
}
