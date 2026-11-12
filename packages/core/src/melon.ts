/**
 * 멜론 인디 일간 차트 수집 (서버 전용).
 * 차트 페이지 1개만 요청한다. 로그인·내부 API·접근 제한 우회는 하지 않는다.
 * 멜론이 요청을 거부하면 그대로 실패로 기록한다.
 */
import type { MelonChartEntry, MelonChartSnapshot } from "./types";

export const MELON_INDIE_DAILY_URL = "https://www.melon.com/chart/day/index.htm?classCd=GN0500";

/** 요청자를 숨기지 않는 수집기 이름. MELON_USER_AGENT로 바꿀 수 있다 */
const USER_AGENT = process.env.MELON_USER_AGENT || "IndieChartBot/0.1 (indie artist chart; daily, 1 request)";

export class MelonCollectError extends Error {}

const decode = (s: string) =>
  s
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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
  return { ...parsed, collectedAt: new Date().toISOString() };
}
