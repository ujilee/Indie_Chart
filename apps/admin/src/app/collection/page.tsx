import { ActionForm } from "@/components/ActionForm";
import Link from "next/link";
import { AdminHeader, Card, EmptyRow, Pill, Stat, Table, btn, fmtDateTime } from "@/components/ui";
import { getArtist, getMetricsSource } from "@indie/core/data";
import { readDb } from "@indie/core/db";
import { MELON_INDIE_DAILY_URL } from "@indie/core/melon";
import { hasSpotifyApiKeys } from "@indie/core/artist-image";
import { serviceToday } from "@indie/core/constants";
import { melonAutoEnabled, metricTargets } from "@/lib/collect";
import { getDataMode } from "@indie/core/data-mode";
import { collectArtist, registerChartArtists, retryFailure, runCollection, setMetricsSource } from "../actions";
import ImageSyncButton from "../ImageSyncButton";
import MelonCollectButton from "./MelonCollectButton";

export default async function AdminCollection() {
  const db = await readDb();
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
  const today = serviceToday();
  const targets = metricTargets(db);
  const doneToday = targets.filter((a) =>
    db.metricSnapshots.some((s) => s.artistId === a.id && s.date === today && s.source === "auto" && s.melonFans != null),
  ).length;
  const lastMetricsRun = runs.find((r) => r.kind === "artist-metrics");
  const spotifyKeys = hasSpotifyApiKeys();
  const mode = getDataMode();
  const real = mode === "supabase";
  const melonAuto = melonAutoEnabled();

  return (
    <>
      <AdminHeader
        title="데이터 수집 관리"
        desc={
          melonAuto
            ? "매일 낮 12시(KST) 예약 수집으로 멜론 인디 차트(곡 순위)와 아티스트 수치(멜론 팬맺기·발매곡 좋아요 합계, Spotify 팔로워)를 저장해요."
            : "멜론 수치는 관리자 입력으로 관리해요. 수집·입력 이력과 실패 내역을 확인해요."
        }
        actions={
          source === "mock" ? (
            <ActionForm action={runCollection}>
              <button className={btn.outline}>샘플 수집 실행</button>
            </ActionForm>
          ) : undefined
        }
      />

      <Card title="저장소" className="mb-4">
        <div className="p-5 space-y-3 text-sm">
          <p>
            지금 데이터는{" "}
            {mode === "supabase" ? (
              <Pill tone="accent">Supabase</Pill>
            ) : mode === "file" ? (
              <Pill tone="line">로컬 파일 (.data/db.json)</Pill>
            ) : (
              <Pill tone="line">데모 (저장 안 됨)</Pill>
            )}
            에 저장돼요.
          </p>
          {mode !== "supabase" && (
            <p className="text-xs text-subtle">저장소 루트의 .env.local에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 넣고 앱을 다시 켜면 Supabase로 바뀌어요.</p>
          )}
          {real && <p className="text-xs text-subtle">운영 DB예요. 샘플(데모) 데이터는 넣지 않고, 값이 없는 항목은 미수집으로 보여요.</p>}
        </div>
      </Card>

      {!real && (
      <Card title="차트 수치 출처" className="mb-4">
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
          <div className="space-y-1">
            <p>
              지금 차트는{" "}
              {source === "live" ? <Pill tone="accent">실제 수치</Pill> : <Pill tone="line">샘플 수치</Pill>}로 계산하고 있어요.
            </p>
            <p className="text-xs text-subtle">
              실제 수치: 멜론 인디 차트 수집 결과(곡 순위) + 자동 수집하거나 수치 입력 메뉴에서 넣은 팬·좋아요·팔로워. 값이 없는 항목은 미수집(0점)으로 계산돼요.
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
      )}

      {!melonAuto && (
        <Card title="멜론 자동 수집 꺼짐" className="mb-4">
          <div className="p-5 space-y-2 text-sm">
            <p>
              멜론은 공개 API가 없고 robots.txt가 수집기 접근을 막고 있어, 운영에서는 자동 수집을 끄고 관리자 입력으로 관리해요. 팬·좋아요·Spotify 수치는{" "}
              <Link href="/metrics" className="underline">
                수치 입력
              </Link>
              에서 넣어 주세요.
            </p>
            <p className="text-xs text-subtle">제휴나 허가를 받은 뒤 환경 변수 MELON_AUTO_COLLECT=1 로 켤 수 있어요.</p>
          </div>
        </Card>
      )}

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
            {melonAuto && <MelonCollectButton />}
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
        <Card
          title={`차트인 · 미등록 아티스트 (${unregistered.size})`}
          actions={
            unregistered.size > 0 ? (
              <ActionForm action={registerChartArtists.bind(null, [...unregistered].map(([melonId, a]) => ({ melonId, name: a.name })))}>
                <button className="text-xs font-semibold underline">모두 등록</button>
              </ActionForm>
            ) : undefined
          }
        >
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
                  <span className="shrink-0 flex items-center gap-3">
                    <a href={`https://www.melon.com/artist/detail.htm?artistId=${id}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-muted underline">
                      {id}
                    </a>
                    <ActionForm action={registerChartArtists.bind(null, [{ melonId: id, name: a.name }])}>
                      <button className={`${btn.small} bg-fg text-bg hover:bg-accent`}>등록</button>
                    </ActionForm>
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      {melonAuto && (
      <Card title="아티스트 수치 자동 수집" className="mb-4">
        <div className="p-5 space-y-4 text-sm">
          <MelonCollectButton kind="metrics" />
          <p>
            오늘({today}) 수집 <b className="tabular-nums">{doneToday}</b> / {targets.length}팀
            {lastMetricsRun && (
              <span className="text-muted">
                {" "}
                · 마지막 실행 {fmtDateTime(lastMetricsRun.finishedAt)} — {lastMetricsRun.note}
              </span>
            )}
          </p>
          {lastMetricsRun?.error && <p className="text-xs text-up">{lastMetricsRun.error}</p>}
          <ul className="text-xs text-subtle leading-relaxed list-disc pl-4 space-y-0.5">
            <li>멜론 ID가 있는 아티스트마다 팬맺기 수와 발매곡 좋아요 합계를 받아요. 요청 사이에 3초 간격을 두고, 멜론이 응답하지 않으면 바로 멈춰요.</li>
            <li>발매곡 목록은 7일에 한 번만 새로 받아요. 오늘 이미 수집한 아티스트는 건너뛰니, 시간 제한으로 멈추면 다시 누르면 이어서 수집해요.</li>
            <li>
              Spotify 팔로워:{" "}
              {spotifyKeys ? "공식 API로 시도해요. Spotify가 값을 주지 않으면 수치 입력에서 직접 넣어 주세요." : "SPOTIFY_CLIENT_ID·SECRET이 없어 수집하지 않아요. 수치 입력에서 직접 넣어 주세요."}{" "}
              월간 리스너는 공식 API에 없어 직접 입력만 돼요.
            </li>
            <li>멜론 robots.txt는 일반 수집기 접근을 허용하지 않아요. 정식 운영 전 법률 검토나 제휴를 권장해요.</li>
          </ul>
        </div>
      </Card>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <Stat label="마지막 수집" value={latest ? fmtDateTime(latest.finishedAt).slice(5) : "-"} sub={latest?.manual ? "수동 실행" : "정기 수집"} tone="dark" />
        <Stat
          label="수집 상태"
          value={!latest ? "-" : latest.status === "success" ? "정상" : latest.status === "failed" ? "실패" : "일부 실패"}
          tone={!latest || latest.status === "success" ? undefined : "accent"}
        />
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
                {!real && (
                  <ActionForm action={retryFailure.bind(null, latest!.id, f.artistId, f.platform)}>
                    <button className={`${btn.small} bg-fg text-bg hover:bg-accent`}>재수집</button>
                  </ActionForm>
                )}
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
                {real ? (
                  <Link href="/metrics" className="text-xs text-muted underline shrink-0">
                    수치 입력
                  </Link>
                ) : (
                  <ActionForm action={collectArtist.bind(null, a.id)}>
                    <button className={`${btn.small} bg-fg text-bg hover:bg-accent`}>수집 실행</button>
                  </ActionForm>
                )}
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
                {r.kind === "artist-metrics" && <span className="ml-2 text-xs text-muted">아티스트 수치</span>}
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
                {(r.kind === "melon-chart" || r.kind === "artist-metrics") && <p className="mt-1 text-xs text-muted max-w-64">{r.error ?? r.note}</p>}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
