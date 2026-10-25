// The island: its shape and size, the three layers drawn inside it (compact,
// live activity, expanded views), and the pointer.
//
// The window is a fixed transparent panel at the top of the screen; the
// island is drawn in it, glued to the top edge and centred. Rust reports the
// cursor (Windows has no hover for a click-through window) and takes the
// island's rectangle back to decide what the mouse may click through.

import { Tracked } from "../core/anim";
import { call, IS_TAURI, on } from "../core/bridge";
import { h, text, toggle } from "../core/dom";
import { icon } from "../core/icons";
import { IslandFsm, type IslandMode } from "../core/fsm";
import { clock, shortDate } from "../core/time";
import { devices } from "../features/devices";
import { focus } from "../features/focus";
import { media } from "../features/media";
import { settings, type ViewName } from "../features/settings";
import { water } from "../features/water";
import type { View, IslandHost } from "../views/view";
import { EXPANDED_W } from "../views/view";
import { ACTIVITY_H, ACTIVITY_W, Activities } from "./activity";
import { Compact } from "./compact";
import { EAR_MAX, islandPath } from "./shape";

const COMPACT_H = 34;
const EXPANDED_R = 26;
const HIDDEN_W = 150;
/** Same margin as the Rust hit test (src-tauri/src/island.rs). */
const HIT_MARGIN = 14;

export class Island implements IslandHost {
  readonly fsm = new IslandFsm();
  readonly activities = new Activities();
  readonly compact = new Compact();

  private root: HTMLElement;
  private islandEl!: HTMLElement;
  private svg!: SVGSVGElement;
  private path!: SVGPathElement;
  private body!: HTMLElement;
  private wash!: HTMLElement;
  private expanded!: HTMLElement;
  private headTitle!: HTMLElement;
  private headClock!: HTMLElement;
  private headStatus!: HTMLElement;
  private tabs = new Map<ViewName, HTMLButtonElement>();

  private views = new Map<ViewName, View>();
  private view!: View;

  private w = new Tracked(HIDDEN_W);
  private hgt = new Tracked(0);
  private r = new Tracked(COMPACT_H / 2);

  private running = false;
  private last = 0;
  private pushed = { x: -1, w: -1, h: -1 };
  private pins = new Set<string>();
  private collapsed = false;
  private collapseTimer: ReturnType<typeof setTimeout> | null = null;
  private wasInside = false;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private tickerMs = 0;

