import Link from "next/link";
import { AppNav } from "./app-nav";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-[#f6f8fb] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] min-w-0 flex-col gap-3 px-3 py-3 md:flex-row md:items-center md:justify-between md:px-6">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-800">
              HS
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                HomeScope
              </span>
              <span className="mt-0.5 block truncate text-lg font-semibold tracking-normal text-slate-950 group-hover:text-emerald-800">
                아파트 투자 리서치
              </span>
            </span>
          </Link>
          <div className="min-w-0 max-w-full">
            <AppNav />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] min-w-0 px-3 py-4 md:px-6 md:py-6">
        {children}
      </main>
    </div>
  );
}
