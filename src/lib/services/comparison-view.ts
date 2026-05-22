import type { ApartmentStatus } from "@/types/apartment";
import type { ApartmentComparisonRow } from "./apartment-comparison";

export type ComparisonDataFilter =
  | "all"
  | "has-price"
  | "missing-price"
  | "has-kapt"
  | "missing-kapt"
  | "needs-sync";

export type ComparisonStatusFilter = "all" | ApartmentStatus;

export type ComparisonViewFilters = {
  query: string;
  status: ComparisonStatusFilter;
  data: ComparisonDataFilter;
};

export function filterComparisonRows(
  rows: ApartmentComparisonRow[],
  filters: ComparisonViewFilters,
) {
  const query = filters.query.trim().toLowerCase();

  return rows.filter((row) => {
    const matchesQuery =
      query.length === 0 ||
      [row.name, row.address, row.memo, row.lawdCd]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    const matchesStatus =
      filters.status === "all" || row.status === filters.status;

    return matchesQuery && matchesStatus && matchesDataFilter(row, filters.data);
  });
}

export function getComparisonMetrics(rows: ApartmentComparisonRow[]) {
  return {
    total: rows.length,
    withPrice: rows.filter((row) => row.transactionCount > 0).length,
    withKapt: rows.filter((row) => hasBasicInfo(row)).length,
    needsSync: rows.filter((row) => needsSync(row)).length,
  };
}

export function hasBasicInfo(row: ApartmentComparisonRow) {
  return (
    row.householdCount !== null ||
    row.parkingCount !== null ||
    row.approvalDate !== null ||
    row.basicInfoFetchedAt !== null
  );
}

export function needsSync(row: ApartmentComparisonRow) {
  return row.transactionCount === 0 || !hasBasicInfo(row);
}

function matchesDataFilter(
  row: ApartmentComparisonRow,
  filter: ComparisonDataFilter,
) {
  if (filter === "has-price") {
    return row.transactionCount > 0;
  }

  if (filter === "missing-price") {
    return row.transactionCount === 0;
  }

  if (filter === "has-kapt") {
    return hasBasicInfo(row);
  }

  if (filter === "missing-kapt") {
    return !hasBasicInfo(row);
  }

  if (filter === "needs-sync") {
    return needsSync(row);
  }

  return true;
}
