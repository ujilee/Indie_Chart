/**
 * 서버 전용 조회 함수. 저장소(db.ts)의 데이터를 바탕으로 차트를 계산한다.
 * - mock: 외부 플랫폼 수치를 아티스트별 시드로 만든 샘플 수치
 * - live: 멜론 인디 차트 수집 결과 + 관리자가 입력한 수치 (live.ts)
 */
import { serviceMonth, lastServiceMonth, serviceToday, monthLabel } from "./constants";
import { getDataMode, isDemoMode } from "./data-mode";
import { latestValue, liveChartSongs, liveMetrics, periodWindow, windowHasData } from "./live";
import { onSeed } from "./db";
import { computeScore, isConcertValid, rankWithTies, songRankPoints } from "./score";
import { mulberry32, popularityOf, type DB } from "./seed";
import type {
  Artist,
  ArtistSnapshot,
  Chart,
  ChartEntry,
  CheerRankEntry,
  Period,
  PeriodMetrics,
} from "./types";

/** 목업 수치 생성 배율 (기간 일수) */
const MOCK_SCALE: Record<Period, number> = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };

/** 기간 라벨 (집계 기간, 비교 기간) */
export function periodLabels(period: Period) {
  return { label: periodWindow(period, 0).label, prevLabel: periodWindow(period, -1).label };
}

/** 차트 수치 출처. 데모 모드는 항상 샘플 수치, 운영 DB는 항상 실제 수치 */
export function getMetricsSource(db: DB) {
  if (isDemoMode()) return "mock";
  if (getDataMode() === "supabase") return "live";
  return db.settings.metricsSource;
}

/** 직전 기간 차트에 없던 신규 진입 아티스트 (목업) */
const NEW_ARTISTS: Record<Period, string[]> = {
  daily: ["a028"],
  weekly: ["a024", "a029"],
  monthly: ["a027"],
  yearly: ["a021", "a026", "a030"],
};

const SEED_BASE: Record<Period, number> = { daily: 11, weekly: 22, monthly: 33, yearly: 44 };

/* ---------------- 아티스트 / 공연 ---------------- */

export function getArtists(db: DB) {
  return db.artists;
}

export function getActiveArtists(db: DB) {
  return db.artists.filter((a) => a.status === "active");
}

export function getArtist(id: string, db: DB) {
  return db.artists.find((a) => a.id === id);
}

export function getArtistConcerts(artistId: string, db: DB) {
  return db.concerts.filter((c) => c.artistId === artistId).sort((a, b) => a.date.localeCompare(b.date));
}

export function countValidConcerts(artistId: string, db: DB, asOf = serviceToday()) {
  return db.concerts.filter((c) => c.artistId === artistId && isConcertValid(c, asOf)).length;
}

/** 가장 최근 수집에서 아직 해결되지 않은 실패 */
export function getOpenFailures(db: DB) {
  const latest = [...db.collectionRuns].sort((a, b) => b.date.localeCompare(a.date))[0];
  return latest ? latest.failures.filter((f) => !f.resolved) : [];
}

/* ---------------- 차트 ---------------- */

function generateMetrics(db: DB, period: Period, seed: number, artists: Artist[]): PeriodMetrics[] {
  const scale = MOCK_SCALE[period];
  const failures = period === "daily" ? getOpenFailures(db) : [];
  return artists.map((artist) => {
    const rand = mulberry32(seed * 1000 + artist.seq);
    const p = popularityOf(artist.seq) * (0.55 + rand() * 0.9);
    const chartSongs = Math.max(0, Math.floor(p * 6 - rand() * 2));
    const ranks = Array.from({ length: chartSongs }, () =>
      Math.min(100, Math.max(1, 1 + Math.floor(Math.max(0, 1 - p) * 70 + rand() * 30))),
    );
    const songPts = songRankPoints(ranks);
    const gain = (base: number) => Math.round(base * scale * p * (0.4 + rand()));
    const failed = (pl: "melon" | "spotify") => failures.some((f) => f.artistId === artist.id && f.platform === pl);
    const likeGain = gain(70);
    const fanGain = gain(45);
    const followerGain = gain(40);
    const cheers = Math.round(scale * 6 * p * rand());
    const avgConcerts = Math.round(rand() * 50) / 10;
    return {
      artistId: artist.id,
      songRankPoints: failed("melon") ? 0 : songPts,
      bestSongRank: failed("melon") || ranks.length === 0 ? null : Math.min(...ranks),
      chartSongs: failed("melon") ? 0 : ranks.length,
      likeGain: failed("melon") ? null : likeGain,
      fanGain: failed("melon") ? null : fanGain,
      followerGain: failed("spotify") ? null : followerGain,
      cheers,
      validConcerts: period === "daily" ? countValidConcerts(artist.id, db) : avgConcerts,
    };
  });
}

