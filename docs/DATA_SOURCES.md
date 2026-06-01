# Data Sources

MVP의 데이터 수집은 공식 API와 허용된 경로만 사용합니다. 불확실한 민간 사이트 자동 수집은 제외합니다.

## 국토부 아파트 매매 실거래가

- 데이터명: 아파트 매매 실거래가
- 제공기관: 국토교통부 / 공공데이터포털
- API 이름: 국토교통부_아파트 매매 실거래가 상세 자료
- 인증 방식: 공공데이터포털 서비스키
- Endpoint: `http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev`
- 응답 형식: XML
- 주요 파라미터: `serviceKey`, `LAWD_CD`, `DEAL_YMD`, `pageNo`, `numOfRows`
- 호출 제한: 공공데이터포털 개발계정 기준 신청 가능 트래픽 10,000건
- 약관/주의사항: 거래 취소/해제 필드(`cdealType`, `cdealDay`)를 저장
- MVP 적용 여부: MVP 1 핵심
- 대체 데이터 소스: 없음. 공식 API 우선
- 구현 난이도: 중간. XML 파싱과 단지명 매칭 필요

구현 정책:

- 법정동코드는 단지 수정 화면에서 수동 보정합니다.
- API 키는 `MOLIT_API_KEY`로 서버 route에서만 읽습니다.
- 원천 XML은 `raw_api_responses`에 저장하고, 정규화 거래는 `apartment_transactions`에 저장합니다.
- 화면의 기본 동기화는 계약년월 입력을 요구하지 않습니다. 서버가 최근월부터 과거 12개월까지 순차 조회하고, 단지명 일치 거래를 모두 저장합니다. 상세 화면의 차트는 이 12개월 데이터를 사용하고, 하단 거래 표는 최신 거래월만 표시합니다.
- 2026-05-29 운영 DB 기준 `apartment_transactions` 177건, `raw_api_responses` 52건 저장을 확인했습니다. 로컬 `.env.local`에는 `MOLIT_API_KEY`를 저장하지 않아 로컬 직접 호출 검증은 제외했습니다.
- 단지명은 공백/일부 구분자를 제거한 뒤 정확일치와 안전한 포함일치를 허용합니다. 예: 사용자가 `염창동 동아 3차 아파트`로 입력해도 원천명 `동아3차`를 매칭할 수 있습니다. 짧은 단지명은 오탐을 줄이기 위해 포함일치를 제한합니다.
- `관악드림타운`처럼 국토부 원천명이 `관악드림(동아)`, `관악드림(삼성)` 등으로 나뉘는 경우에는 자동 저장하지 않습니다. sync 응답에 후보 원천명을 표시하고, 운영자가 확인한 이름만 `apartment_aliases`에 `source = molit`로 저장합니다.
- 같은 계약월 동기화를 반복해도 `apartment_id + source_name + source_hash` unique key로 중복 저장을 막습니다.

403 점검:

- `MOLIT_API_KEY`가 Vercel Production 환경변수에 등록되어 있고 redeploy 되었는지 확인합니다.
- 공공데이터포털에서 `국토교통부_아파트 매매 실거래가 상세 자료`를 활용신청했는지 확인합니다. 비슷한 이름의 일반 실거래가 API만 신청하면 상세 API에서 권한 오류가 날 수 있습니다.
- Encoding 키와 Decoding 키 모두 허용하지만, 가능하면 Decoding 키를 사용합니다.
- 공공데이터포털의 Requested Link는 `http://apis.data.go.kr/...`입니다. `https://`에서 gateway `Forbidden`이 나올 수 있어 앱도 공식 요청 URL과 같은 `http://` endpoint를 사용합니다.
- 앱은 국토부 non-2xx 응답의 XML 에러코드를 화면에 표시합니다. `SERVICE_ACCESS_DENIED_ERROR`는 보통 해당 API 활용 권한 또는 승인 상태 문제입니다.

## K-apt 공동주택 기본정보

- 데이터명: 공동주택 기본정보
- 제공기관: 국토교통부 / 공동주택관리정보시스템(K-apt)
- API 이름: 국토교통부_공동주택 기본 정보제공 서비스
- 인증 방식: 공공데이터포털 서비스키
- Endpoint: `http://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusDtlInfoV4`
- 응답 형식: JSON (`_type=json`)
- 주요 파라미터: `ServiceKey`, `kaptCode`
- 호출 제한: 공공데이터포털 개발계정 기준 신청 가능 트래픽 10,000건
- 약관/주의사항: 단지명 표기 차이가 많아 alias와 수동 보정 필요
- MVP 적용 여부: MVP 1 핵심
- 대체 데이터 소스: 수동 기본정보 메모, 후속 공식 건축 데이터
- 구현 난이도: 중간

구현 정책:

- K-apt 코드는 단지 수정 화면에서 수동 보정합니다.
- API 키는 `KAPT_API_KEY`로 서버 route에서만 읽습니다.
- 2026-05-29 운영 DB 기준 `apartment_basic_info` 3건과 서울 K-apt 디렉터리 3,372건 저장을 확인했습니다.
- 원천 JSON은 `raw_api_responses`에 저장하고, 정규화 기본정보는 `apartment_basic_info`에 저장합니다.
- 저장 필드는 단지명, 법정동주소, 도로명주소, 세대수, 동수, 사용승인일, 난방방식, 관리방식, 분양형태, 주차대수, 승강기대수, 건축물대장상 연면적입니다.
- 같은 단지의 기본정보 동기화를 반복하면 `apartment_id + source_name` 기준으로 최신 값으로 갱신합니다.

## 건축물대장 / 건축정보

