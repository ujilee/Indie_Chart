import Link from "next/link";

export function AdminHeader({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-bg ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
          <h2 className="font-bold">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "accent" | "dark" }) {
  return (
    <div className={`rounded-2xl px-5 py-4 ${tone === "dark" ? "bg-fg text-bg" : "border border-line"}`}>
      <p className={`text-xs font-semibold ${tone === "dark" ? "text-white/60" : "text-muted"}`}>{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums ${tone === "accent" ? "text-accent" : ""}`}>{value}</p>
      {sub && <p className={`mt-0.5 text-xs ${tone === "dark" ? "text-white/60" : "text-subtle"}`}>{sub}</p>}
    </div>
  );
}

/** 가로 스크롤되는 표 */
export function Table({ head, children, minWidth = 720 }: { head: React.ReactNode[]; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="bg-fg text-bg text-left text-xs">
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2.5 font-semibold whitespace-nowrap first:pl-5 last:pr-5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&_td]:px-3 [&_td]:py-3 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyRow({ colSpan, children = "데이터가 없어요." }: { colSpan: number; children?: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="!py-12 text-center text-muted">
        {children}
      </td>
    </tr>
  );
}

const PILL: Record<string, string> = {
  dark: "bg-fg text-bg",
  accent: "bg-accent text-white",
  warn: "bg-new/15 text-[#9a6700]",
  muted: "bg-surface text-muted",
  blue: "bg-down/10 text-down",
  line: "border border-line text-muted",
};

export function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: keyof typeof PILL }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${PILL[tone]}`}>
      {children}
    </span>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; count?: number; key: string }[]; active: string }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`h-9 px-4 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 ${
            t.key === active ? "bg-fg text-bg" : "bg-surface text-muted hover:text-fg"
          }`}
        >
          {t.label}
          {t.count != null && (
            <span className={`text-xs tabular-nums ${t.key === active ? "text-white/70" : "text-subtle"}`}>{t.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

export const btn = {
  primary: "h-9 px-4 rounded-full bg-fg text-bg text-sm font-semibold hover:bg-accent transition-colors whitespace-nowrap inline-flex items-center",
  outline: "h-9 px-4 rounded-full border border-line text-sm font-semibold hover:border-fg transition-colors whitespace-nowrap inline-flex items-center",
  danger: "h-9 px-4 rounded-full border border-up/40 text-up text-sm font-semibold hover:bg-up hover:text-white transition-colors whitespace-nowrap inline-flex items-center",
  small: "h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap inline-flex items-center",
};

export const adminInput =
  "h-10 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-fg transition-colors placeholder:text-subtle";

export function fmtDateTime(iso: string) {
  // KST 표기
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function fmtScore(n: number) {
  return n.toFixed(2);
}
