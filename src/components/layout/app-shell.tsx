import Link from "next/link";
import { AppNav } from "./app-nav";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
          <Link href="/" className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
              HomeScope
            </p>
            <h1 className="mt-0.5 truncate text-xl font-semibold tracking-normal text-slate-950">
              관심 아파트 리서치 보드
            </h1>
          </Link>
          <AppNav />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5 md:px-6">{children}</main>
    </div>
  );
}
