// The Pomodoro timer: focus, short break, and a long break every fourth time.

import { Emitter } from "../core/emitter";
import { load, save } from "../core/store";
import { dayKey } from "../core/time";
import { settings } from "./settings";

export type Phase = "focus" | "short" | "long";

export interface FocusDoc {
  day: string;
  /** Focus sessions finished today, and their minutes. */
  sessions: number;
  minutes: number;
  /** Focus sessions since the last long break (0–3). */
  cycle: number;
  phase: Phase;
  running: boolean;
  /** Epoch ms the running phase ends at. */
  endsAt: number;
  /** Milliseconds left while paused; -1 means "the full phase". */
  remaining: number;
}

export const PHASE_LABEL: Record<Phase, string> = { focus: "Focus", short: "Short break", long: "Long break" };

export function freshDoc(now: Date): FocusDoc {
  return { day: dayKey(now), sessions: 0, minutes: 0, cycle: 0, phase: "focus", running: false, endsAt: 0, remaining: -1 };
}

/** What comes after a phase, and the cycle count after it. */
export function nextPhase(phase: Phase, cycle: number): { phase: Phase; cycle: number } {
  if (phase !== "focus") return { phase: "focus", cycle: phase === "long" ? 0 : cycle };
  const done = cycle + 1;
  return done >= 4 ? { phase: "long", cycle: 4 } : { phase: "short", cycle: done };
}

export class FocusTimer extends Emitter {
  doc: FocusDoc = freshDoc(new Date());
  /** A phase ran out: (the one that ended, the one that is next). */
  onFinished: ((ended: Phase, next: Phase) => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private persist = true) {
    super();
  }

  async load() {
    this.doc = await load("focus", freshDoc(new Date()));
    this.rollDay(new Date());
    // A phase that ended while Notchy was closed: count it, quietly when it is old.
    if (this.doc.running && this.doc.endsAt <= Date.now()) {
      this.finish(Date.now() - this.doc.endsAt < 10 * 60_000);
    }
    if (this.doc.running) this.startTicking();
    this.changed();
  }

  durationMs(phase: Phase = this.doc.phase): number {
    const s = settings.value;
    const min = phase === "focus" ? s.focusMin : phase === "short" ? s.shortMin : s.longMin;
    return min * 60_000;
  }

  remainingMs(now = Date.now()): number {
    if (this.doc.running) return Math.max(0, this.doc.endsAt - now);
    return this.doc.remaining < 0 ? this.durationMs() : this.doc.remaining;
  }

  /** 0 at the start of the phase, 1 at its end. */
  progress(now = Date.now()): number {
    const total = this.durationMs();
    return total > 0 ? Math.min(1, Math.max(0, 1 - this.remainingMs(now) / total)) : 0;
  }

  /** Running, or paused part-way: worth showing in the compact island. */
  get active(): boolean {
    return this.doc.running || (this.doc.remaining >= 0 && this.doc.remaining < this.durationMs());
  }

  start(now = Date.now()) {
    if (this.doc.running) return;
    this.doc = { ...this.doc, running: true, endsAt: now + this.remainingMs(now), remaining: -1 };
    this.startTicking();
    this.commit();
  }

  pause(now = Date.now()) {
    if (!this.doc.running) return;
    this.doc = { ...this.doc, running: false, remaining: this.remainingMs(now) };
    this.stopTicking();
    this.commit();
  }

  toggle() {
    if (this.doc.running) this.pause();
    else this.start();
  }

  reset() {
    this.stopTicking();
    this.doc = { ...this.doc, running: false, remaining: -1 };
    this.commit();
  }

  setPhase(phase: Phase) {
    this.stopTicking();
    this.doc = { ...this.doc, phase, running: false, remaining: -1 };
    this.commit();
  }

  /** Ends the phase now, as if it had run out (without counting a skipped focus). */
  skip() {
    const next = nextPhase(this.doc.phase, this.doc.cycle);
    this.stopTicking();
    this.doc = { ...this.doc, phase: next.phase, cycle: this.doc.phase === "focus" ? this.doc.cycle : next.cycle, running: false, remaining: -1 };
    this.commit();
  }

  tick(now = Date.now()) {
    this.rollDay(new Date(now));
    if (this.doc.running && now >= this.doc.endsAt) this.finish(true);
    else this.changed();
  }

  private finish(announce: boolean) {
    const ended = this.doc.phase;
    const next = nextPhase(ended, this.doc.cycle);
    const counted = ended === "focus";
    this.stopTicking();
    this.doc = {
      ...this.doc,
      sessions: this.doc.sessions + (counted ? 1 : 0),
      minutes: this.doc.minutes + (counted ? Math.round(this.durationMs(ended) / 60_000) : 0),
      cycle: next.cycle,
      phase: next.phase,
      running: false,
      remaining: -1,
    };
    this.commit();
    if (announce) this.onFinished?.(ended, next.phase);
  }

  private rollDay(now: Date) {
    const today = dayKey(now);
    if (this.doc.day === today) return;
    this.doc = { ...this.doc, day: today, sessions: 0, minutes: 0 };
    if (!this.doc.running) this.doc.cycle = 0;
    this.commit();
  }

  private startTicking() {
    this.stopTicking();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  private stopTicking() {
    if (this.timer != null) clearInterval(this.timer);
    this.timer = null;
  }

  private commit() {
    if (this.persist) save("focus", this.doc);
    this.changed();
  }
}

export const focus = new FocusTimer();
