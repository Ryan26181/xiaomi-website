// Notchy's page: loads what was kept, builds the island, and turns what
// happens (a song, headphones, the charger, a timer, a reminder) into live
// activities.

import { call, installFileDrop, on } from "./core/bridge";
import { css } from "./core/color";
import { play, setSoundsEnabled } from "./core/sound";
import type { IconName } from "./core/icons";
import type { BtDevice, DeviceKind, PowerState } from "./core/types";
import { devices } from "./features/devices";
import { focus } from "./features/focus";
import { media } from "./features/media";
import { settings } from "./features/settings";
import { shelf } from "./features/shelf";
import { todos } from "./features/todo";
import { water } from "./features/water";
import type { Activity } from "./island/activity";
import { Island } from "./island/island";
import { FocusView } from "./views/focus";
import { MusicView } from "./views/music";
import { SettingsView } from "./views/settings";
import { ShelfView } from "./views/shelf";
import { TodoView } from "./views/todo";
import type { IslandHost } from "./views/view";
import { WaterView } from "./views/water";

const DEVICE_ICON: Record<DeviceKind, IconName> = {
  headphones: "headphones",
  speaker: "speaker",
  keyboard: "keyboard",
  mouse: "mouse",
  phone: "phone",
  controller: "controller",
  other: "bluetooth",
};

function batteryTint(percent: number): string {
  return percent <= 20 ? "#ff5a5f" : percent <= 50 ? "#f5a524" : "#34d399";
}

const litres = (ml: number) => `${(ml / 1000).toFixed(ml % 100 === 0 ? 1 : 2)} L`;

