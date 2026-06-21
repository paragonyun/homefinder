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

export type ApartmentBasicInfoRow = {
  id: string;
  user_id: string;
  apartment_id: string;
  raw_api_response_id: string | null;
  source_name: string;
  source_ref: string | null;
  kapt_code: string | null;
  kapt_name_from_source: string | null;
  legal_address_from_source: string | null;
  road_address_from_source: string | null;
  household_count: number | null;
  building_count: number | null;
  approval_date: string | null;
  heating_type: string | null;
  management_type: string | null;
  sale_type: string | null;
  parking_count: number | null;
  elevator_count: number | null;
  gross_floor_area_m2: number | null;
  confidence_level: "high" | "medium" | "low" | "manual" | "unknown";
  fetched_at: string;
  created_at: string;
  updated_at: string;
};

export type ApartmentBuildingInfoRow = {
  id: string;
  user_id: string;
  apartment_id: string;
  raw_api_response_id: string | null;
  source_name: string;
  source_ref: string | null;
  legal_address_from_source: string | null;
  road_address_from_source: string | null;
  land_area_m2: number | null;
  building_area_m2: number | null;
  gross_floor_area_m2: number | null;
  floor_area_ratio: number | null;
  building_coverage_ratio: number | null;
  main_use: string | null;
  highest_floor: number | null;
  lowest_floor: number | null;
  structure_type: string | null;
  confidence_level: "high" | "medium" | "low" | "manual" | "unknown";
  fetched_at: string;
  created_at: string;
  updated_at: string;
};

export type CommuteTimeRow = {
  id: string;
  user_id: string;
  apartment_id: string;
  destination_key: "yeouido_station" | "gangnam_station";
  destination_name: string;
  destination_lat: number | null;
  destination_lng: number | null;
  transport_type: "transit" | "walking" | "driving";
  duration_minutes: number | null;
  transfer_count: number | null;
  source_name: string;
  source_ref: string | null;
  query_datetime: string | null;
  confidence_level: "high" | "medium" | "low" | "manual" | "unknown";
  fetched_at: string;
  created_at: string;
  updated_at: string;
};

export type SchoolRow = {
  id: string;
  user_id: string;
  source_name: string;
  source_ref: string | null;
  school_code: string;
  office_code: string | null;
  office_name: string | null;
  school_name: string;
  school_type: "elementary" | "middle" | "high" | "unknown";
  school_kind_name: string | null;
  region_name: string | null;
  district_office_name: string | null;
  address: string | null;
  road_address: string | null;
  homepage_url: string | null;
  phone: string | null;
  coeducation_type: string | null;
  founded_date: string | null;
  lat: number | null;
  lng: number | null;
  confidence_level: "high" | "medium" | "low" | "manual" | "unknown";
  fetched_at: string;
  created_at: string;
  updated_at: string;
};

export type ApartmentSchoolAccessRow = {
  id: string;
  user_id: string;
  apartment_id: string;
  school_id: string;
  school_type: "elementary" | "middle" | "high" | "unknown";
  distance_meters: number | null;
  walk_minutes: number | null;
  is_nearest_by_type: boolean;
  source_name: string;
  source_ref: string | null;
  confidence_level: "high" | "medium" | "low" | "manual" | "unknown";
  fetched_at: string;
  created_at: string;
  updated_at: string;
};

export type ApartmentAliasRow = {
  id: string;
  user_id: string;
  apartment_id: string;
  alias: string;
  source: string | null;
  created_at: string;
};

export type FieldNoteRow = {
  id: string;
  user_id: string;
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
  created_at: string;
  updated_at: string;
};

export type FieldNotePhotoRow = {
  id: string;
  user_id: string;
  apartment_id: string;
  field_note_id: string;
  storage_bucket: string;
  storage_path: string;
  original_file_name: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  caption: string | null;
  created_at: string;
  updated_at: string;
};
