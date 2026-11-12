"use client";

import { useState, useTransition, type ReactNode } from "react";
import { oauthLogin } from "@/app/actions";

const KakaoIcon = (
  <svg viewBox="0 0 24 24" aria-hidden className="size-[18px]">
    <path
      fill="currentColor"
      d="M12 3.5C6.75 3.5 2.5 6.83 2.5 10.93c0 2.65 1.77 4.97 4.43 6.29-.15.53-.94 3.36-.97 3.58 0 0-.02.17.09.23.11.06.24.01.24.01.31-.04 3.62-2.37 4.19-2.77.48.07.98.1 1.49.1 5.25 0 9.5-3.33 9.5-7.44S17.25 3.5 12 3.5Z"
    />
  </svg>
);

const GoogleIcon = (
  <svg viewBox="0 0 24 24" aria-hidden className="size-[18px]">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84Z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
  </svg>
);

const PROVIDERS: Record<"kakao" | "google", { label: string; icon: ReactNode; className: string }> = {
  kakao: { label: "카카오로 계속하기", icon: KakaoIcon, className: "bg-[#FEE500] text-[#191919] hover:brightness-95" },
  google: { label: "Google로 계속하기", icon: GoogleIcon, className: "border border-line bg-bg text-fg hover:bg-surface" },
};
export type SocialProvider = keyof typeof PROVIDERS;

/**
 * 소셜 로그인 버튼 (카카오 · Google). 로그인·회원가입 화면에 항상 보인다.
 * enabled에 없는 제공자는 "준비 중"으로 비활성화한다.
 * 켜는 법: Supabase 대시보드 Authentication → Providers에서 제공자를 켜고, .env.local의 SUPABASE_OAUTH_PROVIDERS에 추가.
 */
export default function SocialLogin({ enabled, redirectTo }: { enabled: SocialProvider[]; redirectTo: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-8 space-y-2.5">
      {(Object.keys(PROVIDERS) as SocialProvider[]).map((p) => {
        const on = enabled.includes(p);
        return (
          <button
            key={p}
            type="button"
            disabled={!on || pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await oauthLogin(p, redirectTo);
                if (r?.error) setError(r.error);
              })
            }
            className={`relative flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${PROVIDERS[p].className}`}
          >
            <span className="absolute left-5">{PROVIDERS[p].icon}</span>
            {PROVIDERS[p].label}
            {!on && <span className="text-xs font-normal">(준비 중)</span>}
          </button>
        );
      })}
      {error && (
        <p role="alert" className="text-sm text-up">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3 pt-4 text-xs text-subtle">
        <span className="h-px flex-1 bg-line" />
        또는 이메일로
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
