import type { IconName } from "../core/icons";
import type { ViewName } from "../features/settings";

/** What the island asks of each expanded view. */
export interface View {
  readonly name: ViewName;
  readonly title: string;
  readonly icon: IconName;
  readonly el: HTMLElement;
  /** Height of the whole expanded island on this view, header included. */
  height(): number;
  /** Refresh what changes with time (progress, countdowns, lyrics). */
  tick(now: number): void;
  /** True while something on it moves with time and needs tick(). */
  live(): boolean;
  shown?(): void;
  /** A colour glowing behind the view, or null for plain black. */
  wash?(): string | null;
}

/** What a view may ask of the island. */
export interface IslandHost {
  /** The view's height or content changed: animate to the new size. */
  relayout(): void;
  /** Keep the island open while something needs it (typing, dragging). */
  pin(reason: string): void;
  unpin(reason: string): void;
  /** Let a text field take the keyboard, and give it back. */
  setFocusable(on: boolean): void;
  close(): void;
}

export const HEADER_H = 40;
export const EXPANDED_W = 600;
