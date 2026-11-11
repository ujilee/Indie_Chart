"use client";

import Link from "next/link";
import { useState } from "react";
import { PERIODS, type Artist, type Period } from "@/lib/types";
import { Avatar, RankChange } from "./ui";

/** 사용자 화면용 차트 행 (점수는 노출하지 않음) */
export interface PublicChartRow {
  rank: number;
  prevRank: number | null;
  isNew: boolean;
  artist: Artist;
}

export interface PublicChart {
  period: Period;
  label: string;
  rows: PublicChartRow[];
}

const PAGE = 20;

export default function ChartBoard({ charts, updatedAt }: { charts: PublicChart[]; updatedAt: string }) {
  const [period, setPeriod] = useState<Period>("daily");
  const [limit, setLimit] = useState(PAGE);
  const chart = charts.find((c) => c.period === period)!;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="차트 기간">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={p.key === period}
            onClick={() => {
              setPeriod(p.key);
              setLimit(PAGE);
            }}
            className={`h-9 sm:h-10 px-5 sm:px-7 rounded-full text-sm font-semibold transition-colors ${
              p.key === period ? "bg-fg text-bg" : "bg-surface text-subtle hover:text-fg"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        집계 기간 <span className="font-semibold text-fg">{chart.label}</span>
        <span className="mx-2 text-line">|</span>
        업데이트 {updatedAt}
      </p>

      <div className="mt-4 rounded-t-xl bg-fg text-bg grid grid-cols-[56px_48px_1fr] sm:grid-cols-[88px_72px_1fr_120px] items-center h-11 sm:h-12 px-2 sm:px-4 text-xs sm:text-sm font-semibold">
        <span className="text-center">순위</span>
        <span className="text-center">변동</span>
        <span className="pl-3">아티스트</span>
        <span className="hidden sm:block text-right pr-2">장르</span>
      </div>

      <ol>
        {chart.rows.slice(0, limit).map((row) => (
          <li key={row.artist.id} className="border-b border-line">
            <Link
              href={`/artists/${row.artist.id}`}
              className="grid grid-cols-[56px_48px_1fr] sm:grid-cols-[88px_72px_1fr_120px] items-center px-2 sm:px-4 py-3 sm:py-4 hover:bg-surface transition-colors"
            >
              <span className="text-center text-xl sm:text-2xl font-medium tabular-nums">{row.rank}</span>
              <span className="text-center">
                <RankChange rank={row.rank} prevRank={row.prevRank} isNew={row.isNew} />
              </span>
              <span className="flex items-center gap-3 sm:gap-5 min-w-0 pl-1 sm:pl-3">
                <span className="block size-12 sm:size-16 shrink-0">
                  <Avatar artist={row.artist} size={56} fill />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold truncate sm:text-[17px]">{row.artist.name}</span>
                  <span className="block text-xs sm:text-sm text-subtle truncate">
                    {row.artist.nameEn}
                    <span className="sm:hidden"> · {row.artist.genre}</span>
                  </span>
                </span>
              </span>
              <span className="hidden sm:block text-right pr-2 text-sm text-muted">{row.artist.genre}</span>
            </Link>
          </li>
        ))}
      </ol>

      {chart.rows.length > limit && (
        <button
          onClick={() => setLimit((l) => l + PAGE)}
          className="mt-6 mx-auto block h-11 px-8 rounded-full border border-line text-sm font-semibold hover:border-fg"
        >
          더보기
        </button>
      )}
    </section>
  );
}
