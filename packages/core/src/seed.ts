/**
 * 목업 초기 데이터. 백엔드/크롤러 연동 전까지 로컬 JSON 저장소의 시드로 사용.
 */
import { DEFAULT_FULL_SCORE_BASIS } from "./score";
import { serviceToday } from "./constants";
import { SEED_ARTISTS } from "./seed-artists";
import type {
  Artist,
  ArtistReport,
  CheerRecord,
  CheerTop3Result,
  CollectionRun,
  Concert,
  MonthlyTop3Result,
  Period,
  FullScoreBasis,
  BasisChange,
  User,
  MetricSnapshot,
  MelonChartSnapshot,
  MelonSongCache,
  MetricsSource,
} from "./types";

export interface DB {
  version: 1;
  artists: Artist[];
  concerts: Concert[];
  artistReports: ArtistReport[];
  /** 이번 달 기존 누적 응원 (개별 기록 외 집계분) */
  cheerBase: Record<string, number>;
  cheerRecords: CheerRecord[];
  /** 회원 */
  users: User[];
  /** 아티스트별 일자 수치 (관리자 입력) */
  metricSnapshots: MetricSnapshot[];
  /** 멜론 인디 일간 차트 수집 결과 */
  melonCharts: MelonChartSnapshot[];
  /** 멜론 아티스트 ID → 발매곡 ID 목록 */
  melonSongCache: Record<string, MelonSongCache>;
  settings: { metricsSource: MetricsSource };
  scoreConfig: { basis: Record<Period, FullScoreBasis>; history: BasisChange[] };
  collectionRuns: CollectionRun[];
  monthlyTop3: MonthlyTop3Result[];
  cheerTop3: CheerTop3Result[];
}


