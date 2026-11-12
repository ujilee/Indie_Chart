"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  hashPassword,
  normalizeEmail,
  validateEmail,
  validateNickname,
  validatePassword,
  verifyPassword,
} from "@indie/core/auth";
import { serviceToday, nowIso } from "@indie/core/constants";
import { READ_ONLY_MESSAGE, isDemoMode } from "@indie/core/data-mode";
import { mutate, newId, readDb } from "@indie/core/db";
import {
  isHttpUrl,
  parseAppleMusicArtistId,
  parseMelonArtistId,
  parseSpotifyArtistId,
  parseYoutubeChannel,
} from "@indie/core/validate";
import { headers } from "next/headers";
import { serviceClient } from "@indie/core/supabase-store";
import { endSession, getCurrentUser, safeRedirect, startSession } from "@/lib/auth";
import { socialProviders, userSupabase, usesSupabaseAuth } from "@/lib/supabase";

type Errors<K extends string> = Partial<Record<K, string>>;
export type ActionResult<K extends string> = { ok: true } | { ok: false; errors: Errors<K>; message?: string };

/** 데모 모드(읽기 전용)에서 쓰기 요청에 돌려주는 결과 */
const readOnlyResult = { ok: false as const, errors: {}, message: READ_ONLY_MESSAGE };

/* ---------------- 아티스트 제보 ---------------- */

export type ArtistReportInput = { name: string; spotify: string; melon: string; youtube: string; apple: string };

export async function submitArtistReport(v: ArtistReportInput): Promise<ActionResult<keyof ArtistReportInput>> {
  if (isDemoMode()) return readOnlyResult;
  const db = await readDb();
  const err: Errors<keyof ArtistReportInput> = {};
  const name = v.name.trim();
  if (!name) err.name = "아티스트명을 입력해 주세요.";
  else if (db.artists.some((a) => a.name === name)) err.name = "이미 차트에 등록된 아티스트예요.";

  const spotifyId = parseSpotifyArtistId(v.spotify);
  if (!v.spotify.trim()) err.spotify = "Spotify 아티스트 ID 또는 URL을 입력해 주세요.";
  else if (!spotifyId) err.spotify = "올바른 Spotify 아티스트 ID 또는 URL 형식이 아니에요.";
  else if (db.artists.some((a) => a.platformIds.spotify === spotifyId)) err.spotify = "이미 등록된 Spotify 아티스트예요.";
  else if (db.artistReports.some((r) => r.spotifyId === spotifyId && r.status === "pending"))
    err.spotify = "이미 제보되어 검토 중인 Spotify 아티스트예요.";

  const melon = v.melon.trim() ? parseMelonArtistId(v.melon) : undefined;
  const youtube = v.youtube.trim() ? parseYoutubeChannel(v.youtube) : undefined;
  const apple = v.apple.trim() ? parseAppleMusicArtistId(v.apple) : undefined;
  if (melon === null) err.melon = "올바른 멜론 아티스트 ID 또는 URL 형식이 아니에요.";
  if (youtube === null) err.youtube = "올바른 YouTube 채널 ID 또는 URL 형식이 아니에요.";
  if (apple === null) err.apple = "올바른 Apple Music 아티스트 ID 또는 URL 형식이 아니에요.";

  if (Object.keys(err).length) return { ok: false, errors: err };

  const reporterId = (await getCurrentUser())?.id;
  await mutate((db) => {
    db.artistReports.unshift({
      id: newId("r"),
      reporterId,
      name,
      spotifyId: spotifyId!,
      melonId: melon ?? undefined,
      youtube: youtube ?? undefined,
      appleMusic: apple ?? undefined,
      createdAt: nowIso(),
      status: "pending",
    });
  });
  return { ok: true };
}

/* ---------------- 공연정보 제보 ---------------- */

export type ConcertReportInput = {
  artistId: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  url: string;
  description: string;
  poster: string;
};

const norm = (s: string) => s.replace(/\s/g, "").toLowerCase();

