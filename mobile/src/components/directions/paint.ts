/**
 * Geometry and a batching painter for the town map. Thousands of small shapes (roofs, trees,
 * cars) are gathered into one SVG path per colour and depth, so the static city costs a few
 * hundred elements, not thousands.
 */
export type XY = { x: number; y: number };

export const add = (a: XY, b: XY): XY => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: XY, k: number): XY => ({ x: a.x * k, y: a.y * k });
export const len = (a: XY) => Math.hypot(a.x, a.y);
export const unit = (a: XY): XY => mul(a, 1 / (len(a) || 1));
export const perp = (a: XY): XY => ({ x: -a.y, y: a.x });
export const lerp = (a: XY, b: XY, t: number): XY => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const deg = (a: XY) => (Math.atan2(a.y, a.x) * 180) / Math.PI;
export const f = (n: number) => (Math.round(n * 10) / 10).toString();

/** A stable pseudo-random number in -1..1, so the same map is always drawn the same way. */
export function wobble(a: number, b: number, k: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233 + k * 37.719) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}
/** 0..1 version of wobble. */
export const rand = (a: number, b: number, k: number) => (wobble(a, b, k) + 1) / 2;
export const pick = <T>(list: readonly T[], a: number, b: number, k: number): T => list[Math.min(list.length - 1, Math.floor(rand(a, b, k) * list.length))];

