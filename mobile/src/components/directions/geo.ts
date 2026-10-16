import { type Point, SIZE, type TownSpec } from '@/lib/directions';

import { add, deg, frameAt, inset, len, lerp, mul, sample, sub, wobble, type XY } from './paint';

/** The map is drawn in a 360 × 360 box. */
export const VIEW = 360;
export const MINOR = 8.5;
export const MAJOR = 12.5;
export const PAVEMENT = 3.6;
/** Streets are drawn from crossing FIRST to LAST, well past the edge of the playing grid. */
export const FIRST = -2;
export const LAST = SIZE + 1;

/** Where a crossing is drawn; crossings outside the grid continue its spacing. */
export function nodeXY(town: TownSpec, [c, r]: Point): XY {
  const cols = town.cols ?? [36, 132, 228, 324];
  const rows = town.rows ?? [36, 132, 228, 324];
  const axis = (v: number[], i: number) =>
    i < 0 ? v[0] - (v[1] - v[0]) * -i : i >= SIZE ? v[SIZE - 1] + (v[SIZE - 1] - v[SIZE - 2]) * (i - SIZE + 1) : v[i];
  const bend = town.bend ?? 0;
  const p = { x: axis(cols, c) + bend * wobble(c, r, 1), y: axis(rows, r) + bend * wobble(c, r, 2) };
  if (!town.tilt) {
    return p;
  }
  const a = (town.tilt * Math.PI) / 180;
  const o = { x: p.x - VIEW / 2, y: p.y - VIEW / 2 };
  return { x: VIEW / 2 + o.x * Math.cos(a) - o.y * Math.sin(a), y: VIEW / 2 + o.x * Math.sin(a) + o.y * Math.cos(a) };
}

export const isMajor = (town: TownSpec, axis: 'H' | 'V', i: number) => ((axis === 'H' ? town.majorH : town.majorV) ?? []).includes(i);
export const halfWidth = (town: TownSpec, axis: 'H' | 'V', i: number) => (isMajor(town, axis, i) ? MAJOR : MINOR) / 2;

export type Street = {
  axis: 'H' | 'V';
  index: number;
  name: string | null;
  major: boolean;
  points: XY[];
  nodes: Point[];
};

/** Every street on the map, the named ones of the game and the unnamed ones around them. */
export function streets(town: TownSpec): Street[] {
  const out: Street[] = [];
  for (let i = FIRST + 1; i < LAST; i++) {
    for (const axis of ['H', 'V'] as const) {
      const nodes: Point[] = [];
      for (let k = FIRST; k <= LAST; k++) {
        nodes.push(axis === 'H' ? [k, i] : [i, k]);
      }
      const named = i >= 0 && i < SIZE;
      out.push({
        axis,
        index: i,
        name: named ? (axis === 'H' ? town.streetsH[i] : town.streetsV[i]) : null,
        major: isMajor(town, axis, i),
        points: nodes.map((p) => nodeXY(town, p)),
        nodes,
      });
    }
  }
  return out;
}

/** Index of a crossing in its street's point list. */
export const at = (k: number) => k - FIRST;

/** Points along the street between two neighbouring crossings, in the order a → b. */
export function between(town: TownSpec, a: Point, b: Point, step = 2): XY[] {
  const horizontal = a[1] === b[1];
  const axisIndex = horizontal ? a[1] : a[0];
  const nodes: Point[] = [];
  for (let k = FIRST; k <= LAST; k++) {
    nodes.push(horizontal ? [k, axisIndex] : [axisIndex, k]);
  }
  const points = nodes.map((p) => nodeXY(town, p));
  const ia = at(horizontal ? a[0] : a[1]);
  const ib = at(horizontal ? b[0] : b[1]);
  const lo = Math.min(ia, ib);
  const pts = sample(points, lo, lo + 1, step).map((s) => s.p);
  return ia < ib ? pts : pts.reverse();
}

/** The point a fraction t of the way along the street from crossing a to crossing b. */
export function along(town: TownSpec, a: Point, b: Point, t: number): XY {
  const pts = between(town, a, b, 1);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  const target = t * cum[cum.length - 1];
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  return lerp(pts[i - 1], pts[i], Math.max(0, Math.min(1, (target - cum[i - 1]) / seg)));
}

export function outline(town: TownSpec, [c, r]: Point, [w, h]: Point): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < w; i++) out.push(nodeXY(town, [c + i, r]));
  for (let j = 0; j < h; j++) out.push(nodeXY(town, [c + w, r + j]));
  for (let i = w; i > 0; i--) out.push(nodeXY(town, [c + i, r + h]));
  for (let j = h; j > 0; j--) out.push(nodeXY(town, [c, r + j]));
  return out;
}

/** How far a block's kerb sits from the centre lines of the streets around it. */
export function kerb(town: TownSpec, [c, r]: Point, [w, h]: Point = [1, 1]): number {
  return Math.max(halfWidth(town, 'H', r), halfWidth(town, 'H', r + h), halfWidth(town, 'V', c), halfWidth(town, 'V', c + w));
}

/** The block's ground (inside the pavement) and a local drawing frame for it. */
export function blockFrame(town: TownSpec, block: Point, span: Point = [1, 1]) {
  const k = kerb(town, block, span);
  const ground = inset(outline(town, block, span), k + PAVEMENT);
  const [c, r] = block;
  const [w, h] = span;
  const nw = nodeXY(town, [c, r]);
  const ne = nodeXY(town, [c + w, r]);
  const se = nodeXY(town, [c + w, r + h]);
  const sw = nodeXY(town, [c, r + h]);
  const m = k + PAVEMENT + 1;
  const centre = mul(add(add(nw, ne), add(se, sw)), 0.25);
  const angle = (deg(sub(ne, nw)) + deg(sub(se, sw))) / 2;
  return {
    ground,
    kerbLine: inset(outline(town, block, span), k),
    centre,
    angle,
    width: (len(sub(ne, nw)) + len(sub(se, sw))) / 2 - m * 2,
    height: (len(sub(sw, nw)) + len(sub(se, ne))) / 2 - m * 2,
    F: frameAt(centre, angle),
  };
}