export async function submitConcertReport(v: ConcertReportInput): Promise<ActionResult<keyof ConcertReportInput>> {
  if (isDemoMode()) return readOnlyResult;
  const db = await readDb();
  const err: Errors<keyof ConcertReportInput> = {};
  if (!v.artistId || !db.artists.some((a) => a.id === v.artistId && a.status === "active"))
    err.artistId = "아티스트를 선택해 주세요.";
  if (!v.title.trim()) err.title = "공연명을 입력해 주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) err.date = "공연 날짜를 선택해 주세요.";
  else if (v.date < serviceToday()) err.date = "이미 종료된 공연은 제보할 수 없어요.";
  if (!v.venue.trim()) err.venue = "공연장명을 입력해 주세요.";
  if (!v.url.trim()) err.url = "공식 공연정보 또는 예매 URL을 입력해 주세요.";
  else if (!isHttpUrl(v.url)) err.url = "올바른 URL 형식이 아니에요. (https://로 시작)";

  if (!err.date && !err.venue && !err.artistId) {
    const dup = db.concerts.find(
      (c) =>
        c.artistId === v.artistId &&
        c.date === v.date &&
        norm(c.venue) === norm(v.venue) &&
        (c.status === "approved" || c.status === "pending"),
    );
    if (dup?.status === "canceled") err.date = "취소된 공연은 제보할 수 없어요.";
    else if (dup) err.venue = "이미 등록되었거나 검토 중인 공연이에요.";
  }
  if (Object.keys(err).length) return { ok: false, errors: err };

  const reporterId = (await getCurrentUser())?.id;
  await mutate((db) => {
    db.concerts.push({
      id: newId("c"),
      reporterId,
      artistId: v.artistId,
      title: v.title.trim(),
      date: v.date,
      time: v.time || undefined,
      venue: v.venue.trim(),
      address: v.address.trim() || undefined,
      url: v.url.trim(),
      description: v.description.trim() || undefined,
      poster: v.poster || undefined,
      status: "pending",
      source: "report",
      createdAt: nowIso(),
    });
  });
  return { ok: true };
}

/* ---------------- 회원가입 · 로그인 ---------------- */

export type SignupField = "email" | "nickname" | "password" | "passwordConfirm" | "agree";
export type AuthFormState = {
  errors?: Partial<Record<SignupField, string>>;
  message?: string;
  /** 인증 메일을 보냄 (운영 DB 모드 가입) */
  sent?: boolean;
  email?: string;
  nickname?: string;
};

