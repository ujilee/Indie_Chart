export type Period = "daily" | "weekly" | "monthly" | "yearly";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "daily", label: "일간" },
  { key: "weekly", label: "주간" },
  { key: "monthly", label: "월간" },
  { key: "yearly", label: "연간" },
];

export interface PlatformIds {
  spotify: string;
  melon?: string;
  youtube?: string;
  appleMusic?: string;
}

export interface Artist {
  id: string;
  name: string;
  nameEn: string;
  genre: string;
  image?: string;
  /** spotify: Spotify에서 자동으로 가져옴 / manual: 관리자가 직접 입력 (자동 갱신 안 함) */
  imageSource?: "spotify" | "manual";
  imageUpdatedAt?: string;
  platformIds: PlatformIds;
  status: ArtistStatus;
  /** 최초 데이터 수집 완료 여부 (수집 전에는 차트 산정 보류) */
  collected: boolean;
  createdAt: string;
  /** 시드 아티스트 순번 (목업 지표 생성용) */
  seq: number;
}

export type ArtistStatus = "active" | "excluded";

export type ConcertStatus = "approved" | "pending" | "rejected" | "canceled";

export interface Concert {
  id: string;
  artistId: string;
  title: string;
  date: string; // YYYY-MM-DD (KST)
  time?: string; // HH:mm
  venue: string;
  address?: string;
  url: string;
  description?: string;
  poster?: string;
  status: ConcertStatus;
  source: "admin" | "report";
  createdAt: string;
  reviewedAt?: string;
  rejectReason?: string;
}

/** 집계 기간 동안의 원천 지표 (아티스트 1팀 기준) */
export interface PeriodMetrics {
  artistId: string;
  /** 멜론 곡 순위 점수 (0~100, 상위 5곡 기준, 기간 일별 평균) */
  songRankPoints: number;
  /** 멜론 전체 곡 좋아요 증가량 (null = 미수집) */
  likeGain: number | null;
  /** 멜론 팬맺기 증가량 */
  fanGain: number | null;
  /** Spotify 팔로워 증가량 */
  followerGain: number | null;
  /** 기간 유효 응원 횟수 */
  cheers: number;
  /** 기간 일별 유효 공연 수 평균 */
  validConcerts: number;
}

export interface ScoreBreakdown {
  melonRank: number;
  melonLikes: number;
  melonFans: number;
  spotifyFollowers: number;
  cheer: number;
  base: number;
  concertBonus: number;
  total: number;
}

export interface ChartEntry {
  rank: number;
  prevRank: number | null;
  artist: Artist;
  metrics: PeriodMetrics;
  score: ScoreBreakdown;
}

export interface Chart {
  period: Period;
  /** 화면 표기용 집계 기간 라벨 */
  label: string;
  updatedAt: string;
  entries: ChartEntry[];
}

export interface CheerRankEntry {
  rank: number;
  artist: Artist;
  count: number;
}

export interface ArtistSnapshot {
  artistId: string;
  melonLikes: number | null;
  melonLikesGain: number | null;
  melonFans: number | null;
  melonFansGain: number | null;
  spotifyFollowers: number | null;
  spotifyFollowersGain: number | null;
  melonChartSongs: { title: string; rank: number }[];
}

export interface ArtistReport {
  id: string;
  name: string;
  spotifyId: string;
  melonId?: string;
  youtube?: string;
  appleMusic?: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  reviewedAt?: string;
  rejectReason?: string;
}

export interface CheerRecord {
  id: string;
  userId: string;
  artistId: string;
  /** 응원 일자 (KST) */
  date: string;
  createdAt: string;
  valid: boolean;
  /** 부정 응원 의심 사유 */
  flag?: string;
  invalidatedAt?: string;
}

export interface FullScoreBasis {
  likes: number;
  fans: number;
  followers: number;
}

export interface BasisChange {
  at: string;
  period: Period;
  before: FullScoreBasis;
  after: FullScoreBasis;
  note?: string;
}

export type Platform = "melon" | "spotify";

export interface CollectionFailure {
  artistId: string;
  platform: Platform;
  reason: string;
  resolved: boolean;
}

export interface CollectionRun {
  id: string;
  date: string;
  startedAt: string;
  finishedAt: string;
  status: "success" | "partial";
  artistCount: number;
  failures: CollectionFailure[];
  manual?: boolean;
}

export interface MonthlyTop3Result {
  /** YYYY-MM */
  month: string;
  confirmedAt: string;
  entries: { artistId: string; rank: number; total: number }[];
}

export interface CheerTop3Result {
  month: string;
  confirmedAt: string;
  entries: { artistId: string; rank: number; count: number }[];
}
