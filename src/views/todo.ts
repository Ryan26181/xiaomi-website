// To-do: tick, add, remove. The island grows with the list, up to a point.

import { h, text, toggle } from "../core/dom";
import { icon } from "../core/icons";
import { play } from "../core/sound";
import { todos, type Todo } from "../features/todo";
import { HEADER_H, type IslandHost, type View } from "./view";

const ROW_H = 30;
const MAX_ROWS = 5;

export class TodoView implements View {
  readonly name = "todo";
  readonly title = "To-do";
  readonly icon = "todo";
  readonly el: HTMLElement;

  private list: HTMLElement;
  private count: HTMLElement;
  private input: HTMLInputElement;
  private clearBtn: HTMLButtonElement;
  private empty: HTMLElement;

  constructor(host: IslandHost) {
    this.count = h("span", { class: "td-count" });
    this.clearBtn = h("button", { class: "text-btn", onclick: () => todos.clearDone() }, "Clear done");
    this.list = h("div", { class: "td-list" });
    this.empty = h("div", { class: "td-empty" }, "Nothing to do. Add something below.");
    this.input = h("input", {
      class: "td-input",
      type: "text",
      maxLength: 140,
      placeholder: "Add a task and press Enter",
      spellcheck: false,
      onfocus: () => {
        host.pin("typing");
        host.setFocusable(true);
      },
      onblur: () => {
        host.setFocusable(false);
        host.unpin("typing");
      },
      onkeydown: (e: KeyboardEvent) => this.key(e),
    });
    const addRow = h(
      "div",
      { class: "td-add" },
      h("button", { class: "td-plus", title: "Add", onclick: () => this.submit() }, icon("plus", 14)),
      this.input,
    );
    this.el = h(
      "section",
      { class: "view todo" },
      h("div", { class: "td-head" }, this.count, this.clearBtn),
      this.empty,
      this.list,
      addRow,
    );
    todos.subscribe(() => {
      this.render();
      host.relayout();
    });
    this.render();
  }

  height(): number {
    const rows = Math.min(MAX_ROWS, Math.max(1, todos.items.length));
    // Bottom padding, the count line, the rows, the add field.
    return HEADER_H + 12 + 28 + rows * ROW_H + 44;
  }

  live(): boolean {
    return false;
  }

  tick() {}

  shown() {
    // Keep the list's end in view, where new items land.
    this.list.scrollTop = this.list.scrollHeight;
  }

  private key(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      this.submit();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      this.input.blur();
    }
  }

  private submit() {
    if (todos.add(this.input.value)) {
      this.input.value = "";
      play("tap");
      requestAnimationFrame(() => (this.list.scrollTop = this.list.scrollHeight));
    }
  }

  private row(t: Todo): HTMLElement {
    return h(
      "div",
      { class: t.done ? "td-row done" : "td-row", "data-id": t.id },
      h(
        "button",
        {
          class: "td-check",
          title: t.done ? "Mark as not done" : "Mark as done",
          onclick: () => {
            if (!t.done) play("tap");
            todos.toggle(t.id);
          },
        },
        icon("check", 12),
      ),
      h("span", { class: "td-text", title: t.text }, t.text),
      h("button", { class: "td-remove", title: "Remove", onclick: () => todos.remove(t.id) }, icon("close", 12)),
    );
  }

  private render() {
    const items = todos.items;
    text(this.count, items.length ? `${todos.doneCount}/${items.length} done` : "No tasks yet");
    toggle(this.el, "has-items", items.length > 0);
    this.clearBtn.hidden = todos.doneCount === 0;
    this.list.replaceChildren(...items.map((t) => this.row(t)));
  }
}
