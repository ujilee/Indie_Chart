"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LAST_MONTH, TODAY, nowIso } from "@/lib/constants";
import { getChart } from "@/lib/data";
import { fetchSpotifyArtistProfile } from "@/lib/artist-image";
import { mutate, newId, readDb } from "@/lib/db";
import type { DB } from "@/lib/seed";
import type { ArtistStatus, Period } from "@/lib/types";
import {
  isHttpUrl,
  parseAppleMusicArtistId,
  parseMelonArtistId,
  parseSpotifyArtistId,
  parseYoutubeChannel,
} from "@/lib/validate";

function refresh() {
  revalidatePath("/", "layout");
}

/* ---------------- 프로필 이미지 ---------------- */

export type ImageSyncResult = { updated: number; notFound: number; failed: number; skipped: number };

/**
 * Spotify에서 프로필 이미지를 가져와 저장. 관리자가 직접 입력한 이미지는 건너뜀.
 * 존재하지 않는 Spotify ID는 notFound, 네트워크 오류는 failed로 집계.
 */
async function syncImages(ids: string[], { force = false } = {}): Promise<ImageSyncResult> {
  const db = readDb();
  const targets = db.artists.filter((a) => ids.includes(a.id) && (force || a.imageSource !== "manual"));
  const result: ImageSyncResult = { updated: 0, notFound: 0, failed: 0, skipped: ids.length - targets.length };
  const found = new Map<string, string>();
  // 동시 요청 4개로 제한
  for (let i = 0; i < targets.length; i += 4) {
    await Promise.all(
      targets.slice(i, i + 4).map(async (a) => {
        try {
          const p = await fetchSpotifyArtistProfile(a.platformIds.spotify, { fresh: true });
          if (p?.image) found.set(a.id, p.image);
          else result.notFound++;
        } catch {
          result.failed++;
        }
      }),
    );
  }
  if (found.size) {
    mutate((db) => {
      for (const a of db.artists) {
        const image = found.get(a.id);
        if (!image) continue;
        a.image = image;
        a.imageSource = "spotify";
        a.imageUpdatedAt = nowIso();
      }
    });
  }
  result.updated = found.size;
  return result;
}

/** 아티스트 1팀 이미지 가져오기 (직접 입력한 이미지도 덮어씀) */
export async function refreshArtistImage(id: string): Promise<ImageSyncResult> {
  const r = await syncImages([id], { force: true });
  refresh();
  return r;
}

/** 직접 입력한 이미지를 제외한 전체 아티스트 이미지 갱신 */
export async function refreshAllArtistImages(): Promise<ImageSyncResult> {
  const r = await syncImages(readDb().artists.map((a) => a.id));
  refresh();
  return r;
}

