/**
 * 관리자 인증 (서버 전용). 운영 DB(supabase) 모드에서만 켠다.
 * - 로그인: Supabase Auth (사용자 서비스와 같은 계정)
 * - 권한: profiles.role = 'admin' 인 계정만
 * - 관리자 변경은 그 관리자의 토큰으로 DB에 쓴다 → RLS 검사 + 변경 이력에 관리자 계정 기록
 * 로컬 파일·데모 모드는 개발용이라 인증을 요구하지 않는다.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDataMode } from "@indie/core/data-mode";
import { setWriteClientProvider } from "@indie/core/supabase-store";

export const adminAuthEnabled = () => getDataMode() === "supabase";

export async function adminSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL 또는 SUPABASE_PUBLISHABLE_KEY가 설정되지 않았어요.");
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

export type AdminUser = { id: string; email: string; nickname: string };

/** 로그인한 관리자. 로그인하지 않았거나 관리자가 아니면 null (요청마다 1번만 확인) */
export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  if (!adminAuthEnabled()) return null;
  const sb = await adminSupabase();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await sb.from("profiles").select("nickname, role").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "admin") return null;
  return { id: data.user.id, email: data.user.email ?? "", nickname: profile.nickname };
});

export class AdminAuthError extends Error {
  constructor() {
    super("관리자 로그인이 필요해요. 다시 로그인해 주세요.");
    this.name = "AdminAuthError";
  }
}

/** 서버 액션 첫 줄에서 호출. 운영 DB 모드에서 관리자가 아니면 막는다 */
export async function requireAdmin() {
  if (!adminAuthEnabled()) return;
  if (!(await getAdmin())) throw new AdminAuthError();
}

// 관리자 변경은 관리자 본인 토큰으로 저장 (관리자 세션이 없으면 서버 키: 예약 수집 등)
setWriteClientProvider(async () => {
  if (!adminAuthEnabled()) return null;
  return (await getAdmin()) ? adminSupabase() : null;
});
