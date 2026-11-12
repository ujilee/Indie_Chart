/**
 * 아티스트 수치 CSV 읽기.
 * 열: date, artist, melon_fans, melon_likes, spotify_followers, spotify_monthly_listeners
 * - artist: 아티스트 ID(a001), 멜론 아티스트 ID, 또는 아티스트명
 * - date가 비어 있으면 화면에서 고른 기준일을 쓴다
 * - 숫자 칸이 비어 있으면 그 항목은 바꾸지 않는다
 */
import type { Artist } from "@indie/core/types";

export const CSV_COLUMNS = ["date", "artist", "melon_fans", "melon_likes", "spotify_followers", "spotify_monthly_listeners"] as const;

export const METRIC_FIELDS = [
  { key: "melonFans", csv: "melon_fans", label: "멜론 팬 수" },
  { key: "melonLikes", csv: "melon_likes", label: "멜론 좋아요 합계" },
  { key: "spotifyFollowers", csv: "spotify_followers", label: "Spotify 팔로워" },
  { key: "spotifyMonthlyListeners", csv: "spotify_monthly_listeners", label: "Spotify 월별 리스너" },
] as const;

export type MetricKey = (typeof METRIC_FIELDS)[number]["key"];

export type CsvRow = { line: number; artistId: string; date: string; values: Partial<Record<MetricKey, number>> };

/** 큰따옴표로 감싼 칸과 칸 안의 쉼표를 처리하는 간단한 CSV 파서 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** "12,345" "12345명" 같은 값을 숫자로. 비어 있으면 undefined, 잘못된 값이면 null */
export function parseCount(raw: string | undefined): number | undefined | null {
  const v = (raw ?? "").replace(/[,\s명]/g, "");
  if (!v) return undefined;
  if (!/^\d+$/.test(v)) return null;
  return Number(v);
}

export function readMetricsCsv(text: string, artists: Artist[], fallbackDate: string) {
  const rows = parseCsv(text);
  const errors: string[] = [];
  const out: CsvRow[] = [];
  if (rows.length === 0) return { rows: out, errors: ["CSV 파일이 비어 있어요."] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  if (col("artist") < 0) return { rows: out, errors: ["첫 줄에 artist 열이 필요해요. 양식 파일을 내려받아 사용해 주세요."] };

  const find = (key: string) => {
    const k = key.trim();
    return (
      artists.find((a) => a.id === k) ??
      artists.find((a) => a.platformIds.melon === k) ??
      artists.find((a) => a.name.replace(/\s/g, "") === k.replace(/\s/g, ""))
    );
  };

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const artistKey = r[col("artist")] ?? "";
    const artist = find(artistKey);
    if (!artist) return errors.push(`${line}번째 줄: 아티스트 "${artistKey}"를 찾지 못했어요.`);
    const date = (col("date") >= 0 ? r[col("date")]?.trim() : "") || fallbackDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errors.push(`${line}번째 줄: 날짜는 2026-11-12 형식이어야 해요.`);
    const values: CsvRow["values"] = {};
    for (const f of METRIC_FIELDS) {
      const n = parseCount(col(f.csv) >= 0 ? r[col(f.csv)] : undefined);
      if (n === null) return errors.push(`${line}번째 줄: ${f.label} 값이 숫자가 아니에요.`);
      if (n !== undefined) values[f.key] = n;
    }
    if (Object.keys(values).length === 0) return;
    out.push({ line, artistId: artist.id, date, values });
  });
  return { rows: out, errors };
}
