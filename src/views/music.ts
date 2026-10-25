// Now playing: cover, title, progress and controls on the left, the lyrics
// line by line on the right. The lyrics button makes the island taller to
// show more of them.

import { css } from "../core/color";
import { h, text, toggle } from "../core/dom";
import { icon, setIcon } from "../core/icons";
import { lineAt } from "../core/lyrics";
import { mmss } from "../core/time";
import { media } from "../features/media";
import { settings } from "../features/settings";
import { HEADER_H, type IslandHost, type View } from "./view";

const BODY_H = 136;
const TALL_BODY_H = 236;

export class MusicView implements View {
  readonly name = "music";
  readonly title = "Now Playing";
  readonly icon = "music";
  readonly el: HTMLElement;

  private tall = false;
  private art: HTMLElement;
  private titleEl: HTMLElement;
  private artistEl: HTMLElement;
  private elapsed: HTMLElement;
  private left: HTMLElement;
  private fill: HTMLElement;
  private bar: HTMLElement;
  private playBtn: HTMLButtonElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private lyricsBtn: HTMLButtonElement;
  private lyricsPane: HTMLElement;
  private lines: HTMLElement;
  private status: HTMLElement;
  private player: HTMLElement;
  private empty: HTMLElement;

  private linesFor = "";
  private current = -2;

  constructor(private host: IslandHost) {
    this.art = h("div", { class: "np-art" });
    this.titleEl = h("div", { class: "np-title" });
    this.artistEl = h("div", { class: "np-artist" });
    this.elapsed = h("span", { class: "np-time" });
    this.left = h("span", { class: "np-time right" });
    this.fill = h("div", { class: "np-fill" });
    this.bar = h("div", { class: "np-bar", onclick: (e: MouseEvent) => this.seekAt(e) }, this.fill);
    this.prevBtn = h("button", { class: "ctl", title: "Previous", onclick: () => void media.control("previous") }, icon("previous", 18));
    this.playBtn = h("button", { class: "ctl play", title: "Play / pause", onclick: () => void media.control("playPause") });
    this.nextBtn = h("button", { class: "ctl", title: "Next", onclick: () => void media.control("next") }, icon("next", 18));
    this.lyricsBtn = h("button", { class: "ctl small", title: "Show more lyrics", onclick: () => this.toggleTall() }, icon("lyrics", 16));

    this.player = h(
      "div",
      { class: "np-player" },
      h("div", { class: "np-top" }, this.art, h("div", { class: "np-meta" }, this.titleEl, this.artistEl)),
      h("div", { class: "np-progress" }, this.elapsed, this.bar, this.left),
      h("div", { class: "np-controls" }, this.lyricsBtn, this.prevBtn, this.playBtn, this.nextBtn),
    );
    this.lines = h("div", { class: "ly-lines" });
    this.status = h("div", { class: "ly-status" });
    this.lyricsPane = h("div", { class: "np-lyrics" }, this.lines, this.status);
    this.empty = h(
      "div",
      { class: "np-empty" },
      h("div", { class: "empty-icon" }, icon("music", 22)),
      h("div", { class: "empty-title" }, "Nothing playing"),
      h("div", { class: "empty-sub" }, "Play something in Spotify, YouTube or any player — it shows up here."),
    );
    this.el = h("section", { class: "view music" }, h("div", { class: "np" }, this.player, this.lyricsPane), this.empty);

    media.subscribe(() => this.render());
    settings.subscribe(() => this.render());
    this.render();
  }

  height(): number {
    return HEADER_H + (this.tall && this.hasLyricsPane() ? TALL_BODY_H : BODY_H);
  }

  live(): boolean {
    return media.state.active && media.state.playing;
  }

  /** A colour glow behind the card while something plays. */
  wash(): string | null {
    return media.state.active ? css(media.accent, 0.5) : null;
  }

  private hasLyricsPane(): boolean {
    return media.state.active && settings.value.showLyrics;
  }

  private toggleTall() {
    this.tall = !this.tall;
    this.current = -2;
    this.render();
    this.host.relayout();
  }

  private seekAt(e: MouseEvent) {
    const s = media.state;
    if (!s.canSeek || s.duration <= 0) return;
    const rect = this.bar.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    void media.seek(p * s.duration);
  }

  private render() {
    const s = media.state;
    toggle(this.el, "is-empty", !s.active);
    toggle(this.el, "no-lyrics", !settings.value.showLyrics);
    toggle(this.el, "tall", this.tall && this.hasLyricsPane());
    if (!s.active) return;

    text(this.titleEl, s.title);
    this.titleEl.title = s.title;
    text(this.artistEl, [s.artist, s.source].filter(Boolean).join(" · "));
    if (media.art) {
      this.art.style.backgroundImage = `url("${media.art}")`;
      this.art.replaceChildren();
    } else {
      this.art.style.backgroundImage = "";
      if (!this.art.firstChild) this.art.append(icon("music", 22));
    }
    this.el.style.setProperty("--accent", css(media.accent));
    setIcon(this.playBtn, s.playing ? "pause" : "play", 18);
    this.prevBtn.disabled = !s.canPrevious;
    this.nextBtn.disabled = !s.canNext;
    toggle(this.lyricsBtn, "on", this.tall);
    toggle(this.bar, "seekable", s.canSeek && s.duration > 0);

    this.renderLyrics();
    this.tick(Date.now());
  }

  private renderLyrics() {
    const key = `${media.trackKey}|${media.lyricsStatus}`;
    if (key === this.linesFor) return;
    this.linesFor = key;
    this.current = -2;
    const ly = media.lyrics;
    this.lines.replaceChildren();
    this.lines.style.transform = "";
    toggle(this.lyricsPane, "plain", false);
    switch (media.lyricsStatus) {
      case "loading":
        text(this.status, "Looking for lyrics…");
        return;
      case "none":
        text(this.status, "No lyrics for this one");
        return;
      case "off":
        text(this.status, "");
        return;
    }
    text(this.status, "");
    if (ly?.synced) {
      for (const line of ly.synced) {
        this.lines.append(h("div", { class: line.text ? "ly-line" : "ly-line gap" }, line.text || "♪"));
      }
    } else if (ly?.plain) {
      toggle(this.lyricsPane, "plain", true);
      for (const line of ly.plain.split(/\r?\n/)) this.lines.append(h("div", { class: "ly-line" }, line || " "));
    }
  }

  tick(now: number) {
    const s = media.state;
    if (!s.active) return;
    const pos = media.position(now);
    text(this.elapsed, mmss(pos));
    text(this.left, s.duration > 0 ? `-${mmss(s.duration - pos)}` : "");
    this.fill.style.width = s.duration > 0 ? `${(pos / s.duration) * 100}%` : "0%";
    toggle(this.bar, "unknown", s.duration <= 0);

    const synced = media.lyrics?.synced;
    if (!synced || media.lyricsStatus !== "ready") return;
    // A hair early: the line should be there as it is sung, not after.
    const i = lineAt(synced, pos + 0.25);
    if (i === this.current) return;
    const rows = this.lines.children;
    rows[this.current]?.classList.remove("now");
    for (let k = 0; k < rows.length; k++) toggle(rows[k], "past", k < i);
    this.current = i;
    const row = rows[Math.max(0, i)] as HTMLElement | undefined;
    if (!row) return;
    if (i >= 0) row.classList.add("now");
    const paneH = this.lyricsPane.clientHeight || BODY_H - 16;
    const y = row.offsetTop - paneH * (this.tall ? 0.36 : 0.3);
    this.lines.style.transform = `translateY(${-Math.max(0, y)}px)`;
  }
}
