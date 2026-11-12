import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, safeRedirect } from "@/lib/auth";
import { socialProviders, usesSupabaseAuth } from "@/lib/supabase";
import AuthForm from "../signup/AuthForm";

export const metadata: Metadata = { title: "로그인 — INDIE CHART" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string; verify?: string; oauth?: string }> }) {
  const q = await searchParams;
  const target = safeRedirect(q.redirect);
  if (await getCurrentUser()) redirect(target);
  return (
    <div className="mx-auto max-w-sm px-4 py-14 sm:py-20">
      <AuthForm
        mode="login"
        redirectTo={target}
        social={usesSupabaseAuth() ? socialProviders() : []}
        notice={q.verify === "failed" ? "인증 링크가 만료됐거나 올바르지 않아요. 다시 시도해 주세요." : q.oauth === "failed" ? "소셜 로그인을 마치지 못했어요. 다시 시도해 주세요." : undefined}
      />
    </div>
  );
}
