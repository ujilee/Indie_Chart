/**
 * Supabase 운영 DB 저장소 (서버 전용). 스키마: supabase/migrations/0001_init.sql
 *
 * 앱 코드는 지금까지처럼 DB 객체를 읽고(readDb) 고친다(mutate).
 * 이 파일이 그 객체를 테이블 행으로 바꿔 읽고, 바뀐 행만 upsert / delete 한다.
 * 데모 데이터는 넣지 않는다. 테이블이 비어 있으면 빈 화면(미수집)으로 보인다.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_FULL_SCORE_BASIS } from "./score";
import type { DB } from "./seed";
import type {
  Artist,
  ArtistReport,
  BasisChange,
  CheerRecord,
  CheerTop3Result,
  CollectionRun,
  Concert,
  FullScoreBasis,
  MelonChartSnapshot,
  MelonSongCache,
  MetricSnapshot,
  MonthlyTop3Result,
  Period,
  User,
} from "./types";

type Row = Record<string, unknown>;

let admin: SupabaseClient | null = null;

/** 서버 전용 관리 클라이언트 (Secret 키, RLS를 거치지 않는다) */
export function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았어요.");
  admin ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return admin;
}

/* ───────── 값 변환 도우미 ───────── */

const u = <T>(v: T | null | undefined) => (v == null ? undefined : v);
const n = <T>(v: T | undefined | null | "") => (v === undefined || v === "" ? null : v);
const num = (v: unknown) => (v == null ? undefined : Number(v));

/* ───────── 테이블 ↔ 객체 ───────── */

const artistFrom = (r: Row, i: number): Artist => ({
  id: r.id as string,
  name: r.name as string,
  nameEn: (r.name_en as string) ?? "",
  genre: (r.genre as string) ?? "",
  image: u(r.image_url as string),
  imageSource: u(r.image_source as Artist["imageSource"]),
  imageUpdatedAt: u(r.image_updated_at as string),
  platformIds: {
    spotify: (r.spotify_id as string) ?? "",
    melon: u(r.melon_id as string),
    youtube: u(r.youtube as string),
    appleMusic: u(r.apple_music_id as string),
  },
  status: r.status as Artist["status"],
  collected: Boolean(r.collected),
  createdAt: r.created_at as string,
  seq: i + 1,
});
const artistTo = (a: Artist): Row => ({
  id: a.id,
  name: a.name,
  name_en: a.nameEn ?? "",
  genre: a.genre ?? "",
  image_url: n(a.image),
  image_source: n(a.imageSource),
  image_updated_at: n(a.imageUpdatedAt),
  spotify_id: n(a.platformIds.spotify),
  melon_id: n(a.platformIds.melon),
  youtube: n(a.platformIds.youtube),
  apple_music_id: n(a.platformIds.appleMusic),
  status: a.status,
  collected: a.collected,
  created_at: a.createdAt,
});

const concertFrom = (r: Row): Concert => ({
  id: r.id as string,
  artistId: r.artist_id as string,
  title: r.title as string,
  date: r.date as string,
  time: r.time ? (r.time as string).slice(0, 5) : undefined,
  venue: r.venue as string,
  address: u(r.address as string),
  url: r.url as string,
  description: u(r.description as string),
  poster: u(r.poster_url as string),
  status: r.status as Concert["status"],
  source: r.source as Concert["source"],
  reporterId: u(r.reporter_id as string),
  createdAt: r.created_at as string,
  reviewedAt: u(r.reviewed_at as string),
  rejectReason: u(r.reject_reason as string),
});
const concertTo = (c: Concert): Row => ({
  id: c.id,
  artist_id: c.artistId,
  title: c.title,
  date: c.date,
  time: n(c.time),
  venue: c.venue,
  address: n(c.address),
  url: c.url,
  description: n(c.description),
  poster_url: n(c.poster),
  status: c.status,
  source: c.source,
  reporter_id: n(c.reporterId),
  created_at: c.createdAt,
  reviewed_at: n(c.reviewedAt),
  reject_reason: n(c.rejectReason),
});

