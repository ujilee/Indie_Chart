import { ActionForm } from "@/components/ActionForm";
import Link from "next/link";
import { AdminHeader, Card, EmptyRow, Pill, Table, Tabs, adminInput, btn, fmtDateTime } from "@/components/ui";
import { RejectForm } from "@/components/RejectForm";
import { TODAY } from "@indie/core/constants";
import { countValidConcerts, getArtist } from "@indie/core/data";
import { readDb } from "@indie/core/db";
import { CONCERT_WINDOW_DAYS, concertBonus, daysBetween, isConcertValid } from "@indie/core/score";
import type { Concert } from "@indie/core/types";
import { approveConcert, cancelConcert, rejectConcert } from "../actions";
import ConcertCreateForm from "./ConcertCreateForm";

const TABS = [
  { key: "pending", label: "검토 대기" },
  { key: "valid", label: "가점 반영 중" },
  { key: "upcoming", label: "30일 이후 예정" },
  { key: "past", label: "종료" },
  { key: "canceled", label: "취소" },
  { key: "rejected", label: "반려" },
  { key: "all", label: "전체" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function tabOf(c: Concert): Tab {
  if (c.status !== "approved") return c.status as Tab;
  if (c.date < TODAY) return "past";
  return isConcertValid(c, TODAY) ? "valid" : "upcoming";
}

const norm = (s: string) => s.replace(/\s/g, "").toLowerCase();

export default async function AdminConcerts({ searchParams }: { searchParams: Promise<{ status?: string; artist?: string }> }) {
  const { status = "pending", artist = "" } = await searchParams;
  const tab = (TABS.some((t) => t.key === status) ? status : "pending") as Tab;
  const db = readDb();
  const scoped = db.concerts.filter((c) => !artist || c.artistId === artist);
  const list = scoped
    .filter((c) => tab === "all" || tabOf(c) === tab)
    .sort((a, b) => (tab === "pending" ? b.createdAt.localeCompare(a.createdAt) : a.date.localeCompare(b.date)));
  const qs = (s: string) => `?status=${s}${artist ? `&artist=${artist}` : ""}`;

  // 아티스트별 가점 현황
  const bonusList = db.artists
    .filter((a) => a.status === "active")
    .map((a) => ({ a, n: countValidConcerts(a.id, db) }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n || x.a.name.localeCompare(y.a.name, "ko"));

  const duplicateOf = (c: Concert) =>
    db.concerts.find(
      (o) => o.id !== c.id && o.artistId === c.artistId && o.date === c.date && norm(o.venue) === norm(c.venue) && o.status === "approved",
    );

  return (
    <>
      <AdminHeader
        title="공연정보 관리"
        desc={`승인된 공연 중 ${CONCERT_WINDOW_DAYS}일 이내 개최 예정 공연은 1건당 +4점 (아티스트별 최대 +20점)이 반영돼요.`}
      />

      <details className="mb-4 rounded-2xl border border-line bg-bg group">
        <summary className="px-5 py-3.5 font-bold cursor-pointer list-none flex justify-between">
          공연 직접 등록 <span className="text-muted group-open:rotate-45 transition-transform">+</span>
        </summary>
        <div className="border-t border-line">
          <ConcertCreateForm artists={db.artists.filter((a) => a.status === "active").map((a) => ({ id: a.id, name: a.name }))} today={TODAY} />
        </div>
      </details>

      <div className="grid xl:grid-cols-[1fr_280px] gap-4 items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Tabs
              active={tab}
              items={TABS.map((t) => ({
                ...t,
                href: qs(t.key),
                count: t.key === "all" ? scoped.length : scoped.filter((c) => tabOf(c) === t.key).length,
              }))}
            />
            <form className="flex gap-2 mb-4">
              <input type="hidden" name="status" value={tab} />
              <select name="artist" defaultValue={artist} className={adminInput}>
                <option value="">전체 아티스트</option>
                {db.artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <button className={btn.outline}>필터</button>
            </form>
          </div>
          <Card>
            <Table head={["공연일", "아티스트", "공연", "출처", "상태", "가점", ""]} minWidth={940}>
              {list.length === 0 && <EmptyRow colSpan={7}>해당하는 공연이 없어요.</EmptyRow>}
              {list.map((c) => {
                const a = getArtist(c.artistId, db);
                const d = daysBetween(TODAY, c.date);
                const dup = c.status === "pending" ? duplicateOf(c) : undefined;
                const valid = isConcertValid(c, TODAY);
                return (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap">
                      <div className="font-semibold tabular-nums">{c.date}</div>
                      <div className="text-xs text-muted">
                        {c.time ?? "시간 미정"} · {d >= 0 ? `D-${d}` : `${-d}일 전`}
                      </div>
                    </td>
                    <td>
                      <Link href={`/artists/${c.artistId}`} className="font-semibold hover:underline">
                        {a?.name}
                      </Link>
                      <div className="text-xs text-subtle">유효 {countValidConcerts(c.artistId, db)}건</div>
                    </td>
                    <td className="max-w-72">
                      <div className="font-semibold truncate">{c.title}</div>
                      <div className="text-xs text-muted truncate">
                        {c.venue}
                        {c.address && ` · ${c.address}`}
                      </div>
                      <a href={c.url} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-2 break-all">
                        {c.url}
                      </a>
                      {c.description && <p className="text-xs text-muted mt-1">{c.description}</p>}
                      {c.poster && (
                        <a href={c.poster} target="_blank" rel="noreferrer" className="text-xs text-muted underline">
                          포스터 보기
                        </a>
                      )}
                    </td>
                    <td className="text-xs text-muted whitespace-nowrap">
                      {c.source === "report" ? "사용자 제보" : "관리자"}
                      <div className="text-subtle">{fmtDateTime(c.createdAt)}</div>
                    </td>
                    <td className="space-y-1">
                      <Pill tone={c.status === "approved" ? "dark" : c.status === "pending" ? "warn" : "line"}>
                        {{ approved: "승인", pending: "검토 대기", rejected: "반려", canceled: "취소" }[c.status]}
                      </Pill>
                      {dup && (
                        <div>
                          <Pill tone="accent">중복 의심</Pill>
                        </div>
                      )}
                      {c.rejectReason && <p className="text-xs text-muted">{c.rejectReason}</p>}
                    </td>
                    <td className="text-xs whitespace-nowrap">
                      {valid ? (
                        <span className="font-bold text-accent">반영 중</span>
                      ) : c.status === "pending" && d >= 0 ? (
                        <span className="text-muted">{d <= CONCERT_WINDOW_DAYS ? "승인 시 반영" : `D-${d - CONCERT_WINDOW_DAYS}부터`}</span>
                      ) : c.status === "approved" && d > CONCERT_WINDOW_DAYS ? (
                        <span className="text-muted">D-{d - CONCERT_WINDOW_DAYS}부터</span>
                      ) : (
                        <span className="text-subtle">미반영</span>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {c.status === "pending" && (
                          <>
                            <ActionForm action={approveConcert.bind(null, c.id)}>
                              <button disabled={!!dup || d < 0} className={`${btn.small} bg-fg text-bg hover:bg-accent disabled:bg-surface disabled:text-subtle`}>
                                승인
                              </button>
                            </ActionForm>
                            <RejectForm action={rejectConcert.bind(null, c.id)} />
                          </>
                        )}
                        {c.status === "approved" && d >= 0 && (
                          <ActionForm action={cancelConcert.bind(null, c.id)}>
                            <button className={`${btn.small} border border-line hover:border-up hover:text-up`}>공연 취소</button>
                          </ActionForm>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </div>

        <Card title="아티스트별 가점 반영 현황">
          <ul className="divide-y divide-line text-sm max-h-[560px] overflow-auto">
            {bonusList.length === 0 && <li className="px-5 py-6 text-center text-muted">반영 중인 공연이 없어요.</li>}
            {bonusList.map(({ a, n }) => (
              <li key={a.id}>
                <Link href={`?status=valid&artist=${a.id}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-surface">
                  <span className="font-semibold truncate">{a.name}</span>
                  <span className="tabular-nums text-muted whitespace-nowrap">
                    {n}건 · <b className="text-fg">+{concertBonus(n)}</b>
                    {n > 5 && <span className="text-subtle"> (상한)</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
