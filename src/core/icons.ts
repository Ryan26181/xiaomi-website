// The island's icons: 24×24 strokes (or fills), drawn for Notchy.

const STROKE: Record<string, string> = {
  music: "M9 18V5l12-2v13|c6,18,3|c18,16,3",
  timer: "c12,13,8|M12 9v4l2.5 2.5|M9 2h6",
  droplet: "M12 2.7c3.3 4 6 7.3 6 10.8A6 6 0 0 1 6 13.5c0-3.5 2.7-6.8 6-10.8z",
  todo: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z|M8 12l3 3 5-6",
  shelf: "M22 12h-6l-2 3h-4l-2-3H2|M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z",
  settings: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1|c15,6,2|c9,12,2|c17,18,2",
  lyrics: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z|M7 8h10|M7 12h6",
  plus: "M12 5v14|M5 12h14",
  close: "M18 6 6 18|M6 6l12 12",
  open: "M15 3h6v6|M10 14 21 3|M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  folder: "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z",
  headphones: "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3",
  speaker: "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z|c12,14,4|M12 6h.01",
  keyboard: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z|M6 9h.01M10 9h.01M14 9h.01M18 9h.01M8 13h.01M12 13h.01M16 13h.01|M7 16h10",
  mouse: "M12 3a6 6 0 0 1 6 6v6a6 6 0 0 1-12 0V9a6 6 0 0 1 6-6z|M12 7v4",
  controller: "M6 11h4|M8 9v4|M15 12h.01|M18 10h.01|M17.3 5H6.7a4 4 0 0 0-3.96 3.44l-.7 5A3 3 0 0 0 5 17c1 0 1.5-.5 2-1l1.4-1.4A2 2 0 0 1 9.8 14h4.4a2 2 0 0 1 1.4.6L17 16c.5.5 1 1 2 1a3 3 0 0 0 2.96-3.56l-.7-5A4 4 0 0 0 17.3 5z",
  phone: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z|M12 18h.01",
  bluetooth: "m7 7 10 10-5 5V2l5 5L7 17",
  battery: "M4 7h13a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z|M22 11v2",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9|M10.3 21a1.94 1.94 0 0 0 3.4 0",
  reset: "M3 12a9 9 0 1 0 3-6.7L3 8|M3 3v5h5",
  skip: "M5 4l10 8-10 8z|M19 5v14",
  trash: "M3 6h18|M8 6V4h8v2|M6 6l1 14h10l1-14",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6",
  image: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z|c9,9,2|m21 15-5-5L5 21",
  film: "M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z|M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5",
  audio: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M10 18v-6l4-1v5|c9,18,1.2|c13,17,1.2",
  archive: "M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z|M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8|M10 12h4",
  code: "m16 18 6-6-6-6|m8 6-6 6 6 6",
  doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M8 13h8|M8 17h6",
  coffee: "M17 8h1a4 4 0 1 1 0 8h-1|M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z|M6 2v2|M10 2v2|M14 2v2",
  check: "M20 6 9 17l-5-5",
  power: "M12 2v10|M18.4 6.6a9 9 0 1 1-12.8 0",
  minus: "M5 12h14",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
};

const FILL: Record<string, string> = {
  play: "M7 4.6v14.8a1 1 0 0 0 1.53.85l11.84-7.4a1 1 0 0 0 0-1.7L8.53 3.75A1 1 0 0 0 7 4.6z",
  pause: "M7 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z|M14 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z",
  next: "M4 5.7v12.6a1 1 0 0 0 1.55.83L14 13.2V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v4.8L5.55 4.87A1 1 0 0 0 4 5.7z|M18.5 5h1a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5z",
  previous: "M20 5.7v12.6a1 1 0 0 1-1.55.83L10 13.2V18a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v4.8l8.45-5.93A1 1 0 0 1 20 5.7z|M4.5 5h1a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5z",
  boltFill: "M13 2 4 14h7l-1 8 9-12h-7z",
  dropFill: "M12 2.7c3.3 4 6 7.3 6 10.8A6 6 0 0 1 6 13.5c0-3.5 2.7-6.8 6-10.8z",
};

const NS = "http://www.w3.org/2000/svg";

function shapes(svg: SVGSVGElement, spec: string) {
  for (const part of spec.split("|")) {
    if (part.startsWith("c")) {
      const [cx, cy, r] = part.slice(1).split(",");
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", cx);
      c.setAttribute("cy", cy);
      c.setAttribute("r", r);
      svg.append(c);
    } else {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", part);
      svg.append(p);
    }
  }
}

export type IconName = keyof typeof STROKE | keyof typeof FILL;

export function icon(name: IconName | string, size = 16, cls = ""): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", `icon ${cls}`.trim());
  if (name in FILL) {
    svg.setAttribute("fill", "currentColor");
    shapes(svg, FILL[name]);
  } else {
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    shapes(svg, STROKE[name] ?? STROKE.file);
  }
  return svg;
}

/** Swaps an icon in place (play ↔ pause) without rebuilding its button. */
export function setIcon(holder: Element, name: IconName | string, size = 16, cls = "") {
  const old = holder.querySelector("svg.icon");
  if (old?.getAttribute("data-name") === name) return;
  const next = icon(name, size, cls);
  next.setAttribute("data-name", name);
  if (old) old.replaceWith(next);
  else holder.prepend(next);
}

/** The icon for a file on the shelf, by extension. */
export function fileIcon(ext: string, isDir: boolean): IconName {
  if (isDir) return "folder";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic", "psd", "fig"].includes(ext)) return "image";
  if (["mp4", "mov", "mkv", "avi", "webm"].includes(ext)) return "film";
  if (["mp3", "wav", "flac", "m4a", "ogg", "aac"].includes(ext)) return "audio";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (["js", "ts", "tsx", "jsx", "rs", "py", "java", "c", "cpp", "cs", "go", "html", "css", "json"].includes(ext)) return "code";
  if (["pdf", "doc", "docx", "txt", "md", "ppt", "pptx", "xls", "xlsx", "csv"].includes(ext)) return "doc";
  return "file";
}
