import { ActionForm } from "@/components/ActionForm";
import Link from "next/link";
import { AdminHeader, Card, Pill, Table, btn, fmtDateTime, fmtScore } from "@/components/ui";
import { Avatar } from "@indie/core/ui";
import { lastServiceMonth, monthLabel } from "@indie/core/constants";
import { getArtist, getChart, getOpenFailures } from "@indie/core/data";
import { readDb } from "@indie/core/db";
import { confirmMonthlyTop3 } from "../actions";

export default async function AdminTop3() {
  const db = await readDb();
  const chart = getChart("monthly", db);
  const candidates = chart.entries.filter((e) => e.rank <= 5);
  const confirmed = db.monthlyTop3.find((r) => r.month === lastServiceMonth());
  const history = [...db.monthlyTop3].sort((a, b) => b.month.localeCompare(a.month));
  const blocked = getOpenFailures(db).length > 0;

  return (
    <>
      <AdminHeader
        title="월간 최종 종합 TOP 3"
        desc="직전 완료 월의 월간 종합 차트 1~3위(공동 순위 포함)를 홈 상단에 고정 노출해요. 확정 전까지는 이전 결과가 유지돼요."
        actions={
          <ActionForm action={confirmMonthlyTop3}>
            <button disabled={blocked} className={`${btn.primary} disabled:bg-surface disabled:text-subtle`}>
              {confirmed ? `${monthLabel(lastServiceMonth())} 재확정` : `${monthLabel(lastServiceMonth())} 집계 확정`}
            </button>
          </ActionForm>
        }
      />
      {blocked && <p className="mb-4 text-sm text-up">수집 실패가 남아 있어 집계를 확정할 수 없어요.</p>}

      <div className="grid xl:grid-cols-2 gap-4 items-start">
        <Card
          title={`${monthLabel(lastServiceMonth())} 월간 종합 순위`}
          actions={confirmed ? <Pill tone="dark">확정 · {fmtDateTime(confirmed.confirmedAt)}</Pill> : <Pill tone="warn">미확정</Pill>}
        >
          <Table head={["순위", "아티스트", "기본", "공연", "최종", ""]} minWidth={480}>
            {candidates.map((e) => (
              <tr key={e.artist.id} className={e.rank <= 3 ? "" : "text-subtle"}>
                <td className="font-bold tabular-nums">{e.rank}</td>
                <td>
                  <span className="flex items-center gap-2.5">
                    <Avatar artist={e.artist} size={30} />
                    <span className="font-semibold">{e.artist.name}</span>
                  </span>
                </td>
                <td className="tabular-nums">{fmtScore(e.score.base)}</td>
                <td className="tabular-nums">+{fmtScore(e.score.concertBonus)}</td>
                <td className="tabular-nums font-bold">{fmtScore(e.score.total)}</td>
                <td>{e.rank <= 3 && <Pill tone="accent">TOP 3</Pill>}</td>
              </tr>
            ))}
          </Table>
          <p className="px-5 py-3 text-xs text-subtle">동점은 공동 순위로 처리되며, 3위 경계 동점 시 모두 선정돼요 (3팀 초과 가능).</p>
        </Card>

        <Card title="월별 선정 이력">
          <ul className="divide-y divide-line">
            {history.map((h) => (
              <li key={h.month} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{monthLabel(h.month)}</p>
                  <span className="text-xs text-subtle">{fmtDateTime(h.confirmedAt)} 확정</span>
                </div>
                <ol className="mt-2 flex flex-wrap gap-2">
                  {h.entries.map((e) => {
                    const a = getArtist(e.artistId, db);
                    return (
                      <li key={e.artistId}>
                        <Link href={`/artists/${e.artistId}`} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm hover:bg-line">
                          <b>{e.rank}</b> {a?.name ?? e.artistId}
                          <span className="text-xs text-subtle tabular-nums">{e.total.toFixed(1)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
