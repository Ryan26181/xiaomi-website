// Live activities: the island widens for a moment to say something happened —
// headphones connected, the charger plugged in, time to drink, focus done, a
// new song. One at a time; the next waits its turn.

import { h } from "../core/dom";
import { icon, type IconName } from "../core/icons";
import type { ViewName } from "../features/settings";
import { Ring } from "../views/ring";

export type Accessory =
  | { kind: "ring"; value: number; label: string }
  | { kind: "text"; text: string }
  | { kind: "eq" };

export interface Activity {
  /** The same key replaces what is shown instead of queueing behind it. */
  key: string;
  icon: IconName;
  /** CSS colour for the icon's badge. */
  tint: string;
  /** A picture instead of the icon (a cover). */
  art?: string | null;
  title: string;
  sub?: string;
  right?: Accessory;
  ms: number;
  /** Where pointing at it leads. */
  view?: ViewName;
}

export const ACTIVITY_W = 368;
export const ACTIVITY_H = 44;

/** Queued longer than this, an activity is old news and dropped. */
const STALE_MS = 15_000;

export class Activities {
  readonly el: HTMLElement;
  current: Activity | null = null;
  onChange: (() => void) | null = null;

  private queue: Array<{ a: Activity; at: number }> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private held = false;

  constructor() {
    this.el = h("div", { class: "layer activity" });
    this.el.style.width = `${ACTIVITY_W}px`;
  }

  show(a: Activity) {
    if (this.current?.key === a.key) {
      this.current = a;
      this.render();
      if (!this.held) this.arm(a.ms);
      return;
    }
    this.queue = this.queue.filter((q) => q.a.key !== a.key);
    this.queue.push({ a, at: Date.now() });
    if (!this.current && !this.held) this.next();
  }

  /** Updates what is on screen without making it pop again (a battery arriving late). */
  update(key: string, patch: Partial<Activity>) {
    if (this.current?.key === key) {
      this.current = { ...this.current, ...patch };
      this.render();
    }
    this.queue = this.queue.map((q) => (q.a.key === key ? { ...q, a: { ...q.a, ...patch } } : q));
  }

  /** The island opened: stop showing, keep the rest for later. */
  hold() {
    this.held = true;
    this.clearTimer();
    if (this.current) {
      this.current = null;
      this.onChange?.();
    }
  }

  release() {
    this.held = false;
    if (!this.current) this.next();
  }

  /** Pointing at an activity opens its view; it is done then. */
  take(): Activity | null {
    const a = this.current;
    this.current = null;
    this.clearTimer();
    return a;
  }

  private next() {
    const now = Date.now();
    this.queue = this.queue.filter((q) => now - q.at < STALE_MS);
    const item = this.queue.shift();
    this.current = item?.a ?? null;
    if (this.current) {
      this.render();
      this.arm(this.current.ms);
    }
    this.onChange?.();
  }

  private arm(ms: number) {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.current = null;
      this.onChange?.();
      // A beat of the normal island between two activities.
      setTimeout(() => !this.current && !this.held && this.next(), 420);
    }, ms);
  }

  private clearTimer() {
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = null;
  }

  private render() {
    const a = this.current;
    if (!a) return;
    const badge = a.art
      ? h("div", { class: "a-badge art", style: `background-image:url("${a.art}")` })
      : h("div", { class: "a-badge", style: `--tint:${a.tint}` }, icon(a.icon, 15));
    let right: HTMLElement | null = null;
    if (a.right?.kind === "ring") {
      const ring = new Ring(26, 3, "a-ring");
      ring.set(a.right.value);
      right = h("div", { class: "a-right ring", style: `--tint:${a.tint}` }, ring.el, h("span", null, a.right.label));
    } else if (a.right?.kind === "text") {
      right = h("div", { class: "a-right text", style: `--tint:${a.tint}` }, a.right.text);
    } else if (a.right?.kind === "eq") {
      right = h("div", { class: "a-right", style: `--accent:${a.tint}` }, h("div", { class: "eq" }, ...Array.from({ length: 4 }, () => h("i", null))));
    }
    const textBlock = h("div", { class: "a-text" }, h("div", { class: "a-title" }, a.title), a.sub ? h("div", { class: "a-sub" }, a.sub) : null);
    this.el.replaceChildren(...[badge, textBlock, right].filter((n): n is HTMLElement => n != null));
  }
}
