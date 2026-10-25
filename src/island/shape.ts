// The island's outline: a flat top glued to the screen's edge, two concave
// "ears" where it meets the edge (as a MacBook notch does), and round bottom
// corners. Drawn as one SVG path so it stays crisp at every size.

/** Widest ear, logical px; the SVG reserves this much on each side. */
export const EAR_MAX = 12;

export interface ShapeSize {
  w: number;
  h: number;
  /** Bottom corner radius. */
  r: number;
}

/** The ear for an island this tall: smaller as it retracts into the edge. */
export function earFor(h: number): number {
  return Math.max(0, Math.min(EAR_MAX, h * 0.32));
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * The path, in a box EAR_MAX wider than the island on each side: x = EAR_MAX
 * is the island's left edge. Empty when there is nothing to draw.
 */
export function islandPath({ w, h, r }: ShapeSize): string {
  if (!(w > 1 && h > 0.5)) return "";
  const e = earFor(h);
  const R = Math.max(0, Math.min(r, h - e, w / 2));
  const L = EAR_MAX;
  const Rt = EAR_MAX + w;
  return [
    `M${f(L - e)} 0`,
    `L${f(Rt + e)} 0`,
    // Right ear: a quarter circle centred outside the island, curving down into its side.
    `A${f(e)} ${f(e)} 0 0 0 ${f(Rt)} ${f(e)}`,
    `L${f(Rt)} ${f(h - R)}`,
    `A${f(R)} ${f(R)} 0 0 1 ${f(Rt - R)} ${f(h)}`,
    `L${f(L + R)} ${f(h)}`,
    `A${f(R)} ${f(R)} 0 0 1 ${f(L)} ${f(h - R)}`,
    `L${f(L)} ${f(e)}`,
    `A${f(e)} ${f(e)} 0 0 0 ${f(L - e)} 0`,
    "Z",
  ].join(" ");
}
