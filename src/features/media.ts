// Now playing: what Rust reads from the Windows media controls, the cover's
// accent colour, and the track's lyrics.

import { call, on } from "../core/bridge";
import { DEFAULT_ACCENT, accentOf, type RGB } from "../core/color";
import { Emitter } from "../core/emitter";
import { fetchLyrics, type Lyrics } from "../core/lyrics";
import { EMPTY_MEDIA, type Artwork, type MediaState } from "../core/types";
import { settings } from "./settings";

export type LyricsStatus = "off" | "loading" | "ready" | "none";

class MediaStore extends Emitter {
  state: MediaState = { ...EMPTY_MEDIA };
  art: string | null = null;
  accent: RGB = DEFAULT_ACCENT;
  lyrics: Lyrics | null = null;
  lyricsStatus: LyricsStatus = "off";

  /** A different track started playing (not the first one seen). */
  onTrackChange: ((state: MediaState) => void) | null = null;

  private covers = new Map<string, string>();
  private lyricsFor = "";
  private seenFirst = false;

  init() {
    on<MediaState>("media-state", (s) => this.apply(s));
    on<Artwork>("media-artwork", (a) => this.artwork(a));
    void call<MediaState>("media_state").then((s) => s && this.apply(s));
    settings.subscribe(() => this.wantLyrics());
  }

  /** Seconds into the track now, running the clock on while it plays. */
  position(now = Date.now()): number {
    const s = this.state;
    if (!s.active) return 0;
    const p = s.playing ? s.position + (now - s.positionAt) / 1000 : s.position;
    return s.duration > 0 ? Math.min(s.duration, Math.max(0, p)) : Math.max(0, p);
  }

  get trackKey(): string {
    return this.state.active ? this.state.artKey : "";
  }

  private apply(next: MediaState) {
    const before = this.trackKey;
    this.state = next;
    const after = this.trackKey;
    if (after !== before) {
      this.art = this.covers.get(after) ?? null;
      if (!this.art) this.accent = DEFAULT_ACCENT;
      if (after && this.seenFirst && next.playing) this.onTrackChange?.(next);
      if (after) this.seenFirst = true;
    }
    this.wantLyrics();
    this.changed();
  }

  private artwork({ artKey, dataUrl }: Artwork) {
    this.covers.set(artKey, dataUrl);
    while (this.covers.size > 12) this.covers.delete(this.covers.keys().next().value!);
    if (artKey !== this.trackKey) return;
    this.art = dataUrl;
    void accentOf(dataUrl).then((rgb) => {
      if (artKey !== this.trackKey) return;
      this.accent = rgb;
      this.changed();
    });
    this.changed();
  }

  private wantLyrics() {
    const s = this.state;
    if (!settings.value.showLyrics || !s.active) {
      this.lyricsFor = "";
      this.lyrics = null;
      this.lyricsStatus = "off";
      return;
    }
    const key = this.trackKey;
    if (key === this.lyricsFor) return;
    this.lyricsFor = key;
    this.lyrics = null;
    this.lyricsStatus = "loading";
    void fetchLyrics(s.title, s.artist, s.album, s.duration).then((found) => {
      if (this.lyricsFor !== key) return;
      this.lyrics = found;
      this.lyricsStatus = found && (found.synced || found.plain) ? "ready" : "none";
      this.changed();
    });
  }

  async control(action: "playPause" | "next" | "previous") {
    if (action === "playPause") {
      // Show it at once; the player's own event confirms it.
      const now = Date.now();
      this.state = { ...this.state, position: this.position(now), positionAt: now, playing: !this.state.playing };
      this.changed();
    }
    await call("media_control", { action });
  }

  async seek(seconds: number) {
    const now = Date.now();
    this.state = { ...this.state, position: seconds, positionAt: now };
    this.changed();
    await call("media_control", { action: "seek", value: seconds });
  }
}

export const media = new MediaStore();
