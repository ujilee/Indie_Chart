import Link from "next/link";
import { AdminHeader, Card, Table, Tabs, fmtDateTime, fmtScore } from "@/components/ui";
import { getChart } from "@indie/core/data";
import { readDb } from "@indie/core/db";
import { WEIGHTS, cheerPoints, normalizeGain } from "@indie/core/score";
import { PERIODS, type Period } from "@indie/core/types";
import BasisForm from "./BasisForm";

const n = (v: number | null) => (v == null ? <span className="text-up">미수집</span> : v.toLocaleString());

export default async function AdminScores({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period = "daily" } = await searchParams;
  const p = (PERIODS.some((x) => x.key === period) ? period : "daily") as Period;
  const db = await readDb();
  const chart = getChart(p, db);
  const basis = db.scoreConfig.basis[p];
  const maxCheers = Math.max(0, ...chart.entries.map((e) => e.metrics.cheers));
  const history = db.scoreConfig.history.filter((h) => h.period === p);

  const cell = (raw: React.ReactNode, conv: number, weighted: number) => (
    <div className="tabular-nums leading-tight">
      <div>{raw}</div>
      <div className="text-xs text-subtle">
        {fmtScore(conv)} → <b className="text-fg">{fmtScore(weighted)}</b>
      </div>
    </div>
  );

  return (
    <>
      <AdminHeader
        title="점수 관리"
        desc="지표별 원천 수치 · 0~100 환산 점수 → 가중치 반영 점수를 확인하고, 기간별 만점 기준을 관리해요."
      />
      <Tabs active={p} items={PERIODS.map((x) => ({ key: x.key, label: x.label, href: `?period=${x.key}` }))} />

      <div className="grid xl:grid-cols-[1fr_320px] gap-4 items-start">
        <Card className="min-w-0">
          <Table
            minWidth={1100}
            head={[
              "순위",
              "아티스트",
              `멜론 순위 (${WEIGHTS.melonRank * 100}%)`,
              `좋아요 (${WEIGHTS.melonLikes * 100}%)`,
              `팬맺기 (${WEIGHTS.melonFans * 100}%)`,
              `Spotify (${WEIGHTS.spotifyFollowers * 100}%)`,
              `응원 (${WEIGHTS.cheer * 100}%)`,
              "기본",
              "공연",
              "최종",
            ]}
          >
            {chart.entries.map((e) => {
              const m = e.metrics;
              return (
                <tr key={e.artist.id}>
                  <td className="font-semibold tabular-nums">{e.rank}</td>
                  <td>
                    <Link href={`/artists/${e.artist.id}`} className="font-semibold hover:underline whitespace-nowrap">
                      {e.artist.name}
                    </Link>
                  </td>
                  <td>{cell(`${fmtScore(m.songRankPoints)}점`, m.songRankPoints, e.score.melonRank)}</td>
                  <td>{cell(<>+{n(m.likeGain)}</>, normalizeGain(m.likeGain, basis.likes), e.score.melonLikes)}</td>
                  <td>{cell(<>+{n(m.fanGain)}</>, normalizeGain(m.fanGain, basis.fans), e.score.melonFans)}</td>
                  <td>{cell(<>+{n(m.followerGain)}</>, normalizeGain(m.followerGain, basis.followers), e.score.spotifyFollowers)}</td>
                  <td>{cell(`${m.cheers}회`, cheerPoints(m.cheers, maxCheers), e.score.cheer)}</td>
                  <td className="tabular-nums font-semibold">{fmtScore(e.score.base)}</td>
                  <td className="tabular-nums whitespace-nowrap">
                    +{fmtScore(e.score.concertBonus)}
                    <div className="text-xs text-subtle">{m.validConcerts}건</div>
                  </td>
                  <td className="tabular-nums font-extrabold">{fmtScore(e.score.total)}</td>
                </tr>
              );
            })}
          </Table>
        </Card>

        <div className="space-y-4">
          <Card title={`${PERIODS.find((x) => x.key === p)!.label} 만점 기준`}>
            <p className="px-5 pt-4 text-xs text-muted leading-relaxed">
              증가량이 기준 이상이면 환산 100점. 같은 기간·지표에는 모든 아티스트에게 동일 기준이 적용돼요. 응원 만점 기준은 기간 최다
              응원 {maxCheers}회(상대평가)예요.
            </p>
            <BasisForm period={p} basis={basis} />
          </Card>
          <Card title="기준 변경 이력">
            <ul className="divide-y divide-line text-sm">
              {history.length === 0 && <li className="px-5 py-6 text-center text-muted">변경 이력이 없어요.</li>}
              {history.map((h) => (
                <li key={h.at} className="px-5 py-3">
                  <p className="text-xs text-subtle">{fmtDateTime(h.at)}</p>
                  <p className="tabular-nums mt-0.5">
                    {h.before.likes}/{h.before.fans}/{h.before.followers} → <b>{h.after.likes}/{h.after.fans}/{h.after.followers}</b>
                  </p>
                  {h.note && <p className="text-xs text-muted">{h.note}</p>}
                </li>
              ))}
            </ul>
            <p className="px-5 pb-4 text-xs text-subtle">좋아요 / 팬 / 팔로워 순</p>
          </Card>
        </div>
      </div>
    </>
  );
}
