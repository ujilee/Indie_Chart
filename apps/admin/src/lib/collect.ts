/**
 * 실제 수집 (관리자 버튼과 예약 실행이 같이 쓴다).
 * - 멜론 인디 차트: 마지막 수집 후 10분 안에는 다시 요청하지 않는다.
 * - 아티스트 수치: 멜론 팬 수·발매곡 좋아요 합계, (키가 있으면) Spotify 팔로워.
 *   오늘 이미 수집한 아티스트는 건너뛰어서, 시간 제한으로 멈춰도 다시 실행하면 이어서 수집한다.
 */
import { nowIso, serviceToday } from "@indie/core/constants";
import { getDataMode, isDemoMode } from "@indie/core/data-mode";
import { mutate, newId, readDb } from "@indie/core/db";
import { fetchSpotifyFollowers, hasSpotifyApiKeys } from "@indie/core/artist-image";
import {
  MELON_REQUEST_GAP_MS,
  MelonCollectError,
  fetchMelonFans,
  fetchMelonIndieChart,
  fetchMelonSongIds,
  fetchMelonSongLikes,
} from "@indie/core/melon";
import type { Artist } from "@indie/core/types";
import { upsertSnapshot, type MetricKey } from "./metrics-csv";

const MIN_INTERVAL_MS = 10 * 60 * 1000;

/**
 * 멜론 자동 수집 사용 여부. 운영 DB(supabase 모드)에서는 기본으로 끈다.
 * 멜론은 공개 API가 없고 robots.txt가 수집기를 막고 있어, 제휴·허가 후 MELON_AUTO_COLLECT=1 로만 켠다.
 */
export function melonAutoEnabled() {
  if (process.env.MELON_AUTO_COLLECT === "1") return true;
  if (process.env.MELON_AUTO_COLLECT === "0") return false;
  return getDataMode() !== "supabase";
}
const DISABLED: CollectResult = { ok: false, message: "멜론 자동 수집이 꺼져 있어요. 수치 입력에서 직접 넣어 주세요." };

export type CollectResult = { ok: boolean; message: string };

export async function collectMelonChartNow({ manual }: { manual: boolean }): Promise<CollectResult> {
  if (isDemoMode()) return { ok: false, message: "데모 모드에서는 수집할 수 없어요." };
  if (!melonAutoEnabled()) return DISABLED;

  const db = await readDb();
  const last = [...db.collectionRuns].filter((r) => r.kind === "melon-chart").sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  if (last && Date.now() - new Date(last.startedAt).getTime() < MIN_INTERVAL_MS) {
    return { ok: false, message: "마지막 수집 후 10분이 지나지 않았어요. 멜론에 부담을 주지 않도록 잠시 후 다시 시도해 주세요." };
  }

  const startedAt = nowIso();
  try {
    const chart = await fetchMelonIndieChart();
    const registered = new Map(
      db.artists.filter((a) => a.platformIds.melon).map((a) => [a.platformIds.melon!, a.name] as const),
    );
    const matched = new Set(chart.entries.flatMap((e) => e.artists.map((a) => a.melonId)).filter((id) => registered.has(id)));
    const note = `${chart.chartDate} 인디 차트 ${chart.entries.length}곡 · 등록 아티스트 ${matched.size}팀 차트인`;
    await mutate((db) => {
      // 같은 기준일 차트는 최신 수집 결과로 교체
      db.melonCharts = [chart, ...db.melonCharts.filter((c) => c.chartDate !== chart.chartDate)];
      db.collectionRuns.unshift({
        id: newId("run"),
        date: serviceToday(),
        startedAt,
        finishedAt: nowIso(),
        status: "success",
        artistCount: matched.size,
        failures: [],
        manual,
        kind: "melon-chart",
        note,
      });
    });
    return { ok: true, message: note };
  } catch (e) {
    const message = e instanceof MelonCollectError ? e.message : "알 수 없는 오류로 수집하지 못했어요.";
    await mutate((db) => {
      db.collectionRuns.unshift({
        id: newId("run"),
        date: serviceToday(),
        startedAt,
        finishedAt: nowIso(),
        status: "failed",
        artistCount: 0,
        failures: [],
        manual,
        kind: "melon-chart",
        error: message,
      });
    });
    return { ok: false, message };
  }
}

/* ───────── 아티스트 수치 ───────── */

/** 발매곡 목록은 이 기간이 지나면 새로 받는다 */
const SONG_LIST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let running = false;

/** 오늘 자동 수집을 마친 아티스트인지 */
function doneToday(db: Awaited<ReturnType<typeof readDb>>, artistId: string, today: string) {
  const s = db.metricSnapshots.find((x) => x.artistId === artistId && x.date === today);
  return s?.source === "auto" && s.melonFans != null && s.melonLikes != null;
}

export function metricTargets(db: Awaited<ReturnType<typeof readDb>>) {
  return db.artists.filter((a) => a.status === "active" && a.platformIds.melon);
}

