"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { useActionState } from "react";
import { adminInput, btn } from "@/components/admin/ui";
import type { FullScoreBasis, Period } from "@/lib/types";
import { updateBasis, type BasisFormState } from "../actions";

export default function BasisForm({ period, basis }: { period: Period; basis: FullScoreBasis }) {
  const [state, action, pending] = useActionState<BasisFormState, FormData>(updateBasis.bind(null, period), {});
  return (
    <ActionForm action={action} key={`${period}-${basis.likes}-${basis.fans}-${basis.followers}`} className="p-5 space-y-3">
      {(
        [
          ["likes", "멜론 좋아요 증가량"],
          ["fans", "멜론 팬 증가량"],
          ["followers", "Spotify 팔로워 증가량"],
        ] as const
      ).map(([k, label]) => (
        <label key={k} className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">{label}</span>
          <input type="number" name={k} min={1} step={1} defaultValue={basis[k]} className={`${adminInput} w-28 text-right tabular-nums`} />
        </label>
      ))}
      <input name="note" placeholder="변경 사유 (선택)" className={`${adminInput} w-full`} />
      <div className="flex items-center gap-3">
        <button disabled={pending} className={btn.primary}>
          {pending ? "저장 중…" : "기준 변경"}
        </button>
        {state.saved && <span className="text-sm text-muted">저장되었어요.</span>}
        {state.error && <span className="text-sm text-up">{state.error}</span>}
      </div>
    </ActionForm>
  );
}
