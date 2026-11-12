import type { FullScoreBasis, Period, PeriodMetrics, ScoreBreakdown } from "./types";

/** 기본 점수 가중치 (1안: 멜론 + Spotify) */
export const WEIGHTS = {
  melonRank: 0.1,
  melonLikes: 0.36,
  melonFans: 0.22,
  spotifyFollowers: 0.22,
  cheer: 0.1,
} as const;

export const CONCERT_POINT = 4;
export const CONCERT_MAX_COUNT = 5;
export const CONCERT_WINDOW_DAYS = 30;

/**
 * 지표별 100점 기준 증가량 기본값 (관리자 점수 관리에서 변경 가능).
 * 일간은 기획 임시 기준(100), 주/월/연간은 데이터 분석 전 임시값.
 */
export const DEFAULT_FULL_SCORE_BASIS: Record<Period, FullScoreBasis> = {
  daily: { likes: 100, fans: 100, followers: 100 },
  weekly: { likes: 500, fans: 500, followers: 500 },
  monthly: { likes: 2000, fans: 2000, followers: 2000 },
  yearly: { likes: 20000, fans: 20000, followers: 20000 },
};

/** 곡별 순위 점수 = 101 - 순위, 상위 5곡 합계 / 5 → 0~100 */
export function songRankPoints(ranks: number[]): number {
  const top5 = ranks
    .filter((r) => r >= 1 && r <= 100)
    .sort((a, b) => a - b)
    .slice(0, 5);
  return top5.reduce((sum, r) => sum + (101 - r), 0) / 5;
}

/** 증가량 → 0~100 환산 (0 이하 0점, 최대 100점) */
export function normalizeGain(gain: number | null, basis: number): number {
  if (gain == null || gain <= 0) return 0;
  return Math.min(100, (gain / basis) * 100);
}

/** 응원 상대평가 환산 (기간 최다 응원 = 100) */
export function cheerPoints(cheers: number, maxCheers: number): number {
  if (maxCheers <= 0 || cheers <= 0) return 0;
  return (cheers / maxCheers) * 100;
}

/** 공연 가점 = 유효 공연 수 x 4 (최대 20) */
export function concertBonus(validConcerts: number): number {
  return Math.min(CONCERT_MAX_COUNT * CONCERT_POINT, validConcerts * CONCERT_POINT);
}

export function computeScore(m: PeriodMetrics, basis: FullScoreBasis, maxCheers: number): ScoreBreakdown {
  const melonRank = m.songRankPoints * WEIGHTS.melonRank;
  const melonLikes = normalizeGain(m.likeGain, basis.likes) * WEIGHTS.melonLikes;
  const melonFans = normalizeGain(m.fanGain, basis.fans) * WEIGHTS.melonFans;
  const spotifyFollowers = normalizeGain(m.followerGain, basis.followers) * WEIGHTS.spotifyFollowers;
  const cheer = cheerPoints(m.cheers, maxCheers) * WEIGHTS.cheer;
  const base = melonRank + melonLikes + melonFans + spotifyFollowers + cheer;
  const bonus = concertBonus(m.validConcerts);
  return {
    melonRank,
    melonLikes,
    melonFans,
    spotifyFollowers,
    cheer,
    base,
    concertBonus: bonus,
    total: base + bonus,
  };
}

/**
 * 공동 순위 처리 (1, 2, 2, 4 ...). 동점은 이름 가나다순으로 표시.
 */
export function rankWithTies<T>(
  items: T[],
  value: (item: T) => number,
  name: (item: T) => string,
): { item: T; rank: number }[] {
  const sorted = [...items].sort((a, b) => {
    const diff = value(b) - value(a);
    if (diff !== 0) return diff;
    return name(a).localeCompare(name(b), "ko");
  });
  let prevValue: number | null = null;
  let prevRank = 0;
  return sorted.map((item, i) => {
    const v = value(item);
    const rank = prevValue !== null && v === prevValue ? prevRank : i + 1;
    prevValue = v;
    prevRank = rank;
    return { item, rank };
  });
}

/** 공연이 기준일에 유효한지: 승인 + 기준일 ~ 30일 이내 (공연 당일 포함) */
export function isConcertValid(
  c: { status: string; date: string },
  asOf: string,
): boolean {
  if (c.status !== "approved") return false;
  const diff = daysBetween(asOf, c.date);
  return diff >= 0 && diff <= CONCERT_WINDOW_DAYS;
}

export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}
