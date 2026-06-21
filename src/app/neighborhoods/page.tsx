import { AppShell } from "@/components/layout/app-shell";
import { NeighborhoodsClient } from "@/components/neighborhoods/neighborhoods-client";

export default function NeighborhoodsPage() {
  return (
    <AppShell>
      <div className="grid gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
            관심 동네
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            후보 단지를 권역별로 묶어 접근성, 가격대, 임장 우선순위를 함께
            관리합니다.
          </p>
        </div>
        <NeighborhoodsClient />
      </div>
    </AppShell>
  );
}
