/**
 * 데이터 저장소 (서버 전용). 모드는 data-mode.ts 참고.
 * - supabase: Supabase 운영 DB 테이블 (supabase/migrations, supabase-store.ts). 시드 데이터를 넣지 않는다.
 * - file: 저장소 루트의 .data/db.json — 사용자 앱과 관리자 앱이 같은 파일을 쓴다. 삭제하면 시드 데이터로 초기화된다.
 * - demo: 시드 데이터를 메모리에서 읽기 전용으로 사용한다. 쓰기(mutate)는 ReadOnlyStoreError를 던진다.
 */
import fs from "node:fs";
import path from "node:path";
import { createSeed, type DB } from "./seed";
import { ReadOnlyStoreError, getDataMode, isDemoMode } from "./data-mode";

const seedHooks: ((db: DB) => void)[] = [];

/** 시드 직후 1회 실행할 초기화 (예: 시드 시점 월간 TOP 3 확정) */
export function onSeed(fn: (db: DB) => void) {
  seedHooks.push(fn);
}

function seeded(): DB {
  const db = createSeed();
  seedHooks.forEach((fn) => fn(db));
  return db;
}

/** 예전 저장소 파일 호환 */
function normalize(db: DB): DB {
  db.users ??= [];
  db.metricSnapshots ??= [];
  db.melonCharts ??= [];
  db.melonSongCache ??= {};
  db.settings ??= { metricsSource: "mock" };
  return db;
}

export async function readDb(): Promise<DB> {
  const mode = getDataMode();
  if (mode === "demo") return readDemo();
  if (mode === "supabase") return supabaseLoad();
  return readFile();
}

/** 읽기-수정-쓰기. supabase 모드는 바뀐 행만 테이블에 반영한다 */
export async function mutate<T>(fn: (db: DB) => T): Promise<T> {
  const mode = getDataMode();
  if (mode === "demo") throw new ReadOnlyStoreError();
  if (mode === "file") {
    const db = structuredClone(readFile());
    const result = fn(db);
    writeFile(db);
    return result;
  }
  return supabaseMutate(fn);
}

/** 새 기록 ID. supabase 모드는 테이블 기본키 형식(uuid) */
export function newId(prefix: string) {
  if (getDataMode() === "supabase") return crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* ───────── demo ───────── */

let demoCache: { hooks: number; db: DB } | null = null;

function readDemo() {
  // 시드는 결정적이라 인스턴스마다 같은 데이터가 만들어진다. 훅이 늦게 등록되면 다시 만든다.
  if (!demoCache || demoCache.hooks !== seedHooks.length) demoCache = { hooks: seedHooks.length, db: seeded() };
  return demoCache.db;
}

/* ───────── file ───────── */

/** npm workspaces 루트(.data 위치)를 찾는다. INDIECHART_DATA_DIR로 직접 지정할 수 있다. */
function dataDir() {
  if (process.env.INDIECHART_DATA_DIR) return path.resolve(process.env.INDIECHART_DATA_DIR);
  let dir = process.cwd();
  for (;;) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
      if (pkg.workspaces) return path.join(dir, ".data");
    } catch {}
    const parent = path.dirname(dir);
    if (parent === dir) return path.join(process.cwd(), ".data");
    dir = parent;
  }
}

export const DATA_FILE = path.join(dataDir(), "db.json");
let fileCache: { mtime: number; db: DB } | null = null;

function readFile(): DB {
  if (!fs.existsSync(DATA_FILE)) {
    const db = seeded();
    writeFile(db);
    return db;
  }
  const mtime = fs.statSync(DATA_FILE).mtimeMs;
  if (fileCache && fileCache.mtime === mtime) return fileCache.db;
  const db = normalize(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as DB);
  fileCache = { mtime, db };
  return db;
}

function writeFile(db: DB) {
  if (isDemoMode()) throw new ReadOnlyStoreError();
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
  fileCache = { mtime: fs.statSync(DATA_FILE).mtimeMs, db };
}

/* ───────── supabase ───────── */

async function supabaseLoad(): Promise<DB> {
  const { loadFromSupabase } = await import("./supabase-store");
  return normalize(await loadFromSupabase());
}

async function supabaseMutate<T>(fn: (db: DB) => T): Promise<T> {
  const { loadFromSupabase, saveDiff } = await import("./supabase-store");
  const before = normalize(await loadFromSupabase());
  const after = structuredClone(before);
  const result = fn(after);
  await saveDiff(before, after);
  return result;
}
