"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, SubmitDone, inputClass, primaryBtn, secondaryBtn } from "@/components/form";
import { submitArtistReport } from "@/app/actions";

type Values = { name: string; spotify: string; melon: string; youtube: string; apple: string };
const EMPTY: Values = { name: "", spotify: "", melon: "", youtube: "", apple: "" };

export default function ArtistReportForm() {
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setErrors((s) => ({ ...s, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    const r = await submitArtistReport(v);
    setPending(false);
    if (r.ok) setDone(true);
    else setErrors(r.errors);
  };

  if (done) {
    return (
      <SubmitDone
        title="제보가 접수되었어요"
        desc={
          <>
            관리자 검토 후 승인되면 차트 대상 아티스트로 등록돼요.
            <br />
            첫 데이터 수집이 끝난 뒤부터 순위에 반영됩니다.
          </>
        }
      >
        <button
          onClick={() => {
            setV(EMPTY);
            setDone(false);
          }}
          className={secondaryBtn}
        >
          다른 아티스트 제보
        </button>
        <Link href="/" className={`${primaryBtn} grid place-items-center`}>
          차트 보기
        </Link>
      </SubmitDone>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Field label="아티스트명" required error={errors.name}>
        <input value={v.name} onChange={set("name")} className={inputClass} placeholder="예) 새벽물결" aria-invalid={!!errors.name} />
      </Field>
      <Field
        label="Spotify 아티스트 ID"
        required
        hint="Spotify 앱에서 아티스트 > 공유 > 링크 복사 후 붙여넣기"
        error={errors.spotify}
      >
        <input
          value={v.spotify}
          onChange={set("spotify")}
          className={inputClass}
          placeholder="https://open.spotify.com/artist/..."
          aria-invalid={!!errors.spotify}
        />
      </Field>
      <div className="pt-2 border-t border-line" />
      <Field label="멜론 아티스트 ID" error={errors.melon}>
        <input value={v.melon} onChange={set("melon")} className={inputClass} placeholder="ID 또는 URL" aria-invalid={!!errors.melon} />
      </Field>
      <Field label="YouTube 채널 ID" error={errors.youtube}>
        <input value={v.youtube} onChange={set("youtube")} className={inputClass} placeholder="ID 또는 URL" aria-invalid={!!errors.youtube} />
      </Field>
      <Field label="Apple Music 아티스트 ID" error={errors.apple}>
        <input value={v.apple} onChange={set("apple")} className={inputClass} placeholder="ID 또는 URL" aria-invalid={!!errors.apple} />
      </Field>
      <button type="submit" disabled={pending} className={`${primaryBtn} w-full`}>
        {pending ? "접수 중…" : "제보하기"}
      </button>
    </form>
  );
}
