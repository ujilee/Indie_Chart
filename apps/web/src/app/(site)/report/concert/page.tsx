import type { Metadata } from "next";
import ConcertReportForm from "./ConcertReportForm";
import { Container, PageTitle } from "@indie/core/ui";
import { TODAY } from "@indie/core/constants";
import { getActiveArtists } from "@indie/core/data";

export const metadata: Metadata = { title: "공연정보 제보 — INDIE CHART" };

export default async function ConcertReportPage({ searchParams }: { searchParams: Promise<{ artist?: string }> }) {
  const { artist } = await searchParams;
  const artists = getActiveArtists();
  return (
    <Container className="max-w-2xl">
      <PageTitle
        badge="REPORT"
        title="공연정보 제보"
        desc={
          <>
            아티스트의 공연 일정을 알려 주세요. 관리자 확인 후 승인된 공연은 아티스트 페이지에 노출돼요.
            <br />
            공연일 기준 30일 이내의 승인 공연은 1건당 4점(최대 20점)이 차트 점수에 더해져요.
          </>
        }
      />
      <ConcertReportForm
        artists={artists.map((a) => ({ id: a.id, name: a.name }))}
        defaultArtistId={artists.some((a) => a.id === artist) ? artist! : ""}
        today={TODAY}
      />
    </Container>
  );
}
