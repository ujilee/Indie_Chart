import Link from "next/link";
import ChartBoard, { type PublicChart } from "@/components/ChartBoard";
import { Avatar, Container } from "@indie/core/ui";
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

  // 월간 TOP 3의 순위 변동: 같은 달 월간 차트의 직전 달 대비 변동을 쓴다
  const monthly = getChart("monthly", db);
  const [my, mm] = monthly.label.split(".");
  const sameMonth = top3.month === `${my}년 ${Number(mm)}월`;
  const top3Cards: Top3Card[] = top3.entries.map((e) => {
    const row = sameMonth ? monthly.entries.find((m) => m.artist.id === e.artist.id) : undefined;
    return {
      rank: e.rank,
      artist: e.artist,
      change: row ? { prevRank: row.prevRank, isNew: monthly.comparable && row.prevRank == null } : null,
    };
  });

  return (
    <Container>
      {/* 타이틀 */}
      <div className="pt-8 sm:pt-12">
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">Indie Artist Chart</h1>
        <p className="mt-3 text-sm text-muted leading-relaxed break-keep">음악과 팬들의 응원으로 만나는, 지금 가장 주목받는 인디 아티스트</p>
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
            <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
              {top3.month ? `${top3.month.replace(/^\d+년\s*/, "")} 인디 TOP 3` : "인디 TOP 3"}
            </h2>
          </div>
        </div>
        {top3Cards.length === 0 ? (
          <p className="text-sm text-muted py-10 text-center border border-line rounded-2xl">
            월간 집계가 확정되면 TOP 3가 공개됩니다.
          </p>
        ) : (
          <Top3Cards cards={top3Cards} />
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

interface Top3Card {
  rank: number;
  artist: Top3Artist;
  /** 직전 달 대비 순위 변동. 비교할 차트가 없으면 null (배지 숨김) */
  change: { prevRank: number | null; isNew: boolean } | null;
}
type Top3Artist = ReturnType<typeof getMonthlyTop3>["entries"][number]["artist"];

/**
 * 월간 TOP 3 카드: 세로로 긴 캡슐 모양 이미지 + 이름 + 순위 변동 배지,
 * 카드 왼쪽 아래에 외곽선 숫자로 순위를 겹쳐 보여 준다. 모바일은 가로로 넘겨 본다.
 */
function Top3Cards({ cards }: { cards: Top3Card[] }) {
  return (
    <ol className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-1 sm:gap-4 overflow-x-auto snap-x snap-mandatory sm:overflow-visible sm:justify-between [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {cards.map((c) => (
        <li key={c.artist.id} className="relative shrink-0 snap-start pl-10 sm:pl-14 pb-1">
          <span
            aria-hidden
            className="absolute left-0 bottom-0 z-0 text-[88px] sm:text-[120px] leading-[0.8] font-black text-transparent [-webkit-text-stroke:2px_var(--color-fg)] select-none"
          >
            {c.rank}
          </span>
          <Link
            href={`/artists/${c.artist.id}`}
            className="group relative z-10 block w-36 sm:w-52 aspect-[2/3] overflow-hidden rounded-full bg-surface"
          >
            <Avatar artist={c.artist} size={208} fill rounded="xl" className="group-hover:scale-[1.04] transition-transform duration-300" />
            <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/45 to-transparent" aria-hidden />
            <span className="absolute inset-x-0 bottom-[14%] flex flex-col items-center gap-2 px-4 text-center">
              <span className="sr-only">{c.rank}위</span>
              <span className="w-full truncate text-sm sm:text-base font-bold text-white">{c.artist.name}</span>
              {c.change && (
                <span className="inline-flex h-6 sm:h-7 min-w-10 items-center justify-center rounded-full bg-black/60 px-3 backdrop-blur [&_*]:!text-[12px]">
                  <Top3Change rank={c.rank} {...c.change} />
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function Top3Change({ rank, prevRank, isNew }: { rank: number; prevRank: number | null; isNew: boolean }) {
  if (isNew) return <span className="font-bold text-new">NEW</span>;
  if (prevRank == null || prevRank === rank) return <span className="font-bold text-white/80">—</span>;
  const diff = prevRank - rank;
  return diff > 0 ? (
    <span className="font-bold text-up tabular-nums">▲{diff}</span>
  ) : (
    <span className="font-bold text-down tabular-nums">▼{-diff}</span>
  );
}
