"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth/auth-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import { apartments as mockApartments } from "@/lib/mock-data";
import {
  buildMonthlyPriceTrendLines,
  summarizeApartmentPrices,
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
  monthsChecked?: number;
  candidateNames?: Array<{ name: string; count: number }>;
};

type BasicInfoSyncResult = {
  error?: string;
  kaptName?: string | null;
  fetchedAt?: string;
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
  ["접근성", "여의도역/강남역과 커스텀 목적지 소요시간을 표시합니다."],
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
  const [candidateNames, setCandidateNames] = useState<
    Array<{ name: string; count: number }>
  >([]);
  const [kaptCodeCandidates, setKaptCodeCandidates] = useState<
    KaptCodeCandidate[]
  >([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBasicInfoSyncing, setIsBasicInfoSyncing] = useState(false);
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
      return;
    }

    const [
      { data: apartmentData, error: apartmentError },
      { data: basicInfoData, error: basicInfoError },
      { data: transactionData, error: transactionError },
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

  return (
    <div className="grid gap-5">
      {!mockApartment ? <AuthPanel /> : null}

      {!mockApartment && (!isSupabaseConfigured || !session) ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
          실제 등록 단지 상세를 보려면 Supabase 환경변수와 로그인이 필요합니다.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </p>
      ) : null}

      {candidateNames.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">국토부 원천명 후보</p>
          <p className="mt-1 leading-6">
            아래 이름을 단지 수정 화면의 국토부 원천 단지명 alias에 추가한 뒤 다시
            동기화하세요.
          </p>
          <ul className="mt-2 grid gap-1">
            {candidateNames.map((candidate) => (
              <li key={candidate.name}>
                {candidate.name} ({candidate.count}건)
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {kaptCodeCandidates.length > 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <p className="font-semibold">K-apt 코드 후보</p>
          <p className="mt-1 leading-6">
            후보가 여러 개라 자동 저장하지 않았습니다. 실제 단지와 일치하는 항목을
            선택하면 K-apt 기본정보 조회까지 이어집니다.
          </p>
          <ul className="mt-3 grid gap-2">
            {kaptCodeCandidates.map((candidate) => (
              <li
                key={candidate.kaptCode}
                className="flex flex-col gap-2 rounded-md border border-emerald-200 bg-white p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-950">
                    {candidate.kaptName} · {candidate.kaptCode}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {[candidate.sido, candidate.sigungu, candidate.eupmyeondong, candidate.ri]
                      .filter(Boolean)
                      .join(" ")}
                    {candidate.bjdCode ? ` · ${candidate.bjdCode}` : ""}
                  </p>
                  {candidate.roadAddress || candidate.legalAddress ? (
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {candidate.roadAddress ?? candidate.legalAddress}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    {candidate.reasons.join(", ") || "후보"} · 점수{" "}
                    {candidate.score}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSelectKaptCandidate(candidate.kaptCode)}
                  disabled={isComprehensiveSyncing || !isAdmin}
                  className="w-fit rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-400"
                >
                  이 코드 선택
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
              {title ?? "단지 정보 없음"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{address}</p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
              {memo}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <StatusPill status={status} />
            {!mockApartment && session ? (
              <button
                type="button"
                onClick={() => void handleComprehensiveSync()}
                disabled={
                  isComprehensiveSyncing ||
                  isSyncing ||
                  isBasicInfoSyncing ||
                  !apartment?.lawd_cd ||
                  !isAdmin
                }
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
              >
                {isComprehensiveSyncing
                  ? "종합 조회 중"
                  : "아파트 종합 정보 조회하기"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
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
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
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

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              가격/실거래가
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              국토부 아파트 매매 실거래가 상세 자료를 최근월부터 과거 24개월까지
              조회하고, 단지명이 일치한 최신 거래월만 저장합니다.
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
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
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
                  className="rounded-md border border-slate-200 bg-slate-50 p-4"
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
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600">
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
              <div className="rounded-md border border-slate-200 bg-white p-4">
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
                  {transactions.map((transaction) => (
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

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map(([sectionTitle, body]) => (
          <article
            key={sectionTitle}
            className="rounded-lg border border-slate-200 bg-white p-5"
          >
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              {sectionTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
          </article>
        ))}
      </section>

      <Link
        href={`/field-notes/${apartmentId}`}
        className="w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
      >
        임장 메모 열기
      </Link>
    </div>
  );
}

const PRICE_TREND_COLORS = ["#0f766e", "#2563eb", "#b45309", "#be123c"];

function PriceTrendLineChart({
  lines,
}: Readonly<{ lines: MonthlyPriceTrendLine[] }>) {
  const chartPoints = lines.flatMap((line) =>
    line.points.map((point) => ({
      ...point,
      areaBucket: line.areaBucket,
    })),
  );

  if (chartPoints.length === 0) {
    return null;
  }

  const months = Array.from(new Set(chartPoints.map((point) => point.month))).sort();
  const prices = chartPoints.map((point) => point.averagePriceKrw);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const width = 680;
  const height = 260;
  const paddingX = 56;
  const paddingTop = 24;
  const paddingBottom = 42;

  const getX = (month: string) => {
    if (months.length === 1) {
      return width / 2;
    }

    return (
      paddingX +
      (months.indexOf(month) / (months.length - 1)) * (width - paddingX * 2)
    );
  };
  const getY = (price: number) => {
    if (minPrice === maxPrice) {
      return (height - paddingBottom + paddingTop) / 2;
    }

    return (
      height -
      paddingBottom -
      ((price - minPrice) / (maxPrice - minPrice)) *
        (height - paddingTop - paddingBottom)
    );
  };
  const visibleMonthLabels =
    months.length <= 6
      ? months
      : months.filter(
          (_month, index) => index === 0 || index === months.length - 1,
        );
  const yAxisPrices = Array.from(new Set([minPrice, maxPrice]));

  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label="월별 평균 실거래가 line chart"
          className="min-w-[620px]"
          viewBox={`0 0 ${width} ${height}`}
        >
          <line
            x1={paddingX}
            x2={width - paddingX}
            y1={height - paddingBottom}
            y2={height - paddingBottom}
            stroke="#cbd5e1"
          />
          <line
            x1={paddingX}
            x2={paddingX}
            y1={paddingTop}
            y2={height - paddingBottom}
            stroke="#cbd5e1"
          />
          {yAxisPrices.map((price) => (
            <g key={price}>
              <line
                x1={paddingX}
                x2={width - paddingX}
                y1={getY(price)}
                y2={getY(price)}
                stroke="#e2e8f0"
              />
              <text
                x={paddingX - 10}
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
                  />
                ) : null}
                {line.points.map((point) => (
                  <circle
                    key={`${line.areaBucket}-${point.month}`}
                    cx={getX(point.month)}
                    cy={getY(point.averagePriceKrw)}
                    fill="#ffffff"
                    r="4"
                    stroke={color}
                    strokeWidth="3"
                  >
                    <title>
                      {point.month} {line.areaBucket}㎡ 평균{" "}
                      {formatKrw(point.averagePriceKrw)} ({point.transactionCount}
                      건)
                    </title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
        {lines.map((line, index) => (
          <span
            key={line.areaBucket}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor:
                  PRICE_TREND_COLORS[index % PRICE_TREND_COLORS.length],
              }}
            />
            {line.areaBucket}㎡대 · {line.totalTransactionCount}건
          </span>
        ))}
      </div>
    </div>
  );
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

  return matchedCount > 0 && result.dealYmd
    ? `최근 ${monthsChecked}개월을 확인했고, ${result.dealYmd} 실거래가 ${matchedCount}건을 반영했습니다.`
    : `최근 ${monthsChecked}개월에서 단지명 일치 거래를 찾지 못했습니다.`;
}

function formatBasicInfoSyncMessage(result: BasicInfoSyncResult) {
  return result.kaptName
    ? `${result.kaptName} K-apt 기본정보를 반영했습니다.`
    : "K-apt 기본정보를 반영했습니다.";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청 처리에 실패했습니다.";
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
    <dl className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-2 text-sm font-semibold text-slate-950">{value}</dd>
    </dl>
  );
}