/** Mix a colour towards black (k > 0) or white (k < 0). */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(k >= 0 ? c * (1 - k) : c + (255 - c) * -k));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Smooth curve through points (Catmull–Rom as cubic Béziers), from point i to point j. */
export function curve(points: XY[], from: number, to: number): string {
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  let d = `M${f(at(from).x)} ${f(at(from).y)}`;
  for (let i = from; i < to; i++) {
    const [c1, c2, p2] = bezier(points, i);
    d += ` C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

function bezier(points: XY[], i: number): [XY, XY, XY, XY] {
  const at = (k: number) => points[Math.max(0, Math.min(points.length - 1, k))];
  const p0 = at(i - 1);
  const p1 = at(i);
  const p2 = at(i + 1);
  const p3 = at(i + 2);
  return [add(p1, mul(sub(p2, p0), 1 / 6)), sub(p2, mul(sub(p3, p1), 1 / 6)), p2, p1];
}

/** Points along the same curve, every `step` units, with the direction of travel. */
export function sample(points: XY[], from: number, to: number, step = 2): { p: XY; dir: XY }[] {
  const out: { p: XY; dir: XY }[] = [];
  for (let i = from; i < to; i++) {
    const [c1, c2, p2, p1] = bezier(points, i);
    const n = Math.max(4, Math.ceil(len(sub(p2, p1)) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const u = 1 - t;
      const p = add(add(mul(p1, u * u * u), mul(c1, 3 * u * u * t)), add(mul(c2, 3 * u * t * t), mul(p2, t * t * t)));
      const d = add(add(mul(sub(c1, p1), 3 * u * u), mul(sub(c2, c1), 6 * u * t)), mul(sub(p2, c2), 3 * t * t));
      out.push({ p, dir: unit(d) });
    }
  }
  const last = points[Math.min(points.length - 1, to)];
  out.push({ p: last, dir: out.length ? out[out.length - 1].dir : { x: 1, y: 0 } });
  return out;
}

/** The tangent of the curve at point i. */
export const tangent = (points: XY[], i: number): XY =>
  unit(sub(points[Math.min(points.length - 1, i + 1)], points[Math.max(0, i - 1)]));

/** A polygon moved inwards by d (mitred). */
export function inset(poly: XY[], d: number): XY[] {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    area += poly[i].x * poly[(i + 1) % n].y - poly[(i + 1) % n].x * poly[i].y;
  }
  const s = area > 0 ? 1 : -1;
  return poly.map((p, i) => {
    const prev = poly[(i - 1 + n) % n];
    const next = poly[(i + 1) % n];
    const n1 = unit({ x: -(p.y - prev.y) * s, y: (p.x - prev.x) * s });
    const n2 = unit({ x: -(next.y - p.y) * s, y: (next.x - p.x) * s });
    const bis = unit(add(n1, n2));
    return add(p, mul(bis, d / Math.max(0.5, bis.x * n1.x + bis.y * n1.y)));
  });
}

/** A closed path with softly rounded corners through the given points. */
export function soft(poly: XY[], r = 3): string {
  const n = poly.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const prev = poly[(i - 1 + n) % n];
    const next = poly[(i + 1) % n];
    const a = lerp(p, prev, Math.min(0.45, r / (len(sub(p, prev)) || 1)));
    const b = lerp(p, next, Math.min(0.45, r / (len(sub(p, next)) || 1)));
    d += `${i === 0 ? 'M' : 'L'}${f(a.x)} ${f(a.y)} Q${f(p.x)} ${f(p.y)} ${f(b.x)} ${f(b.y)} `;
  }
  return `${d}Z`;
}

export const polyPath = (pts: XY[]) => `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L')}Z`;
export const linePath = (pts: XY[]) => `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L')}`;
export const circlePath = (c: XY, r: number) =>
  `M${f(c.x - r)} ${f(c.y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;

/** Convex hull (monotone chain), for the shadow a box casts. */
export function hull(points: XY[]): XY[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: XY, a: XY, b: XY) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: XY[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: XY[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** A local frame: draw in block coordinates, get map coordinates. */
export type Frame = (x: number, y: number) => XY;
export function frameAt(centre: XY, angleDeg: number): Frame {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (x, y) => ({ x: centre.x + x * c - y * s, y: centre.y + x * s + y * c });
}
export const rectPts = (F: Frame, x: number, y: number, w: number, h: number): XY[] => [F(x, y), F(x + w, y), F(x + w, y + h), F(x, y + h)];

export type Style = {
  fill?: string;
  stroke?: string;
  width?: number;
  opacity?: number;
  dash?: string;
  cap?: 'round' | 'butt' | 'square';
  join?: 'round' | 'miter';
};

/** Depths, back to front. */
export const Z = {
  land: 0,
  water: 10,
  waterDetail: 12,
  ground: 20,
  groundDetail: 24,
  casing: 30,
  road: 32,
  roadMark: 34,
  roadTop: 36,
  onGround: 40,
  shadow: 50,
  /** Buildings take 60–70, by how far south they stand. */
  building: 60,
  treeShadow: 78,
  tree: 80,
  treeLight: 82,
  furniture: 90,
  people: 92,
  sign: 96,
} as const;

type Layer = { z: number; order: number; style: Style; d: string[] };

export class Painter {
  layers = new Map<string, Layer>();
  private order = 0;

  path(z: number, style: Style, d: string) {
    const key = `${z}|${style.fill}|${style.stroke}|${style.width}|${style.opacity}|${style.dash}|${style.cap}|${style.join}`;
    let layer = this.layers.get(key);
    if (!layer) {
      layer = { z, order: this.order++, style, d: [] };
      this.layers.set(key, layer);
    }
    layer.d.push(d);
  }

  poly(z: number, style: Style, pts: XY[]) {
    this.path(z, style, polyPath(pts));
  }

  circle(z: number, style: Style, c: XY, r: number) {
    this.path(z, style, circlePath(c, r));
  }

  line(z: number, style: Style, pts: XY[]) {
    this.path(z, style, linePath(pts));
  }

  /**
   * A box seen from above and a little from the south: its shadow, the walls that face us
   * and its roof, lifted by `height`. Boxes further south get a higher `z`, so they stand in
   * front of the ones behind them.
   */
  box(foot: XY[], height: number, roof: string, wall: string, opts: { z: number; shadow?: boolean; edge?: string }) {
    const lift = { x: 0, y: -height };
    const top = foot.map((p) => add(p, lift));
    if (opts.shadow !== false && height > 0) {
      const off = { x: height * 0.75, y: height * 0.3 };
      this.poly(Z.shadow, { fill: 'rgba(48,44,36,0.17)' }, hull([...foot, ...foot.map((p) => add(p, off))]));
    }
    if (height > 0) {
      const n = foot.length;
      let area = 0;
      for (let i = 0; i < n; i++) {
        area += foot[i].x * foot[(i + 1) % n].y - foot[(i + 1) % n].x * foot[i].y;
      }
      for (let i = 0; i < n; i++) {
        const a = foot[i];
        const b = foot[(i + 1) % n];
        const out = unit(mul(perp(sub(b, a)), area > 0 ? -1 : 1));
        // Faces turned away from us are hidden under the roof; the east side is in shade.
        if (out.y < -0.2) continue;
        this.poly(opts.z, { fill: out.x > 0.45 ? shade(wall, 0.14) : wall }, [a, b, add(b, lift), add(a, lift)]);
      }
    }
    this.poly(opts.z + 0.001, { fill: roof, stroke: opts.edge, width: opts.edge ? 0.5 : undefined }, top);
    return top;
  }
}
