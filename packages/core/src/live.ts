/**
 * 실제 수치(live) 모드의 기간 집계.
 * - 곡 순위: 멜론 인디 일간 차트 수집 결과 (기간 내 일별 점수의 평균)
 * - 좋아요·팬·팔로워: 관리자가 입력한 일자별 수치의 기간 증가량
 *   (기간 마지막 날 값 − 기간 시작 전날 값, 둘 중 하나라도 없으면 미수집)
 * - 응원·공연: 저장소 기록
 */
import { addDays, serviceToday } from "./constants";
import { isConcertValid, songRankPoints } from "./score";
import type { DB } from "./seed";
import type { Artist, MetricSnapshot, Period, PeriodMetrics } from "./types";

export interface PeriodWindow {
  start: string;
  end: string;
  label: string;
}

const dot = (d: string) => d.replaceAll("-", ".");

/**
 * 집계 기간. offset 0 = 가장 최근 완료 기간, -1 = 그 이전 기간
 * 일간: 어제 / 주간: 지난주 월~일 / 월간: 지난달 / 연간: 작년
 */
export function periodWindow(period: Period, offset = 0, today = serviceToday()): PeriodWindow {
  if (period === "daily") {
    const d = addDays(today, -1 + offset);
    return { start: d, end: d, label: dot(d) };
  }
  if (period === "weekly") {
    const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 월=0
    const end = addDays(today, -dow - 1 + offset * 7);
    const start = addDays(end, -6);
    return { start, end, label: `${dot(start)} – ${end.slice(5).replace("-", ".")}` };
  }
  if (period === "monthly") {
    const [y, m] = today.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 2 + offset, 1));
    const last = new Date(Date.UTC(y, m - 1 + offset, 0));
    const start = first.toISOString().slice(0, 10);
    return { start, end: last.toISOString().slice(0, 10), label: dot(start.slice(0, 7)) };
  }
  const year = Number(today.slice(0, 4)) - 1 + offset;
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: String(year) };
}

function eachDay(w: PeriodWindow) {
  const days: string[] = [];
  for (let d = w.start; d <= w.end; d = addDays(d, 1)) days.push(d);
  return days;
}

type MetricKey = "melonFans" | "melonLikes" | "spotifyFollowers" | "spotifyMonthlyListeners";

/** 해당 날짜까지 입력된 가장 최근 값 */
export function latestValue(db: DB, artistId: string, key: MetricKey, onOrBefore: string): number | null {
  let best: MetricSnapshot | undefined;
  for (const s of db.metricSnapshots) {
    if (s.artistId !== artistId || s.date > onOrBefore || s[key] == null) continue;
    if (!best || s.date > best.date) best = s;
  }
  return best?.[key] ?? null;
}

/** 기간 증가량. 기간 마지막 날 값 − 시작 전날 값 */
function gain(db: DB, artistId: string, key: MetricKey, w: PeriodWindow) {
  const end = latestValue(db, artistId, key, w.end);
  const before = latestValue(db, artistId, key, addDays(w.start, -1));
  if (end == null || before == null) return null;
  return Math.max(0, end - before);
}

/** 기간 안에 수집·입력된 데이터가 하나라도 있는지 */
export function windowHasData(db: DB, w: PeriodWindow) {
  return (
    db.melonCharts.some((c) => c.chartDate >= w.start && c.chartDate <= w.end) ||
    db.metricSnapshots.some((s) => s.date >= w.start && s.date <= w.end)
  );
}

export function liveMetrics(db: DB, artists: Artist[], w: PeriodWindow): PeriodMetrics[] {
  const days = eachDay(w);
  const charts = db.melonCharts.filter((c) => c.chartDate >= w.start && c.chartDate <= w.end);
  return artists.map((artist) => {
    const melonId = artist.platformIds.melon;
    // 일별 곡 순위 점수의 평균 (차트를 수집한 날 기준)
    const mine = charts.map((c) => (melonId ? c.entries.filter((e) => e.artists.some((a) => a.melonId === melonId)) : []));
    const daily = mine.map((entries) => songRankPoints(entries.map((e) => e.rank)));
    const ranks = mine.flat().map((e) => e.rank);
    const cheers = db.cheerRecords.filter((r) => r.valid && r.artistId === artist.id && r.date >= w.start && r.date <= w.end).length;
    const concerts = db.concerts.filter((c) => c.artistId === artist.id);
    const validConcerts =
      days.reduce((sum, d) => sum + concerts.filter((c) => isConcertValid(c, d)).length, 0) / days.length;
    return {
      artistId: artist.id,
      songRankPoints: daily.length ? daily.reduce((a, b) => a + b, 0) / daily.length : 0,
      bestSongRank: ranks.length ? Math.min(...ranks) : null,
      chartSongs: new Set(mine.flat().map((e) => e.songId)).size,
      likeGain: gain(db, artist.id, "melonLikes", w),
      fanGain: gain(db, artist.id, "melonFans", w),
      followerGain: gain(db, artist.id, "spotifyFollowers", w),
      cheers,
      validConcerts: Math.round(validConcerts * 10) / 10,
    };
  });
}

/** 가장 최근 수집한 멜론 인디 차트에 오른 이 아티스트의 곡 */
export function liveChartSongs(db: DB, artist: Artist) {
  const melonId = artist.platformIds.melon;
  const latest = [...db.melonCharts].sort((a, b) => b.chartDate.localeCompare(a.chartDate))[0];
  if (!latest || !melonId) return [];
  return latest.entries.filter((e) => e.artists.some((a) => a.melonId === melonId)).map((e) => ({ title: e.title, rank: e.rank }));
}
