import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, readSessionToken } from "@indie/core/auth";
import { readDb } from "@indie/core/db";
import type { DB } from "@indie/core/seed";
import type { PublicUser } from "@indie/core/types";

/** 쿠키의 세션으로 현재 로그인한 회원을 찾는다. 없거나 만료됐으면 null */
export async function getCurrentUser(db: DB = readDb()): Promise<PublicUser | null> {
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
  (await cookies()).delete(SESSION_COOKIE);
}

/** 로그인 후 돌아갈 경로. 외부 주소와 로그인·가입 화면은 홈으로 */
export function safeRedirect(target: unknown) {
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//")) return "/";
  if (target.startsWith("/login") || target.startsWith("/signup")) return "/";
  return target;
}
