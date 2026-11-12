import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, safeRedirect } from "@/lib/auth";
import AuthForm from "../signup/AuthForm";

export const metadata: Metadata = { title: "로그인 — INDIE CHART" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const target = safeRedirect((await searchParams).redirect);
  if (await getCurrentUser()) redirect(target);
  return (
    <div className="mx-auto max-w-sm px-4 py-14 sm:py-20">
      <AuthForm mode="login" redirectTo={target} />
    </div>
  );
}
