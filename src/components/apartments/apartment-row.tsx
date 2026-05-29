import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import type { ApartmentStatus } from "@/types/apartment";

type ApartmentRowProps = {
  id: string;
  name: string;
  neighborhood: string;
  status: ApartmentStatus;
  address: string;
  latestPrice: string;
  areaSummary: string;
  accessSummary?: string;
  sourceState: string;
  note: string;
  children?: ReactNode;
};

export function ApartmentRow(props: Readonly<ApartmentRowProps>) {
  return (
    <tr className="border-b border-slate-200 align-top last:border-0">
      <td className="px-4 py-4">
        <Link
          href={`/apartments/${props.id}`}
          className="font-semibold text-slate-950 hover:text-emerald-800"
        >
          {props.name}
        </Link>
        <p className="mt-1 text-sm text-slate-500">{props.address}</p>
      </td>
      <td className="px-4 py-4 text-sm text-slate-700">{props.neighborhood}</td>
      <td className="px-4 py-4">
        <StatusPill status={props.status} />
      </td>
      <td className="px-4 py-4 text-sm text-slate-700">{props.latestPrice}</td>
      <td className="px-4 py-4 text-sm text-slate-700">{props.areaSummary}</td>
      <td className="px-4 py-4 text-sm leading-6 text-slate-700">
        {props.accessSummary ?? "접근성 미입력"}
      </td>
      <td className="px-4 py-4 text-sm text-slate-700">{props.sourceState}</td>
      <td className="px-4 py-4 text-sm leading-6 text-slate-700">{props.note}</td>
      {props.children ? (
        <td className="px-4 py-4 text-sm text-slate-700">{props.children}</td>
      ) : null}
    </tr>
  );
}
