/**
 * 이메일 회원 인증 유틸 (서버 전용).
 * - 비밀번호: scrypt + 회원별 salt
 * - 세션: 회원 ID와 만료 시각을 HMAC-SHA256으로 서명한 쿠키 값 (서버에 세션 저장 없음)
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { isDemoMode } from "./data-mode";

export const SESSION_COOKIE = "ic_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일

const DEV_SECRET = "indiechart-local-dev-secret";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  // 실제 데이터를 저장하는 배포에서는 반드시 AUTH_SECRET을 지정해야 한다
  if (process.env.NODE_ENV === "production" && !isDemoMode()) throw new Error("AUTH_SECRET 환경 변수가 필요해요.");
  return DEV_SECRET;
}

/* ---------------- 비밀번호 ---------------- */

const KEY_LEN = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, KEY_LEN).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/* ---------------- 세션 토큰 ---------------- */

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, now = Date.now()) {
  const payload = `${userId}.${now + SESSION_MAX_AGE * 1000}`;
  return `${payload}.${sign(payload)}`;
}

/** 서명과 만료를 확인하고 회원 ID를 돌려준다. 유효하지 않으면 null */
export function readSessionToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(token.slice(i + 1));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const [userId, exp] = payload.split(".");
  if (!userId || !(Number(exp) > now)) return null;
  return userId;
}

/* ---------------- 입력 검증 ---------------- */

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string) {
  if (!email) return "이메일을 입력해 주세요.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "올바른 이메일 형식이 아니에요.";
  return null;
}

export function validatePassword(password: string) {
  if (!password) return "비밀번호를 입력해 주세요.";
  if (password.length < 8 || password.length > 64) return "비밀번호는 8~64자로 입력해 주세요.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "영문과 숫자를 모두 포함해 주세요.";
  return null;
}

export function validateNickname(nickname: string) {
  if (!nickname) return "닉네임을 입력해 주세요.";
  if (nickname.length < 2 || nickname.length > 12) return "닉네임은 2~12자로 입력해 주세요.";
  if (!/^[가-힣A-Za-z0-9_]+$/.test(nickname)) return "한글, 영문, 숫자, 밑줄(_)만 사용할 수 있어요.";
  return null;
}
