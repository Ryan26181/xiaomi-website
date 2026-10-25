// Documents kept between launches (src-tauri/src/store.rs): read once, written
// a moment after the last change so a burst of edits is one write.

import { call } from "./bridge";

export type DocName = "settings" | "todos" | "water" | "focus" | "shelf";

export async function load<T>(name: DocName, fallback: T): Promise<T> {
  const doc = await call<Partial<T>>("store_get", { name });
  if (doc == null || typeof doc !== "object" || Array.isArray(doc)) return fallback;
  return { ...fallback, ...doc };
}

const pending = new Map<DocName, ReturnType<typeof setTimeout>>();

export function save(name: DocName, value: unknown, delayMs = 400) {
  const old = pending.get(name);
  if (old != null) clearTimeout(old);
  pending.set(
    name,
    setTimeout(() => {
      pending.delete(name);
      void call("store_set", { name, value });
    }, delayMs),
  );
}
