// A short to-do list.

import { Emitter } from "../core/emitter";
import { load, save } from "../core/store";

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  at: number;
}

const MAX_ITEMS = 50;
const MAX_TEXT = 140;

export class Todos extends Emitter {
  items: Todo[] = [];

  constructor(private persist = true) {
    super();
  }

  async load() {
    const doc = await load<{ items: Todo[] }>("todos", { items: [] });
    this.items = Array.isArray(doc.items) ? doc.items.filter((t) => t && typeof t.text === "string") : [];
    this.changed();
  }

  get doneCount(): number {
    return this.items.filter((t) => t.done).length;
  }

  add(text: string, now = Date.now()): boolean {
    const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
    if (!clean || this.items.length >= MAX_ITEMS) return false;
    this.items = [...this.items, { id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, text: clean, done: false, at: now }];
    this.commit();
    return true;
  }

  toggle(id: string) {
    this.items = this.items.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    this.commit();
  }

  remove(id: string) {
    this.items = this.items.filter((t) => t.id !== id);
    this.commit();
  }

  clearDone() {
    this.items = this.items.filter((t) => !t.done);
    this.commit();
  }

  private commit() {
    if (this.persist) save("todos", { items: this.items });
    this.changed();
  }
}

export const todos = new Todos();
