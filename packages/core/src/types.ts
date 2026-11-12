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
  /** 제보한 회원 */
  reporterId?: string;
  createdAt: string;
  reviewedAt?: string;
  rejectReason?: string;
}

/** 집계 기간 동안의 원천 지표 (아티스트 1팀 기준) */
export interface PeriodMetrics {
  artistId: string;
  /** 멜론 곡 순위 점수 (0~100, 상위 5곡 기준, 기간 일별 평균) */
  songRankPoints: number;
  /** 기간 중 멜론 인디 차트 최고 순위 (차트인 곡이 없으면 null) */
  bestSongRank?: number | null;
  /** 기간 중 차트에 오른 곡 수 */
  chartSongs?: number;
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
  /** 비교 기간 데이터가 있어 순위 변동(▲▼·NEW)을 표시할 수 있는지 */
  comparable: boolean;
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
  /** 제보한 회원 */
  reporterId?: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  reviewedAt?: string;
  rejectReason?: string;
}

/** 회원 (이메일 회원가입) */
export interface User {
  id: string;
  /** 소문자로 정규화한 로그인 이메일 */
  email: string;
  nickname: string;
  /** scrypt 해시 (auth.ts의 hashPassword) */
  passwordHash: string;
  createdAt: string;
}

/** 화면에 내려 보내는 회원 정보 (비밀번호 해시 제외) */
export type PublicUser = Pick<User, "id" | "email" | "nickname">;

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
  status: "success" | "partial" | "failed";
  artistCount: number;
  failures: CollectionFailure[];
  manual?: boolean;
  /** mock: 목업 수집 / melon-chart: 멜론 인디 차트 실제 수집 */
  kind?: "mock" | "melon-chart" | "artist-metrics";
  /** 수집 전체가 실패했을 때 사유 */
  error?: string;
  /** 실제 수집 결과 요약 */
  note?: string;
}

/** 차트 수치 출처: mock = 시드로 만든 샘플 수치, live = 실제 수집·입력한 수치 */
export type MetricsSource = "mock" | "live";

/** 아티스트별 일자 수치 (자동 수집, 관리자 입력 또는 CSV 업로드). 값이 없는 항목은 미입력 */
export interface MetricSnapshot {
  artistId: string;
  /** 기준일 YYYY-MM-DD (KST) */
  date: string;
  melonFans?: number;
  /** 멜론 전체 곡 좋아요 합계 */
  melonLikes?: number;
  spotifyFollowers?: number;
  /** Spotify 월별 리스너 (점수에는 쓰지 않고 참고용) */
  spotifyMonthlyListeners?: number;
  /** 마지막으로 값을 넣은 방법. auto = 자동 수집 */
  source: "manual" | "csv" | "auto";
  updatedAt: string;
}

/** 아티스트의 멜론 발매곡 ID 목록 캐시 (곡 목록은 자주 바뀌지 않아 주기적으로만 새로 받는다) */
export interface MelonSongCache {
  songIds: string[];
  fetchedAt: string;
}

/** 멜론 인디 일간 차트 수집 결과 */
export interface MelonChartSnapshot {
  /** 멜론이 표기한 차트 기준일 YYYY-MM-DD */
  chartDate: string;
  collectedAt: string;
  /** auto: 수집기 / manual: 관리자 입력 */
  source?: "auto" | "manual";
  entries: MelonChartEntry[];
}

export interface MelonChartEntry {
  rank: number;
  songId: string;
  title: string;
  artists: { melonId: string; name: string }[];
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
