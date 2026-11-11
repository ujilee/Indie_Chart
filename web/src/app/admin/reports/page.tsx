import Link from "next/link";
import { AdminHeader, Card, EmptyRow, Pill, Table, Tabs, btn, fmtDateTime } from "@/components/admin/ui";
import { RejectForm } from "@/components/admin/RejectForm";
import { fetchSpotifyArtistProfile, type SpotifyArtistProfile } from "@/lib/artist-image";
import { readDb } from "@/lib/db";
import type { ArtistReport } from "@/lib/types";
import { approveArtistReport, rejectArtistReport } from "../actions";

type Status = ArtistReport["status"];

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "pending" } = await searchParams;
  const tab = (["pending", "approved", "rejected"].includes(status) ? status : "pending") as Status;
  const db = readDb();
  const list = db.artistReports.filter((r) => r.status === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // 검토 대기 제보는 Spotify 프로필을 조회해 실존 여부와 이미지를 미리 보여 준다
  const profiles = new Map<string, SpotifyArtistProfile | null | "error">(
    tab === "pending"
      ? await Promise.all(
          list.map(async (r) => [r.id, await fetchSpotifyArtistProfile(r.spotifyId).catch(() => "error" as const)] as const),
        )
      : [],
  );
  const count = (s: Status) => db.artistReports.filter((r) => r.status === s).length;

  /** 중복 검증 결과 */
  const checks = (r: ArtistReport) => {
    const issues: string[] = [];
    const bySpotify = db.artists.find((a) => a.platformIds.spotify === r.spotifyId);
    if (bySpotify) issues.push(`Spotify ID 중복: ${bySpotify.name}`);
    const norm = (s: string) => s.replace(/\s/g, "").toLowerCase();
    const byName = db.artists.find((a) => norm(a.name) === norm(r.name) && a !== bySpotify);
    if (byName) issues.push(`유사 이름: ${byName.name}`);
    if (db.artistReports.some((o) => o.id !== r.id && o.spotifyId === r.spotifyId && o.status === "pending")) issues.push("동일 Spotify 제보 대기 중");
    return { issues, artistId: bySpotify?.id ?? byName?.id };
  };

  return (
    <>
      <AdminHeader title="아티스트 제보 관리" desc="사용자 제보를 검토하고 승인하면 아티스트로 등록돼요. 승인된 아티스트는 최초 데이터 수집 후 차트에 반영돼요." />
      <Tabs
        active={tab}
        items={[
          { key: "pending", label: "검토 대기", href: "?status=pending", count: count("pending") },
          { key: "approved", label: "승인", href: "?status=approved", count: count("approved") },
          { key: "rejected", label: "반려", href: "?status=rejected", count: count("rejected") },
        ]}
      />
      <Card>
        <Table head={["접수", "아티스트명", "Spotify ID", "기타 플랫폼", "중복 검증", tab === "pending" ? "처리" : "결과"]} minWidth={960}>
          {list.length === 0 && <EmptyRow colSpan={6}>해당 상태의 제보가 없어요.</EmptyRow>}
          {list.map((r) => {
            const { issues, artistId } = checks(r);
            return (
              <tr key={r.id}>
                <td className="text-xs text-muted whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                <td className="font-semibold">{r.name}</td>
                <td>
                  {tab === "pending" && <SpotifyPreview profile={profiles.get(r.id)} />}
                  <a
                    href={`https://open.spotify.com/artist/${r.spotifyId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs underline underline-offset-2"
                  >
                    {r.spotifyId}
                  </a>
                </td>
                <td className="text-xs text-muted space-y-0.5">
                  {r.melonId && <div>멜론 {r.melonId}</div>}
                  {r.youtube && <div>YouTube {r.youtube}</div>}
                  {r.appleMusic && <div>Apple {r.appleMusic}</div>}
                  {!r.melonId && !r.youtube && !r.appleMusic && "-"}
                </td>
                <td>
                  {tab !== "pending" ? (
                    <span className="text-xs text-subtle">-</span>
                  ) : issues.length === 0 ? (
                    <Pill tone="blue">중복 없음</Pill>
                  ) : (
                    <div className="space-y-1">
                      {issues.map((i) => (
                        <div key={i}>
                          <Pill tone="accent">{i}</Pill>
                        </div>
                      ))}
                      {artistId && (
                        <Link href={`/admin/artists/${artistId}`} className="text-xs text-muted underline">
                          기존 아티스트 보기
                        </Link>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  {tab === "pending" ? (
                    <div className="flex gap-1.5">
                      <form action={approveArtistReport.bind(null, r.id)}>
                        <button className={`${btn.small} bg-fg text-bg hover:bg-accent`} disabled={issues.some((i) => i.startsWith("Spotify"))}>
                          승인
                        </button>
                      </form>
                      <RejectForm action={rejectArtistReport.bind(null, r.id)} />
                    </div>
                  ) : (
                    <div className="text-xs">
                      <Pill tone={r.status === "approved" ? "dark" : "line"}>{r.status === "approved" ? "승인" : "반려"}</Pill>
                      {r.rejectReason && <p className="mt-1 text-muted">{r.rejectReason}</p>}
                      {r.reviewedAt && <p className="mt-1 text-subtle">{fmtDateTime(r.reviewedAt)}</p>}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}

function SpotifyPreview({ profile }: { profile: SpotifyArtistProfile | null | "error" | undefined }) {
  if (profile === undefined) return null;
  if (profile === "error") return <p className="mb-1 text-xs text-subtle">Spotify 조회 실패</p>;
  if (profile === null) return <div className="mb-1"><Pill tone="accent">Spotify에 없는 아티스트</Pill></div>;
  return (
    <div className="mb-1.5 flex items-center gap-2">
      {profile.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.image} alt="" className="size-9 rounded-full object-cover" />
      ) : (
        <span className="size-9 rounded-full bg-surface" />
      )}
      <span className="text-xs">
        <span className="block text-subtle">Spotify 등록명</span>
        <b>{profile.name}</b>
      </span>
    </div>
  );
}
