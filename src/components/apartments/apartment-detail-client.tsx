"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth/auth-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import { apartments as mockApartments } from "@/lib/mock-data";
import {
  buildCommuteAccessSummaryByApartment,
  type CommuteAccessSummary,
  type CommuteSummary,
} from "@/lib/services/commute-summary";
import type { CommuteDestinationKey } from "@/types/commute";
import {
  buildLinearTicks,
  getVisibleMonthLabels,
} from "@/lib/services/chart-scale";
import {
  buildMonthlyPriceTrendLines,
  filterTransactionsByMonth,
  getLatestTransactionMonth,
  summarizeApartmentPrices,
  summarizeMonthlyTrendWindow,
  type MonthlyPriceTrendLine,
} from "@/lib/services/price-summary";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type {
  ApartmentBasicInfoRow,
  ApartmentRowData,
  ApartmentTransactionRow,
  CommuteTimeRow,
} from "@/lib/supabase/table-types";
import { formatDate } from "@/utils/date";
import { formatKrw } from "@/utils/format-price";

type ApartmentDetailClientProps = {
  apartmentId: string;
};

type TransactionSyncResult = {
  error?: string;
  matchedCount?: number;
  totalCount?: number;
  dealYmd?: string;
  matchedDealYmds?: string[];
  monthsChecked?: number;
  candidateNames?: Array<{ name: string; count: number }>;
};

type BasicInfoSyncResult = {
  error?: string;
  kaptName?: string | null;
  fetchedAt?: string;
};

type CommuteRefreshResult = {
  error?: string;
  savedCount?: number;
  errors?: Array<{
    destinationKey: string;
    transportType: string;
    error: string;
  }>;
  searchDttm?: string;
  expiresAt?: string;
};

type KaptCodeCandidate = {
  kaptCode: string;
  kaptName: string;
  bjdCode: string | null;
  sido: string | null;
  sigungu: string | null;
  eupmyeondong: string | null;
  ri: string | null;
  legalAddress?: string | null;
  roadAddress?: string | null;
  score: number;
  reasons: string[];
};

type KaptCodeResolveResult = {
  error?: string;
  applied?: boolean;
  selected?: KaptCodeCandidate | null;
  candidates?: KaptCodeCandidate[];
  reason?: string;
};

const sections = [
  ["건축정보", "건축물대장 후보 데이터가 확보되면 용적률, 건폐율, 대지면적을 표시합니다."],
  ["학군", "NEIS 학교기본정보와 거리 계산을 MVP 2에서 연결합니다."],
  ["임장 후기", "모바일 입력 화면과 사진 업로드를 연결합니다."],
  ["내 판단", "관심/보류/제외 상태와 추가 확인사항을 남깁니다."],
  ["데이터 출처", "source, fetched_at, confidence_level을 함께 표시합니다."],
];

