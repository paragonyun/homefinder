export function SummaryStat({
  label,
  value,
  detail,
}: Readonly<{ label: string; value: string; detail: string }>) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}