/** 운영 DB 모드 가입: Supabase Auth. 닉네임은 가입 정보에 담아 보내면 DB 트리거가 프로필을 만든다 */
async function supabaseSignup(fd: FormData, email: string, nickname: string, password: string): Promise<AuthFormState> {
  const keep = { email, nickname };
  // 닉네임 중복 (대소문자 구분 없이). LIKE 특수문자 _ 는 이스케이프
  const { data: taken } = await serviceClient()
    .from("profiles")
    .select("id")
    .ilike("nickname", nickname.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(1);
  if (taken?.length) return { ...keep, errors: { nickname: "이미 사용 중인 닉네임이에요." } };

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const next = safeRedirect(fd.get("redirect"));
  const { data, error } = await (await userSupabase()).auth.signUp({
    email,
    password,
    options: { data: { nickname }, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    if (error.code === "user_already_exists") return { ...keep, errors: { email: "이미 가입된 이메일이에요." } };
    if (error.code === "weak_password") return { ...keep, errors: { password: "더 안전한 비밀번호를 써 주세요." } };
    if (error.code === "over_email_send_rate_limit") return { ...keep, message: "인증 메일을 너무 자주 보냈어요. 잠시 후 다시 시도해 주세요." };
    return { ...keep, message: `가입하지 못했어요. (${error.message})` };
  }
  // 이미 가입된 이메일이면 Supabase는 오류 대신 빈 identities를 돌려준다
  if (data.user && data.user.identities?.length === 0) return { ...keep, errors: { email: "이미 가입된 이메일이에요." } };
  if (!data.session) return { ...keep, sent: true, message: `${email}로 인증 메일을 보냈어요. 메일의 링크를 누르면 가입이 끝나요.` };
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(_: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const email = normalizeEmail(String(fd.get("email") ?? ""));
  const nickname = String(fd.get("nickname") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const passwordConfirm = String(fd.get("passwordConfirm") ?? "");
  const keep = { email, nickname };
  if (isDemoMode()) return { ...keep, message: "데모 모드에서는 회원 정보가 저장되지 않아 가입할 수 없어요." };

  const db = await readDb();
  const errors: AuthFormState["errors"] = {};
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  else if (db.users.some((u) => u.email === email)) errors.email = "이미 가입된 이메일이에요.";
  const nicknameError = validateNickname(nickname);
  if (nicknameError) errors.nickname = nicknameError;
  else if (db.users.some((u) => u.nickname.toLowerCase() === nickname.toLowerCase())) errors.nickname = "이미 사용 중인 닉네임이에요.";
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;
  if (!passwordError && password !== passwordConfirm) errors.passwordConfirm = "비밀번호가 일치하지 않아요.";
  if (fd.get("agree") !== "on") errors.agree = "약관에 동의해야 가입할 수 있어요.";
  if (Object.keys(errors).length) return { ...keep, errors };

  if (usesSupabaseAuth()) return supabaseSignup(fd, email, nickname, password);

  const passwordHash = hashPassword(password);
  const created = await mutate((db) => {
    // 동시에 같은 이메일로 가입하는 경우 대비
    if (db.users.some((u) => u.email === email)) return null;
    const user = { id: newId("u"), email, nickname, passwordHash, createdAt: nowIso() };
    db.users.push(user);
    return user;
  });
  if (!created) return { ...keep, errors: { email: "이미 가입된 이메일이에요." } };

  await startSession(created.id);
  redirect(safeRedirect(fd.get("redirect")));
}

export async function login(_: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const email = normalizeEmail(String(fd.get("email") ?? ""));
  const password = String(fd.get("password") ?? "");
  if (isDemoMode()) return { email, message: "데모 모드에서는 회원 정보가 없어 로그인할 수 없어요." };
  if (!email || !password) return { email, message: "이메일과 비밀번호를 입력해 주세요." };

  if (usesSupabaseAuth()) {
    const { error } = await (await userSupabase()).auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === "email_not_confirmed") return { email, message: "메일함의 인증 링크를 먼저 눌러 주세요." };
      // 가입 여부를 알 수 없도록 같은 안내를 보여 준다
      return { email, message: "이메일 또는 비밀번호가 올바르지 않아요." };
    }
    revalidatePath("/", "layout");
    redirect(safeRedirect(fd.get("redirect")));
  }

  const user = (await readDb()).users.find((u) => u.email === email);
  // 가입 여부를 알 수 없도록 같은 안내를 보여 준다
  if (!user || !verifyPassword(password, user.passwordHash)) return { email, message: "이메일 또는 비밀번호가 올바르지 않아요." };

  await startSession(user.id);
  redirect(safeRedirect(fd.get("redirect")));
}

/** 소셜 로그인 시작: 제공자 로그인 화면으로 보낸다. 돌아오면 /auth/callback에서 로그인을 마친다 */
export async function oauthLogin(provider: "kakao" | "google", redirectTo: string): Promise<{ error?: string } | void> {
  if (!usesSupabaseAuth() || !socialProviders().includes(provider)) return { error: "아직 준비 중인 로그인 방법이에요." };
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const { data, error } = await (await userSupabase()).auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeRedirect(redirectTo))}` },
  });
  if (error || !data.url) return { error: "소셜 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요." };
  redirect(data.url);
}

export async function logout() {
  await endSession();
  revalidatePath("/", "layout");
}

/* ---------------- 응원 ---------------- */

export async function cheerArtist(artistId: string): Promise<"ok" | "used" | "invalid" | "readonly" | "login"> {
  if (isDemoMode()) return "readonly";
  // 응원자는 클라이언트가 보낸 값이 아니라 서버 세션으로 확인한다
  const user = await getCurrentUser();
  if (!user) return "login";
  const userId = user.id;
  if (usesSupabaseAuth()) {
    // 로그인한 회원 권한으로 저장한다. 날짜·하루 1회·활성 아티스트 여부는 DB가 검사한다
    const { error } = await (await userSupabase()).from("cheers").insert({ user_id: userId, artist_id: artistId });
    if (error) {
      if (error.code === "23505") return "used";
      if (error.message.includes("응원할 수 없는") || error.code === "22P02" || error.code === "23503") return "invalid";
      throw new Error(`응원을 저장하지 못했어요: ${error.message}`);
    }
    revalidatePath("/", "layout");
    return "ok";
  }
  const result = await mutate((db) => {
    if (!db.artists.some((a) => a.id === artistId && a.status === "active")) return "invalid" as const;
    // 1인 하루 총 1회
    if (db.cheerRecords.some((r) => r.userId === userId && r.date === serviceToday())) return "used" as const;
    db.cheerRecords.push({ id: newId("ch"), userId, artistId, date: serviceToday(), createdAt: nowIso(), valid: true });
    return "ok" as const;
  });
  if (result === "ok") revalidatePath("/", "layout");
  return result;
}
