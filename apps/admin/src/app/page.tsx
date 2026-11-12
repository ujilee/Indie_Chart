import Link from "next/link";
import { AdminHeader, Card, Pill, Stat, btn, fmtDateTime } from "@/components/ui";
import { Avatar } from "@indie/core/ui";
import { lastServiceMonth, monthLabel } from "@indie/core/constants";
import { getArtist, getChart, getMonthlyCheerCounts, getOpenFailures, rankCheers, getActiveArtists } from "@indie/core/data";
import { readDb } from "@indie/core/db";

export default async function AdminDashboard() {
  const db = await readDb();
  const active = db.artists.filter((a) => a.status === "active");
  const uncollected = active.filter((a) => !a.collected);
  const latestRun = [...db.collectionRuns].sort((a, b) => b.date.localeCompare(a.date))[0];
  const openFailures = getOpenFailures(db);
  const pendingReports = db.artistReports.filter((r) => r.status === "pending");
  const pendingConcerts = db.concerts.filter((c) => c.status === "pending");
  const flagged = db.cheerRecords.filter((r) => r.flag && r.valid);
  const daily = getChart("daily", db).entries.slice(0, 5);
  const cheerTop = rankCheers(getMonthlyCheerCounts(db), getActiveArtists(db)).slice(0, 5);
  const top3Confirmed = db.monthlyTop3.some((r) => r.month === lastServiceMonth());

  return (
    <>
      <AdminHeader title="대시보드" desc="차트 운영 현황과 처리할 일을 한눈에 확인하세요." />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Stat label="차트 대상 아티스트" value={active.length - uncollected.length} sub={`활성 ${active.length} · 제외 ${db.artists.length - active.length}`} tone="dark" />
        <Stat
          label="최근 수집"
          value={latestRun?.status === "success" ? "정상" : "일부 실패"}
          tone={latestRun?.status === "success" ? undefined : "accent"}
          sub={latestRun ? fmtDateTime(latestRun.finishedAt) : "-"}
        />
        <Stat label="미처리 제보" value={pendingReports.length + pendingConcerts.length} sub={`아티스트 ${pendingReports.length} · 공연 ${pendingConcerts.length}`} tone={pendingReports.length + pendingConcerts.length ? "accent" : undefined} />
        <Stat label="부정 응원 의심" value={flagged.length} sub="검토 필요 기록" tone={flagged.length ? "accent" : undefined} />
      </div>

      <div className="mt-6 grid xl:grid-cols-2 gap-4">
        <Card title="처리할 일">
          <ul className="divide-y divide-line text-sm">
            <Todo href="/reports" label="아티스트 제보 검토" count={pendingReports.length} />
            <Todo href="/concerts" label="공연정보 제보 검토" count={pendingConcerts.length} />
            <Todo href="/collection" label="수집 실패 재수집" count={openFailures.length} />
            <Todo href="/collection" label="최초 수집 대기 아티스트" count={uncollected.length} />
            <Todo href="/cheers" label="부정 응원 의심 기록 검토" count={flagged.length} />
            <Todo href="/top3" label={`${monthLabel(lastServiceMonth())} 월간 종합 TOP 3 확정`} count={top3Confirmed ? 0 : 1} doneLabel="확정 완료" />
          </ul>
        </Card>

        <Card title="데이터 수집 상태" actions={<Link href="/collection" className="text-xs text-muted hover:text-fg">전체 보기 ›</Link>}>
          <div className="p-5 text-sm space-y-3">
            <div className="flex justify-between">
              <span className="text-muted">마지막 수집 시각</span>
              <span className="font-semibold">{latestRun ? fmtDateTime(latestRun.finishedAt) : "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">수집 대상</span>
              <span className="font-semibold">{latestRun?.artistCount ?? 0}팀</span>
            </div>
            <div>
              <p className="text-muted mb-2">미해결 실패</p>
              {openFailures.length === 0 ? (
                <p className="text-subtle">없음</p>
              ) : (
                <ul className="space-y-1.5">
                  {openFailures.map((f) => (
                    <li key={f.artistId + f.platform} className="flex items-center gap-2">
                      <Pill tone="accent">{f.platform === "melon" ? "멜론" : "Spotify"}</Pill>
                      <span className="font-semibold">{getArtist(f.artistId, db)?.name}</span>
                      <span className="text-muted truncate">{f.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
              {openFailures.length > 0 && (
                <p className="mt-3 text-xs text-up">일부 아티스트 수집 실패로 오늘 차트가 확정되지 않았어요.</p>
              )}
            </div>
          </div>
        </Card>

        <Card title="일간 차트 TOP 5" actions={<Link href="/charts" className="text-xs text-muted hover:text-fg">차트 관리 ›</Link>}>
          <MiniList items={daily.map((e) => ({ rank: e.rank, artist: e.artist, value: `${e.score.total.toFixed(2)}점` }))} />
        </Card>

        <Card title="이번 달 응원 TOP 5" actions={<Link href="/cheer-top3" className="text-xs text-muted hover:text-fg">응원 TOP 3 ›</Link>}>
          <MiniList items={cheerTop.map((e) => ({ rank: e.rank, artist: e.artist, value: `${e.count.toLocaleString()}회` }))} />
        </Card>
      </div>
    </>
  );
}

function Todo({ href, label, count, doneLabel = "없음" }: { href: string; label: string; count: number; doneLabel?: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between px-5 py-3 hover:bg-surface">
        <span>{label}</span>
        {count > 0 ? <span className={`${btn.small} bg-accent text-white`}>{count}건</span> : <span className="text-xs text-subtle">{doneLabel}</span>}
      </Link>
    </li>
  );
}

function MiniList({ items }: { items: { rank: number; artist: Parameters<typeof Avatar>[0]["artist"]; value: string }[] }) {
  return (
    <ol className="divide-y divide-line">
      {items.map((e) => (
        <li key={e.artist.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
          <span className="w-5 text-center font-bold tabular-nums">{e.rank}</span>
          <Avatar artist={e.artist} size={32} />
          <Link href={`/artists/${e.artist.id}`} className="flex-1 font-semibold truncate hover:underline">
            {e.artist.name}
          </Link>
          <span className="tabular-nums text-muted">{e.value}</span>
        </li>
      ))}
    </ol>
  );
}
