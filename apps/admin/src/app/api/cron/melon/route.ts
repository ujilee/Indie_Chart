import { revalidatePath } from "next/cache";
import { collectArtistMetricsNow, collectMelonChartNow } from "@/lib/collect";

export const dynamic = "force-dynamic";
/** 아티스트 수치 수집에 몇 분 걸린다 (Vercel 함수 최대 실행 시간, 초) */
export const maxDuration = 300;

/**
 * 예약 실행용 멜론 수집: 인디 차트 → 아티스트 수치(팬·좋아요·Spotify 팔로워).
 * ?step=resume 은 아티스트 수치만 이어서 수집한다 (한 번에 다 못 끝낸 날을 위해 vercel.json에 몇 번 더 예약).
 * Authorization: Bearer <CRON_SECRET> 헤더가 맞을 때만 실행한다 (Vercel Cron이 자동으로 붙여 준다).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, message: "CRON_SECRET이 설정되지 않았어요." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false }, { status: 401 });

  const resume = new URL(req.url).searchParams.get("step") === "resume";
  const chart = resume ? null : await collectMelonChartNow({ manual: false });
  // 함수 시간 제한(300초) 안에 끝나도록 남은 시간만 쓴다. 남은 아티스트는 다음 실행이나 수동 버튼으로 이어서 수집
  const metrics = await collectArtistMetricsNow({ manual: false, budgetMs: 240_000 });
  revalidatePath("/", "layout");
  return Response.json({ chart, metrics }, { status: chart?.ok || metrics.ok ? 200 : 502 });
}
