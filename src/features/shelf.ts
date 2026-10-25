// The file shelf: paths dropped on the island, kept until removed. Rust only
// opens, reveals or drags a path that is on this list (src-tauri/src/shelf.rs),
// so the list is saved before any of those is asked for.

import { call } from "../core/bridge";
import { Emitter } from "../core/emitter";
import { load } from "../core/store";
import type { ShelfFile } from "../core/types";

export interface ShelfItem {
  path: string;
  addedAt: number;
}

const MAX_ITEMS = 30;

class Shelf extends Emitter {
  items: ShelfItem[] = [];
  info = new Map<string, ShelfFile>();
  /** A drag out of the island is in flight. */
  dragging = false;

  async load() {
    const doc = await load<{ items: ShelfItem[] }>("shelf", { items: [] });
    this.items = Array.isArray(doc.items) ? doc.items.filter((i) => i && typeof i.path === "string") : [];
    await this.refresh(this.items.map((i) => i.path));
  }

  async add(paths: string[], now = Date.now()) {
    const fresh = paths.filter((p) => p && !this.items.some((i) => i.path === p));
    if (fresh.length === 0) return;
    this.items = [...fresh.map((path) => ({ path, addedAt: now })), ...this.items].slice(0, MAX_ITEMS);
    await this.persist();
    await this.refresh(fresh);
  }

  async remove(path: string) {
    this.items = this.items.filter((i) => i.path !== path);
    this.info.delete(path);
    await this.persist();
    this.changed();
  }

  async clear() {
    this.items = [];
    this.info.clear();
    await this.persist();
    this.changed();
  }

  open(path: string) {
    void call("shelf_open", { path });
  }

  reveal(path: string) {
    void call("shelf_reveal", { path });
  }

  async dragOut(paths: string[]) {
    this.dragging = true;
    this.changed();
    const started = await call<boolean>("shelf_drag_out", { paths });
    if (!started) this.dragEnded();
  }

  dragEnded() {
    this.dragging = false;
    this.changed();
  }

  /** Re-reads names, sizes and thumbnails (a file may have moved or gone). */
  async refresh(paths = this.items.map((i) => i.path)) {
    if (paths.length > 0) {
      const infos = (await call<ShelfFile[]>("shelf_info", { paths })) ?? [];
      for (const info of infos) this.info.set(info.path, info);
    }
    this.changed();
  }

  private async persist() {
    // Saved at once, not debounced: Rust checks this list on every open and drag.
    await call("store_set", { name: "shelf", value: { items: this.items } });
  }
}

export const shelf = new Shelf();
