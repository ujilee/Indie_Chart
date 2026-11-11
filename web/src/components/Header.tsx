"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session";

const NAV = [
  { href: "/", label: "차트" },
  { href: "/cheer", label: "응원" },
  { href: "/report/artist", label: "제보" },
  { href: "/guide", label: "가이드" },
];

export default function Header() {
  const pathname = usePathname();
  const { user, logout, ready } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.split("/").slice(0, 2).join("/")));

  return (
    <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-6">
        <Link href="/" className="font-black text-lg sm:text-xl tracking-tighter shrink-0">
          INDIE<span className="text-accent">.</span>CHART
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-[15px]">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={isActive(n.href) ? "font-bold text-fg" : "text-muted hover:text-fg"}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto" ref={menuRef}>
          {!ready || pathname === "/login" ? (
            <div className="h-9 w-9" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label="프로필 메뉴"
                className="h-9 w-9 rounded-full bg-fg text-bg grid place-items-center text-sm font-bold"
              >
                {user.name.slice(0, 1)}
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-line bg-bg shadow-lg py-2 text-sm">
                  <div className="px-4 py-2 text-muted">{user.name}</div>
                  <button
                    onClick={() => {
                      logout();
                      setOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-surface"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={`/login?redirect=${encodeURIComponent(pathname)}`}
              className="h-9 px-4 rounded-full border border-fg text-sm font-semibold grid place-items-center hover:bg-fg hover:text-bg transition-colors"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
      {/* 모바일 내비게이션 */}
      <nav className="sm:hidden flex border-t border-line text-sm">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex-1 text-center py-2.5 ${isActive(n.href) ? "font-bold text-fg border-b-2 border-fg" : "text-muted"}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
