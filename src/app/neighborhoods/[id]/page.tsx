import { AppShell } from "@/components/layout/app-shell";
import { NeighborhoodDetailClient } from "@/components/neighborhoods/neighborhood-detail-client";

export default async function NeighborhoodDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;

  return (
    <AppShell>
      <NeighborhoodDetailClient neighborhoodId={id} />
    </AppShell>
  );
}
