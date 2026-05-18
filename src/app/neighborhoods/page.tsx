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
            MVP 1단계에서는 동네 CRUD와 연결 단지 목록을 구현합니다. 현재는
            기획안의 카드 구조를 확인하기 위한 placeholder입니다.
          </p>
        </div>
        <NeighborhoodsClient />
      </div>
    </AppShell>
  );
}
