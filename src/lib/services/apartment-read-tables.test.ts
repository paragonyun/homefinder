import { describe, expect, it } from "vitest";
import { fetchApartmentReadTables } from "./apartment-read-tables";

type ReadError = {
  code?: string;
  message: string;
};

type ReadResult = {
  data?: unknown[] | null;
  error?: ReadError | null;
};

type QueryCall = {
  table: string;
  select: string | null;
  inFilter: { column: string; values: string[] } | null;
  orders: string[];
  limit: number | null;
};

type QueryBuilder = PromiseLike<{ data: unknown[] | null; error: ReadError | null }> & {
  in: (column: string, values: string[]) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => QueryBuilder;
  select: (columns: string) => QueryBuilder;
};

function createReadClient(results: Record<string, ReadResult>) {
  const calls: QueryCall[] = [];

  const client = {
    from(table: string) {
      const call: QueryCall = {
        table,
        select: null,
        inFilter: null,
        orders: [],
        limit: null,
      };
      calls.push(call);

      const builder: QueryBuilder = {
        select(columns) {
          call.select = columns;
          return builder;
        },
        in(column, values) {
          call.inFilter = { column, values };
          return builder;
        },
        order(column, options) {
          call.orders.push(
            `${column}:${options?.ascending === false ? "desc" : "asc"}`,
          );
          return builder;
        },
        limit(count) {
          call.limit = count;
          return builder;
        },
        then(onfulfilled, onrejected) {
          const result = results[table] ?? { data: [] };

          return Promise.resolve({
            data: result.data ?? [],
            error: result.error ?? null,
          }).then(onfulfilled, onrejected);
        },
      };

      return builder;
    },
  };

  return { calls, client };
}

describe("fetchApartmentReadTables", () => {
  it("ignores missing optional tables while keeping available transaction rows", async () => {
    const { calls, client } = createReadClient({
      apartment_transactions: {
        data: [{ apartment_id: "apt-1", deal_amount_krw: 1_000_000_000 }],
      },
      apartment_basic_info: {
        error: {
          code: "42P01",
          message: "apartment_basic_info does not exist",
        },
      },
      apartment_building_info: {
        error: {
          code: "PGRST205",
          message: "apartment_building_info does not exist",
        },
      },
      commute_times: { data: [{ apartment_id: "apt-1" }] },
      field_notes: { data: [] },
    });

    const result = await fetchApartmentReadTables(
      client,
      ["apt-1"],
      "dashboard",
    );

    expect(result.transactions).toEqual([
      { apartment_id: "apt-1", deal_amount_krw: 1_000_000_000 },
    ]);
    expect(result.basicInfos).toEqual([]);
    expect(result.buildingInfos).toEqual([]);
    expect(result.commuteTimes).toEqual([{ apartment_id: "apt-1" }]);
    expect(result.notices).toEqual([]);
    expect(calls.map((call) => call.table)).toEqual([
      "apartment_transactions",
      "apartment_basic_info",
      "apartment_building_info",
      "commute_times",
      "field_notes",
    ]);
  });

  it("returns a notice and empty rows for non-missing table errors", async () => {
    const { client } = createReadClient({
      apartment_transactions: { data: [] },
      apartment_basic_info: {
        error: { code: "42501", message: "permission denied" },
      },
      apartment_building_info: { data: [] },
      commute_times: { data: [] },
      field_notes: { data: [] },
    });

    const result = await fetchApartmentReadTables(
      client,
      ["apt-1"],
      "comparison",
    );

    expect(result.basicInfos).toEqual([]);
    expect(result.notices).toEqual(["permission denied"]);
  });

  it("uses dashboard and comparison projections without changing filters", async () => {
    const dashboard = createReadClient({});
    const comparison = createReadClient({});

    await fetchApartmentReadTables(dashboard.client, ["apt-1"], "dashboard");
    await fetchApartmentReadTables(comparison.client, ["apt-1"], "comparison");

    expect(dashboard.calls[0]).toMatchObject({
      table: "apartment_transactions",
      select: "apartment_id,deal_amount_krw,deal_date",
      inFilter: { column: "apartment_id", values: ["apt-1"] },
      orders: [],
      limit: null,
    });
    expect(comparison.calls[0]).toMatchObject({
      table: "apartment_transactions",
      select: "*",
      inFilter: { column: "apartment_id", values: ["apt-1"] },
      orders: ["deal_date:desc"],
      limit: 2000,
    });
    expect(comparison.calls[4].orders).toEqual([
      "visit_date:desc",
      "updated_at:desc",
    ]);
  });
});
