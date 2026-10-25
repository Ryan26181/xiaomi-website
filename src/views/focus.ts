// The Pomodoro timer: the countdown in a ring, the phase chips, and today's sessions.

import { h, text, toggle } from "../core/dom";
import { icon, setIcon } from "../core/icons";
import { countdown } from "../core/time";
import { focus, PHASE_LABEL, type Phase } from "../features/focus";
import { settings } from "../features/settings";
import { Ring } from "./ring";
import { HEADER_H, type View } from "./view";

export class FocusView implements View {
  readonly name = "focus";
  readonly title = "Pomodoro";
  readonly icon = "timer";
  readonly el: HTMLElement;

  private ring = new Ring(96, 7, "focus-ring");
  private time: HTMLElement;
  private phaseLabel: HTMLElement;
  private startBtn: HTMLButtonElement;
  private chips = new Map<Phase, HTMLButtonElement>();
  private dots: HTMLElement[] = [];
  private sessions: HTMLElement;
  private minutes: HTMLElement;

  constructor() {
    this.time = h("div", { class: "fc-time" });
    this.phaseLabel = h("div", { class: "fc-phase" });
    const dial = h("div", { class: "fc-dial" }, this.ring.el, h("div", { class: "fc-center" }, this.time, this.phaseLabel));

    const chipRow = h("div", { class: "chips" });
    for (const phase of ["focus", "short", "long"] as Phase[]) {
      const chip = h("button", { class: "chip", onclick: () => focus.setPhase(phase) });
      this.chips.set(phase, chip);
      chipRow.append(chip);
    }
    this.startBtn = h("button", { class: "pill-btn primary", onclick: () => focus.toggle() }, h("span", null));
    const controls = h(
      "div",
      { class: "fc-controls" },
      this.startBtn,
      h("button", { class: "round-btn", title: "Reset", onclick: () => focus.reset() }, icon("reset", 16)),
      h("button", { class: "round-btn", title: "Skip to the next phase", onclick: () => focus.skip() }, icon("skip", 16)),
    );

    this.dots = Array.from({ length: 4 }, () => h("span", { class: "dot" }));
    this.sessions = h("div", { class: "stat-big" });
    this.minutes = h("div", { class: "stat-sub" });
    const today = h(
      "div",
      { class: "fc-today" },
      h("div", { class: "stat-label" }, "Today"),
      this.sessions,
      h("div", { class: "dots" }, ...this.dots),
      this.minutes,
    );

    this.el = h("section", { class: "view focus" }, h("div", { class: "fc" }, dial, h("div", { class: "fc-mid" }, chipRow, controls), today));
    focus.subscribe(() => this.render());
    settings.subscribe(() => this.render());
    this.render();
  }

  height(): number {
    return HEADER_H + 132;
  }

  live(): boolean {
    return focus.doc.running;
  }

  private render() {
    const d = focus.doc;
    const s = settings.value;
    for (const [phase, chip] of this.chips) {
      const min = phase === "focus" ? s.focusMin : phase === "short" ? s.shortMin : s.longMin;
      text(chip, `${PHASE_LABEL[phase]} ${min}`);
      toggle(chip, "on", d.phase === phase);
    }
    this.el.dataset.phase = d.phase;
    toggle(this.el, "running", d.running);
    text(this.startBtn.querySelector("span")!, d.running ? "Pause" : focus.active ? "Resume" : "Start");
    setIcon(this.startBtn, d.running ? "pause" : "play", 14);
    text(this.phaseLabel, PHASE_LABEL[d.phase]);
    text(this.sessions, `${d.sessions} ${d.sessions === 1 ? "session" : "sessions"}`);
    text(this.minutes, `${d.minutes} min focused`);
    const filled = d.phase === "long" ? 4 : d.cycle % 4;
    this.dots.forEach((dot, i) => toggle(dot, "on", i < filled));
    this.tick(Date.now());
  }

  tick(now: number) {
    text(this.time, countdown(focus.remainingMs(now) / 1000));
    this.ring.set(focus.progress(now));
  }
}
