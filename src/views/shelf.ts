// The shelf: files dropped on the island, as tiles you can drag back out.

import { h, toggle } from "../core/dom";
import { fileIcon, icon } from "../core/icons";
import { shelf } from "../features/shelf";
import { HEADER_H, type IslandHost, type View } from "./view";

/** How far the pointer moves with the button down before it is a drag. */
const DRAG_START = 5;

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export class ShelfView implements View {
  readonly name = "shelf";
  readonly title = "Shelf";
  readonly icon = "shelf";
  readonly el: HTMLElement;

  private tiles: HTMLElement;
  private dropZone: HTMLElement;
  private footer: HTMLElement;
  private press: { x: number; y: number; path: string } | null = null;

  constructor(private host: IslandHost) {
    this.tiles = h("div", { class: "sh-tiles" });
    this.dropZone = h(
      "div",
      { class: "sh-drop" },
      h("div", { class: "empty-icon" }, icon("shelf", 20)),
      h("div", { class: "empty-title" }, "Drop files here"),
      h("div", { class: "empty-sub" }, "They wait on the shelf until you drag them out again."),
    );
    this.footer = h(
      "div",
      { class: "sh-footer" },
      h("span", { class: "sh-hint" }, "Drag a file out to use it · double-click to open"),
      h("button", { class: "text-btn", onclick: () => void shelf.clear() }, "Clear all"),
    );
    this.el = h("section", { class: "view shelf" }, this.dropZone, this.tiles, this.footer, h("div", { class: "sh-over" }, icon("plus", 18), "Drop to keep it here"));

    shelf.subscribe(() => this.render());
    window.addEventListener("mousemove", (e) => this.move(e));
    window.addEventListener("mouseup", () => (this.press = null));
    this.render();
  }

  height(): number {
    return HEADER_H + 136;
  }

  live(): boolean {
    return false;
  }

  tick() {}

  /** A file is being dragged over the island. */
  setDragOver(on: boolean) {
    toggle(this.el, "drag-over", on);
  }

  private move(e: MouseEvent) {
    const p = this.press;
    if (!p) return;
    if (!(e.buttons & 1)) {
      this.press = null;
      return;
    }
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START) return;
    this.press = null;
    this.host.pin("drag-out");
    void shelf.dragOut([p.path]);
  }

  private tile(path: string): HTMLElement {
    const info = shelf.info.get(path);
    const name = info?.name ?? path.split(/[\\/]/).pop() ?? path;
    const thumb = info?.thumbnail
      ? h("div", { class: "sh-thumb image", style: `background-image:url("${info.thumbnail}")` })
      : h("div", { class: "sh-thumb" }, icon(fileIcon(info?.ext ?? "", info?.isDir ?? false), 22), info?.ext ? h("span", { class: "sh-ext" }, info.ext.slice(0, 4)) : null);
    const missing = info != null && !info.exists;
    return h(
      "div",
      {
        class: missing ? "sh-tile missing" : "sh-tile",
        title: missing ? `${name} — moved or deleted` : `${name}${info ? ` · ${size(info.size)}` : ""}`,
        onmousedown: (e: MouseEvent) => {
          if (e.button !== 0 || missing || (e.target as Element).closest(".sh-actions")) return;
          e.preventDefault();
          this.press = { x: e.clientX, y: e.clientY, path };
        },
        ondblclick: () => !missing && shelf.open(path),
      },
      thumb,
      h("div", { class: "sh-name" }, name),
      h(
        "div",
        { class: "sh-actions" },
        missing ? null : h("button", { title: "Open", onclick: () => shelf.open(path) }, icon("open", 12)),
        missing ? null : h("button", { title: "Show in folder", onclick: () => shelf.reveal(path) }, icon("folder", 12)),
        h("button", { title: "Remove from shelf", onclick: () => void shelf.remove(path) }, icon("close", 12)),
      ),
    );
  }

  private render() {
    const empty = shelf.items.length === 0;
    toggle(this.el, "is-empty", empty);
    toggle(this.el, "dragging", shelf.dragging);
    if (!shelf.dragging) this.host.unpin("drag-out");
    this.tiles.replaceChildren(...shelf.items.map((i) => this.tile(i.path)));
  }
}
