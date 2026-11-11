import { adminInput, btn } from "./ui";

/** 사유 입력 후 반려 (details 토글, JS 없이 동작) */
export function RejectForm({ action, placeholder = "반려 사유" }: { action: (fd: FormData) => Promise<void>; placeholder?: string }) {
  return (
    <details className="relative inline-block [&[open]>summary]:bg-surface">
      <summary className={`${btn.small} border border-line hover:border-fg cursor-pointer list-none`}>반려</summary>
      <form action={action} className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-line bg-bg p-3 shadow-lg space-y-2">
        <input name="reason" placeholder={placeholder} className={`${adminInput} w-full`} />
        <button className={`${btn.small} w-full justify-center bg-up text-white`}>반려 확정</button>
      </form>
    </details>
  );
}
