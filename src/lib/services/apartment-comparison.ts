import type { ApartmentStatus } from "../../types/apartment";
import {
  summarizeApartmentPrices,
  type PriceSummaryTransaction,
} from "./price-summary";

export type ComparisonApartment = {
  id: string;
  name: string;
  display_name: string | null;
  address: string | null;
  lawd_cd: string | null;
  status: ApartmentStatus;
  memo: string | null;
};

export type ComparisonTransaction = PriceSummaryTransaction & {
  apartment_id: string;
};

export type ComparisonBasicInfo = {
  apartment_id: string;
  household_count: number | null;
  building_count: number | null;
  parking_count: number | null;
  approval_date: string | null;
  fetched_at: string | null;
};

export type ApartmentComparisonRow = {
  id: string;
  name: string;
  address: string | null;
  lawdCd: string | null;
  status: ApartmentStatus;
  memo: string | null;
  latestDealDate: string | null;
  latestPriceKrw: number | null;
  latestAreaBucket: string | null;
  transactionCount: number;
  householdCount: number | null;
  buildingCount: number | null;
  parkingCount: number | null;
  parkingPerHousehold: number | null;
  approvalDate: string | null;
  buildingAgeYears: number | null;
  basicInfoFetchedAt: string | null;
  areaSummaries: Array<{
    areaBucket: string;
    latestDealDate: string;
    latestPriceKrw: number;
    averagePriceKrw: number;
    transactionCount: number;
  }>;
};

export function buildApartmentComparisonRows(
  apartments: ComparisonApartment[],
  transactions: ComparisonTransaction[],
  basicInfos: ComparisonBasicInfo[] = [],
): ApartmentComparisonRow[] {
  const latestBasicInfoByApartmentId = getLatestBasicInfoByApartmentId(basicInfos);

  return apartments.map((apartment) => {
    const apartmentTransactions = transactions.filter(
      (transaction) => transaction.apartment_id === apartment.id,
    );
    const priceSummary = summarizeApartmentPrices(apartmentTransactions);
    const latestSummary = priceSummary.areaSummaries[0] ?? null;
    const transactionCount = priceSummary.areaSummaries.reduce(
      (sum, summary) => sum + summary.transactionCount,
      0,
    );
    const basicInfo = latestBasicInfoByApartmentId.get(apartment.id) ?? null;

    return {
      id: apartment.id,
      name: apartment.display_name ?? apartment.name,
      address: apartment.address,
      lawdCd: apartment.lawd_cd,
      status: apartment.status,
      memo: apartment.memo,
      latestDealDate: latestSummary?.latestDealDate ?? null,
      latestPriceKrw: latestSummary?.latestPriceKrw ?? null,
      latestAreaBucket: latestSummary?.areaBucket ?? null,
      transactionCount,
      householdCount: basicInfo?.household_count ?? null,
      buildingCount: basicInfo?.building_count ?? null,
      parkingCount: basicInfo?.parking_count ?? null,
      parkingPerHousehold: getParkingPerHousehold(
        basicInfo?.parking_count ?? null,
        basicInfo?.household_count ?? null,
      ),
      approvalDate: basicInfo?.approval_date ?? null,
      buildingAgeYears: getBuildingAgeYears(basicInfo?.approval_date ?? null),
      basicInfoFetchedAt: basicInfo?.fetched_at ?? null,
      areaSummaries: priceSummary.areaSummaries.map((summary) => ({
        areaBucket: summary.areaBucket,
        latestDealDate: summary.latestDealDate,
        latestPriceKrw: summary.latestPriceKrw,
        averagePriceKrw: summary.averagePriceKrw,
        transactionCount: summary.transactionCount,
      })),
    };
  });
}

function getLatestBasicInfoByApartmentId(basicInfos: ComparisonBasicInfo[]) {
  const latestByApartmentId = new Map<string, ComparisonBasicInfo>();

  for (const basicInfo of basicInfos) {
    const current = latestByApartmentId.get(basicInfo.apartment_id);

    if (!current || compareFetchedAt(basicInfo, current) > 0) {
      latestByApartmentId.set(basicInfo.apartment_id, basicInfo);
    }
  }

  return latestByApartmentId;
}

function compareFetchedAt(
  left: ComparisonBasicInfo,
  right: ComparisonBasicInfo,
) {
  return (left.fetched_at ?? "").localeCompare(right.fetched_at ?? "");
}

function getParkingPerHousehold(
  parkingCount: number | null,
  householdCount: number | null,
) {
  if (
    parkingCount === null ||
    householdCount === null ||
    householdCount <= 0
  ) {
    return null;
  }

  return parkingCount / householdCount;
}

function getBuildingAgeYears(approvalDate: string | null, today = new Date()) {
  if (!approvalDate) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(approvalDate);

  if (!match) {
    return null;
  }

  const approvalYear = Number(match[1]);
  const approvalMonth = Number(match[2]);
  const approvalDay = Number(match[3]);

  if (
    !Number.isInteger(approvalYear) ||
    !Number.isInteger(approvalMonth) ||
    !Number.isInteger(approvalDay)
  ) {
    return null;
  }

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const hasPassedAnniversary =
    currentMonth > approvalMonth ||
    (currentMonth === approvalMonth && currentDay >= approvalDay);

  return Math.max(
    0,
    currentYear - approvalYear - (hasPassedAnniversary ? 0 : 1),
  );
}
