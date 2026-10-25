import { describe, expect, it } from "vitest";
import { cleanQuery, lineAt, parseLrc, pickResult } from "../src/core/lyrics";

describe("parseLrc", () => {
  it("reads stamps, fractions and several stamps on one line", () => {
    const lines = parseLrc("[ar:Someone]\n[00:01.50]First\n[00:03.20][00:10.00]Chorus\n\n[01:02]Late");
    expect(lines).toEqual([
      { t: 1.5, text: "First" },
      { t: 3.2, text: "Chorus" },
      { t: 10, text: "Chorus" },
      { t: 62, text: "Late" },
    ]);
  });

  it("keeps empty timed lines as pauses and honours the offset", () => {
    const lines = parseLrc("[offset:+500]\n[00:02.00]Hello\n[00:04.000]");
    expect(lines).toEqual([
      { t: 1.5, text: "Hello" },
      { t: 3.5, text: "" },
    ]);
  });

  it("ignores text that only looks like a stamp mid-line", () => {
    expect(parseLrc("hello [00:01.00] world")).toEqual([]);
  });
});

describe("lineAt", () => {
  const lines = parseLrc("[00:01.00]a\n[00:05.00]b\n[00:09.00]c");
  it("finds the line being sung", () => {
    expect(lineAt(lines, 0.5)).toBe(-1);
    expect(lineAt(lines, 1)).toBe(0);
    expect(lineAt(lines, 6)).toBe(1);
    expect(lineAt(lines, 99)).toBe(2);
    expect(lineAt([], 3)).toBe(-1);
  });
});

describe("cleanQuery", () => {
  it("splits a video title into artist and song", () => {
    expect(cleanQuery("Camila Cabello - Havana (Official Audio) ft. Young Thug", "CamilaCabelloVEVO")).toEqual({
      artist: "Camila Cabello",
      title: "Havana ft. Young Thug",
    });
    expect(cleanQuery("Kok Masih Rindu? [Lyric Video]", "Akbar Chalay - Topic")).toEqual({
      artist: "Akbar Chalay",
      title: "Kok Masih Rindu?",
    });
  });

  it("leaves a song whose title has a dash alone", () => {
    expect(cleanQuery("Song - Remastered 2011", "Band")).toEqual({ artist: "Band", title: "Song - Remastered 2011" });
  });

  it("splits when no artist is known", () => {
    expect(cleanQuery("Tulus - Hati-Hati di Jalan | Official MV", "")).toEqual({ artist: "Tulus", title: "Hati-Hati di Jalan" });
  });
});

describe("pickResult", () => {
  it("prefers synced lyrics, then the closest length", () => {
    const best = pickResult(
      [
        { trackName: "a", duration: 200, plainLyrics: "x" },
        { trackName: "b", duration: 210, syncedLyrics: "[00:01.00]y" },
        { trackName: "c", duration: 201, syncedLyrics: "[00:01.00]z" },
      ],
      200,
    );
    expect(best?.trackName).toBe("c");
  });

  it("refuses another version of very different length", () => {
    expect(pickResult([{ trackName: "live", duration: 320, syncedLyrics: "[00:01.00]y" }], 200)).toBeNull();
    expect(pickResult([], 200)).toBeNull();
  });
});
