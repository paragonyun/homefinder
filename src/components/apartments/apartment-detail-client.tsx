"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth/auth-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { apartments as mockApartments } from "@/lib/mock-data";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type { ApartmentRowData } from "@/lib/supabase/table-types";

type ApartmentDetailClientProps = {
  apartmentId: string;
};

const sections = [
  ["가격/실거래가", "국토부 실거래가 adapter 연결 후 평형대별 테이블과 차트를 표시합니다."],
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
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase || mockApartment) {
      return;
    }

    const client = supabase;
    let isMounted = true;

    async function loadApartment() {
      const { data: sessionData } = await client.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSession(sessionData.session);

      if (!sessionData.session) {
        return;
      }

      const { data, error } = await client
        .from("apartments")
        .select("*")
        .eq("id", apartmentId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        setMessage(error.message);
      } else {
        setApartment((data as ApartmentRowData | null) ?? null);
      }
    }

    void loadApartment();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
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
  }, [apartmentId, mockApartment, supabase]);

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
