"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useDemoMode } from "@indie/core/data-mode-context";
import { DemoNotice, Field, inputClass, primaryBtn } from "@/components/form";
import { login, signup, type AuthFormState } from "@/app/actions";

/** 이메일 로그인 · 회원가입 폼 */
export default function AuthForm({ mode, redirectTo }: { mode: "login" | "signup"; redirectTo: string }) {
  const isSignup = mode === "signup";
  const [state, action, pending] = useActionState<AuthFormState, FormData>(isSignup ? signup : login, {});
  const demo = useDemoMode();
  const err = state.errors ?? {};
  const switchHref = `${isSignup ? "/login" : "/signup"}${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`;

  return (
    <div>
      <div className="text-center">
        <div className="font-black text-3xl tracking-tighter">
          INDIE<span className="text-accent">.</span>CHART
        </div>
        <p className="mt-4 text-lg font-bold">{isSignup ? "회원가입하고 아티스트를 응원해 주세요" : "로그인하고 아티스트를 응원해 주세요"}</p>
        <p className="mt-1 text-sm text-muted">하루 한 번의 응원이 아티스트의 순위에 반영돼요.</p>
      </div>

      <form action={action} noValidate className="mt-10 space-y-5">
        <input type="hidden" name="redirect" value={redirectTo} />
        <Field label="이메일" required error={err.email}>
          <input
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.email}
            placeholder="you@example.com"
            className={inputClass}
            aria-invalid={!!err.email}
          />
        </Field>
        {isSignup && (
          <Field label="닉네임" required hint="2~12자, 한글·영문·숫자·밑줄(_)" error={err.nickname}>
            <input
              name="nickname"
              autoComplete="nickname"
              defaultValue={state.nickname}
              className={inputClass}
              aria-invalid={!!err.nickname}
            />
          </Field>
        )}
        <Field label="비밀번호" required hint={isSignup ? "8~64자, 영문과 숫자 포함" : undefined} error={err.password}>
          <input
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            className={inputClass}
            aria-invalid={!!err.password}
          />
        </Field>
        {isSignup && (
          <Field label="비밀번호 확인" required error={err.passwordConfirm}>
            <input name="passwordConfirm" type="password" autoComplete="new-password" className={inputClass} aria-invalid={!!err.passwordConfirm} />
          </Field>
        )}
        {isSignup && (
          <div>
            <label className={`flex items-start gap-3 text-sm ${err.agree ? "text-up" : "text-muted"}`}>
              <input type="checkbox" name="agree" className="mt-0.5 size-4 accent-black" />
              <span>
                <span className="underline underline-offset-2">이용약관</span> 및{" "}
                <span className="underline underline-offset-2">개인정보처리방침</span>에 동의합니다. (필수)
              </span>
            </label>
            {err.agree && <p className="mt-1.5 text-xs text-up">{err.agree}</p>}
          </div>
        )}

        {demo ? (
          <DemoNotice>
            {isSignup ? "회원 정보가 저장되지 않아 가입할 수 없어요." : "회원 정보가 없어 로그인할 수 없어요."}
          </DemoNotice>
        ) : (
          state.message && <p role="alert" className="text-sm text-up">{state.message}</p>
        )}
        <button type="submit" disabled={pending || demo} className={`${primaryBtn} w-full`}>
          {pending ? (isSignup ? "가입 중…" : "로그인 중…") : isSignup ? "가입하기" : "로그인"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        {isSignup ? "이미 회원이신가요?" : "아직 회원이 아니신가요?"}{" "}
        <Link href={switchHref} className="font-semibold text-fg underline underline-offset-2">
          {isSignup ? "로그인" : "회원가입"}
        </Link>
      </p>
      <p className="mt-6 text-center text-xs text-subtle">차트 조회와 제보는 로그인 없이 이용할 수 있어요.</p>
    </div>
  );
}
