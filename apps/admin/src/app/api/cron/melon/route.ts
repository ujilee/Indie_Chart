import { revalidatePath } from "next/cache";
import { collectMelonChartNow } from "@/lib/collect";

export const dynamic = "force-dynamic";

/**
 * 예약 실행용 멜론 인디 차트 수집.
 * Authorization: Bearer <CRON_SECRET> 헤더가 맞을 때만 실행한다 (Vercel Cron이 자동으로 붙여 준다).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, message: "CRON_SECRET이 설정되지 않았어요." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false }, { status: 401 });

  const result = await collectMelonChartNow({ manual: false });
  revalidatePath("/", "layout");
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
