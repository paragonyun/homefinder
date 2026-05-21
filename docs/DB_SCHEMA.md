# DB Schema

Supabase PostgreSQL 기준 초안입니다. 실제 초기 migration은 `supabase/migrations/20260518000100_initial_core.sql`에 있고, 운영자 제한 정책은 `supabase/migrations/20260519000100_admin_only_core_mutations.sql`에 있습니다.

## 공통 원칙

- 모든 사용자 소유 데이터는 `user_id`를 둡니다.
- 주요 외부 데이터에는 `source_name`, `source_ref`, `fetched_at`, `confidence_level`을 둡니다.
- 원천 응답은 `raw_api_responses`에 저장하고, 화면용 데이터는 별도 테이블에 저장합니다.
- 가격/실거래가 자체를 수동으로 덮어쓰는 기능은 MVP에서 만들지 않습니다.

## Enums

```sql
create type apartment_status as enum (
  'candidate',
  'interested',
  'visit_planned',
  'visited',
  'on_hold',
  'excluded'
);

create type confidence_level as enum (
  'high',
  'medium',
  'low',
  'manual',
  'unknown'
);
```

## Core Tables

### users

Supabase Auth 사용자 보조 프로필입니다.

- `id uuid primary key`
- `email text unique`
- `name text`
- `created_at timestamptz`
- `updated_at timestamptz`

### neighborhoods

- `id uuid primary key`
- `user_id uuid references users(id)`
- `name text not null`
- `description text`
- `city text`
- `district text`
- `dong text`
- `center_lat numeric`
- `center_lng numeric`
- `created_at timestamptz`
- `updated_at timestamptz`

### apartments

- `id uuid primary key`
- `user_id uuid references users(id)`
- `neighborhood_id uuid references neighborhoods(id)`
- `name text not null`
- `display_name text`
- `address text`
- `road_address text`
- `lat numeric`
- `lng numeric`
- `lawd_cd text`
- `kapt_code text`
- `kb_url text`
- `naver_land_url text`
- `status apartment_status`
- `memo text`
- `created_at timestamptz`
- `updated_at timestamptz`

수동 보정 가능 필드는 주소, 법정동코드, K-apt 코드, 좌표, 단지 alias, KB/네이버 참고 링크입니다.

### apartment_aliases

실제 migration: `supabase/migrations/20260520000100_apartment_aliases.sql`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `apartment_id uuid references apartments(id)`
- `alias text not null`
- `source text`
- `created_at timestamptz`

## External Data Tables

### raw_api_responses

- `id uuid primary key`
- `provider text not null`
- `endpoint text`
- `request_hash text`
- `request_params jsonb`
- `response_body jsonb`
- `fetched_at timestamptz`
- `apartment_id uuid references apartments(id)`
- `created_at timestamptz`

### apartment_transactions

- `id uuid primary key`
- `user_id uuid references users(id)`
- `apartment_id uuid references apartments(id)`
- `raw_api_response_id uuid references raw_api_responses(id)`
- `source_hash text`
- `deal_year integer`
- `deal_month integer`
- `deal_day integer`
- `deal_date date`
- `exclusive_area_m2 numeric`
- `floor integer`
- `deal_amount_krw bigint`
- `deal_amount_manwon integer`
- `apartment_name_from_source text`
- `address_from_source text`
- `cancel_yn text`
- `cancel_date date`
- `source_name text`
- `source_ref text`
- `fetched_at timestamptz`
- `confidence_level confidence_level`
- `created_at timestamptz`

중복 방지 기준은 `unique(apartment_id, source_name, source_hash)`입니다. 인덱스 후보:
`apartment_id + deal_date`, `deal_date`.

### apartment_price_snapshots

