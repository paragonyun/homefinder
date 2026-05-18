import Link from "next/link";

const navigation = [
  { href: "/", label: "대시보드" },
  { href: "/neighborhoods", label: "관심 동네" },
  { href: "/apartments", label: "관심 단지" },
  { href: "/compare", label: "비교" },
  { href: "/settings", label: "설정" },
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[#f7f8f4] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-8">
          <Link href="/" className="w-fit">
            <p className="text-xs font-semibold uppercase text-emerald-700">
              HomeScope
            </p>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
              관심 아파트 리서치 보드
            </h1>
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm font-medium text-slate-700">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 transition hover:border-emerald-400 hover:text-emerald-800"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6 md:px-8">{children}</main>
    </div>
  );
}
