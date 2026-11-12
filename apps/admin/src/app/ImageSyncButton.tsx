"use client";

import { useState, useTransition } from "react";
import { btn } from "@/components/ui";
import { useDemoMode } from "@indie/core/data-mode-context";
import { refreshAllArtistImages, refreshArtistImage, type ImageSyncResult } from "./actions";

function describe(r: ImageSyncResult, single: boolean) {
  if (r.readOnly) return "데모 모드에서는 이미지를 갱신할 수 없어요.";
  if (single) {
    if (r.updated) return "Spotify 이미지를 가져왔어요.";
    if (r.notFound) return "Spotify에서 이미지를 찾지 못했어요. Spotify ID를 확인하세요.";
    return "Spotify에 연결하지 못했어요. 잠시 후 다시 시도하세요.";
  }
  const parts = [`${r.updated}팀 갱신`];
  if (r.notFound) parts.push(`${r.notFound}팀 찾을 수 없음`);
  if (r.failed) parts.push(`${r.failed}팀 연결 실패`);
  if (r.skipped) parts.push(`직접 입력 ${r.skipped}팀 제외`);
  return parts.join(" · ");
}

export default function ImageSyncButton({ artistId, label }: { artistId?: string; label?: string }) {
  const [pending, start] = useTransition();
  const demo = useDemoMode();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const run = () =>
    start(async () => {
      const r = artistId ? await refreshArtistImage(artistId) : await refreshAllArtistImages();
      setMessage({ text: describe(r, !!artistId), ok: r.updated > 0 });
    });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} disabled={pending || demo} title={demo ? "데모 모드에서는 변경할 수 없어요" : undefined} className={btn.outline}>
        {pending ? "가져오는 중…" : (label ?? "Spotify 이미지 가져오기")}
      </button>
      {message && <span className={`text-xs ${message.ok ? "text-muted" : "text-up"}`}>{message.text}</span>}
    </div>
  );
}
