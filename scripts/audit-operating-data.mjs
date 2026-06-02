import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

loadEnvFile(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [
  apartmentRows,
  transactionRows,
  basicInfoRows,
  buildingInfoRows,
  commuteRows,
  fieldNoteRows,
  kaptDirectoryRows,
] = await Promise.all([
  selectRows("apartments", "id,name,display_name,address,lawd_cd,kapt_code,status"),
  selectRows("apartment_transactions", "apartment_id,deal_date"),
  selectRows(
    "apartment_basic_info",
    "apartment_id,household_count,building_count,parking_count,approval_date,kapt_code,fetched_at",
  ),
  selectRows(
    "apartment_building_info",
    "apartment_id,floor_area_ratio,building_coverage_ratio,land_area_m2,fetched_at",
  ),
  selectRows(
    "commute_times",
    "apartment_id,destination_key,transport_type,duration_minutes,fetched_at",
  ),
  selectRows("field_notes", "apartment_id,visit_date,updated_at"),
  selectRows("kapt_code_directory", "kapt_code,bjd_code"),
]);

const apartments = apartmentRows.data;
const transactionsByApartment = countBy(transactionRows.data, "apartment_id");
const latestBasicInfoByApartment = latestByApartmentId(basicInfoRows.data);
const latestBuildingInfoByApartment = latestByApartmentId(buildingInfoRows.data);
const commuteCoverage = buildCommuteCoverage(commuteRows.data);
const fieldNotesByApartment = countBy(fieldNoteRows.data, "apartment_id");

const rows = apartments.map((apartment) => {
  const basicInfo = latestBasicInfoByApartment.get(apartment.id) ?? null;
  const buildingInfo = latestBuildingInfoByApartment.get(apartment.id) ?? null;
  const commute = commuteCoverage.get(apartment.id) ?? emptyCommuteCoverage();

  return {
    id: apartment.id,
    name: apartment.display_name ?? apartment.name,
    status: apartment.status,
    hasLawdCode: Boolean(apartment.lawd_cd),
    hasKaptCode: Boolean(apartment.kapt_code),
    transactionCount: transactionsByApartment.get(apartment.id) ?? 0,
    hasBasicInfo: Boolean(basicInfo),
    hasHouseholds: isPositiveNumber(basicInfo?.household_count),
    hasParking: isPositiveNumber(basicInfo?.parking_count),
    hasBuildingDensity:
      isPositiveNumber(buildingInfo?.floor_area_ratio) ||
      isPositiveNumber(buildingInfo?.building_coverage_ratio),
    hasZeroBuildingDensity:
      buildingInfo?.floor_area_ratio === 0 ||
      buildingInfo?.building_coverage_ratio === 0,
    hasTransitToGangnam: commute.gangnamTransit,
    hasTransitToYeouido: commute.yeouidoTransit,
    hasDrivingToGangnam: commute.gangnamDriving,
    hasDrivingToYeouido: commute.yeouidoDriving,
    fieldNoteCount: fieldNotesByApartment.get(apartment.id) ?? 0,
  };
});

const tableResults = {
  apartments: apartmentRows,
  apartment_transactions: transactionRows,
  apartment_basic_info: basicInfoRows,
  apartment_building_info: buildingInfoRows,
  commute_times: commuteRows,
  field_notes: fieldNoteRows,
  kapt_code_directory: kaptDirectoryRows,
};
const blockingErrors = Object.entries(tableResults)
  .filter(([, result]) => result.error && result.error !== "missing table")
  .map(([table, result]) => `${table}: ${result.error}`);

const report = {
  generatedAt: new Date().toISOString(),
  blockingErrors,
  tables: Object.fromEntries(
    Object.entries(tableResults).map(([table, result]) => [
      table,
      tableState(result),
    ]),
  ),
  summary: {
    apartments: rows.length,
    withTransactions: countRows(rows, (row) => row.transactionCount > 0),
    withKaptCode: countRows(rows, (row) => row.hasKaptCode),
    withBasicInfo: countRows(rows, (row) => row.hasBasicInfo),
    withBuildingDensity: countRows(rows, (row) => row.hasBuildingDensity),
    withAnyCommute: countRows(
      rows,
      (row) =>
        row.hasTransitToGangnam ||
        row.hasTransitToYeouido ||
        row.hasDrivingToGangnam ||
        row.hasDrivingToYeouido,
    ),
    withFieldNotes: countRows(rows, (row) => row.fieldNoteCount > 0),
    kaptDirectoryRows: kaptDirectoryRows.data.length,
  },
  actionItems: {
    missingLawdCode: pickNames(rows, (row) => !row.hasLawdCode),
    missingKaptCode: pickNames(rows, (row) => !row.hasKaptCode),
    missingTransactions: pickNames(rows, (row) => row.transactionCount === 0),
    missingBasicInfo: pickNames(rows, (row) => !row.hasBasicInfo),
    missingBuildingDensity: pickNames(rows, (row) => !row.hasBuildingDensity),
    zeroBuildingDensity: pickNames(rows, (row) => row.hasZeroBuildingDensity),
    missingCommute: pickNames(
      rows,
      (row) =>
        !row.hasTransitToGangnam &&
        !row.hasTransitToYeouido &&
        !row.hasDrivingToGangnam &&
        !row.hasDrivingToYeouido,
    ),
    missingFieldNotes: pickNames(rows, (row) => row.fieldNoteCount === 0),
  },
};

console.log(JSON.stringify(report, null, 2));

if (blockingErrors.length > 0) {
  process.exitCode = 1;
}

async function selectRows(table, columns) {
  const { data, error } = await supabase.from(table).select(columns);

  if (!error) {
    return { data: data ?? [], error: null };
  }

  if (error.code === "42P01" || error.code === "PGRST205") {
    return { data: [], error: "missing table" };
  }

  return { data: [], error: error.message };
}

function tableState(result) {
  return {
    rows: result.data.length,
    error: result.error,
  };
}

function latestByApartmentId(rows) {
  const byApartmentId = new Map();

  for (const row of rows) {
    const current = byApartmentId.get(row.apartment_id);

    if (!current || (row.fetched_at ?? "") > (current.fetched_at ?? "")) {
      byApartmentId.set(row.apartment_id, row);
    }
  }

  return byApartmentId;
}

function countBy(rows, key) {
  const counts = new Map();

  for (const row of rows) {
    const value = row[key];

    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function buildCommuteCoverage(rows) {
  const byApartmentId = new Map();

  for (const row of rows) {
    if (!row.apartment_id || !row.destination_key || !row.transport_type) {
      continue;
    }

    const coverage = byApartmentId.get(row.apartment_id) ?? emptyCommuteCoverage();
    const hasDuration = isPositiveNumber(row.duration_minutes);

    if (row.destination_key === "gangnam_station") {
      if (row.transport_type === "transit") {
        coverage.gangnamTransit ||= hasDuration;
      }

      if (row.transport_type === "driving") {
        coverage.gangnamDriving ||= hasDuration;
      }
    }

    if (row.destination_key === "yeouido_station") {
      if (row.transport_type === "transit") {
        coverage.yeouidoTransit ||= hasDuration;
      }

      if (row.transport_type === "driving") {
        coverage.yeouidoDriving ||= hasDuration;
      }
    }

    byApartmentId.set(row.apartment_id, coverage);
  }

  return byApartmentId;
}

function emptyCommuteCoverage() {
  return {
    gangnamTransit: false,
    gangnamDriving: false,
    yeouidoTransit: false,
    yeouidoDriving: false,
  };
}

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function countRows(rows, predicate) {
  return rows.filter(predicate).length;
}

function pickNames(rows, predicate, limit = 10) {
  return rows
    .filter(predicate)
    .slice(0, limit)
    .map((row) => row.name);
}

function loadEnvFile(path) {
  const fullPath = resolve(path);

  if (!existsSync(fullPath)) {
    return;
  }

  const content = readFileSync(fullPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");

    if (!key || process.env[key]) {
      continue;
    }

    process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
  }
}
