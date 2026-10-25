// Preferences, kept in settings.json.

import { Emitter } from "../core/emitter";
import { load, save } from "../core/store";

export type ViewName = "music" | "focus" | "water" | "todo" | "shelf" | "settings";

export interface Settings {
  /** Pointing at the island opens it; otherwise a click does. */
  openOnHover: boolean;
  /** The compact island always shows; otherwise it hides until you point at the top. */
  alwaysVisible: boolean;
  hideInFullscreen: boolean;
  showLyrics: boolean;
  /** A short pop when a new song starts. */
  trackPopups: boolean;
  sounds: boolean;
  clock24: boolean;
  waterGoalMl: number;
  waterReminders: boolean;
  waterIntervalMin: number;
  focusMin: number;
  shortMin: number;
  longMin: number;
  lastView: ViewName;
}

export const DEFAULT_SETTINGS: Settings = {
  openOnHover: true,
  alwaysVisible: true,
  hideInFullscreen: true,
  showLyrics: true,
  trackPopups: true,
  sounds: true,
  clock24: true,
  waterGoalMl: 2000,
  waterReminders: true,
  waterIntervalMin: 45,
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  lastView: "music",
};

/** Where each number may go, and by how much a step moves it. */
export const LIMITS = {
  waterGoalMl: { min: 500, max: 5000, step: 250 },
  waterIntervalMin: { min: 15, max: 180, step: 15 },
  focusMin: { min: 5, max: 90, step: 5 },
  shortMin: { min: 1, max: 30, step: 1 },
  longMin: { min: 5, max: 60, step: 5 },
} as const;

class SettingsStore extends Emitter {
  value: Settings = { ...DEFAULT_SETTINGS };

  async load() {
    this.value = await load("settings", { ...DEFAULT_SETTINGS });
    this.changed();
  }

  update(patch: Partial<Settings>) {
    this.value = { ...this.value, ...patch };
    save("settings", this.value);
    this.changed();
  }

  /** Moves a number setting by its step, within its limits. */
  nudge(key: keyof typeof LIMITS, direction: 1 | -1) {
    const { min, max, step } = LIMITS[key];
    const next = Math.min(max, Math.max(min, this.value[key] + direction * step));
    if (next !== this.value[key]) this.update({ [key]: next } as Partial<Settings>);
  }
}

export const settings = new SettingsStore();
