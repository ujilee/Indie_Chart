import { ActionForm } from "@/components/ActionForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader, Card, Pill, btn, fmtDateTime, fmtScore } from "@/components/ui";
import { Avatar } from "@indie/core/ui";
import { PERIODS } from "@indie/core/types";
import { countValidConcerts, getArtist, getArtistConcerts, getChart, getMonthlyCheerCounts } from "@indie/core/data";
import { readDb } from "@indie/core/db";
import { collectArtist, setArtistStatus } from "../../actions";
import ArtistForm from "../ArtistForm";
import ImageSyncButton from "../../ImageSyncButton";
import { WEB_URL } from "@/lib/urls";

export default async function EditArtist({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const db = readDb();
  const artist = getArtist(id, db);
  if (!artist) notFound();

  const ranks = PERIODS.map((p) => ({ ...p, entry: getChart(p.key, db).entries.find((e) => e.artist.id === id) }));
  const concerts = getArtistConcerts(id, db);
  const valid = countValidConcerts(id, db);
  const cheers = getMonthlyCheerCounts(db)[id] ?? 0;

  return (
    <>
      <Link href="/artists" className="text-sm text-muted hover:text-fg">
        ‹ 아티스트 목록
      </Link>
      <div className="mt-3">
        <AdminHeader
          title={artist.name}
          desc={`${artist.id} · 등록 ${artist.createdAt.slice(0, 10)}`}
          actions={
            <>
              {artist.status === "active" && (
                <a href={`${WEB_URL}/artists/${artist.id}`} target="_blank" rel="noreferrer" className={btn.outline}>
                  서비스 화면 ↗
                </a>
              )}
              {artist.status === "active" && !artist.collected && (
                <ActionForm action={collectArtist.bind(null, artist.id)}>
                  <button className={btn.primary}>최초 데이터 수집</button>
                </ActionForm>
              )}
              <ActionForm action={setArtistStatus.bind(null, artist.id, artist.status === "active" ? "excluded" : "active")}>
                <button className={artist.status === "active" ? btn.danger : btn.primary}>
                  {artist.status === "active" ? "차트에서 제외" : "차트 대상으로 복구"}
                </button>
              </ActionForm>
            </>
          }
        />
      </div>
      {created && (
        <p className="mb-4 rounded-xl bg-fg text-bg px-4 py-3 text-sm">
          아티스트가 등록되었어요. 최초 데이터 수집이 끝나면 차트에 반영돼요.
        </p>
      )}

      <div className="grid xl:grid-cols-[1fr_340px] gap-4 items-start">
        <Card title="기본 정보 · 플랫폼 ID">
          <div className="px-5 pt-5 flex flex-wrap items-center gap-4">
            <Avatar artist={artist} size={80} />
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {artist.status === "excluded" ? <Pill tone="line">제외</Pill> : artist.collected ? <Pill tone="dark">차트 대상</Pill> : <Pill tone="warn">수집 대기</Pill>}
                <Pill tone={artist.image ? "blue" : "line"}>
                  {!artist.image ? "이미지 없음" : artist.imageSource === "manual" ? "이미지 직접 입력" : "Spotify 이미지"}
                </Pill>
                {artist.imageUpdatedAt && <span className="text-xs text-subtle">{fmtDateTime(artist.imageUpdatedAt)}</span>}
              </div>
              <ImageSyncButton artistId={artist.id} label={artist.image ? "Spotify 이미지로 다시 가져오기" : undefined} />
            </div>
          </div>
          <ArtistForm artist={artist} />
        </Card>

        <div className="space-y-4">
          <Card title="차트 순위">
            <ul className="divide-y divide-line text-sm">
              {ranks.map((r) => (
                <li key={r.key} className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-muted">{r.label}</span>
                  <span className="tabular-nums">
                    {r.entry ? (
                      <>
                        <b>{r.entry.rank}위</b> <span className="text-subtle">· {fmtScore(r.entry.score.total)}점</span>
                      </>
                    ) : (
                      "-"
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="참여 지표">
            <ul className="divide-y divide-line text-sm">
              <li className="flex justify-between px-5 py-2.5">
                <span className="text-muted">이번 달 유효 응원</span>
                <b className="tabular-nums">{cheers.toLocaleString()}회</b>
              </li>
              <li className="flex justify-between px-5 py-2.5">
                <span className="text-muted">유효 공연 (30일 이내)</span>
                <b className="tabular-nums">
                  {valid}건 · +{Math.min(20, valid * 4)}점
                </b>
              </li>
            </ul>
          </Card>
          <Card title={`공연 정보 (${concerts.length})`} actions={<Link href={`/concerts?artist=${artist.id}&status=all`} className="text-xs text-muted hover:text-fg">관리 ›</Link>}>
            <ul className="divide-y divide-line text-sm max-h-72 overflow-auto">
              {concerts.length === 0 && <li className="px-5 py-6 text-center text-muted">등록된 공연이 없어요.</li>}
              {concerts.map((c) => (
                <li key={c.id} className="px-5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular-nums font-semibold">{c.date}</span>
                    <Pill tone={c.status === "approved" ? "dark" : c.status === "pending" ? "warn" : "line"}>
                      {{ approved: "승인", pending: "대기", rejected: "반려", canceled: "취소" }[c.status]}
                    </Pill>
                  </div>
                  <p className="text-muted truncate">{c.title}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
