import { AppShell } from "@/components/layout/app-shell";
import { CompareClient } from "@/components/compare/compare-client";

export default function ComparePage() {
  return (
    <AppShell>
      <div className="grid gap-5">
        <section>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
            단지 비교
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            여러 단지를 선택해 최근 실거래가, 평형대, 전세가율, 세대수, 주차,
            접근성, 임장 점수, 내 관심 상태를 비교하는 화면입니다.
          </p>
        </section>

        <CompareClient />
      </div>
    </AppShell>
  );
}
