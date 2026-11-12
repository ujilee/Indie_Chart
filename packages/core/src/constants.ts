import { isDemoMode } from "./data-mode";

/** 데모 모드의 고정 기준일 (샘플 데이터가 이 날짜 기준으로 만들어져 있음) */
export const DEMO_TODAY = "2026-11-11";

/** 날짜를 KST 기준 YYYY-MM-DD로 */
export function kstDate(d: Date = new Date()) {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 서비스 기준일 (KST). 데모 모드는 고정일, 그 외에는 실제 오늘 */
export function serviceToday() {
  return isDemoMode() ? DEMO_TODAY : kstDate();
}

/** 이번 달 (YYYY-MM) */
export function serviceMonth() {
  return serviceToday().slice(0, 7);
}

/** 직전 완료 월 (YYYY-MM) */
export function lastServiceMonth() {
  const [y, m] = serviceMonth().split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** YYYY-MM-DD에 일수 더하기 */
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthLabel(month: string) {
  return `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;
}

export function nowIso() {
  return new Date().toISOString();
}
