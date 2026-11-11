import type { Metadata } from "next";
import Link from "next/link";
import AdminNav from "./AdminNav";
import { readDb } from "@/lib/db";
import { getOpenFailures } from "@/lib/data";
import { isDemoMode } from "@/lib/data-mode";

export const metadata: Metadata = { title: "관리자 — INDIE CHART" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const db = readDb();
  const demo = isDemoMode();
  const badges = {
    "/admin/reports": db.artistReports.filter((r) => r.status === "pending").length,
    "/admin/concerts": db.concerts.filter((c) => c.status === "pending").length,
    "/admin/collection": getOpenFailures(db).length + db.artists.filter((a) => a.status === "active" && !a.collected).length,
    "/admin/cheers": db.cheerRecords.filter((r) => r.flag && r.valid).length,
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr] bg-surface">
      <aside className="bg-fg text-bg lg:sticky lg:top-0 lg:h-dvh flex flex-col">
        <div className="h-14 lg:h-16 px-5 flex items-center justify-between gap-3">
          <Link href="/admin" className="font-black tracking-tighter text-lg">
            INDIE<span className="text-accent">.</span>CHART
            <span className="ml-2 text-[11px] font-semibold tracking-wide text-white/50">ADMIN</span>
          </Link>
          <Link href="/" className="lg:hidden text-xs text-white/60 hover:text-white">
            서비스 ↗
          </Link>
        </div>
        <AdminNav badges={badges} />
        <div className="hidden lg:block mt-auto px-5 py-4 text-xs text-white/40 leading-relaxed">
          <Link href="/" className="block text-white/70 hover:text-white mb-2">
            서비스 화면 보기 ↗
          </Link>
          {demo ? "데모 모드 · 읽기 전용" : "개발용"} · 관리자 인증 미적용
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
  );
}
