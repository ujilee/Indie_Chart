import { ActionForm } from "@/components/ActionForm";
import Link from "next/link";
import { AdminHeader, Card, EmptyRow, Pill, Table, Tabs, btn, fmtDateTime, fmtScore } from "@/components/ui";
import { CURRENT_MONTH, monthLabel } from "@indie/core/constants";
import { getArtist, getChart, getMonthlyCheerCounts } from "@indie/core/data";
import { readDb } from "@indie/core/db";
import { WEIGHTS, cheerPoints } from "@indie/core/score";
import { PERIODS, type Period } from "@indie/core/types";
import { invalidateFlagged, setCheerValid } from "../actions";

const WINDOW: Record<Period, string> = {
  daily: "전일 00:00 ~ 23:59:59",
  weekly: "전주 월요일 ~ 일요일",
  monthly: "전월 1일 ~ 말일",
  yearly: "전년도 1월 1일 ~ 12월 31일",
};

export default async function AdminCheers({ searchParams }: { searchParams: Promise<{ period?: string; view?: string }> }) {
  const { period = "daily", view = "flagged" } = await searchParams;
  const p = (PERIODS.some((x) => x.key === period) ? period : "daily") as Period;
  const db = readDb();
  const nicknames = new Map(db.users.map((u) => [u.id, u.nickname]));
  const chart = getChart(p, db);
  const rows = [...chart.entries].sort((a, b) => b.metrics.cheers - a.metrics.cheers);
  const max = Math.max(0, ...rows.map((e) => e.metrics.cheers));
  const flagged = db.cheerRecords.filter((r) => r.flag);
  const records = (view === "flagged" ? flagged : view === "invalid" ? db.cheerRecords.filter((r) => !r.valid) : db.cheerRecords)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
  const monthTotal = Object.values(getMonthlyCheerCounts(db)).reduce((s, n) => s + n, 0);
  const qs = (o: Record<string, string>) => `?${new URLSearchParams({ period: p, view, ...o })}`;

  return (
    <>
      <AdminHeader
        title="응원 관리"
        desc={`응원은 1인 하루 1회. ${monthLabel(CURRENT_MONTH)} 누적 유효 응원 ${monthTotal.toLocaleString()}회`}
      />

      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="min-w-0">
          <Tabs active={p} items={PERIODS.map((x) => ({ key: x.key, label: x.label, href: qs({ period: x.key }) }))} />
          <Card title={`기간별 응원 환산 점수 · ${WINDOW[p]}`}>
            <p className="px-5 pt-3 text-xs text-muted">
              만점 기준: 기간 최다 유효 응원 <b className="text-fg">{max}회</b> = 100점 → ×{WEIGHTS.cheer} = 최대 10점
            </p>
            <Table head={["아티스트", "유효 응원", "환산 점수", "반영 점수"]} minWidth={440}>
              {rows.map((e) => (
                <tr key={e.artist.id}>
                  <td className="font-semibold">{e.artist.name}</td>
                  <td className="tabular-nums">{e.metrics.cheers}회</td>
                  <td className="tabular-nums">{fmtScore(cheerPoints(e.metrics.cheers, max))}</td>
                  <td className="tabular-nums font-bold">{fmtScore(e.score.cheer)}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Tabs
              active={view}
              items={[
                { key: "flagged", label: "부정 의심", href: qs({ view: "flagged" }), count: flagged.filter((r) => r.valid).length },
                { key: "invalid", label: "무효 처리됨", href: qs({ view: "invalid" }), count: db.cheerRecords.filter((r) => !r.valid).length },
                { key: "all", label: "최근 기록", href: qs({ view: "all" }) },
              ]}
            />
            {view === "flagged" && flagged.some((r) => r.valid) && (
              <ActionForm action={invalidateFlagged} className="mb-4">
                <button className={btn.danger}>의심 기록 일괄 무효</button>
              </ActionForm>
            )}
          </div>
          <Card title="응원 기록">
            <Table head={["일시", "회원", "아티스트", "상태", ""]} minWidth={560}>
              {records.length === 0 && <EmptyRow colSpan={5}>기록이 없어요.</EmptyRow>}
              {records.map((r) => (
                <tr key={r.id} className={r.valid ? "" : "text-subtle"}>
                  <td className="text-xs tabular-nums whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                  <td className="text-xs">
                    {/* 회원이면 닉네임, 시드(목업) 기록은 ID만 */}
                    {nicknames.get(r.userId) && <span className="block font-semibold text-sm">{nicknames.get(r.userId)}</span>}
                    <span className="font-mono text-subtle">{r.userId}</span>
                  </td>
                  <td>
                    <Link href={`/artists/${r.artistId}`} className="font-semibold hover:underline">
                      {getArtist(r.artistId, db)?.name}
                    </Link>
                    {r.flag && <p className="text-xs text-up">{r.flag}</p>}
                  </td>
                  <td>{r.valid ? <Pill tone="dark">유효</Pill> : <Pill tone="line">무효</Pill>}</td>
                  <td className="text-right">
                    <ActionForm action={setCheerValid.bind(null, r.id, !r.valid)}>
                      <button className={`${btn.small} border border-line hover:border-fg`}>{r.valid ? "무효 처리" : "복구"}</button>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
          <p className="mt-2 text-xs text-subtle">무효 처리된 응원은 월간 누적 횟수와 응원 순위에서 즉시 제외돼요.</p>
        </div>
      </div>
    </>
  );
}
