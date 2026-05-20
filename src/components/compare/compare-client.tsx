"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth/auth-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { apartments as mockApartments } from "@/lib/mock-data";
import { buildApartmentComparisonRows } from "@/lib/services/apartment-comparison";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type {
  ApartmentBasicInfoRow,
  ApartmentRowData,
  ApartmentTransactionRow,
} from "@/lib/supabase/table-types";
import { formatDate } from "@/utils/date";
import { formatKrw } from "@/utils/format-price";

export function CompareClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [apartments, setApartments] = useState<ApartmentRowData[]>([]);
  const [transactions, setTransactions] = useState<ApartmentTransactionRow[]>([]);
  const [basicInfos, setBasicInfos] = useState<ApartmentBasicInfoRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  const loadData = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const { data: apartmentData, error: apartmentError } = await supabase
      .from("apartments")
      .select("*")
      .order("updated_at", { ascending: false });

    if (apartmentError) {
      setMessage(apartmentError.message);
      setIsLoading(false);
      return;
    }

    const nextApartments = (apartmentData ?? []) as ApartmentRowData[];
    const apartmentIds = nextApartments.map((apartment) => apartment.id);

    setApartments(nextApartments);

    if (apartmentIds.length === 0) {
      setTransactions([]);
      setBasicInfos([]);
      setIsLoading(false);
      return;
    }

    const [transactionResult, basicInfoResult] = await Promise.all([
      supabase
        .from("apartment_transactions")
        .select("*")
        .in("apartment_id", apartmentIds)
        .order("deal_date", { ascending: false })
        .limit(2000),
      supabase
        .from("apartment_basic_info")
        .select("*")
        .in("apartment_id", apartmentIds)
        .order("fetched_at", { ascending: false }),
    ]);
    const messages: string[] = [];

    if (transactionResult.error) {
      messages.push(transactionResult.error.message);
      setTransactions([]);
    } else {
      setTransactions(
        (transactionResult.data ?? []) as ApartmentTransactionRow[],
      );
    }

    if (basicInfoResult.error) {
      if (!isMissingTableError(basicInfoResult.error)) {
        messages.push(basicInfoResult.error.message);
      }

      setBasicInfos([]);
    } else {
      setBasicInfos((basicInfoResult.data ?? []) as ApartmentBasicInfoRow[]);
    }

    if (messages.length > 0) {
      setMessage(messages.join(" / "));
    }

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);

      if (data.session) {
        void loadData();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);

      if (nextSession) {
        void loadData();
      } else {
        setApartments([]);
        setTransactions([]);
        setBasicInfos([]);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadData, supabase]);

  const rows = useMemo(
    () => buildApartmentComparisonRows(apartments, transactions, basicInfos),
    [apartments, transactions, basicInfos],
  );
  const rowsWithTransactions = rows.filter(
    (row) => row.transactionCount > 0,
  ).length;
  const rowsWithBasicInfo = rows.filter(
    (row) => row.basicInfoFetchedAt !== null,
  ).length;

  if (!isSupabaseConfigured) {
    return (
      <div className="grid gap-4">
        <AuthPanel />
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
          Supabase 환경변수가 없어 예시 비교표를 표시합니다. 환경변수를
          연결하면 등록한 단지, 실거래가, K-apt 기본정보 기준으로 비교표가
          바뀝니다.
        </p>
        <MockCompareTable />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <AuthPanel />

      {!session ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
          로그인하면 등록한 관심 단지의 실거래가와 K-apt 기본정보를 한 표에서
          비교할 수 있습니다.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </p>
      ) : null}

      {session ? (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">
                단지 비교표
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                등록한 단지의 국토부 실거래가와 K-apt 세대수, 주차, 사용승인일을
                함께 비교합니다.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Metric label="등록 단지" value={`${rows.length}개`} />
              <Metric label="가격 데이터" value={`${rowsWithTransactions}개`} />
              <Metric label="K-apt 정보" value={`${rowsWithBasicInfo}개`} />
            </div>
          </div>

          {isLoading ? (
            <p className="p-5 text-sm text-slate-600">
              비교 데이터를 불러오는 중입니다.
            </p>
          ) : rows.length > 0 ? (
            <ComparisonTable rows={rows} />
          ) : (
            <div className="grid gap-3 p-5 text-sm leading-6 text-slate-600">
              <p>아직 등록한 관심 단지가 없습니다.</p>
              <Link
                href="/apartments"
                className="w-fit rounded-md bg-slate-950 px-4 py-2 font-semibold text-white transition hover:bg-emerald-800"
              >
                단지 추가하러 가기
              </Link>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function ComparisonTable({
  rows,
}: Readonly<{
  rows: ReturnType<typeof buildApartmentComparisonRows>;
}>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] text-left">
        <thead className="bg-slate-50 text-sm text-slate-600">
          <tr>
            <th className="px-4 py-3 font-semibold">단지</th>
            <th className="px-4 py-3 font-semibold">상태</th>
            <th className="px-4 py-3 font-semibold">최근 실거래가</th>
            <th className="px-4 py-3 font-semibold">평형대 요약</th>
            <th className="px-4 py-3 font-semibold">K-apt 기본정보</th>
            <th className="px-4 py-3 font-semibold">법정동코드</th>
            <th className="px-4 py-3 font-semibold">메모</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-200 last:border-0">
              <td className="px-4 py-4 align-top">
                <Link
                  href={`/apartments/${row.id}`}
                  className="font-semibold text-slate-950 hover:text-emerald-800"
                >
                  {row.name}
                </Link>
                <p className="mt-1 max-w-64 text-xs leading-5 text-slate-500">
                  {row.address ?? "주소 미입력"}
                </p>
              </td>
              <td className="px-4 py-4 align-top">
                <StatusPill status={row.status} />
              </td>
              <td className="px-4 py-4 align-top text-sm text-slate-700">
                {row.latestPriceKrw !== null ? (
                  <>
                    <p className="font-semibold text-slate-950">
                      {formatKrw(row.latestPriceKrw)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.latestDealDate ? formatDate(row.latestDealDate) : "-"} ·{" "}
                      {row.latestAreaBucket}㎡대
                    </p>
                  </>
                ) : (
                  "수집 전"
                )}
              </td>
              <td className="px-4 py-4 align-top text-sm text-slate-700">
                {row.areaSummaries.length > 0 ? (
                  <div className="grid gap-1">
                    {row.areaSummaries.slice(0, 3).map((summary) => (
                      <p key={summary.areaBucket}>
                        {summary.areaBucket}㎡대 · 최근{" "}
                        {formatKrw(summary.latestPriceKrw)} · 평균{" "}
                        {formatKrw(summary.averagePriceKrw)} ·{" "}
                        {summary.transactionCount}건
                      </p>
                    ))}
                  </div>
                ) : (
                  "실거래가 없음"
                )}
              </td>
              <td className="px-4 py-4 align-top text-sm text-slate-700">
                <BasicInfoSummary row={row} />
              </td>
              <td className="px-4 py-4 align-top text-sm text-slate-700">
                {row.lawdCd ?? "-"}
              </td>
              <td className="px-4 py-4 align-top text-sm leading-6 text-slate-700">
                {row.memo ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BasicInfoSummary({
  row,
}: Readonly<{
  row: ReturnType<typeof buildApartmentComparisonRows>[number];
}>) {
  const hasBasicInfo =
    row.householdCount !== null ||
    row.parkingCount !== null ||
    row.approvalDate !== null;

  if (!hasBasicInfo) {
    return <span className="text-slate-500">K-apt 정보 없음</span>;
  }

  return (
    <div className="grid gap-1">
      <p>
        {formatOptionalCount(row.householdCount, "세대")} ·{" "}
        {formatOptionalCount(row.parkingCount, "대 주차")}
      </p>
      <p className="text-xs text-slate-500">
        사용승인 {row.approvalDate ? formatDate(row.approvalDate) : "-"}
      </p>
      {row.basicInfoFetchedAt ? (
        <p className="text-xs text-slate-500">
          갱신 {formatDate(row.basicInfoFetchedAt)}
        </p>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function MockCompareTable() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">단지</th>
              <th className="px-4 py-3 font-semibold">상태</th>
              <th className="px-4 py-3 font-semibold">최근 실거래가</th>
              <th className="px-4 py-3 font-semibold">평형대</th>
              <th className="px-4 py-3 font-semibold">K-apt 기본정보</th>
              <th className="px-4 py-3 font-semibold">메모</th>
            </tr>
          </thead>
          <tbody>
            {mockApartments.map((apartment) => (
              <tr
                key={apartment.id}
                className="border-b border-slate-200 last:border-0"
              >
                <td className="px-4 py-4 font-semibold text-slate-950">
                  {apartment.name}
                </td>
                <td className="px-4 py-4">
                  <StatusPill status={apartment.status} />
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  {apartment.latestPrice}
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  {apartment.areaSummary}
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">연동 전</td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  {apartment.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatOptionalCount(value: number | null, suffix: string) {
  return value !== null ? `${value.toLocaleString("ko-KR")}${suffix}` : "-";
}

function isMissingTableError(error: { code?: string }) {
  return error.code === "42P01" || error.code === "PGRST205";
}
