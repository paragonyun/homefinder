import Link from "next/link";
import { ApartmentRow } from "@/components/apartments/apartment-row";
import { DataTaskList } from "@/components/dashboard/data-task-list";
import { SummaryStat } from "@/components/dashboard/summary-stat";
import { AppShell } from "@/components/layout/app-shell";
import { NeighborhoodCard } from "@/components/neighborhoods/neighborhood-card";
import { apartments, neighborhoods } from "@/lib/mock-data";

export default function Home() {
  return (
    <AppShell>
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <SummaryStat
            label="관심 동네"
            value={`${neighborhoods.length}곳`}
            detail="신길, 보라매, 사당 권역을 우선 비교합니다."
          />
          <SummaryStat
            label="관심 단지"
            value={`${apartments.length}개`}
            detail="실거래가와 K-apt 매칭 전 placeholder입니다."
          />
          <SummaryStat
            label="임장 예정"
            value="1개"
            detail="모바일 임장 메모 화면을 다음 단계에서 연결합니다."
          />
          <SummaryStat
            label="데이터 상태"
            value="설계 중"
            detail="외부 API 키 없이도 화면은 정상 렌더링됩니다."
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-normal text-slate-950">
                  관심 동네
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  동네별 후보 수, 가격대, 여의도/강남 접근성 메모를 모읍니다.
                </p>
              </div>
              <Link
                href="/neighborhoods"
                className="w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                동네 목록 보기
              </Link>
            </div>
            {neighborhoods.map((neighborhood) => (
              <NeighborhoodCard key={neighborhood.id} {...neighborhood} />
            ))}
          </div>
          <DataTaskList />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-normal text-slate-950">
                관심 단지
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                실거래가, 평형대, 출처 상태, 내 판단 메모를 한 표에서 비교합니다.
              </p>
            </div>
            <Link
              href="/apartments/new"
              className="w-fit rounded-md border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              단지 추가 placeholder
            </Link>
          </div>
          <div className="hidden overflow-x-auto md:block">
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
          <div className="grid gap-3 p-4 md:hidden">
            {apartments.map((apartment) => (
              <article
                key={apartment.id}
                className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <Link
                  href={`/apartments/${apartment.id}`}
                  className="break-keep font-semibold text-slate-950"
                >
                  {apartment.name}
                </Link>
                <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                  {apartment.address}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm min-[380px]:grid-cols-2">
                  <DashboardMiniMetric label="동네" value={apartment.neighborhood} />
                  <DashboardMiniMetric label="최근가" value={apartment.latestPrice} />
                  <DashboardMiniMetric label="평형대" value={apartment.areaSummary} />
                  <DashboardMiniMetric label="상태" value={apartment.sourceState} />
                </div>
                <p className="mt-3 break-words text-sm leading-6 text-slate-700">
                  {apartment.note}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function DashboardMiniMetric({
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
