"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { useActionState } from "react";
import { adminInput, btn } from "@/components/admin/ui";
import type { Artist } from "@/lib/types";
import { saveArtist, type ArtistFormState } from "../actions";

const FIELDS: { name: string; label: string; required?: boolean; placeholder?: string; mono?: boolean }[] = [
  { name: "name", label: "아티스트명", required: true },
  { name: "nameEn", label: "영문명" },
  { name: "genre", label: "장르", placeholder: "예) 드림팝" },
  { name: "image", label: "이미지 URL", placeholder: "비워 두면 Spotify에서 자동으로 가져와요" },
  { name: "spotify", label: "Spotify 아티스트 ID", required: true, placeholder: "ID 또는 URL", mono: true },
  { name: "melon", label: "멜론 아티스트 ID", placeholder: "ID 또는 URL", mono: true },
  { name: "youtube", label: "YouTube 채널", placeholder: "UC... 또는 @handle", mono: true },
  { name: "appleMusic", label: "Apple Music 아티스트 ID", placeholder: "ID 또는 URL", mono: true },
];

export default function ArtistForm({ artist }: { artist?: Artist }) {
  const [state, action, pending] = useActionState<ArtistFormState, FormData>(saveArtist.bind(null, artist?.id ?? null), {});
  const value = (name: string) => {
    if (!artist) return "";
    if (name in artist.platformIds) return artist.platformIds[name as keyof Artist["platformIds"]] ?? "";
    if (name === "spotify") return artist.platformIds.spotify;
    return String(artist[name as keyof Artist] ?? "");
  };

  return (
    <ActionForm action={action} className="p-5 grid sm:grid-cols-2 gap-x-4 gap-y-5">
      {FIELDS.map((f) => (
        <label key={f.name} className="block">
          <span className="text-sm font-semibold">
            {f.label}
            {f.required && <span className="text-accent ml-1">*</span>}
          </span>
          <input
            name={f.name}
            defaultValue={value(f.name)}
            placeholder={f.placeholder}
            className={`${adminInput} mt-1.5 w-full ${f.mono ? "font-mono text-xs" : ""}`}
            aria-invalid={!!state.errors?.[f.name]}
          />
          {state.errors?.[f.name] && <span className="mt-1 block text-xs text-up">{state.errors[f.name]}</span>}
        </label>
      ))}
      <div className="sm:col-span-2 flex items-center gap-3">
        <button disabled={pending} className={btn.primary}>
          {pending ? "저장 중…" : artist ? "변경사항 저장" : "등록"}
        </button>
        {state.saved && <span className="text-sm text-muted">저장되었어요.</span>}
        {!artist && <span className="text-xs text-subtle">등록 후 최초 데이터 수집이 완료되면 차트에 반영돼요.</span>}
      </div>
    </ActionForm>
  );
}
