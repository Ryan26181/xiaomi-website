import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Water, freshWater, nextReminder } from "../src/features/water";

const at = (h: number, m = 0, day = 17) => new Date(2026, 9, day, h, m, 0).getTime();

describe("nextReminder", () => {
  const opts = (now: number, since = at(9)) => ({ goalMl: 2000, intervalMin: 45, enabled: true, since, now });

  it("is an interval after the last drink", () => {
    const doc = { ...freshWater(), drinks: [{ t: at(10), ml: 250 }], drinksDay: "2026-10-17", days: { "2026-10-17": 250 } };
    expect(nextReminder(doc, opts(at(10, 5)))).toBe(at(10, 45));
  });

  it("waits for the morning, and stops once the goal is met or when off", () => {
    expect(nextReminder(freshWater(), opts(at(21, 50), at(21, 40)))).toBe(at(8, 0, 18));
    expect(nextReminder(freshWater(), opts(at(6), at(6)))).toBe(at(8));
    const met = { ...freshWater(), days: { "2026-10-17": 2000 } };
    expect(nextReminder(met, opts(at(12)))).toBeNull();
    expect(nextReminder(freshWater(), { ...opts(at(12)), enabled: false })).toBeNull();
  });
});

describe("Water", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 17, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("adds, undoes and keeps a week", () => {
    const w = new Water(false);
    w.add(250);
    w.add(500);
    expect(w.total()).toBe(750);
    w.undo();
    expect(w.total()).toBe(250);
    const week = w.week();
    expect(week).toHaveLength(7);
    expect(week[6]).toMatchObject({ key: "2026-10-17", ml: 250, today: true });
    expect(week[0].key).toBe("2026-10-11");
  });

  it("rings once when due", () => {
    const w = new Water(false);
    let rang = 0;
    w.onDue = () => rang++;
    w.check(Date.now() + 10 * 60_000);
    expect(rang).toBe(0);
    w.check(Date.now() + 46 * 60_000);
    w.check(Date.now() + 47 * 60_000);
    expect(rang).toBe(1);
  });
});
