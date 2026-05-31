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

- [x] Supabase 프로젝트 생성
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
- [x] Supabase 운영자 계정 생성 및 `app_metadata.role = admin` 설정

## 데이터 연동

- [x] 국토부 실거래가 API 문서 확인
- [x] XML 응답 샘플 기반 파서 테스트
- [x] `raw_api_responses` 저장 로직
- [x] 단지명 정확일치 및 안전한 포함일치 매칭 로직
- [x] 국토부 원천 단지명 alias 저장 구조
- [x] 매칭 실패 시 원천 단지명 후보 표시
- [x] `apartment_transactions` migration 작성
- [x] 실거래가 동기화 route 작성
- [x] 단지 상세 거래 테이블 표시
- [x] 최근월 기준 자동 실거래가 동기화
- [x] Supabase에 거래 migration 실제 적용
- [x] Vercel에 `MOLIT_API_KEY` 등록
- [x] 실제 국토부 API 응답으로 운영 환경 동기화 검증
- [x] 평형대 bucket 계산
- [x] K-apt API 문서 확인
- [x] K-apt 코드 수동 보정 UI
- [x] `apartment_basic_info` migration 작성
- [x] K-apt 기본정보 parser 테스트
- [x] K-apt 기본정보 동기화 route 작성
- [x] 단지 상세 기본정보 표시
- [x] 비교 화면 K-apt 기본정보 표시
- [x] K-apt 단지 목록 parser 테스트
- [x] K-apt 코드 자동 탐색 route 작성
- [x] 단지 상세 아파트 종합 정보 조회 버튼 추가
- [x] Supabase에 K-apt 기본정보 migration 실제 적용
- [x] Vercel에 `KAPT_API_KEY` 등록
- [x] 실제 K-apt API 응답으로 운영 환경 동기화 검증
- [x] 여의도역/강남역 접근성 수동 입력 UI 작성
- [x] 단지 상세/비교 화면 접근성 표시
- [x] Supabase에 `20260529000100_commute_times.sql` 적용
- [x] TMAP 기반 대중교통/자동차 접근성 자동 조회 route 작성
- [x] 대중교통 상세 경로 timeline UI 작성
- [ ] Vercel에 `TMAP_API_KEY` 등록

## 운영 적용 메모

- [x] GitHub remote 연결 및 Vercel 프로젝트 연결
- [x] Vercel Production Node.js 24 설정
- [x] Vercel에 Supabase 공개 환경변수 등록
- [x] Vercel에 `MOLIT_API_KEY` 등록
- [x] 초기 Supabase migration 실제 적용
- [ ] Supabase에 `20260519000100_admin_only_core_mutations.sql` 적용 확인
- [x] Supabase에 `20260519000200_apartment_transactions.sql` 적용 확인
- [x] Supabase에 `20260520000100_apartment_aliases.sql` 적용 확인
- [x] Supabase에 `20260520000200_apartment_basic_info.sql` 적용
- [x] Supabase에 `20260529000100_commute_times.sql` 적용 확인
- [x] Vercel에 `KAPT_API_KEY` 등록
- [ ] Vercel에 `TMAP_API_KEY` 등록
- [x] Supabase 운영자 계정 `app_metadata.role = admin` 설정 확인

## 금지/주의

- [ ] KB부동산 자동 크롤링 금지
- [ ] 네이버부동산 비공식 endpoint 호출 금지
- [ ] 외부 API 키 클라이언트 노출 금지
- [ ] 실거래가와 시세 혼동 금지
- [ ] 데이터 출처 없는 숫자 표시 금지
- [ ] Portfolio Watchdog 코드 혼합 금지

## 사용자 직접 작업

- [x] Supabase SQL Editor에 `supabase/migrations/20260521000100_kapt_code_directory.sql` 적용
- [x] `kapt_code_directory` 서울 단지 디렉터리 seed 적용
