import { NextResponse } from "next/server";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import {
  fetchTmapDrivingRoute,
  fetchTmapTransitRoute,
  geocodeAddressWithTmap,
  getNextWeekday0730SearchDttm,
  type TmapCommuteResult,
} from "@/lib/data-providers/tmap-commute";
import { encodeCommuteSourceMetadata } from "@/lib/services/commute-source-metadata";
import {
  createSupabaseRouteClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/server";
import { defaultCommuteDestinations } from "@/types/commute";
import type {
  CommuteDestinationKey,
  CommuteTransportType,
} from "@/types/commute";

type ApartmentRouteRow = {
  id: string;
  user_id: string;
  name: string;
  display_name: string | null;
  address: string | null;
  road_address: string | null;
  lat: number | null;
  lng: number | null;
};

type CommuteRefreshError = {
  destinationKey: CommuteDestinationKey;
  transportType: Extract<CommuteTransportType, "transit" | "driving">;
  error: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const transitApiKey = process.env.TMAP_TRANSIT_API_KEY ?? process.env.TMAP_API_KEY;
  const drivingApiKey = process.env.TMAP_DRIVING_API_KEY ?? process.env.TMAP_API_KEY;
  const geocodeApiKey = process.env.TMAP_API_KEY ?? drivingApiKey ?? transitApiKey;

  if (!transitApiKey || !drivingApiKey || !geocodeApiKey) {
    return NextResponse.json(
      { error: "TMAP_API_KEY가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = createSupabaseRouteClient(accessToken);

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase 연결을 만들 수 없습니다." },
      { status: 503 },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (!isAdminRole(getRoleFromAppMetadata(user.app_metadata))) {
    return NextResponse.json(
      { error: "접근성 자동 조회는 운영자만 실행할 수 있습니다." },
      { status: 403 },
    );
  }

  const { id: apartmentId } = await context.params;
  const { data: apartment, error: apartmentError } = await supabase
    .from("apartments")
    .select("id,user_id,name,display_name,address,road_address,lat,lng")
    .eq("id", apartmentId)
    .maybeSingle();

  if (apartmentError) {
    return NextResponse.json({ error: apartmentError.message }, { status: 500 });
  }

  if (!apartment) {
    return NextResponse.json({ error: "단지를 찾을 수 없습니다." }, { status: 404 });
  }

  let startCoordinate;

  try {
    startCoordinate = await resolveApartmentCoordinate(
      apartment as ApartmentRouteRow,
      geocodeApiKey,
    );
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }

  if (apartment.lat === null || apartment.lng === null) {
    await supabase
      .from("apartments")
      .update({
        lat: startCoordinate.lat,
        lng: startCoordinate.lng,
      })
      .eq("id", apartmentId);
  }

  const searchDttm = getNextWeekday0730SearchDttm();
  const fetchedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const payloads = [];
  const errors: CommuteRefreshError[] = [];

  for (const destination of defaultCommuteDestinations) {
    try {
      const result = await fetchTmapTransitRoute({
        apiKey: transitApiKey,
        destination,
        searchDttm,
        start: startCoordinate,
      });

      payloads.push(
        toCommutePayload({
          apartmentId,
          expiresAt,
          fetchedAt,
          result,
          searchDttm,
          userId: user.id,
          destination,
        }),
      );
    } catch (error) {
      errors.push({
        destinationKey: destination.key,
        transportType: "transit",
        error: getErrorMessage(error),
      });
    }

    try {
      const result = await fetchTmapDrivingRoute({
        apiKey: drivingApiKey,
        destination,
        start: startCoordinate,
      });

      payloads.push(
        toCommutePayload({
          apartmentId,
          expiresAt,
          fetchedAt,
          result,
          searchDttm,
          userId: user.id,
          destination,
        }),
      );
    } catch (error) {
      errors.push({
        destinationKey: destination.key,
        transportType: "driving",
        error: getErrorMessage(error),
      });
    }
  }

  if (payloads.length === 0) {
    return NextResponse.json(
      {
        error:
          errors[0]?.error ??
          "TMAP 접근성 조회 결과를 저장할 수 없습니다.",
        errors,
      },
      { status: 502 },
    );
  }

  const { error: upsertError } = await supabase
    .from("commute_times")
    .upsert(payloads, {
      onConflict: "apartment_id,destination_key,transport_type",
    });

  if (upsertError) {
    if (isMissingTableError(upsertError)) {
      return NextResponse.json(
        { error: "commute_times migration이 적용되지 않았습니다." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    synced: true,
    savedCount: payloads.length,
    errors,
    searchDttm,
    fetchedAt,
    expiresAt,
  });
}

async function resolveApartmentCoordinate(
  apartment: ApartmentRouteRow,
  apiKey: string,
) {
  if (apartment.lat !== null && apartment.lng !== null) {
    return { lat: Number(apartment.lat), lng: Number(apartment.lng) };
  }

  const address = apartment.road_address ?? apartment.address;

  if (!address) {
    throw new Error("접근성 조회를 위해 단지 주소 또는 좌표가 필요합니다.");
  }

  return geocodeAddressWithTmap({ address, apiKey });
}

function toCommutePayload({
  apartmentId,
  destination,
  expiresAt,
  fetchedAt,
  result,
  searchDttm,
  userId,
}: {
  apartmentId: string;
  destination: (typeof defaultCommuteDestinations)[number];
  expiresAt: string;
  fetchedAt: string;
  result: TmapCommuteResult;
  searchDttm: string;
  userId: string;
}) {
  return {
    user_id: userId,
    apartment_id: apartmentId,
    destination_key: destination.key,
    destination_name: destination.name,
    destination_lat: destination.lat,
    destination_lng: destination.lng,
    transport_type: result.transportType,
    duration_minutes: result.durationMinutes,
    transfer_count: result.transferCount,
    source_name:
      result.transportType === "transit" ? "tmap-transit" : "tmap-driving",
    source_ref: encodeCommuteSourceMetadata({
      version: 1,
      provider: "tmap",
      distanceMeters: result.distanceMeters,
      walkDistanceMeters: result.walkDistanceMeters,
      fareKrw: result.fareKrw,
      expiresAt,
      routeSteps: result.routeSteps,
    }),
    query_datetime: formatSearchDttmAsIso(searchDttm),
    confidence_level: "high",
    fetched_at: fetchedAt,
  };
}

function formatSearchDttmAsIso(value: string) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(
    8,
    10,
  )}:${value.slice(10, 12)}:00+09:00`;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "접근성 조회에 실패했습니다.";
}

function isMissingTableError(error: { code?: string }) {
  return error.code === "42P01" || error.code === "PGRST205";
}
