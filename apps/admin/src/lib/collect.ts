/**
 * 멜론 인디 차트 수집 (관리자 버튼과 예약 실행이 같이 쓴다).
 * 너무 잦은 요청을 막기 위해 마지막 수집 후 10분 안에는 다시 요청하지 않는다.
 */
import { nowIso, serviceToday } from "@indie/core/constants";
import { isDemoMode } from "@indie/core/data-mode";
import { mutate, newId, readDb } from "@indie/core/db";
import { MelonCollectError, fetchMelonIndieChart } from "@indie/core/melon";

const MIN_INTERVAL_MS = 10 * 60 * 1000;

export type CollectResult = { ok: boolean; message: string };

export async function collectMelonChartNow({ manual }: { manual: boolean }): Promise<CollectResult> {
  if (isDemoMode()) return { ok: false, message: "데모 모드에서는 수집할 수 없어요." };

  const db = readDb();
  const last = [...db.collectionRuns].filter((r) => r.kind === "melon-chart").sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  if (last && Date.now() - new Date(last.startedAt).getTime() < MIN_INTERVAL_MS) {
    return { ok: false, message: "마지막 수집 후 10분이 지나지 않았어요. 멜론에 부담을 주지 않도록 잠시 후 다시 시도해 주세요." };
  }

  const startedAt = nowIso();
  try {
    const chart = await fetchMelonIndieChart();
    const registered = new Map(
      db.artists.filter((a) => a.platformIds.melon).map((a) => [a.platformIds.melon!, a.name] as const),
    );
    const matched = new Set(chart.entries.flatMap((e) => e.artists.map((a) => a.melonId)).filter((id) => registered.has(id)));
    const note = `${chart.chartDate} 인디 차트 ${chart.entries.length}곡 · 등록 아티스트 ${matched.size}팀 차트인`;
    mutate((db) => {
      // 같은 기준일 차트는 최신 수집 결과로 교체
      db.melonCharts = [chart, ...db.melonCharts.filter((c) => c.chartDate !== chart.chartDate)];
      db.collectionRuns.unshift({
        id: newId("run"),
        date: serviceToday(),
        startedAt,
        finishedAt: nowIso(),
        status: "success",
        artistCount: matched.size,
        failures: [],
        manual,
        kind: "melon-chart",
        note,
      });
    });
    return { ok: true, message: note };
  } catch (e) {
    const message = e instanceof MelonCollectError ? e.message : "알 수 없는 오류로 수집하지 못했어요.";
    mutate((db) => {
      db.collectionRuns.unshift({
        id: newId("run"),
        date: serviceToday(),
        startedAt,
        finishedAt: nowIso(),
        status: "failed",
        artistCount: 0,
        failures: [],
        manual,
        kind: "melon-chart",
        error: message,
      });
    });
    return { ok: false, message };
  }
}
