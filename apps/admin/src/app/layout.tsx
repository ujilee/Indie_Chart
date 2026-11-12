import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import AdminNav from "./AdminNav";
import { readDb } from "@indie/core/db";
import { getOpenFailures } from "@indie/core/data";
import { isDemoMode } from "@indie/core/data-mode";
import { DemoModeProvider } from "@indie/core/data-mode-context";
import { WEB_URL } from "@/lib/urls";
import { headers } from "next/headers";
import { adminAuthEnabled, getAdmin } from "@/lib/admin-auth";
import { adminLogout } from "./login/actions";

export const metadata: Metadata = { title: "관리자 — INDIE CHART", robots: { index: false, follow: false } };

/** 저장소 데이터를 매 요청마다 반영 */
export const dynamic = "force-dynamic";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0a0a" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const authOn = adminAuthEnabled();
  const admin = await getAdmin();
  // 로그인 화면(또는 관리자 세션이 없을 때)은 메뉴 없이 그 화면만 보여 준다
  if (pathname.startsWith("/login") || (authOn && !admin)) {
    return (
      <html lang="ko">
        <head>
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          />
        </head>
        <body className="antialiased">{children}</body>
      </html>
    );
  }
  const db = await readDb();
  const demo = isDemoMode();
  const badges = {
    "/reports": db.artistReports.filter((r) => r.status === "pending").length,
    "/concerts": db.concerts.filter((c) => c.status === "pending").length,
    "/collection": getOpenFailures(db).length + db.artists.filter((a) => a.status === "active" && !a.collected).length,
    "/cheers": db.cheerRecords.filter((r) => r.flag && r.valid).length,
  };

  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased">
        <DemoModeProvider demo={demo}>
          <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr] bg-surface">
            <aside className="bg-fg text-bg lg:sticky lg:top-0 lg:h-dvh flex flex-col">
              <div className="h-14 lg:h-16 px-5 flex items-center justify-between gap-3">
                <Link href="/" className="font-black tracking-tighter text-lg">
                  INDIE<span className="text-accent">.</span>CHART
                  <span className="ml-2 text-[11px] font-semibold tracking-wide text-white/50">ADMIN</span>
                </Link>
                <a href={WEB_URL} className="lg:hidden text-xs text-white/60 hover:text-white">
                  서비스 ↗
                </a>
              </div>
              <AdminNav badges={badges} />
              <div className="hidden lg:block mt-auto px-5 py-4 text-xs text-white/40 leading-relaxed">
                <a href={WEB_URL} className="block text-white/70 hover:text-white mb-2">
                  서비스 화면 보기 ↗
                </a>
                {admin ? (
                  <form action={adminLogout} className="flex items-center justify-between gap-2">
                    <span className="truncate text-white/70">{admin.nickname} · 관리자</span>
                    <button className="shrink-0 text-white/60 hover:text-white underline">로그아웃</button>
                  </form>
                ) : (
                  <>{demo ? "데모 모드 · 읽기 전용" : "로컬 개발"} · 관리자 인증 없음</>
                )}
              </div>
            </aside>
            <main className="min-w-0 px-4 sm:px-8 py-6 sm:py-8">
              {demo && (
                <p role="status" className="mb-5 rounded-xl border border-line bg-bg px-4 py-3 text-sm text-muted">
                  <b className="mr-1.5 text-accent">데모 모드 · 읽기 전용</b>
                  DB가 연결되지 않은 배포라 승인·반려·수정·수집 등 변경 기능은 비활성화돼 있어요. 화면은 샘플 데이터로 표시돼요.
                </p>
              )}
              {children}
            </main>
          </div>
        </DemoModeProvider>
      </body>
    </html>
  );
}
