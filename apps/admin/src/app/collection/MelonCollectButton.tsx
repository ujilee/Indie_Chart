"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { btn } from "@/components/ui";
import { collectMelonChart, type CollectState } from "../actions";

export default function MelonCollectButton() {
  const [state, action, pending] = useActionState<CollectState, FormData>(collectMelonChart, {});
  return (
    <ActionForm action={action} className="flex flex-wrap items-center gap-3">
      <button disabled={pending} className={btn.primary}>
        {pending ? "수집 중…" : "멜론 인디 차트 지금 수집"}
      </button>
      {state.message && <span className={`text-sm ${state.ok ? "text-muted" : "text-up"}`}>{state.message}</span>}
    </ActionForm>
  );
}
