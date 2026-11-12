import Link from "next/link";
import ChartBoard, { type PublicChart } from "@/components/ChartBoard";
import { Avatar, Badge, Container } from "@indie/core/ui";
import { getChart, getMonthlyTop3 } from "@indie/core/data";
import { PERIODS } from "@indie/core/types";

export default function Home() {
  const top3 = getMonthlyTop3();
  const charts: PublicChart[] = PERIODS.map(({ key }) => {
    const c = getChart(key);
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
          <ol className="grid grid-cols-3 gap-3 sm:gap-6">
            {top3.entries.map((e) => (
              <li key={e.artist.id}>
                <Link href={`/artists/${e.artist.id}`} className="group block">
                  <div className="relative aspect-square overflow-hidden rounded-2xl">
                    <Avatar
                      artist={e.artist}
                      size={200}
                      fill
                      rounded="xl"
                      className="group-hover:scale-[1.03] transition-transform"
                    />
                    <span className="absolute left-2 top-2 sm:left-4 sm:top-3 text-3xl sm:text-6xl font-black text-white drop-shadow">
                      {e.rank}
                    </span>
                  </div>
                  <p className="mt-2 sm:mt-3 font-bold text-sm sm:text-lg truncate">{e.artist.name}</p>
                  <p className="text-xs sm:text-sm text-subtle truncate">{e.artist.genre}</p>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 차트 */}
      <section className="mt-14">
        <ChartBoard charts={charts} updatedAt={getChart("daily").updatedAt} />
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
