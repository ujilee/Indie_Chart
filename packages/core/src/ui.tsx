import Link from "next/link";
import type { Artist } from "./types";

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-5xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function Badge({ children, tone = "dark" }: { children: React.ReactNode; tone?: "dark" | "light" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${
        tone === "dark" ? "bg-fg text-bg" : "border border-line text-muted"
      }`}
    >
      {children}
    </span>
  );
}

const SHADES = [
  ["#1a1a1a", "#4a4a4a"],
  ["#2b2b2b", "#8a8a8a"],
  ["#3d3d3d", "#b5b5b5"],
  ["#111111", "#666666"],
  ["#555555", "#d0d0d0"],
];

/** 아티스트 이미지. 이미지가 없으면 흑백 그라데이션 + 이니셜로 대체 */
export function Avatar({
  artist,
  size = 56,
  className = "",
  rounded = "full",
  fill = false,
}: {
  artist: Artist;
  size?: number;
  className?: string;
  rounded?: "full" | "xl";
  /** 부모 크기에 맞춤 (size는 이니셜 글자 크기 계산용) */
  fill?: boolean;
}) {
  const shape = rounded === "full" ? "rounded-full" : "rounded-2xl";
  const box = fill ? { width: "100%", height: "100%" } : { width: size, height: size };
  if (artist.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={artist.image}
        alt={artist.name}
        width={size}
        height={size}
        className={`${shape} object-cover shrink-0 ${className}`}
        style={box}
      />
    );
  }
  const [a, b] = SHADES[parseInt(artist.id.slice(1), 10) % SHADES.length];
  return (
    <div
      aria-label={artist.name}
      role="img"
      className={`${shape} shrink-0 grid place-items-center text-white font-bold select-none ${className}`}
      style={{
        ...box,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${a}, ${b})`,
        containerType: fill ? "inline-size" : undefined,
      }}
    >
      {/* fill 모드에서는 실제 렌더 크기에 비례해 글자 크기 조정 */}
      <span style={fill ? { fontSize: "34cqi" } : undefined}>{artist.name.slice(0, 1)}</span>
    </div>
  );
}

/** 순위 변동: ▲N / ▼N / — / NEW */
export function RankChange({ rank, prevRank, isNew }: { rank: number; prevRank: number | null; isNew?: boolean }) {
  if (isNew) return <span className="text-[11px] font-bold text-new">NEW</span>;
  if (prevRank == null || prevRank === rank) return <span className="text-sm text-subtle">—</span>;
  const diff = prevRank - rank;
  return diff > 0 ? (
    <span className="text-xs font-semibold text-up tabular-nums">▲ {diff}</span>
  ) : (
    <span className="text-xs font-semibold text-down tabular-nums">▼ {-diff}</span>
  );
}

export function SectionTitle({
  title,
  sub,
  href,
  hrefLabel = "더보기",
}: {
  title: string;
  sub?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">{title}</h2>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="text-sm text-muted hover:text-fg shrink-0">
          {hrefLabel} ›
        </Link>
      )}
    </div>
  );
}

export function PageTitle({ badge, title, desc }: { badge?: string; title: string; desc?: React.ReactNode }) {
  return (
    <div className="pt-8 sm:pt-12 pb-6">
      {badge && <Badge>{badge}</Badge>}
      <h1 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight">{title}</h1>
      {desc && <div className="mt-3 text-sm text-muted leading-relaxed">{desc}</div>}
    </div>
  );
}

export function formatNumber(n: number | null | undefined) {
  return n == null ? "-" : n.toLocaleString("ko-KR");
}

export function formatGain(n: number | null | undefined) {
  if (n == null) return null;
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("ko-KR")}`;
}
