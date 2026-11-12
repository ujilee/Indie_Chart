import { serviceToday } from "@indie/core/constants";
import { readDb } from "@indie/core/db";
import { CSV_COLUMNS } from "@/lib/metrics-csv";

export const dynamic = "force-dynamic";

/** 수치 입력용 CSV 양식 (등록된 활성 아티스트 + 기준일) */
export function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("date");
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : serviceToday();
  const artists = readDb()
    .artists.filter((a) => a.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const quote = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [CSV_COLUMNS.join(","), ...artists.map((a) => [date, quote(a.name), "", "", "", ""].join(","))];
  // 엑셀에서 한글이 깨지지 않도록 BOM 추가
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="indiechart-metrics-${date}.csv"`,
    },
  });
}
