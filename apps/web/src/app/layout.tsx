import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { ToastProvider } from "@/components/Toast";
import { isDemoMode } from "@indie/core/data-mode";
import { DemoModeProvider } from "@indie/core/data-mode-context";
import { serviceToday } from "@indie/core/constants";
import { readDb } from "@indie/core/db";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "INDIE CHART — 인디 아티스트 차트",
  description: "음악 플랫폼 활동, 팬 관심도, 공연과 응원을 종합한 국내 인디 아티스트 차트",
};

/** 저장소 데이터를 매 요청마다 반영 */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const db = readDb();
  const user = await getCurrentUser(db);
  // 오늘 이미 응원했는지 (1인 하루 1회)
  const todayCheer = user ? (db.cheerRecords.find((r) => r.userId === user.id && r.date === serviceToday())?.artistId ?? null) : null;

  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased min-h-dvh flex flex-col">
        <DemoModeProvider demo={isDemoMode()}>
          <SessionProvider user={user} todayCheer={todayCheer}>
            <ToastProvider>{children}</ToastProvider>
          </SessionProvider>
        </DemoModeProvider>
      </body>
    </html>
  );
}
