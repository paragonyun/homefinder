"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "대시보드" },
  { href: "/neighborhoods", label: "관심 동네" },
  { href: "/apartments", label: "관심 단지" },
  { href: "/compare", label: "비교" },
  { href: "/settings", label: "설정" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 화면"
      className="flex max-w-full min-w-0 flex-wrap gap-1 rounded-2xl border border-slate-200 bg-slate-100/80 p-1 text-sm font-medium text-slate-600 shadow-inner sm:flex-nowrap sm:overflow-x-auto sm:rounded-full"
    >
      {navigation.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 transition ${
              isActive
                ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                : "hover:bg-white/80 hover:text-slate-950"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
