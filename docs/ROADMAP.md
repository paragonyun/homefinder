# Roadmap

## Phase 0: 기획/설계 문서화

- README 작성
- PRD, Architecture, Data Sources, DB Schema, API Spec 작성
- Roadmap, Tasks, Decisions 작성
- 첫 구현 제외 범위 명확화

## Phase 1: 프로젝트 스캐폴딩

- Next.js + TypeScript + Tailwind 구성
- 기본 레이아웃
- 대시보드 placeholder
- 관심 동네/단지 placeholder
- Supabase client placeholder
- `.env.example` 작성

## Phase 2: DB 및 기본 CRUD

- Supabase migration 작성 완료
- RLS 정책 작성 완료
- neighborhoods CRUD UI 연결 완료
- apartments CRUD UI 연결 완료
- field_notes CRUD UI 연결 완료
- 남은 작업: Supabase 프로젝트 생성, migration 실제 적용, Vercel 환경변수 등록

## Phase 3: 실거래가 연동

- 국토부 실거래가 adapter
- XML 파싱
- 원천 응답 저장
- 거래 데이터 정규화
- 평형대 bucket
- 가격 추이 차트

## Phase 4: 단지 기본정보 연동

- K-apt adapter
- 단지명/주소 alias 매칭
- 세대수, 동수, 사용승인일, 난방, 주차 저장
- 데이터 출처/갱신일 표시

## Phase 5: 학군/접근성

- NEIS 학교정보 연동
- 가까운 학교 계산
- 여의도역/강남역 접근성 수동 입력/비교 표시 완료
- TMAP 기반 여의도역/강남역 대중교통/자동차 접근성 자동 계산 완료
- 목적지 커스텀
- 지도 표시

## Phase 6: 비교/임장/판단 보드

- 단지 비교표
- 모바일 임장 체크리스트
- 사진 업로드
- 판단 메모
- 규칙 기반 점수화 초안

## Phase 7: 배포

- Vercel 배포
- Supabase 연결
- 환경변수 설정
- 로그인 없는 공개 접근 차단
- PC/모바일 확인
