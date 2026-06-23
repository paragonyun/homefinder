import type { ApartmentStatus } from "../../types/apartment";

export type DashboardMapApartmentInput = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  status: ApartmentStatus;
  latestPriceKrw: number | null;
  latestDealDate: string | null;
  gangnamMinutes: number | null;
  yeouidoMinutes: number | null;
  score: number;
};

export type DashboardMapPin = DashboardMapApartmentInput & {
  lat: number;
  lng: number;
};

export type DashboardMapViewport = {
  centerLat: number;
  centerLng: number;
  zoom: number;
};

const seoulFallbackViewport: DashboardMapViewport = {
  centerLat: 37.5665,
  centerLng: 126.978,
  zoom: 11,
};

export function getDashboardMapPins(
  apartments: DashboardMapApartmentInput[],
): DashboardMapPin[] {
  return apartments.filter((apartment): apartment is DashboardMapPin =>
    isFiniteCoordinate(apartment.lat, apartment.lng),
  );
}

export function calculateDashboardMapViewport(
  pins: DashboardMapPin[],
): DashboardMapViewport {
  if (pins.length === 0) {
    return seoulFallbackViewport;
  }

  const latitudes = pins.map((pin) => pin.lat);
  const longitudes = pins.map((pin) => pin.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const largestSpan = Math.max(latSpan, lngSpan);

  return {
    centerLat: (minLat + maxLat) / 2,
    centerLng: (minLng + maxLng) / 2,
    zoom: getZoomForSpan(largestSpan),
  };
}

export function shouldStartDashboardMapDrag({
  button,
  targetIsInteractive,
}: {
  button: number;
  targetIsInteractive: boolean;
}) {
  return button === 0 && !targetIsInteractive;
}

function isFiniteCoordinate(
  lat: number | null,
  lng: number | null,
): lat is number {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
  );
}

function getZoomForSpan(span: number) {
  if (span <= 0.01) {
    return 14;
  }

  if (span <= 0.04) {
    return 13;
  }

  if (span <= 0.09) {
    return 12;
  }

  if (span <= 0.22) {
    return 11;
  }

  return 10;
}
