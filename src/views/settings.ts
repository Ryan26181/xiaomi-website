// Settings, in the island itself: switches and steppers in two columns.

import { call } from "../core/bridge";
import { h, text, toggle } from "../core/dom";
import { icon } from "../core/icons";
import { LIMITS, settings, type Settings } from "../features/settings";
import { HEADER_H, type View } from "./view";

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
type NumKey = keyof typeof LIMITS;

export class SettingsView implements View {
  readonly name = "settings";
  readonly title = "Settings";
  readonly icon = "settings";
  readonly el: HTMLElement;

  private switches = new Map<BoolKey, HTMLButtonElement>();
  private values = new Map<NumKey, { el: HTMLElement; format: (v: number) => string }>();
  private autostart: HTMLButtonElement;
  private autostartOn = false;
  private version: HTMLElement;

  constructor() {
    this.autostart = h("button", { class: "switch", onclick: () => void this.setAutostart(!this.autostartOn) });
    this.version = h("span", { class: "st-version" });

    const left = h(
      "div",
      { class: "st-col" },
      this.toggleRow("openOnHover", "Open when you point at it"),
      this.toggleRow("alwaysVisible", "Always show the island"),
      this.toggleRow("hideInFullscreen", "Hide over full-screen apps"),
      h("div", { class: "st-row" }, h("span", null, "Start with Windows"), this.autostart),
      this.toggleRow("clock24", "24-hour clock"),
      this.toggleRow("sounds", "Sounds"),
    );
    const right = h(
      "div",
      { class: "st-col" },
      this.toggleRow("showLyrics", "Synced lyrics"),
      this.toggleRow("trackPopups", "Show new songs"),
      this.stepRow("waterGoalMl", "Water goal", (v) => `${(v / 1000).toFixed(v % 1000 === 0 ? 1 : 2)} L`),
      this.stepRow("waterIntervalMin", "Remind every", (v) => `${v} min`),
      this.stepRow("focusMin", "Focus", (v) => `${v} min`),
      h(
        "div",
        { class: "st-row" },
        h("span", null, "Breaks"),
        h("span", { class: "st-pair" }, this.stepper("shortMin", (v) => `${v}`), h("span", { class: "st-slash" }, "/"), this.stepper("longMin", (v) => `${v} min`)),
      ),
    );
    const footer = h(
      "div",
      { class: "st-footer" },
      this.version,
      h("span", { class: "st-credit" }, "Lyrics by LRCLIB"),
      h("button", { class: "text-btn danger", onclick: () => void call("quit") }, icon("power", 12), h("span", null, "Quit Notchy")),
    );
    this.el = h("section", { class: "view settings" }, h("div", { class: "st-grid" }, left, right), footer);

    settings.subscribe(() => this.render());
    void call<boolean>("autostart_get").then((on) => {
      this.autostartOn = Boolean(on);
      this.render();
    });
    void call<{ version: string }>("platform_info").then((p) => text(this.version, `Notchy ${p?.version ?? ""}`));
    this.render();
  }

  height(): number {
    return HEADER_H + 222;
  }

  live(): boolean {
    return false;
  }

  tick() {}

  private async setAutostart(on: boolean) {
    this.autostartOn = Boolean(await call<boolean>("autostart_set", { enabled: on }));
    this.render();
  }

  private toggleRow(key: BoolKey, label: string): HTMLElement {
    const sw = h("button", { class: "switch", onclick: () => settings.update({ [key]: !settings.value[key] } as Partial<Settings>) });
    this.switches.set(key, sw);
    return h("div", { class: "st-row" }, h("span", null, label), sw);
  }

  private stepper(key: NumKey, format: (v: number) => string): HTMLElement {
    const value = h("span", { class: "st-value" });
    this.values.set(key, { el: value, format });
    return h(
      "span",
      { class: "stepper" },
      h("button", { title: "Less", onclick: () => settings.nudge(key, -1) }, icon("minus", 12)),
      value,
      h("button", { title: "More", onclick: () => settings.nudge(key, 1) }, icon("plus", 12)),
    );
  }

  private stepRow(key: NumKey, label: string, format: (v: number) => string): HTMLElement {
    return h("div", { class: "st-row" }, h("span", null, label), this.stepper(key, format));
  }

  private render() {
    const s = settings.value;
    for (const [key, sw] of this.switches) toggle(sw, "on", s[key]);
    toggle(this.autostart, "on", this.autostartOn);
    for (const [key, { el, format }] of this.values) text(el, format(s[key]));
  }
}
