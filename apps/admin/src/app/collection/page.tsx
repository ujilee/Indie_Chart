import { ActionForm } from "@/components/ActionForm";
import Link from "next/link";
import { AdminHeader, Card, EmptyRow, Pill, Stat, Table, btn, fmtDateTime } from "@/components/ui";
import { getArtist, getMetricsSource } from "@indie/core/data";
import { readDb } from "@indie/core/db";
import { MELON_INDIE_DAILY_URL } from "@indie/core/melon";
import { collectArtist, retryFailure, runCollection, setMetricsSource } from "../actions";
import ImageSyncButton from "../ImageSyncButton";
import MelonCollectButton from "./MelonCollectButton";

export default function AdminCollection() {
  const db = readDb();
  const runs = [...db.collectionRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const latest = runs[0];
  const open = latest?.failures.filter((f) => !f.resolved) ?? [];
  const pending = db.artists.filter((a) => a.status === "active" && !a.collected);
  const source = getMetricsSource(db);
  const melon = [...db.melonCharts].sort((a, b) => b.chartDate.localeCompare(a.chartDate))[0];
  const registered = new Map(db.artists.filter((a) => a.platformIds.melon).map((a) => [a.platformIds.melon!, a] as const));
  // 차트에 올랐지만 아직 등록되지 않은 아티스트 (제보·등록 후보)
  const unregistered = new Map<string, { name: string; best: number }>();
  for (const e of melon?.entries ?? []) {
    for (const a of e.artists) {
      if (registered.has(a.melonId)) continue;
      const prev = unregistered.get(a.melonId);
      if (!prev || e.rank < prev.best) unregistered.set(a.melonId, { name: a.name, best: e.rank });
    }
  }
  const charted = new Set((melon?.entries ?? []).flatMap((e) => e.artists.map((a) => a.melonId)).filter((id) => registered.has(id)));
  const noMelonId = db.artists.filter((a) => a.status === "active" && !a.platformIds.melon);

  return (
    <>
      <AdminHeader
        title="데이터 수집 관리"
        desc="매일 오전 1시(KST) 멜론(곡 순위·곡별 좋아요·팬맺기)과 Spotify(팔로워)를 수집해 일간 스냅샷으로 저장해요."
        actions={
          source === "mock" ? (
            <ActionForm action={runCollection}>
              <button className={btn.outline}>샘플 수집 실행</button>
            </ActionForm>
          ) : undefined
        }
      />

      <Card title="차트 수치 출처" className="mb-4">
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
          <div className="space-y-1">
            <p>
              지금 차트는{" "}
              {source === "live" ? <Pill tone="accent">실제 수치</Pill> : <Pill tone="line">샘플 수치</Pill>}로 계산하고 있어요.
            </p>
            <p className="text-xs text-subtle">
              실제 수치: 멜론 인디 차트 수집 결과(곡 순위) + 수치 입력 메뉴에서 넣은 팬·좋아요·팔로워. 입력이 없는 항목은 미수집(0점)으로 계산돼요.
            </p>
          </div>
          <div className="flex gap-2">
            <ActionForm action={setMetricsSource.bind(null, "mock")}>
              <button className={source === "mock" ? btn.primary : btn.outline} disabled={source === "mock"}>
                샘플 수치
              </button>
            </ActionForm>
            <ActionForm action={setMetricsSource.bind(null, "live")}>
              <button className={source === "live" ? btn.primary : btn.outline} disabled={source === "live"}>
                실제 수치
              </button>
            </ActionForm>
          </div>
        </div>
      </Card>

      <div className="grid xl:grid-cols-[1fr_380px] gap-4 mb-4">
        <Card
          title="멜론 인디 일간 차트"
          actions={
            <a href={MELON_INDIE_DAILY_URL} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-fg">
              멜론에서 보기 ↗
            </a>
          }
        >
          <div className="p-5 space-y-4 text-sm">
            <MelonCollectButton />
            {melon ? (
              <p>
                최근 수집: <b>{melon.chartDate}</b> 차트 · {fmtDateTime(melon.collectedAt)} · {melon.entries.length}곡 · 등록 아티스트{" "}
                <b className="tabular-nums">{charted.size}</b>팀 차트인
              </p>
            ) : (
              <p className="text-muted">아직 수집한 차트가 없어요.</p>
            )}
            <p className="text-xs text-subtle leading-relaxed">
              차트 페이지 1개만 요청하고, 마지막 수집 후 10분 안에는 다시 요청하지 않아요. 아티스트는 멜론 아티스트 ID로 연결되니, 등록 아티스트에 멜론 ID를 꼭 넣어 주세요
              {noMelonId.length > 0 && <> (현재 {noMelonId.length}팀 없음)</>}.
            </p>
          </div>
        </Card>
        <Card title={`차트인 · 미등록 아티스트 (${unregistered.size})`}>
          <ul className="divide-y divide-line text-sm max-h-72 overflow-auto">
            {unregistered.size === 0 && <li className="px-5 py-6 text-center text-muted">{melon ? "모두 등록돼 있어요." : "수집 후 표시돼요."}</li>}
            {[...unregistered]
              .sort((a, b) => a[1].best - b[1].best)
              .map(([id, a]) => (
                <li key={id} className="flex items-center justify-between gap-2 px-5 py-2">
                  <span className="truncate">
                    <b className="tabular-nums mr-2 text-subtle">{a.best}위</b>
                    {a.name}
                  </span>
                  <a href={`https://www.melon.com/artist/detail.htm?artistId=${id}`} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-xs text-muted underline">
                    {id}
                  </a>
                </li>
              ))}
          </ul>
        </Card>
      </div>

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
                  <Link href={`/artists/${f.artistId}`} className="font-semibold hover:underline">
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
                  <Link href={`/artists/${a.id}`} className="font-semibold hover:underline">
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
                {r.kind === "melon-chart" && <span className="ml-2 text-xs text-muted">멜론 차트</span>}
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
              <td>
                {r.status === "success" ? <Pill tone="dark">정상</Pill> : r.status === "failed" ? <Pill tone="accent">실패</Pill> : <Pill tone="accent">일부 실패</Pill>}
                {r.kind === "melon-chart" && <p className="mt-1 text-xs text-muted max-w-64">{r.error ?? r.note}</p>}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
