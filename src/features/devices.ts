// Bluetooth devices and the laptop's battery, as Rust reports them.

import { call, on } from "../core/bridge";
import { Emitter } from "../core/emitter";
import type { BtDevice, PowerState } from "../core/types";

class Devices extends Emitter {
  connected = new Map<string, BtDevice>();
  power: PowerState | null = null;

  /** A device connected, disconnected or reported its battery. */
  onDevice: ((now: BtDevice, before: BtDevice | undefined) => void) | null = null;
  /** The charger was plugged in or out, or the battery crossed a low mark. */
  onPower: ((now: PowerState, before: PowerState | null) => void) | null = null;

  init() {
    on<BtDevice>("bt-device", (d) => this.device(d));
    on<PowerState>("power-state", (p) => this.setPower(p));
    void call<BtDevice[]>("bt_devices").then((list) => {
      for (const d of list ?? []) this.connected.set(d.id, d);
      this.changed();
    });
    void call<PowerState>("power_state").then((p) => p && this.setPower(p));
  }

  /** The audio device to show next to the clock, if one is connected. */
  get headset(): BtDevice | null {
    const all = [...this.connected.values()];
    return all.find((d) => d.kind === "headphones") ?? all.find((d) => d.kind === "speaker") ?? null;
  }

  private device(d: BtDevice) {
    const before = this.connected.get(d.id);
    if (d.connected) this.connected.set(d.id, d);
    else this.connected.delete(d.id);
    this.onDevice?.(d, before);
    this.changed();
  }

  private setPower(p: PowerState) {
    const before = this.power;
    this.power = p;
    if (before) this.onPower?.(p, before);
    this.changed();
  }
}

export const devices = new Devices();