- 데이터명: 건축물대장, 건축면적, 용적률, 건폐율
- 제공기관: 정부/공공기관 API 후보
- API 이름: 건축물대장 API 후보
- 인증 방식: 공공데이터포털 서비스키 후보
- 응답 형식: XML 또는 JSON 확인 필요
- 주요 파라미터: 주소, 법정동코드, 지번, 건물 식별자
- 호출 제한: 공식 문서 확인 필요
- 약관/주의사항: 단지 단위와 동 단위 기준 차이를 화면에 표시
- MVP 적용 여부: MVP 1에서는 자리만 두고 데이터 없으면 미확보 표시
- 대체 데이터 소스: K-apt 일부 항목, 수동 보정
- 구현 난이도: 높음

구현 업데이트:

- 건축물대장 조회는 `POST /api/apartments/:id/building-info/sync`에서 처리합니다.
- API는 `MOLIT_BUILDING_API_KEY`를 우선 사용하고, 없으면 기존 `MOLIT_API_KEY`를 사용합니다.
- 조회 대상 API는 `BldRgstHubService/getBrRecapTitleInfo`를 먼저 시도하고, 유효한 결과가 없으면 `getBrTitleInfo`를 시도합니다.
- 저장된 K-apt 기본정보 법정주소, K-apt 디렉터리 법정동코드, 실거래가 원천 지번주소를 조합해 `sigunguCd`, `bjdongCd`, `platGbCd`, `bun`, `ji`를 만듭니다.
- 도로명주소만 있고 지번주소를 찾지 못하면 잘못된 건축물대장 조회를 막기 위해 API를 호출하지 않고 실패 메시지를 반환합니다.
- 원천 응답은 `raw_api_responses`에 저장하고, 정규화된 용적률/건폐율/면적은 `apartment_building_info`에 저장합니다.

## NEIS 학교기본정보

- 데이터명: 학교 기본정보
- 제공기관: 한국교육학술정보원 NEIS
- API 이름: 학교기본정보 API 후보
- 인증 방식: NEIS API 키
- 응답 형식: JSON 또는 XML 확인 필요
- 주요 파라미터: 교육청 코드, 학교명, 위치 기반 검색 후보
- 호출 제한: 공식 문서 확인 필요
- 약관/주의사항: 학군 평가는 단정하지 않고 가까운 학교 중심으로 표시
- MVP 적용 여부: MVP 2
- 대체 데이터 소스: 학교알리미 공시정보 후속 검토
- 구현 난이도: 중간

구현 정책:

- 서버 route는 `POST /api/apartments/:id/schools/sync`입니다.
- API 키는 `NEIS_API_KEY`를 사용합니다.
- 단지 주소에서 시도명과 구군명을 추출하고, NEIS `schoolInfo`를 초등학교/중학교/고등학교별로 조회한 뒤 같은 구의 학교만 저장합니다.
- `schools`에는 학교 기본정보와 주소를 저장하고, `apartment_school_access`에는 단지-학교 연결을 저장합니다.
- 단지와 학교 좌표가 모두 있는 경우에만 직선거리와 도보 추정 시간을 계산합니다. 좌표가 없으면 화면에 `거리 계산 전`으로 표시합니다.
- 실제 초등 통학구/중학군 배정은 교육청 기준과 다를 수 있으므로 앱에서는 “가까운 학교 후보”로만 표시합니다.

## Kakao Local API

- 데이터명: 주소/좌표 변환
- 제공기관: Kakao
- API 이름: Local API 주소 검색/좌표 변환
- 인증 방식: Kakao REST API Key
- 응답 형식: JSON
- 주요 파라미터: 주소, 검색어
- 호출 제한: Kakao Developers 정책 확인 필요
- 약관/주의사항: 실패 시 수동 좌표 보정 필요
- MVP 적용 여부: MVP 1 등록 flow
- 대체 데이터 소스: Naver Geocoding, 공공주소 API
- 구현 난이도: 낮음-중간

## TMAP 접근성

- 데이터명: 대중교통/자동차 경로 소요시간
- 제공기관: TMAP Mobility / SK open API
- API 이름: TMAP 대중교통 API, TMAP 자동차 경로안내, Full Text Geocoding
- 인증 방식: `appKey`
- 응답 형식: JSON
- 주요 파라미터: 출발 좌표, 도착 좌표, 기준 시각
- 호출 제한: 대중교통 FREE 플랜은 10건/일 기준으로 운영합니다.
- 약관/주의사항: TMAP API 결과는 24시간 캐시로만 표시하고 장기 원천 응답 저장은 하지 않습니다.
- MVP 적용 여부: MVP 2
- 대체 데이터 소스: 수동 입력/보정값
- 구현 난이도: 중간

구현 정책:

- API 키는 기본적으로 `TMAP_API_KEY` 하나로 서버 route에서만 읽습니다.
- 대중교통과 자동차 키를 분리해야 하면 `TMAP_TRANSIT_API_KEY`, `TMAP_DRIVING_API_KEY`가 `TMAP_API_KEY`보다 우선됩니다.
- 기준 시각은 다음 평일 오전 7시 30분(Asia/Seoul)입니다.
- 단지 좌표가 없으면 TMAP 지오코딩으로 주소를 좌표화하고 `apartments.lat/lng`에 저장합니다.
- 여의도역/강남역 각각 대중교통(`transit`)과 자동차(`driving`) row를 `commute_times`에 upsert합니다.
- 대중교통 상세 경로는 도보/버스/지하철/환승 단계만 정규화해 `source_ref`에 24시간 캐시 메타데이터로 저장합니다.

## KB부동산 처리

KB시세, AI시세, 예측시세는 MVP 자동 수집 대상이 아닙니다. `kb_url` 참고 링크와 "KB시세 확인 필요" 상태만 둡니다. 공식 API, 제휴, 명확히 허용된 경로가 확인될 때만 후속 연동합니다.
