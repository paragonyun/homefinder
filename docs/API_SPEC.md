# API Spec

Supabase Auth를 쓰는 영역은 직접 구현을 최소화합니다. 외부 API 키가 필요한 동기화만 서버 route에서 처리합니다.

## Auth

- `GET /api/me`
- `POST /api/auth/login`
- `POST /api/auth/logout`

## Neighborhoods

- `GET /api/neighborhoods`
- `POST /api/neighborhoods`
- `GET /api/neighborhoods/:id`
- `PATCH /api/neighborhoods/:id`
- `DELETE /api/neighborhoods/:id`

## Apartments

- `GET /api/apartments`
- `POST /api/apartments`
- `GET /api/apartments/:id`
- `PATCH /api/apartments/:id`
- `DELETE /api/apartments/:id`

`POST /api/apartments`는 단지명, 주소 후보, 동네 연결, 수동 보정 필드를 받을 수 있어야 합니다. 가격/실거래가 덮어쓰기는 받지 않습니다.

## Search / Geocode

- `GET /api/search/apartments?query=`
- `GET /api/geocode?address=`

검색 결과는 후보 목록을 반환하고, 사용자가 정확한 단지를 선택하는 흐름을 전제로 합니다.

## Data Sync

- `POST /api/apartments/:id/sync`
- `POST /api/apartments/:id/sync/transactions`
- `POST /api/apartments/:id/sync/basic-info`
- `POST /api/apartments/:id/sync/building-info`
- `POST /api/apartments/:id/sync/schools`
- `POST /api/apartments/:id/sync/commute`

sync API는 원천 응답 저장 후 정규화 데이터를 생성합니다. 실패 시 실패 사유를 숨기지 않습니다.

현재 구현된 실거래가 route:

- `POST /api/apartments/:id/transactions/sync`
- 인증: `Authorization: Bearer <Supabase access token>`
- 권한: `app_metadata.role = admin`
- 요청 body: 기본값은 `{}`. 고급 수동 조회가 필요하면 `{ "dealYmd": "202501" }`도 허용합니다.
- 동작: 단지의 `lawd_cd`로 국토부 상세 API를 최근월부터 기본 12개월까지 조회하고, 단지명이 일치한 거래를 `apartment_transactions`에 upsert합니다. 상세 화면의 차트는 저장된 최근 12개월을 사용하고, 하단 거래 표는 최신 거래월만 표시합니다.
- 매칭: `apartments.name`, `display_name`, `apartment_aliases.source = molit` alias를 사용합니다. 매칭 실패 시 `candidateNames`에 국토부 원천명 후보를 반환할 수 있습니다.
- 실패: `MOLIT_API_KEY` 없음, 법정동코드 없음, 권한 없음, 단지명 매칭 없음을 명시적으로 반환합니다.

현재 구현된 K-apt 기본정보 route:

- `POST /api/apartments/:id/basic-info/sync`
- 인증: `Authorization: Bearer <Supabase access token>`
- 권한: `app_metadata.role = admin`
- 요청 body: 기본값은 `{}`
- 동작: 단지의 `kapt_code`로 K-apt 공동주택 기본정보를 조회하고, 원천 JSON을 `raw_api_responses`에 저장한 뒤 `apartment_basic_info`에 upsert합니다.
- 저장: 세대수, 동수, 사용승인일, 난방방식, 관리방식, 분양형태, 주차대수, 승강기대수, 건축물대장상 연면적, 원천 단지명/주소를 저장합니다.
- 실패: `KAPT_API_KEY` 없음, K-apt 코드 없음, 권한 없음, 원천 데이터 없음, 공공데이터포털 에러 응답을 명시적으로 반환합니다.

현재 구현된 K-apt 코드 탐색 route:

- `POST /api/apartments/:id/kapt-code/resolve`
- 인증: `Authorization: Bearer <Supabase access token>`
- 권한: `app_metadata.role = admin`
- 요청 body: 기본값은 `{}`. 후보를 사용자가 선택한 경우 `{ "kaptCode": "A..." }`도 허용합니다.
- 동작: K-apt 단지 목록을 조회하고, `lawd_cd`, 단지명, alias, 저장된 국토부 원천명/주소 단서를 사용해 후보를 점수화합니다. 후보가 명확하면 `apartments.kapt_code`를 저장하고, 애매하면 상위 후보를 반환합니다.
- 반환: `{ applied, selected, candidates, reason }`
- 실패: `KAPT_API_KEY` 없음, 법정동코드 없음, 권한 없음, 공공데이터포털 에러 응답을 명시적으로 반환합니다.

## Transactions

- `GET /api/apartments/:id/transactions`
- `GET /api/apartments/:id/price-snapshots`

반환 값에는 출처, 갱신일, 거래 취소 여부를 포함합니다.

## Schools / Commute

- `GET /api/apartments/:id/schools`
- `GET /api/apartments/:id/commute` (planned)
- `POST /api/apartments/:id/commute/refresh`

현재 구현은 Supabase `commute_times` 테이블을 클라이언트에서 읽고 씁니다. 운영자는 단지 관리 화면에서 수동 대중교통 시간을 입력할 수 있고, 단지 상세 화면의 `접근성 자동 조회`는 TMAP으로 여의도역/강남역 대중교통과 자동차 시간을 조회해 저장합니다.

`POST /api/apartments/:id/commute/refresh`:

- 인증: `Authorization: Bearer <Supabase access token>`
- 권한: `app_metadata.role = admin`
- 환경변수: `TMAP_API_KEY` 필수. 필요하면 `TMAP_TRANSIT_API_KEY`, `TMAP_DRIVING_API_KEY`로 분리 가능
- 동작: 단지 좌표가 없으면 TMAP 지오코딩으로 주소를 좌표화하고, 여의도역/강남역까지 대중교통/자동차 경로를 조회합니다.
- 기준 시각: 다음 평일 오전 7시 30분(Asia/Seoul)
- 저장: `commute_times`에 `transit`, `driving` row를 upsert합니다. TMAP 상세 경로는 24시간 캐시 메타데이터로만 `source_ref`에 저장하고 `raw_api_responses`에는 장기 보존하지 않습니다.
- 실패: `TMAP_API_KEY` 없음, 좌표/주소 없음, 권한 없음, TMAP API 오류를 명시적으로 반환합니다.

## Field Notes

- `GET /api/apartments/:id/field-notes`
- `POST /api/apartments/:id/field-notes`
- `GET /api/field-notes/:id`
- `PATCH /api/field-notes/:id`
- `DELETE /api/field-notes/:id`

임장 사진은 Supabase Storage를 사용합니다.

## Comparison

- `POST /api/compare/apartments`

비교 대상 단지 id 목록을 받아 주요 항목 테이블에 필요한 값을 반환합니다.

현재 `/compare` 화면은 등록 단지, 국토부 실거래가 요약, K-apt 세대수/주차/사용승인일을 클라이언트에서 함께 조회해 비교합니다. `apartment_basic_info` migration이 아직 적용되지 않은 환경에서는 기본정보만 비워 두고 기존 비교표를 유지합니다.

## Decision Reviews

- `GET /api/apartments/:id/decision`
- `PATCH /api/apartments/:id/decision`

MVP 3 전까지는 상태와 메모 중심으로 사용하고, 점수화는 후속 단계에서 연결합니다.
