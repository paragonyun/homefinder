import { FieldNotesClient } from "@/components/field-notes/field-notes-client";
import { AppShell } from "@/components/layout/app-shell";
import { apartments } from "@/lib/mock-data";

export default async function FieldNoteMobilePage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const mockApartment = apartments.find((item) => item.id === id);

  return (
    <AppShell>
      <FieldNotesClient
        apartmentId={id}
        apartmentName={mockApartment?.name ?? "등록 단지"}
        isMockApartment={Boolean(mockApartment)}
      />
    </AppShell>
  );
}
