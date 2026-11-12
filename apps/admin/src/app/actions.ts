"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { lastServiceMonth, serviceToday, nowIso } from "@indie/core/constants";
import { getChart } from "@indie/core/data";
import { fetchSpotifyArtistProfile } from "@indie/core/artist-image";
import { READ_ONLY_MESSAGE, isDemoMode } from "@indie/core/data-mode";
import { mutate, newId, readDb } from "@indie/core/db";
import type { DB } from "@indie/core/seed";
import type { ArtistStatus, MetricSnapshot, MetricsSource, Period } from "@indie/core/types";
import { collectMelonChartNow } from "@/lib/collect";
import { METRIC_FIELDS, parseCount, readMetricsCsv, type MetricKey } from "@/lib/metrics-csv";
import {
  isHttpUrl,
  parseAppleMusicArtistId,
  parseMelonArtistId,
  parseSpotifyArtistId,
  parseYoutubeChannel,
} from "@indie/core/validate";

function refresh() {
  revalidatePath("/", "layout");
}

/* ---------------- 프로필 이미지 ---------------- */

export type ImageSyncResult = { updated: number; notFound: number; failed: number; skipped: number; readOnly?: boolean };

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
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return { updated: 0, notFound: 0, failed: 0, skipped: 0, readOnly: true };
  const r = await syncImages([id], { force: true });
  refresh();
  return r;
}

/** 직접 입력한 이미지를 제외한 전체 아티스트 이미지 갱신 */
export async function refreshAllArtistImages(): Promise<ImageSyncResult> {
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return { updated: 0, notFound: 0, failed: 0, skipped: 0, readOnly: true };
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
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return { errors: { name: READ_ONLY_MESSAGE } };
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
  if (!id) redirect(`/artists/${targetId}?created=1`);
  return { saved: true };
}

export async function setArtistStatus(id: string, status: ArtistStatus) {
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return;
  mutate((db) => {
    const a = db.artists.find((x) => x.id === id);
    if (a) a.status = status;
  });
  refresh();
}

/* ---------------- 아티스트 제보 ---------------- */

export async function approveArtistReport(reportId: string) {
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return;
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
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return;
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
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return;
  mutate((db) => {
    const c = db.concerts.find((x) => x.id === id);
    if (!c || c.status !== "pending") return;
    c.status = "approved";
    c.reviewedAt = nowIso();
  });
  refresh();
}

export async function rejectConcert(id: string, fd: FormData) {
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return;
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
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return;
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
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return { errors: { artistId: READ_ONLY_MESSAGE } };
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
  else if (v.date < serviceToday()) errors.date = "지난 공연은 등록할 수 없어요.";
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
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return { error: READ_ONLY_MESSAGE };
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
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return;
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
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return;
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
      date: serviceToday(),
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
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return;
  mutate((db) => {
    const a = db.artists.find((x) => x.id === id);
    if (a) a.collected = true;
  });
  if (!readDb().artists.find((a) => a.id === id)?.image) await syncImages([id]);
  refresh();
}

/* ---------------- 응원 ---------------- */

export async function setCheerValid(id: string, valid: boolean) {
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return;
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
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return;
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
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return;
  const db = readDb();
  const chart = getChart("monthly", db);
  const entries = chart.entries
    .filter((e) => e.rank <= 3)
    .map((e) => ({ artistId: e.artist.id, rank: e.rank, total: Math.round(e.score.total * 100) / 100 }));
  mutate((db) => {
    db.monthlyTop3 = db.monthlyTop3.filter((r) => r.month !== lastServiceMonth());
    db.monthlyTop3.unshift({ month: lastServiceMonth(), confirmedAt: nowIso(), entries });
  });
  refresh();
}

/* ---------------- 실제 수치: 멜론 차트 수집 · 수치 입력 ---------------- */

export type CollectState = { ok?: boolean; message?: string };

/** 멜론 인디 일간 차트 수집 (수동 실행) */
export async function collectMelonChart(): Promise<CollectState> {
  const r = await collectMelonChartNow({ manual: true });
  refresh();
  return r;
}

