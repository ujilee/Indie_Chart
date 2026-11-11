import type { Metadata } from "next";
import { Suspense } from "react";
import LoginPanel from "./LoginPanel";

export const metadata: Metadata = { title: "로그인 — INDIE CHART" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-14 sm:py-20">
      <Suspense>
        <LoginPanel />
      </Suspense>
    </div>
  );
}
