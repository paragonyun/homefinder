# HomeScope

HomeScope는 개인이 관심 동네와 아파트를 모아 실거래가, 단지 기본정보, 접근성, 학군, 임장 메모, 판단 기록을 한곳에서 비교하기 위한 부동산 리서치 보드입니다.

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
NEIS_API_KEY=
KAKAO_REST_API_KEY=
TRANSIT_API_KEY=

NEXT_PUBLIC_APP_URL=
```

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

현재 앱은 첫 커밋용 scaffold입니다. 외부 API 호출, Supabase migration 적용, CRUD 완성, 로그인 완성은 아직 포함하지 않습니다.
