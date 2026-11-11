import type { Metadata } from "next";
import CheerBoard from "./CheerBoard";
import { getActiveArtists, getCheerData } from "@/lib/data";
import { Container, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "아티스트 응원 — INDIE CHART" };

export default function CheerPage() {
  const data = getCheerData();
  return (
    <Container>
      <PageTitle
        badge="CHEER"
        title="아티스트 응원"
        desc={
          <>
            하루 한 번, 좋아하는 인디 아티스트 1팀을 응원할 수 있어요. 응원은 매일 00시에 초기화됩니다.
            <br />
            응원 결과는 월간 응원 순위와 종합 차트 점수에 반영돼요.
          </>
        }
      />
      <CheerBoard
        artists={getActiveArtists()}
        month={data.month}
        lastMonth={data.lastMonth}
        counts={data.current}
        lastMonthTop3={data.lastMonthTop3}
      />
    </Container>
  );
}
