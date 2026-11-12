"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import CheerButton from "@/components/CheerButton";
import { Avatar, formatNumber } from "@indie/core/ui";
import { rankWithTies } from "@indie/core/score";
import { useSession } from "@/lib/session";
import type { Artist, CheerRankEntry } from "@indie/core/types";

export default function CheerBoard({
  artists,
  month,
  lastMonth,
  counts,
  lastMonthTop3,
}: {
  artists: Artist[];
  month: string;
  lastMonth: string | null;
  counts: Record<string, number>;
  lastMonthTop3: CheerRankEntry[];
}) {
  const { remainingCheers, user, ready } = useSession();
  const [query, setQuery] = useState("");

  // 이번 달 누적 응원 (응원 성공 시 router.refresh로 갱신)
  const ranking = useMemo(() => {
    const list = artists.map((artist) => ({
      artist,
      count: counts[artist.id] ?? 0,
    }));
    return rankWithTies(list, (e) => e.count, (e) => e.artist.name).map(({ item, rank }) => ({
      ...item,
      rank: item.count > 0 ? rank : null,
    }));
  }, [artists, counts]);

  const top3 = ranking.filter((e) => e.rank != null && e.rank <= 3);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? ranking.filter((e) => e.artist.name.toLowerCase().includes(q) || e.artist.nameEn.toLowerCase().includes(q))
    : ranking;

  return (
    <div className="space-y-12">
      {/* 남은 응원 횟수 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-5 py-4">
        <div className="text-sm">
          <span className="text-muted">오늘 남은 응원</span>
          <span className={`ml-2 text-lg font-extrabold ${remainingCheers ? "text-accent" : "text-fg"}`}>
            {ready && remainingCheers != null ? `${remainingCheers}회` : "-"}
          </span>
        </div>
        {ready && !user && (
          <Link href="/login?redirect=/cheer" className="text-sm font-semibold underline underline-offset-2">
            로그인하고 응원하기
          </Link>
        )}
      </div>

      {/* 이번 달 응원 TOP 3 */}
      <section>
        <p className="text-xs font-semibold text-accent tracking-wide">LIVE · {month} 집계 중</p>
        <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">이번 달 응원 아티스트 TOP 3</h2>
        {top3.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-line py-12 text-center">
            <p className="font-bold">아직 이번 달 응원이 없어요.</p>
            <p className="text-sm text-muted mt-1">첫 번째 응원으로 좋아하는 아티스트를 TOP 3에 올려 주세요!</p>
          </div>
        ) : (
          <ol className="mt-5 grid grid-cols-3 gap-3 sm:gap-6">
            {top3.map((e) => (
              <li key={e.artist.id} className="text-center">
                <Link href={`/artists/${e.artist.id}`} className="block">
                  <div className="relative mx-auto size-20 sm:size-36">
                    <Avatar artist={e.artist} size={120} fill />
                    <span className="absolute -left-1 -top-1 size-7 sm:size-10 rounded-full bg-fg text-bg grid place-items-center text-sm sm:text-lg font-black">
                      {e.rank}
                    </span>
                  </div>
                  <p className="mt-3 font-bold text-sm sm:text-base truncate">{e.artist.name}</p>
                </Link>
                <p className="text-xs sm:text-sm text-muted tabular-nums">
                  응원 <span className="font-bold text-fg">{formatNumber(e.count)}</span>회
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 전체 응원 순위 + 검색 */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">전체 응원 순위</h2>
          <label className="relative sm:w-72">
            <span className="sr-only">아티스트 검색</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="아티스트 검색"
              className="w-full h-11 rounded-full bg-surface pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-fg"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </label>
        </div>
        <ol className="border-t-2 border-fg">
          {filtered.length === 0 && (
            <li className="py-12 text-center text-sm text-muted">
              검색 결과가 없어요.{" "}
              <Link href="/report/artist" className="underline underline-offset-2 text-fg">
                아티스트 제보하기
              </Link>
            </li>
          )}
          {filtered.map((e) => (
            <li key={e.artist.id} className="flex items-center gap-3 sm:gap-5 border-b border-line py-3 px-1 sm:px-3">
              <span className="w-8 sm:w-12 text-center text-lg sm:text-xl font-medium tabular-nums">{e.rank ?? "-"}</span>
              <Link href={`/artists/${e.artist.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                <span className="block size-11 sm:size-14 shrink-0">
                  <Avatar artist={e.artist} size={52} fill />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold truncate">{e.artist.name}</span>
                  <span className="block text-xs sm:text-sm text-muted tabular-nums">
                    이번 달 응원 {formatNumber(e.count)}회
                  </span>
                </span>
              </Link>
              <CheerButton artistId={e.artist.id} artistName={e.artist.name} size="sm" />
            </li>
          ))}
        </ol>
      </section>

      {/* 지난달 결과 */}
      <section>
        <p className="text-xs font-semibold text-muted tracking-wide">FINAL · {lastMonth}</p>
        <h2 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">지난달 최종 응원 TOP 3</h2>
        <ol className="mt-4 rounded-2xl bg-surface divide-y divide-line">
          {lastMonthTop3.map((e) => (
            <li key={e.artist.id}>
              <Link href={`/artists/${e.artist.id}`} className="flex items-center gap-4 px-4 sm:px-6 py-3">
                <span className="w-6 text-center font-black text-lg">{e.rank}</span>
                <Avatar artist={e.artist} size={40} />
                <span className="flex-1 font-bold truncate">{e.artist.name}</span>
                <span className="text-sm text-muted tabular-nums">{formatNumber(e.count)}회</span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-subtle">응원 횟수가 같은 아티스트는 공동 순위로, 이름 가나다순으로 표시돼요.</p>
      </section>
    </div>
  );
}
