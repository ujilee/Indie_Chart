"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { useActionState, useEffect, useRef } from "react";
import { adminInput, btn } from "@/components/admin/ui";
import { createConcert, type ConcertFormState } from "../actions";

export default function ConcertCreateForm({ artists, today }: { artists: { id: string; name: string }[]; today: string }) {
  const [state, action, pending] = useActionState<ConcertFormState, FormData>(createConcert, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const err = (k: string) => state.errors?.[k] && <span className="mt-1 block text-xs text-up">{state.errors[k]}</span>;

  return (
    <ActionForm ref={ref} action={action} className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <label className="text-sm">
        아티스트 *
        <select name="artistId" defaultValue="" className={`${adminInput} mt-1 w-full`}>
          <option value="">선택</option>
          {artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {err("artistId")}
      </label>
      <label className="text-sm lg:col-span-2">
        공연명 *
        <input name="title" className={`${adminInput} mt-1 w-full`} />
        {err("title")}
      </label>
      <label className="text-sm">
        공연 날짜 *
        <input type="date" name="date" min={today} className={`${adminInput} mt-1 w-full`} />
        {err("date")}
      </label>
      <label className="text-sm">
        공연 시간
        <input type="time" name="time" className={`${adminInput} mt-1 w-full`} />
      </label>
      <label className="text-sm">
        공연장 *
        <input name="venue" className={`${adminInput} mt-1 w-full`} />
        {err("venue")}
      </label>
      <label className="text-sm sm:col-span-2">
        공식 공연정보 / 예매 URL *
        <input name="url" placeholder="https://" className={`${adminInput} mt-1 w-full`} />
        {err("url")}
      </label>
      <div className="flex items-end gap-3">
        <button disabled={pending} className={btn.primary}>
          {pending ? "등록 중…" : "승인 상태로 등록"}
        </button>
        {state.ok && <span className="text-sm text-muted">등록되었어요.</span>}
      </div>
    </ActionForm>
  );
}
