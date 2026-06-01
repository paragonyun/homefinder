import type { SchoolType } from "../data-providers/neis-schools";

export type SchoolAccessSchool = {
  id: string;
  school_type: SchoolType;
  lat: number | null;
  lng: number | null;
};

export type ApartmentSchoolAccessPayload = {
  user_id: string;
  apartment_id: string;
  school_id: string;
  school_type: SchoolType;
  distance_meters: number | null;
  walk_minutes: number | null;
  is_nearest_by_type: boolean;
  source_name: string;
  source_ref: string | null;
  confidence_level: "high" | "medium" | "low" | "manual" | "unknown";
  fetched_at: string;
};

export function resolveSchoolSearchRegion(
  addresses: Array<string | null | undefined>,
) {
  for (const address of addresses) {
    const text = address?.trim();

    if (!text) {
      continue;
    }

    const regionName = extractRegionName(text);
    const districtName = extractDistrictName(text);

    if (regionName || districtName) {
      return { regionName, districtName };
    }
  }

  return { regionName: null, districtName: null };
}

export function buildApartmentSchoolAccessRows({
  apartmentId,
  apartmentLat,
  apartmentLng,
  fetchedAt,
  schools,
  sourceName,
  sourceRef = null,
  userId,
}: {
  apartmentId: string;
  apartmentLat: number | null;
  apartmentLng: number | null;
  fetchedAt: string;
  schools: SchoolAccessSchool[];
  sourceName: string;
  sourceRef?: string | null;
  userId: string;
}): ApartmentSchoolAccessPayload[] {
  const rows = schools
    .filter((school) => school.school_type !== "unknown")
    .map((school) => {
      const distanceMeters =
        apartmentLat !== null &&
        apartmentLng !== null &&
        school.lat !== null &&
        school.lng !== null
          ? Math.round(
              getDistanceMeters({
                fromLat: apartmentLat,
                fromLng: apartmentLng,
                toLat: school.lat,
                toLng: school.lng,
              }),
            )
          : null;

      return {
        user_id: userId,
        apartment_id: apartmentId,
        school_id: school.id,
        school_type: school.school_type,
        distance_meters: distanceMeters,
        walk_minutes:
          distanceMeters !== null ? Math.max(1, Math.round(distanceMeters / 67)) : null,
        is_nearest_by_type: false,
        source_name: sourceName,
        source_ref: sourceRef,
        confidence_level: distanceMeters !== null ? ("high" as const) : ("medium" as const),
        fetched_at: fetchedAt,
      };
    })
    .sort(
      (left, right) =>
        left.school_type.localeCompare(right.school_type) ||
        (left.distance_meters ?? Number.POSITIVE_INFINITY) -
          (right.distance_meters ?? Number.POSITIVE_INFINITY),
    );

  const nearestTypes = new Set<SchoolType>();

  return rows.map((row) => {
    if (row.distance_meters !== null && !nearestTypes.has(row.school_type)) {
      nearestTypes.add(row.school_type);
      return { ...row, is_nearest_by_type: true };
    }

    return row;
  });
}

export function filterSchoolsByDistrict<T extends { roadAddress?: string | null; address?: string | null }>(
  schools: T[],
  districtName: string | null,
) {
  if (!districtName) {
    return schools;
  }

  return schools.filter((school) =>
    [school.roadAddress, school.address].some((address) =>
      address?.includes(districtName),
    ),
  );
}

function extractRegionName(address: string) {
  if (address.startsWith("서울 ")) {
    return "서울특별시";
  }

  if (address.startsWith("부산 ")) {
    return "부산광역시";
  }

  if (address.startsWith("대구 ")) {
    return "대구광역시";
  }

  if (address.startsWith("인천 ")) {
    return "인천광역시";
  }

  if (address.startsWith("광주 ")) {
    return "광주광역시";
  }

  if (address.startsWith("대전 ")) {
    return "대전광역시";
  }

  if (address.startsWith("울산 ")) {
    return "울산광역시";
  }

  if (address.startsWith("세종 ")) {
    return "세종특별자치시";
  }

  return (
    address.match(
      /(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|[가-힣]+도|[가-힣]+특별자치도)/,
    )?.[1] ?? null
  );
}

function extractDistrictName(address: string) {
  return (
    address
      .split(/\s+/)
      .find(
        (token) =>
          /[가-힣]+(?:구|군|시)$/.test(token) &&
          !token.endsWith("특별시") &&
          !token.endsWith("광역시") &&
          !token.endsWith("자치시"),
      ) ?? null
  );
}

function getDistanceMeters({
  fromLat,
  fromLng,
  toLat,
  toLng,
}: {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}) {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
