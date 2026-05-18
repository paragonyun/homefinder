import Link from "next/link";
import { ApartmentRow } from "@/components/apartments/apartment-row";
import { AppShell } from "@/components/layout/app-shell";
import { apartments } from "@/lib/mock-data";

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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">단지</th>
                <th className="px-4 py-3 font-semibold">동네</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold">최근가</th>
                <th className="px-4 py-3 font-semibold">평형대</th>
                <th className="px-4 py-3 font-semibold">데이터</th>
                <th className="px-4 py-3 font-semibold">메모</th>
              </tr>
            </thead>
            <tbody>
              {apartments.map((apartment) => (
                <ApartmentRow key={apartment.id} {...apartment} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
