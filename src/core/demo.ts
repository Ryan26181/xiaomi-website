// A stand-in for the Rust side when the island runs in a plain browser
// (`npm run dev`): a few tracks that play, a laptop battery, a headset that can
// be "connected" from the console (window.notchyDemo), and localStorage for
// the documents. Never loaded inside Tauri.

import type { BtDevice, MediaState, PowerState, ShelfFile } from "./types";

type Handler = (payload: unknown) => void;
const handlers = new Map<string, Set<Handler>>();

function emit(event: string, payload: unknown) {
  handlers.get(event)?.forEach((h) => h(payload));
}

export function subscribe(event: string, handler: Handler) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler);
  // What a real backend would have sent already.
  if (event === "media-state") setTimeout(() => sendMedia(), 300);
  if (event === "power-state") setTimeout(() => handler(power), 200);
}

// ── Now playing ──────────────────────────────────────────────────────────────

const TRACKS = [
  { title: "Kok Masih Rindu?", artist: "Akbar Chalay", album: "Kok Masih Rindu?", duration: 163, colors: ["#ff4d8d", "#5b0f2e"] },
  { title: "Havana", artist: "Camila Cabello", album: "Camila", duration: 217, colors: ["#f59e0b", "#7c2d12"] },
  { title: "Paper Sky", artist: "Lumen Coast", album: "Sunset Flare", duration: 201, colors: ["#38bdf8", "#312e81"] },
];

let trackIndex = 0;
let playing = true;
let position = 65;
let positionAt = Date.now();

function current(): MediaState {
  const t = TRACKS[trackIndex];
  return {
    active: true,
    source: "Spotify",
    title: t.title,
    artist: t.artist,
    album: t.album,
    duration: t.duration,
    position,
    positionAt,
    playing,
    canPrevious: true,
    canNext: true,
    canSeek: true,
    artKey: `demo-${trackIndex}`,
  };
}

function cover(i: number): string {
  const [a, b] = TRACKS[i].colors;
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 160, 160);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  g.fillStyle = grad;
  g.fillRect(0, 0, 160, 160);
  g.globalAlpha = 0.35;
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(120, 40, 46, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.9;
  g.font = "bold 30px system-ui, sans-serif";
  g.fillText(TRACKS[i].title.slice(0, 3).toUpperCase(), 14, 140);
  return c.toDataURL("image/png");
}

function sendMedia() {
  const state = current();
  emit("media-state", state);
  setTimeout(() => emit("media-artwork", { artKey: state.artKey, dataUrl: cover(trackIndex) }), 120);
}

function elapsed() {
  return playing ? position + (Date.now() - positionAt) / 1000 : position;
}

function control(action: string, value?: number): boolean {
  const now = Date.now();
  switch (action) {
    case "playPause":
      position = elapsed();
      positionAt = now;
      playing = !playing;
      break;
    case "next":
    case "previous":
      trackIndex = (trackIndex + (action === "next" ? 1 : TRACKS.length - 1)) % TRACKS.length;
      position = 0;
      positionAt = now;
      playing = true;
      break;
    case "seek":
      position = value ?? 0;
      positionAt = now;
      break;
    default:
      return false;
  }
  setTimeout(sendMedia, 120);
  return true;
}

// The track ends and the next one starts, as a player would.
setInterval(() => {
  if (playing && elapsed() >= TRACKS[trackIndex].duration) control("next");
}, 1000);

// ── Devices ──────────────────────────────────────────────────────────────────

let power: PowerState = { hasBattery: true, plugged: false, charging: false, percent: 64 };
const headset: BtDevice = {
  id: "demo-headset",
  name: "Baseus Encok WM01",
  connected: false,
  kind: "headphones",
  battery: null,
  initial: false,
};

function shelfFile(path: string): ShelfFile {
  const name = path.split(/[\\/]/).pop() ?? path;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const image = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  return {
    path,
    name,
    ext,
    isDir: ext === "",
    size: 1024 * (40 + name.length * 13),
    exists: true,
    thumbnail: image ? cover(name.length % TRACKS.length) : null,
  };
}

export function answer(cmd: string, args?: Record<string, unknown>): unknown {
  switch (cmd) {
    case "platform_info":
      return { os: "browser", cursorPoll: false, version: "0.1.0-demo" };
    case "store_get": {
      try {
        const text = localStorage.getItem(`notchy:${args?.name}`);
        return text ? JSON.parse(text) : null;
      } catch {
        return null;
      }
    }
    case "store_set":
      try {
        localStorage.setItem(`notchy:${args?.name}`, JSON.stringify(args?.value));
      } catch {
        /* private window: nothing kept */
      }
      return null;
    case "media_state":
      return current();
    case "media_control":
      return control(String(args?.action), args?.value as number | undefined);
    case "bt_devices":
      return headset.connected ? [headset] : [];
    case "power_state":
      return power;
    case "shelf_info":
      return ((args?.paths as string[]) ?? []).map(shelfFile);
    case "shelf_drag_out":
      setTimeout(() => emit("shelf-drag-end", { dropped: true, paths: args?.paths ?? [] }), 400);
      return true;
    case "shelf_open":
    case "shelf_reveal":
      return true;
    case "autostart_get":
      return false;
    case "autostart_set":
      return Boolean(args?.enabled);
    default:
      return null;
  }
}

// Console hooks for trying the live activities in a browser.
const hooks = {
  connectHeadset(battery = 79) {
    Object.assign(headset, { connected: true, battery: null });
    emit("bt-device", { ...headset });
    setTimeout(() => {
      headset.battery = battery;
      emit("bt-device", { ...headset });
    }, 900);
  },
  disconnectHeadset() {
    Object.assign(headset, { connected: false, battery: null });
    emit("bt-device", { ...headset });
  },
  plugCharger(on = true) {
    power = { ...power, plugged: on, charging: on };
    emit("power-state", power);
  },
  fullscreen(on = true) {
    emit("fullscreen", on);
  },
  track(i: number) {
    trackIndex = i % TRACKS.length;
    position = 30;
    positionAt = Date.now();
    playing = true;
    sendMedia();
  },
};
(window as unknown as { notchyDemo: typeof hooks }).notchyDemo = hooks;