/**
 * 아티스트별 수치 수집. budgetMs 안에 끝내지 못하면 거기서 멈추고 "일부"로 기록한다.
 * onlyArtistId를 주면 그 아티스트만 (오늘 이미 수집했어도 다시) 수집한다.
 */
export async function collectArtistMetricsNow({
  manual,
  budgetMs = 240_000,
  onlyArtistId,
}: {
  manual: boolean;
  budgetMs?: number;
  onlyArtistId?: string;
}): Promise<CollectResult> {
  if (isDemoMode()) return { ok: false, message: "데모 모드에서는 수집할 수 없어요." };
  if (!melonAutoEnabled()) return DISABLED;
  if (running) return { ok: false, message: "이미 수집 중이에요. 끝난 뒤 다시 시도해 주세요." };
  running = true;
  const startedAt = nowIso();
  const t0 = Date.now();
  const today = serviceToday();
  try {
    const db = await readDb();
    const all = metricTargets(db);
    const targets = onlyArtistId ? all.filter((a) => a.id === onlyArtistId) : all.filter((a) => !doneToday(db, a.id, today));
    if (targets.length === 0) {
      return { ok: true, message: all.length ? "오늘 수집할 아티스트를 모두 수집했어요." : "멜론 ID가 등록된 아티스트가 없어요." };
    }
    const useSpotify = hasSpotifyApiKeys();
    const done: string[] = [];
    const failed: string[] = [];
    let spotifyMissing = 0;
    let blocked: string | null = null;
    for (const artist of targets) {
      if (Date.now() - t0 > budgetMs) break;
      try {
        const { songCache, ...values } = await collectOne(artist, useSpotify);
        if (useSpotify && artist.platformIds.spotify && values.spotifyFollowers == null) spotifyMissing++;
        await mutate((d) => {
          upsertSnapshot(d, artist.id, today, values, "auto");
          if (songCache) d.melonSongCache[artist.platformIds.melon!] = songCache;
        });
        done.push(artist.name);
      } catch (e) {
        failed.push(`${artist.name}: ${e instanceof Error ? e.message : "오류"}`);
        // 멜론이 막은 것으로 보이면 더 요청하지 않고 멈춘다
        if (e instanceof MelonCollectError && e.blocked) {
          blocked = e.message;
          break;
        }
      }
      await sleep(MELON_REQUEST_GAP_MS);
    }
    const left = targets.length - done.length - failed.length;
    const parts = [`${today} 아티스트 수치 ${done.length}팀 수집`];
    if (failed.length) parts.push(`실패 ${failed.length}팀`);
    if (blocked) parts.push(`멜론이 응답하지 않아 중단, ${left}팀 남음 (몇 시간 뒤 다시 실행하면 이어서 수집)`);
    else if (left) parts.push(`시간 제한으로 ${left}팀 남음 (다시 실행하면 이어서 수집)`);
    if (!useSpotify) parts.push("Spotify 키 없음: 팔로워는 수치 입력에서 직접 넣어 주세요");
    else if (spotifyMissing) parts.push(`Spotify 팔로워를 받지 못한 아티스트 ${spotifyMissing}팀`);
    const note = parts.join(" · ");
    await mutate((d) => {
      d.collectionRuns.unshift({
        id: newId("run"),
        date: today,
        startedAt,
        finishedAt: nowIso(),
        status: done.length === 0 ? "failed" : failed.length || left ? "partial" : "success",
        artistCount: done.length,
        failures: [],
        manual,
        kind: "artist-metrics",
        note,
        error: failed.length ? failed.slice(0, 10).join(" / ") : undefined,
      });
    });
    return { ok: done.length > 0, message: note };
  } finally {
    running = false;
  }
}

async function collectOne(artist: Artist, useSpotify: boolean) {
  const melonId = artist.platformIds.melon!;
  const db = await readDb();
  const melonFans = await fetchMelonFans(melonId);
  await sleep(MELON_REQUEST_GAP_MS);

  let songCache = undefined as { songIds: string[]; fetchedAt: string } | undefined;
  let songIds = db.melonSongCache[melonId]?.songIds;
  const fetchedAt = db.melonSongCache[melonId]?.fetchedAt;
  if (!songIds || !fetchedAt || Date.now() - new Date(fetchedAt).getTime() > SONG_LIST_TTL_MS) {
    songIds = await fetchMelonSongIds(melonId);
    songCache = { songIds, fetchedAt: nowIso() };
    await sleep(MELON_REQUEST_GAP_MS);
  }
  const melonLikes = songIds.length ? await fetchMelonSongLikes(melonId, songIds) : 0;

  const values: Partial<Record<MetricKey, number | null>> & { songCache?: typeof songCache } = { melonFans, melonLikes, songCache };
  if (useSpotify && artist.platformIds.spotify) {
    // Spotify 실패는 멜론 수치 저장을 막지 않는다
    const followers = await fetchSpotifyFollowers(artist.platformIds.spotify).catch(() => null);
    if (followers != null) values.spotifyFollowers = followers;
  }
  return values;
}
