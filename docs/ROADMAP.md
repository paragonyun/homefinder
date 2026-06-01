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
- Supabase 프로젝트, 기본 migration, Vercel 공개 환경변수 연결 완료
- 남은 확인: 오래된 운영자 제한 migration 적용 여부 최종 확인

## Phase 3: 실거래가 연동

- 국토부 실거래가 adapter
- XML 파싱
- 원천 응답 저장
- 거래 데이터 정규화
- 평형대 bucket
- 가격 추이 차트
- 상세 화면 차트는 최근 12개월을 표시하고, 거래 표는 최신 거래월만 표시

## Phase 4: 단지 기본정보 연동

- K-apt adapter
- 단지명/주소 alias 매칭
- 세대수, 동수, 사용승인일, 난방, 주차 저장
- 데이터 출처/갱신일 표시
- K-apt 코드 디렉터리 기반 자동 탐색과 후보 선택 UI
- 건축물대장 기반 용적률, 건폐율, 면적 정보 조회 파이프라인
- 남은 확인: 건축HUB API 활용 권한과 운영 호출 성공 여부

## Phase 5: 학군/접근성

- NEIS 학교정보 route와 가까운 학교 후보 계산
- 여의도역/강남역 접근성 수동 입력/비교 표시 완료
- TMAP 기반 여의도역/강남역 자동차 접근성 자동 계산 완료
- TMAP 대중교통 route와 상세 timeline UI 구현 완료
- 남은 확인: 대중교통 API 권한이 있는 `TMAP_TRANSIT_API_KEY` 등록과 운영 조회 성공 여부
- 남은 확인: 실제 NEIS 응답으로 학군 동기화 성공 여부
- 목적지 커스텀
- 지도 표시

## Phase 6: 비교/임장/판단 보드

- 단지 비교표
- 모바일 임장 체크리스트
- 사진 업로드
- 판단 메모
- 규칙 기반 점수화 초안

## Phase 7: 배포

- Vercel 배포 완료
- Supabase 연결 완료
- 핵심 환경변수 설정 완료
- 로그인 없는 공개 접근 차단
- PC/모바일 주요 화면 확인
- 남은 운영 확인: TMAP 대중교통 권한, 건축HUB 호출, NEIS 호출
