import { AppShell } from "@/components/layout/app-shell";
import { apartments } from "@/lib/mock-data";

export default function ComparePage() {
  return (
    <AppShell>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
          단지 비교
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          여러 단지를 선택해 최근 실거래가, 평형대, 전세가율, 세대수, 주차,
          접근성, 임장 점수, 내 관심 상태를 비교하는 화면입니다.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">항목</th>
                {apartments.map((apartment) => (
                  <th key={apartment.id} className="px-4 py-3 font-semibold">
                    {apartment.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700">
              {["최근 실거래가", "평형대", "여의도 접근성", "강남 접근성", "임장 메모"].map(
                (label) => (
                  <tr key={label} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-4 font-medium text-slate-950">{label}</td>
                    {apartments.map((apartment) => (
                      <td key={`${apartment.id}-${label}`} className="px-4 py-4">
                        {label === "평형대" ? apartment.areaSummary : "계산 예정"}
                      </td>
                    ))}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
