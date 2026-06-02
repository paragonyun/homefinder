import type { ApartmentStatus } from "../../types/apartment";
import {
  buildCommuteAccessSummaryByApartment,
  type CommuteSummary,
  type CommuteTimeLike,
} from "./commute-summary";
import {
  summarizeApartmentPrices,
  type PriceSummaryTransaction,
} from "./price-summary";
import {
  buildLatestFieldNoteSummary,
  getLatestFieldNoteByApartmentId,
  type FieldNoteSummaryInput,
} from "./field-note-summary";

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

export type ComparisonBuildingInfo = {
  apartment_id: string;
  floor_area_ratio: number | null;
  building_coverage_ratio: number | null;
  fetched_at: string | null;
};

export type ComparisonCommuteTime = CommuteTimeLike;

export type ComparisonFieldNote = FieldNoteSummaryInput;

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
  floorAreaRatio: number | null;
  buildingCoverageRatio: number | null;
  approvalDate: string | null;
  buildingAgeYears: number | null;
  basicInfoFetchedAt: string | null;
  buildingInfoFetchedAt: string | null;
  fieldNoteDate: string | null;
  fieldNoteRating: number | null;
  fieldNoteConclusion: string | null;
  fieldNoteRecheck: string | null;
  fieldNoteUpdatedAt: string | null;
  commuteToYeouido: CommuteSummary | null;
  commuteToGangnam: CommuteSummary | null;
  driveToYeouido: CommuteSummary | null;
  driveToGangnam: CommuteSummary | null;
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
  commuteTimes: ComparisonCommuteTime[] = [],
  buildingInfos: ComparisonBuildingInfo[] = [],
  fieldNotes: ComparisonFieldNote[] = [],
): ApartmentComparisonRow[] {
  const latestBasicInfoByApartmentId = getLatestBasicInfoByApartmentId(basicInfos);
  const latestBuildingInfoByApartmentId =
    getLatestBuildingInfoByApartmentId(buildingInfos);
  const latestFieldNoteByApartmentId =
    getLatestFieldNoteByApartmentId(fieldNotes);
  const commuteSummaryByApartmentId =
    buildCommuteAccessSummaryByApartment(commuteTimes);

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
    const buildingInfo =
      latestBuildingInfoByApartmentId.get(apartment.id) ?? null;
    const fieldNoteSummary = buildLatestFieldNoteSummary(
      latestFieldNoteByApartmentId.get(apartment.id) ?? null,
    );
    const commuteSummary = commuteSummaryByApartmentId.get(apartment.id) ?? null;

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
      floorAreaRatio: buildingInfo?.floor_area_ratio ?? null,
      buildingCoverageRatio: buildingInfo?.building_coverage_ratio ?? null,
      approvalDate: basicInfo?.approval_date ?? null,
      buildingAgeYears: getBuildingAgeYears(basicInfo?.approval_date ?? null),
      basicInfoFetchedAt: basicInfo?.fetched_at ?? null,
      buildingInfoFetchedAt: buildingInfo?.fetched_at ?? null,
      fieldNoteDate: fieldNoteSummary?.visitDate ?? null,
      fieldNoteRating: fieldNoteSummary?.overallRating ?? null,
      fieldNoteConclusion: fieldNoteSummary?.conclusion ?? null,
      fieldNoteRecheck: fieldNoteSummary?.recheckText ?? null,
      fieldNoteUpdatedAt: fieldNoteSummary?.updatedAt ?? null,
      commuteToYeouido: commuteSummary?.yeouido_station.transit ?? null,
      commuteToGangnam: commuteSummary?.gangnam_station.transit ?? null,
      driveToYeouido: commuteSummary?.yeouido_station.driving ?? null,
      driveToGangnam: commuteSummary?.gangnam_station.driving ?? null,
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

function getLatestBuildingInfoByApartmentId(
  buildingInfos: ComparisonBuildingInfo[],
) {
  const latestByApartmentId = new Map<string, ComparisonBuildingInfo>();

  for (const buildingInfo of buildingInfos) {
    const current = latestByApartmentId.get(buildingInfo.apartment_id);

    if (
      !current ||
      (buildingInfo.fetched_at ?? "").localeCompare(current.fetched_at ?? "") > 0
    ) {
      latestByApartmentId.set(buildingInfo.apartment_id, buildingInfo);
    }
  }

  return latestByApartmentId;
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