function buildRanking(db: DB, period: Period, metrics: PeriodMetrics[]) {
  const maxCheers = Math.max(0, ...metrics.map((m) => m.cheers));
  const basis = db.scoreConfig.basis[period];
  const scored = metrics.map((m) => ({
    m,
    artist: getArtist(m.artistId, db)!,
    score: computeScore(m, basis, maxCheers),
  }));
  return rankWithTies(scored, (s) => s.score.total, (s) => s.artist.name);
}

export function getChart(period: Period, db: DB): Chart {
  // 차트 대상: 활성 + 최초 데이터 수집 완료
  const eligible = db.artists.filter((a) => a.status === "active" && a.collected);
  const { label } = periodLabels(period);
  const live = getMetricsSource(db) === "live";

  let current, prev;
  let comparable = true;
  if (live) {
    current = buildRanking(db, period, liveMetrics(db, eligible, periodWindow(period, 0)));
    const prevWindow = periodWindow(period, -1);
    // 비교 기간에 수집·입력된 데이터가 없으면 순위 변동을 표시하지 않는다
    comparable = windowHasData(db, prevWindow);
    prev = comparable ? buildRanking(db, period, liveMetrics(db, eligible, prevWindow)) : [];
  } else {
    const prevEligible = eligible.filter((a) => a.seq <= 30 && !NEW_ARTISTS[period].includes(a.id));
    current = buildRanking(db, period, generateMetrics(db, period, SEED_BASE[period], eligible));
    prev = buildRanking(db, period, generateMetrics(db, period, SEED_BASE[period] + 100, prevEligible));
  }
  const prevRankMap = new Map(prev.map((p) => [p.item.artist.id, p.rank]));
  const entries: ChartEntry[] = current.map(({ item, rank }) => ({
    rank,
    prevRank: prevRankMap.get(item.artist.id) ?? null,
    artist: item.artist,
    metrics: item.m,
    score: item.score,
  }));
  return { period, label, updatedAt: chartUpdatedAt(db, live), comparable, entries };
}

/** 마지막 수집 시각 (KST, 화면 표기용) */
function chartUpdatedAt(db: DB, live: boolean) {
  if (!live) return `${serviceToday().replaceAll("-", ".")} 01:00`;
  const times = [
    ...db.melonCharts.map((c) => c.collectedAt),
    ...db.metricSnapshots.map((m) => m.updatedAt),
  ].sort();
  const last = times.at(-1);
  if (!last) return "아직 수집 전";
  const kst = new Date(new Date(last).getTime() + 9 * 3600_000).toISOString();
  return `${kst.slice(0, 10).replaceAll("-", ".")} ${kst.slice(11, 16)}`;
}

/** 시드 시점에 직전 완료 월(10월) 월간 TOP 3를 확정해 둔다 */
onSeed((db) => {
  const chart = getChart("monthly", db);
  db.monthlyTop3.unshift({
    month: lastServiceMonth(),
    confirmedAt: "2026-11-01T17:00:00.000Z",
    entries: chart.entries
      .filter((e) => e.rank <= 3)
      .map((e) => ({ artistId: e.artist.id, rank: e.rank, total: Math.round(e.score.total * 100) / 100 })),
  });
});

/** 월간 최종 종합 TOP 3 (가장 최근 확정 결과) */
export function getMonthlyTop3(db: DB) {
  const latest = [...db.monthlyTop3].sort((a, b) => b.month.localeCompare(a.month))[0];
  if (!latest) return { month: null, entries: [] };
  return {
    month: monthLabel(latest.month),
    entries: latest.entries
      .map((e) => ({ ...e, artist: getArtist(e.artistId, db) }))
      .filter((e): e is typeof e & { artist: Artist } => !!e.artist),
  };
}

/* ---------------- 응원 ---------------- */

