"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "대시보드" },
  { href: "/artists", label: "아티스트 관리" },
  { href: "/reports", label: "아티스트 제보" },
  { href: "/concerts", label: "공연정보 관리" },
  { href: "/charts", label: "차트 관리" },
  { href: "/scores", label: "점수 관리" },
  { href: "/collection", label: "데이터 수집" },
  { href: "/metrics", label: "수치 입력" },
  { href: "/cheers", label: "응원 관리" },
  { href: "/top3", label: "월간 종합 TOP 3" },
  { href: "/cheer-top3", label: "월간 응원 TOP 3" },
];

export default function AdminNav({ badges }: { badges: Record<string, number> }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav className="flex lg:flex-col gap-1 overflow-x-auto px-3 pb-3 lg:pb-0 [scrollbar-width:none]">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`shrink-0 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${
            active(n.href) ? "bg-white text-fg font-bold" : "text-white/70 hover:text-white hover:bg-white/10"
          }`}
        >
          {n.label}
          {badges[n.href] ? (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-accent text-white text-[11px] font-bold grid place-items-center tabular-nums">
              {badges[n.href]}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
