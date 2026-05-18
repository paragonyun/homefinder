import type { ApartmentStatus } from "@/types/apartment";
import { statusLabels } from "@/lib/mock-data";

const statusClasses: Record<ApartmentStatus, string> = {
  candidate: "border-slate-300 bg-slate-50 text-slate-700",
  interested: "border-emerald-300 bg-emerald-50 text-emerald-800",
  visit_planned: "border-amber-300 bg-amber-50 text-amber-800",
  visited: "border-blue-300 bg-blue-50 text-blue-800",
  on_hold: "border-zinc-300 bg-zinc-50 text-zinc-700",
  excluded: "border-rose-300 bg-rose-50 text-rose-800",
};

export function StatusPill({ status }: Readonly<{ status: ApartmentStatus }>) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
