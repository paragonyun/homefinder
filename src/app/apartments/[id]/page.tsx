import { ApartmentDetailClient } from "@/components/apartments/apartment-detail-client";
import { AppShell } from "@/components/layout/app-shell";

export default async function ApartmentDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;

  return (
    <AppShell>
      <ApartmentDetailClient apartmentId={id} />
    </AppShell>
  );
}