const reportFrom = (r: Row): ArtistReport => ({
  id: r.id as string,
  name: r.name as string,
  spotifyId: r.spotify_id as string,
  melonId: u(r.melon_id as string),
  youtube: u(r.youtube as string),
  appleMusic: u(r.apple_music_id as string),
  status: r.status as ArtistReport["status"],
  reporterId: u(r.reporter_id as string),
  createdAt: r.created_at as string,
  reviewedAt: u(r.reviewed_at as string),
  rejectReason: u(r.reject_reason as string),
});
const reportTo = (r: ArtistReport): Row => ({
  id: r.id,
  name: r.name,
  spotify_id: r.spotifyId,
  melon_id: n(r.melonId),
  youtube: n(r.youtube),
  apple_music_id: n(r.appleMusic),
  status: r.status,
  reporter_id: n(r.reporterId),
  created_at: r.createdAt,
  reviewed_at: n(r.reviewedAt),
  reject_reason: n(r.rejectReason),
});

const cheerFrom = (r: Row): CheerRecord => ({
  id: r.id as string,
  userId: r.user_id as string,
  artistId: r.artist_id as string,
  date: r.cheer_date as string,
  createdAt: r.created_at as string,
  valid: Boolean(r.valid),
  flag: u(r.flag as string),
  invalidatedAt: u(r.invalidated_at as string),
});
const cheerTo = (c: CheerRecord): Row => ({
  id: c.id,
  user_id: c.userId,
  artist_id: c.artistId,
  cheer_date: c.date,
  created_at: c.createdAt,
  valid: c.valid,
  flag: n(c.flag),
  invalidated_at: n(c.invalidatedAt),
});

const snapFrom = (r: Row): MetricSnapshot => ({
  artistId: r.artist_id as string,
  date: r.date as string,
  melonFans: num(r.melon_fans),
  melonLikes: num(r.melon_likes),
  spotifyFollowers: num(r.spotify_followers),
  spotifyMonthlyListeners: num(r.spotify_monthly_listeners),
  source: r.source as MetricSnapshot["source"],
  updatedAt: r.updated_at as string,
});
const snapTo = (s: MetricSnapshot): Row => ({
  artist_id: s.artistId,
  date: s.date,
  melon_fans: n(s.melonFans),
  melon_likes: n(s.melonLikes),
  spotify_followers: n(s.spotifyFollowers),
  spotify_monthly_listeners: n(s.spotifyMonthlyListeners),
  source: s.source,
});

const runTo = (r: CollectionRun): Row => ({
  id: r.id,
  kind: r.kind ?? "manual-input",
  run_date: r.date,
  started_at: r.startedAt,
  finished_at: n(r.finishedAt),
  status: r.status,
  artist_count: r.artistCount,
  manual: Boolean(r.manual),
  note: n(r.note),
  error: n(r.error),
});

/* ───────── 읽기 ───────── */

/** 1000행 제한을 넘는 테이블도 끝까지 읽는다 */
async function all(table: string, order: string, filter?: (q: ReturnType<ReturnType<SupabaseClient["from"]>["select"]>) => unknown) {
  const sb = serviceClient();
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select("*").order(order).range(from, from + 999);
    if (filter) q = filter(q) as typeof q;
    const { data, error } = await q;
    if (error) throw new Error(`Supabase ${table} 읽기 실패 (${new URL(process.env.SUPABASE_URL!).host}): ${error.message}`);
    out.push(...(data as Row[]));
    if (!data || data.length < 1000) return out;
  }
}

/** 멜론 곡 목록 캐시 (자동 수집을 켰을 때만 쓰는 임시 값. DB에 저장하지 않는다) */
const songCache: Record<string, MelonSongCache> = {};

