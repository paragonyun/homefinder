# API Spec

첫 커밋에서는 API route를 구현하지 않고 계약만 문서화합니다. Supabase Auth를 쓰는 영역은 직접 구현을 최소화합니다.

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

## Transactions

- `GET /api/apartments/:id/transactions`
- `GET /api/apartments/:id/price-snapshots`

반환 값에는 출처, 갱신일, 거래 취소 여부를 포함합니다.

## Schools / Commute

- `GET /api/apartments/:id/schools`
- `GET /api/apartments/:id/commute`
- `POST /api/apartments/:id/commute/refresh`

교통 소요시간은 기준 시각과 출처를 함께 반환합니다.

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

## Decision Reviews

- `GET /api/apartments/:id/decision`
- `PATCH /api/apartments/:id/decision`

MVP 3 전까지는 상태와 메모 중심으로 사용하고, 점수화는 후속 단계에서 연결합니다.
