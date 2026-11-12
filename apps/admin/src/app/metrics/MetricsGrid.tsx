"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { adminInput, btn } from "@/components/ui";
import { METRIC_FIELDS } from "@/lib/metrics-csv";
import { saveMetrics, type MetricsFormState } from "../actions";

type Row = {
  id: string;
  name: string;
  melonId: string | null;
  spotifyId: string;
  values: Record<string, number | null>;
  previous: Record<string, number | null>;
};

const fmt = (n: number | null) => (n == null ? "" : n.toLocaleString("ko-KR"));

/** 아티스트 × 수치 입력 표. 빈 칸은 미입력으로 저장(기존 값 삭제) */
export default function MetricsGrid({ date, rows }: { date: string; rows: Row[] }) {
  const [state, action, pending] = useActionState<MetricsFormState, FormData>(saveMetrics, {});
  return (
    <ActionForm action={action} key={date}>
      <input type="hidden" name="date" value={date} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-5 py-2.5 font-semibold">아티스트</th>
              {METRIC_FIELDS.map((f) => (
                <th key={f.key} className="px-2 py-2.5 font-semibold">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-2 align-top">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-subtle space-x-2">
                    {r.melonId ? (
                      <a href={`https://www.melon.com/artist/detail.htm?artistId=${r.melonId}`} target="_blank" rel="noreferrer" className="underline">
                        멜론 ↗
                      </a>
                    ) : (
                      <span className="text-up">멜론 ID 없음</span>
                    )}
                    <a href={`https://open.spotify.com/artist/${r.spotifyId}`} target="_blank" rel="noreferrer" className="underline">
                      Spotify ↗
                    </a>
                  </p>
                </td>
                {METRIC_FIELDS.map((f) => (
                  <td key={f.key} className="px-2 py-2 align-top">
                    <input
                      name={`${r.id}.${f.key}`}
                      defaultValue={fmt(r.values[f.key])}
                      inputMode="numeric"
                      placeholder={r.previous[f.key] != null ? `이전 ${fmt(r.previous[f.key])}` : ""}
                      aria-label={`${r.name} ${f.label}`}
                      className={`${adminInput} w-full tabular-nums`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-t border-line">
        <button disabled={pending} className={btn.primary}>
          {pending ? "저장 중…" : `${date} 수치 저장`}
        </button>
        {state.saved != null && !state.errors && <span className="text-sm text-muted">{state.saved}팀 저장되었어요.</span>}
        <span className="text-xs text-subtle">회색 글씨는 직전 입력값이에요. 빈 칸으로 저장하면 그 날짜의 값이 지워져요.</span>
      </div>
      {state.errors && (
        <ul className="px-5 pb-4 text-xs text-up space-y-0.5">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </ActionForm>
  );
}
