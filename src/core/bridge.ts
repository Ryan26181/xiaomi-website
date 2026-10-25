// Everything the page asks of Rust, and everything Rust tells it.
//
// Outside Tauri (`npm run dev` in a browser) the same calls are answered by a
// small demo (./demo.ts), so the island can be looked at and worked on
// without Windows.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Handler = (payload: unknown) => void;
type Demo = typeof import("./demo");

let demo: Promise<Demo> | null = null;
function loadDemo(): Promise<Demo> {
  demo ??= import("./demo");
  return demo;
}

/** Calls a Rust command; null when it fails (logged, never thrown). */
export async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!IS_TAURI) return (await loadDemo()).answer(cmd, args) as T | null;
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`[notchy] ${cmd} failed:`, err);
    return null;
  }
}

/** Listens to an event Rust emits to the island. */
export function on<T>(event: string, handler: (payload: T) => void) {
  if (!IS_TAURI) {
    void loadDemo().then((d) => d.subscribe(event, handler as Handler));
    return;
  }
  void listen<T>(event, (e) => handler(e.payload));
}

// ── Files dropped on the island ──────────────────────────────────────────────

interface WebView2 {
  postMessageWithAdditionalObjects?(message: unknown, objects: ArrayLike<unknown>): void;
}

export interface DropHandlers {
  enter(): void;
  leave(): void;
  drop(paths: string[]): void;
}

/**
 * On Windows WebView2 takes the drop itself (src-tauri/src/webview_drop.rs):
 * the page accepts the HTML5 drag and posts the File objects back to Rust,
 * which answers with their real paths as a `file-drop` event.
 */
export function installFileDrop(handlers: DropHandlers) {
  let depth = 0;
  const isFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

  window.addEventListener("dragenter", (e) => {
    if (!isFiles(e)) return;
    e.preventDefault();
    if (depth++ === 0) handlers.enter();
  });
  window.addEventListener("dragover", (e) => {
    if (!isFiles(e)) return;
    // Without this WebView2 refuses the drop, or navigates to the file.
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  });
  window.addEventListener("dragleave", (e) => {
    if (!isFiles(e)) return;
    if (--depth <= 0) {
      depth = 0;
      handlers.leave();
    }
  });
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    depth = 0;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
      handlers.leave();
      return;
    }
    const webview = (window as unknown as { chrome?: { webview?: WebView2 } }).chrome?.webview;
    if (IS_TAURI && webview?.postMessageWithAdditionalObjects) {
      webview.postMessageWithAdditionalObjects("notchy-file-drop", files);
    } else {
      // The browser demo has no paths: make believable ones.
      handlers.drop(Array.from(files).map((f) => `C:\\Users\\you\\Downloads\\${f.name}`));
    }
  });
  on<string[]>("file-drop", (paths) => handlers.drop(paths));
}
