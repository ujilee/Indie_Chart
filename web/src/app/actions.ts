"use server";

import { revalidatePath } from "next/cache";
import { TODAY, nowIso } from "@/lib/constants";
import { READ_ONLY_MESSAGE, isDemoMode } from "@/lib/data-mode";
import { mutate, newId, readDb } from "@/lib/db";
import {
  isHttpUrl,
  parseAppleMusicArtistId,
  parseMelonArtistId,
  parseSpotifyArtistId,
  parseYoutubeChannel,
} from "@/lib/validate";

type Errors<K extends string> = Partial<Record<K, string>>;
export type ActionResult<K extends string> = { ok: true } | { ok: false; errors: Errors<K>; message?: string };

/** 데모 모드(읽기 전용)에서 쓰기 요청에 돌려주는 결과 */
const readOnlyResult = { ok: false as const, errors: {}, message: READ_ONLY_MESSAGE };

/* ---------------- 아티스트 제보 ---------------- */

export type ArtistReportInput = { name: string; spotify: string; melon: string; youtube: string; apple: string };

export async function submitArtistReport(v: ArtistReportInput): Promise<ActionResult<keyof ArtistReportInput>> {
  if (isDemoMode()) return readOnlyResult;
  const db = readDb();
  const err: Errors<keyof ArtistReportInput> = {};
  const name = v.name.trim();
  if (!name) err.name = "아티스트명을 입력해 주세요.";
  else if (db.artists.some((a) => a.name === name)) err.name = "이미 차트에 등록된 아티스트예요.";

  const spotifyId = parseSpotifyArtistId(v.spotify);
  if (!v.spotify.trim()) err.spotify = "Spotify 아티스트 ID 또는 URL을 입력해 주세요.";
  else if (!spotifyId) err.spotify = "올바른 Spotify 아티스트 ID 또는 URL 형식이 아니에요.";
  else if (db.artists.some((a) => a.platformIds.spotify === spotifyId)) err.spotify = "이미 등록된 Spotify 아티스트예요.";
  else if (db.artistReports.some((r) => r.spotifyId === spotifyId && r.status === "pending"))
    err.spotify = "이미 제보되어 검토 중인 Spotify 아티스트예요.";

  const melon = v.melon.trim() ? parseMelonArtistId(v.melon) : undefined;
  const youtube = v.youtube.trim() ? parseYoutubeChannel(v.youtube) : undefined;
  const apple = v.apple.trim() ? parseAppleMusicArtistId(v.apple) : undefined;
  if (melon === null) err.melon = "올바른 멜론 아티스트 ID 또는 URL 형식이 아니에요.";
  if (youtube === null) err.youtube = "올바른 YouTube 채널 ID 또는 URL 형식이 아니에요.";
  if (apple === null) err.apple = "올바른 Apple Music 아티스트 ID 또는 URL 형식이 아니에요.";

  if (Object.keys(err).length) return { ok: false, errors: err };

  mutate((db) => {
    db.artistReports.unshift({
      id: newId("r"),
      name,
      spotifyId: spotifyId!,
      melonId: melon ?? undefined,
      youtube: youtube ?? undefined,
      appleMusic: apple ?? undefined,
      createdAt: nowIso(),
      status: "pending",
    });
  });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/* ---------------- 공연정보 제보 ---------------- */

export type ConcertReportInput = {
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

const norm = (s: string) => s.replace(/\s/g, "").toLowerCase();

export async function submitConcertReport(v: ConcertReportInput): Promise<ActionResult<keyof ConcertReportInput>> {
  if (isDemoMode()) return readOnlyResult;
  const db = readDb();
  const err: Errors<keyof ConcertReportInput> = {};
  if (!v.artistId || !db.artists.some((a) => a.id === v.artistId && a.status === "active"))
    err.artistId = "아티스트를 선택해 주세요.";
  if (!v.title.trim()) err.title = "공연명을 입력해 주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) err.date = "공연 날짜를 선택해 주세요.";
  else if (v.date < TODAY) err.date = "이미 종료된 공연은 제보할 수 없어요.";
  if (!v.venue.trim()) err.venue = "공연장명을 입력해 주세요.";
  if (!v.url.trim()) err.url = "공식 공연정보 또는 예매 URL을 입력해 주세요.";
  else if (!isHttpUrl(v.url)) err.url = "올바른 URL 형식이 아니에요. (https://로 시작)";

  if (!err.date && !err.venue && !err.artistId) {
    const dup = db.concerts.find(
      (c) =>
        c.artistId === v.artistId &&
        c.date === v.date &&
        norm(c.venue) === norm(v.venue) &&
        (c.status === "approved" || c.status === "pending"),
    );
    if (dup?.status === "canceled") err.date = "취소된 공연은 제보할 수 없어요.";
    else if (dup) err.venue = "이미 등록되었거나 검토 중인 공연이에요.";
  }
  if (Object.keys(err).length) return { ok: false, errors: err };

  mutate((db) => {
    db.concerts.push({
      id: newId("c"),
      artistId: v.artistId,
      title: v.title.trim(),
      date: v.date,
      time: v.time || undefined,
      venue: v.venue.trim(),
      address: v.address.trim() || undefined,
      url: v.url.trim(),
      description: v.description.trim() || undefined,
      poster: v.poster || undefined,
      status: "pending",
      source: "report",
      createdAt: nowIso(),
    });
  });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/* ---------------- 응원 ---------------- */

export async function cheerArtist(userId: string, artistId: string): Promise<"ok" | "used" | "invalid" | "readonly"> {
  if (isDemoMode()) return "readonly";
  if (!userId) return "invalid";
  const result = mutate((db) => {
    if (!db.artists.some((a) => a.id === artistId && a.status === "active")) return "invalid" as const;
    // 1인 하루 총 1회
    if (db.cheerRecords.some((r) => r.userId === userId && r.date === TODAY)) return "used" as const;
    db.cheerRecords.push({ id: newId("ch"), userId, artistId, date: TODAY, createdAt: nowIso(), valid: true });
    return "ok" as const;
  });
  if (result === "ok") {
    revalidatePath("/cheer");
    revalidatePath(`/artists/${artistId}`);
    revalidatePath("/admin", "layout");
  }
  return result;
}
