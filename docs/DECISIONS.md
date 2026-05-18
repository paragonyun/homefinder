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
