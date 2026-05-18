import { notFound } from "next/navigation";
import { ApartmentRow } from "@/components/apartments/apartment-row";
import { AppShell } from "@/components/layout/app-shell";
import { neighborhoods, apartments } from "@/lib/mock-data";

export default async function NeighborhoodDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const neighborhood = neighborhoods.find((item) => item.id === id);

  if (!neighborhood) {
    notFound();
  }

  const relatedApartments = apartments.filter(
    (apartment) => apartment.neighborhood === neighborhood.name,
  );

  return (
    <AppShell>
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-5">
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
            {neighborhood.name}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {neighborhood.description}
          </p>
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
              {relatedApartments.map((apartment) => (
                <ApartmentRow key={apartment.id} {...apartment} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