  constructor(root: HTMLElement, views: View[]) {
    this.root = root;
    for (const v of views) this.views.set(v.name, v);
    this.view = this.views.get(settings.value.lastView) ?? views[0];
    this.build();
    this.wire();
    this.setView(this.view.name, false);
    this.syncClasses();
    this.relayout();
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  private build() {
    const NS = "http://www.w3.org/2000/svg";
    this.svg = document.createElementNS(NS, "svg");
    this.svg.setAttribute("class", "shape");
    this.path = document.createElementNS(NS, "path");
    this.svg.append(this.path);

    this.wash = h("div", { class: "wash" });
    this.headTitle = h("div", { class: "hd-title" });
    this.headClock = h("span", { class: "hd-clock" });
    this.headStatus = h("span", { class: "hd-status" });
    const tabs = h("div", { class: "hd-tabs" });
    for (const v of this.views.values()) {
      const tab = h("button", { class: "tab", title: v.title, onclick: () => this.setView(v.name) }, icon(v.icon, 15));
      this.tabs.set(v.name, tab);
      tabs.append(tab);
    }
    const header = h(
      "header",
      { class: "hd" },
      this.headTitle,
      h("div", { class: "hd-mid" }, h("i", { class: "hd-dot" }), this.headClock),
      h("div", { class: "hd-right" }, this.headStatus, tabs),
    );
    this.expanded = h("div", { class: "layer expanded" }, header, h("div", { class: "views" }, ...[...this.views.values()].map((v) => v.el)));
    this.expanded.style.width = `${EXPANDED_W}px`;

    this.body = h("div", { class: "body" }, this.wash, this.compact.el, this.activities.el, this.expanded);
    this.islandEl = h("div", { id: "island" }, this.svg, this.body);
    const strip = h("div", { id: "wake-strip" });
    strip.addEventListener("mouseenter", () => this.fsm.mouseEntered());
    this.root.append(strip, this.islandEl);
  }

  private wire() {
    this.fsm.onChange = (from, to) => this.modeChanged(from, to);
    this.activities.onChange = () => {
      this.syncClasses();
      this.relayout();
      if (!this.activities.current) this.fsm.settle();
    };

    this.body.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (this.fsm.mode !== "expanded") this.openFromActivity();
      this.fsm.click();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.fsm.mode === "expanded") this.fsm.close();
    });

    if (IS_TAURI) {
      on<{ x: number; y: number }>("cursor", ({ x, y }) => this.onCursor(x, y));
      // Linux development builds have no cursor poll: follow the page instead.
      void call<{ cursorPoll: boolean }>("platform_info").then((p) => {
        if (p && !p.cursorPoll) this.followPageCursor();
      });
    } else {
      this.followPageCursor();
    }

    on("screen-changed", () => void call("set_collapsed", { collapsed: this.collapsed }));
    on<boolean>("fullscreen", (on) => this.fullscreen(on));
    on<string>("tray-open", (what) => this.openTo(what === "settings" ? "settings" : settings.value.lastView));

    const applySettings = () => {
      const s = settings.value;
      this.fsm.setOptions({ openOnHover: s.openOnHover, alwaysVisible: s.alwaysVisible });
      this.renderHeader();
      this.relayout();
    };
    settings.subscribe(applySettings);
    applySettings();
    devices.subscribe(() => {
      this.renderHeader();
      this.compact.render();
    });
    // Music starting or stopping, a timer running: the compact island changes
    // width, the music card its glow, and what needs ticking.
    let kind = this.compact.kind();
    const refresh = () => {
      this.updateWash();
      const now = this.compact.kind();
      if (now !== kind) {
        kind = now;
        this.relayout();
      } else {
        this.compact.render();
        this.updateTicker();
      }
    };
    media.subscribe(refresh);
    focus.subscribe(refresh);
    water.subscribe(() => this.compact.render());
  }

  private followPageCursor() {
    window.addEventListener("mousemove", (e) => this.onCursor(e.clientX, e.clientY));
    document.documentElement.addEventListener("mouseleave", () => this.onCursor(-10_000, -10_000));
  }

  // ── Pointer ──────────────────────────────────────────────────────────────

  /** The island's rectangle in window coordinates. */
  private rect() {
    const vw = window.innerWidth;
    const w = this.w.value;
    return { x: (vw - w) / 2, y: 0, w, h: this.hgt.value };
  }

  onCursor(x: number, y: number) {
    const r = this.rect();
    const inside = r.h > 0.5 && x >= r.x - HIT_MARGIN && x <= r.x + r.w + HIT_MARGIN && y >= r.y - HIT_MARGIN && y <= r.y + r.h + HIT_MARGIN;
    if (inside === this.wasInside) return;
    this.wasInside = inside;
    if (inside) {
      if (this.fsm.mode !== "expanded") this.openFromActivity();
      this.fsm.mouseEntered();
    } else {
      this.fsm.mouseLeft();
    }
  }

  /** Pointing at a live activity opens the view it is about. */
  private openFromActivity() {
    const a = this.activities.current;
    if (a?.view && (settings.value.openOnHover || this.fsm.mode === "compact")) {
      this.activities.take();
      this.setView(a.view, false);
    }
  }

  // ── IslandHost ───────────────────────────────────────────────────────────

  pin(reason: string) {
    this.pins.add(reason);
    this.fsm.pinned = true;
  }

  unpin(reason: string) {
    if (!this.pins.delete(reason)) return;
    if (this.pins.size === 0) this.fsm.unpin();
  }

  setFocusable(on: boolean) {
    void call("set_focusable", { focusable: on });
  }

  close() {
    this.fsm.close();
  }

  /** Opens the island on a view, from the tray, a reminder or a file drag. */
  openTo(view: ViewName) {
    this.setView(view, false);
    this.fsm.open();
  }

  setView(name: ViewName, remember = true) {
    const next = this.views.get(name);
    if (!next) return;
    this.view = next;
    for (const v of this.views.values()) toggle(v.el, "on", v === next);
    for (const [n, tab] of this.tabs) toggle(tab, "on", n === name);
    this.headTitle.replaceChildren(icon(next.icon, 14), h("span", null, next.title));
    this.expanded.style.height = `${next.height()}px`;
    next.shown?.();
    if (remember && settings.value.lastView !== name) settings.update({ lastView: name });
    this.syncClasses();
    this.relayout();
  }

  get currentView(): View {
    return this.view;
  }

  // ── Mode ─────────────────────────────────────────────────────────────────

  private modeChanged(from: IslandMode, to: IslandMode) {
    if (to === "expanded") {
      this.activities.hold();
      this.view.shown?.();
    } else if (from === "expanded") {
      (document.activeElement as HTMLElement | null)?.blur?.();
      this.activities.release();
    }
    this.windowCollapse(to === "hidden");
    this.syncClasses();
    this.relayout();
  }

  /** Hidden: once the island has slid away, the window shrinks to a strip and costs nothing. */
  private windowCollapse(hidden: boolean) {
    if (this.collapseTimer != null) clearTimeout(this.collapseTimer);
    this.collapseTimer = null;
    if (hidden) {
      this.collapseTimer = setTimeout(() => {
        this.collapseTimer = null;
        if (this.fsm.mode !== "hidden") return;
        this.collapsed = true;
        this.wasInside = false;
        void call("set_collapsed", { collapsed: true }).then(() => {
          if (this.fsm.suppressed) void call("set_wake_enabled", { enabled: false });
        });
      }, 420);
    } else if (this.collapsed) {
      this.collapsed = false;
      void call("set_collapsed", { collapsed: false });
    }
  }

  private fullscreen(on: boolean) {
    if (!settings.value.hideInFullscreen && on) return;
    this.fsm.setSuppressed(on);
    if (!on) void call("set_wake_enabled", { enabled: true });
  }

  private syncClasses() {
    const mode = this.fsm.mode;
    const showActivity = mode === "compact" && this.activities.current != null;
    toggle(this.root, "mode-hidden", mode === "hidden");
    toggle(this.root, "mode-compact", mode === "compact");
    toggle(this.root, "mode-expanded", mode === "expanded");
    toggle(this.compact.el, "on", mode === "compact" && !showActivity);
    toggle(this.activities.el, "on", showActivity);
    toggle(this.expanded, "on", mode === "expanded");
    this.updateWash();
    this.updateTicker();
  }

  updateWash() {
    const color = this.fsm.mode === "expanded" ? (this.view.wash?.() ?? null) : null;
    if (color) this.wash.style.setProperty("--wash", color);
    toggle(this.wash, "on", color != null);
  }

  // ── Size ─────────────────────────────────────────────────────────────────

  private target(): { w: number; h: number; r: number } {
    switch (this.fsm.mode) {
      case "hidden":
        return { w: HIDDEN_W, h: 0, r: 10 };
      case "compact":
        if (this.activities.current) return { w: ACTIVITY_W, h: ACTIVITY_H, r: ACTIVITY_H / 2 };
        return { w: this.compact.width(), h: COMPACT_H, r: COMPACT_H / 2 };
      case "expanded":
        return { w: EXPANDED_W, h: this.view.height(), r: EXPANDED_R };
    }
  }

  /** Animates to the size the current state wants: springs to grow, a short curve to shrink. */
  relayout() {
    const t = this.target();
    if (this.fsm.mode === "expanded") this.expanded.style.height = `${t.h}px`;
    const popping = this.fsm.mode === "compact" && this.activities.current != null;
    const [response, damping] = popping ? [0.4, 0.68] : [0.44, 0.8];
    for (const [tracked, to] of [
      [this.w, t.w],
      [this.hgt, t.h],
      [this.r, t.r],
    ] as const) {
      if (to >= tracked.value) tracked.springTo(to, response, damping);
      else tracked.curveTo(to, 300);
    }
    this.ensureRunning();
    this.compact.render();
    this.updateTicker();
  }

  private ensureRunning() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.w.step(dt, now);
    this.hgt.step(dt, now);
    this.r.step(dt, now);
    this.applyGeometry();
    if (this.w.animating || this.hgt.animating || this.r.animating) {
      requestAnimationFrame(this.frame);
    } else {
      this.running = false;
    }
  };

  private applyGeometry() {
    const w = Math.max(0, this.w.value);
    const hh = Math.max(0, this.hgt.value);
    const r = Math.max(0, Math.min(this.r.value, hh / 2, w / 2));
    this.islandEl.style.width = `${w}px`;
    this.islandEl.style.height = `${hh}px`;
    this.body.style.borderRadius = `0 0 ${r}px ${r}px`;
    this.svg.setAttribute("width", String(w + EAR_MAX * 2));
    this.svg.setAttribute("height", String(Math.max(1, hh)));
    this.path.setAttribute("d", islandPath({ w, h: hh, r }));

    const rect = this.rect();
    const p = this.pushed;
    if (Math.abs(p.x - rect.x) > 0.5 || Math.abs(p.w - rect.w) > 0.5 || Math.abs(p.h - rect.h) > 0.5) {
      this.pushed = { x: rect.x, w: rect.w, h: rect.h };
      void call("set_island_rect", { x: rect.x, y: 0, width: rect.w, height: rect.h });
    }
  }

  // ── Time ─────────────────────────────────────────────────────────────────

  /** Something on screen moves with time: tick 4× a second (or once for a countdown). */
  updateTicker() {
    const mode = this.fsm.mode;
    let ms = 0;
    if (mode === "expanded" && this.view.live()) ms = 250;
    else if (mode === "compact" && this.compact.kind() === "focus") ms = 1000;
    if (ms === this.tickerMs) return;
    if (this.ticker != null) clearInterval(this.ticker);
    this.ticker = null;
    this.tickerMs = ms;
    if (ms > 0) this.ticker = setInterval(() => this.tick(Date.now()), ms);
  }

  tick(now: number) {
    if (this.fsm.mode === "expanded") this.view.tick(now);
    else this.compact.tick(now);
  }

  /** Once a minute: the clocks. */
  minute(now: Date) {
    this.compact.render(now.getTime());
    this.renderHeader(now);
    if (this.fsm.mode === "expanded") this.view.tick(now.getTime());
  }

  renderHeader(now = new Date()) {
    text(this.headClock, `${shortDate(now)} · ${clock(now, settings.value.clock24)}`);
    const parts: Node[] = [];
    const headset = devices.headset;
    if (headset) {
      parts.push(icon(headset.kind === "speaker" ? "speaker" : "headphones", 12));
      if (headset.battery != null) parts.push(document.createTextNode(`${headset.battery}%`));
    }
    const power = devices.power;
    if (power?.hasBattery) {
      parts.push(icon(power.plugged ? "boltFill" : "battery", 12));
      parts.push(document.createTextNode(`${power.percent}%`));
    }
    this.headStatus.replaceChildren(...parts);
  }
}
