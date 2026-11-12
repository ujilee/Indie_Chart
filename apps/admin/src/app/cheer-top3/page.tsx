import Link from "next/link";
import { AdminHeader, Card, Pill, Table, fmtDateTime } from "@/components/ui";
import { Avatar } from "@indie/core/ui";
import { serviceMonth, monthLabel } from "@indie/core/constants";
import { getActiveArtists, getArtist, getMonthlyCheerCounts, rankCheers } from "@indie/core/data";
import { readDb } from "@indie/core/db";

export default function AdminCheerTop3() {
  const db = readDb();
  const ranking = rankCheers(getMonthlyCheerCounts(db), getActiveArtists(db));
  const history = [...db.cheerTop3].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <>
      <AdminHeader
        title="월간 응원 아티스트 TOP 3"
        desc="실제 월간 누적 유효 응원 횟수만으로 순위를 매겨요 (점수 환산 없음). 월 종료 후 유효 응원 검증을 거쳐 확정돼요."
      />
      <div className="grid xl:grid-cols-2 gap-4 items-start">
        <Card title={`${monthLabel(serviceMonth())} 진행 중 순위`} actions={<Pill tone="warn">집계 중</Pill>}>
          <Table head={["순위", "아티스트", "누적 응원", ""]} minWidth={420}>
            {ranking.slice(0, 15).map((e) => (
              <tr key={e.artist.id} className={e.rank <= 3 ? "" : "text-muted"}>
                <td className="font-bold tabular-nums">{e.rank}</td>
                <td>
                  <span className="flex items-center gap-2.5">
                    <Avatar artist={e.artist} size={30} />
                    <span className="font-semibold">{e.artist.name}</span>
                  </span>
                </td>
                <td className="tabular-nums">{e.count.toLocaleString()}회</td>
                <td>{e.rank <= 3 && <Pill tone="accent">TOP 3</Pill>}</td>
              </tr>
            ))}
          </Table>
          <p className="px-5 py-3 text-xs text-subtle">
            동률은 공동 순위·가나다순, 응원 0회 아티스트는 제외돼요. 부정 응원은{" "}
            <Link href="/cheers" className="underline">
              응원 관리
            </Link>
            에서 무효 처리하세요.
          </p>
        </Card>

        <Card title="확정 결과 이력">
          <ul className="divide-y divide-line">
            {history.map((h) => (
              <li key={h.month} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{monthLabel(h.month)} 최종 응원 TOP 3</p>
                  <span className="text-xs text-subtle">{fmtDateTime(h.confirmedAt)}</span>
                </div>
                <ol className="mt-2 space-y-1 text-sm">
                  {h.entries.map((e) => (
                    <li key={e.artistId} className="flex justify-between">
                      <span>
                        <b className="tabular-nums mr-2">{e.rank}</b>
                        {getArtist(e.artistId, db)?.name}
                      </span>
                      <span className="tabular-nums text-muted">{e.count.toLocaleString()}회</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
