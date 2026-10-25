// Small chimes, synthesised: no sound files to ship.

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundsEnabled(on: boolean) {
  enabled = on;
}

type Chime = "done" | "water" | "drop" | "tap";

const NOTES: Record<Chime, Array<[number, number]>> = {
  // [frequency Hz, start s]
  done: [
    [659.25, 0],
    [783.99, 0.12],
    [1046.5, 0.24],
  ],
  water: [
    [880, 0],
    [1174.66, 0.1],
  ],
  drop: [[523.25, 0]],
  tap: [[1318.5, 0]],
};

export function play(chime: Chime) {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime + 0.01;
    const gainAll = chime === "tap" ? 0.05 : 0.12;
    for (const [freq, at] of NOTES[chime]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t0 + at);
      gain.gain.linearRampToValueAtTime(gainAll, t0 + at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.55);
    }
  } catch {
    // No audio device: the island just stays quiet.
  }
}
