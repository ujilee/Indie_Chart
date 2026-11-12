"use server";

import { redirect } from "next/navigation";
import { adminSupabase } from "@/lib/admin-auth";

export type AdminLoginState = { email?: string; message?: string };

/** 관리자 앱 안의 경로만 허용 */
function safeNext(v: unknown) {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/login") ? v : "/";
}

export async function adminLogin(_: AdminLoginState, fd: FormData): Promise<AdminLoginState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { email, message: "이메일과 비밀번호를 입력해 주세요." };
  const sb = await adminSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") return { email, message: "메일함의 인증 링크를 먼저 눌러 주세요." };
    return { email, message: "이메일 또는 비밀번호가 올바르지 않아요." };
  }
  const { data: profile } = await sb.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "admin") {
    await sb.auth.signOut();
    return { email, message: "관리자 권한이 없는 계정이에요." };
  }
  redirect(safeNext(fd.get("next")));
}

export async function adminLogout() {
  await (await adminSupabase()).auth.signOut();
  redirect("/login");
}
