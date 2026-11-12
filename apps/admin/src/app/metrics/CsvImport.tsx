"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { adminInput, btn } from "@/components/ui";
import { importMetricsCsv, type ImportState } from "../actions";

export default function CsvImport({ date }: { date: string }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importMetricsCsv, {});
  return (
    <div className="p-5 space-y-4 text-sm">
      <ol className="list-decimal pl-5 space-y-1 text-muted">
        <li>
          <a href={`/metrics/template?date=${date}`} className="font-semibold text-fg underline underline-offset-2">
            양식 CSV 내려받기
          </a>{" "}
          (등록된 아티스트와 {date} 날짜가 채워져 있어요)
        </li>
        <li>엑셀이나 구글 시트에서 숫자를 채우고 CSV로 저장해요. 빈 칸은 기존 값을 그대로 둬요.</li>
        <li>
          아래에서 파일을 올려요. <b className="text-fg">한 줄이라도 오류가 있으면 아무것도 저장하지 않아요.</b>
        </li>
      </ol>
      <ActionForm action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="date" value={date} />
        <input type="file" name="file" accept=".csv,text/csv" className={`${adminInput} py-2 h-auto`} />
        <button disabled={pending} className={btn.primary}>
          {pending ? "올리는 중…" : "CSV 올리기"}
        </button>
      </ActionForm>
      {state.imported != null && !state.errors && <p className="text-muted">{state.imported}줄 저장되었어요.</p>}
      {state.errors && (
        <ul className="text-xs text-up space-y-0.5">
          {state.errors.slice(0, 20).map((e) => (
            <li key={e}>{e}</li>
          ))}
          {state.errors.length > 20 && <li>외 {state.errors.length - 20}건</li>}
        </ul>
      )}
      <p className="text-xs text-subtle">
        열 이름: date, artist, melon_fans, melon_likes, spotify_followers, spotify_monthly_listeners · artist에는 아티스트 ID(a001), 멜론 아티스트 ID, 아티스트명 중 하나를 써요.
      </p>
    </div>
  );
}
