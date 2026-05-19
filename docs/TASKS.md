# Tasks

## 첫 커밋

- [x] 빈 Git 저장소 루트를 HomeScope 프로젝트로 사용
- [x] Next.js + TypeScript + Tailwind scaffold 생성
- [x] Node.js 20.9 이상 실행 기준 확인
- [x] Supabase client placeholder 추가
- [x] `.env.example` 작성
- [x] 기본 레이아웃 작성
- [x] 대시보드 placeholder 작성
- [x] 관심 동네 목록 placeholder 작성
- [x] 관심 단지 목록 placeholder 작성
- [x] 비교 화면 placeholder 작성
- [x] 설정 화면 placeholder 작성
- [x] 핵심 문서 작성
- [x] `npm run lint`
- [x] `npm run build`
- [x] 로컬 화면 확인
- [x] 첫 커밋 생성: `init homescope project planning and app scaffold`

## 다음 단계: DB와 CRUD

- [ ] Supabase 프로젝트 생성
- [x] migration 작성
- [x] RLS 정책 작성
- [x] Supabase Auth 연결
- [x] 동네 CRUD
- [x] 단지 CRUD
- [x] 임장 메모 CRUD
- [x] 상태 변경 UI
- [x] Supabase 환경변수 Vercel 등록
- [x] 초기 Supabase migration 실제 적용
- [x] Magic link 제거 및 비밀번호 로그인 전환
- [x] 동네/단지 CUD 운영자 제한 RLS 추가
- [ ] 운영자 제한 migration 실제 적용
- [ ] Supabase 운영자 계정 생성 및 `app_metadata.role = admin` 설정

## 데이터 연동

- [x] 국토부 실거래가 API 문서 확인
- [x] XML 응답 샘플 기반 파서 테스트
- [x] `raw_api_responses` 저장 로직
- [x] 단지명 정확 일치 매칭 로직
- [x] `apartment_transactions` migration 작성
- [x] 실거래가 동기화 route 작성
- [x] 단지 상세 거래 테이블 표시
- [x] 최근월 기준 자동 실거래가 동기화
- [ ] Supabase에 거래 migration 실제 적용
- [ ] Vercel에 `MOLIT_API_KEY` 등록
- [ ] 실제 국토부 API 응답으로 운영 환경 동기화 검증
- [ ] 평형대 bucket 계산
- [ ] K-apt API 문서 확인
- [ ] K-apt 코드 수동 보정 UI

## 금지/주의

- [ ] KB부동산 자동 크롤링 금지
- [ ] 네이버부동산 비공식 endpoint 호출 금지
- [ ] 외부 API 키 클라이언트 노출 금지
- [ ] 실거래가와 시세 혼동 금지
- [ ] 데이터 출처 없는 숫자 표시 금지
- [ ] Portfolio Watchdog 코드 혼합 금지
