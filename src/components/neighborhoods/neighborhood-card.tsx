import { formatDate } from "@/utils/date";

type NeighborhoodCardProps = {
  name: string;
  description: string;
  apartments: number;
  interested: number;
  onHold: number;
  excluded: number;
  avgPriceRange: string;
  yeouidoSummary: string;
  gangnamSummary: string;
  updatedAt: string;
};

export function NeighborhoodCard(props: Readonly<NeighborhoodCardProps>) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal text-slate-950">
            {props.name}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {props.description}
          </p>
        </div>
        <span className="w-fit rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {formatDate(props.updatedAt)} 갱신
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div>
          <dt className="text-slate-500">관심 단지</dt>
          <dd className="mt-1 font-semibold text-slate-950">{props.apartments}개</dd>
        </div>
        <div>
          <dt className="text-slate-500">관심/보류/제외</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {props.interested}/{props.onHold}/{props.excluded}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">평균 가격대</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {props.avgPriceRange}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">접근성</dt>
          <dd className="mt-1 font-semibold text-slate-950">검증 예정</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-900">
          여의도: {props.yeouidoSummary}
        </p>
        <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
          강남: {props.gangnamSummary}
        </p>
      </div>
    </article>
  );
}
