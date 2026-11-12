/**
 * 데이터 저장 모드 (서버 전용)
 * - supabase: Supabase(Postgres)에 읽고 쓴다. SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 있으면 기본값.
 * - file: 저장소 루트의 .data/db.json 파일에 읽고 쓴다. 로컬 개발 기본값.
 * - demo: 시드 데이터를 메모리에서만 읽는다. 쓰기 기능은 모두 막는다.
 *   Vercel처럼 파일 시스템이 읽기 전용인 환경의 기본값.
 *
 * INDIECHART_DATA_MODE=supabase|file|demo 로 직접 지정할 수 있다.
 */
export type DataMode = "supabase" | "file" | "demo";

export function hasSupabaseEnv() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getDataMode(): DataMode {
  const v = process.env.INDIECHART_DATA_MODE;
  if (v === "supabase" || v === "file" || v === "demo") return v;
  if (hasSupabaseEnv()) return "supabase";
  return process.env.VERCEL ? "demo" : "file";
}

export function isDemoMode() {
  return getDataMode() === "demo";
}

export const READ_ONLY_MESSAGE = "데모 모드에서는 데이터를 저장할 수 없어요.";

export class ReadOnlyStoreError extends Error {
  constructor() {
    super(READ_ONLY_MESSAGE);
    this.name = "ReadOnlyStoreError";
  }
}
