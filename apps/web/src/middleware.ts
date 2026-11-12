import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase Auth 로그인 토큰 갱신 (운영 DB 모드에서만).
 * 만료가 가까운 토큰을 새로 받아 쿠키에 다시 쓴다.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const mode = process.env.INDIECHART_DATA_MODE;
  const supabaseMode = mode ? mode === "supabase" : Boolean(url && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseMode || !url || !key) return NextResponse.next({ request });

  // 인증 링크가 허용 주소 목록에 없어 기본 주소(/?code=…)로 돌아온 경우에도 로그인을 마치도록 넘긴다
  const code = request.nextUrl.searchParams.get("code");
  if (code && request.nextUrl.pathname !== "/auth/callback") {
    const to = new URL("/auth/callback", request.url);
    to.searchParams.set("code", code);
    to.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(to);
  }

  let response = NextResponse.next({ request });
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await sb.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