export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function fakeSpotifyId(rand: () => number) {
  return Array.from({ length: 22 }, () => B62[Math.floor(rand() * 62)]).join("");
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 시드 아티스트 인기도 (목업 지표 생성용) */
export function popularityOf(seq: number) {
  return Math.max(0.08, 1 - (seq - 1) / 36);
}

const VENUES = ["롤링홀", "웨스트브릿지", "벨로주 홍대", "언플러그드 홍대", "제비다방", "KT&G 상상마당 라이브홀", "프리즘홀", "클럽 FF"];

export function createSeed(): DB {
  const idRand = mulberry32(7);
  const artists: Artist[] = SEED_ARTISTS.map(({ name, nameEn, genre, spotify, melon, image }, i) => ({
    id: `a${String(i + 1).padStart(3, "0")}`,
    seq: i + 1,
    name,
    nameEn,
    genre,
    image,
    imageSource: image ? ("spotify" as const) : undefined,
    imageUpdatedAt: image ? "2026-11-11T00:00:00.000Z" : undefined,
    platformIds: melon ? { spotify, melon } : { spotify },
    status: "active",
    collected: true,
    createdAt: "2026-08-01T00:00:00.000Z",
  }));

  // 공연
  const concertRand = mulberry32(42);
  const concerts: Concert[] = [];
  artists.forEach((a, i) => {
    if (i % 7 === 6) return; // 공연 정보 없는 아티스트 (빈 상태 확인용)
    const count = Math.floor(concertRand() * 5) + (i < 3 ? 3 : 0);
    for (let k = 0; k < count; k++) {
      const offset = Math.floor(concertRand() * 60) - 10;
      concerts.push({
        id: `c${a.id}-${k}`,
        artistId: a.id,
        title:
          k % 2 === 0
            ? `${a.name} 단독 공연 〈${["밤", "숲", "바다", "도시", "계절"][k % 5]}〉`
            : `인디 라이브 클럽 데이 Vol.${12 + k}`,
        date: addDays(serviceToday(), offset),
        time: ["19:00", "19:30", "20:00", "18:00"][k % 4],
        venue: VENUES[Math.floor(concertRand() * VENUES.length)],
        address: "서울 마포구",
        url: "https://tickets.example.com/indie",
        status: k === 3 && i % 4 === 0 ? "canceled" : "approved",
        source: k % 3 === 0 ? "admin" : "report",
        createdAt: `${addDays(serviceToday(), -20 + k)}T03:00:00.000Z`,
        reviewedAt: `${addDays(serviceToday(), -19 + k)}T03:00:00.000Z`,
      });
    }
  });
  // 승인 대기 중인 공연 제보
  concerts.push(
    {
      id: "c-pending-1",
      artistId: "a005",
      title: "낮잠 클럽 연말 공연 〈늦잠〉",
      date: addDays(serviceToday(), 18),
      time: "19:00",
      venue: "롤링홀",
      address: "서울 마포구 어울마당로 35",
      url: "https://tickets.example.com/napclub",
      description: "2회차 공연 중 1회차",
      status: "pending",
      source: "report",
      createdAt: `${addDays(serviceToday(), -1)}T09:12:00.000Z`,
    },
    {
      id: "c-pending-2",
      artistId: "a007",
      title: "유리상점 단독 공연",
      date: addDays(serviceToday(), 45),
      venue: "벨로주 홍대",
      url: "https://tickets.example.com/glassstore",
      status: "pending",
      source: "report",
      createdAt: `${serviceToday()}T00:40:00.000Z`,
    },
  );
  // 기존 승인 공연과 중복으로 보이는 제보
  const dupTarget = concerts.find((c) => c.artistId === "a001" && c.status === "approved" && c.date >= serviceToday());
  if (dupTarget) {
    concerts.push({
      ...dupTarget,
      id: "c-pending-dup",
      title: `${dupTarget.title} (중복 제보)`,
      status: "pending",
      source: "report",
      createdAt: `${serviceToday()}T01:30:00.000Z`,
      reviewedAt: undefined,
    });
  }

  const artistReports: ArtistReport[] = [
    {
      id: "r001",
      name: "검은 바다",
      spotifyId: fakeSpotifyId(idRand),
      melonId: "2201394",
      createdAt: `${addDays(serviceToday(), -2)}T05:20:00.000Z`,
      status: "pending",
    },
    {
      id: "r002",
      name: "여름 정거장",
      spotifyId: fakeSpotifyId(idRand),
      youtube: "@summerstation",
      createdAt: `${addDays(serviceToday(), -1)}T11:02:00.000Z`,
      status: "pending",
    },
    {
      id: "r003",
      name: artists[0].nameEn, // 등록된 아티스트를 영문명으로 다시 제보한 경우
      spotifyId: artists[0].platformIds.spotify, // 등록된 아티스트와 Spotify ID 중복
      createdAt: `${serviceToday()}T00:15:00.000Z`,
      status: "pending",
    },
    {
      id: "r004",
      name: "블루노트",
      spotifyId: fakeSpotifyId(idRand),
      createdAt: `${addDays(serviceToday(), -6)}T08:00:00.000Z`,
      status: "rejected",
      reviewedAt: `${addDays(serviceToday(), -5)}T02:00:00.000Z`,
      rejectReason: "해외 아티스트 (서비스 대상 아님)",
    },
  ];

  // 응원
  const cheerRand = mulberry32(99);
  const cheerBase: Record<string, number> = Object.fromEntries(
    artists.map((a) => [a.id, Math.max(0, Math.round(popularityOf(a.seq) * 170 * (0.3 + cheerRand()) - 20))]),
  );
  const cheerRecords: CheerRecord[] = [];
  for (let d = 0; d < 3; d++) {
    const date = addDays(serviceToday(), -d);
    for (let k = 0; k < 8; k++) {
      const a = artists[Math.floor(cheerRand() * 12)];
      cheerRecords.push({
        id: `ch-${date}-${k}`,
        userId: `u${1000 + Math.floor(cheerRand() * 900)}`,
        artistId: a.id,
        date,
        createdAt: `${date}T${String(k * 2).padStart(2, "0")}:2${k}:00.000Z`,
        valid: true,
      });
    }
  }
  // 부정 응원 의심 (짧은 시간 다계정 응원)
  for (let k = 0; k < 4; k++) {
    cheerRecords.push({
      id: `ch-flag-${k}`,
      userId: `u90${k}`,
      artistId: "a013",
      date: serviceToday(),
      createdAt: `${serviceToday()}T00:0${k}:1${k}.000Z`,
      valid: true,
      flag: "동일 기기에서 1분 내 다계정 응원",
    });
  }

  // 데이터 수집 이력 (최근 7일)
  const collectionRuns: CollectionRun[] = Array.from({ length: 7 }, (_, d) => {
    const date = addDays(serviceToday(), -d);
    const failures =
      d === 0
        ? [{ artistId: "a017", platform: "spotify" as const, reason: "API 응답 시간 초과 (429 Too Many Requests)", resolved: false }]
        : d === 3
          ? [{ artistId: "a022", platform: "melon" as const, reason: "곡 목록 파싱 실패", resolved: true }]
          : [];
    return {
      id: `run-${date}`,
      date,
      startedAt: `${addDays(date, -1)}T16:00:00.000Z`,
      finishedAt: `${addDays(date, -1)}T16:${String(12 + d).padStart(2, "0")}:00.000Z`,
      status: failures.some((f) => !f.resolved) ? "partial" : "success",
      artistCount: artists.length,
      failures,
    };
  });

  const monthlyTop3: MonthlyTop3Result[] = [
    {
      month: "2026-09",
      confirmedAt: "2026-10-01T17:00:00.000Z",
      entries: [
        { artistId: "a001", rank: 1, total: 82.4 },
        { artistId: "a003", rank: 2, total: 79.1 },
        { artistId: "a002", rank: 3, total: 77.9 },
      ],
    },
  ];

  const cheerTop3: CheerTop3Result[] = [
    {
      month: "2026-10",
      confirmedAt: "2026-11-01T15:10:00.000Z",
      entries: [
        { artistId: "a004", rank: 1, count: 412 },
        { artistId: "a001", rank: 2, count: 388 },
        { artistId: "a009", rank: 3, count: 301 },
        { artistId: "a012", rank: 3, count: 301 },
      ],
    },
    {
      month: "2026-09",
      confirmedAt: "2026-10-01T15:05:00.000Z",
      entries: [
        { artistId: "a002", rank: 1, count: 356 },
        { artistId: "a001", rank: 2, count: 340 },
        { artistId: "a006", rank: 3, count: 298 },
      ],
    },
  ];

  return {
    version: 1,
    artists,
    concerts,
    artistReports,
    cheerBase,
    cheerRecords,
    users: [],
    metricSnapshots: [],
    melonCharts: [],
    melonSongCache: {},
    settings: { metricsSource: "mock" },
    scoreConfig: {
      basis: structuredClone(DEFAULT_FULL_SCORE_BASIS),
      history: [
        {
          at: "2026-08-01T00:00:00.000Z",
          period: "daily",
          before: { likes: 0, fans: 0, followers: 0 },
          after: { likes: 100, fans: 100, followers: 100 },
          note: "초기 임시 기준 설정",
        },
      ],
    },
    collectionRuns,
    monthlyTop3,
    cheerTop3,
  };
}
