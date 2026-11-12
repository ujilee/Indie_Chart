"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemoMode } from "@indie/core/data-mode-context";
import { DemoNotice, Field, SubmitDone, inputClass, primaryBtn, secondaryBtn } from "@/components/form";
import { submitConcertReport } from "@/app/actions";

type Values = {
  artistId: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  url: string;
  description: string;
  poster: string;
};

export default function ConcertReportForm({
  artists,
  defaultArtistId,
  today,
}: {
  artists: { id: string; name: string }[];
  defaultArtistId: string;
  today: string;
}) {
  const empty: Values = { artistId: defaultArtistId, title: "", date: "", time: "", venue: "", address: "", url: "", description: "", poster: "" };
  const [v, setV] = useState<Values>(empty);
  const [poster, setPoster] = useState<{ name: string; data: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const demo = useDemoMode();

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setErrors((s) => ({ ...s, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    const r = await submitConcertReport({ ...v, poster: poster?.data ?? "" });
    setPending(false);
    if (r.ok) setDone(true);
    else {
      setErrors(r.errors);
      setMessage(r.message);
    }
  };

  const onPoster = (file: File | undefined) => {
    setErrors((s) => ({ ...s, poster: undefined }));
    if (!file) return setPoster(null);
    if (file.size > 1024 * 1024) {
      setErrors((s) => ({ ...s, poster: "포스터 이미지는 1MB 이하만 첨부할 수 있어요." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPoster({ name: file.name, data: String(reader.result) });
    reader.readAsDataURL(file);
  };

  if (done) {
    return (
      <SubmitDone
        title="공연정보가 접수되었어요"
        desc={
          <>
            관리자가 공연정보를 확인한 뒤 승인하면 아티스트 페이지에 노출돼요.
            <br />
            승인 전에는 차트 가점에 반영되지 않아요.
          </>
        }
      >
        <button
          onClick={() => {
            setV(empty);
            setPoster(null);
            setDone(false);
          }}
          className={secondaryBtn}
        >
          공연 추가 제보
        </button>
        {v.artistId && (
          <Link href={`/artists/${v.artistId}`} className={`${primaryBtn} grid place-items-center`}>
            아티스트로 돌아가기
          </Link>
        )}
      </SubmitDone>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Field label="아티스트" required error={errors.artistId}>
        <select value={v.artistId} onChange={set("artistId")} className={`${inputClass} appearance-none`} aria-invalid={!!errors.artistId}>
          <option value="">아티스트 선택</option>
          {artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="공연명" required error={errors.title}>
        <input value={v.title} onChange={set("title")} className={inputClass} placeholder="예) 단독 공연 〈밤〉" aria-invalid={!!errors.title} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="공연 날짜" required error={errors.date}>
          <input type="date" min={today} value={v.date} onChange={set("date")} className={inputClass} aria-invalid={!!errors.date} />
        </Field>
        <Field label="공연 시간">
          <input type="time" value={v.time} onChange={set("time")} className={inputClass} />
        </Field>
      </div>
      <Field label="공연장명" required error={errors.venue}>
        <input value={v.venue} onChange={set("venue")} className={inputClass} placeholder="예) 롤링홀" aria-invalid={!!errors.venue} />
      </Field>
      <Field label="공연장 주소">
        <input value={v.address} onChange={set("address")} className={inputClass} placeholder="예) 서울 마포구 어울마당로 35" />
      </Field>
      <Field
        label="공식 공연정보 또는 예매 URL"
        required
        hint="공식 안내 페이지 또는 티켓 예매 페이지만 인정돼요."
        error={errors.url}
      >
        <input type="url" value={v.url} onChange={set("url")} className={inputClass} placeholder="https://" aria-invalid={!!errors.url} />
      </Field>
      <Field label="공연 포스터" hint="1MB 이하 이미지" error={errors.poster}>
        <div className="flex items-center gap-4">
          <span className="relative h-12 px-5 rounded-xl border border-line grid place-items-center text-sm font-semibold hover:border-fg cursor-pointer">
            이미지 선택
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => onPoster(e.target.files?.[0])}
            />
          </span>
          <span className="text-sm text-muted truncate">{poster?.name ?? "선택된 파일 없음"}</span>
        </div>
      </Field>
      <Field label="추가 설명">
        <textarea
          value={v.description}
          onChange={set("description")}
          rows={4}
          className={`${inputClass} h-auto py-3 resize-none`}
          placeholder="게스트, 회차 정보 등"
        />
      </Field>
      {demo ? (
        <DemoNotice>데모 모드에서는 제보가 저장되지 않아 접수할 수 없어요.</DemoNotice>
      ) : (
        message && <p className="text-sm text-up">{message}</p>
      )}
      <button type="submit" disabled={pending || demo} className={`${primaryBtn} w-full`}>
        {pending ? "접수 중…" : demo ? "데모 모드에서는 제보할 수 없어요" : "제보하기"}
      </button>
    </form>
  );
}
