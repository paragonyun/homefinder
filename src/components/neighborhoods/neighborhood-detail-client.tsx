"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth/auth-panel";
import { StatusPill } from "@/components/ui/status-pill";
import {
  buildDashboardModel,
  type DashboardApartment,
  type DashboardApartmentSummary,
  type DashboardBasicInfo,
  type DashboardCommuteTime,
  type DashboardNeighborhood,
  type DashboardNeighborhoodSummary,
  type DashboardTransaction,
} from "@/lib/services/dashboard-model";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type {
  ApartmentBasicInfoRow,
  ApartmentRowData,
  ApartmentTransactionRow,
  CommuteTimeRow,
  NeighborhoodRow,
} from "@/lib/supabase/table-types";

type NeighborhoodDetailClientProps = {
  neighborhoodId: string;
};

const mockDetailModel = buildDashboardModel({
  neighborhoods: [
    {
      id: "singil",
      name: "신길",
      description: "여의도 접근성과 가격 범위를 같이 보는 예시 권역",
      updated_at: "2026-05-31T00:00:00.000Z",
    },
    {
      id: "boramae",
      name: "보라매",
      description: "공원과 업무지구 접근성을 함께 검토하는 예시 권역",
      updated_at: "2026-05-31T00:00:00.000Z",
    },
    {
      id: "sadang",
      name: "사당",
      description: "강남 접근성을 우선 확인하는 예시 권역",
      updated_at: "2026-05-31T00:00:00.000Z",
    },
  ],
  apartments: [
    {
      id: "mock-singil-1",
      neighborhood_id: "singil",
      name: "신길우성2차",
      display_name: null,
      address: "서울 영등포구 신길동",
      status: "interested",
      memo: "여의도 접근성과 가격 범위 확인",
    },
    {
      id: "mock-boramae-1",
      neighborhood_id: "boramae",
      name: "보라매경남아너스빌",
      display_name: null,
      address: "서울 영등포구 여의대방로 25",
      status: "candidate",
      memo: "보라매 권역 비교 후보",
    },
    {
      id: "mock-sadang-1",
      neighborhood_id: "sadang",
      name: "사당자이",
      display_name: null,
      address: "서울 동작구 사당동",
      status: "visit_planned",
      memo: "강남 접근성과 언덕 체감 확인",
    },
  ],
  basicInfos: [
    {
      apartment_id: "mock-singil-1",
      household_count: 725,
      parking_count: 880,
      approval_date: "1996-09-12",
      fetched_at: "2026-05-31T00:00:00.000Z",
    },
    {
      apartment_id: "mock-sadang-1",
      household_count: 719,
      parking_count: 920,
      approval_date: "2010-01-22",
      fetched_at: "2026-05-31T00:00:00.000Z",
    },
  ],
  commuteTimes: [
    {
      apartment_id: "mock-singil-1",
      destination_key: "yeouido_station",
      transport_type: "transit",
      duration_minutes: 24,
    },
    {
      apartment_id: "mock-sadang-1",
      destination_key: "gangnam_station",
      transport_type: "transit",
      duration_minutes: 22,
    },
  ],
  transactions: [
    {
      apartment_id: "mock-singil-1",
      deal_amount_krw: 980_000_000,
      deal_date: "2026-05-10",
    },
    {
      apartment_id: "mock-boramae-1",
      deal_amount_krw: 1_310_000_000,
      deal_date: "2026-04-23",
    },
    {
      apartment_id: "mock-sadang-1",
      deal_amount_krw: 1_450_000_000,
      deal_date: "2026-05-12",
    },
  ],
});

