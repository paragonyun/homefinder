# HomeFinder / HomeScope Mac Migration

이 문서는 Windows Codex App에서 관리하던 `homefinder` 프로젝트를 새 Mac으로 옮길 때 clone, 실행, 검증 과정에서 오류가 나지 않도록 정리한 인수인계 문서입니다.

## 절대 기준

Mac에서 문제가 없어야 한다는 기준은 다음처럼 봅니다.

- GitHub에서 clone한 파일만으로 Next.js 앱 의존성을 다시 설치할 수 있어야 합니다.
- `.env.local`, Supabase service role, 공공 API 키, Vercel 연결 정보는 git에 없으므로 Mac에서 직접 다시 채워야 합니다.
- Node.js 버전이 낮아서 Next.js 16이 실패하는 상황을 피해야 합니다.
- Supabase migration, RLS, 운영자 계정 설정 상태를 새 환경에서 누락하지 않아야 합니다.

## Clone

```bash
git clone https://github.com/paragonyun/homefinder.git
cd homefinder
git status --short
```

`git status --short`가 아무것도 출력하지 않으면 clone 상태는 정상입니다.

## 필수 런타임

- Node.js 20.9 이상
- npm
- Git
- Supabase CLI는 선택 사항이지만 migration 적용에는 유용합니다.

이 repo에는 `.nvmrc`가 있고 값은 `20`입니다. 이미 `nvm`, `fnm`, `asdf` 같은 Node 버전 관리자를 쓰고 있다면 Node 20 이상을 선택하세요.

가장 단순한 Homebrew 설치:

```bash
brew install node
node --version
npm --version
```

`nvm`을 이미 설정해 둔 경우:

```bash
nvm install 20
nvm use 20
node --version
npm --version
```

Node 20.9 미만에서는 Next.js 16 test/build/dev가 실패할 수 있습니다. `node --version`이 `v20.9.0` 이상인지 먼저 확인하세요.

## 의존성 설치와 실행

```bash
npm ci
npm test
npm run lint
npm run build
npm run dev
```

로컬 개발 서버는 기본적으로 `http://localhost:3000`입니다.

## 환경변수

Mac에서 직접 만듭니다.

```bash
cp .env.example .env.local
```

필요한 값:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

MOLIT_API_KEY=
MOLIT_BUILDING_API_KEY=
KAPT_API_KEY=
TMAP_API_KEY=
TMAP_TRANSIT_API_KEY=
TMAP_DRIVING_API_KEY=
NEIS_API_KEY=
KAKAO_REST_API_KEY=
TRANSIT_API_KEY=