/** 차트 수치 출처 전환 (샘플 수치 ↔ 실제 수치) */
export async function setMetricsSource(source: MetricsSource) {
  // 데모 모드는 읽기 전용
  if (isDemoMode()) return;
  mutate((db) => {
    db.settings.metricsSource = source;
  });
  refresh();
}

/** 한 아티스트·한 날짜의 수치를 합쳐 저장. undefined는 그대로 두고, null은 지운다 */
function upsertSnapshot(
  db: DB,
  artistId: string,
  date: string,
  values: Partial<Record<MetricKey, number | null>>,
  source: MetricSnapshot["source"],
) {
  let snap = db.metricSnapshots.find((s) => s.artistId === artistId && s.date === date);
  if (!snap) {
    snap = { artistId, date, source, updatedAt: nowIso() };
    db.metricSnapshots.push(snap);
  }
  for (const [k, v] of Object.entries(values) as [MetricKey, number | null | undefined][]) {
    if (v === undefined) continue;
    if (v === null) delete snap[k];
    else snap[k] = v;
  }
  snap.source = source;
  snap.updatedAt = nowIso();
  // 모든 값이 비면 기록 자체를 지운다
  if (METRIC_FIELDS.every((f) => snap![f.key] == null)) db.metricSnapshots = db.metricSnapshots.filter((s) => s !== snap);
}

export type MetricsFormState = { saved?: number; errors?: string[] };

/** 관리자 화면 표에서 입력한 수치 저장. 빈 칸은 미입력(지움) */
export async function saveMetrics(_: MetricsFormState, fd: FormData): Promise<MetricsFormState> {
  if (isDemoMode()) return { errors: [READ_ONLY_MESSAGE] };
  const date = String(fd.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { errors: ["기준일을 선택해 주세요."] };
  if (date > serviceToday()) return { errors: ["미래 날짜에는 입력할 수 없어요."] };

  const db = readDb();
  const errors: string[] = [];
  const updates: { artistId: string; values: Partial<Record<MetricKey, number | null>> }[] = [];
  for (const a of db.artists.filter((x) => x.status === "active")) {
    const values: Partial<Record<MetricKey, number | null>> = {};
    for (const f of METRIC_FIELDS) {
      const raw = fd.get(`${a.id}.${f.key}`);
      if (raw === null) continue; // 화면에 없던 칸
      const n = parseCount(String(raw));
      if (n === null) errors.push(`${a.name} · ${f.label}: 숫자만 입력해 주세요.`);
      else values[f.key] = n ?? null;
    }
    updates.push({ artistId: a.id, values });
  }
  if (errors.length) return { errors };

  mutate((db) => updates.forEach((u) => upsertSnapshot(db, u.artistId, date, u.values, "manual")));
  refresh();
  return { saved: updates.filter((u) => Object.values(u.values).some((v) => v != null)).length };
}

export type ImportState = { imported?: number; errors?: string[] };

/** CSV 업로드로 수치 저장. 빈 칸은 기존 값 유지 */
export async function importMetricsCsv(_: ImportState, fd: FormData): Promise<ImportState> {
  if (isDemoMode()) return { errors: [READ_ONLY_MESSAGE] };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { errors: ["CSV 파일을 선택해 주세요."] };
  if (file.size > 1024 * 1024) return { errors: ["CSV 파일은 1MB 이하만 올릴 수 있어요."] };
  const fallbackDate = String(fd.get("date") ?? serviceToday());

  const { rows, errors } = readMetricsCsv(await file.text(), readDb().artists, fallbackDate);
  const future = rows.filter((r) => r.date > serviceToday());
  if (future.length) errors.push(...future.map((r) => `${r.line}번째 줄: 미래 날짜에는 입력할 수 없어요.`));
  // 한 줄이라도 틀리면 아무것도 저장하지 않는다 (일부만 반영되는 혼란 방지)
  if (errors.length) return { errors };
  if (rows.length === 0) return { errors: ["저장할 수치가 없어요."] };

  mutate((db) => rows.forEach((r) => upsertSnapshot(db, r.artistId, r.date, r.values, "csv")));
  refresh();
  return { imported: rows.length };
}
