# Architecture

## 기본 구조

HomeScope는 Next.js App Router를 중심으로 시작합니다.

```text
Browser
  -> Next.js App Router UI
  -> Route Handlers / Server-side services
  -> Supabase Auth
  -> Supabase PostgreSQL / Storage
  -> External official APIs through server adapters
```

첫 커밋에서는 실제 외부 API 호출과 Supabase migration 적용을 하지 않습니다. 대신 화면, 문서, 타입, adapter 디렉터리 경계를 먼저 둡니다.

## 폴더 원칙

```text
src/
  app/                 화면 route
  components/          화면 구성 요소
  lib/
    supabase/          Supabase client
    data-providers/    외부 API adapter
    services/          앱 비즈니스 로직
  types/               도메인 타입
  utils/               formatting, distance, date helpers
docs/                  제품/기술 문서
supabase/              후속 migration과 seed
```

## 데이터 수집 adapter

외부 API는 화면 컴포넌트에서 직접 호출하지 않습니다.

- `molit-transactions`: 국토부 아파트 매매 실거래가
- `kapt-basic-info`: K-apt 공동주택 기본정보
- `building-register`: 건축물대장 후보
- `neis-schools`: NEIS 학교기본정보
- `kakao-geocode`: 주소/좌표 변환
- `transit-routes`: 교통 소요시간 후보

adapter는 서버 환경에서만 API 키를 사용합니다. 브라우저에는 외부 API 키를 노출하지 않습니다.

## 원천 데이터와 가공 데이터 분리

외부 API 응답은 `raw_api_responses`에 원천 그대로 저장합니다. 화면 표시나 비교를 위한 값은 `apartment_transactions`, `apartment_price_snapshots`, `apartment_basic_info` 등 정규화된 테이블에 저장합니다.

이 분리는 다음 목적을 가집니다.

- API 응답 구조 변경 시 재처리 가능
- 계산 로직 변경 시 원천 데이터 재사용
- 출처/갱신일/신뢰도 추적
- 공식 데이터와 수동 메모 혼합 방지

## 인증과 권한

- Supabase Auth를 기본 방향으로 사용합니다.
- 모든 사용자 소유 데이터는 `user_id`로 구분합니다.
- Supabase RLS는 MVP 1 DB 구현 단계에서 적용합니다.
- 개인용 서비스이므로 조직, 결제, 공개 공유 권한은 MVP에서 만들지 않습니다.

## 실패 처리

외부 API 실패는 숨기지 않습니다. 화면에는 데이터 없음, API 키 없음, 호출량 초과, 주소 매칭 실패, 단지명 매칭 실패, XML 파싱 실패 같은 상태를 명확히 표시합니다.

## 장기 확장

Portfolio Watchdog와 코드를 섞지 않습니다. 다만 장기적으로 자산 관리 흐름과 연결될 수 있도록 services 계층과 데이터 출처 필드를 유지합니다.