export function ApartmentDetailClient({
  apartmentId,
}: Readonly<ApartmentDetailClientProps>) {
  const mockApartment = mockApartments.find((item) => item.id === apartmentId);
  const [session, setSession] = useState<Session | null>(null);
  const [apartment, setApartment] = useState<ApartmentRowData | null>(null);
  const [basicInfo, setBasicInfo] = useState<ApartmentBasicInfoRow | null>(null);
  const [transactions, setTransactions] = useState<ApartmentTransactionRow[]>([]);
  const [commuteTimes, setCommuteTimes] = useState<CommuteTimeRow[]>([]);
  const [candidateNames, setCandidateNames] = useState<
    Array<{ name: string; count: number }>
  >([]);
  const [kaptCodeCandidates, setKaptCodeCandidates] = useState<
    KaptCodeCandidate[]
  >([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBasicInfoSyncing, setIsBasicInfoSyncing] = useState(false);
  const [isCommuteSyncing, setIsCommuteSyncing] = useState(false);
  const [isComprehensiveSyncing, setIsComprehensiveSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();
  const isAdmin = isAdminRole(getRoleFromAppMetadata(session?.user.app_metadata));

  const loadApartment = useCallback(async () => {
    if (!supabase || mockApartment) {
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    setSession(sessionData.session);

    if (!sessionData.session) {
      setApartment(null);
      setBasicInfo(null);
      setTransactions([]);
      setCommuteTimes([]);
      return;
    }

    const [
      { data: apartmentData, error: apartmentError },
      { data: basicInfoData, error: basicInfoError },
      { data: transactionData, error: transactionError },
      { data: commuteData, error: commuteError },
    ] = await Promise.all([
      supabase
        .from("apartments")
        .select("*")
        .eq("id", apartmentId)
        .maybeSingle(),
      supabase
        .from("apartment_basic_info")
        .select("*")
        .eq("apartment_id", apartmentId)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("apartment_transactions")
        .select("*")
        .eq("apartment_id", apartmentId)
        .order("deal_date", { ascending: false })
        .limit(240),
      supabase
        .from("commute_times")
        .select("*")
        .eq("apartment_id", apartmentId)
        .order("fetched_at", { ascending: false }),
    ]);

    if (apartmentError) {
      setMessage(apartmentError.message);
    } else {
      setApartment((apartmentData as ApartmentRowData | null) ?? null);
    }

    if (basicInfoError && !isMissingTableError(basicInfoError)) {
      setMessage(basicInfoError.message);
    } else {
      setBasicInfo(
        basicInfoError
          ? null
          : ((basicInfoData as ApartmentBasicInfoRow | null) ?? null),
      );
    }

    if (transactionError) {
      setMessage(transactionError.message);
    } else {
      setTransactions((transactionData ?? []) as ApartmentTransactionRow[]);
    }

    if (commuteError && !isMissingTableError(commuteError)) {
      setMessage(commuteError.message);
    } else {
      setCommuteTimes(
        commuteError ? [] : ((commuteData ?? []) as CommuteTimeRow[]),
      );
    }
  }, [apartmentId, mockApartment, supabase]);

  useEffect(() => {
    if (!supabase || mockApartment) {
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(() => {
      if (isMounted) {
        void loadApartment();
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
        void loadApartment();
      } else {
        setApartment(null);
        setBasicInfo(null);
        setTransactions([]);
        setCommuteTimes([]);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadApartment, mockApartment, supabase]);

  async function handleTransactionSync() {
    if (!supabase || !session || !apartment || !isAdmin) {
      setMessage("실거래가 동기화는 운영자 계정만 실행할 수 있습니다.");
      return;
    }

    if (!apartment.lawd_cd) {
      setMessage("실거래가 조회를 위해 법정동코드를 먼저 입력하세요.");
      return;
    }

    setIsSyncing(true);
    setMessage(null);
    setCandidateNames([]);

    try {
      const accessToken = await getAccessToken();
      const result = await syncTransactions(accessToken);

      await loadApartment();
      setCandidateNames(result.candidateNames ?? []);
      setMessage(formatTransactionSyncMessage(result));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "실거래가 동기화에 실패했습니다.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleBasicInfoSync() {
    if (!supabase || !session || !apartment || !isAdmin) {
      setMessage("K-apt 기본정보 동기화는 운영자 계정만 실행할 수 있습니다.");
      return;
    }

    if (!apartment.kapt_code) {
      setMessage("K-apt 기본정보 조회를 위해 K-apt 코드를 먼저 입력하세요.");
      return;
    }

    setIsBasicInfoSyncing(true);
    setMessage(null);

    try {
      const accessToken = await getAccessToken();
      const result = await syncBasicInfo(accessToken);

      await loadApartment();
      setMessage(formatBasicInfoSyncMessage(result));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "K-apt 기본정보 동기화에 실패했습니다.",
      );
    } finally {
      setIsBasicInfoSyncing(false);
    }
  }

  async function handleCommuteRefresh() {
    if (!supabase || !session || !apartment || !isAdmin) {
      setMessage("접근성 자동 조회는 운영자 계정만 실행할 수 있습니다.");
      return;
    }

    setIsCommuteSyncing(true);
    setMessage(null);

    try {
      const accessToken = await getAccessToken();
      const result = await refreshCommute(accessToken);

      await loadApartment();
      setMessage(formatCommuteRefreshMessage(result));
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsCommuteSyncing(false);
    }
  }

  async function handleComprehensiveSync() {
    if (!supabase || !session || !apartment || !isAdmin) {
      setMessage("종합 정보 조회는 운영자 계정만 실행할 수 있습니다.");
      return;
    }

    if (!apartment.lawd_cd) {
      setMessage("아파트 종합 정보 조회를 위해 법정동코드를 먼저 입력하세요.");
      return;
    }

    setIsComprehensiveSyncing(true);
    setMessage(null);
    setCandidateNames([]);
    setKaptCodeCandidates([]);

    try {
      const accessToken = await getAccessToken();
      const messages: string[] = [];

      try {
        const transactionResult = await syncTransactions(accessToken);
        setCandidateNames(transactionResult.candidateNames ?? []);
        messages.push(`실거래가: ${formatTransactionSyncMessage(transactionResult)}`);
      } catch (error) {
        messages.push(`실거래가 실패: ${getErrorMessage(error)}`);
      }

      let canSyncBasicInfo = Boolean(apartment.kapt_code);

      if (!canSyncBasicInfo) {
        try {
          const resolveResult = await resolveKaptCode(accessToken);
          const candidates = resolveResult.candidates ?? [];

          setKaptCodeCandidates(candidates);

          if (resolveResult.applied && resolveResult.selected) {
            canSyncBasicInfo = true;
            messages.push(
              `K-apt 코드: ${resolveResult.selected.kaptName}(${resolveResult.selected.kaptCode}) 자동 저장`,
            );
          } else if (candidates.length > 0) {
            messages.push("K-apt 코드: 후보 선택이 필요합니다.");
          } else {
            messages.push(`K-apt 코드: ${resolveResult.reason ?? "후보 없음"}`);
          }
        } catch (error) {
          messages.push(`K-apt 코드 탐색 실패: ${getErrorMessage(error)}`);
        }
      }

      if (canSyncBasicInfo) {
        try {
          const basicInfoResult = await syncBasicInfo(accessToken);
          messages.push(`기본정보: ${formatBasicInfoSyncMessage(basicInfoResult)}`);
        } catch (error) {
          messages.push(`기본정보 실패: ${getErrorMessage(error)}`);
        }
      }

      await loadApartment();
      setMessage(messages.join(" / "));
    } finally {
      setIsComprehensiveSyncing(false);
    }
  }

  async function handleSelectKaptCandidate(kaptCode: string) {
    if (!supabase || !session || !apartment || !isAdmin) {
      setMessage("K-apt 코드 선택은 운영자 계정만 실행할 수 있습니다.");
      return;
    }

    setIsComprehensiveSyncing(true);
    setMessage(null);

    try {
      const accessToken = await getAccessToken();
      const resolveResult = await resolveKaptCode(accessToken, kaptCode);

      if (!resolveResult.applied || !resolveResult.selected) {
        setMessage(resolveResult.reason ?? "K-apt 코드를 저장하지 못했습니다.");
        return;
      }

      const basicInfoResult = await syncBasicInfo(accessToken);

      setKaptCodeCandidates([]);
      await loadApartment();
      setMessage(
        `K-apt 코드 ${resolveResult.selected.kaptCode}를 저장했습니다. ${formatBasicInfoSyncMessage(
          basicInfoResult,
        )}`,
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsComprehensiveSyncing(false);
    }
  }

  async function getAccessToken() {
    if (!supabase) {
      return "";
    }

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    return currentSession?.access_token ?? "";
  }

  async function syncTransactions(accessToken: string) {
    const { response, result } = await postApartmentJson<TransactionSyncResult>(
      `/api/apartments/${apartmentId}/transactions/sync`,
      accessToken,
    );

    if (!response.ok) {
      throw new Error(result.error ?? "실거래가 동기화에 실패했습니다.");
    }

    return result;
  }

  async function resolveKaptCode(accessToken: string, kaptCode?: string) {
    const { response, result } = await postApartmentJson<KaptCodeResolveResult>(
      `/api/apartments/${apartmentId}/kapt-code/resolve`,
      accessToken,
      kaptCode ? { kaptCode } : {},
    );

    if (!response.ok) {
      throw new Error(result.error ?? "K-apt 코드 탐색에 실패했습니다.");
    }

    return result;
  }

  async function syncBasicInfo(accessToken: string) {
    const { response, result } = await postApartmentJson<BasicInfoSyncResult>(
      `/api/apartments/${apartmentId}/basic-info/sync`,
      accessToken,
    );

    if (!response.ok) {
      throw new Error(result.error ?? "K-apt 기본정보 동기화에 실패했습니다.");
    }

    return result;
  }

  async function refreshCommute(accessToken: string) {
    const { response, result } = await postApartmentJson<CommuteRefreshResult>(
      `/api/apartments/${apartmentId}/commute/refresh`,
      accessToken,
    );

    if (!response.ok) {
      throw new Error(result.error ?? "접근성 자동 조회에 실패했습니다.");
    }

    return result;
  }

  const title = mockApartment?.name ?? apartment?.display_name ?? apartment?.name;
  const address = mockApartment?.address ?? apartment?.address ?? "주소 미입력";
  const memo = mockApartment?.note ?? apartment?.memo ?? "메모 없음";
  const status = mockApartment?.status ?? apartment?.status ?? "candidate";
  const priceSummary = useMemo(
    () => summarizeApartmentPrices(transactions),
    [transactions],
  );
  const trendLines = useMemo(
    () => buildMonthlyPriceTrendLines(priceSummary.monthlyTrend),
    [priceSummary.monthlyTrend],
  );
  const latestTransactionMonth = useMemo(
    () => getLatestTransactionMonth(transactions),
    [transactions],
  );
  const latestMonthTransactions = useMemo(
    () => filterTransactionsByMonth(transactions, latestTransactionMonth),
    [latestTransactionMonth, transactions],
  );
  const latestSummary = priceSummary.areaSummaries[0] ?? null;
  const commuteAccessSummary = useMemo(
    () =>
      buildCommuteAccessSummaryByApartment(commuteTimes).get(apartmentId) ??
      null,
    [apartmentId, commuteTimes],
  );
  const totalTransactionCount = priceSummary.areaSummaries.reduce(
    (sum, summary) => sum + summary.transactionCount,
    0,
  );
  const hasAnySyncInProgress =
    isComprehensiveSyncing || isSyncing || isBasicInfoSyncing || isCommuteSyncing;

  return (
    <div className="grid gap-5">
      {!mockApartment ? <AuthPanel /> : null}

      {!mockApartment && (!isSupabaseConfigured || !session) ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600 shadow-sm">
          실제 등록 단지 상세를 보려면 Supabase 환경변수와 로그인이 필요합니다.
        </p>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={status} />
                <DataBadge label={`법정동 ${apartment?.lawd_cd ?? "미입력"}`} />
                <DataBadge label={`K-apt ${apartment?.kapt_code ?? "미입력"}`} />
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
                {title ?? "단지 정보 없음"}
              </h1>
              <p className="mt-2 text-sm text-slate-600">{address}</p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
                {memo}
              </p>
            </div>
            {!mockApartment && session ? (
              <button
                type="button"
                onClick={() => void handleComprehensiveSync()}
                disabled={
                  hasAnySyncInProgress || !apartment?.lawd_cd || !isAdmin
                }
                className="h-11 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:bg-slate-300"
              >
                {isComprehensiveSyncing
                  ? "종합 조회 중"
                  : "아파트 종합 정보 조회하기"}
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <HeroMetric
              label="최근 실거래가"
              value={
                latestSummary ? formatKrw(latestSummary.latestPriceKrw) : "수집 전"
              }
              detail={
                latestSummary
                  ? `${formatDate(latestSummary.latestDealDate)} · ${latestSummary.areaBucket}㎡대`
                  : "국토부 동기화 필요"
              }
            />
            <HeroMetric
              label="저장 거래"
              value={`${totalTransactionCount.toLocaleString("ko-KR")}건`}
              detail="취소 거래 제외"
            />
            <HeroMetric
              label="여의도역"
              value={formatAccessMetric(
                commuteAccessSummary?.yeouido_station ?? null,
              )}
              detail="대중교통 / 자차"
            />
            <HeroMetric
              label="강남역"
              value={formatAccessMetric(
                commuteAccessSummary?.gangnam_station ?? null,
              )}
              detail="대중교통 / 자차"
            />
            <HeroMetric
              label="세대수"
              value={formatOptionalCount(basicInfo?.household_count ?? null, "세대")}
              detail={basicInfo ? "K-apt 기준" : "기본정보 필요"}
            />
            <HeroMetric
              label="주차"
              value={formatOptionalCount(basicInfo?.parking_count ?? null, "대")}
              detail={basicInfo ? "총 주차대수" : "기본정보 필요"}
            />
            <HeroMetric
              label="사용승인"
              value={basicInfo?.approval_date ? formatDate(basicInfo.approval_date) : "-"}
              detail="K-apt 기본정보"
            />
            <HeroMetric
              label="정보 갱신"
              value={basicInfo?.fetched_at ? formatDate(basicInfo.fetched_at) : "-"}
              detail="최근 K-apt 반영"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              강남역/여의도역 접근성
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              TMAP 기준 평일 오전 7시 30분 출발 대중교통 경로와 자동차
              소요시간을 24시간 캐시로 표시합니다.
            </p>
          </div>
          {!mockApartment && session ? (
            <button
              type="button"
              onClick={() => void handleCommuteRefresh()}
              disabled={hasAnySyncInProgress || !isAdmin}
              className="h-10 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
            >
              {isCommuteSyncing ? "접근성 조회 중" : "접근성 자동 조회"}
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <CommuteAccessCard
            title="여의도역"
            access={commuteAccessSummary?.yeouido_station ?? null}
          />
          <CommuteAccessCard
            title="강남역"
            access={commuteAccessSummary?.gangnam_station ?? null}
          />
        </div>
      </section>

      {message || candidateNames.length > 0 || kaptCodeCandidates.length > 0 ? (
        <SyncStatusPanel
          message={message}
          candidateNames={candidateNames}
          kaptCodeCandidates={kaptCodeCandidates}
          isSelecting={isComprehensiveSyncing}
          canSelect={isAdmin}
          onSelectCandidate={handleSelectKaptCandidate}
        />
      ) : null}

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              단지 기본정보
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              K-apt 공동주택 기본정보에서 세대수, 동수, 사용승인일, 난방, 주차
              정보를 가져옵니다.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              K-apt 코드: {apartment?.kapt_code ?? "미입력"}
            </p>
          </div>
          {!mockApartment && session ? (
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => void handleBasicInfoSync()}
                disabled={
                  isBasicInfoSyncing ||
                  isComprehensiveSyncing ||
                  !apartment?.kapt_code ||
                  !isAdmin
                }
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
              >
                {isBasicInfoSyncing ? "조회 중" : "K-apt 기본정보 불러오기"}
              </button>
              {!isAdmin ? (
                <p className="max-w-64 text-xs leading-5 text-slate-500">
                  K-apt 기본정보 동기화는 운영자 계정에서만 실행할 수 있습니다.
                </p>
              ) : !apartment?.kapt_code ? (
                <p className="max-w-64 text-xs leading-5 text-slate-500">
                  종합 조회로 K-apt 코드를 자동 탐색하거나, 단지 수정에서 직접
                  입력하면 버튼이 활성화됩니다.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {basicInfo ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <BasicInfoItem
              label="세대수"
              value={formatOptionalCount(basicInfo.household_count, "세대")}
            />
            <BasicInfoItem
              label="동수"
              value={formatOptionalCount(basicInfo.building_count, "동")}
            />
            <BasicInfoItem
              label="사용승인일"
              value={
                basicInfo.approval_date ? formatDate(basicInfo.approval_date) : "-"
              }
            />
            <BasicInfoItem
              label="난방"
              value={basicInfo.heating_type ?? "-"}
            />
            <BasicInfoItem
              label="관리방식"
              value={basicInfo.management_type ?? "-"}
            />
            <BasicInfoItem
              label="분양형태"
              value={basicInfo.sale_type ?? "-"}
            />
            <BasicInfoItem
              label="주차"
              value={formatOptionalCount(basicInfo.parking_count, "대")}
            />
            <BasicInfoItem
              label="출처 갱신"
              value={`${basicInfo.source_name} · ${formatDate(basicInfo.fetched_at)}`}
            />
          </div>
        ) : (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            아직 저장된 K-apt 기본정보가 없습니다. 운영자 계정에서 종합 조회를
            실행하거나 K-apt 코드를 확인한 뒤 기본정보를 불러오세요.
          </p>
        )}
      </section>

      <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              가격/실거래가
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              국토부 아파트 매매 실거래가 상세 자료를 최근 12개월까지 조회해
              차트에 반영하고, 아래 거래 표는 최신 거래월만 표시합니다.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              법정동코드: {apartment?.lawd_cd ?? "미입력"}
            </p>
          </div>
          {!mockApartment && session ? (
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => void handleTransactionSync()}
                disabled={
                  isSyncing ||
                  isComprehensiveSyncing ||
                  !apartment?.lawd_cd ||
                  !isAdmin
                }
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
              >
                {isSyncing ? "조회 중" : "최근 실거래가 불러오기"}
              </button>
              {!isAdmin ? (
                <p className="max-w-64 text-xs leading-5 text-slate-500">
                  실거래가 동기화는 운영자 계정에서만 실행할 수 있습니다.
                </p>
              ) : !apartment?.lawd_cd ? (
                <p className="max-w-64 text-xs leading-5 text-slate-500">
                  단지 수정에서 법정동코드를 입력하면 버튼이 활성화됩니다. 10자리
                  법정동코드는 그대로 저장하고, 국토부 조회에는 앞 5자리만 사용합니다.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {transactions.length > 0 ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {priceSummary.areaSummaries.map((summary) => (
                <article
                  key={summary.areaBucket}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {summary.areaBucket}㎡대
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {summary.exclusiveAreaMinM2.toLocaleString("ko-KR", {
                          maximumFractionDigits: 2,
                        })}
                        ~
                        {summary.exclusiveAreaMaxM2.toLocaleString("ko-KR", {
                          maximumFractionDigits: 2,
                        })}
                        ㎡
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {summary.transactionCount}건
                    </span>
                  </div>
                  <p className="mt-4 text-xl font-semibold text-slate-950">
                    {formatKrw(summary.latestPriceKrw)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    최근 거래 {formatDate(summary.latestDealDate)}
                  </p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-500">평균</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {formatKrw(summary.averagePriceKrw)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">최저</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {formatKrw(summary.minPriceKrw)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">최고</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {formatKrw(summary.maxPriceKrw)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            {trendLines.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      월별 평균 실거래가 추이
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      국토부 실거래가 기준입니다. 거래 건수가 적은 월은 평균가
                      변동성이 클 수 있습니다.
                    </p>
                  </div>
                  {trendLines.some((line) => line.isSparse) ? (
                    <span className="w-fit rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                      표본 적음
                    </span>
                  ) : null}
                </div>
                <PriceTrendLineChart lines={trendLines} />
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">
                    최신 거래월 상세
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {latestTransactionMonth
                      ? `${latestTransactionMonth} 거래 ${latestMonthTransactions.length.toLocaleString(
                          "ko-KR",
                        )}건만 표시합니다.`
                      : "표시할 최신 거래월이 없습니다."}
                  </p>
                </div>
                <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  차트 기준 {transactions.length.toLocaleString("ko-KR")}건
                </span>
              </div>
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-50 text-sm text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">계약일</th>
                    <th className="px-4 py-3 font-semibold">전용면적</th>
                    <th className="px-4 py-3 font-semibold">층</th>
                    <th className="px-4 py-3 font-semibold">거래금액</th>
                    <th className="px-4 py-3 font-semibold">원천 단지명</th>
                    <th className="px-4 py-3 font-semibold">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {latestMonthTransactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="border-b border-slate-200 last:border-0"
                    >
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatDate(transaction.deal_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {Number(transaction.exclusive_area_m2).toLocaleString(
                          "ko-KR",
                          {
                            maximumFractionDigits: 2,
                          },
                        )}
                        ㎡
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {transaction.floor ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-950">
                        {formatKrw(transaction.deal_amount_krw)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {transaction.apartment_name_from_source ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {transaction.cancel_yn
                          ? `해제 ${transaction.cancel_date ?? ""}`
                          : "정상"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            아직 저장된 실거래가가 없습니다. 운영자 계정에서 법정동코드를 확인한 뒤
            최근 실거래가를 불러오세요.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              다음 리서치 항목
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              아직 자동화되지 않은 항목은 접힌 목록으로만 유지합니다.
            </p>
          </div>
          <Link
            href={`/field-notes/${apartmentId}`}
            className="w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            임장 메모 열기
          </Link>
        </div>
        <div className="mt-4 grid gap-2">
          {sections.map(([sectionTitle, body]) => (
            <details
              key={sectionTitle}
              className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                {sectionTitle}
              </summary>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

const PRICE_TREND_COLORS = ["#0f766e", "#2563eb", "#b45309", "#be123c"];

function DataBadge({ label }: Readonly<{ label: string }>) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
      {label}
    </span>
  );
}

function HeroMetric({
  detail,
  label,
  value,
}: Readonly<{ detail: string; label: string; value: string }>) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold text-slate-950">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function CommuteAccessCard({
  access,
  title,
}: Readonly<{
  access: CommuteAccessSummary[CommuteDestinationKey] | null;
  title: string;
}>) {
  const transit = access?.transit ?? null;
  const driving = access?.driving ?? null;

  return (
    <article className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-xs text-slate-500">TMAP 24시간 캐시</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
          {transit?.isExpired || driving?.isExpired ? "갱신 필요" : "저장됨"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CommuteModeSummary label="대중교통" commute={transit} />
        <CommuteModeSummary label="자동차" commute={driving} />
      </div>
      <TransitRouteTimeline commute={transit} />
    </article>
  );
}

function formatCommuteMetric(commute: CommuteSummary | null) {
  return commute ? `${commute.durationMinutes.toLocaleString("ko-KR")}분` : "-";
}

function CommuteModeSummary({
  commute,
  label,
}: Readonly<{ commute: CommuteSummary | null; label: string }>) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        {commute?.isExpired ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            만료
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xl font-semibold text-slate-950">
        {formatCommuteMetric(commute)}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        {commute ? formatCommuteSubtext(commute) : "조회 전"}
      </p>
      {commute?.fetchedAt ? (
        <p className="mt-2 text-[11px] text-slate-400">
          조회 {formatDate(commute.fetchedAt)}
          {commute.expiresAt ? ` · 만료 ${formatDate(commute.expiresAt)}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function TransitRouteTimeline({
  commute,
}: Readonly<{ commute: CommuteSummary | null }>) {
  if (!commute) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
        접근성 자동 조회를 실행하면 도보, 버스, 지하철, 환승 구간이 여기에 표시됩니다.
      </p>
    );
  }

  if (commute.routeSteps.length === 0) {
    return (
      <p className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
        상세 경로가 없는 수동 입력값입니다.
      </p>
    );
  }

  return (
    <ol className="grid gap-2">
      {commute.routeSteps.map((step, index) => (
        <li
          key={`${step.mode}-${index}-${step.title}`}
          className="flex gap-3 rounded-md border border-slate-200 bg-white p-3"
        >
          <span
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getRouteStepTone(
              step.mode,
            )}`}
          >
            {getRouteStepIcon(step.mode)}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">
              {step.routeName ? `${step.title} · ${step.routeName}` : step.title}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {step.detail ?? "-"}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {formatRouteStepMeta(step)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function formatAccessMetric(
  access: CommuteAccessSummary[CommuteDestinationKey] | null,
) {
  if (!access?.transit && !access?.driving) {
    return "-";
  }

  return `${formatCommuteMetric(access.transit)} / ${formatCommuteMetric(
    access.driving,
  )}`;
}

function formatCommuteSubtext(commute: CommuteSummary) {
  const parts = [];

  if (commute.transportType === "transit" && commute.transferCount !== null) {
    parts.push(`환승 ${commute.transferCount}회`);
  }

  if (commute.walkDistanceMeters !== null) {
    parts.push(`도보 ${formatMeters(commute.walkDistanceMeters)}`);
  }

  if (commute.distanceMeters !== null) {
    parts.push(`거리 ${formatMeters(commute.distanceMeters)}`);
  }

  if (commute.fareKrw !== null) {
    parts.push(`요금 ${commute.fareKrw.toLocaleString("ko-KR")}원`);
  }

  return parts.join(" · ") || "상세 정보 없음";
}

function formatRouteStepMeta(step: CommuteSummary["routeSteps"][number]) {
  return [
    step.durationMinutes !== null ? `${step.durationMinutes}분` : null,
    step.distanceMeters !== null ? formatMeters(step.distanceMeters) : null,
    step.stopCount !== null ? `${step.stopCount}개 정류장` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatMeters(value: number) {
  return value >= 1000
    ? `${(value / 1000).toLocaleString("ko-KR", {
        maximumFractionDigits: 1,
      })}km`
    : `${value.toLocaleString("ko-KR")}m`;
}

function getRouteStepTone(mode: CommuteSummary["routeSteps"][number]["mode"]) {
  if (mode === "bus") {
    return "bg-blue-50 text-blue-700";
  }

  if (mode === "subway") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (mode === "transfer") {
    return "bg-amber-50 text-amber-700";
  }

  if (mode === "driving") {
    return "bg-slate-100 text-slate-700";
  }

  return "bg-slate-50 text-slate-600";
}

function getRouteStepIcon(mode: CommuteSummary["routeSteps"][number]["mode"]) {
  if (mode === "bus") {
    return "B";
  }

  if (mode === "subway") {
    return "M";
  }

  if (mode === "transfer") {
    return "↔";
  }

  if (mode === "driving") {
    return "C";
  }

  return "W";
}

function SyncStatusPanel({
  canSelect,
  candidateNames,
  isSelecting,
  kaptCodeCandidates,
  message,
  onSelectCandidate,
}: Readonly<{
  canSelect: boolean;
  candidateNames: Array<{ name: string; count: number }>;
  isSelecting: boolean;
  kaptCodeCandidates: KaptCodeCandidate[];
  message: string | null;
  onSelectCandidate: (kaptCode: string) => void | Promise<void>;
}>) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Sync status
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            데이터 조회 상태
          </h2>
        </div>
        {isSelecting ? (
          <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            처리 중
          </span>
        ) : null}
      </div>

      {message ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
          {message}
        </p>
      ) : null}

      {candidateNames.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">국토부 원천명 후보</p>
          <p className="mt-1 leading-6">
            단지명 매칭이 애매합니다. 필요한 경우 단지 수정 화면에서 alias를
            추가한 뒤 다시 동기화하세요.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {candidateNames.map((candidate) => (
              <span
                key={candidate.name}
                className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold"
              >
                {candidate.name} · {candidate.count}건
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {kaptCodeCandidates.length > 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">K-apt 코드 후보 선택 필요</p>
              <p className="mt-1 text-emerald-900">
                실제 단지와 일치하는 항목을 선택하면 기본정보 조회까지 이어집니다.
              </p>
            </div>
            <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
              {kaptCodeCandidates.length}개 후보
            </span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-emerald-900/70">
                <tr>
                  <th className="py-2 pr-3 font-semibold">단지명</th>
                  <th className="py-2 pr-3 font-semibold">주소</th>
                  <th className="py-2 pr-3 font-semibold">매칭 근거</th>
                  <th className="py-2 pr-3 font-semibold">점수</th>
                  <th className="py-2 font-semibold">선택</th>
                </tr>
              </thead>
              <tbody>
                {kaptCodeCandidates.map((candidate) => (
                  <tr
                    key={candidate.kaptCode}
                    className="border-t border-emerald-200/80"
                  >
                    <td className="py-3 pr-3 align-top">
                      <p className="font-semibold text-slate-950">
                        {candidate.kaptName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {candidate.kaptCode}
                      </p>
                    </td>
                    <td className="py-3 pr-3 align-top text-slate-700">
                      {formatCandidateAddress(candidate) || "-"}
                    </td>
                    <td className="py-3 pr-3 align-top text-slate-700">
                      {candidate.reasons.join(", ") || "후보"}
                    </td>
                    <td className="py-3 pr-3 align-top font-semibold text-slate-950">
                      {candidate.score}
                    </td>
                    <td className="py-3 align-top">
                      <button
                        type="button"
                        onClick={() => void onSelectCandidate(candidate.kaptCode)}
                        disabled={isSelecting || !canSelect}
                        className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:bg-slate-300"
                      >
                        선택
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PriceTrendLineChart({
  lines,
}: Readonly<{ lines: MonthlyPriceTrendLine[] }>) {
  const [hiddenAreaBuckets, setHiddenAreaBuckets] = useState<string[]>([]);
  const availableAreaBuckets = new Set(lines.map((line) => line.areaBucket));
  const effectiveHiddenAreaBuckets = hiddenAreaBuckets.filter((areaBucket) =>
    availableAreaBuckets.has(areaBucket),
  );
  const visibleLines = lines.filter(
    (line) => !effectiveHiddenAreaBuckets.includes(line.areaBucket),
  );
  const chartPoints = visibleLines.flatMap((line) =>
    line.points.map((point) => ({
      ...point,
      areaBucket: line.areaBucket,
    })),
  );

  if (chartPoints.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
        표시할 평형대를 선택하세요.
      </div>
    );
  }

  const months = Array.from(new Set(chartPoints.map((point) => point.month))).sort();
  const prices = chartPoints.map((point) => point.averagePriceKrw);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const width = 920;
  const height = 360;
  const paddingLeft = 88;
  const paddingRight = 36;
  const paddingTop = 32;
  const paddingBottom = 54;
  const yAxisPrices = buildLinearTicks(minPrice, maxPrice, 5);
  const scaleMin = Math.min(...yAxisPrices, minPrice);
  const scaleMax = Math.max(...yAxisPrices, maxPrice);
  const visibleMonthLabels = getVisibleMonthLabels(months, 6);
  const latestPoint = [...chartPoints].sort((left, right) =>
    right.month.localeCompare(left.month),
  )[0];
  const highestPoint = chartPoints.reduce((current, point) =>
    point.averagePriceKrw > current.averagePriceKrw ? point : current,
  );
  const lowestPoint = chartPoints.reduce((current, point) =>
    point.averagePriceKrw < current.averagePriceKrw ? point : current,
  );
  const trendWindow = summarizeMonthlyTrendWindow(visibleLines);

  const getX = (month: string) => {
    if (months.length === 1) {
      return width / 2;
    }

    return (
      paddingLeft +
      (months.indexOf(month) / (months.length - 1)) *
        (width - paddingLeft - paddingRight)
    );
  };
  const getY = (price: number) => {
    if (scaleMin === scaleMax) {
      return (height - paddingBottom + paddingTop) / 2;
    }

    return (
      height -
      paddingBottom -
      ((price - scaleMin) / (scaleMax - scaleMin)) *
        (height - paddingTop - paddingBottom)
    );
  };
  const toggleAreaBucket = (areaBucket: string) => {
    setHiddenAreaBuckets((current) => {
      const validCurrent = current.filter((item) =>
        availableAreaBuckets.has(item),
      );

      if (validCurrent.includes(areaBucket)) {
        return validCurrent.filter((item) => item !== areaBucket);
      }

      const visibleCount = lines.length - validCurrent.length;

      return visibleCount <= 1 ? validCurrent : [...validCurrent, areaBucket];
    });
  };

  return (
    <div className="mt-4">
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ChartStat
          label="최신"
          value={formatKrw(latestPoint.averagePriceKrw)}
          detail={`${latestPoint.month} · ${latestPoint.areaBucket}㎡대`}
        />
        <ChartStat
          label="최고"
          value={formatKrw(highestPoint.averagePriceKrw)}
          detail={`${highestPoint.month} · ${highestPoint.areaBucket}㎡대`}
        />
        <ChartStat
          label="최저"
          value={formatKrw(lowestPoint.averagePriceKrw)}
          detail={`${lowestPoint.month} · ${lowestPoint.areaBucket}㎡대`}
        />
        {trendWindow ? (
          <ChartStat
            label="기간 변화"
            value={formatSignedKrw(trendWindow.changeKrw)}
            detail={`${trendWindow.firstMonth} → ${trendWindow.latestMonth} · ${formatTrendPercent(
              trendWindow.changePercent,
            )}`}
          />
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
        <svg
          role="img"
          aria-label="월별 평균 실거래가 line chart"
          className="min-w-[760px]"
          viewBox={`0 0 ${width} ${height}`}
        >
          <rect width={width} height={height} rx="12" fill="#ffffff" />
          <line
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={height - paddingBottom}
            y2={height - paddingBottom}
            stroke="#cbd5e1"
          />
          <line
            x1={paddingLeft}
            x2={paddingLeft}
            y1={paddingTop}
            y2={height - paddingBottom}
            stroke="#cbd5e1"
          />
          {yAxisPrices.map((price) => (
            <g key={price}>
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={getY(price)}
                y2={getY(price)}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 12}
                y={getY(price) + 4}
                fill="#64748b"
                fontSize="11"
                textAnchor="end"
              >
                {formatKrw(price)}
              </text>
            </g>
          ))}
          {visibleMonthLabels.map((month) => (
            <text
              key={month}
              x={getX(month)}
              y={height - 14}
              fill="#64748b"
              fontSize="11"
              textAnchor="middle"
            >
              {month}
            </text>
          ))}
          {lines.map((line, lineIndex) => {
            const color =
              PRICE_TREND_COLORS[lineIndex % PRICE_TREND_COLORS.length];
            const isHidden = effectiveHiddenAreaBuckets.includes(line.areaBucket);

            if (isHidden) {
              return null;
            }

            const path = line.points
              .map(
                (point, pointIndex) =>
                  `${pointIndex === 0 ? "M" : "L"} ${getX(point.month)} ${getY(
                    point.averagePriceKrw,
                  )}`,
              )
              .join(" ");

            return (
              <g key={line.areaBucket}>
                {line.points.length > 1 ? (
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    strokeDasharray={line.isSparse ? "8 7" : undefined}
                  />
                ) : null}
                {line.points.map((point, pointIndex) => {
                  const isLatest = pointIndex === line.points.length - 1;

                  return (
                  <circle
                    key={`${line.areaBucket}-${point.month}`}
                    cx={getX(point.month)}
                    cy={getY(point.averagePriceKrw)}
                    fill="#ffffff"
                    r={isLatest ? "6" : "4"}
                    stroke={color}
                    strokeWidth="3"
                  >
                    <title>
                      {point.month} {line.areaBucket}㎡ 평균{" "}
                      {formatKrw(point.averagePriceKrw)} ({point.transactionCount}
                      건)
                    </title>
                  </circle>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
        {lines.map((line, index) => (
          <button
            type="button"
            key={line.areaBucket}
            onClick={() => toggleAreaBucket(line.areaBucket)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-semibold transition ${
              effectiveHiddenAreaBuckets.includes(line.areaBucket)
                ? "border-slate-200 bg-white text-slate-400"
                : "border-slate-200 bg-white text-slate-700 shadow-sm"
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor:
                  PRICE_TREND_COLORS[index % PRICE_TREND_COLORS.length],
              }}
            />
            {line.areaBucket}㎡대 · {line.totalTransactionCount}건
          </button>
        ))}
      </div>
    </div>
  );
}

function ChartStat({
  detail,
  label,
  value,
}: Readonly<{ detail: string; label: string; value: string }>) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function formatSignedKrw(value: number) {
  if (value === 0) {
    return "변동 없음";
  }

  return `${value > 0 ? "+" : "-"}${formatKrw(Math.abs(value))}`;
}

function formatTrendPercent(value: number | null) {
  if (value === null) {
    return "비교 불가";
  }

  if (value === 0) {
    return "0.0%";
  }

  return `${value > 0 ? "+" : ""}${value.toLocaleString("ko-KR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}%`;
}

async function readJsonResult<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

async function postApartmentJson<T>(
  url: string,
  accessToken: string,
  body: Record<string, unknown> = {},
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const result = await readJsonResult<T & { error?: string }>(response);

  return { response, result };
}

function formatTransactionSyncMessage(result: TransactionSyncResult) {
  const monthsChecked = result.monthsChecked ?? 0;
  const matchedCount = result.matchedCount ?? 0;
  const matchedMonthCount =
    result.matchedDealYmds?.length ?? (result.dealYmd ? 1 : 0);

  return matchedCount > 0
    ? `최근 ${monthsChecked}개월을 확인했고, ${matchedMonthCount}개월치 실거래가 ${matchedCount}건을 반영했습니다.`
    : `최근 ${monthsChecked}개월에서 단지명 일치 거래를 찾지 못했습니다.`;
}

function formatBasicInfoSyncMessage(result: BasicInfoSyncResult) {
  return result.kaptName
    ? `${result.kaptName} K-apt 기본정보를 반영했습니다.`
    : "K-apt 기본정보를 반영했습니다.";
}

function formatCommuteRefreshMessage(result: CommuteRefreshResult) {
  const savedCount = result.savedCount ?? 0;
  const failedCount = result.errors?.length ?? 0;
  const baseMessage = `접근성 ${savedCount}건을 TMAP 기준으로 조회했습니다.`;
  const expireMessage = result.expiresAt
    ? `자동 조회값은 ${formatDate(result.expiresAt)}까지 표시됩니다.`
    : "자동 조회값은 24시간 동안 표시됩니다.";

  return failedCount > 0
    ? `${baseMessage} 일부 실패 ${failedCount}건이 있습니다. ${expireMessage}`
    : `${baseMessage} ${expireMessage}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청 처리에 실패했습니다.";
}

function formatCandidateAddress(candidate: KaptCodeCandidate) {
  return (
    candidate.roadAddress ??
    candidate.legalAddress ??
    [candidate.sido, candidate.sigungu, candidate.eupmyeondong, candidate.ri]
      .filter(Boolean)
      .join(" ")
  );
}

function formatOptionalCount(value: number | null, suffix: string) {
  return value !== null ? `${value.toLocaleString("ko-KR")}${suffix}` : "-";
}

function isMissingTableError(error: { code?: string }) {
  return error.code === "42P01" || error.code === "PGRST205";
}

function BasicInfoItem({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <dl className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-2 text-sm font-semibold text-slate-950">{value}</dd>
    </dl>
  );
}
