import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 text-xs text-muted leading-relaxed">
        <div className="font-black text-sm text-fg tracking-tighter">
          INDIE<span className="text-accent">.</span>CHART
        </div>
        <p className="mt-2">
          멜론, Spotify 데이터와 공연정보, 사용자 응원을 종합한 국내 인디 아티스트 차트입니다.
          <br />
          데이터는 매일 오전 1시(KST)에 수집되며, 플랫폼 사정에 따라 갱신 시간이 달라질 수 있습니다.
        </p>
        <div className="mt-4 flex gap-4">
          <Link href="/ranking" className="hover:text-fg">순위 산정 기준</Link>
          <Link href="/report/artist" className="hover:text-fg">아티스트 제보</Link>
          <span>이용약관</span>
          <span>개인정보처리방침</span>
        </div>
      </div>
    </footer>
  );
}
