import Link from "next/link";
import { AdminHeader, Card, EmptyRow, Pill, Table, Tabs, adminInput, btn } from "@/components/ui";
import { Avatar } from "@indie/core/ui";
import { countValidConcerts, getChart } from "@indie/core/data";
import { readDb } from "@indie/core/db";

type Filter = "all" | "active" | "uncollected" | "excluded";

export default async function AdminArtists({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "all" } = await searchParams;
  const db = readDb();
  const filter = (["all", "active", "uncollected", "excluded"].includes(status) ? status : "all") as Filter;
  const daily = new Map(getChart("daily", db).entries.map((e) => [e.artist.id, e.rank]));

  const match = (a: (typeof db.artists)[number]) =>
    filter === "all" ||
    (filter === "active" && a.status === "active" && a.collected) ||
    (filter === "uncollected" && a.status === "active" && !a.collected) ||
    (filter === "excluded" && a.status === "excluded");
  const query = q.trim().toLowerCase();
  const list = db.artists
    .filter(match)
    .filter((a) => !query || a.name.toLowerCase().includes(query) || a.nameEn.toLowerCase().includes(query) || a.platformIds.spotify.includes(q.trim()))
    .sort((a, b) => a.seq - b.seq);

  const count = (f: Filter) => db.artists.filter((a) => f === "all" || (f === "active" ? a.status === "active" && a.collected : f === "uncollected" ? a.status === "active" && !a.collected : a.status === "excluded")).length;
  const href = (s: string) => `/artists?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <AdminHeader
        title="아티스트 관리"
        desc="차트 대상 아티스트와 플랫폼별 ID를 관리해요. 신규 아티스트는 최초 데이터 수집 후 차트에 반영돼요."
        actions={
          <Link href="/artists/new" className={btn.primary}>
            + 아티스트 등록
          </Link>
        }
      />
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <Tabs
          active={filter}
          items={[
            { key: "all", label: "전체", href: href("all"), count: count("all") },
            { key: "active", label: "차트 대상", href: href("active"), count: count("active") },
            { key: "uncollected", label: "수집 대기", href: href("uncollected"), count: count("uncollected") },
            { key: "excluded", label: "제외", href: href("excluded"), count: count("excluded") },
          ]}
        />
        <form className="flex gap-2 mb-4">
          <input type="hidden" name="status" value={filter} />
          <input name="q" defaultValue={q} placeholder="이름, Spotify ID 검색" className={`${adminInput} w-56`} />
          <button className={btn.outline}>검색</button>
        </form>
      </div>
      <Card>
        <Table head={["아티스트", "장르", "Spotify ID", "멜론 ID", "일간 순위", "유효 공연", "상태", ""]} minWidth={900}>
          {list.length === 0 && <EmptyRow colSpan={8} />}
          {list.map((a) => (
            <tr key={a.id} className="hover:bg-surface/60">
              <td>
                <Link href={`/artists/${a.id}`} className="flex items-center gap-3">
                  <Avatar artist={a} size={36} />
                  <span>
                    <span className="block font-semibold">{a.name}</span>
                    <span className="block text-xs text-subtle">{a.nameEn || "-"} · {a.id}</span>
                  </span>
                </Link>
              </td>
              <td className="text-muted">{a.genre || "-"}</td>
              <td className="font-mono text-xs text-muted">{a.platformIds.spotify}</td>
              <td className="font-mono text-xs text-muted">{a.platformIds.melon ?? "-"}</td>
              <td className="tabular-nums">{daily.get(a.id) ?? "-"}</td>
              <td className="tabular-nums">{countValidConcerts(a.id, db)}건</td>
              <td>
                {a.status === "excluded" ? (
                  <Pill tone="line">제외</Pill>
                ) : a.collected ? (
                  <Pill tone="dark">차트 대상</Pill>
                ) : (
                  <Pill tone="warn">수집 대기</Pill>
                )}
              </td>
              <td className="text-right">
                <Link href={`/artists/${a.id}`} className={`${btn.small} border border-line hover:border-fg`}>
                  수정
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
