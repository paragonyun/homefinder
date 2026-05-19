import type { ApartmentStatus } from "@/types/apartment";

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
    return text.slice(0, 5);
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
  overallRating?: unknown;
  goodPoints?: unknown;
  badPoints?: unknown;
  overallMemo?: unknown;
};

export type FieldNotePayload = {
  apartment_id: string;
  visit_date: string | null;
  visit_time: string | null;
  weather: string | null;
  overall_rating: number | null;
  good_points: string | null;
  bad_points: string | null;
  overall_memo: string | null;
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

  return {
    ok: true,
    value: {
      apartment_id: apartmentId,
      visit_date: cleanText(input.visitDate),
      visit_time: cleanText(input.visitTime),
      weather: cleanText(input.weather),
      overall_rating: rating.value,
      good_points: cleanText(input.goodPoints),
      bad_points: cleanText(input.badPoints),
      overall_memo: cleanText(input.overallMemo),
    },
  };
}
