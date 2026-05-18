import Link from "next/link";
import { ApartmentsClient } from "@/components/apartments/apartments-client";
import { AppShell } from "@/components/layout/app-shell";

export default function ApartmentsPage() {
  return (
    <AppShell>
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
              관심 단지
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              단지명/주소 검색, 좌표 변환, 법정동코드, K-apt 코드 매칭은 다음
              단계에서 adapter와 API route로 연결합니다.
            </p>
          </div>
          <Link
            href="/apartments/new"
            className="w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            단지 추가
          </Link>
        </div>
      </section>
      <div className="mt-5">
        <ApartmentsClient />
      </div>
    </AppShell>
  );
}
