import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { apartments } from "@/lib/mock-data";

export default async function FieldNoteMobilePage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const apartment = apartments.find((item) => item.id === id);

  if (!apartment) {
    notFound();
  }

  const checklist = [
    "역에서 단지까지 체감 거리",
    "언덕/보행 난이도",
    "주변 상권",
    "단지 관리 상태",
    "주차 체감",
    "소음",
    "밤 분위기",
    "초등학교 가는 길",
  ];

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-emerald-800">모바일 임장 메모</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
          {apartment.name}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          실제 저장은 후속 CRUD 단계에서 연결합니다.
        </p>

        <div className="mt-6 grid gap-3">
          {checklist.map((item) => (
            <label
              key={item}
              className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700"
            >
              {item}
              <input type="checkbox" disabled className="h-4 w-4" />
            </label>
          ))}
        </div>

        <div className="mt-6 grid gap-3">
          <textarea
            className="min-h-28 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-500"
            placeholder="장점, 단점, 한 줄 총평"
            disabled
          />
          <button
            type="button"
            disabled
            className="rounded-md bg-slate-300 px-4 py-3 text-sm font-semibold text-slate-600"
          >
            저장 기능은 다음 단계에서 연결
          </button>
        </div>
      </section>
    </AppShell>
  );
}
