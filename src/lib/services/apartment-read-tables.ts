import type {
  ApartmentBasicInfoRow,
  ApartmentBuildingInfoRow,
  ApartmentTransactionRow,
  CommuteTimeRow,
  FieldNoteRow,
} from "@/lib/supabase/table-types";

type ReadError = {
  code?: string;
  message: string;
};

type ReadResponse<T> = {
  data: T[] | null;
  error: ReadError | null;
};

type ReadQuery<T> = PromiseLike<ReadResponse<T>> & {
  in: (column: string, values: string[]) => ReadQuery<T>;
  limit: (count: number) => ReadQuery<T>;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => ReadQuery<T>;
  select: (columns: string) => ReadQuery<T>;
};

type ReadFromBuilder = {
  select: (columns: string) => ReadQuery<unknown>;
};

export type ApartmentReadClient = {
  from: (table: string) => ReadFromBuilder;
};

export type ApartmentReadProjection = "comparison" | "dashboard";

export type ApartmentReadTables = {
  basicInfos: ApartmentBasicInfoRow[];
  buildingInfos: ApartmentBuildingInfoRow[];
  commuteTimes: CommuteTimeRow[];
  fieldNotes: FieldNoteRow[];
  notices: string[];
  transactions: ApartmentTransactionRow[];
};

const emptyReadTables: ApartmentReadTables = {
  basicInfos: [],
  buildingInfos: [],
  commuteTimes: [],
  fieldNotes: [],
  notices: [],
  transactions: [],
};

export async function fetchApartmentReadTables(
  client: ApartmentReadClient,
  apartmentIds: string[],
  projection: ApartmentReadProjection,
): Promise<ApartmentReadTables> {
  if (apartmentIds.length === 0) {
    return emptyReadTables;
  }

  const [
    transactionResult,
    basicInfoResult,
    buildingInfoResult,
    commuteResult,
    fieldNoteResult,
  ] = await Promise.all([
    queryTransactions(client, apartmentIds, projection),
    queryBasicInfos(client, apartmentIds, projection),
    queryBuildingInfos(client, apartmentIds, projection),
    queryCommuteTimes(client, apartmentIds, projection),
    queryFieldNotes(client, apartmentIds, projection),
  ]);

  const transactionRows = readRows<ApartmentTransactionRow>(
    transactionResult,
    false,
  );
  const basicInfoRows = readRows<ApartmentBasicInfoRow>(basicInfoResult, true);
  const buildingInfoRows = readRows<ApartmentBuildingInfoRow>(
    buildingInfoResult,
    true,
  );
  const commuteRows = readRows<CommuteTimeRow>(commuteResult, true);
  const fieldNoteRows = readRows<FieldNoteRow>(fieldNoteResult, true);

  return {
    basicInfos: basicInfoRows.rows,
    buildingInfos: buildingInfoRows.rows,
    commuteTimes: commuteRows.rows,
    fieldNotes: fieldNoteRows.rows,
    notices: [
      transactionRows.notice,
      basicInfoRows.notice,
      buildingInfoRows.notice,
      commuteRows.notice,
      fieldNoteRows.notice,
    ].filter((notice): notice is string => Boolean(notice)),
    transactions: transactionRows.rows,
  };
}

function queryTransactions(
  client: ApartmentReadClient,
  apartmentIds: string[],
  projection: ApartmentReadProjection,
) {
  const columns =
    projection === "dashboard"
      ? "apartment_id,deal_amount_krw,deal_date"
      : "*";
  const query = client
    .from("apartment_transactions")
    .select(columns)
    .in("apartment_id", apartmentIds);

  return projection === "comparison"
    ? query.order("deal_date", { ascending: false }).limit(2000)
    : query;
}

function queryBasicInfos(
  client: ApartmentReadClient,
  apartmentIds: string[],
  projection: ApartmentReadProjection,
) {
  const columns =
    projection === "dashboard"
      ? "apartment_id,household_count,parking_count,approval_date,fetched_at"
      : "*";
  const query = client
    .from("apartment_basic_info")
    .select(columns)
    .in("apartment_id", apartmentIds);

  return projection === "comparison"
    ? query.order("fetched_at", { ascending: false })
    : query;
}

function queryBuildingInfos(
  client: ApartmentReadClient,
  apartmentIds: string[],
  projection: ApartmentReadProjection,
) {
  const columns =
    projection === "dashboard"
      ? "apartment_id,floor_area_ratio,building_coverage_ratio,fetched_at"
      : "*";
  const query = client
    .from("apartment_building_info")
    .select(columns)
    .in("apartment_id", apartmentIds);

  return projection === "comparison"
    ? query.order("fetched_at", { ascending: false })
    : query;
}

function queryCommuteTimes(
  client: ApartmentReadClient,
  apartmentIds: string[],
  projection: ApartmentReadProjection,
) {
  const columns =
    projection === "dashboard"
      ? "apartment_id,destination_key,transport_type,duration_minutes"
      : "*";
  const query = client
    .from("commute_times")
    .select(columns)
    .in("apartment_id", apartmentIds);

  return projection === "comparison"
    ? query.order("fetched_at", { ascending: false })
    : query;
}

function queryFieldNotes(
  client: ApartmentReadClient,
  apartmentIds: string[],
  projection: ApartmentReadProjection,
) {
  const columns =
    projection === "dashboard"
      ? "apartment_id,visit_date,station_walk_rating,slope_rating,complex_condition_rating,parking_rating,noise_rating,night_mood_rating,commercial_area_rating,overall_rating,revisit_intention,overall_memo,bad_points,parking_note,noise_note,slope_note,created_at,updated_at"
      : "*";
  const query = client
    .from("field_notes")
    .select(columns)
    .in("apartment_id", apartmentIds);

  return projection === "comparison"
    ? query
        .order("visit_date", { ascending: false })
        .order("updated_at", { ascending: false })
    : query;
}

function readRows<T>(
  result: ReadResponse<unknown>,
  allowMissingTable: boolean,
): { notice: string | null; rows: T[] } {
  if (!result.error) {
    return { notice: null, rows: (result.data ?? []) as T[] };
  }

  if (allowMissingTable && isMissingTableError(result.error)) {
    return { notice: null, rows: [] };
  }

  return { notice: result.error.message, rows: [] };
}

function isMissingTableError(error: ReadError) {
  return error.code === "42P01" || error.code === "PGRST205";
}
