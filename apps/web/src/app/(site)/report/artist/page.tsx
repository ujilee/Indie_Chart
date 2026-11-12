import type { Metadata } from "next";
import ArtistReportForm from "./ArtistReportForm";
import { Container, PageTitle } from "@indie/core/ui";

export const metadata: Metadata = { title: "아티스트 제보 — INDIE CHART" };

export default function ArtistReportPage() {
  return (
    <Container className="max-w-2xl">
      <PageTitle
        badge="REPORT"
        title="아티스트 제보"
        desc="차트에 없는 국내 인디 아티스트를 알려 주세요. 관리자 검토 후 승인되면 데이터 수집과 차트 집계가 시작돼요. 로그인 없이도 제보할 수 있어요."
      />
      <ArtistReportForm />
    </Container>
  );
}
