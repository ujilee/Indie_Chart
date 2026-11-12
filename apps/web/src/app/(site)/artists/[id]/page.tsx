import Link from "next/link";
import { notFound } from "next/navigation";
import CheerButton from "@/components/CheerButton";
import { Avatar, Container, RankChange, formatGain, formatNumber } from "@indie/core/ui";
import { serviceToday } from "@indie/core/constants";
import {
  countValidConcerts,
  getArtist,
  getArtistConcerts,
  getArtistRanks,
  getArtistSnapshot,
} from "@indie/core/data";
import { readDb } from "@indie/core/db";
import { PERIODS } from "@indie/core/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = getArtist(id, await readDb());
  return { title: a ? `${a.name} — INDIE CHART` : "INDIE CHART" };
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${date.replaceAll("-", ".")} (${WEEKDAYS[d.getUTCDay()]})`;
}

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  const artist = getArtist(id, db);
  if (!artist || artist.status !== "active") notFound();

  const ranks = getArtistRanks(id, db);
  const daily = ranks[0];
  const snap = getArtistSnapshot(id, db);
  // 사용자에게는 향후 개최 예정인 승인 공연만 노출
  const upcoming = getArtistConcerts(id, db).filter((c) => c.status === "approved" && c.date >= serviceToday());
  const validCount = countValidConcerts(id, db);

  return (
    <Container>
      {/* 프로필 */}
      <section className="pt-8 sm:pt-12 flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-8">
        <span className="block size-32 sm:size-44 shrink-0">
          <Avatar artist={artist} size={160} fill />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted">{artist.genre}</p>
          <h1 className="mt-1 text-3xl sm:text-5xl font-extrabold tracking-tight break-keep">{artist.name}</h1>
          <p className="mt-1 text-muted">{artist.nameEn}</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <CheerButton artistId={artist.id} artistName={artist.name} size="lg" />
          <span className="text-xs text-subtle">하루 1회 응원할 수 있어요</span>
        </div>
      </section>

      {/* 종합 차트 순위 */}
      <section className="mt-10">
        <h2 className="text-lg font-extrabold mb-3">종합 차트 순위</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 rounded-2xl border border-line overflow-hidden">
          {ranks.map((r, i) => (
            <div
              key={r.period}
              className={`px-5 py-5 ${i % 2 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} sm:border-l sm:first:border-l-0 border-line ${
                i === 0 ? "bg-fg text-bg" : ""
              }`}
            >
              <p className={`text-xs font-semibold ${i === 0 ? "text-white/60" : "text-muted"}`}>
                {PERIODS.find((p) => p.key === r.period)!.label}
              </p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-3xl font-extrabold tabular-nums">{r.rank ?? "-"}</span>
                <span className="text-sm">{r.rank ? "위" : ""}</span>
                {r.rank && <RankChange rank={r.rank} prevRank={r.prevRank} isNew={r.comparable && r.prevRank == null} />}
              </div>
            </div>
          ))}
        </div>
        {daily.rank == null && (
          <p className="mt-2 text-xs text-muted">
            {artist.collected ? "현재 차트 순위가 없어요." : "최초 데이터 수집이 끝나면 차트에 반영돼요."}
          </p>
        )}
      </section>

      {/* 플랫폼 데이터 */}
      <section className="mt-10 grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-line p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">멜론</h2>
            {artist.platformIds.melon && (
              <a
                href={`https://www.melon.com/artist/timeline.htm?artistId=${artist.platformIds.melon}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted hover:text-fg"
              >
                멜론에서 보기 ↗
              </a>
            )}
          </div>
          <dl className="mt-4 space-y-3">
            <Stat label="전체 곡 좋아요" value={snap.melonLikes} gain={snap.melonLikesGain} />
            <Stat label="팬맺기" value={snap.melonFans} gain={snap.melonFansGain} />
          </dl>
        </div>
        <div className="rounded-2xl border border-line p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Spotify</h2>
            <a
              href={`https://open.spotify.com/artist/${artist.platformIds.spotify}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted hover:text-fg"
            >
              Spotify에서 보기 ↗
            </a>
          </div>
          <dl className="mt-4 space-y-3">
            <Stat label="팔로워" value={snap.spotifyFollowers} gain={snap.spotifyFollowersGain} />
          </dl>
        </div>
        <p className="sm:col-span-2 text-xs text-subtle">
          증가량은 전일 대비 수치이며, 매일 오전 1시(KST)에 수집됩니다.
        </p>
      </section>

      {/* 공연정보 */}
      <section className="mt-12">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">공연 정보</h2>
            {validCount > 0 && (
              <p className="mt-1 text-sm text-muted">
                30일 이내 예정 공연 <span className="font-bold text-accent">{validCount}건</span>이 차트에 반영되고 있어요.
              </p>
            )}
          </div>
          <Link
            href={`/report/concert?artist=${artist.id}`}
            className="shrink-0 h-10 px-5 rounded-full border border-fg text-sm font-semibold grid place-items-center hover:bg-fg hover:text-bg transition-colors"
          >
            공연 제보
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-2xl bg-surface px-6 py-10 text-center">
            <p className="font-bold">아직 등록된 공연정보가 없어요.</p>
            <p className="mt-1 text-sm text-muted">알고 있는 공연이 있다면 제보해 주세요!</p>
            <p className="mt-3 text-xs text-subtle">
              승인된 공연정보는 1건당 4점, 최대 20점까지 아티스트의 차트 점수에 추가돼요.
            </p>
          </div>
        ) : (
          <ul className="border-t-2 border-fg">
            {upcoming.map((c) => (
              <li key={c.id} className="border-b border-line py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <div className="sm:w-44 shrink-0">
                  <p className="font-bold tabular-nums">{formatDate(c.date)}</p>
                  <p className="text-sm text-muted">{c.time}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{c.title}</p>
                  <p className="text-sm text-muted">
                    {c.venue}
                    {c.address && ` · ${c.address}`}
                  </p>
                </div>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="self-start sm:self-center text-sm font-semibold underline underline-offset-2"
                >
                  공연·예매 정보 ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}

function Stat({ label, value, gain }: { label: string; value: number | null; gain: number | null }) {
  if (value == null) {
    return (
      <div className="flex items-baseline justify-between">
        <dt className="text-sm text-muted">{label}</dt>
        <dd className="text-sm text-subtle">데이터 확보 중</dd>
      </div>
    );
  }
  const g = formatGain(gain);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="flex items-baseline gap-2">
        <span className="text-xl font-extrabold tabular-nums">{formatNumber(value)}</span>
        {g && <span className={`text-xs font-semibold tabular-nums ${gain! > 0 ? "text-up" : "text-subtle"}`}>{g}</span>}
      </dd>
    </div>
  );
}
