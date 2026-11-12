import Link from "next/link";
import ChartBoard, { type PublicChart } from "@/components/ChartBoard";
import { Avatar, Badge, Container } from "@indie/core/ui";
import { getChart, getMonthlyTop3 } from "@indie/core/data";
import { readDb } from "@indie/core/db";
import { PERIODS } from "@indie/core/types";

export default async function Home() {
  const db = await readDb();
  const top3 = getMonthlyTop3(db);
  const charts: PublicChart[] = PERIODS.map(({ key }) => {
    const c = getChart(key, db);
    return {
      period: key,
      label: c.label,
      rows: c.entries.map((e) => ({
        rank: e.rank,
        prevRank: e.prevRank,
        isNew: c.comparable && e.prevRank == null,
        artist: e.artist,
      })),
    };
  });

  return (
    <Container>
      {/* 타이틀 */}
      <div className="pt-8 sm:pt-12">
        <Badge>CHART</Badge>
        <h1 className="mt-3 text-4xl sm:text-6xl font-extrabold tracking-tight">Indie Artist Chart</h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          멜론·Spotify 음악 플랫폼 데이터, 공연 활동, 팬들의 응원을 종합한 국내 인디 아티스트 순위입니다.{" "}
          <Link href="/guide" className="underline underline-offset-2 hover:text-fg">
            순위 산정 기준
          </Link>
        </p>
      </div>

      {/* 아티스트 제보 배너 */}
      <Link
        href="/report/artist"
        className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-line px-5 sm:px-7 py-4 sm:py-5 hover:border-fg transition-colors"
      >
        <div>
          <p className="font-bold">좋아하는 아티스트가 차트에 없나요?</p>
          <p className="text-sm text-muted mt-0.5">Spotify 정보만 있으면 누구나 제보할 수 있어요.</p>
        </div>
        <span className="shrink-0 text-sm font-semibold">제보하기 ›</span>
      </Link>

      {/* 월간 인디 TOP 3 */}
      <section className="mt-12">
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-xs font-semibold text-accent tracking-wide">MONTHLY TOP 3</p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">{top3.month ? `${top3.month} 월간 인디 TOP 3` : "월간 인디 TOP 3"}</h2>
          </div>
        </div>
        {top3.entries.length === 0 ? (
          <p className="text-sm text-muted py-10 text-center border border-line rounded-2xl">
            월간 집계가 확정되면 TOP 3가 공개됩니다.
          </p>
        ) : (
          <Podium entries={top3.entries} />
        )}
      </section>

      {/* 차트 */}
      <section className="mt-14">
        <ChartBoard charts={charts} updatedAt={getChart("daily", db).updatedAt} />
      </section>

      {/* 응원하기 유도 */}
      <Link
        href="/cheer"
        className="mt-14 block rounded-2xl bg-fg text-bg px-6 sm:px-10 py-8 sm:py-10 group"
      >
        <p className="text-xs font-semibold text-accent tracking-wide">CHEER</p>
        <p className="mt-2 text-xl sm:text-3xl font-extrabold tracking-tight">이번 달 월간 아티스트 응원 TOP 3에 도전!</p>
        <p className="mt-2 text-sm text-white/60">좋아하는 아티스트를 응원하고 결과를 확인해 보세요.</p>
        <span className="mt-6 inline-flex h-11 items-center px-6 rounded-full bg-bg text-fg text-sm font-bold group-hover:bg-accent group-hover:text-white transition-colors">
          응원하러 가기 ›
        </span>
      </Link>
    </Container>
  );
}

type Top3Entry = ReturnType<typeof getMonthlyTop3>["entries"][number];

/** 순위별 단상 높이·아바타 크기 (공동 순위는 같은 높이) */
const PODIUM = {
  1: { block: "h-24 sm:h-32 bg-fg text-bg", avatar: "size-16 sm:size-24", px: 96 },
  2: { block: "h-16 sm:h-24 bg-surface text-fg", avatar: "size-14 sm:size-20", px: 80 },
  3: { block: "h-12 sm:h-16 bg-surface text-fg", avatar: "size-14 sm:size-20", px: 80 },
} as const;

/** 월간 TOP 3 시상대: 왼쪽 2위 · 가운데 1위 · 오른쪽 3위. 공동 순위로 3팀을 넘으면 아래에 이어서 보여 준다 */
function Podium({ entries }: { entries: Top3Entry[] }) {
  const [first, second, third, ...rest] = entries;
  const slots = [second, first, third];
  return (
    <div>
      <ol className="grid grid-cols-3 items-end gap-2 sm:gap-4 max-w-2xl mx-auto">
        {slots.map((e, i) =>
          e ? (
            <PodiumSlot key={e.artist.id} entry={e} />
          ) : (
            <li key={`empty-${i}`} aria-hidden />
          ),
        )}
      </ol>
      {rest.length > 0 && (
        <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
          {rest.map((e) => (
            <li key={e.artist.id}>
              <Link href={`/artists/${e.artist.id}`} className="inline-flex items-center gap-2 hover:underline underline-offset-2">
                <Avatar artist={e.artist} size={28} />
                <span className="font-bold tabular-nums">공동 {e.rank}위</span>
                <span className="truncate">{e.artist.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PodiumSlot({ entry: e }: { entry: Top3Entry }) {
  const s = PODIUM[Math.min(Math.max(e.rank, 1), 3) as 1 | 2 | 3];
  return (
    <li className="min-w-0">
      <Link href={`/artists/${e.artist.id}`} className="group flex flex-col items-center text-center">
        <div className={`${s.avatar} rounded-full overflow-hidden ring-1 ring-line`}>
          <Avatar artist={e.artist} size={s.px} fill className="group-hover:scale-[1.05] transition-transform" />
        </div>
        <p className="mt-2 w-full font-bold text-sm sm:text-base truncate">{e.artist.name}</p>
        <p className="w-full text-xs text-subtle truncate">{e.artist.genre}</p>
        <div className={`mt-3 w-full rounded-t-xl grid place-items-center ${s.block}`}>
          <span className="text-2xl sm:text-4xl font-black tabular-nums">{e.rank}</span>
        </div>
      </Link>
    </li>
  );
}
