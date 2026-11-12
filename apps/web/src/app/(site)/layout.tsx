import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getMetricsSource } from "@indie/core/data";
import { isDemoMode } from "@indie/core/data-mode";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 실제 데이터 연동 전까지 표시. 순위·수치·공연은 목업 */}
      <div className="bg-fg text-white/70 text-center text-[11px] sm:text-xs py-1.5 px-4">
        {isDemoMode()
          ? "데모 모드예요. 아티스트 정보 외의 순위·수치·공연 정보는 샘플이며, 제보·응원은 저장되지 않아요."
          : getMetricsSource() === "live"
            ? "시험 운영 중이에요. 순위는 멜론 인디 차트와 직접 확인한 수치로 계산하며, 일부 공연·응원 정보는 샘플이에요."
            : "개발용 샘플 화면이에요. 아티스트 정보 외의 순위·수치·공연 정보는 실제와 무관해요."}
      </div>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
