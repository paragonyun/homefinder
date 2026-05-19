"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth/auth-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import { apartments as mockApartments } from "@/lib/mock-data";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type {
  ApartmentRowData,
  ApartmentTransactionRow,
} from "@/lib/supabase/table-types";
import { formatDate } from "@/utils/date";
import { formatKrw } from "@/utils/format-price";

type ApartmentDetailClientProps = {
  apartmentId: string;
};

const sections = [
  ["단지 기본정보", "K-apt 매칭 후 세대수, 동수, 사용승인일, 난방, 주차 정보를 표시합니다."],
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
  const [transactions, setTransactions] = useState<ApartmentTransactionRow[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
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
      setTransactions([]);
      return;
    }

    const [
      { data: apartmentData, error: apartmentError },
      { data: transactionData, error: transactionError },
    ] = await Promise.all([
      supabase
        .from("apartments")
        .select("*")
        .eq("id", apartmentId)
        .maybeSingle(),
      supabase
        .from("apartment_transactions")
        .select("*")
        .eq("apartment_id", apartmentId)
        .order("deal_date", { ascending: false })
        .limit(30),
    ]);

    if (apartmentError) {
      setMessage(apartmentError.message);
    } else {
      setApartment((apartmentData as ApartmentRowData | null) ?? null);
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

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    const response = await fetch(
      `/api/apartments/${apartmentId}/transactions/sync`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${currentSession?.access_token ?? ""}`,
        },
        body: JSON.stringify({}),
      },
    );
    const result = (await response.json()) as {
      error?: string;
      matchedCount?: number;
      totalCount?: number;
      dealYmd?: string;
      monthsChecked?: number;
    };

    if (!response.ok) {
      setMessage(result.error ?? "실거래가 동기화에 실패했습니다.");
    } else {
      await loadApartment();
      const monthsChecked = result.monthsChecked ?? 0;
      const matchedCount = result.matchedCount ?? 0;

      setMessage(
        matchedCount > 0 && result.dealYmd
          ? `최근 ${monthsChecked}개월을 확인했고, ${result.dealYmd} 실거래가 ${matchedCount}건을 반영했습니다.`
          : `최근 ${monthsChecked}개월에서 단지명 일치 거래를 찾지 못했습니다.`,
      );
    }

    setIsSyncing(false);
  }

  const title = mockApartment?.name ?? apartment?.display_name ?? apartment?.name;
  const address = mockApartment?.address ?? apartment?.address ?? "주소 미입력";
  const memo = mockApartment?.note ?? apartment?.memo ?? "메모 없음";
  const status = mockApartment?.status ?? apartment?.status ?? "candidate";

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
          <StatusPill status={status} />
        </div>
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
          {!mockApartment && session && isAdmin ? (
            <div className="flex flex-wrap items-end gap-2">
              <button
                type="button"
                onClick={() => void handleTransactionSync()}
                disabled={isSyncing || !apartment?.lawd_cd}
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
              >
                {isSyncing ? "조회 중" : "최근 실거래가 불러오기"}
              </button>
            </div>
          ) : null}
        </div>

        {transactions.length > 0 ? (
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
                      {Number(transaction.exclusive_area_m2).toLocaleString("ko-KR", {
                        maximumFractionDigits: 2,
                      })}
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
