// A progress ring, drawn with SVG so it stays sharp at any size.

const NS = "http://www.w3.org/2000/svg";

export class Ring {
  readonly el: SVGSVGElement;
  private arc: SVGCircleElement;
  private circumference: number;

  constructor(size: number, stroke: number, cls = "") {
    const r = (size - stroke) / 2;
    this.circumference = 2 * Math.PI * r;
    this.el = document.createElementNS(NS, "svg");
    this.el.setAttribute("viewBox", `0 0 ${size} ${size}`);
    this.el.setAttribute("width", String(size));
    this.el.setAttribute("height", String(size));
    this.el.setAttribute("class", `ring ${cls}`.trim());
    const track = document.createElementNS(NS, "circle");
    this.arc = document.createElementNS(NS, "circle");
    for (const c of [track, this.arc]) {
      c.setAttribute("cx", String(size / 2));
      c.setAttribute("cy", String(size / 2));
      c.setAttribute("r", String(r));
      c.setAttribute("fill", "none");
      c.setAttribute("stroke-width", String(stroke));
    }
    track.setAttribute("class", "ring-track");
    this.arc.setAttribute("class", "ring-arc");
    this.arc.setAttribute("stroke-linecap", "round");
    this.arc.setAttribute("stroke-dasharray", String(this.circumference));
    this.arc.setAttribute("transform", `rotate(-90 ${size / 2} ${size / 2})`);
    this.el.append(track, this.arc);
    this.set(0);
  }

  /** 0…1. */
  set(progress: number) {
    const p = Math.min(1, Math.max(0, progress));
    this.arc.setAttribute("stroke-dashoffset", String(this.circumference * (1 - p)));
    this.arc.style.opacity = p <= 0.001 ? "0" : "1";
  }
}
