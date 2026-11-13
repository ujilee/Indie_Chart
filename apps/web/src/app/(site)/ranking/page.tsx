import type { Metadata } from "next";
import { Container, PageTitle } from "@indie/core/ui";

export const metadata: Metadata = { title: "순위 산정 기준 — INDIE CHART" };

const ROWS = [
  { group: "음악 플랫폼", name: "멜론 차트 순위", desc: "차트에 진입한 상위 5곡의 순위", max: "10점" },
  { group: "음악 플랫폼", name: "멜론 전체 곡 좋아요", desc: "전체 등록곡의 좋아요 증가량", max: "36점" },
  { group: "음악 플랫폼", name: "멜론 팬맺기", desc: "팬 수 증가량", max: "22점" },
  { group: "음악 플랫폼", name: "Spotify 팔로워", desc: "팔로워 수 증가량", max: "22점" },
  { group: "사용자 참여", name: "사용자 응원", desc: "기간 내 가장 많은 응원을 받은 아티스트 기준 상대평가", max: "10점" },
];

export default function RankingPage() {
  return (
    <Container className="max-w-3xl">
      <PageTitle
        badge="RANKING"
        title="순위 산정 기준"
        desc="인디 차트는 음악 플랫폼 활동, 팬덤 성장, 공연 활동, 사용자 응원을 종합해 아티스트 순위를 매깁니다."
      />

      <section className="rounded-2xl bg-fg text-bg px-6 sm:px-8 py-6 sm:py-8">
        <p className="text-sm text-white/60">최종 점수</p>
        <p className="mt-2 text-xl sm:text-3xl font-extrabold tracking-tight leading-snug">
          기본 점수 100 <span className="text-white/40">+</span> 공연 가점 <span className="text-accent">최대 20</span>
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-extrabold mb-3">기본 점수 (100점)</h2>
        <div className="border-t-2 border-fg">
          {ROWS.map((r) => (
            <div key={r.name} className="flex items-center gap-4 border-b border-line py-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-subtle">{r.group}</p>
                <p className="font-bold">{r.name}</p>
                <p className="text-sm text-muted">{r.desc}</p>
              </div>
              <span className="text-lg font-extrabold tabular-nums">{r.max}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted leading-relaxed">
          각 지표의 증가량은 기간별 기준값에 따라 0~100점으로 환산한 뒤 가중치를 곱해 반영해요. 증가량이 없거나 감소한 경우
          0점으로 처리합니다.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-extrabold mb-3">공연 가점 (최대 +20점)</h2>
        <p className="text-sm text-muted leading-relaxed">
          관리자가 승인한 공연 중 30일 이내 개최 예정인 공연 1건당 4점이 더해지며, 최대 5건(20점)까지 인정돼요. 공연이
          끝나거나 취소되면 다음 집계부터 제외됩니다.
        </p>
        <div className="mt-4 grid grid-cols-6 text-center text-sm rounded-xl border border-line overflow-hidden">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="border-l first:border-l-0 border-line">
              <div className="py-2 bg-surface text-xs text-muted">{n === 5 ? "5건+" : `${n}건`}</div>
              <div className="py-2.5 font-bold tabular-nums">{n === 0 ? "0" : `+${n * 4}`}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-extrabold mb-3">집계 및 갱신</h2>
        <ul className="space-y-2 text-sm text-muted leading-relaxed list-disc pl-5">
          <li>매일 오전 1시(KST)에 데이터를 수집하고, 점수 계산이 끝나면 차트가 갱신돼요.</li>
          <li>일간은 전일 대비, 주간·월간·연간은 해당 기간의 증가량으로 계산해요.</li>
          <li>순위 변동은 같은 차트의 직전 기간 순위와 비교해요.</li>
          <li>점수가 같으면 공동 순위로 표시하고, 다음 순위는 공동 순위 인원만큼 건너뛰어요.</li>
          <li>월간 인디 TOP 3는 직전 달 월간 차트 1~3위로, 매월 집계가 확정되면 갱신돼요.</li>
        </ul>
      </section>
    </Container>
  );
}