NEXT_PUBLIC_APP_URL=
```

주의:

- `SUPABASE_SERVICE_ROLE_KEY`는 서버 route와 배치성 동기화에서만 사용합니다.
- service role key를 브라우저 코드, 클라이언트 컴포넌트, README 예시값에 노출하지 마세요.
- `.env.local`은 git에 올라가지 않습니다.

## Supabase 적용

새 Supabase 프로젝트 또는 새 Mac에서 연결을 다시 잡는 경우 migration을 적용합니다.

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Supabase CLI를 쓰지 않는다면 Dashboard SQL Editor에서 `supabase/migrations/` 파일을 순서대로 적용합니다.

운영 계정 설정:

1. Supabase Dashboard에서 이메일/비밀번호 사용자를 만듭니다.
2. 공개 회원가입은 열지 않습니다.
3. 운영자 계정에는 `app_metadata.role = admin`을 설정합니다.
4. role 변경 후에는 로그아웃/재로그인해서 JWT에 새 role이 들어가게 합니다.

## 현재 진행현황

2026-07-11 기준 주요 구현 상태:

- Next.js App Router, TypeScript, Tailwind CSS 기반 앱 구현
- Supabase Auth와 PostgreSQL/RLS 기반 개인 운영 구조 구현
- 운영자 제한 CRUD 구현
- 국토부 실거래가, K-apt 기본정보, 건축물대장, TMAP 접근성, NEIS 학교정보 동기화 route와 parser/test 구현
- 관심 단지, 비교, 대시보드 지도, 현장 메모, 사진 업로드, 단지 점수 모델 구현
- 최근 이력에 dashboard map, commute refresh 최적화, 외부 API provider hardening 반영
- 현재 Windows 작업 상태에는 로그인 네트워크 오류를 원문 fetch 오류 대신 안내 메시지로 바꾸는 변경이 포함되어 있음

## 알려진 오류와 대응

- `MOLIT API request failed with 403` 또는 `SERVICE_ACCESS_DENIED_ERROR`: Vercel redeploy 여부, `MOLIT_API_KEY` 값, 공공데이터포털의 상세 자료 API 활용신청 승인 상태를 확인합니다.
- K-apt 오류: `KAPT_API_KEY`, K-apt 코드, 공공데이터포털 권한을 확인합니다.
- 건축물대장 오류: 10자리 법정동코드 또는 지번 주소가 없으면 잘못된 조회를 막기 위해 실패 메시지를 반환합니다.
- TMAP 대중교통 오류: 기존 `TMAP_API_KEY`에 대중교통 API 권한을 추가하거나 `TMAP_TRANSIT_API_KEY`를 별도로 등록합니다.
- NEIS 오류: `NEIS_API_KEY`, 주소에서 시도명/구군명 추출 가능 여부, API 권한을 확인합니다.
- Supabase 로그인 네트워크 오류: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, 개발 서버 재시작 여부를 확인합니다.
- Supabase 기본 이메일 발송 제한 때문에 Magic link 대신 미리 만든 이메일/비밀번호 계정으로 로그인하는 구조입니다.

## 개발 지침

- `AGENTS.md`에 적힌 대로 Next.js 16은 기존 지식과 다를 수 있으므로, Next 관련 코드를 바꿀 때는 `node_modules/next/dist/docs/`의 현재 문서를 우선 확인합니다.
- 외부 API 실패는 숨기지 말고, API 키 없음, 권한 없음, 주소 매칭 실패, XML 파싱 실패 등 원인을 화면/API 응답에 명시합니다.
- KB부동산, 네이버 부동산 같은 비공식 endpoint를 무단 호출하지 않습니다.
- 공식 API 원천 응답과 정규화 데이터를 분리합니다.
- TMAP 상세 경로는 약관을 고려해 24시간 캐시로만 표시하고 장기 원천 응답으로 보존하지 않습니다.
- `SUPABASE_SERVICE_ROLE_KEY`가 필요한 로직은 서버 전용 파일에만 둡니다.

## 2026-07-11 검증 이력

Windows Codex App에서 Mac 이전 문서 추가 및 기존 로그인 오류 처리 변경을 포함한 상태로 다음을 확인했습니다.

- `node node_modules/vitest/vitest.mjs run`: `33 files passed`, `168 tests passed`
- `node node_modules/eslint/bin/eslint.js src scripts eslint.config.mjs next.config.ts postcss.config.mjs --max-warnings=0`: 종료 코드 0
- `node node_modules/next/dist/bin/next build`: 성공
- Windows 기본 Node는 `v18.13.0`으로 확인되어 Next.js 16 요구사항보다 낮았습니다. 검증은 Codex 번들 Node `v24.14.0`으로 수행했습니다.
- Mac에서는 `.nvmrc` 기준으로 Node 20 이상을 먼저 맞춘 뒤 `npm ci`, `npm test`, `npm run lint`, `npm run build`를 실행하세요.
- Supabase 로그인 네트워크 오류 처리 변경은 `NEXT_PUBLIC_SUPABASE_URL` 또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 틀린 경우 원문 fetch 오류 대신 설정 확인 메시지를 보여주기 위한 것입니다.

## Mac 이전 체크리스트

- [ ] `git clone` 후 `git status --short`가 비어 있음