async function main() {
  await settings.load();
  setSoundsEnabled(settings.value.sounds);
  settings.subscribe(() => setSoundsEnabled(settings.value.sounds));
  await Promise.all([focus.load(), water.load(), todos.load(), shelf.load()]);
  media.init();
  devices.init();

  // The views talk to the island through this; it exists once they do.
  let island: Island | null = null;
  const host: IslandHost = {
    relayout: () => island?.relayout(),
    pin: (reason) => island?.pin(reason),
    unpin: (reason) => island?.unpin(reason),
    setFocusable: (on) => island?.setFocusable(on),
    close: () => island?.close(),
  };
  const shelfView = new ShelfView(host);
  const isle = new Island(document.getElementById("root")!, [
    new MusicView(host),
    new FocusView(),
    new WaterView(),
    new TodoView(host),
    shelfView,
    new SettingsView(),
  ]);
  island = isle;

  /** Shows a live activity, bringing a hidden island out for it. */
  const pop = (a: Activity) => {
    if (isle.fsm.mode === "hidden") isle.fsm.reveal();
    isle.activities.show(a);
  };

  // ── A new song ───────────────────────────────────────────────────────────
  const coverKey = () => `${media.art}|${css(media.accent)}`;
  let lastCover = "";
  media.onTrackChange = (s) => {
    if (!settings.value.trackPopups || isle.fsm.mode === "expanded") return;
    lastCover = coverKey();
    pop({ key: "track", icon: "music", tint: css(media.accent), art: media.art, title: s.title, sub: s.artist || s.source, right: { kind: "eq" }, ms: 3500, view: "music" });
  };
  media.subscribe(() => {
    // The cover, then its colour, land a moment after the title.
    if (coverKey() !== lastCover) {
      lastCover = coverKey();
      isle.activities.update("track", { art: media.art, tint: css(media.accent) });
    }
  });

  // ── Bluetooth ────────────────────────────────────────────────────────────
  const batteryRing = (d: BtDevice) =>
    d.battery != null ? { kind: "ring" as const, value: d.battery / 100, label: `${d.battery}%` } : undefined;
  devices.onDevice = (d, before) => {
    if (d.initial) return;
    const key = `bt:${d.id}`;
    const base = { key, icon: DEVICE_ICON[d.kind] ?? "bluetooth", title: d.name };
    if (d.connected && !before) {
      pop({ ...base, tint: d.battery != null ? batteryTint(d.battery) : "#60a5fa", sub: "Connected", right: batteryRing(d), ms: 4200 });
    } else if (d.connected && before && d.battery !== before.battery && d.battery != null) {
      isle.activities.update(key, { right: batteryRing(d), tint: batteryTint(d.battery) });
    } else if (!d.connected) {
      pop({ ...base, tint: "#9ca3af", sub: "Disconnected", ms: 2600 });
    }
  };

  // ── Charger and battery ──────────────────────────────────────────────────
  const powerRing = (p: PowerState) => ({ kind: "ring" as const, value: p.percent / 100, label: `${p.percent}%` });
  devices.onPower = (p, before) => {
    if (!p.hasBattery || !before) return;
    if (p.plugged && !before.plugged) {
      pop({ key: "power", icon: "boltFill", tint: "#34d399", title: "Charging", sub: p.percent >= 100 ? "Fully charged" : "Plugged in", right: powerRing(p), ms: 3200 });
    } else if (!p.plugged && before.plugged) {
      pop({ key: "power", icon: "battery", tint: batteryTint(p.percent), title: "On battery", sub: "Charger unplugged", right: powerRing(p), ms: 2600 });
    } else if (!p.plugged && ((p.percent <= 20 && before.percent > 20) || (p.percent <= 10 && before.percent > 10))) {
      pop({ key: "power", icon: "battery", tint: "#ff5a5f", title: "Battery low", sub: "Plug in soon", right: powerRing(p), ms: 5000 });
    }
  };

  // ── Focus timer ──────────────────────────────────────────────────────────
  focus.onFinished = (ended, next) => {
    play("done");
    const breakMin = Math.round(focus.durationMs(next) / 60_000);
    pop(
      ended === "focus"
        ? { key: "focus", icon: "coffee", tint: "#34d399", title: "Focus session done", sub: `Time for a ${breakMin}-minute break`, ms: 6500, view: "focus" }
        : { key: "focus", icon: "timer", tint: "#ff5a5f", title: "Break's over", sub: "Ready for the next focus?", ms: 6500, view: "focus" },
    );
  };

  // ── Water ────────────────────────────────────────────────────────────────
  water.onDue = () => {
    play("water");
    const total = water.total();
    const goal = water.goal();
    pop({
      key: "water",
      icon: "dropFill",
      tint: "#38bdf8",
      title: "Time for some water",
      sub: `${litres(total)} of ${litres(goal)} today`,
      right: { kind: "ring", value: total / goal, label: `${Math.round((total / goal) * 100)}%` },
      ms: 9000,
      view: "water",
    });
  };
  setInterval(() => water.check(), 30_000);

  // ── Files dropped on the island ──────────────────────────────────────────
  installFileDrop({
    enter: () => {
      isle.pin("file-drag");
      shelfView.setDragOver(true);
      isle.openTo("shelf");
    },
    leave: () => {
      shelfView.setDragOver(false);
      isle.unpin("file-drag");
    },
    drop: (paths) => {
      shelfView.setDragOver(false);
      isle.setView("shelf");
      void shelf.add(paths).then(() => play("drop"));
      isle.unpin("file-drag");
    },
  });
  on("shelf-drag-end", () => shelf.dragEnded());

  // ── Clocks ───────────────────────────────────────────────────────────────
  const everyMinute = () => {
    const now = new Date();
    isle.minute(now);
    setTimeout(everyMinute, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20);
  };
  everyMinute();

  // One CSS pixel = one logical window pixel, whatever the text scaling (island.rs).
  const fitZoom = () => void call("fit_zoom", { dpr: window.devicePixelRatio });
  fitZoom();
  window.addEventListener("resize", fitZoom);

  (window as unknown as { notchy: unknown }).notchy = { island: isle, pop, focus, water, todos, shelf, settings };
}

void main();
