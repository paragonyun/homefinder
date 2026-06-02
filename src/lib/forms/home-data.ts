import type { ApartmentStatus } from "@/types/apartment";
import {
  commuteDestinationKeys,
  defaultCommuteDestinations,
  type CommuteDestinationKey,
} from "../../types/commute";

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export const apartmentStatusValues = [
  "candidate",
  "interested",
  "visit_planned",
  "visited",
  "on_hold",
  "excluded",
] as const satisfies readonly ApartmentStatus[];

const apartmentStatusSet = new Set<string>(apartmentStatusValues);

function cleanText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanRequiredText(value: unknown) {
  return cleanText(value);
}

function normalizeLawdCd(value: unknown) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  if (/^\d{5}$/.test(text)) {
    return text;
  }

  if (/^\d{10}$/.test(text)) {
    return text;
  }

  return undefined;
}

function cleanRating(value: unknown): ValidationResult<number | null> {
  const text = cleanText(value);

  if (!text) {
    return { ok: true, value: null };
  }

  const rating = Number(text);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "평점은 1에서 5 사이로 입력하세요." };
  }

  return { ok: true, value: rating };
}

function cleanOptionalInteger(
  value: unknown,
  label: string,
  min: number,
  max: number,
): ValidationResult<number | null> {
  const text = cleanText(value);

  if (!text) {
    return { ok: true, value: null };
  }

  const number = Number(text);

  if (!Number.isInteger(number) || number < min || number > max) {
    return {
      ok: false,
      error: `${formatKoreanTopic(label)} ${min}에서 ${max} 사이의 정수로 입력하세요.`,
    };
  }

  return { ok: true, value: number };
}

function formatKoreanTopic(label: string) {
  return label.endsWith("수") ? `${label}는` : `${label}은`;
}

export type NeighborhoodInput = {
  name?: unknown;
  description?: unknown;
  city?: unknown;
  district?: unknown;
  dong?: unknown;
};

export type NeighborhoodPayload = {
  name: string;
  description: string | null;
  city: string | null;
  district: string | null;
  dong: string | null;
};

export function validateNeighborhoodInput(
  input: NeighborhoodInput,
): ValidationResult<NeighborhoodPayload> {
  const name = cleanRequiredText(input.name);

  if (!name) {
    return { ok: false, error: "동네명을 입력하세요." };
  }

  return {
    ok: true,
    value: {
      name,
      description: cleanText(input.description),
      city: cleanText(input.city),
      district: cleanText(input.district),
      dong: cleanText(input.dong),
    },
  };
}

export type ApartmentInput = {
  name?: unknown;
  neighborhoodId?: unknown;
  address?: unknown;
  roadAddress?: unknown;
  lawdCd?: unknown;
  kaptCode?: unknown;
  status?: unknown;
  memo?: unknown;
  kbUrl?: unknown;
  naverLandUrl?: unknown;
};

export type ApartmentPayload = {
  name: string;
  neighborhood_id: string | null;
  address: string | null;
  road_address: string | null;
  lawd_cd: string | null;
  kapt_code: string | null;
  status: ApartmentStatus;
  memo: string | null;
  kb_url: string | null;
  naver_land_url: string | null;
};

export function validateApartmentInput(
  input: ApartmentInput,
): ValidationResult<ApartmentPayload> {
  const name = cleanRequiredText(input.name);

  if (!name) {
    return { ok: false, error: "단지명을 입력하세요." };
  }

  const status = cleanText(input.status) ?? "candidate";

  if (!apartmentStatusSet.has(status)) {
    return { ok: false, error: "알 수 없는 단지 상태입니다." };
  }

  const lawdCd = normalizeLawdCd(input.lawdCd);

  if (lawdCd === undefined) {
    return { ok: false, error: "법정동코드는 5자리 또는 10자리 숫자로 입력하세요." };
  }

  return {
    ok: true,
    value: {
      name,
      neighborhood_id: cleanText(input.neighborhoodId),
      address: cleanText(input.address),
      road_address: cleanText(input.roadAddress),
      lawd_cd: lawdCd,
      kapt_code: cleanText(input.kaptCode),
      status: status as ApartmentStatus,
      memo: cleanText(input.memo),
      kb_url: cleanText(input.kbUrl),
      naver_land_url: cleanText(input.naverLandUrl),
    },
  };
}

export type FieldNoteInput = {
  apartmentId?: unknown;
  visitDate?: unknown;
  visitTime?: unknown;
  weather?: unknown;
  stationWalkRating?: unknown;
  slopeRating?: unknown;
  complexConditionRating?: unknown;
  parkingRating?: unknown;
  noiseRating?: unknown;
  nightMoodRating?: unknown;
  commercialAreaRating?: unknown;
  overallRating?: unknown;
  goodPoints?: unknown;
  badPoints?: unknown;
  parkingNote?: unknown;
  noiseNote?: unknown;
  slopeNote?: unknown;
  overallMemo?: unknown;
  revisitIntention?: unknown;
};

export type FieldNotePayload = {
  apartment_id: string;
  visit_date: string | null;
  visit_time: string | null;
  weather: string | null;
  station_walk_rating: number | null;
  slope_rating: number | null;
  complex_condition_rating: number | null;
  parking_rating: number | null;
  noise_rating: number | null;
  night_mood_rating: number | null;
  commercial_area_rating: number | null;
  overall_rating: number | null;
  good_points: string | null;
  bad_points: string | null;
  parking_note: string | null;
  noise_note: string | null;
  slope_note: string | null;
  overall_memo: string | null;
  revisit_intention: string | null;
};

