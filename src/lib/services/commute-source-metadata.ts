import type { CommuteSourceMetadata } from "@/types/commute";

const COMMUTE_SOURCE_METADATA_PREFIX = "homefinder:tmap-commute-cache:v1:";

export function encodeCommuteSourceMetadata(
  metadata: CommuteSourceMetadata,
) {
  return `${COMMUTE_SOURCE_METADATA_PREFIX}${JSON.stringify(metadata)}`;
}

export function decodeCommuteSourceMetadata(
  value: string | null,
): CommuteSourceMetadata | null {
  if (!value?.startsWith(COMMUTE_SOURCE_METADATA_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      value.slice(COMMUTE_SOURCE_METADATA_PREFIX.length),
    ) as Partial<CommuteSourceMetadata>;

    if (
      parsed.version !== 1 ||
      parsed.provider !== "tmap" ||
      typeof parsed.expiresAt !== "string" ||
      !Array.isArray(parsed.routeSteps)
    ) {
      return null;
    }

    return {
      version: 1,
      provider: "tmap",
      distanceMeters: toNullableNumber(parsed.distanceMeters),
      walkDistanceMeters: toNullableNumber(parsed.walkDistanceMeters),
      fareKrw: toNullableNumber(parsed.fareKrw),
      expiresAt: parsed.expiresAt,
      routeSteps: parsed.routeSteps,
    };
  } catch {
    return null;
  }
}

function toNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
