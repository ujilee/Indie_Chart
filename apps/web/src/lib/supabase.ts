/**
 * 회원 로그인용 Supabase 클라이언트 (서버 전용).
 * 로그인 상태는 Supabase Auth가 발급한 토큰을 httpOnly 쿠키에 담아 유지한다.
 * 이 클라이언트로 쓰는 요청은 로그인한 회원 권한으로 실행되어 DB의 RLS 규칙을 그대로 따른다.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getDataMode } from "@indie/core/data-mode";

export const usesSupabaseAuth = () => getDataMode() === "supabase";

export function supabaseAuthEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL 또는 SUPABASE_PUBLISHABLE_KEY가 설정되지 않았어요.");
  return { url, key };
}

export async function userSupabase() {
  const { url, key } = supabaseAuthEnv();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // 서버 컴포넌트 렌더 중에는 쿠키를 쓸 수 없다. 토큰 갱신은 middleware가 맡는다
        }
      },
    },
  });
}

/** 켜 둔 소셜 로그인 제공자 (Supabase 대시보드 Authentication → Providers에서 켠 것만 적는다) */
export function socialProviders(): ("kakao" | "google")[] {
  return (process.env.SUPABASE_OAUTH_PROVIDERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is "kakao" | "google" => s === "kakao" || s === "google");
}
