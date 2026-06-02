"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth/auth-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { apartments as mockApartments, statusLabels } from "@/lib/mock-data";
import { buildApartmentComparisonRows } from "@/lib/services/apartment-comparison";
import { formatBuildingDensityRatio } from "@/lib/services/building-density";
import {
  filterComparisonRows,
  getComparisonMetrics,
  hasBasicInfo,
  hasCommuteInfo,
  needsSync,
  type ComparisonDataFilter,
  type ComparisonStatusFilter,
} from "@/lib/services/comparison-view";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type {
  ApartmentBasicInfoRow,
  ApartmentBuildingInfoRow,
  ApartmentRowData,
  ApartmentTransactionRow,
  CommuteTimeRow,
  FieldNoteRow,
} from "@/lib/supabase/table-types";
import { formatDate } from "@/utils/date";
import { formatKrw } from "@/utils/format-price";

export function CompareClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [apartments, setApartments] = useState<ApartmentRowData[]>([]);
  const [transactions, setTransactions] = useState<ApartmentTransactionRow[]>([]);
  const [basicInfos, setBasicInfos] = useState<ApartmentBasicInfoRow[]>([]);
  const [buildingInfos, setBuildingInfos] = useState<ApartmentBuildingInfoRow[]>(
    [],
  );
  const [commuteTimes, setCommuteTimes] = useState<CommuteTimeRow[]>([]);
  const [fieldNotes, setFieldNotes] = useState<FieldNoteRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ComparisonStatusFilter>("all");
  const [dataFilter, setDataFilter] = useState<ComparisonDataFilter>("all");
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
      setBuildingInfos([]);
      setCommuteTimes([]);
      setFieldNotes([]);
      setIsLoading(false);
      return;
    }

    const [
      transactionResult,
      basicInfoResult,
      buildingInfoResult,
      commuteResult,
      fieldNoteResult,
    ] = await Promise.all([
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
        supabase
          .from("apartment_building_info")
          .select("*")
          .in("apartment_id", apartmentIds)
          .order("fetched_at", { ascending: false }),
        supabase
          .from("commute_times")
          .select("*")
          .in("apartment_id", apartmentIds)
          .order("fetched_at", { ascending: false }),
        supabase
          .from("field_notes")
          .select("*")
          .in("apartment_id", apartmentIds)
          .order("visit_date", { ascending: false })
          .order("updated_at", { ascending: false }),
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

    if (buildingInfoResult.error) {
      if (!isMissingTableError(buildingInfoResult.error)) {
        messages.push(buildingInfoResult.error.message);
      }

      setBuildingInfos([]);
    } else {
      setBuildingInfos(
        (buildingInfoResult.data ?? []) as ApartmentBuildingInfoRow[],
      );
    }

    if (commuteResult.error) {
      if (!isMissingTableError(commuteResult.error)) {
        messages.push(commuteResult.error.message);
      }

      setCommuteTimes([]);
    } else {
      setCommuteTimes((commuteResult.data ?? []) as CommuteTimeRow[]);
    }

    if (fieldNoteResult.error) {
      if (!isMissingTableError(fieldNoteResult.error)) {
        messages.push(fieldNoteResult.error.message);
      }

      setFieldNotes([]);
    } else {
      setFieldNotes((fieldNoteResult.data ?? []) as FieldNoteRow[]);
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
        setBuildingInfos([]);
        setCommuteTimes([]);
        setFieldNotes([]);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadData, supabase]);

  const rows = useMemo(
    () =>
      buildApartmentComparisonRows(
        apartments,
        transactions,
        basicInfos,
        commuteTimes,
        buildingInfos,
        fieldNotes,
      ),
    [
      apartments,
      basicInfos,
      buildingInfos,
      commuteTimes,
      fieldNotes,
      transactions,
    ],
  );
  const filteredRows = useMemo(
    () =>
      filterComparisonRows(rows, {
        query,
        status: statusFilter,
        data: dataFilter,
      }),
    [dataFilter, query, rows, statusFilter],
  );
  const metrics = useMemo(() => getComparisonMetrics(rows), [rows]);

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
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Compare
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
                  단지 비교
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  등록한 단지의 실거래가, K-apt 세대수, 주차, 사용승인일을
                  같은 기준으로 비교합니다.
                </p>
              </div>
              <div className="grid w-full min-w-0 grid-cols-1 gap-2 text-sm min-[380px]:grid-cols-2 md:w-auto md:grid-cols-5">
                <Metric label="등록 단지" value={`${metrics.total}개`} />
                <Metric label="가격 데이터" value={`${metrics.withPrice}개`} />
                <Metric label="K-apt 정보" value={`${metrics.withKapt}개`} />
                <Metric label="접근성" value={`${metrics.withCommute}개`} />
                <Metric label="동기화 필요" value={`${metrics.needsSync}개`} />
              </div>
            </div>

            <div className="mt-5 grid min-w-0 gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_200px]">
              <label className="grid gap-1 text-xs font-semibold text-slate-500">
                검색
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="단지명, 주소, 메모, 법정동코드"
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-500">
                상태
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as ComparisonStatusFilter,
                    )
                  }
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">전체</option>
                  {Object.entries(statusLabels).map(([status, label]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-500">
                데이터
                <select
                  value={dataFilter}
                  onChange={(event) =>
                    setDataFilter(event.target.value as ComparisonDataFilter)
                  }
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">전체</option>
                  <option value="has-price">가격 있음</option>
                  <option value="missing-price">가격 없음</option>
                  <option value="has-kapt">K-apt 있음</option>
                  <option value="missing-kapt">K-apt 없음</option>
                  <option value="has-commute">접근성 있음</option>
                  <option value="missing-commute">접근성 없음</option>
                  <option value="needs-sync">동기화 필요</option>
                </select>
              </label>
            </div>
          </div>

          {isLoading ? (
            <p className="p-5 text-sm text-slate-600">
              비교 데이터를 불러오는 중입니다.
            </p>
          ) : rows.length > 0 ? (
            <div>
              <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600 sm:px-5">
                {filteredRows.length}개 단지가 표시됩니다.
              </div>
              {filteredRows.length > 0 ? (
                <ComparisonMatrix rows={filteredRows} />
              ) : (
                <p className="p-5 text-sm leading-6 text-slate-600">
                  현재 필터 조건에 맞는 단지가 없습니다.
                </p>
              )}
            </div>
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

function ComparisonMatrix({
  rows,
}: Readonly<{
  rows: ReturnType<typeof buildApartmentComparisonRows>;
}>) {
  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1300px] text-left">
          <thead className="sticky top-[74px] z-10 bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
          <tr>
            <th className="sticky left-0 z-20 bg-slate-50 px-5 py-3 font-semibold">
              단지
            </th>
            <th className="px-4 py-3 font-semibold">상태</th>
            <th className="px-4 py-3 font-semibold">최근 실거래가</th>
            <th className="px-4 py-3 font-semibold">평형대 요약</th>
            <th className="px-4 py-3 font-semibold">K-apt 기본정보</th>
            <th className="px-4 py-3 font-semibold">접근성</th>
            <th className="px-4 py-3 font-semibold">임장 판단</th>
            <th className="px-4 py-3 font-semibold">데이터 상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-slate-200 text-sm last:border-0 hover:bg-slate-50/60"
            >
              <td className="sticky left-0 bg-white px-5 py-4 align-top shadow-[1px_0_0_#e2e8f0]">
                <Link
                  href={`/apartments/${row.id}`}
                  className="font-semibold text-slate-950 hover:text-emerald-800"
                >
                  {row.name}
                </Link>
                <p className="mt-1 max-w-64 text-xs leading-5 text-slate-500">
                  {row.address ?? "주소 미입력"}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  법정동코드 {row.lawdCd ?? "-"}
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
                      <div
                        key={summary.areaBucket}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-2"
                      >
                        <p className="font-semibold text-slate-950">
                          {summary.areaBucket}㎡대 {formatKrw(summary.latestPriceKrw)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          평균 {formatKrw(summary.averagePriceKrw)} ·{" "}
                          {summary.transactionCount}건
                        </p>
                      </div>
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
                <CommuteSummaryView row={row} />
              </td>
              <td className="px-4 py-4 align-top text-sm text-slate-700">
                <FieldNoteSummaryView row={row} />
              </td>
              <td className="px-4 py-4 align-top text-sm leading-6 text-slate-700">
                <DataQuality row={row} />
                {row.memo ? (
                  <p className="mt-3 max-w-72 text-xs text-slate-500">
                    {row.memo}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="grid min-w-0 gap-3 p-3 sm:p-4 lg:hidden">
        {rows.map((row) => (
          <article
            key={row.id}
            className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/apartments/${row.id}`}
                  className="font-semibold text-slate-950"
                >
                  {row.name}
                </Link>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {row.address ?? "주소 미입력"}
                </p>
              </div>
              <StatusPill status={row.status} />
            </div>
            <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 text-sm min-[380px]:grid-cols-2">
              <MiniMetric
                label="최근가"
                value={
                  row.latestPriceKrw !== null
                    ? formatKrw(row.latestPriceKrw)
                    : "수집 전"
                }
              />
              <MiniMetric
                label="거래"
                value={`${row.transactionCount.toLocaleString("ko-KR")}건`}
              />
              <MiniMetric
                label="세대"
                value={formatOptionalCount(row.householdCount, "세대")}
              />
              <MiniMetric
                label="동수"
                value={formatOptionalCount(row.buildingCount, "동")}
              />
              <MiniMetric
                label="주차"
                value={formatOptionalCount(row.parkingCount, "대")}
              />
              <MiniMetric
                label="주차/세대"
                value={formatParkingPerHousehold(row.parkingPerHousehold)}
              />
              <MiniMetric
                label="용적률"
                value={formatRatioPercent(row.floorAreaRatio)}
              />
              <MiniMetric
                label="건폐율"
                value={formatRatioPercent(row.buildingCoverageRatio)}
              />
              <MiniMetric
                label="여의도"
                value={formatDestinationAccess(
                  row.commuteToYeouido,
                  row.driveToYeouido,
                )}
              />
              <MiniMetric
                label="강남"
                value={formatDestinationAccess(
                  row.commuteToGangnam,
                  row.driveToGangnam,
                )}
              />
              <MiniMetric label="임장" value={formatFieldNoteValue(row)} />
            </div>
            <div className="mt-4">
              <DataQuality row={row} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function BasicInfoSummary({
  row,
}: Readonly<{
  row: ReturnType<typeof buildApartmentComparisonRows>[number];
}>) {
  if (!hasBasicInfo(row)) {
    return <span className="text-slate-500">K-apt 정보 없음</span>;
  }

  return (
    <div className="grid gap-1">
      <p>
        {formatOptionalCount(row.householdCount, "세대")} ·{" "}
        {formatOptionalCount(row.buildingCount, "동")} ·{" "}
        {formatOptionalCount(row.parkingCount, "대 주차")}
      </p>
      <p className="text-xs text-slate-500">
        주차/세대 {formatParkingPerHousehold(row.parkingPerHousehold)} ·{" "}
        경과 {formatBuildingAge(row.buildingAgeYears)}
      </p>
      <p className="text-xs text-slate-500">
        용적률 {formatRatioPercent(row.floorAreaRatio)} · 건폐율{" "}
        {formatRatioPercent(row.buildingCoverageRatio)}
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

function CommuteSummaryView({
  row,
}: Readonly<{
  row: ReturnType<typeof buildApartmentComparisonRows>[number];
}>) {
  if (!hasCommuteInfo(row)) {
    return <span className="text-slate-500">접근성 미입력</span>;
  }

  return (
    <div className="grid gap-2">
      <DestinationAccessLine
        label="여의도"
        transit={row.commuteToYeouido}
        driving={row.driveToYeouido}
      />
      <DestinationAccessLine
        label="강남"
        transit={row.commuteToGangnam}
        driving={row.driveToGangnam}
      />
      <p className="text-xs text-slate-500">대중교통 / 자차</p>
    </div>
  );
}

function FieldNoteSummaryView({
  row,
}: Readonly<{
  row: ReturnType<typeof buildApartmentComparisonRows>[number];
}>) {
  if (!row.fieldNoteDate && !row.fieldNoteRating && !row.fieldNoteConclusion) {
    return <span className="text-slate-500">임장 기록 없음</span>;
  }

  return (
    <div className="grid gap-1">
      <p className="font-semibold text-slate-950">
        {row.fieldNoteConclusion ?? "결론 미입력"}
      </p>
      <p className="text-xs text-slate-500">
        {formatFieldNoteValue(row)}
      </p>
      {row.fieldNoteRecheck ? (
        <p className="mt-1 max-w-64 text-xs leading-5 text-slate-600">
          {row.fieldNoteRecheck}
        </p>
      ) : null}
    </div>
  );
}

function DestinationAccessLine({
  driving,
  label,
  transit,
}: Readonly<{
  driving: ReturnType<typeof buildApartmentComparisonRows>[number]["driveToYeouido"];
  label: string;
  transit: ReturnType<typeof buildApartmentComparisonRows>[number]["commuteToYeouido"];
}>) {
  return (
      <div className="min-w-0 rounded-md border border-slate-200 bg-white px-2.5 py-2">
      <p className="font-semibold text-slate-950">{label}</p>
      <p className="mt-1 text-xs text-slate-600">
        대중교통 {formatCommuteDuration(transit)}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        자차 {formatDrivingDuration(driving)}
      </p>
    </div>
  );
}

function DataQuality({
  row,
}: Readonly<{
  row: ReturnType<typeof buildApartmentComparisonRows>[number];
}>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <QualityBadge
        tone={row.transactionCount > 0 ? "good" : "missing"}
        label={row.transactionCount > 0 ? "가격 있음" : "가격 필요"}
      />
      <QualityBadge
        tone={hasBasicInfo(row) ? "good" : "missing"}
        label={hasBasicInfo(row) ? "K-apt 있음" : "K-apt 필요"}
      />
      <QualityBadge
        tone={hasCommuteInfo(row) ? "good" : "missing"}
        label={hasCommuteInfo(row) ? "접근성 있음" : "접근성 필요"}
      />
      <QualityBadge
        tone={row.fieldNoteUpdatedAt ? "good" : "missing"}
        label={row.fieldNoteUpdatedAt ? "임장 있음" : "임장 필요"}
      />
      {needsSync(row) ? (
        <QualityBadge tone="warn" label="동기화 필요" />
      ) : (
        <QualityBadge tone="good" label="비교 가능" />
      )}
    </div>
  );
}

function QualityBadge({
  label,
  tone,
}: Readonly<{ label: string; tone: "good" | "warn" | "missing" }>) {
  const className =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function MiniMetric({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-950">{value}</p>
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

function formatParkingPerHousehold(value: number | null) {
  return value !== null
    ? `${value.toLocaleString("ko-KR", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })}대`
    : "-";
}

function formatRatioPercent(value: number | null) {
  return formatBuildingDensityRatio(value);
}

function formatBuildingAge(value: number | null) {
  return value !== null ? `${value.toLocaleString("ko-KR")}년` : "-";
}

function formatCommuteDuration(
  value: ReturnType<typeof buildApartmentComparisonRows>[number]["commuteToYeouido"],
) {
  if (!value) {
    return "-";
  }

  const transfers =
    value.transferCount !== null ? ` · 환승 ${value.transferCount}회` : "";

  return `${value.durationMinutes.toLocaleString("ko-KR")}분${transfers}`;
}

function formatDrivingDuration(
  value: ReturnType<typeof buildApartmentComparisonRows>[number]["driveToYeouido"],
) {
  if (!value) {
    return "-";
  }

  const distance =
    value.distanceMeters !== null ? ` · ${formatMeters(value.distanceMeters)}` : "";

  return `${value.durationMinutes.toLocaleString("ko-KR")}분${distance}`;
}

function formatDestinationAccess(
  transit: ReturnType<typeof buildApartmentComparisonRows>[number]["commuteToYeouido"],
  driving: ReturnType<typeof buildApartmentComparisonRows>[number]["driveToYeouido"],
) {
  if (!transit && !driving) {
    return "-";
  }

  return `${formatCommuteDuration(transit)} / ${formatDrivingDuration(driving)}`;
}

function formatFieldNoteValue(
  row: ReturnType<typeof buildApartmentComparisonRows>[number],
) {
  if (!row.fieldNoteDate && !row.fieldNoteRating && !row.fieldNoteConclusion) {
    return "-";
  }

  return [
    row.fieldNoteRating !== null ? `평점 ${row.fieldNoteRating}/5` : null,
    row.fieldNoteDate ? formatDate(row.fieldNoteDate) : null,
  ]
    .filter(Boolean)
    .join(" · ") || row.fieldNoteConclusion || "-";
}

function formatMeters(value: number) {
  return value >= 1000
    ? `${(value / 1000).toLocaleString("ko-KR", {
        maximumFractionDigits: 1,
      })}km`
    : `${value.toLocaleString("ko-KR")}m`;
}

function isMissingTableError(error: { code?: string }) {
  return error.code === "42P01" || error.code === "PGRST205";
}