export function validateFieldNoteInput(
  input: FieldNoteInput,
): ValidationResult<FieldNotePayload> {
  const apartmentId = cleanRequiredText(input.apartmentId);

  if (!apartmentId) {
    return { ok: false, error: "단지 정보가 필요합니다." };
  }

  const rating = cleanRating(input.overallRating);

  if (!rating.ok) {
    return rating;
  }

  const stationWalkRating = cleanOptionalInteger(input.stationWalkRating, "역 도보 체감", 1, 5);
  if (!stationWalkRating.ok) {
    return stationWalkRating;
  }

  const slopeRating = cleanOptionalInteger(input.slopeRating, "경사 체감", 1, 5);
  if (!slopeRating.ok) {
    return slopeRating;
  }

  const complexConditionRating = cleanOptionalInteger(
    input.complexConditionRating,
    "단지 관리상태",
    1,
    5,
  );
  if (!complexConditionRating.ok) {
    return complexConditionRating;
  }

  const parkingRating = cleanOptionalInteger(input.parkingRating, "주차 체감", 1, 5);
  if (!parkingRating.ok) {
    return parkingRating;
  }

  const noiseRating = cleanOptionalInteger(input.noiseRating, "소음 체감", 1, 5);
  if (!noiseRating.ok) {
    return noiseRating;
  }

  const nightMoodRating = cleanOptionalInteger(input.nightMoodRating, "야간 분위기", 1, 5);
  if (!nightMoodRating.ok) {
    return nightMoodRating;
  }

  const commercialAreaRating = cleanOptionalInteger(
    input.commercialAreaRating,
    "생활편의 체감",
    1,
    5,
  );
  if (!commercialAreaRating.ok) {
    return commercialAreaRating;
  }

  return {
    ok: true,
    value: {
      apartment_id: apartmentId,
      visit_date: cleanText(input.visitDate),
      visit_time: cleanText(input.visitTime),
      weather: cleanText(input.weather),
      station_walk_rating: stationWalkRating.value,
      slope_rating: slopeRating.value,
      complex_condition_rating: complexConditionRating.value,
      parking_rating: parkingRating.value,
      noise_rating: noiseRating.value,
      night_mood_rating: nightMoodRating.value,
      commercial_area_rating: commercialAreaRating.value,
      overall_rating: rating.value,
      good_points: cleanText(input.goodPoints),
      bad_points: cleanText(input.badPoints),
      parking_note: cleanText(input.parkingNote),
      noise_note: cleanText(input.noiseNote),
      slope_note: cleanText(input.slopeNote),
      overall_memo: cleanText(input.overallMemo),
      revisit_intention: cleanText(input.revisitIntention),
    },
  };
}

export type CommuteTimeInput = {
  apartmentId?: unknown;
  destinationKey?: unknown;
  durationMinutes?: unknown;
  transferCount?: unknown;
};

export type CommuteTimePayload = {
  apartment_id: string;
  destination_key: CommuteDestinationKey;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  transport_type: "transit";
  duration_minutes: number;
  transfer_count: number | null;
  source_name: "manual";
  source_ref: null;
  query_datetime: null;
  confidence_level: "manual";
};

export function validateCommuteTimeInput(
  input: CommuteTimeInput,
): ValidationResult<CommuteTimePayload | null> {
  const apartmentId = cleanRequiredText(input.apartmentId);

  if (!apartmentId) {
    return { ok: false, error: "단지 정보가 필요합니다." };
  }

  const destinationKey = cleanText(input.destinationKey);

  if (!isCommuteDestinationKey(destinationKey)) {
    return { ok: false, error: "알 수 없는 접근성 목적지입니다." };
  }

  const duration = cleanOptionalInteger(input.durationMinutes, "소요시간", 1, 300);

  if (!duration.ok) {
    return duration;
  }

  const transferCount = cleanOptionalInteger(input.transferCount, "환승 수", 0, 10);

  if (!transferCount.ok) {
    return transferCount;
  }

  if (duration.value === null) {
    if (transferCount.value !== null) {
      return { ok: false, error: "환승 수를 저장하려면 소요시간을 입력하세요." };
    }

    return { ok: true, value: null };
  }

  const destination = defaultCommuteDestinations.find(
    (item) => item.key === destinationKey,
  );

  if (!destination) {
    return { ok: false, error: "알 수 없는 접근성 목적지입니다." };
  }

  return {
    ok: true,
    value: {
      apartment_id: apartmentId,
      destination_key: destinationKey,
      destination_name: destination.name,
      destination_lat: destination.lat,
      destination_lng: destination.lng,
      transport_type: "transit",
      duration_minutes: duration.value,
      transfer_count: transferCount.value,
      source_name: "manual",
      source_ref: null,
      query_datetime: null,
      confidence_level: "manual",
    },
  };
}

function isCommuteDestinationKey(
  value: string | null,
): value is CommuteDestinationKey {
  return (
    value !== null &&
    commuteDestinationKeys.includes(value as CommuteDestinationKey)
  );
}
