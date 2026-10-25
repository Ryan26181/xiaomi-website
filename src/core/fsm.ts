// When the island opens and closes. No DOM, no Tauri: it only reports
// transitions, so it can be tested on its own (tests/fsm.test.ts).
// Modelled on Coucou's IslandStateMachine (MIT).

export type IslandMode = "hidden" | "compact" | "expanded";

export interface FsmOptions {
  /** Pointing at the island opens it (otherwise a click does). */
  openOnHover: boolean;
  /** The compact island stays on screen; otherwise it hides when idle. */
  alwaysVisible: boolean;
}

export class IslandFsm {
  mode: IslandMode = "compact";
  onChange: ((from: IslandMode, to: IslandMode) => void) | null = null;

  options: FsmOptions = { openOnHover: true, alwaysVisible: true };

  /** Something needs the island open (typing, dragging a file): the pointer leaving never folds it. */
  pinned = false;
  /** Blocked by a full-screen app: stays hidden whatever happens. */
  suppressed = false;

  /** Seconds before an island opened by hovering folds once the pointer leaves. */
  hoverCloseDelay = 0.45;
  /** …once the user clicked inside it. */
  clickedCloseDelay = 1.2;
  /** Opened from the tray or a reminder while the pointer is elsewhere. */
  untouchedCloseDelay = 8;
  /** Compact → hidden when the island is not always visible. */
  compactHideDelay = 2.5;

  private byHover = false;
  private pointerInside = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  get inside(): boolean {
    return this.pointerInside;
  }

  mouseEntered() {
    this.pointerInside = true;
    if (this.suppressed) return;
    this.cancel();
    if (this.mode === "hidden") {
      this.go(this.options.openOnHover ? "expanded" : "compact");
      this.byHover = this.options.openOnHover;
    } else if (this.mode === "compact" && this.options.openOnHover) {
      this.byHover = true;
      this.go("expanded");
    }
  }

  mouseLeft() {
    this.pointerInside = false;
    if (this.suppressed || this.pinned) return;
    if (this.mode === "expanded") {
      this.schedule(this.byHover ? this.hoverCloseDelay : this.clickedCloseDelay, () => this.fold());
    } else if (this.mode === "compact") {
      this.scheduleHide();
    }
  }

  /** A click on the island: opens it, and keeps a hover-opened one open longer. */
  click() {
    if (this.suppressed) return;
    this.byHover = false;
    if (this.mode !== "expanded") {
      this.cancel();
      this.go("expanded");
    }
  }

  /** Opened by something else than the pointer (tray, reminder, file drag). */
  open() {
    if (this.suppressed) return;
    this.cancel();
    this.byHover = false;
    this.go("expanded");
    if (!this.pointerInside && !this.pinned) {
      this.schedule(this.untouchedCloseDelay, () => this.fold());
    }
  }

  /** Esc, or a view asking to close. */
  close() {
    this.cancel();
    this.byHover = false;
    this.fold();
  }

  /** A live activity wants to be seen while the island is hidden. */
  reveal() {
    if (this.suppressed || this.mode !== "hidden") return;
    this.go("compact");
  }

  /** The live activity is over: hide again if that is how the island lives. */
  settle() {
    if (this.mode === "compact" && !this.pointerInside) this.scheduleHide();
  }

  unpin() {
    this.pinned = false;
    if (!this.pointerInside) this.mouseLeft();
  }

  setOptions(options: FsmOptions) {
    this.options = options;
    if (this.mode === "hidden" && options.alwaysVisible && !this.suppressed) this.go("compact");
    if (this.mode === "compact" && !options.alwaysVisible && !this.pointerInside) this.scheduleHide();
  }

  setSuppressed(on: boolean) {
    if (on === this.suppressed) return;
    this.suppressed = on;
    this.cancel();
    this.byHover = false;
    if (on) this.go("hidden");
    else if (this.options.alwaysVisible) this.go("compact");
  }

  private fold() {
    this.go(this.options.alwaysVisible || this.pointerInside ? "compact" : "hidden");
  }

  private scheduleHide() {
    if (this.options.alwaysVisible || this.pinned) return;
    this.schedule(this.compactHideDelay, () => {
      if (this.mode === "compact") this.go("hidden");
    });
  }

  private schedule(seconds: number, fn: () => void) {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.pinned) return;
      fn();
    }, seconds * 1000);
  }

  private cancel() {
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = null;
  }

  private go(next: IslandMode) {
    if (next === "compact" || next === "hidden") this.byHover = false;
    if (next === this.mode) return;
    const from = this.mode;
    this.mode = next;
    this.onChange?.(from, next);
  }
}
