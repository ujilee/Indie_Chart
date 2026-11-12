"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { btn } from "@/components/ui";
import { collectArtistMetrics, collectMelonChart, type CollectState } from "../actions";

const KINDS = {
  chart: { action: collectMelonChart, label: "멜론 인디 차트 지금 수집" },
  metrics: { action: collectArtistMetrics, label: "아티스트 수치 지금 수집" },
};

export default function MelonCollectButton({ kind = "chart" }: { kind?: keyof typeof KINDS }) {
  const { action: serverAction, label } = KINDS[kind];
  const [state, action, pending] = useActionState<CollectState, FormData>(serverAction, {});
  return (
    <ActionForm action={action} className="flex flex-wrap items-center gap-3">
      <button disabled={pending} className={btn.primary}>
        {pending ? "수집 중… (몇 분 걸릴 수 있어요)" : label}
      </button>
      {state.message && <span className={`text-sm ${state.ok ? "text-muted" : "text-up"}`}>{state.message}</span>}
    </ActionForm>
  );
}
