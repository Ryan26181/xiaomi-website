// The compact island: the clock in the middle, and on either side whatever
// matters right now — the focus countdown, the song playing, or today's water
// ring and your headphones' battery.

import { css } from "../core/color";
import { h, text, toggle } from "../core/dom";
import { icon } from "../core/icons";
import { clock, countdown, shortDate } from "../core/time";
import { devices } from "../features/devices";
import { focus } from "../features/focus";
import { media } from "../features/media";
import { settings } from "../features/settings";
import { water } from "../features/water";
import { Ring } from "../views/ring";

export type CompactKind = "idle" | "music" | "focus";

const WIDTH: Record<CompactKind, number> = { idle: 212, music: 268, focus: 248 };

export class Compact {
  readonly el: HTMLElement;
  private left: HTMLElement;
  private right: HTMLElement;
  private clockEl: HTMLElement;
  private waterRing = new Ring(16, 2.6, "c-water");
  private focusRing = new Ring(16, 2.6, "c-focus");
  private art: HTMLElement;
  private eq: HTMLElement;
  private countdownEl: HTMLElement;
  private status: HTMLElement;
  private shown: CompactKind | null = null;

  constructor() {
    this.clockEl = h("span", { class: "c-clock" });
    this.left = h("div", { class: "c-side left" });
    this.right = h("div", { class: "c-side right" });
    this.art = h("div", { class: "c-art" });
    this.eq = h("div", { class: "eq" }, ...Array.from({ length: 4 }, () => h("i", null)));
    this.countdownEl = h("span", { class: "c-countdown" });
    this.status = h("span", { class: "c-status" });
    this.el = h("div", { class: "layer compact" }, this.left, this.clockEl, this.right);
  }

  kind(): CompactKind {
    if (focus.active) return "focus";
    if (media.state.active && media.state.playing) return "music";
    return "idle";
  }

  width(): number {
    return WIDTH[this.kind()];
  }

  render(now = Date.now()) {
    const kind = this.kind();
    if (kind !== this.shown) {
      this.shown = kind;
      this.el.dataset.kind = kind;
      this.el.style.width = `${WIDTH[kind]}px`;
      switch (kind) {
        case "focus":
          this.left.replaceChildren(this.focusRing.el);
          this.right.replaceChildren(this.countdownEl);
          break;
        case "music":
          this.left.replaceChildren(this.art);
          this.right.replaceChildren(this.eq);
          break;
        default:
          this.left.replaceChildren(this.waterRing.el);
          this.right.replaceChildren(this.status);
      }
    }
    if (kind === "music") {
      this.art.style.backgroundImage = media.art ? `url("${media.art}")` : "";
      toggle(this.art, "blank", !media.art);
      this.eq.style.setProperty("--accent", css(media.accent));
      toggle(this.eq, "paused", !media.state.playing);
    }
    if (kind === "idle") this.renderStatus(new Date(now));
    this.tick(now);
  }

  /** Right side when nothing else claims it: headphones, low battery, charging, or the date. */
  private renderStatus(now: Date) {
    const headset = devices.headset;
    const power = devices.power;
    this.status.replaceChildren();
    this.status.className = "c-status";
    if (headset) {
      this.status.append(icon(headset.kind === "speaker" ? "speaker" : "headphones", 13));
      if (headset.battery != null) this.status.append(h("span", null, `${headset.battery}%`));
    } else if (power?.hasBattery && power.plugged && power.charging) {
      this.status.classList.add("charging");
      this.status.append(icon("boltFill", 12), h("span", null, `${power.percent}%`));
    } else if (power?.hasBattery && !power.plugged && power.percent <= 20) {
      this.status.classList.add("low");
      this.status.append(icon("battery", 14), h("span", null, `${power.percent}%`));
    } else {
      this.status.append(h("span", { class: "c-date" }, shortDate(now).split(" ").slice(0, 2).join(" ")));
    }
  }

  tick(now: number) {
    text(this.clockEl, clock(new Date(now), settings.value.clock24));
    if (this.shown === "focus") {
      text(this.countdownEl, countdown(focus.remainingMs(now) / 1000));
      this.focusRing.set(focus.progress(now));
      this.el.dataset.phase = focus.doc.phase;
      toggle(this.el, "paused", !focus.doc.running);
    } else if (this.shown === "idle") {
      this.waterRing.set(water.total() / water.goal());
    }
  }
}
