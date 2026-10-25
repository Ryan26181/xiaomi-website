import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FocusTimer, nextPhase } from "../src/features/focus";

describe("nextPhase", () => {
  it("goes focus → short three times, then a long break", () => {
    expect(nextPhase("focus", 0)).toEqual({ phase: "short", cycle: 1 });
    expect(nextPhase("focus", 2)).toEqual({ phase: "short", cycle: 3 });
    expect(nextPhase("focus", 3)).toEqual({ phase: "long", cycle: 4 });
    expect(nextPhase("short", 3)).toEqual({ phase: "focus", cycle: 3 });
    expect(nextPhase("long", 4)).toEqual({ phase: "focus", cycle: 0 });
  });
});

describe("FocusTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 17, 10, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("counts down, pauses, resumes and finishes into a break", () => {
    const t = new FocusTimer(false);
    const finished: string[] = [];
    t.onFinished = (ended, next) => finished.push(`${ended}->${next}`);

    expect(t.remainingMs()).toBe(25 * 60_000);
    expect(t.active).toBe(false);
    t.start();
    vi.advanceTimersByTime(10 * 60_000);
    expect(Math.round(t.remainingMs() / 60_000)).toBe(15);
    expect(t.progress()).toBeCloseTo(0.4, 2);

    t.pause();
    vi.advanceTimersByTime(60 * 60_000);
    expect(Math.round(t.remainingMs() / 60_000)).toBe(15);
    expect(t.active).toBe(true);

    t.start();
    vi.advanceTimersByTime(15 * 60_000 + 1000);
    expect(finished).toEqual(["focus->short"]);
    expect(t.doc.phase).toBe("short");
    expect(t.doc.sessions).toBe(1);
    expect(t.doc.minutes).toBe(25);
    expect(t.doc.running).toBe(false);
    expect(t.remainingMs()).toBe(5 * 60_000);
  });

  it("skipping a focus does not count it; reset starts the phase over", () => {
    const t = new FocusTimer(false);
    t.start();
    vi.advanceTimersByTime(60_000);
    t.reset();
    expect(t.remainingMs()).toBe(25 * 60_000);
    t.skip();
    expect(t.doc.phase).toBe("short");
    expect(t.doc.sessions).toBe(0);
  });

  it("a new day starts the count again", () => {
    const t = new FocusTimer(false);
    t.doc = { ...t.doc, sessions: 3, minutes: 75 };
    t.tick(new Date(2026, 9, 18, 9, 0, 0).getTime());
    expect(t.doc.sessions).toBe(0);
    expect(t.doc.minutes).toBe(0);
  });
});
