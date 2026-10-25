// Drinking water: today's total against a goal, a week of history, and a
// reminder every so often during the day.

import { Emitter } from "../core/emitter";
import { load, save } from "../core/store";
import { dayKey, daysBefore } from "../core/time";
import { settings } from "./settings";

export interface Drink {
  t: number;
  ml: number;
}

export interface WaterDoc {
  /** ml per day, by local date. */
  days: Record<string, number>;
  /** Today's drinks, for undo. */
  drinks: Drink[];
  drinksDay: string;
  lastReminder: number;
}

/** Reminders only between these hours. */
export const DAY_START = 8;
export const DAY_END = 22;

export function freshWater(): WaterDoc {
  return { days: {}, drinks: [], drinksDay: "", lastReminder: 0 };
}

/**
 * When the next reminder is due: an interval after the last drink or the last
 * reminder (or since `since`), moved into waking hours. Null when reminders
 * are off or the goal is met.
 */
export function nextReminder(doc: WaterDoc, opts: { goalMl: number; intervalMin: number; enabled: boolean; since: number; now: number }): number | null {
  const now = new Date(opts.now);
  const today = dayKey(now);
  const total = doc.days[today] ?? 0;
  if (!opts.enabled || total >= opts.goalMl) return null;
  const lastDrink = doc.drinksDay === today && doc.drinks.length ? doc.drinks[doc.drinks.length - 1].t : 0;
  const base = Math.max(lastDrink, doc.lastReminder, opts.since);
  let due = new Date(base + opts.intervalMin * 60_000);
  if (due.getHours() < DAY_START) {
    due.setHours(DAY_START, 0, 0, 0);
  } else if (due.getHours() >= DAY_END) {
    due = new Date(due);
    due.setDate(due.getDate() + 1);
    due.setHours(DAY_START, 0, 0, 0);
  }
  return due.getTime();
}

export class Water extends Emitter {
  doc: WaterDoc = freshWater();
  onDue: (() => void) | null = null;
  private since = Date.now();

  constructor(private persist = true) {
    super();
  }

  async load() {
    this.doc = await load("water", freshWater());
    this.changed();
  }

  total(now = new Date()): number {
    return this.doc.days[dayKey(now)] ?? 0;
  }

  goal(): number {
    return settings.value.waterGoalMl;
  }

  add(ml: number, now = Date.now()) {
    const today = dayKey(new Date(now));
    const drinks = this.doc.drinksDay === today ? [...this.doc.drinks, { t: now, ml }] : [{ t: now, ml }];
    const days = { ...this.doc.days, [today]: (this.doc.days[today] ?? 0) + ml };
    // Thirty days of history is plenty for a week's chart.
    const keep = dayKey(daysBefore(new Date(now), 30));
    for (const k of Object.keys(days)) if (k < keep) delete days[k];
    this.doc = { ...this.doc, days, drinks: drinks.slice(-40), drinksDay: today };
    this.commit();
  }

  get canUndo(): boolean {
    return this.doc.drinksDay === dayKey(new Date()) && this.doc.drinks.length > 0;
  }

  undo() {
    if (!this.canUndo) return;
    const today = dayKey(new Date());
    const last = this.doc.drinks[this.doc.drinks.length - 1];
    const days = { ...this.doc.days, [today]: Math.max(0, (this.doc.days[today] ?? 0) - last.ml) };
    this.doc = { ...this.doc, days, drinks: this.doc.drinks.slice(0, -1) };
    this.commit();
  }

  /** The last seven days, oldest first, today last. */
  week(now = new Date()): Array<{ key: string; label: string; ml: number; today: boolean }> {
    return Array.from({ length: 7 }, (_, i) => {
      const d = daysBefore(now, 6 - i);
      const key = dayKey(d);
      return { key, label: d.toLocaleDateString(undefined, { weekday: "narrow" }), ml: this.doc.days[key] ?? 0, today: i === 6 };
    });
  }

  nextReminderAt(now = Date.now()): number | null {
    const s = settings.value;
    return nextReminder(this.doc, { goalMl: s.waterGoalMl, intervalMin: s.waterIntervalMin, enabled: s.waterReminders, since: this.since, now });
  }

  /** Called every half minute: rings when a reminder is due. */
  check(now = Date.now()) {
    const due = this.nextReminderAt(now);
    if (due == null || due > now) return;
    this.doc = { ...this.doc, lastReminder: now };
    this.commit();
    this.onDue?.();
  }

  private commit() {
    if (this.persist) save("water", this.doc);
    this.changed();
  }
}

export const water = new Water();
