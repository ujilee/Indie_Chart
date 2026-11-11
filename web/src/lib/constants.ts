/** 서비스 기준일 (KST). 실제 서비스에서는 서버 시간 사용 */
export const TODAY = "2026-11-11";
/** 이번 달 (YYYY-MM) */
export const CURRENT_MONTH = TODAY.slice(0, 7);
/** 직전 완료 월 */
export const LAST_MONTH = "2026-10";

export function monthLabel(month: string) {
  return `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;
}

export function nowIso() {
  return new Date().toISOString();
}
