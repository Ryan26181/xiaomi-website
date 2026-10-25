// Synced lyrics from LRCLIB (lrclib.net): free, no key, open to browsers.
// The page asks it directly; the CSP allows that one host (tauri.conf.json).

export interface LyricLine {
  /** Seconds into the track. */
  t: number;
  text: string;
}

export interface Lyrics {
  synced: LyricLine[] | null;
  plain: string | null;
  instrumental: boolean;
}

const API = "https://lrclib.net/api";
const CLIENT = "Notchy (https://github.com/Ryan26181/xiaomi-website/tree/notchy)";

/**
 * Parses LRC: `[mm:ss.xx] text`, several stamps on one line, `[offset:+/-ms]`.
 * Metadata tags ([ar:], [ti:]…) and blank lines without a stamp are skipped.
 */
export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  let offset = 0;
  const stamp = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  for (const raw of lrc.split(/\r?\n/)) {
    const off = /^\[offset:\s*([+-]?\d+)\s*\]/i.exec(raw.trim());
    if (off) {
      offset = Number(off[1]) / 1000;
      continue;
    }
    const times: number[] = [];
    let last = 0;
    stamp.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = stamp.exec(raw)) && m.index === last) {
      const frac = m[3] ? Number(m[3]) / 10 ** m[3].length : 0;
      times.push(Number(m[1]) * 60 + Number(m[2]) + frac);
      last = stamp.lastIndex;
    }
    if (times.length === 0) continue;
    const text = raw.slice(last).trim();
    // LRC's offset moves the lyrics earlier when positive.
    for (const t of times) out.push({ t: Math.max(0, t - offset), text });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** The line being sung at `t`: the last one that started, or -1 before the first. */
export function lineAt(lines: LyricLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * What to search for. Videos come as "Artist - Title (Official Video)" from a
 * channel called "Artist - Topic" or "ArtistVEVO": the tags are tidied so a
 * lyrics search can find them.
 */
export function cleanQuery(title: string, artist: string): { title: string; artist: string } {
  let t = title.trim();
  let a = artist
    .trim()
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/VEVO$/i, "")
    .trim();
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(t);
  if (dash && (!a || norm(dash[1]).includes(norm(a)) || norm(a).includes(norm(dash[1])))) {
    a = dash[1].trim();
    t = dash[2].trim();
  }
  t = t
    .replace(/\s*[([](official|lyric|lyrics|audio|video|music video|mv|visualizer|hd|4k|remaster(ed)?)[^)\]]*[)\]]/gi, "")
    .replace(/\s*\|.*$/, "")
    .trim();
  return { title: t, artist: a };
}

interface ApiTrack {
  trackName?: string;
  artistName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

function toLyrics(found: ApiTrack): Lyrics {
  const synced = found.syncedLyrics ? parseLrc(found.syncedLyrics) : null;
  return {
    synced: synced && synced.length > 0 ? synced : null,
    plain: found.plainLyrics?.trim() || null,
    instrumental: Boolean(found.instrumental),
  };
}

/** The best search result: synced first, then the closest duration. */
export function pickResult(results: ApiTrack[], duration: number): ApiTrack | null {
  const usable = results.filter((r) => r.syncedLyrics || r.plainLyrics || r.instrumental);
  if (usable.length === 0) return null;
  const score = (r: ApiTrack) => {
    const off = duration > 0 && r.duration ? Math.abs(r.duration - duration) : 0;
    return (r.syncedLyrics ? 0 : 100) + Math.min(off, 60);
  };
  const best = usable.reduce((a, b) => (score(b) < score(a) ? b : a));
  // Same title, very different length: probably another version.
  if (duration > 0 && best.duration && Math.abs(best.duration - duration) > 20) return null;
  return best;
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { "Lrclib-Client": CLIENT } });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

const cache = new Map<string, Lyrics | null>();

export async function fetchLyrics(title: string, artist: string, album: string, duration: number): Promise<Lyrics | null> {
  const q = cleanQuery(title, artist);
  if (!q.title) return null;
  const key = `${q.artist}\u001f${q.title}\u001f${Math.round(duration)}`;
  if (cache.has(key)) return cache.get(key)!;

  let result: Lyrics | null = null;
  try {
    if (q.artist && duration > 0) {
      const params = new URLSearchParams({ track_name: q.title, artist_name: q.artist, duration: String(Math.round(duration)) });
      if (album) params.set("album_name", album);
      const exact = await getJson<ApiTrack>(`${API}/get?${params}`);
      if (exact) result = toLyrics(exact);
    }
    if (!result || (!result.synced && !result.plain && !result.instrumental)) {
      const params = new URLSearchParams({ track_name: q.title });
      if (q.artist) params.set("artist_name", q.artist);
      const found = await getJson<ApiTrack[]>(`${API}/search?${params}`);
      const best = found ? pickResult(found, duration) : null;
      result = best ? toLyrics(best) : null;
    }
  } catch {
    // Offline: try again the next time this track plays.
    return null;
  }
  cache.set(key, result);
  if (cache.size > 40) cache.delete(cache.keys().next().value!);
  return result;
}
