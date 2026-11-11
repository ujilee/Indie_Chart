import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 실제 데이터 연동 전까지 표시. 순위·수치·공연은 목업 */}
      <div className="bg-fg text-white/70 text-center text-[11px] sm:text-xs py-1.5 px-4">
        개발용 샘플 화면이에요. 아티스트 정보 외의 순위·수치·공연 정보는 실제와 무관해요.
      </div>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
