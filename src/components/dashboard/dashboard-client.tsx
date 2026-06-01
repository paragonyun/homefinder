"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth/auth-panel";
import { StatusPill } from "@/components/ui/status-pill";
import {
  buildDashboardModel,
  type DashboardApartment,
  type DashboardBasicInfo,
  type DashboardBuildingInfo,
  type DashboardCommuteTime,
  type DashboardModel,
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
  ApartmentBuildingInfoRow,
  ApartmentRowData,
  ApartmentTransactionRow,
  CommuteTimeRow,
  NeighborhoodRow,
} from "@/lib/supabase/table-types";

const mockDashboardModel = buildDashboardModel({
  neighborhoods: [
    {
      id: "mock-gwanak",
      name: "관악",
      description: "강남 접근성과 대단지 안정성을 같이 보는 권역",
      updated_at: "2026-05-31T00:00:00.000Z",
    },
    {
      id: "mock-yeomchang",
      name: "염창",
      description: "여의도 접근성과 9호선 생활권을 우선 확인하는 권역",
      updated_at: "2026-05-31T00:00:00.000Z",
    },
    {
      id: "mock-boramae",
      name: "보라매",
      description: "공원, 업무지구, 신림선 접근성을 비교하는 권역",
      updated_at: "2026-05-31T00:00:00.000Z",
    },
  ],
  apartments: [
    {
      id: "mock-dream",
      neighborhood_id: "mock-gwanak",
      name: "관악드림타운",
      display_name: null,
      address: "서울 관악구 성현로 80",
      status: "interested",
      memo: "강남 접근성과 대단지 규모를 함께 확인",
    },
    {
      id: "mock-donga",
      neighborhood_id: "mock-yeomchang",
      name: "염창 동아 3차",
      display_name: null,
      address: "서울 강서구 양천로 731",
      status: "interested",
      memo: "여의도 접근성 우선 후보",
    },
    {
      id: "mock-honors",
      neighborhood_id: "mock-boramae",
      name: "보라매경남아너스빌",
      display_name: null,
      address: "서울 영등포구 여의대방로 25",
      status: "candidate",
      memo: "보라매 권역 비교 후보",
    },
  ],
  basicInfos: [
    {
      apartment_id: "mock-dream",
      household_count: 3_544,
      parking_count: 5_404,
      approval_date: "2003-09-30",
      fetched_at: "2026-05-27T00:00:00.000Z",
    },
  ],
  buildingInfos: [
    {
      apartment_id: "mock-dream",
      floor_area_ratio: 249.35,
      building_coverage_ratio: 18.42,
      fetched_at: "2026-06-01T00:00:00.000Z",
    },
  ],
  commuteTimes: [
    {
      apartment_id: "mock-dream",
      destination_key: "gangnam_station",
      transport_type: "transit",
      duration_minutes: 31,
    },
    {
      apartment_id: "mock-donga",
      destination_key: "yeouido_station",
      transport_type: "transit",
      duration_minutes: 28,
    },
  ],
  transactions: [
    {
      apartment_id: "mock-dream",
      deal_amount_krw: 1_200_000_000,
      deal_date: "2026-05-15",
    },
    {
      apartment_id: "mock-donga",
      deal_amount_krw: 1_370_000_000,
      deal_date: "2026-05-01",
    },
    {
      apartment_id: "mock-honors",
      deal_amount_krw: 1_310_000_000,
      deal_date: "2026-04-23",
    },
  ],
});