export async function loadFromSupabase(): Promise<DB> {
  const [artistsR, concertsR, reportsR, cheersR, snapsR, chartsR, runsR, failuresR, basisR, top3R, cheerTop3R, profilesR, basisLogR] =
    await Promise.all([
      all("artists", "created_at"),
      all("concerts", "created_at"),
      all("artist_reports", "created_at"),
      all("cheers", "created_at"),
      all("metric_snapshots", "date"),
      all("melon_charts", "chart_date"),
      all("collection_runs", "started_at"),
      all("collection_failures", "id"),
      all("score_basis", "period"),
      all("monthly_top3", "month"),
      all("cheer_top3", "month"),
      all("profiles", "created_at"),
      all("admin_audit_log", "id", (q) => q.eq("table_name", "score_basis").eq("action", "UPDATE")),
    ]);

  // 수치가 한 번이라도 들어온 아티스트는 차트 산정 대상 (최초 수집 완료)
  const hasData = new Set(snapsR.map((r) => r.artist_id as string));
  const artists = artistsR.map(artistFrom).map((a) => (hasData.has(a.id) ? { ...a, collected: true } : a));

  // 멜론 차트: 최신 차트는 전체(미등록 아티스트 확인용), 나머지는 등록 아티스트가 오른 곡만 읽는다
  const latestChart = chartsR[chartsR.length - 1]?.chart_date as string | undefined;
  const melonIds = artists.map((a) => a.platformIds.melon).filter(Boolean) as string[];
  const [latestEntries, artistEntries] = await Promise.all([
    latestChart ? all("melon_chart_entries", "rank", (q) => q.eq("chart_date", latestChart)) : [],
    melonIds.length ? all("melon_chart_entries", "chart_date", (q) => q.overlaps("artist_melon_ids", melonIds)) : [],
  ]);
  const entriesByDate = new Map<string, Row[]>();
  const seen = new Set<string>();
  for (const e of [...latestEntries, ...artistEntries]) {
    const k = `${e.chart_date}|${e.rank}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (!entriesByDate.has(e.chart_date as string)) entriesByDate.set(e.chart_date as string, []);
    entriesByDate.get(e.chart_date as string)!.push(e);
  }
  const melonCharts: MelonChartSnapshot[] = chartsR
    .map((c) => ({
      chartDate: c.chart_date as string,
      collectedAt: c.collected_at as string,
      source: c.source as "auto" | "manual",
      entries: (entriesByDate.get(c.chart_date as string) ?? [])
        .sort((a, b) => (a.rank as number) - (b.rank as number))
        .map((e) => ({
          rank: e.rank as number,
          songId: e.song_id as string,
          title: e.title as string,
          artists: (e.artist_melon_ids as string[]).map((melonId, i) => ({ melonId, name: (e.artist_names as string[])[i] ?? "" })),
        })),
    }))
    .reverse();

  const failuresByRun = new Map<string, CollectionRun["failures"]>();
  for (const f of failuresR) {
    const list = failuresByRun.get(f.run_id as string) ?? [];
    list.push({ artistId: (f.artist_id as string) ?? "", platform: f.platform as "melon" | "spotify", reason: f.reason as string, resolved: Boolean(f.resolved) });
    failuresByRun.set(f.run_id as string, list);
  }
  const collectionRuns: CollectionRun[] = runsR
    .map((r) => ({
      id: r.id as string,
      date: r.run_date as string,
      startedAt: r.started_at as string,
      finishedAt: (r.finished_at as string) ?? (r.started_at as string),
      status: (r.status === "running" ? "partial" : r.status) as CollectionRun["status"],
      artistCount: r.artist_count as number,
      failures: failuresByRun.get(r.id as string) ?? [],
      manual: Boolean(r.manual),
      kind: r.kind as CollectionRun["kind"],
      note: u(r.note as string),
      error: u(r.error as string),
    }))
    .reverse();

  const basis = { ...DEFAULT_FULL_SCORE_BASIS };
  for (const b of basisR) basis[b.period as Period] = { likes: Number(b.likes), fans: Number(b.fans), followers: Number(b.followers) };
  const pick = (x: Row): FullScoreBasis => ({ likes: Number(x.likes), fans: Number(x.fans), followers: Number(x.followers) });
  const history: BasisChange[] = basisLogR
    .map((l) => ({ at: l.created_at as string, period: (l.after as Row).period as Period, before: pick(l.before as Row), after: pick(l.after as Row) }))
    .filter((h) => h.before.likes !== h.after.likes || h.before.fans !== h.after.fans || h.before.followers !== h.after.followers)
    .reverse();

  const groupTop3 = <T extends "total" | "count">(rows: Row[], field: string, as: T) => {
    const byMonth = new Map<string, { month: string; confirmedAt: string; entries: Row[] }>();
    for (const r of rows) {
      const m = byMonth.get(r.month as string) ?? { month: r.month as string, confirmedAt: r.confirmed_at as string, entries: [] };
      m.entries.push({ artistId: r.artist_id, rank: r.rank, [as]: Number(r[field]) });
      byMonth.set(m.month, m);
    }
    return [...byMonth.values()].map((m) => ({ ...m, entries: m.entries.sort((a, b) => (a.rank as number) - (b.rank as number)) }));
  };

  const users: User[] = profilesR.map((p) => ({
    id: p.id as string,
    email: "",
    nickname: p.nickname as string,
    passwordHash: "",
    createdAt: p.created_at as string,
  }));

  return {
    version: 1,
    artists,
    concerts: concertsR.map(concertFrom),
    artistReports: reportsR.map(reportFrom),
    cheerBase: {},
    cheerRecords: cheersR.map(cheerFrom),
    users,
    metricSnapshots: snapsR.map(snapFrom),
    melonCharts,
    melonSongCache: songCache,
    settings: { metricsSource: "live" },
    scoreConfig: { basis, history },
    collectionRuns,
    monthlyTop3: groupTop3(top3R, "total", "total") as unknown as MonthlyTop3Result[],
    cheerTop3: groupTop3(cheerTop3R, "cheer_count", "count") as unknown as CheerTop3Result[],
  };
}

/* ───────── 쓰기: 바뀐 행만 반영 ───────── */

type Spec = {
  table: string;
  /** 행 식별 키 (upsert onConflict 열) */
  key: string[];
  rows: (db: DB) => Row[];
};

const flatTop3 = (list: (MonthlyTop3Result | CheerTop3Result)[], field: "total" | "cheer_count") =>
  list.flatMap((m) =>
    m.entries.map((e) => ({
      month: m.month,
      rank: e.rank,
      artist_id: e.artistId,
      [field]: field === "total" ? (e as { total: number }).total : (e as { count: number }).count,
      confirmed_at: m.confirmedAt,
    })),
  );

/** 부모 테이블이 먼저 오도록 정렬 (삭제는 역순) */
const SPECS: Spec[] = [
  { table: "artists", key: ["id"], rows: (db) => db.artists.map(artistTo) },
  { table: "concerts", key: ["id"], rows: (db) => db.concerts.map(concertTo) },
  { table: "artist_reports", key: ["id"], rows: (db) => db.artistReports.map(reportTo) },
  { table: "cheers", key: ["id"], rows: (db) => db.cheerRecords.map(cheerTo) },
  { table: "metric_snapshots", key: ["artist_id", "date"], rows: (db) => db.metricSnapshots.map(snapTo) },
  {
    table: "melon_charts",
    key: ["chart_date"],
    rows: (db) => db.melonCharts.map((c) => ({ chart_date: c.chartDate, collected_at: c.collectedAt, source: c.source ?? "manual" })),
  },
  {
    table: "melon_chart_entries",
    key: ["chart_date", "rank"],
    rows: (db) =>
      db.melonCharts.flatMap((c) =>
        c.entries.map((e) => ({
          chart_date: c.chartDate,
          rank: e.rank,
          song_id: e.songId,
          title: e.title,
          artist_melon_ids: e.artists.map((a) => a.melonId),
          artist_names: e.artists.map((a) => a.name),
        })),
      ),
  },
  { table: "collection_runs", key: ["id"], rows: (db) => db.collectionRuns.map(runTo) },
  {
    table: "score_basis",
    key: ["period"],
    rows: (db) => Object.entries(db.scoreConfig.basis).map(([period, b]) => ({ period, ...b })),
  },
  { table: "monthly_top3", key: ["month", "rank"], rows: (db) => flatTop3(db.monthlyTop3, "total") },
  { table: "cheer_top3", key: ["month", "rank"], rows: (db) => flatTop3(db.cheerTop3, "cheer_count") },
];

const keyOf = (r: Row, key: string[]) => key.map((k) => String(r[k])).join("|");

/** 읽을 때 일부만 읽은 테이블은 "없어진 행 = 삭제"로 보면 안 된다 */
const PARTIAL = new Set(["melon_chart_entries"]);

/**
 * 쓰기에 쓸 클라이언트를 정하는 함수 (앱이 등록).
 * 관리자 앱은 로그인한 관리자 토큰의 클라이언트를 돌려준다 → RLS 검사를 받고, 변경 이력에 관리자 계정이 남는다.
 * null이면 서버 Secret 키로 쓴다 (예약 수집, 사용자 서비스의 제보 등).
 */
let writeClientProvider: (() => Promise<SupabaseClient | null>) | null = null;
export function setWriteClientProvider(fn: () => Promise<SupabaseClient | null>) {
  writeClientProvider = fn;
}

export async function saveDiff(before: DB, after: DB) {
  const sb = (await writeClientProvider?.()) ?? serviceClient();
  const plans = SPECS.map((s) => {
    const prev = new Map(s.rows(before).map((r) => [keyOf(r, s.key), JSON.stringify(r)]));
    const next = s.rows(after);
    const nextKeys = new Set(next.map((r) => keyOf(r, s.key)));
    const upserts = next.filter((r) => prev.get(keyOf(r, s.key)) !== JSON.stringify(r));
    const deletes = PARTIAL.has(s.table) ? [] : [...prev.keys()].filter((k) => !nextKeys.has(k));
    return { s, upserts, deletes };
  });

  for (const { s, deletes } of [...plans].reverse()) {
    for (const k of deletes) {
      const parts = k.split("|");
      let q = sb.from(s.table).delete();
      s.key.forEach((col, i) => (q = q.eq(col, parts[i])));
      const { error } = await q;
      if (error) throw new Error(`${s.table} 삭제 실패: ${error.message}`);
    }
  }
  for (const { s, upserts } of plans) {
    for (let i = 0; i < upserts.length; i += 500) {
      const { error } = await sb.from(s.table).upsert(upserts.slice(i, i + 500), { onConflict: s.key.join(",") });
      if (error) throw new Error(`${s.table} 저장 실패: ${error.message}`);
    }
  }

  // 수집 실패 내역: 바뀐 실행 건만 지우고 다시 넣는다
  const prevRuns = new Map(before.collectionRuns.map((r) => [r.id, JSON.stringify(r.failures)]));
  for (const run of after.collectionRuns) {
    if (prevRuns.get(run.id) === JSON.stringify(run.failures)) continue;
    await sb.from("collection_failures").delete().eq("run_id", run.id);
    if (run.failures.length) {
      const { error } = await sb.from("collection_failures").insert(
        run.failures.map((f) => ({ run_id: run.id, artist_id: f.artistId || null, platform: f.platform, reason: f.reason, resolved: f.resolved })),
      );
      if (error) throw new Error(`collection_failures 저장 실패: ${error.message}`);
    }
  }
}
