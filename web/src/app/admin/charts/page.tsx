import Link from "next/link";
import { AdminHeader, Card, Pill, Table, Tabs, fmtScore } from "@/components/admin/ui";
import { Avatar, RankChange } from "@/components/ui";
import { PERIOD_META, getArtist, getChart, getOpenFailures } from "@/lib/data";
import { readDb } from "@/lib/db";
import { PERIODS, type Period } from "@/lib/types";

export default async function AdminCharts({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period = "daily" } = await searchParams;
  const p = (PERIODS.some((x) => x.key === period) ? period : "daily") as Period;
  const db = readDb();
  const chart = getChart(p, db);
  const failures = p === "daily" ? getOpenFailures(db) : [];
  const pendingArtists = db.artists.filter((a) => a.status === "active" && !a.collected);

  return (
    <>
      <AdminHeader
        title="차트 관리"
        desc={`집계 기간 ${chart.label} · 비교 기간 ${PERIOD_META[p].prevLabel} · 업데이트 ${chart.updatedAt}`}
        actions={
          <Link href={`/admin/scores?period=${p}`} className="h-9 px-4 rounded-full border border-line text-sm font-semibold hover:border-fg inline-flex items-center">
            지표별 점수 보기
          </Link>
        }
      />
      <Tabs active={p} items={PERIODS.map((x) => ({ key: x.key, label: x.label, href: `?period=${x.key}` }))} />

      {failures.length > 0 && (
        <div className="mb-4 rounded-2xl border border-up/30 bg-up/5 px-5 py-4 text-sm">
          <p className="font-bold text-up">순위 미확정 — 일부 아티스트 데이터 수집 실패</p>
          <p className="mt-1 text-muted">
            {failures.map((f) => `${getArtist(f.artistId, db)?.name} (${f.platform === "melon" ? "멜론" : "Spotify"})`).join(", ")} ·{" "}
            <Link href="/admin/collection" className="underline">
              데이터 수집에서 재수집
            </Link>
          </p>
        </div>
      )}
      {pendingArtists.length > 0 && (
        <p className="mb-4 text-sm text-muted">
          최초 수집 대기 {pendingArtists.length}팀은 차트 집계에서 보류 중이에요.
        </p>
      )}

      <Card>
        <Table head={["순위", "변동", "아티스트", "기본 점수", "공연 가점", "최종 점수", "비고"]} minWidth={760}>
          {chart.entries.map((e) => {
            const missing = e.metrics.likeGain == null || e.metrics.followerGain == null;
            return (
              <tr key={e.artist.id}>
                <td className="text-lg font-semibold tabular-nums w-16">{e.rank}</td>
                <td className="w-20">
                  <RankChange rank={e.rank} prevRank={e.prevRank} isNew={e.prevRank == null} />
                </td>
                <td>
                  <Link href={`/admin/artists/${e.artist.id}`} className="flex items-center gap-3 hover:underline">
                    <Avatar artist={e.artist} size={32} />
                    <span className="font-semibold">{e.artist.name}</span>
                  </Link>
                </td>
                <td className="tabular-nums">{fmtScore(e.score.base)}</td>
                <td className="tabular-nums">+{fmtScore(e.score.concertBonus)}</td>
                <td className="tabular-nums font-bold">{fmtScore(e.score.total)}</td>
                <td>{missing && <Pill tone="accent">미수집 지표</Pill>}</td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <p className="mt-3 text-xs text-subtle">
        최종 순위는 반올림 전 점수 기준이며, 동점은 공동 순위로 처리하고 다음 순위를 건너뛰어요.
      </p>
    </>
  );
}