- `id uuid primary key`
- `apartment_id uuid references apartments(id)`
- `area_bucket text`
- `exclusive_area_min_m2 numeric`
- `exclusive_area_max_m2 numeric`
- `snapshot_date date`
- `avg_price_krw bigint`
- `min_price_krw bigint`
- `max_price_krw bigint`
- `median_price_krw bigint`
- `transaction_count integer`
- `source_name text`
- `source_ref text`
- `fetched_at timestamptz`
- `confidence_level confidence_level`
- `calculated_at timestamptz`

### apartment_basic_info

실제 migration: `supabase/migrations/20260520000200_apartment_basic_info.sql`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `apartment_id uuid references apartments(id)`
- `raw_api_response_id uuid references raw_api_responses(id)`
- `source_name text`
- `source_ref text`
- `kapt_code text`
- `kapt_name_from_source text`
- `legal_address_from_source text`
- `road_address_from_source text`
- `household_count integer`
- `building_count integer`
- `approval_date date`
- `heating_type text`
- `management_type text`
- `sale_type text`
- `parking_count integer`
- `elevator_count integer`
- `gross_floor_area_m2 numeric`
- `confidence_level confidence_level`
- `fetched_at timestamptz`
- `created_at timestamptz`
- `updated_at timestamptz`

### kapt_code_directory

실제 migration: `supabase/migrations/20260521000100_kapt_code_directory.sql`

K-apt 단지 코드 후보 검색용 캐시입니다. 공식 단지 목록 API 결과를 저장하고, `apartments.kapt_code` 확정 전 후보 탐색 인덱스로 사용합니다.

- `kapt_code text primary key`
- `kapt_name text`
- `normalized_kapt_name text`
- `bjd_code text`
- `sido text`
- `sigungu text`
- `eupmyeondong text`
- `ri text`
- `legal_address text`
- `road_address text`
- `source text`
- `source_endpoint text`
- `last_synced_at timestamptz`

### apartment_building_info

- `id uuid primary key`
- `apartment_id uuid references apartments(id)`
- `land_area_m2 numeric`
- `building_area_m2 numeric`
- `gross_floor_area_m2 numeric`
- `floor_area_ratio numeric`
- `building_coverage_ratio numeric`
- `main_use text`
- `highest_floor integer`
- `lowest_floor integer`
- `structure_type text`
- `source_name text`
- `source_ref text`
- `confidence_level confidence_level`
- `fetched_at timestamptz`
- `created_at timestamptz`
- `updated_at timestamptz`

## School / Commute / Notes

### schools

학교 기본정보와 좌표를 저장합니다.

- `source_name text`
- `source_ref text`
- `fetched_at timestamptz`
- `confidence_level confidence_level`

### apartment_school_access

단지와 학교 간 거리, 도보 추정 시간, 가까운 학교 여부를 저장합니다.

### destinations

기본 목적지는 여의도역과 강남역입니다. 사용자가 회사, 부모님 집, 서울역 같은 목적지를 추가할 수 있습니다.

### commute_times

목적지별 대중교통 소요시간, 도보 시간, 환승 횟수, 기준 시각, 출처를 저장합니다.

- `source_name text`
- `source_ref text`
- `query_datetime timestamptz`
- `fetched_at timestamptz`
- `confidence_level confidence_level`

### field_notes / field_note_photos

임장 방문일, 날씨, 체감 거리, 언덕, 주차, 소음, 상권, 장단점, 총평, 사진을 저장합니다. 공식 데이터와 섞지 않습니다.

### decision_reviews

MVP 3의 점수화와 판단 메모를 위한 테이블입니다. 첫 단계에서는 구조만 문서화합니다.

## RLS 방향

- 모든 사용자 데이터는 `user_id = auth.uid()` 조건으로 접근합니다.
- 관심 동네와 관심 단지의 생성/수정/삭제는 `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`인 운영자 계정만 가능합니다.
- 거래/스냅샷 같은 하위 테이블은 `user_id`뿐 아니라 참조하는 `apartment_id`도 현재 사용자 소유인지 확인합니다.
- 공유 기능은 MVP 이후 별도 정책으로 검토합니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버와 batch에서만 사용합니다.
