import { redirect } from "next/navigation";
import { adminAuthEnabled, getAdmin } from "@/lib/admin-auth";
import { WEB_URL } from "@/lib/urls";
import LoginForm from "./LoginForm";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  if (!adminAuthEnabled() || (await getAdmin())) redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
  return (
    <div className="min-h-dvh grid place-items-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-bg p-7">
        <p className="font-black tracking-tighter text-xl">
          INDIE<span className="text-accent">.</span>CHART
          <span className="ml-2 text-xs font-semibold tracking-wide text-muted">ADMIN</span>
        </p>
        <p className="mt-2 mb-6 text-sm text-muted">관리자 계정으로 로그인해 주세요.</p>
        <LoginForm next={next} notice={error === "forbidden" ? "관리자 권한이 없는 계정이에요. 관리자 계정으로 다시 로그인해 주세요." : undefined} />
        <p className="mt-6 text-xs text-subtle leading-relaxed">
          계정은{" "}
          <a href={`${WEB_URL}/signup`} className="underline">
            사용자 서비스
          </a>
          에서 가입하고, 운영자가 관리자 권한을 부여해야 로그인할 수 있어요.
        </p>
      </div>
    </div>
  );
}
