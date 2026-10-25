import { describe, expect, it } from "vitest";
import { DEFAULT_ACCENT, pickAccent } from "../src/core/color";
import { clock, countdown, dayKey, inMinutes, mmss } from "../src/core/time";
import { EAR_MAX, earFor, islandPath } from "../src/island/shape";

describe("islandPath", () => {
  it("draws nothing for a retracted island", () => {
    expect(islandPath({ w: 150, h: 0, r: 10 })).toBe("");
    expect(islandPath({ w: 0, h: 30, r: 10 })).toBe("");
  });

  it("spans the ears and stays finite", () => {
    const d = islandPath({ w: 212, h: 34, r: 17 });
    const ear = earFor(34);
    const round = (n: number) => Math.round(n * 100) / 100;
    expect(d.startsWith(`M${round(EAR_MAX - ear)} 0`)).toBe(true);
    expect(d).toContain(`L${round(EAR_MAX + 212 + ear)} 0`);
    expect(d).not.toMatch(/NaN|Infinity/);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("never lets the corner radius eat the ears", () => {
    const d = islandPath({ w: 100, h: 20, r: 40 });
    expect(d).not.toMatch(/NaN|-\d/);
  });
});

describe("pickAccent", () => {
  it("finds the colour of a red cover and brightens it", () => {
    const px: number[] = [];
    for (let i = 0; i < 64; i++) px.push(200, 20, 40, 255);
    const c = pickAccent(px);
    expect(c.r).toBeGreaterThan(c.g + 80);
    expect(c.r).toBeGreaterThan(c.b);
  });

  it("falls back for a grey cover", () => {
    const px: number[] = [];
    for (let i = 0; i < 64; i++) px.push(128, 128, 128, 255);
    expect(pickAccent(px)).toEqual(DEFAULT_ACCENT);
  });
});

describe("time", () => {
  it("formats clocks and durations", () => {
    const d = new Date(2026, 9, 17, 19, 5);
    expect(clock(d, true)).toBe("19:05");
    expect(clock(d, false)).toBe("7:05 PM");
    expect(mmss(65)).toBe("1:05");
    expect(mmss(3700)).toBe("1:01:40");
    expect(countdown(300)).toBe("05:00");
    expect(countdown(0.2)).toBe("00:01");
    expect(dayKey(d)).toBe("2026-10-17");
    expect(inMinutes(23 * 60_000)).toBe("in 23 min");
    expect(inMinutes(65 * 60_000)).toBe("in 1 h 5 min");
  });
});