export function DashboardClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [model, setModel] = useState<DashboardModel>(mockDashboardModel);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  const loadDashboard = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const { data: neighborhoodRows, error: neighborhoodError } = await supabase
      .from("neighborhoods")
      .select("id,name,description,updated_at")
      .order("updated_at", { ascending: false });

    if (neighborhoodError) {
      setMessage(neighborhoodError.message);
      setIsLoading(false);
      return;
    }

    const { data: apartmentRows, error: apartmentError } = await supabase
      .from("apartments")
      .select(
        "id,neighborhood_id,name,display_name,address,status,memo,updated_at",
      )
      .order("updated_at", { ascending: false });

    if (apartmentError) {
      setMessage(apartmentError.message);
      setIsLoading(false);
      return;
    }

    const apartments = (apartmentRows ?? []) as ApartmentRowData[];
    const apartmentIds = apartments.map((apartment) => apartment.id);

    if (apartmentIds.length === 0) {
      setModel(
        buildDashboardModel({
          apartments: [],
          neighborhoods: (neighborhoodRows ?? []) as NeighborhoodRow[],
          transactions: [],
        }),
      );
      setIsLoading(false);
      return;
    }

    const [transactionResult, basicInfoResult, buildingInfoResult, commuteResult] =
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
          .from("apartment_building_info")
          .select(
            "apartment_id,floor_area_ratio,building_coverage_ratio,fetched_at",
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
    const basicInfos = isMissingTableError(basicInfoResult.error)
      ? []
      : ((basicInfoResult.data ?? []) as ApartmentBasicInfoRow[]);
    const buildingInfos = isMissingTableError(buildingInfoResult.error)
      ? []
      : ((buildingInfoResult.data ?? []) as ApartmentBuildingInfoRow[]);
    const commuteTimes = isMissingTableError(commuteResult.error)
      ? []
      : ((commuteResult.data ?? []) as CommuteTimeRow[]);

    if (transactionResult.error) {
      notices.push(transactionResult.error.message);
    }

    if (basicInfoResult.error && !isMissingTableError(basicInfoResult.error)) {
      notices.push(basicInfoResult.error.message);
    }

    if (
      buildingInfoResult.error &&
      !isMissingTableError(buildingInfoResult.error)
    ) {
      notices.push(buildingInfoResult.error.message);
    }

    if (commuteResult.error && !isMissingTableError(commuteResult.error)) {
      notices.push(commuteResult.error.message);
    }

    setMessage(notices.length > 0 ? notices.join(" / ") : null);
    setModel(
      buildDashboardModel({
        apartments: apartments.map(toDashboardApartment),
        basicInfos: basicInfos.map(toDashboardBasicInfo),
        buildingInfos: buildingInfos.map(toDashboardBuildingInfo),
        commuteTimes: commuteTimes.map(toDashboardCommuteTime),
        neighborhoods: ((neighborhoodRows ?? []) as NeighborhoodRow[]).map(
          toDashboardNeighborhood,
        ),
        transactions: ((transactionResult.data ??
          []) as ApartmentTransactionRow[]).map(toDashboardTransaction),
      }),
    );
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
        void loadDashboard();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession) {
        void loadDashboard();
      } else {
        setModel(mockDashboardModel);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadDashboard, supabase]);

  const isPreview = useMemo(
    () => !isSupabaseConfigured || !session,
    [session],
  );

  return (
    <div className="grid min-w-0 gap-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Portfolio
            </p>
            <h2 className="mt-2 break-keep text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
              동네별 후보 포트폴리오
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              권역별 가격 범위와 강남역/여의도역 접근성을 함께 보면서 다음에
              집중할 후보를 고릅니다.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/compare"
              className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              비교 화면
            </Link>
            <Link
              href="/apartments"
              className="rounded-md bg-slate-950 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              관심 단지 관리
            </Link>
          </div>
        </div>
      </section>

      {!isSupabaseConfigured || !session ? (
        <AuthPanel />
      ) : null}

      {isPreview ? (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
          로그인 전에는 예시 포트폴리오가 표시됩니다. 로그인하면 등록한 권역과
          단지 기준으로 홈 대시보드가 바뀝니다.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          {message}
        </p>
      ) : null}

      {isLoading ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          대시보드 데이터를 불러오는 중입니다.
        </p>
      ) : null}

      <PortfolioSummaryStrip model={model} />

      {model.summary.neighborhoods === 0 && !isPreview ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
          등록된 권역이 없습니다. 관심 동네를 먼저 추가하면 이 화면에서 권역별
          후보 현황을 볼 수 있습니다.
        </section>
      ) : (
        <section className="grid min-w-0 items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <NeighborhoodPortfolioGrid neighborhoods={model.neighborhoods} />
          <PriorityApartmentList model={model} />
        </section>
      )}
    </div>
  );
}

function PortfolioSummaryStrip({ model }: Readonly<{ model: DashboardModel }>) {
  const items = [
    {
      label: "관심 권역",
      value: `${model.summary.neighborhoods}개`,
      detail: "등록한 동네/권역",
    },
    {
      label: "검토 단지",
      value: `${model.summary.activeApartments}개`,
      detail: "제외 상태 제외",
    },
    {
      label: "가격 데이터",
      value: `${model.summary.withPrice}개`,
      detail: "최근 실거래가 있음",
    },
    {
      label: "접근성 데이터",
      value: `${model.summary.withCommute}개`,
      detail: "강남/여의도 중 1개 이상",
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p className="text-xs font-semibold text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
            {item.value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
        </div>
      ))}
    </section>
  );
}

