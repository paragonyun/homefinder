import type { ApartmentStatus } from "@/types/apartment";

export const statusLabels: Record<ApartmentStatus, string> = {
  candidate: "후보",
  interested: "관심",
  visit_planned: "임장 예정",
  visited: "임장 완료",
  on_hold: "보류",
  excluded: "제외",
};

export const neighborhoods = [
  {
    id: "singil",
    name: "신길동",
    description: "여의도 접근성과 신안산선 기대감을 함께 보는 관심 권역",
    apartments: 4,
    interested: 2,
    onHold: 1,
    excluded: 1,
    avgPriceRange: "8억-12억",
    yeouidoSummary: "대중교통 20분대 후보",
    gangnamSummary: "환승 1회, 40분대 후보",
    updatedAt: "2026-05-18",
  },
  {
    id: "boramae",
    name: "보라매",
    description: "공원, 병원, 업무지구 접근성을 같이 점검할 권역",
    apartments: 3,
    interested: 1,
    onHold: 2,
    excluded: 0,
    avgPriceRange: "9억-14억",
    yeouidoSummary: "버스/지하철 혼합 검토",
    gangnamSummary: "신림선 환승 경로 확인 필요",
    updatedAt: "2026-05-18",
  },
  {
    id: "sadang",
    name: "사당동",
    description: "강남 접근성과 언덕/주차 체감을 중점 비교",
    apartments: 2,
    interested: 1,
    onHold: 1,
    excluded: 0,
    avgPriceRange: "10억-15억",
    yeouidoSummary: "2호선/9호선 환승 검토",
    gangnamSummary: "20분대 후보",
    updatedAt: "2026-05-18",
  },
];

export const apartments = [
  {
    id: "singil-woosung-2",
    name: "신길우성2차",
    neighborhood: "신길동",
    status: "interested" as const,
    address: "서울 영등포구 신길동",
    latestPrice: "데이터 수집 전",
    areaSummary: "59 / 84㎡ 확인 예정",
    sourceState: "국토부/K-apt 매칭 필요",
    note: "여의도 접근성, 주차 체감, 초등학교 동선 확인",
  },
  {
    id: "boramae-kyungnam",
    name: "보라매 경남아너스빌",
    neighborhood: "보라매",
    status: "candidate" as const,
    address: "서울 동작구 신대방동",
    latestPrice: "데이터 수집 전",
    areaSummary: "84㎡ 중심 확인 예정",
    sourceState: "주소 후보 선택 필요",
    note: "공원 접근성과 지하철 동선 비교",
  },
  {
    id: "sadang-xi",
    name: "사당자이",
    neighborhood: "사당동",
    status: "visit_planned" as const,
    address: "서울 동작구 사당동",
    latestPrice: "데이터 수집 전",
    areaSummary: "평형대 bucket 생성 예정",
    sourceState: "KB시세 확인 필요",
    note: "언덕, 밤 분위기, 강남 출근 경로 확인",
  },
];

export const dataTasks = [
  {
    label: "국토부 실거래가",
    state: "adapter planned",
    detail: "법정동코드와 계약년월 기준 XML 파싱 설계",
  },
  {
    label: "K-apt 기본정보",
    state: "matching planned",
    detail: "단지명/주소 alias와 K-apt 코드 수동 보정 고려",
  },
  {
    label: "임장 메모",
    state: "manual input",
    detail: "방문일, 체감 거리, 장단점, 사진 업로드 구조",
  },
  {
    label: "데이터 신뢰도",
    state: "required",
    detail: "source, fetched_at, confidence_level 표시",
  },
];