function nextArtistId(db: DB) {
  const max = Math.max(0, ...db.artists.map((a) => parseInt(a.id.slice(1), 10)));
  return { id: `a${String(max + 1).padStart(3, "0")}`, seq: max + 1 };
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/* ---------------- 아티스트 ---------------- */

export type ArtistFormState = { errors?: Record<string, string>; saved?: boolean };

export async function saveArtist(id: string | null, _: ArtistFormState, fd: FormData): Promise<ArtistFormState> {
  const db = readDb();
  const errors: Record<string, string> = {};
  const name = str(fd, "name");
  const nameEn = str(fd, "nameEn");
  const genre = str(fd, "genre");
  const image = str(fd, "image");
  const spotify = parseSpotifyArtistId(str(fd, "spotify"));
  const melonRaw = str(fd, "melon");
  const youtubeRaw = str(fd, "youtube");
  const appleRaw = str(fd, "appleMusic");
  const melon = melonRaw ? parseMelonArtistId(melonRaw) : undefined;
  const youtube = youtubeRaw ? parseYoutubeChannel(youtubeRaw) : undefined;
  const appleMusic = appleRaw ? parseAppleMusicArtistId(appleRaw) : undefined;

  if (!name) errors.name = "아티스트명을 입력하세요.";
  else if (db.artists.some((a) => a.name === name && a.id !== id)) errors.name = "같은 이름의 아티스트가 있어요.";
  if (!spotify) errors.spotify = "Spotify 아티스트 ID/URL 형식을 확인하세요.";
  else if (db.artists.some((a) => a.platformIds.spotify === spotify && a.id !== id)) errors.spotify = "이미 등록된 Spotify ID예요.";
  if (melon === null) errors.melon = "멜론 ID 형식을 확인하세요.";
  if (youtube === null) errors.youtube = "YouTube 채널 형식을 확인하세요.";
  if (appleMusic === null) errors.appleMusic = "Apple Music ID 형식을 확인하세요.";
  if (image && !isHttpUrl(image)) errors.image = "이미지 URL 형식을 확인하세요.";
  if (Object.keys(errors).length) return { errors };

  const platformIds = {
    spotify: spotify!,
    melon: melon ?? undefined,
    youtube: youtube ?? undefined,
    appleMusic: appleMusic ?? undefined,
  };
  let targetId = id;
  const prev = id ? db.artists.find((a) => a.id === id) : undefined;
  const spotifyChanged = !!prev && prev.platformIds.spotify !== spotify;
  mutate((db) => {
    if (id) {
      const a = db.artists.find((x) => x.id === id);
      if (!a) return;
      const imageChanged = (image || undefined) !== a.image;
      Object.assign(a, { name, nameEn, genre, platformIds });
      if (imageChanged) {
        a.image = image || undefined;
        a.imageSource = image ? "manual" : undefined;
        a.imageUpdatedAt = image ? nowIso() : undefined;
      }
    } else {
      const { id: newArtistId, seq } = nextArtistId(db);
      targetId = newArtistId;
      db.artists.push({
        id: newArtistId,
        seq,
        name,
        nameEn,
        genre,
        image: image || undefined,
        imageSource: image ? "manual" : undefined,
        platformIds,
        status: "active",
        collected: false,
        createdAt: nowIso(),
      });
    }
  });
  // 이미지가 없거나 Spotify ID가 바뀌면 Spotify에서 가져오기 (실패해도 저장은 유지)
  const saved = readDb().artists.find((a) => a.id === targetId);
  if (saved && (!saved.image || (spotifyChanged && saved.imageSource === "spotify"))) await syncImages([saved.id]);
  refresh();
  if (!id) redirect(`/admin/artists/${targetId}?created=1`);
  return { saved: true };
}

export async function setArtistStatus(id: string, status: ArtistStatus) {
  mutate((db) => {
    const a = db.artists.find((x) => x.id === id);
    if (a) a.status = status;
  });
  refresh();
}

/* ---------------- 아티스트 제보 ---------------- */

export async function approveArtistReport(reportId: string) {
  let createdId: string | null = null;
  mutate((db) => {
    const r = db.artistReports.find((x) => x.id === reportId);
    if (!r || r.status !== "pending") return;
    if (db.artists.some((a) => a.platformIds.spotify === r.spotifyId)) {
      r.status = "rejected";
      r.rejectReason = "이미 등록된 아티스트 (자동 반려)";
    } else {
      const { id, seq } = nextArtistId(db);
      createdId = id;
      db.artists.push({
        id,
        seq,
        name: r.name,
        nameEn: "",
        genre: "",
        platformIds: { spotify: r.spotifyId, melon: r.melonId, youtube: r.youtube, appleMusic: r.appleMusic },
        status: "active",
        collected: false,
        createdAt: nowIso(),
      });
      r.status = "approved";
    }
    r.reviewedAt = nowIso();
  });
  if (createdId) await syncImages([createdId]);
  refresh();
}

export async function rejectArtistReport(reportId: string, fd: FormData) {
  mutate((db) => {
    const r = db.artistReports.find((x) => x.id === reportId);
    if (!r || r.status !== "pending") return;
    r.status = "rejected";
    r.rejectReason = str(fd, "reason") || "검증 불가";
    r.reviewedAt = nowIso();
  });
  refresh();
}

/* ---------------- 공연 ---------------- */

export async function approveConcert(id: string) {
  mutate((db) => {
    const c = db.concerts.find((x) => x.id === id);
    if (!c || c.status !== "pending") return;
    c.status = "approved";
    c.reviewedAt = nowIso();
  });
  refresh();
}

export async function rejectConcert(id: string, fd: FormData) {
  mutate((db) => {
    const c = db.concerts.find((x) => x.id === id);
    if (!c || c.status !== "pending") return;
    c.status = "rejected";
    c.rejectReason = str(fd, "reason") || "공연정보 확인 불가";
    c.reviewedAt = nowIso();
  });
  refresh();
}

export async function cancelConcert(id: string) {
  mutate((db) => {
    const c = db.concerts.find((x) => x.id === id);
    if (c && c.status === "approved") {
      c.status = "canceled";
      c.reviewedAt = nowIso();
    }
  });
  refresh();
}

export type ConcertFormState = { errors?: Record<string, string>; ok?: boolean };

export async function createConcert(_: ConcertFormState, fd: FormData): Promise<ConcertFormState> {
  const db = readDb();
  const v = {
    artistId: str(fd, "artistId"),
    title: str(fd, "title"),
    date: str(fd, "date"),
    time: str(fd, "time"),
    venue: str(fd, "venue"),
    url: str(fd, "url"),
  };
  const errors: Record<string, string> = {};
  if (!db.artists.some((a) => a.id === v.artistId)) errors.artistId = "아티스트를 선택하세요.";
  if (!v.title) errors.title = "공연명을 입력하세요.";
  if (!v.date) errors.date = "날짜를 선택하세요.";
  else if (v.date < TODAY) errors.date = "지난 공연은 등록할 수 없어요.";
  if (!v.venue) errors.venue = "공연장을 입력하세요.";
  if (!isHttpUrl(v.url)) errors.url = "URL 형식을 확인하세요.";
  const norm = (s: string) => s.replace(/\s/g, "").toLowerCase();
  if (
    !errors.date &&
    db.concerts.some(
      (c) => c.artistId === v.artistId && c.date === v.date && norm(c.venue) === norm(v.venue) && c.status !== "rejected",
    )
  )
    errors.venue = "같은 날짜·공연장의 공연이 이미 있어요.";
  if (Object.keys(errors).length) return { errors };

  mutate((db) => {
    db.concerts.push({
      id: newId("c"),
      ...v,
      time: v.time || undefined,
      status: "approved",
      source: "admin",
      createdAt: nowIso(),
      reviewedAt: nowIso(),
    });
  });
  refresh();
  return { ok: true };
}

/* ---------------- 점수 기준 ---------------- */

export type BasisFormState = { error?: string; saved?: boolean };

export async function updateBasis(period: Period, _: BasisFormState, fd: FormData): Promise<BasisFormState> {
  const after = {
    likes: Number(fd.get("likes")),
    fans: Number(fd.get("fans")),
    followers: Number(fd.get("followers")),
  };
  if (Object.values(after).some((n) => !Number.isFinite(n) || n <= 0 || !Number.isInteger(n)))
    return { error: "만점 기준은 1 이상의 정수로 입력하세요." };
  mutate((db) => {
    const before = db.scoreConfig.basis[period];
    if (before.likes === after.likes && before.fans === after.fans && before.followers === after.followers) return;
    db.scoreConfig.history.unshift({ at: nowIso(), period, before, after, note: str(fd, "note") || undefined });
    db.scoreConfig.basis[period] = after;
  });
  refresh();
  return { saved: true };
}

/* ---------------- 데이터 수집 ---------------- */

/** 실패 건 재수집 (목업: 즉시 성공 처리) */
export async function retryFailure(runId: string, artistId: string, platform: string) {
  mutate((db) => {
    const run = db.collectionRuns.find((r) => r.id === runId);
    const f = run?.failures.find((x) => x.artistId === artistId && x.platform === platform);
    if (!run || !f) return;
    f.resolved = true;
    if (run.failures.every((x) => x.resolved)) run.status = "success";
  });
  refresh();
}

/** 수동 전체 재수집: 미해결 실패 해소 + 수집 대기 아티스트 최초 수집 */
export async function runCollection() {
  let newlyCollected: string[] = [];
  mutate((db) => {
    const latest = [...db.collectionRuns].sort((a, b) => b.date.localeCompare(a.date))[0];
    latest?.failures.forEach((f) => (f.resolved = true));
    if (latest) latest.status = "success";
    const pending = db.artists.filter((a) => a.status === "active" && !a.collected);
    pending.forEach((a) => (a.collected = true));
    newlyCollected = pending.map((a) => a.id);
    const now = nowIso();
    db.collectionRuns.unshift({
      id: newId("run"),
      date: TODAY,
      startedAt: now,
      finishedAt: now,
      status: "success",
      artistCount: db.artists.filter((a) => a.status === "active").length,
      failures: [],
      manual: true,
    });
  });
  if (newlyCollected.length) await syncImages(newlyCollected);
  refresh();
}

export async function collectArtist(id: string) {
  mutate((db) => {
    const a = db.artists.find((x) => x.id === id);
    if (a) a.collected = true;
  });
  if (!readDb().artists.find((a) => a.id === id)?.image) await syncImages([id]);
  refresh();
}

/* ---------------- 응원 ---------------- */

export async function setCheerValid(id: string, valid: boolean) {
  mutate((db) => {
    const r = db.cheerRecords.find((x) => x.id === id);
    if (!r) return;
    r.valid = valid;
    r.invalidatedAt = valid ? undefined : nowIso();
  });
  refresh();
}

/** 의심 기록 일괄 무효 처리 */
export async function invalidateFlagged() {
  mutate((db) => {
    db.cheerRecords.forEach((r) => {
      if (r.flag && r.valid) {
        r.valid = false;
        r.invalidatedAt = nowIso();
      }
    });
  });
  refresh();
}

/* ---------------- 월간 종합 TOP 3 ---------------- */

export async function confirmMonthlyTop3() {
  const db = readDb();
  const chart = getChart("monthly", db);
  const entries = chart.entries
    .filter((e) => e.rank <= 3)
    .map((e) => ({ artistId: e.artist.id, rank: e.rank, total: Math.round(e.score.total * 100) / 100 }));
  mutate((db) => {
    db.monthlyTop3 = db.monthlyTop3.filter((r) => r.month !== LAST_MONTH);
    db.monthlyTop3.unshift({ month: LAST_MONTH, confirmedAt: nowIso(), entries });
  });
  refresh();
}