function NeighborhoodPortfolioGrid({
  neighborhoods,
}: Readonly<{ neighborhoods: DashboardNeighborhoodSummary[] }>) {
  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
      {neighborhoods.map((neighborhood) => (
        <NeighborhoodPortfolioCard
          key={neighborhood.id}
          neighborhood={neighborhood}
        />
      ))}
    </div>
  );
}

function NeighborhoodPortfolioCard({
  neighborhood,
}: Readonly<{ neighborhood: DashboardNeighborhoodSummary }>) {
  const href = neighborhood.id.startsWith("mock-")
    ? "/neighborhoods"
    : `/neighborhoods/${neighborhood.id}`;

  return (
    <Link
      href={href}
      className="grid min-w-0 content-start gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md sm:p-5"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-keep text-xl font-semibold tracking-normal text-slate-950">
            {neighborhood.name}
          </h3>
          <p className="mt-2 break-words text-sm leading-6 text-slate-600">
            {neighborhood.description}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {neighborhood.apartmentCount}개
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm min-[420px]:grid-cols-2">
        <PortfolioMiniMetric label="가격 범위" value={neighborhood.priceRangeLabel} />
        <PortfolioMiniMetric label="강남역" value={neighborhood.gangnamSummary} />
        <PortfolioMiniMetric label="여의도역" value={neighborhood.yeouidoSummary} />
        <PortfolioMiniMetric
          label="상태"
          value={`관심 ${neighborhood.interestedCount} · 후보 ${neighborhood.candidateCount}`}
        />
      </div>

      {neighborhood.representativeApartments.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-xs font-semibold text-slate-500">대표 후보</p>
          {neighborhood.representativeApartments.map((apartment) => (
            <div
              key={apartment.id}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {apartment.name}
                </p>
                <StatusPill status={apartment.status} />
              </div>
              <EvidenceChips values={apartment.evidence} />
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          아직 연결된 단지가 없습니다.
        </p>
      )}

      {neighborhood.missingBadges.length > 0 ? (
        <EvidenceChips values={neighborhood.missingBadges} tone="amber" />
      ) : null}
    </Link>
  );
}

function PriorityApartmentList({
  model,
}: Readonly<{ model: DashboardModel }>) {
  return (
    <aside className="grid h-fit min-w-0 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
          Focus
        </p>
        <h3 className="mt-2 text-lg font-semibold tracking-normal text-slate-950">
          현재 눈여겨볼 단지
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          관심 상태, 최근 거래, 접근성 근거가 있는 단지를 우선 보여줍니다.
        </p>
      </div>

      {model.priorityApartments.length > 0 ? (
        <div className="grid gap-3">
          {model.priorityApartments.map((apartment, index) => (
            <Link
              key={apartment.id}
              href={
                apartment.id.startsWith("mock-")
                  ? "/apartments"
                  : `/apartments/${apartment.id}`
              }
              className="grid min-w-0 gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 transition hover:border-blue-300 hover:bg-white"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">
                    #{index + 1}
                  </p>
                  <p className="mt-1 break-keep font-semibold text-slate-950">
                    {apartment.name}
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                    {apartment.address ?? "주소 없음"}
                  </p>
                </div>
                <StatusPill status={apartment.status} />
              </div>
              <EvidenceChips values={apartment.evidence} />
              {apartment.missingBadges.length > 0 ? (
                <EvidenceChips values={apartment.missingBadges} tone="amber" />
              ) : null}
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-500">
          표시할 후보 단지가 없습니다.
        </p>
      )}
    </aside>
  );
}

function PortfolioMiniMetric({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">
        {value}
      </p>
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

function toDashboardBuildingInfo(
  row: ApartmentBuildingInfoRow,
): DashboardBuildingInfo {
  return {
    apartment_id: row.apartment_id,
    floor_area_ratio: row.floor_area_ratio,
    building_coverage_ratio: row.building_coverage_ratio,
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
  return error?.code === "42P01" || error?.code === "PGRST205";
}
