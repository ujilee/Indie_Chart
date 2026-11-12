/**
 * Spotify 아티스트 프로필 이미지 조회 (서버 전용).
 *
 * 1) SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET 환경변수가 있으면 Web API (최대 640px)
 * 2) 없으면 인증이 필요 없는 oEmbed 엔드포인트 (320px 썸네일)
 */

export interface SpotifyArtistProfile {
  name: string;
  image: string | null;
}

const TIMEOUT = 8000;

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

let token: { value: string; expires: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const data = await getJson("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  token = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return token.value;
}

const cache = new Map<string, { at: number; value: SpotifyArtistProfile | null }>();
const CACHE_TTL = 60 * 60 * 1000;

/** 존재하지 않는 Spotify 아티스트면 null. 네트워크 오류는 throw */
export async function fetchSpotifyArtistProfile(spotifyId: string, { fresh = false } = {}): Promise<SpotifyArtistProfile | null> {
  if (!/^[A-Za-z0-9]{22}$/.test(spotifyId)) return null;
  const hit = cache.get(spotifyId);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL) return hit.value;
  const value = await fetchUncached(spotifyId);
  cache.set(spotifyId, { at: Date.now(), value });
  return value;
}

async function fetchUncached(spotifyId: string): Promise<SpotifyArtistProfile | null> {
  const accessToken = await getAccessToken().catch(() => null);
  if (accessToken) {
    try {
      const data = await getJson(`https://api.spotify.com/v1/artists/${spotifyId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      // images는 큰 크기 순으로 정렬되어 있음
      return { name: data.name, image: data.images?.[0]?.url ?? null };
    } catch (e) {
      if (e instanceof Error && e.message === "HTTP 404") return null;
      // 그 외 오류는 oEmbed로 재시도
    }
  }

  try {
    const data = await getJson(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/artist/${spotifyId}`)}`,
    );
    return { name: data.title, image: data.thumbnail_url ?? null };
  } catch (e) {
    if (e instanceof Error && (e.message === "HTTP 404" || e.message === "HTTP 400")) return null;
    throw e;
  }
}

/**
 * Spotify 팔로워 수 (공식 Web API). 키가 없거나 API가 값을 주지 않으면 null.
 * Spotify는 2026년부터 개발 모드 앱의 아티스트 응답에서 팔로워를 빼고 있어, 키가 있어도 null일 수 있다.
 * 월간 리스너는 공식 API에 없다.
 */
export async function fetchSpotifyFollowers(spotifyId: string): Promise<number | null> {
  if (!/^[A-Za-z0-9]{22}$/.test(spotifyId)) return null;
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  const data = await getJson(`https://api.spotify.com/v1/artists/${spotifyId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const n = data?.followers?.total;
  return typeof n === "number" ? n : null;
}

export const hasSpotifyApiKeys = () => Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
