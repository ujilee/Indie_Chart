import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeRedirect } from "@/lib/auth";
import { userSupabase } from "@/lib/supabase";

/** 가입 인증 메일의 링크가 돌아오는 곳. 인증을 마치고 로그인 상태로 원래 화면에 보낸다 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const next = safeRedirect(q.get("next"));
  const sb = await userSupabase();
  const code = q.get("code");
  const tokenHash = q.get("token_hash");
  const type = q.get("type") as EmailOtpType | null;
  const { error } = code
    ? await sb.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await sb.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };
  const failed = q.get("error") ? "/login?oauth=failed" : "/login?verify=failed";
  const to = new URL(error ? failed : next, req.nextUrl.origin);
  return NextResponse.redirect(to);
}
