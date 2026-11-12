/** 플랫폼 ID 또는 URL에서 ID 추출. 형식이 맞지 않으면 null */
export function parseSpotifyArtistId(input: string): string | null {
  const v = input.trim();
  const url = v.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?artist\/([A-Za-z0-9]{22})/);
  if (url) return url[1];
  const uri = v.match(/^spotify:artist:([A-Za-z0-9]{22})$/);
  if (uri) return uri[1];
  return /^[A-Za-z0-9]{22}$/.test(v) ? v : null;
}

export function parseMelonArtistId(input: string): string | null {
  const v = input.trim();
  const url = v.match(/melon\.com\/.*[?&]artistId=(\d+)/);
  if (url) return url[1];
  return /^\d{3,10}$/.test(v) ? v : null;
}

export function parseYoutubeChannel(input: string): string | null {
  const v = input.trim();
  const url = v.match(/youtube\.com\/(?:channel\/(UC[\w-]{22})|(@[\w.-]+))/);
  if (url) return url[1] ?? url[2];
  if (/^UC[\w-]{22}$/.test(v) || /^@[\w.-]+$/.test(v)) return v;
  return null;
}

export function parseAppleMusicArtistId(input: string): string | null {
  const v = input.trim();
  const url = v.match(/music\.apple\.com\/.*\/artist\/[^/]+\/(\d+)/);
  if (url) return url[1];
  return /^\d{5,12}$/.test(v) ? v : null;
}

export function isHttpUrl(input: string) {
  try {
    const u = new URL(input.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
