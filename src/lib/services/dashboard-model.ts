import type { ApartmentStatus } from "@/types/apartment";

export type DashboardNeighborhood = {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
};

export type DashboardApartment = {
  id: string;
  neighborhood_id: string | null;
  name: string;
  display_name: string | null;
  address: string | null;
  status: ApartmentStatus;
  memo: string | null;
};

export type DashboardTransaction = {
  apartment_id: string;
  deal_amount_krw: number;
  deal_date: string;
};

export type DashboardBasicInfo = {
  apartment_id: string;
  household_count: number | null;
  parking_count: number | null;
  approval_date: string | null;
  fetched_at: string | null;
};

export type DashboardCommuteTime = {
  apartment_id: string;
  destination_key: "yeouido_station" | "gangnam_station";
  transport_type: "transit" | "walking" | "driving";
  duration_minutes: number | null;
};

export type DashboardModelInput = {
  neighborhoods: DashboardNeighborhood[];
  apartments: DashboardApartment[];
  transactions: DashboardTransaction[];
  basicInfos?: DashboardBasicInfo[];
  commuteTimes?: DashboardCommuteTime[];
};

export type DashboardApartmentSummary = {
  id: string;
  name: string;
  address: string | null;
  status: ApartmentStatus;
  latestPriceKrw: number | null;
  latestDealDate: string | null;
  householdCount: number | null;
  gangnamMinutes: number | null;
  yeouidoMinutes: number | null;
  evidence: string[];
  missingBadges: string[];
};

export type DashboardNeighborhoodSummary = {
  id: string;
  name: string;
  description: string;
  apartmentCount: number;
  interestedCount: number;
  candidateCount: number;
  onHoldCount: number;
  priceRangeLabel: string;
  gangnamSummary: string;
  yeouidoSummary: string;
  missingBadges: string[];
  representativeApartments: DashboardApartmentSummary[];
  updatedAt: string;
};

export type DashboardModel = {
  summary: {
    neighborhoods: number;
    activeApartments: number;
    withPrice: number;
    withCommute: number;
  };
  neighborhoods: DashboardNeighborhoodSummary[];
  priorityApartments: DashboardApartmentSummary[];
};

const activeStatuses = new Set<ApartmentStatus>([
  "candidate",
  "interested",
  "visit_planned",
  "visited",
  "on_hold",
]);

export function buildDashboardModel(input: DashboardModelInput): DashboardModel {
  const transactionsByApartmentId = groupByApartmentId(input.transactions);
  const latestBasicInfoByApartmentId = getLatestBasicInfoByApartmentId(
    input.basicInfos ?? [],
  );
  const commuteByApartmentId = getCommuteByApartmentId(input.commuteTimes ?? []);
  const apartmentSummaries = input.apartments.map((apartment) =>
    summarizeApartment({
      apartment,
      commute: commuteByApartmentId.get(apartment.id) ?? emptyCommute(),
      transactions: transactionsByApartmentId.get(apartment.id) ?? [],
      basicInfo: latestBasicInfoByApartmentId.get(apartment.id) ?? null,
    }),
  );
  const apartmentSummaryById = new Map(
    apartmentSummaries.map((summary) => [summary.id, summary]),
  );
  const activeApartments = input.apartments.filter((apartment) =>
    activeStatuses.has(apartment.status),
  );
  const neighborhoodSummaries = input.neighborhoods
    .map((neighborhood) => {
      const relatedApartments = activeApartments.filter(
        (apartment) => apartment.neighborhood_id === neighborhood.id,
      );
      const relatedSummaries = relatedApartments
        .map((apartment) => apartmentSummaryById.get(apartment.id))
        .filter(Boolean) as DashboardApartmentSummary[];

      return summarizeNeighborhood(neighborhood, relatedApartments, relatedSummaries);
    })
    .sort(
      (left, right) =>
        right.apartmentCount - left.apartmentCount ||
        left.name.localeCompare(right.name, "ko-KR"),
    );

  return {
    summary: {
      neighborhoods: input.neighborhoods.length,
      activeApartments: activeApartments.length,
      withPrice: apartmentSummaries.filter((summary) => summary.latestPriceKrw !== null)
        .length,
      withCommute: apartmentSummaries.filter(
        (summary) =>
          summary.gangnamMinutes !== null || summary.yeouidoMinutes !== null,
      ).length,
    },
    neighborhoods: neighborhoodSummaries,
    priorityApartments: rankPriorityApartments(apartmentSummaries),
  };
}

function summarizeNeighborhood(
  neighborhood: DashboardNeighborhood,
  apartments: DashboardApartment[],
  apartmentSummaries: DashboardApartmentSummary[],
): DashboardNeighborhoodSummary {
  const priceValues = apartmentSummaries
    .map((summary) => summary.latestPriceKrw)
    .filter((value): value is number => value !== null);
  const gangnamValues = apartmentSummaries
    .map((summary) => summary.gangnamMinutes)
    .filter((value): value is number => value !== null);
  const yeouidoValues = apartmentSummaries
    .map((summary) => summary.yeouidoMinutes)
    .filter((value): value is number => value !== null);
  const representativeApartments = rankPriorityApartments(apartmentSummaries).slice(
    0,
    2,
  );
  const missingBadges = [
    priceValues.length === 0 ? "가격 미확인" : null,
    gangnamValues.length === 0 && yeouidoValues.length === 0
      ? "접근성 미확인"
      : null,
  ].filter(Boolean) as string[];

  return {
    id: neighborhood.id,
    name: neighborhood.name,
    description: neighborhood.description ?? "권역 메모 없음",
    apartmentCount: apartments.length,
    interestedCount: apartments.filter((apartment) => apartment.status === "interested")
      .length,
    candidateCount: apartments.filter((apartment) => apartment.status === "candidate")
      .length,
    onHoldCount: apartments.filter((apartment) => apartment.status === "on_hold")
      .length,
    priceRangeLabel: formatPriceRange(priceValues),
    gangnamSummary: formatCommuteSummary(gangnamValues, "강남"),
    yeouidoSummary: formatCommuteSummary(yeouidoValues, "여의도"),
    missingBadges,
    representativeApartments,
    updatedAt: neighborhood.updated_at,
  };
}

