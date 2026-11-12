import Link from "next/link";
import { AdminHeader, Card, Tabs, adminInput, btn, fmtScore } from "@/components/ui";
import { Avatar, RankChange } from "@indie/core/ui";
import { getArtist, periodLabels, getChart, getOpenFailures } from "@indie/core/data";
import { readDb } from "@indie/core/db";
import { WEIGHTS } from "@indie/core/score";
import { PERIODS, type Period } from "@indie/core/types";

const pts = (n: number) => Math.round(n * 100);

/** 증가량 표기. null은 미수집 */
function Gain({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs font-semibold text-accent">미수집</span>;
  return <span>+{value.toLocaleString("ko-KR")}</span>;
}

function Score({ value }: { value: number }) {
  return <span className={value > 0 ? "font-semibold" : "text-subtle"}>{fmtScore(value)}</span>;
}

export default async function AdminCharts({ searchParams }: { searchParams: Promise<{ period?: string; q?: string }> }) {
  const { period = "daily", q = "" } = await searchParams;
  const p = (PERIODS.some((x) => x.key === period) ? period : "daily") as Period;
  const db = readDb();
  const chart = getChart(p, db);
  const failures = p === "daily" ? getOpenFailures(db) : [];
  const pendingArtists = db.artists.filter((a) => a.status === "active" && !a.collected);

  // 아티스트 검색 (순위는 전체 차트 기준 그대로)
  const keyword = q.trim().toLowerCase().replace(/\s/g, "");
  const entries = keyword
    ? chart.entries.filter((e) =>
        [e.artist.name, e.artist.nameEn, e.artist.id].some((v) => v.toLowerCase().replace(/\s/g, "").includes(keyword)),
      )
    : chart.entries;

  const head = [
    "순위",
    "변동",
    "아티스트",
    "멜론 순위",
    `순위 점수 (${pts(WEIGHTS.melonRank)})`,
    "좋아요",
    `좋아요 점수 (${pts(WEIGHTS.melonLikes)})`,
    "팬",
    `팬 점수 (${pts(WEIGHTS.melonFans)})`,
    "Spotify",
    `Spotify 점수 (${pts(WEIGHTS.spotifyFollowers)})`,
    "응원 수",
    `응원 점수 (${pts(WEIGHTS.cheer)})`,
    "공연 가점",
    "최종 점수",
  ];

  return (
    <>
      <AdminHeader
        title="차트 관리"
        desc={`집계 기간 ${chart.label} · 비교 기간 ${periodLabels(p).prevLabel} · 업데이트 ${chart.updatedAt}`}
        actions={
          <Link href={`/scores?period=${p}`} className={btn.outline}>
            점수 기준 보기
          </Link>
        }
      />
      <Tabs
        active={p}
        items={PERIODS.map((x) => ({ key: x.key, label: x.label, href: `?${new URLSearchParams({ period: x.key, ...(q ? { q } : {}) })}` }))}
      />

      {failures.length > 0 && (
        <div className="mb-4 rounded-2xl border border-up/30 bg-up/5 px-5 py-4 text-sm">
          <p className="font-bold text-up">순위 미확정 — 일부 아티스트 데이터 수집 실패</p>
          <p className="mt-1 text-muted">
            {failures.map((f) => `${getArtist(f.artistId, db)?.name} (${f.platform === "melon" ? "멜론" : "Spotify"})`).join(", ")} ·{" "}
            <Link href="/collection" className="underline">
              데이터 수집에서 재수집
            </Link>
          </p>
        </div>
      )}
      {pendingArtists.length > 0 && (
        <p className="mb-4 text-sm text-muted">최초 수집 대기 {pendingArtists.length}팀은 차트 집계에서 보류 중이에요.</p>
      )}

      <form className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <input type="hidden" name="period" value={p} />
        <input name="q" defaultValue={q} placeholder="아티스트명, 영문명, ID 검색" aria-label="아티스트 검색" className={`${adminInput} w-64`} />
        <button className={btn.outline}>검색</button>
        {q && (
          <>
            <Link href={`?period=${p}`} className="text-sm text-muted hover:text-fg">
              초기화
            </Link>
            <span className="text-sm text-muted">
              “{q}” {entries.length}팀 / 전체 {chart.entries.length}팀
            </span>
          </>
        )}
      </form>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1360px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted whitespace-nowrap">
                {head.map((h, i) => (
                  <th
                    key={h}
                    className={`px-3 py-3 font-semibold ${i >= 3 ? "text-right" : ""} ${i === 2 ? "sticky left-0 bg-bg" : ""} ${
                      i >= 3 && i <= 12 && i % 2 === 0 ? "border-r border-line" : ""
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums whitespace-nowrap">
              {entries.length === 0 && (
                <tr>
                  <td colSpan={head.length} className="px-5 py-10 text-center text-muted">
                    {q ? `“${q}”에 해당하는 아티스트가 차트에 없어요.` : "차트 대상 아티스트가 없어요."}
                  </td>
                </tr>
              )}
              {entries.map((e) => {
                const m = e.metrics;
                const s = e.score;
                return (
                  <tr key={e.artist.id} className="hover:bg-surface/60">
                    <td className="px-3 py-2.5 text-lg font-semibold w-12">{e.rank}</td>
                    <td className="px-3 py-2.5 w-16">
                      <RankChange rank={e.rank} prevRank={e.prevRank} isNew={chart.comparable && e.prevRank == null} />
                    </td>
                    <td className="px-3 py-2.5 sticky left-0 bg-bg">
                      <Link href={`/artists/${e.artist.id}`} className="flex items-center gap-2.5 hover:underline">
                        <Avatar artist={e.artist} size={28} />
                        <span className="font-semibold">{e.artist.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {m.bestSongRank != null ? (
                        <>
                          {m.bestSongRank}위 <span className="text-xs text-subtle">· {m.chartSongs}곡</span>
                        </>
                      ) : (
                        <span className="text-subtle">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right border-r border-line">
                      <Score value={s.melonRank} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Gain value={m.likeGain} />
                    </td>
                    <td className="px-3 py-2.5 text-right border-r border-line">
                      <Score value={s.melonLikes} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Gain value={m.fanGain} />
                    </td>
                    <td className="px-3 py-2.5 text-right border-r border-line">
                      <Score value={s.melonFans} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Gain value={m.followerGain} />
                    </td>
                    <td className="px-3 py-2.5 text-right border-r border-line">
                      <Score value={s.spotifyFollowers} />
                    </td>
                    <td className="px-3 py-2.5 text-right">{m.cheers.toLocaleString("ko-KR")}회</td>
                    <td className="px-3 py-2.5 text-right border-r border-line">
                      <Score value={s.cheer} />
                    </td>
                    <td className="px-3 py-2.5 text-right">+{fmtScore(s.concertBonus)}</td>
                    <td className="px-3 py-2.5 text-right font-bold">{fmtScore(s.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-subtle leading-relaxed">
        멜론 순위는 기간 중 최고 순위와 차트에 오른 곡 수예요. 좋아요·팬·Spotify는 기간 증가량(팔로워 기준)이고, 점수 옆 괄호는 만점이에요. 최종 점수 = 다섯
        점수의 합 + 공연 가점. 최종 순위는 반올림 전 점수 기준이며, 동점은 공동 순위로 처리하고 다음 순위를 건너뛰어요.
      </p>
    </>
  );
}
