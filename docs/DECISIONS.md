# Decisions

## 2026-05-18

### 저장소 루트 사용

- 결정: `C:\Users\JeongSeongYun\Documents\homefinder` 루트를 HomeScope 프로젝트 루트로 사용합니다.
- 이유: 이 저장소가 HomeScope 전용이면 Vercel 연결, README, package.json, docs 위치가 단순합니다.
- 영향: 별도 `homescope/` 하위 폴더를 만들지 않습니다.

### npm 사용

- 결정: 패키지 매니저는 npm을 사용합니다.
- 이유: Windows와 Vercel 기본 흐름이 단순합니다.

### Next.js App Router 사용

- 결정: Next.js App Router, TypeScript, Tailwind CSS로 시작합니다.
- 이유: 반응형 개인용 웹앱과 Vercel 배포에 적합합니다.
- 제약: Next.js 16은 Node.js 20.9 이상이 필요합니다.

### Supabase Auth 우선

- 결정: 인증은 Supabase Auth를 우선 방향으로 둡니다.
- 이유: 개인용 앱이지만 위치, 메모, 사진 등 민감한 정보가 있어 로그인 없는 공개 접근을 피해야 합니다.
- 제외: 첫 커밋에서는 로그인 완성 구현을 하지 않습니다.

### 공식 데이터 우선

- 결정: 공공데이터포털, 국토부, K-apt, NEIS, Kakao Local 등 공식 또는 허용된 API를 우선합니다.
- 이유: 무단 크롤링 기반 설계는 유지보수와 약관 리스크가 큽니다.

### KB부동산 자동 수집 제외

- 결정: KB시세, AI시세, 예측시세를 MVP 자동 수집 대상으로 두지 않습니다.
- 대안: `kb_url` 참고 링크와 "KB시세 확인 필요" 상태를 둡니다.

### 원천 데이터와 가공 데이터 분리

- 결정: `raw_api_responses`와 정규화 테이블을 분리합니다.
- 이유: API 응답 재처리, 출처 추적, 계산 로직 변경 대응이 쉽습니다.

### 첫 커밋 범위 제한

- 결정: 첫 커밋은 문서, scaffold, placeholder 화면에 한정합니다.
- 제외: 실제 외부 API 호출, migration 적용, CRUD 완성, AI 분석, 점수화 구현.

## 2026-05-19

### 비밀번호 기반 운영자 로그인

- 결정: Magic link UI를 제거하고, Supabase에서 미리 만든 이메일/비밀번호 계정으로 로그인합니다.
- 이유: Supabase 기본 이메일 발송 제한으로 개인 운영 중 로그인 확인이 막힐 수 있습니다.
- 영향: 앱에는 공개 회원가입을 만들지 않고, Supabase Dashboard에서 만든 기존 계정만 로그인합니다.

### 동네/단지 관리는 운영자만 허용

- 결정: 관심 동네와 관심 단지의 생성/수정/삭제는 JWT `app_metadata.role = admin`인 계정만 허용합니다.
- 이유: public `users.role`을 클라이언트 수정 가능 데이터로 두면 자기 승격 위험이 생길 수 있습니다.
- 범위: 현재는 운영자 본인이 소유한 행만 관리합니다. 여러 사용자에게 공유 읽기를 여는 정책은 MVP 이후 별도 설계합니다.
