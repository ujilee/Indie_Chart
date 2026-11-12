import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, readSessionToken } from "@indie/core/auth";
import { readDb } from "@indie/core/db";
import type { DB } from "@indie/core/seed";
import type { PublicUser } from "@indie/core/types";
import { userSupabase, usesSupabaseAuth } from "./supabase";

/**
 * 현재 로그인한 회원. 없거나 만료됐으면 null
 * - 운영 DB 모드: Supabase Auth 토큰을 서버에서 검증한다
 * - 로컬 파일 모드: 서명한 세션 쿠키
 */
export async function getCurrentUser(dbIn?: DB): Promise<PublicUser | null> {
  if (usesSupabaseAuth()) {
    const sb = await userSupabase();
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    const { data: profile } = await sb.from("profiles").select("nickname").eq("id", data.user.id).maybeSingle();
    return { id: data.user.id, email: data.user.email ?? "", nickname: profile?.nickname ?? "" };
  }
  const db = dbIn ?? (await readDb());
  const id = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const user = id ? db.users.find((u) => u.id === id) : undefined;
  return user ? { id: user.id, email: user.email, nickname: user.nickname } : null;
}

export async function startSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  if (usesSupabaseAuth()) {
    await (await userSupabase()).auth.signOut();
    return;
  }
  (await cookies()).delete(SESSION_COOKIE);
}

/** 로그인 후 돌아갈 경로. 외부 주소와 로그인·가입 화면은 홈으로 */
export function safeRedirect(target: unknown) {
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//")) return "/";
  if (target.startsWith("/login") || target.startsWith("/signup")) return "/";
  return target;
}
