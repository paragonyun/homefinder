import type { ApartmentStatus } from "@/types/apartment";

export type NeighborhoodRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  city: string | null;
  district: string | null;
  dong: string | null;
  center_lat: number | null;
  center_lng: number | null;
  created_at: string;
  updated_at: string;
};

export type ApartmentRowData = {
  id: string;
  user_id: string;
  neighborhood_id: string | null;
  name: string;
  display_name: string | null;
  address: string | null;
  road_address: string | null;
  lat: number | null;
  lng: number | null;
  lawd_cd: string | null;
  kapt_code: string | null;
  kb_url: string | null;
  naver_land_url: string | null;
  status: ApartmentStatus;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type ApartmentTransactionRow = {
  id: string;
  user_id: string;
  apartment_id: string;
  raw_api_response_id: string | null;
  source_name: string;
  source_ref: string | null;
  source_hash: string;
  deal_year: number;
  deal_month: number;
  deal_day: number;
  deal_date: string;
  exclusive_area_m2: number;
  floor: number | null;
  deal_amount_krw: number;
  deal_amount_manwon: number;
  apartment_name_from_source: string | null;
  address_from_source: string | null;
  cancel_yn: string | null;
  cancel_date: string | null;
  confidence_level: "high" | "medium" | "low" | "manual" | "unknown";
  fetched_at: string;
  created_at: string;
  updated_at: string;
};

export type FieldNoteRow = {
  id: string;
  user_id: string;
  apartment_id: string;
  visit_date: string | null;
  visit_time: string | null;
  weather: string | null;
  overall_rating: number | null;
  good_points: string | null;
  bad_points: string | null;
  overall_memo: string | null;
  created_at: string;
  updated_at: string;
};
