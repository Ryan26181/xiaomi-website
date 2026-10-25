// A tiny element builder. Text always goes in as text, never as HTML: track
// titles, lyrics and file names come from outside.

type Child = Node | string | number | null | undefined | false;
type Props = {
  class?: string;
  style?: string;
  title?: string;
  [key: string]: unknown;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key.startsWith("on") && typeof value === "function") {
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else if (key === "class") {
        el.className = String(value);
      } else if (key in el && key !== "style" && key !== "list") {
        (el as unknown as Record<string, unknown>)[key] = value;
      } else {
        el.setAttribute(key, value === true ? "" : String(value));
      }
    }
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]) {
  for (const child of children) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Sets text only when it changed: no layout work for an unchanged clock. */
export function text(el: Element, value: string) {
  if (el.textContent !== value) el.textContent = value;
}

export function toggle(el: Element, cls: string, on: boolean) {
  if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
}
