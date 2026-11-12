"use client";

import { useActionState } from "react";
import { adminInput, btn } from "@/components/ui";
import { adminLogin, type AdminLoginState } from "./actions";

export default function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState<AdminLoginState, FormData>(adminLogin, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm">
        <span className="mb-1.5 block font-semibold">이메일</span>
        <input name="email" type="email" required autoComplete="username" defaultValue={state.email} className={`${adminInput} w-full`} />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block font-semibold">비밀번호</span>
        <input name="password" type="password" required autoComplete="current-password" className={`${adminInput} w-full`} />
      </label>
      {(state.message ?? notice) && (
        <p role="alert" className="text-sm text-up">
          {state.message ?? notice}
        </p>
      )}
      <button disabled={pending} className={`${btn.primary} w-full justify-center`}>
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
