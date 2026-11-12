import { AdminHeader, Card, adminInput, btn } from "@/components/ui";
import { addDays, serviceToday } from "@indie/core/constants";
import { getMetricsSource } from "@indie/core/data";
import { readDb } from "@indie/core/db";
import { latestValue } from "@indie/core/live";
import { METRIC_FIELDS } from "@/lib/metrics-csv";
import MetricsGrid from "./MetricsGrid";
import CsvImport from "./CsvImport";

export default async function AdminMetrics({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const today = serviceToday();
  const raw = (await searchParams).date;
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
  const db = await readDb();
  const artists = db.artists.filter((a) => a.status === "active").sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const rows = artists.map((a) => {
    const snap = db.metricSnapshots.find((s) => s.artistId === a.id && s.date === date);
    return {
      id: a.id,
      name: a.name,
      melonId: a.platformIds.melon ?? null,
      spotifyId: a.platformIds.spotify,
      values: Object.fromEntries(METRIC_FIELDS.map((f) => [f.key, snap?.[f.key] ?? null])),
      // 직전 입력값 (참고용)
      previous: Object.fromEntries(METRIC_FIELDS.map((f) => [f.key, latestValue(db, a.id, f.key, addDays(date, -1))])),
    };
  });
  const filled = db.metricSnapshots.filter((s) => s.date === date).length;
  const live = getMetricsSource(db) === "live";

  return (
    <>
      <AdminHeader
        title="수치 입력"
        desc="멜론 팬 수·좋아요와 Spotify 팔로워·월별 리스너를 날짜별로 입력해요. 점수는 기간 마지막 날 값과 시작 전날 값의 차이(증가량)로 계산돼요."
      />
      {!live && (
        <p className="mb-4 rounded-xl border border-line bg-bg px-4 py-3 text-sm text-muted">
          지금 차트는 <b className="text-fg">샘플 수치</b>로 표시 중이에요. 입력한 수치를 차트에 반영하려면 데이터 수집 메뉴에서 <b className="text-fg">실제 수치</b>로 전환하세요.
        </p>
      )}

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-sm font-semibold" htmlFor="date">
          기준일
        </label>
        <input id="date" type="date" name="date" defaultValue={date} max={today} className={adminInput} />
        <button className={btn.outline}>이동</button>
        <span className="text-xs text-subtle">
          {date} 입력 {filled}/{artists.length}팀
        </span>
      </form>

      <Card title={`${date} 수치`} className="mb-4">
        <MetricsGrid date={date} rows={rows} />
      </Card>

      <Card title="CSV로 한 번에 올리기">
        <CsvImport date={date} />
      </Card>
    </>
  );
}
