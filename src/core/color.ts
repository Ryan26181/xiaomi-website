// The accent of a cover: the colour the music card's glow and the equaliser take.

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export const DEFAULT_ACCENT: RGB = { r: 124, g: 92, b: 255 };

function hsl({ r, g, b }: RGB): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function rgb(h: number, s: number, l: number): RGB {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return { r: f(0), g: f(8), b: f(4) };
}

/**
 * The most colourful hue of an RGBA pixel buffer, made bright enough to glow
 * on black. Greys and near-blacks count little; a grey cover gets the default.
 */
export function pickAccent(pixels: Uint8ClampedArray | number[]): RGB {
  // 12 hue buckets, weighted by saturation × mid-lightness.
  const buckets = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const c = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
    const [h, s, l] = hsl(c);
    const w = s * s * (1 - Math.abs(l - 0.5) * 1.6);
    if (w <= 0.02) continue;
    const bucket = buckets[Math.min(11, Math.floor(h * 12))];
    bucket.w += w;
    bucket.r += c.r * w;
    bucket.g += c.g * w;
    bucket.b += c.b * w;
  }
  const best = buckets.reduce((a, b) => (b.w > a.w ? b : a));
  if (best.w < 0.5) return DEFAULT_ACCENT;
  const [h, s] = hsl({ r: best.r / best.w, g: best.g / best.w, b: best.b / best.w });
  // Bright and saturated enough to read on the black island.
  return rgb(h, Math.max(0.55, Math.min(0.9, s)), 0.6);
}

export function css({ r, g, b }: RGB, alpha = 1): string {
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Reads a (data URL) image and picks its accent. */
export function accentOf(src: string): Promise<RGB> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const g = c.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(img, 0, 0, 24, 24);
        resolve(pickAccent(g.getImageData(0, 0, 24, 24).data));
      } catch {
        resolve(DEFAULT_ACCENT);
      }
    };
    img.onerror = () => resolve(DEFAULT_ACCENT);
    img.src = src;
  });
}
