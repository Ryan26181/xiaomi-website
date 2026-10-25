import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IslandFsm, type IslandMode } from "../src/core/fsm";

function machine(options = { openOnHover: true, alwaysVisible: true }) {
  const fsm = new IslandFsm();
  fsm.options = options;
  const seen: IslandMode[] = [];
  fsm.onChange = (_from, to) => seen.push(to);
  return { fsm, seen };
}

describe("IslandFsm", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("opens on hover and folds back shortly after the pointer leaves", () => {
    const { fsm, seen } = machine();
    fsm.mouseEntered();
    expect(fsm.mode).toBe("expanded");
    fsm.mouseLeft();
    vi.advanceTimersByTime(300);
    expect(fsm.mode).toBe("expanded");
    vi.advanceTimersByTime(300);
    expect(fsm.mode).toBe("compact");
    expect(seen).toEqual(["expanded", "compact"]);
  });

  it("coming back before the delay keeps it open", () => {
    const { fsm } = machine();
    fsm.mouseEntered();
    fsm.mouseLeft();
    vi.advanceTimersByTime(200);
    fsm.mouseEntered();
    vi.advanceTimersByTime(5000);
    expect(fsm.mode).toBe("expanded");
  });

  it("a click makes it stay a little longer", () => {
    const { fsm } = machine();
    fsm.mouseEntered();
    fsm.click();
    fsm.mouseLeft();
    vi.advanceTimersByTime(800);
    expect(fsm.mode).toBe("expanded");
    vi.advanceTimersByTime(600);
    expect(fsm.mode).toBe("compact");
  });

  it("without open-on-hover, pointing does nothing until a click", () => {
    const { fsm } = machine({ openOnHover: false, alwaysVisible: true });
    fsm.mouseEntered();
    expect(fsm.mode).toBe("compact");
    fsm.click();
    expect(fsm.mode).toBe("expanded");
  });

  it("a pinned island never folds on its own", () => {
    const { fsm } = machine();
    fsm.mouseEntered();
    fsm.pinned = true;
    fsm.mouseLeft();
    vi.advanceTimersByTime(10_000);
    expect(fsm.mode).toBe("expanded");
    fsm.unpin();
    vi.advanceTimersByTime(1000);
    expect(fsm.mode).toBe("compact");
  });

  it("opened from elsewhere, it folds by itself if never pointed at", () => {
    const { fsm } = machine();
    fsm.open();
    expect(fsm.mode).toBe("expanded");
    vi.advanceTimersByTime(8100);
    expect(fsm.mode).toBe("compact");
  });

  it("hides when not always visible, and a full-screen app hides it for good", () => {
    const { fsm } = machine({ openOnHover: true, alwaysVisible: false });
    fsm.reveal(); // nothing: it starts compact
    fsm.mouseEntered();
    fsm.mouseLeft();
    vi.advanceTimersByTime(600);
    expect(fsm.mode).toBe("hidden");

    fsm.setSuppressed(true);
    fsm.mouseEntered();
    fsm.click();
    fsm.open();
    expect(fsm.mode).toBe("hidden");
    fsm.setSuppressed(false);
    expect(fsm.mode).toBe("hidden");
    fsm.options = { openOnHover: true, alwaysVisible: true };
    fsm.setSuppressed(true);
    fsm.setSuppressed(false);
    expect(fsm.mode).toBe("compact");
  });
});