function summarizeApartment({
  apartment,
  basicInfo,
  commute,
  transactions,
}: {
  apartment: DashboardApartment;
  basicInfo: DashboardBasicInfo | null;
  commute: ReturnType<typeof emptyCommute>;
  transactions: DashboardTransaction[];
}): DashboardApartmentSummary {
  const latestTransaction = [...transactions].sort((left, right) =>
    right.deal_date.localeCompare(left.deal_date),
  )[0];
  const latestPriceKrw = latestTransaction?.deal_amount_krw ?? null;
  const gangnamMinutes = commute.gangnam_station.transit;
  const yeouidoMinutes = commute.yeouido_station.transit;
  const evidence = [
    apartment.status === "interested" ? "관심" : null,
    latestPriceKrw !== null ? "최근 거래 있음" : null,
    gangnamMinutes !== null ? `강남 ${gangnamMinutes}분` : null,
    yeouidoMinutes !== null ? `여의도 ${yeouidoMinutes}분` : null,
    (basicInfo?.household_count ?? 0) >= 1000 ? "1,000세대 이상" : null,
  ].filter(Boolean) as string[];
  const missingBadges = [
    latestPriceKrw === null ? "가격 미확인" : null,
    gangnamMinutes === null && yeouidoMinutes === null ? "접근성 미확인" : null,
  ].filter(Boolean) as string[];

  return {
    id: apartment.id,
    name: apartment.display_name ?? apartment.name,
    address: apartment.address,
    status: apartment.status,
    latestPriceKrw,
    latestDealDate: latestTransaction?.deal_date ?? null,
    householdCount: basicInfo?.household_count ?? null,
    gangnamMinutes,
    yeouidoMinutes,
    evidence,
    missingBadges,
  };
}

function rankPriorityApartments(apartments: DashboardApartmentSummary[]) {
  return [...apartments]
    .filter((apartment) => apartment.status !== "excluded")
    .sort((left, right) => getPriorityScore(right) - getPriorityScore(left))
    .slice(0, 5);
}

function getPriorityScore(apartment: DashboardApartmentSummary) {
  let score = 0;

  if (apartment.status === "interested") {
    score += 40;
  } else if (apartment.status === "visit_planned") {
    score += 32;
  } else if (apartment.status === "candidate") {
    score += 24;
  }

  if (apartment.latestPriceKrw !== null) {
    score += 18;
  }

  const bestCommute = getBestCommute(apartment);

  if (bestCommute !== null) {
    score += Math.max(0, 24 - bestCommute / 3);
  }

  if ((apartment.householdCount ?? 0) >= 1000) {
    score += 10;
  }

  return score;
}

function getBestCommute(apartment: DashboardApartmentSummary) {
  const values = [apartment.gangnamMinutes, apartment.yeouidoMinutes].filter(
    (value): value is number => value !== null,
  );

  return values.length > 0 ? Math.min(...values) : null;
}

function groupByApartmentId(transactions: DashboardTransaction[]) {
  const byApartmentId = new Map<string, DashboardTransaction[]>();

  for (const transaction of transactions) {
    const current = byApartmentId.get(transaction.apartment_id) ?? [];
    current.push(transaction);
    byApartmentId.set(transaction.apartment_id, current);
  }

  return byApartmentId;
}

function getLatestBasicInfoByApartmentId(basicInfos: DashboardBasicInfo[]) {
  const byApartmentId = new Map<string, DashboardBasicInfo>();

  for (const basicInfo of basicInfos) {
    const current = byApartmentId.get(basicInfo.apartment_id);

    if (!current || (basicInfo.fetched_at ?? "") > (current.fetched_at ?? "")) {
      byApartmentId.set(basicInfo.apartment_id, basicInfo);
    }
  }

  return byApartmentId;
}

function getCommuteByApartmentId(commuteTimes: DashboardCommuteTime[]) {
  const byApartmentId = new Map<string, ReturnType<typeof emptyCommute>>();

  for (const commuteTime of commuteTimes) {
    if (commuteTime.transport_type !== "transit") {
      continue;
    }

    const current = byApartmentId.get(commuteTime.apartment_id) ?? emptyCommute();
    current[commuteTime.destination_key].transit = commuteTime.duration_minutes;
    byApartmentId.set(commuteTime.apartment_id, current);
  }

  return byApartmentId;
}

function emptyCommute() {
  return {
    gangnam_station: {
      transit: null as number | null,
    },
    yeouido_station: {
      transit: null as number | null,
    },
  };
}

function formatPriceRange(values: number[]) {
  if (values.length === 0) {
    return "가격 미확인";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return formatKrwShort(min);
  }

  return `${formatKrwShort(min)}~${formatKrwShort(max)}`;
}

function formatKrwShort(value: number) {
  const eok = value / 100_000_000;
  return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
}

function formatCommuteSummary(values: number[], label: string) {
  if (values.length === 0) {
    return `${label} 미확인`;
  }

  return `대중교통 ${Math.min(...values)}분`;
}
