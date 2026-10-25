// Springs and timed curves for the island's size.
// Ported from Coucou's island (src/core/anim.ts, MIT, github.com/Louis-CFM/coucou):
// a SwiftUI-style spring to grow, a short eased curve to shrink without overshoot.

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type EaseFn = (t: number) => number;

/** cubic-bezier(x1, y1, x2, y2), solved by bisection on x. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EaseFn {
  const cx = (t: number) => (1 - t) ** 2 * 3 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3;
  const cy = (t: number) => (1 - t) ** 2 * 3 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
  return (x) => {
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 14; i++) {
      if (cx(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return cy(t);
  };
}

export const closeCurve = cubicBezier(0.45, 0, 0.2, 1);

/** ω₀ = 2π / response, ζ = damping — integrated in small steps so a dropped frame never destabilises it. */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  private omega: number;
  private zeta: number;

  constructor(value: number, response = 0.45, damping = 0.78) {
    this.value = value;
    this.target = value;
    this.omega = (2 * Math.PI) / response;
    this.zeta = damping;
  }

  configure(response: number, damping: number) {
    this.omega = (2 * Math.PI) / response;
    this.zeta = damping;
  }

  set(value: number) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  get settled(): boolean {
    return Math.abs(this.target - this.value) < 0.01 && Math.abs(this.velocity) < 0.05;
  }

  step(dt: number) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const acc = this.omega * this.omega * (this.target - this.value) - 2 * this.zeta * this.omega * this.velocity;
      this.velocity += acc * h;
      this.value += this.velocity * h;
    }
  }
}

/** A value that springs when it grows and follows a timed curve when it shrinks. */
export class Tracked {
  private spring: Spring;
  private from = 0;
  private to = 0;
  private start = 0;
  private duration = 0;
  private mode: "spring" | "curve" | "idle" = "idle";

  constructor(value: number) {
    this.spring = new Spring(value);
  }

  get value(): number {
    return this.spring.value;
  }

  get target(): number {
    return this.spring.target;
  }

  get animating(): boolean {
    return this.mode !== "idle";
  }

  jump(v: number) {
    this.spring.set(v);
    this.mode = "idle";
  }

  springTo(v: number, response = 0.45, damping = 0.78) {
    if (this.mode === "idle" && v === this.spring.value) return;
    this.spring.configure(response, damping);
    this.spring.target = v;
    this.mode = "spring";
  }

  curveTo(v: number, durationMs = 300, now = performance.now()) {
    if (this.mode === "idle" && v === this.spring.value) return;
    this.from = this.spring.value;
    this.to = v;
    this.start = now;
    this.duration = durationMs;
    this.spring.target = v;
    this.spring.velocity = 0;
    this.mode = "curve";
  }

  step(dt: number, now = performance.now()) {
    if (this.mode === "spring") {
      this.spring.step(dt);
      if (this.spring.settled) {
        this.spring.set(this.spring.target);
        this.mode = "idle";
      }
    } else if (this.mode === "curve") {
      const p = clamp((now - this.start) / this.duration, 0, 1);
      this.spring.value = lerp(this.from, this.to, closeCurve(p));
      if (p >= 1) {
        this.spring.set(this.to);
        this.mode = "idle";
      }
    }
  }
}
