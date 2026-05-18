import { dataTasks } from "@/lib/mock-data";

export function DataTaskList() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-normal text-slate-950">
            데이터 연동 준비 상태
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            첫 커밋에서는 호출 없이 adapter 경계와 출처 정책만 둡니다.
          </p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-slate-200">
        {dataTasks.map((task) => (
          <div key={task.label} className="grid gap-2 py-3 md:grid-cols-[180px_160px_1fr]">
            <p className="font-medium text-slate-950">{task.label}</p>
            <p className="text-sm font-semibold text-emerald-800">{task.state}</p>
            <p className="text-sm leading-6 text-slate-600">{task.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
