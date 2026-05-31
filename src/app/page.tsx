import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { AppShell } from "@/components/layout/app-shell";

export default function Home() {
  return (
    <AppShell>
      <DashboardClient />
    </AppShell>
  );
}