export function NeighborhoodDetailClient({
  neighborhoodId,
}: Readonly<NeighborhoodDetailClientProps>) {
  const [session, setSession] = useState<Session | null>(null);
  const [neighborhood, setNeighborhood] =
    useState<DashboardNeighborhoodSummary | null>(
      findMockNeighborhood(neighborhoodId),
    );
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  const loadNeighborhood = useCallback(
    async (id: string) => {
      if (!supabase) {
        return;
      }

      setIsLoading(true);
      setMessage(null);

      const { data: neighborhoodRow, error: neighborhoodError } = await supabase
        .from("neighborhoods")
        .select("id,name,description,updated_at")
        .eq("id", id)
        .maybeSingle();

      if (neighborhoodError) {
        setMessage(neighborhoodError.message);
        setNeighborhood(null);
        setIsLoading(false);
        return;
      }

      if (!neighborhoodRow) {
        setMessage("해당 권역을 찾을 수 없습니다.");
        setNeighborhood(null);
        setIsLoading(false);
        return;
      }

      const { data: apartmentRows, error: apartmentError } = await supabase
        .from("apartments")
        .select(
          "id,neighborhood_id,name,display_name,address,status,memo,updated_at",
        )
        .eq("neighborhood_id", id)
        .order("updated_at", { ascending: false });

      if (apartmentError) {
        setMessage(apartmentError.message);
        setNeighborhood(null);
        setIsLoading(false);
        return;
      }

      const apartments = (apartmentRows ?? []) as ApartmentRowData[];
      const apartmentIds = apartments.map((apartment) => apartment.id);

      if (apartmentIds.length === 0) {
        const nextModel = buildDashboardModel({
          apartments: [],
          neighborhoods: [toDashboardNeighborhood(neighborhoodRow as NeighborhoodRow)],
          transactions: [],
        });

        setNeighborhood(nextModel.neighborhoods[0] ?? null);
        setIsLoading(false);
        return;
      }

      const [transactionResult, basicInfoResult, commuteResult] =
        await Promise.all([
          supabase
            .from("apartment_transactions")
            .select("apartment_id,deal_amount_krw,deal_date")
            .in("apartment_id", apartmentIds),
          supabase
            .from("apartment_basic_info")
            .select(
              "apartment_id,household_count,parking_count,approval_date,fetched_at",
            )
            .in("apartment_id", apartmentIds),
          supabase
            .from("commute_times")
            .select(
              "apartment_id,destination_key,transport_type,duration_minutes",
            )
            .in("apartment_id", apartmentIds),
        ]);

      const notices: string[] = [];

      if (transactionResult.error) {
        notices.push(transactionResult.error.message);
      }

      if (basicInfoResult.error && !isMissingTableError(basicInfoResult.error)) {
        notices.push(basicInfoResult.error.message);
      }

      if (commuteResult.error && !isMissingTableError(commuteResult.error)) {
        notices.push(commuteResult.error.message);
      }

      const nextModel = buildDashboardModel({
        apartments: apartments.map(toDashboardApartment),
        basicInfos: isMissingTableError(basicInfoResult.error)
          ? []
          : ((basicInfoResult.data ?? []) as ApartmentBasicInfoRow[]).map(
              toDashboardBasicInfo,
            ),
        commuteTimes: isMissingTableError(commuteResult.error)
          ? []
          : ((commuteResult.data ?? []) as CommuteTimeRow[]).map(
              toDashboardCommuteTime,
            ),
        neighborhoods: [toDashboardNeighborhood(neighborhoodRow as NeighborhoodRow)],
        transactions: ((transactionResult.data ??
          []) as ApartmentTransactionRow[]).map(toDashboardTransaction),
      });

      setMessage(notices.length > 0 ? notices.join(" / ") : null);
      setNeighborhood(nextModel.neighborhoods[0] ?? null);
      setIsLoading(false);
    },
    [supabase],
  );

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
        void loadNeighborhood(neighborhoodId);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession) {
        void loadNeighborhood(neighborhoodId);
      } else {
        setNeighborhood(findMockNeighborhood(neighborhoodId));
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadNeighborhood, neighborhoodId, supabase]);

  const isPreview = useMemo(
    () => !isSupabaseConfigured || !session,
    [session],
  );

  if (!neighborhood) {
    return (
      <div className="grid gap-5">
        {!isSupabaseConfigured || !session ? <AuthPanel /> : null}
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
            권역을 찾을 수 없습니다
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            권역 목록에서 다시 선택해 주세요.
          </p>
          <Link
            href="/neighborhoods"
            className="mt-4 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            권역 목록으로
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Neighborhood
            </p>
            <h1 className="mt-2 break-keep text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
              {neighborhood.name}
            </h1>
            <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600">
              {neighborhood.description}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/"
              className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              대시보드
            </Link>
            <Link
              href="/compare"
              className="rounded-md bg-slate-950 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              비교 화면
            </Link>
          </div>
        </div>
      </section>

      {isPreview ? (
        <AuthPanel />
      ) : null}

      {isPreview ? (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
          로그인 전에는 예시 권역 상세가 표시됩니다. 로그인하면 실제 등록한
          권역 기준으로 가격과 접근성이 계산됩니다.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          {message}
        </p>
      ) : null}

      {isLoading ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          권역 데이터를 불러오는 중입니다.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DetailMetric label="검토 단지" value={`${neighborhood.apartmentCount}개`} />
        <DetailMetric
          label="관심/후보"
          value={`${neighborhood.interestedCount}/${neighborhood.candidateCount}`}
        />
        <DetailMetric label="가격 범위" value={neighborhood.priceRangeLabel} />
        <DetailMetric
          label="접근성"
          value={`${neighborhood.gangnamSummary} · ${neighborhood.yeouidoSummary}`}
        />
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-normal text-slate-950">
              권역 내 단지
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              가격, 접근성, 단지 규모 근거를 기준으로 정렬했습니다.
            </p>
          </div>
          {neighborhood.apartmentSummaries.length > 0 ? (
            <div className="grid gap-3">
              {neighborhood.apartmentSummaries.map((apartment) => (
                <ApartmentSummaryCard key={apartment.id} apartment={apartment} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm leading-6 text-slate-500">
              아직 이 권역에 연결된 단지가 없습니다.
            </p>
          )}
        </div>

        <aside className="grid h-fit min-w-0 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Focus
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-normal text-slate-950">
              다음에 볼 후보
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              이 권역에서 먼저 비교할 만한 대표 후보입니다.
            </p>
          </div>
          {neighborhood.representativeApartments.length > 0 ? (
            <div className="grid gap-3">
              {neighborhood.representativeApartments.map((apartment, index) => (
                <ApartmentFocusItem
                  key={apartment.id}
                  apartment={apartment}
                  rank={index + 1}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-500">
              대표 후보가 없습니다.
            </p>
          )}
          {neighborhood.missingBadges.length > 0 ? (
            <EvidenceChips values={neighborhood.missingBadges} tone="amber" />
          ) : null}
        </aside>
      </section>
    </div>
  );
}

function DetailMetric({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold tracking-normal text-slate-950">
        {value}
      </p>
    </div>
  );
}

function ApartmentSummaryCard({
  apartment,
}: Readonly<{ apartment: DashboardApartmentSummary }>) {
  return (
    <Link
      href={getApartmentHref(apartment.id)}
      className="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md sm:grid-cols-[minmax(0,1fr)_220px]"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="break-keep text-lg font-semibold text-slate-950">
            {apartment.name}
          </h3>
          <StatusPill status={apartment.status} />
        </div>
        <p className="mt-1 break-words text-sm leading-6 text-slate-500">
          {apartment.address ?? "주소 없음"}
        </p>
        <EvidenceChips values={apartment.evidence} />
        {apartment.missingBadges.length > 0 ? (
          <EvidenceChips values={apartment.missingBadges} tone="amber" />
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <SmallFact label="최근가" value={formatPrice(apartment.latestPriceKrw)} />
        <SmallFact label="거래일" value={apartment.latestDealDate ?? "-"} />
        <SmallFact
          label="강남"
          value={formatMinutes(apartment.gangnamMinutes)}
        />
        <SmallFact
          label="여의도"
          value={formatMinutes(apartment.yeouidoMinutes)}
        />
      </div>
    </Link>
  );
}

function ApartmentFocusItem({
  apartment,
  rank,
}: Readonly<{ apartment: DashboardApartmentSummary; rank: number }>) {
  return (
    <Link
      href={getApartmentHref(apartment.id)}
      className="grid min-w-0 gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 transition hover:border-blue-300 hover:bg-white"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">#{rank}</p>
          <p className="mt-1 break-keep font-semibold text-slate-950">
            {apartment.name}
          </p>
        </div>
        <StatusPill status={apartment.status} />
      </div>
      <EvidenceChips values={apartment.evidence} />
    </Link>
  );
}

function SmallFact({
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

function EvidenceChips({
  tone = "slate",
  values,
}: Readonly<{ tone?: "amber" | "slate"; values: string[] }>) {
  if (values.length === 0) {
    return null;
  }

  const className =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-white text-slate-600";

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className={`rounded-md border px-2 py-1 text-xs font-semibold ${className}`}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function findMockNeighborhood(id: string) {
  return (
    mockDetailModel.neighborhoods.find((neighborhood) => neighborhood.id === id) ??
    mockDetailModel.neighborhoods[0] ??
    null
  );
}

function getApartmentHref(id: string) {
  return id.startsWith("mock-") ? "/apartments" : `/apartments/${id}`;
}

function formatPrice(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${(value / 100_000_000).toLocaleString("ko-KR", {
    maximumFractionDigits: 1,
  })}억`;
}

function formatMinutes(value: number | null) {
  return value === null ? "-" : `${value}분`;
}

function toDashboardNeighborhood(row: NeighborhoodRow): DashboardNeighborhood {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    updated_at: row.updated_at,
  };
}

function toDashboardApartment(row: ApartmentRowData): DashboardApartment {
  return {
    id: row.id,
    neighborhood_id: row.neighborhood_id,
    name: row.name,
    display_name: row.display_name,
    address: row.address,
    status: row.status,
    memo: row.memo,
  };
}

function toDashboardTransaction(
  row: ApartmentTransactionRow,
): DashboardTransaction {
  return {
    apartment_id: row.apartment_id,
    deal_amount_krw: row.deal_amount_krw,
    deal_date: row.deal_date,
  };
}

function toDashboardBasicInfo(row: ApartmentBasicInfoRow): DashboardBasicInfo {
  return {
    apartment_id: row.apartment_id,
    household_count: row.household_count,
    parking_count: row.parking_count,
    approval_date: row.approval_date,
    fetched_at: row.fetched_at,
  };
}

function toDashboardCommuteTime(row: CommuteTimeRow): DashboardCommuteTime {
  return {
    apartment_id: row.apartment_id,
    destination_key: row.destination_key,
    transport_type: row.transport_type,
    duration_minutes: row.duration_minutes,
  };
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "42P01";
}
