"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSession, type Provider } from "@/lib/session";

export default function LoginPanel() {
  const { login } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [agreed, setAgreed] = useState(false);
  const [warn, setWarn] = useState(false);

  const redirect = params.get("redirect");
  const target = redirect && redirect.startsWith("/") && !redirect.startsWith("//") && redirect !== "/login" ? redirect : "/";

  const go = (provider: Provider) => {
    if (!agreed) {
      setWarn(true);
      return;
    }
    // TODO: 실제 OAuth 연동
    login(provider);
    router.replace(target);
  };

  return (
    <div className="text-center">
      <div className="font-black text-3xl tracking-tighter">
        INDIE<span className="text-accent">.</span>CHART
      </div>
      <p className="mt-4 text-lg font-bold">로그인하고 아티스트를 응원해 주세요</p>
      <p className="mt-1 text-sm text-muted">하루 한 번의 응원이 아티스트의 순위에 반영돼요.</p>

      <div className="mt-10 space-y-3">
        <button
          onClick={() => go("kakao")}
          className="w-full h-12 rounded-xl bg-[#FEE500] text-[#191919] font-semibold flex items-center justify-center gap-2"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path fill="currentColor" d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.88 5.32 4.7 6.73l-.96 3.5c-.08.3.26.54.52.36L10.4 19c.52.07 1.05.1 1.6.1 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
          </svg>
          카카오로 계속하기
        </button>
        <button
          onClick={() => go("google")}
          className="w-full h-12 rounded-xl border border-line font-semibold flex items-center justify-center gap-2 hover:border-fg"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
          </svg>
          Google로 계속하기
        </button>
        <button
          onClick={() => go("apple")}
          className="w-full h-12 rounded-xl bg-fg text-bg font-semibold flex items-center justify-center gap-2"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path fill="currentColor" d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.38-3.69zM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.28z" />
          </svg>
          Apple로 계속하기
        </button>
      </div>

      <label className={`mt-8 flex items-start gap-3 text-left text-sm ${warn && !agreed ? "text-up" : "text-muted"}`}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => {
            setAgreed(e.target.checked);
            setWarn(false);
          }}
          className="mt-0.5 size-4 accent-black"
        />
        <span>
          <span className="underline underline-offset-2">이용약관</span> 및{" "}
          <span className="underline underline-offset-2">개인정보처리방침</span>에 동의합니다. (필수)
        </span>
      </label>
      {warn && !agreed && <p className="mt-2 text-left text-xs text-up">약관에 동의해야 로그인할 수 있어요.</p>}

      <p className="mt-10 text-xs text-subtle">차트 조회와 제보는 로그인 없이 이용할 수 있어요.</p>
    </div>
  );
}
