/**
 * 로컬 JSON 파일 저장소 (서버 전용). 실제 DB 연동 전까지 사용.
 * 파일 위치: web/.data/db.json — 삭제하면 시드 데이터로 초기화된다.
 */
import fs from "node:fs";
import path from "node:path";
import { createSeed, type DB } from "./seed";

const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "db.json");

let cache: { mtime: number; db: DB } | null = null;
const seedHooks: ((db: DB) => void)[] = [];

/** 시드 직후 1회 실행할 초기화 (예: 시드 시점 월간 TOP 3 확정) */
export function onSeed(fn: (db: DB) => void) {
  seedHooks.push(fn);
}

export function readDb(): DB {
  if (!fs.existsSync(FILE)) {
    const db = createSeed();
    seedHooks.forEach((fn) => fn(db));
    writeDb(db);
    return db;
  }
  const mtime = fs.statSync(FILE).mtimeMs;
  if (cache && cache.mtime === mtime) return cache.db;
  const db = JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
  cache = { mtime, db };
  return db;
}

export function writeDb(db: DB) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
  cache = { mtime: fs.statSync(FILE).mtimeMs, db };
}

/** 읽기-수정-쓰기 */
export function mutate<T>(fn: (db: DB) => T): T {
  const db = structuredClone(readDb());
  const result = fn(db);
  writeDb(db);
  return result;
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
