/**
 * 멜론 수집 (서버 전용).
 * - 인디 일간 차트: 차트 페이지 1개
 * - 아티스트 팬 수·발매곡 좋아요 합계: 아티스트 페이지가 화면을 그릴 때 쓰는 공개 JSON/목록 주소
 * 로그인·접근 제한 우회는 하지 않고, 요청 사이에 간격을 둔다. 멜론이 거부하면 그대로 실패로 기록한다.
 * 멜론 robots.txt는 일반 수집기 접근을 허용하지 않는다. 운영 전 법률 검토 또는 제휴를 권장한다.
 */
import type { MelonChartEntry, MelonChartSnapshot } from "./types";

export const MELON_INDIE_DAILY_URL = "https://www.melon.com/chart/day/index.htm?classCd=GN0500";

/** 요청자를 숨기지 않는 수집기 이름. MELON_USER_AGENT로 바꿀 수 있다 */
const USER_AGENT = process.env.MELON_USER_AGENT || "IndieChartBot/0.1 (indie artist chart; once a day)";

export class MelonCollectError extends Error {
  /** 연결 안 됨·요청 제한처럼 멜론이 막은 것으로 보이는 오류. 이때는 수집을 바로 멈춘다 */
  constructor(
    message: string,
    readonly blocked = false,
  ) {
    super(message);
  }
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

/** 차트 페이지 HTML에서 순위·곡·아티스트를 읽는다. 구조가 예상과 다르면 오류 */
export function parseMelonChart(html: string): Omit<MelonChartSnapshot, "collectedAt"> {
  const dateMatch = html.match(/<span class="year">\s*(\d{4})\.(\d{2})\.(\d{2})/);
  if (!dateMatch) throw new MelonCollectError("차트 기준일을 찾지 못했어요. 페이지 구조가 바뀌었을 수 있어요.");
  const chartDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

  const entries: MelonChartEntry[] = [];
  const rowRe = /<tr class="lst\d+"[^>]*data-song-no="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;
  for (const [, songId, row] of html.matchAll(rowRe)) {
    const rank = Number(row.match(/class="rank ">(\d+)</)?.[1]);
    const title = row.match(/rank01">[\s\S]*?<a [^>]*>([\s\S]*?)<\/a>/)?.[1];
    const artistBlock = row.match(/<div class="ellipsis rank02">([\s\S]*?)<\/div>/)?.[1] ?? "";
    const artists: MelonChartEntry["artists"] = [];
    for (const [, melonId, name] of artistBlock.matchAll(/artistId=(\d+)" title="([^"]*?) - 페이지 이동/g)) {
      if (!artists.some((a) => a.melonId === melonId)) artists.push({ melonId, name: decode(name) });
    }
    if (!rank || !title) continue;
    entries.push({ rank, songId, title: decode(title), artists });
  }

  if (entries.length === 0) throw new MelonCollectError("차트 목록을 찾지 못했어요. 접근이 거부됐거나 페이지 구조가 바뀌었을 수 있어요.");
  if (!entries.every((e, i) => e.rank === i + 1)) throw new MelonCollectError("순위가 1위부터 차례대로 나오지 않았어요. 페이지 구조를 확인해 주세요.");
  return { chartDate, entries };
}

/** 멜론 인디 일간 차트를 1회 요청해 읽는다 */
export async function fetchMelonIndieChart(): Promise<MelonChartSnapshot> {
  let res: Response;
  try {
    res = await fetch(MELON_INDIE_DAILY_URL, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko;q=0.9" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new MelonCollectError(`멜론에 연결하지 못했어요. (${e instanceof Error ? e.message : "네트워크 오류"})`);
  }
  if (!res.ok) throw new MelonCollectError(`멜론이 요청을 거부했어요. (HTTP ${res.status})`);
  const parsed = parseMelonChart(await res.text());
  return { ...parsed, collectedAt: new Date().toISOString(), source: "auto" };
}

/* ───────── 아티스트 팬 수·좋아요 ───────── */

const MELON = "https://www.melon.com";
/**
 * 요청 사이 간격 (ms). 1분에 50번쯤 요청하자 멜론이 접속을 막았던 적이 있어 넉넉히 둔다.
 * MELON_REQUEST_GAP_MS 환경 변수로 바꿀 수 있다.
 */
export const MELON_REQUEST_GAP_MS = Math.max(1000, Number(process.env.MELON_REQUEST_GAP_MS) || 3000);
const SONG_PAGE_SIZE = 50;
/** 한 아티스트에서 읽을 발매곡 상한 (요청 수 제한) */
const MAX_SONGS = 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function melonGet(pathAndQuery: string, artistId: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(MELON + pathAndQuery, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ko-KR,ko;q=0.9",
        Referer: `${MELON}/artist/song.htm?artistId=${artistId}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new MelonCollectError(`멜론이 응답하지 않아요. 요청이 많아 일시적으로 막혔을 수 있어요. (${e instanceof Error ? e.message : "네트워크 오류"})`, true);
  }
  if (!res.ok) throw new MelonCollectError(`멜론이 요청을 거부했어요. (HTTP ${res.status})`, [403, 429, 503].includes(res.status));
  return res.text();
}

function parseJson<T>(text: string, what: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new MelonCollectError(`${what} 응답 형식이 예상과 달라요.`);
  }
}

/** 아티스트 팬맺기 수 */
export async function fetchMelonFans(melonId: string): Promise<number> {
  const text = await melonGet(`/artist/getArtistFanNTemper.json?artistId=${encodeURIComponent(melonId)}`, melonId);
  const n = parseJson<{ fanInfo?: { SUMMCNT?: unknown } }>(text, "팬 수").fanInfo?.SUMMCNT;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new MelonCollectError("팬 수를 찾지 못했어요. 응답 구조가 바뀌었을 수 있어요.");
  return n;
}

/** 발매곡 목록 한 페이지에서 곡 ID를 읽는다 */
export function parseMelonSongIds(html: string): string[] {
  const ids = new Set<string>();
  for (const [, id] of html.matchAll(/data-song-no="(\d+)"/g)) ids.add(id);
  return [...ids];
}

/** 아티스트의 발매곡 ID 전체 (발매 탭, 참여곡 제외) */
export async function fetchMelonSongIds(melonId: string): Promise<string[]> {
  const all: string[] = [];
  for (let start = 1; start <= MAX_SONGS; start += SONG_PAGE_SIZE) {
    if (start > 1) await sleep(MELON_REQUEST_GAP_MS);
    const html = await melonGet(
      `/artist/songPaging.htm?startIndex=${start}&pageSize=${SONG_PAGE_SIZE}&listType=A&orderBy=ISSUE_DATE&artistId=${encodeURIComponent(melonId)}`,
      melonId,
    );
    const ids = parseMelonSongIds(html);
    all.push(...ids.filter((id) => !all.includes(id)));
    if (ids.length < SONG_PAGE_SIZE) break;
  }
  return all;
}

/** 곡 좋아요 합계. 곡 ID 50개씩 나눠 요청한다 */
export async function fetchMelonSongLikes(melonId: string, songIds: string[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < songIds.length; i += SONG_PAGE_SIZE) {
    if (i > 0) await sleep(MELON_REQUEST_GAP_MS);
    const batch = songIds.slice(i, i + SONG_PAGE_SIZE);
    const text = await melonGet(`/commonlike/getSongLike.json?contsIds=${batch.join(",")}`, melonId);
    const list = parseJson<{ contsLike?: { SUMMCNT?: unknown }[] }>(text, "좋아요").contsLike;
    if (!Array.isArray(list)) throw new MelonCollectError("좋아요 수를 찾지 못했어요. 응답 구조가 바뀌었을 수 있어요.");
    for (const x of list) if (typeof x.SUMMCNT === "number") total += x.SUMMCNT;
  }
  return total;
}
