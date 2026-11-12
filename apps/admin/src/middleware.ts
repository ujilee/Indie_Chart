import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** 로그인 없이 열리는 경로: 로그인 화면, 예약 수집(CRON_SECRET으로 따로 확인) */
const PUBLIC = [/^\/login(\/|$)/, /^\/api\/cron\//];

/**
 * 관리자 앱 접근 제어 (운영 DB 모드에서만).
 * 로그인 토큰을 갱신하고, 관리자 계정이 아니면 로그인 화면으로 보낸다.
 * 서버 액션도 requireAdmin()으로 한 번 더 확인한다.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const headers = new Headers(request.headers);
  headers.set("x-pathname", path);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const mode = process.env.INDIECHART_DATA_MODE;
  const supabaseMode = mode ? mode === "supabase" : Boolean(url && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseMode) return NextResponse.next({ request: { headers } });
  if (!url || !key) return new NextResponse("SUPABASE_PUBLISHABLE_KEY가 설정되지 않았어요.", { status: 500 });

  let response = NextResponse.next({ request: { headers } });
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers } });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await sb.auth.getUser();
  if (PUBLIC.some((re) => re.test(path))) return response;

  const toLogin = (reason?: string) => {
    const to = new URL("/login", request.url);
    if (path !== "/") to.searchParams.set("next", path + request.nextUrl.search);
    if (reason) to.searchParams.set("error", reason);
    const res = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };
  if (!data.user) return toLogin();
  const { data: profile } = await sb.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "admin") return toLogin("forbidden");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
