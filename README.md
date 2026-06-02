# HomeScope

HomeScope는 개인이 관심 동네와 아파트를 모아 실거래가, 단지 기본정보, 접근성, 임장 메모, 판단 기록을 한곳에서 비교하기 위한 부동산 리서치 보드입니다.

상업용 대규모 서비스가 아니라 본인과 소수 사용자를 위한 개인용 웹앱입니다. 첫 커밋은 완성 기능보다 문서, 구조, placeholder 화면을 만드는 데 초점을 둡니다.

## 기술 스택

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth / Supabase PostgreSQL
- npm

## 로컬 실행

Next.js 16 기준 Node.js 20.9 이상이 필요합니다. 시스템 Node가 낮으면 `nvm use` 또는 Node 20 이상 설치 후 실행합니다.

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 환경변수

`.env.example`을 기준으로 `.env.local`을 만듭니다. 외부 API 키와 `SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 사용해야 합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

MOLIT_API_KEY=
KAPT_API_KEY=
TMAP_API_KEY=
TMAP_TRANSIT_API_KEY=
TMAP_DRIVING_API_KEY=
KAKAO_REST_API_KEY=
TRANSIT_API_KEY=

NEXT_PUBLIC_APP_URL=
```

## Supabase 적용

Supabase 프로젝트를 만든 뒤 SQL Editor 또는 Supabase CLI로 migration을 적용합니다.

```bash
supabase db push
```

현재 포함된 migration은 다음을 만듭니다.

- `users`
- `neighborhoods`
- `apartments`
- `field_notes`
- `raw_api_responses`
- `apartment_status`, `confidence_level` enum
- 사용자별 RLS 정책

추가 migration `20260519000100_admin_only_core_mutations.sql`은 관심 동네와
관심 단지의 생성/수정/삭제를 운영자 계정으로 제한합니다. Supabase SQL
Editor에서 migration 파일을 순서대로 실행합니다.

Vercel에는 최소한 아래 환경변수를 추가해야 실제 로그인과 CRUD가 동작합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`SUPABASE_SERVICE_ROLE_KEY`는 후속 서버 배치나 외부 API 동기화에서만 사용합니다.

국토부 실거래가 동기화에는 `MOLIT_API_KEY`가 필요합니다. 공공데이터포털에서
`국토교통부_아파트 매매 실거래가 상세 자료` 활용신청 후 발급받은 Decoding 키를
Vercel 환경변수에 추가하고 다시 배포합니다.

`MOLIT API request failed with 403` 또는 `SERVICE_ACCESS_DENIED_ERROR`가 나오면
Vercel redeploy 여부, `MOLIT_API_KEY` 값, 그리고 상세 자료 API 활용신청 승인 상태를
확인합니다.

K-apt 기본정보 동기화에는 `KAPT_API_KEY`가 필요합니다. 공공데이터포털에서
`국토교통부_공동주택 기본 정보제공 서비스` 활용신청 후 발급받은 키를 Vercel
환경변수에 추가하고 다시 배포합니다. 단지 수정 화면에서 K-apt 코드를 입력한 뒤
단지 상세 화면에서 기본정보를 불러올 수 있습니다.

강남역/여의도역 접근성 자동 조회에는 `TMAP_API_KEY`가 필요합니다. TMAP
대중교통/자동차 API를 사용할 수 있는 앱키를 Vercel 환경변수에 추가하고 다시
배포합니다. 기본은 대중교통과 자동차 권한을 모두 가진 `TMAP_API_KEY` 하나를
사용합니다. 키를 분리해야 하면 `TMAP_TRANSIT_API_KEY`, `TMAP_DRIVING_API_KEY`를
추가로 설정합니다. TMAP 조회 결과는 약관을 고려해 24시간 캐시로만 표시하고,
만료 후에는 다시 조회합니다.

## 운영자 계정 설정

개인용 운영은 Supabase Dashboard에서 미리 만든 계정만 로그인하도록 둡니다.

1. Supabase Dashboard에서 `Authentication` > `Users`로 이동합니다.
2. `Add user`로 이메일과 비밀번호를 가진 계정을 만듭니다.
3. 가능하면 생성 시 `Auto Confirm User`를 켭니다. 이미 만들었다면 이메일 확인이
   완료된 상태인지 확인합니다.
4. `Authentication` > `Sign In / Providers`에서 `Allow new users to sign up`을
   끕니다. 이렇게 하면 기존 사용자만 로그인할 수 있습니다.
5. SQL Editor에서 아래 쿼리의 이메일을 운영자 이메일로 바꿔 실행합니다.

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'admin')
where email = 'you@example.com';
```

앱은 `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`인 계정만 관심 동네와
관심 단지를 추가/수정/삭제할 수 있게 처리합니다. 이미 로그인한 상태에서 role을
부여했다면 로그아웃 후 다시 로그인해야 새 JWT에 권한이 반영됩니다.

## 핵심 원칙

- 공식 API와 공공데이터를 우선 사용합니다.
- KB부동산, 네이버부동산 등 민간 사이트를 무단 크롤링하지 않습니다.
- 실거래가와 시세를 혼동하지 않습니다.
- 원천 데이터와 가공 데이터를 분리합니다.
- 주요 데이터에는 출처, 갱신일, 신뢰도 수준을 함께 저장하고 표시합니다.
- 임장 메모와 공식 데이터는 섞어 저장하지 않습니다.

## 문서

- [PRD](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data Sources](docs/DATA_SOURCES.md)
- [DB Schema](docs/DB_SCHEMA.md)
- [API Spec](docs/API_SPEC.md)
- [Roadmap](docs/ROADMAP.md)
- [Tasks](docs/TASKS.md)
- [Decisions](docs/DECISIONS.md)

## 현재 상태

현재 앱은 Supabase Auth, 운영자 제한 CRUD, 국토부 실거래가 동기화, K-apt
기본정보 동기화, TMAP 기반 접근성 조회 기반이 연결되어 있습니다. 단지 비교
화면은 실거래가, K-apt 세대수/주차, 여의도역/강남역 대중교통/자차 접근성을
함께 보여줍니다.
