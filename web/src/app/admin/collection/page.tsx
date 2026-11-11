import { ActionForm } from "@/components/admin/ActionForm";
import Link from "next/link";
import { AdminHeader, Card, EmptyRow, Pill, Stat, Table, btn, fmtDateTime } from "@/components/admin/ui";
import { getArtist } from "@/lib/data";
import { readDb } from "@/lib/db";
import { collectArtist, retryFailure, runCollection } from "../actions";
import ImageSyncButton from "../ImageSyncButton";

export default function AdminCollection() {
  const db = readDb();
  const runs = [...db.collectionRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const latest = runs[0];
  const open = latest?.failures.filter((f) => !f.resolved) ?? [];
  const pending = db.artists.filter((a) => a.status === "active" && !a.collected);

  return (
    <>
      <AdminHeader
        title="데이터 수집 관리"
        desc="매일 오전 1시(KST) 멜론(곡 순위·곡별 좋아요·팬맺기)과 Spotify(팔로워)를 수집해 일간 스냅샷으로 저장해요."
        actions={
          <ActionForm action={runCollection}>
            <button className={btn.primary}>지금 재수집 실행</button>
          </ActionForm>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <Stat label="마지막 수집" value={latest ? fmtDateTime(latest.finishedAt).slice(5) : "-"} sub={latest?.manual ? "수동 실행" : "정기 수집"} tone="dark" />
        <Stat label="수집 상태" value={latest?.status === "success" ? "정상" : "일부 실패"} tone={latest?.status === "success" ? undefined : "accent"} />
        <Stat label="미해결 실패" value={open.length} tone={open.length ? "accent" : undefined} />
        <Stat label="최초 수집 대기" value={pending.length} sub="수집 후 차트 반영" tone={pending.length ? "accent" : undefined} />
      </div>

      <div className="grid xl:grid-cols-2 gap-4 mb-4">
        <Card title="실패 내역 (최근 수집)">
          <ul className="divide-y divide-line text-sm">
            {open.length === 0 && <li className="px-5 py-8 text-center text-muted">미해결 실패가 없어요.</li>}
            {open.map((f) => (
              <li key={f.artistId + f.platform} className="flex items-center gap-3 px-5 py-3">
                <Pill tone="accent">{f.platform === "melon" ? "멜론" : "Spotify"}</Pill>
                <div className="flex-1 min-w-0">
                  <Link href={`/admin/artists/${f.artistId}`} className="font-semibold hover:underline">
                    {getArtist(f.artistId, db)?.name}
                  </Link>
                  <p className="text-xs text-muted truncate">{f.reason}</p>
                </div>
                <ActionForm action={retryFailure.bind(null, latest!.id, f.artistId, f.platform)}>
                  <button className={`${btn.small} bg-fg text-bg hover:bg-accent`}>재수집</button>
                </ActionForm>
              </li>
            ))}
          </ul>
          <p className="px-5 pb-4 text-xs text-subtle">수집 실패는 0점이 아닌 미수집으로 처리되며, 실패가 남아 있으면 순위를 확정하지 않아요.</p>
        </Card>

        <Card title="최초 수집 대기 아티스트">
          <ul className="divide-y divide-line text-sm">
            {pending.length === 0 && <li className="px-5 py-8 text-center text-muted">대기 중인 아티스트가 없어요.</li>}
            {pending.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <Link href={`/admin/artists/${a.id}`} className="font-semibold hover:underline">
                    {a.name}
                  </Link>
                  <p className="text-xs text-muted font-mono truncate">Spotify {a.platformIds.spotify}</p>
                </div>
                <ActionForm action={collectArtist.bind(null, a.id)}>
                  <button className={`${btn.small} bg-fg text-bg hover:bg-accent`}>수집 실행</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="프로필 이미지" className="mb-4">
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
          <div className="space-y-1">
            <p>
              Spotify 이미지 <b className="tabular-nums">{db.artists.filter((a) => a.image && a.imageSource !== "manual").length}</b>팀 · 직접 입력{" "}
              <b className="tabular-nums">{db.artists.filter((a) => a.imageSource === "manual").length}</b>팀 · 이미지 없음{" "}
              <b className="tabular-nums text-accent">{db.artists.filter((a) => !a.image).length}</b>팀
            </p>
            <p className="text-xs text-subtle">
              각 아티스트의 Spotify ID로 프로필 이미지를 가져와요. 관리자가 직접 입력한 이미지는 덮어쓰지 않아요.
            </p>
          </div>
          <ImageSyncButton label="전체 이미지 갱신" />
        </div>
      </Card>

      <Card title="수집 이력">
        <Table head={["기준일", "시작", "종료", "대상", "실패", "상태"]} minWidth={640}>
          {runs.length === 0 && <EmptyRow colSpan={6} />}
          {runs.map((r) => (
            <tr key={r.id}>
              <td className="font-semibold tabular-nums">
                {r.date}
                {r.manual && <span className="ml-2 text-xs text-muted">수동</span>}
              </td>
              <td className="text-muted tabular-nums">{fmtDateTime(r.startedAt)}</td>
              <td className="text-muted tabular-nums">{fmtDateTime(r.finishedAt)}</td>
              <td className="tabular-nums">{r.artistCount}팀</td>
              <td className="text-xs">
                {r.failures.length === 0
                  ? "-"
                  : r.failures.map((f) => (
                      <div key={f.artistId + f.platform} className={f.resolved ? "text-subtle line-through" : "text-up"}>
                        {getArtist(f.artistId, db)?.name} · {f.platform === "melon" ? "멜론" : "Spotify"}
                      </div>
                    ))}
              </td>
              <td>{r.status === "success" ? <Pill tone="dark">정상</Pill> : <Pill tone="accent">일부 실패</Pill>}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
