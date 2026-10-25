// Clocks and durations as the island shows them.

/** 19:21, or 7:21 PM with the 12-hour clock. */
export function clock(d: Date, use24: boolean): string {
  const m = String(d.getMinutes()).padStart(2, "0");
  if (use24) return `${String(d.getHours()).padStart(2, "0")}:${m}`;
  const h = d.getHours() % 12 || 12;
  return `${h}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

/** "Sat 17 Oct", in the system's language. */
export function shortDate(d: Date, locale?: string): string {
  const day = d.toLocaleDateString(locale, { weekday: "short" });
  const month = d.toLocaleDateString(locale, { month: "short" });
  return `${day} ${d.getDate()} ${month}`;
}

/** 65 → "1:05"; 3700 → "1:01:40". */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Countdowns keep two digits for the minutes: "05:00". */
export function countdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Local calendar day, "2026-10-17": the key the water log is kept by. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The day `n` days before `d`, at the same time. */
export function daysBefore(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() - n);
  return out;
}

/** "in 23 min", "in 1 h 5 min". */
export function inMinutes(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `in ${h} h ${rest} min` : `in ${h} h`;
}
