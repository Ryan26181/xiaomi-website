// Water: today's progress in a ring, quick add buttons, the reminder, and the week.

import { h, text, toggle } from "../core/dom";
import { icon } from "../core/icons";
import { inMinutes } from "../core/time";
import { settings } from "../features/settings";
import { water } from "../features/water";
import { Ring } from "./ring";
import { HEADER_H, type View } from "./view";

const litres = (ml: number) => `${(ml / 1000).toFixed(ml % 100 === 0 ? 1 : 2)} L`;

export class WaterView implements View {
  readonly name = "water";
  readonly title = "Water";
  readonly icon = "droplet";
  readonly el: HTMLElement;

  private ring = new Ring(96, 7, "water-ring");
  private amount: HTMLElement;
  private goal: HTMLElement;
  private undoBtn: HTMLButtonElement;
  private reminder: HTMLElement;
  private reminderToggle: HTMLButtonElement;
  private bars: HTMLElement;

  constructor() {
    this.amount = h("div", { class: "wt-amount" });
    this.goal = h("div", { class: "wt-goal" });
    const dial = h("div", { class: "fc-dial" }, this.ring.el, h("div", { class: "fc-center" }, this.amount, this.goal));

    const add = (ml: number) =>
      h("button", { class: "pill-btn water", onclick: () => water.add(ml) }, icon("dropFill", 13), h("span", null, `+${ml} ml`));
    this.undoBtn = h("button", { class: "text-btn", onclick: () => water.undo() }, "Undo");
    this.reminder = h("span", { class: "wt-reminder-text" });
    this.reminderToggle = h("button", {
      class: "switch",
      title: "Reminders",
      onclick: () => settings.update({ waterReminders: !settings.value.waterReminders }),
    });
    const mid = h(
      "div",
      { class: "fc-mid" },
      h("div", { class: "wt-buttons" }, add(250), add(500)),
      h("div", { class: "wt-reminder" }, icon("bell", 13), this.reminder, this.reminderToggle),
      this.undoBtn,
    );

    this.bars = h("div", { class: "wt-bars" });
    const week = h("div", { class: "wt-week" }, h("div", { class: "stat-label" }, "This week"), this.bars);

    this.el = h("section", { class: "view water" }, h("div", { class: "fc" }, dial, mid, week));
    water.subscribe(() => this.render());
    settings.subscribe(() => this.render());
    this.render();
  }

  height(): number {
    return HEADER_H + 132;
  }

  live(): boolean {
    return false;
  }

  shown() {
    this.render();
  }

  private render() {
    const total = water.total();
    const goal = water.goal();
    text(this.amount, litres(total));
    text(this.goal, `of ${litres(goal)}`);
    this.ring.set(total / goal);
    toggle(this.el, "met", total >= goal);
    this.undoBtn.disabled = !water.canUndo;
    toggle(this.reminderToggle, "on", settings.value.waterReminders);
    this.tick(Date.now());

    const week = water.week();
    const max = Math.max(goal, ...week.map((d) => d.ml));
    this.bars.replaceChildren(
      ...week.map((d) =>
        h(
          "div",
          { class: d.today ? "wt-day today" : "wt-day", title: `${litres(d.ml)}` },
          h("div", { class: "wt-col" }, h("div", { class: d.ml >= goal ? "wt-fill met" : "wt-fill", style: `height:${Math.round((d.ml / max) * 100)}%` })),
          h("div", { class: "wt-label" }, d.label),
        ),
      ),
    );
  }

  tick(now: number) {
    const s = settings.value;
    const due = water.nextReminderAt(now);
    let line: string;
    if (!s.waterReminders) line = "Reminders off";
    else if (water.total() >= water.goal()) line = "Goal reached today";
    else if (due == null) line = "Reminders on";
    else line = `Next reminder ${inMinutes(due - now)}`;
    text(this.reminder, line);
  }
}