/** 이번 달 아티스트별 누적 유효 응원 횟수 */
export function getMonthlyCheerCounts(db: DB, month = serviceMonth()) {
  const counts: Record<string, number> = month === serviceMonth() ? { ...db.cheerBase } : {};
  for (const r of db.cheerRecords) {
    if (r.valid && r.date.startsWith(month)) counts[r.artistId] = (counts[r.artistId] ?? 0) + 1;
  }
  return counts;
}

export function rankCheers(counts: Record<string, number>, artists: Artist[]): CheerRankEntry[] {
  const list = artists.map((artist) => ({ artist, count: counts[artist.id] ?? 0 })).filter((e) => e.count > 0);
  return rankWithTies(list, (e) => e.count, (e) => e.artist.name).map(({ item, rank }) => ({
    rank,
    artist: item.artist,
    count: item.count,
  }));
}

export function getCheerData(db: DB) {
  const last = [...db.cheerTop3].sort((a, b) => b.month.localeCompare(a.month))[0];
  return {
    month: monthLabel(serviceMonth()),
    lastMonth: last ? monthLabel(last.month) : null,
    current: getMonthlyCheerCounts(db),
    lastMonthTop3: last
      ? last.entries
          .map((e) => ({ rank: e.rank, count: e.count, artist: getArtist(e.artistId, db)! }))
          .filter((e) => e.artist)
      : [],
  };
}

/* ---------------- 아티스트 상세 ---------------- */

export function getArtistSnapshot(artistId: string, db: DB): ArtistSnapshot {
  const artist = getArtist(artistId, db)!;
  const daily = getChart("daily", db).entries.find((e) => e.artist.id === artistId);
  if (!artist.collected) {
    return {
      artistId,
      melonLikes: null,
      melonLikesGain: null,
      melonFans: null,
      melonFansGain: null,
      spotifyFollowers: null,
      spotifyFollowersGain: null,
      melonChartSongs: [],
    };
  }
  if (getMetricsSource(db) === "live") {
    const today = serviceToday();
    return {
      artistId,
      melonLikes: latestValue(db, artistId, "melonLikes", today),
      melonLikesGain: daily?.metrics.likeGain ?? null,
      melonFans: latestValue(db, artistId, "melonFans", today),
      melonFansGain: daily?.metrics.fanGain ?? null,
      spotifyFollowers: latestValue(db, artistId, "spotifyFollowers", today),
      spotifyFollowersGain: daily?.metrics.followerGain ?? null,
      melonChartSongs: liveChartSongs(db, artist),
    };
  }
  const p = popularityOf(artist.seq);
  const rand = mulberry32(500 + artist.seq);
  const songs = ["여름의 끝", "밤 산책", "편지", "파도", "작은 위로", "안녕, 겨울"];
  const chartSongs = Math.max(0, Math.floor(p * 5 - rand() * 2));
  const melonLikes = Math.round(20000 + p * 180000 * (0.5 + rand()));
  const melonFans = Math.round(3000 + p * 60000 * (0.5 + rand()));
  const followers = Math.round(1000 + p * 40000 * (0.5 + rand()));
  const failures = getOpenFailures(db).filter((f) => f.artistId === artistId);
  const melonFailed = failures.some((f) => f.platform === "melon");
  const spotifyFailed = failures.some((f) => f.platform === "spotify");
  return {
    artistId,
    melonLikes: melonFailed ? null : melonLikes,
    melonLikesGain: daily?.metrics.likeGain ?? null,
    melonFans: melonFailed ? null : melonFans,
    melonFansGain: daily?.metrics.fanGain ?? null,
    spotifyFollowers: spotifyFailed ? null : followers,
    spotifyFollowersGain: daily?.metrics.followerGain ?? null,
    melonChartSongs: songs.slice(0, chartSongs).map((title, k) => ({
      title,
      rank: Math.min(100, 1 + Math.floor((1 - p) * 60 + k * 9 + rand() * 10)),
    })),
  };
}

export function getArtistRanks(artistId: string, db: DB) {
  return (["daily", "weekly", "monthly", "yearly"] as Period[]).map((period) => {
    const chart = getChart(period, db);
    const e = chart.entries.find((x) => x.artist.id === artistId);
    return { period, rank: e?.rank ?? null, prevRank: e?.prevRank ?? null, comparable: chart.comparable };
  });
}
