import { memo, type ReactNode, useMemo } from 'react';
import Svg, { Circle, G, Path, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { closedSegments, type Heading, type Place, type PlaceKind, type Point, segmentKey, SIZE, type TownSpec } from '@/lib/directions';
import { colors, fonts } from '@/theme';

/*
 * The town is drawn the way a good printed city map or a modern map app draws a place:
 * pale land, white streets with a quiet casing (main roads a little wider and warmer),
 * blocks made of many small building footprints around courtyards, parks and water in soft
 * natural tones, and named places as slightly darker buildings with a small marker and label.
 * The layout follows the 4×4 grid the game walks on, at uneven, wandering positions.
 */
export const VIEW = 360;
const MINOR = 7;
const MAJOR = 11;
const CASING = 1.2;

const P = {
  land: '#EEECE6',
  fabric: '#E6E2D9',
  building: '#DCD6CA',
  buildingEdge: '#CEC7B8',
  landmark: '#D2C7B3',
  landmarkEdge: '#B9AD96',
  road: '#FFFFFF',
  roadMajor: '#FBF4E1',
  casing: '#D3CDC0',
  casingMajor: '#E2D4AE',
  park: '#D5E3C6',
  parkEdge: '#C2D5B0',
  treeA: '#C2D6AE',
  treeB: '#B2CA9C',
  path: '#F4F1E8',
  water: '#CADDE6',
  waterDeep: '#BDD3DE',
  shore: '#AFC7D3',
  paving: '#ECE6D8',
  pavingLine: '#DDD4C1',
  label: '#7D8287',
  poiText: '#3B4147',
  halo: '#FFFFFF',
};

/** Marker colours: muted, one family, telling place types apart without shouting. */
const POI: Record<PlaceKind, string> = {
  hotel: '#A85C45',
  bank: '#56636F',
  museum: '#8A7350',
  cafe: '#946640',
  pharmacy: '#4B8560',
  post: '#A6483C',
  supermarket: '#4C7690',
  station: '#3A5266',
  theatre: '#76566A',
  restaurant: '#9E663D',
  gallery: '#77705F',
  market: '#8A7A42',
  park: '#5E8752',
  square: '#857860',
};

// ---- geometry -------------------------------------------------------------------------------

type XY = { x: number; y: number };
const add = (a: XY, b: XY): XY => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: XY, k: number): XY => ({ x: a.x * k, y: a.y * k });
const len = (a: XY) => Math.hypot(a.x, a.y);
const unit = (a: XY): XY => mul(a, 1 / (len(a) || 1));
const lerp = (a: XY, b: XY, t: number): XY => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const deg = (a: XY) => (Math.atan2(a.y, a.x) * 180) / Math.PI;
const f = (n: number) => n.toFixed(1);

/** A stable pseudo-random number in -1..1, so the same map is always drawn the same way. */
function wobble(a: number, b: number, k: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233 + k * 37.719) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

/** Where a crossing is drawn; crossings outside the grid (-1, 4) continue its spacing. */
export function nodeXY(town: TownSpec, [c, r]: Point): XY {
  const cols = town.cols ?? [36, 132, 228, 324];
  const rows = town.rows ?? [36, 132, 228, 324];
  const axis = (v: number[], i: number) => (i < 0 ? v[0] - (v[1] - v[0]) * -i : i >= SIZE ? v[SIZE - 1] + (v[SIZE - 1] - v[SIZE - 2]) * (i - SIZE + 1) : v[i]);
  const bend = town.bend ?? 0;
  return { x: axis(cols, c) + bend * wobble(c, r, 1), y: axis(rows, r) + bend * wobble(c, r, 2) };
}

/** Smooth curve through points (Catmull–Rom as cubic Béziers), from point i to point j. */
function curve(points: XY[], from: number, to: number): string {
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  let d = `M${f(at(from).x)} ${f(at(from).y)}`;
  for (let i = from; i < to; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = add(p1, mul(sub(p2, p0), 1 / 6));
    const c2 = sub(p2, mul(sub(p3, p1), 1 / 6));
    d += ` C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

/** A polygon moved inwards by d (mitred). */
function inset(poly: XY[], d: number): XY[] {
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

/** A closed shape with softly rounded corners, through the given points. */
function soft(poly: XY[], r = 3): string {
  const n = poly.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const a = lerp(p, poly[(i - 1 + n) % n], Math.min(0.4, r / (len(sub(p, poly[(i - 1 + n) % n])) || 1)));
    const b = lerp(p, poly[(i + 1) % n], Math.min(0.4, r / (len(sub(p, poly[(i + 1) % n])) || 1)));
    d += `${i === 0 ? 'M' : 'L'}${f(a.x)} ${f(a.y)} Q${f(p.x)} ${f(p.y)} ${f(b.x)} ${f(b.y)} `;
  }
  return `${d}Z`;
}

function outline(town: TownSpec, [c, r]: Point, [w, h]: Point): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < w; i++) out.push(nodeXY(town, [c + i, r]));
  for (let j = 0; j < h; j++) out.push(nodeXY(town, [c + w, r + j]));
  for (let i = w; i > 0; i--) out.push(nodeXY(town, [c + i, r + h]));
  for (let j = h; j > 0; j--) out.push(nodeXY(town, [c, r + j]));
  return out;
}

/** A local frame for drawing inside a block: centre, size and the angle of its north edge. */
function frame(town: TownSpec, [c, r]: Point, [w, h]: Point, margin: number) {
  const nw = nodeXY(town, [c, r]);
  const ne = nodeXY(town, [c + w, r]);
  const se = nodeXY(town, [c + w, r + h]);
  const sw = nodeXY(town, [c, r + h]);
  return {
    centre: mul(add(add(nw, ne), add(se, sw)), 0.25),
    width: (len(sub(ne, nw)) + len(sub(se, sw))) / 2 - margin * 2,
    height: (len(sub(sw, nw)) + len(sub(se, ne))) / 2 - margin * 2,
    angle: (deg(sub(ne, nw)) + deg(sub(se, sw))) / 2,
  };
}

const isMajorH = (town: TownSpec, r: number) => (town.majorH ?? []).includes(r);
const isMajorV = (town: TownSpec, c: number) => (town.majorV ?? []).includes(c);
/** Half the width of the road along a block edge, so blocks sit right against the kerb. */
const margin = (town: TownSpec, [c, r]: Point) =>
  Math.max(isMajorH(town, r) || isMajorH(town, r + 1) || isMajorV(town, c) || isMajorV(town, c + 1) ? MAJOR / 2 : MINOR / 2, MINOR / 2) + 2.5;

// ---- city fabric ----------------------------------------------------------------------------

type Lot = { x: number; y: number; w: number; h: number };

/**
 * Buildings around the edge of a block, with a courtyard in the middle: the way most city
 * blocks look from above. `skip` leaves one side free (for a landmark or a terrace).
 */
function lots(w: number, h: number, seed: number, skip?: 'south' | 'north'): Lot[] {
  const out: Lot[] = [];
  const depth = Math.max(8, Math.min(15, Math.min(w, h) * 0.26));
  const run = (x0: number, x1: number, along: (a: number, b: number, d: number) => Lot) => {
    let a = x0;
    let k = 0;
    while (a < x1 - 4) {
      const size = Math.min(x1 - a, 8 + (wobble(seed, k, 3) + 1) * 7);
      const d = depth * (0.82 + (wobble(seed, k, 4) + 1) * 0.12);
      out.push(along(a, a + size - 1.2, d));
      a += size;
      k++;
    }
  };
  const hw = w / 2;
  const hh = h / 2;
  if (skip !== 'north') run(-hw, hw, (a, b, d) => ({ x: a, y: -hh, w: b - a, h: d }));
  if (skip !== 'south') run(-hw, hw, (a, b, d) => ({ x: a, y: hh - d, w: b - a, h: d }));
  const top = skip === 'north' ? -hh : -hh + depth + 1.2;
  const bottom = skip === 'south' ? hh : hh - depth - 1.2;
  run(top, bottom, (a, b, d) => ({ x: -hw, y: a, w: d, h: b - a }));
  run(top, bottom, (a, b, d) => ({ x: hw - d, y: a, w: d, h: b - a }));
  // Now and then a small building in the courtyard.
  if (wobble(seed, 9, 9) > 0.2 && w > 50 && h > 50 && !skip) {
    out.push({ x: -8 + wobble(seed, 1, 1) * 6, y: -6 + wobble(seed, 2, 2) * 6, w: 14, h: 10 });
  }
  return out;
}

function Lots({ items }: { items: Lot[] }) {
  return (
    <G>
      {items.map((l, i) => (
        <Rect key={i} x={f(l.x)} y={f(l.y)} width={f(Math.max(1, l.w))} height={f(Math.max(1, l.h))} fill={P.building} stroke={P.buildingEdge} strokeWidth={0.5} />
      ))}
    </G>
  );
}

/** The named building, in a darker tone and its own shape, filling the south part of the block. */
function Landmark({ kind, w, h }: { kind: PlaceKind; w: number; h: number }) {
  const hw = w / 2 - 2;
  const top = -h / 2 + Math.max(10, h * 0.3);
  const bottom = h / 2 - 2;
  const style = { fill: P.landmark, stroke: P.landmarkEdge, strokeWidth: 0.8 };
  const detail = { stroke: P.landmarkEdge, strokeWidth: 0.6, fill: 'none' };
  const midY = (top + bottom) / 2;
  switch (kind) {
    case 'hotel':
      return <Path d={`M${-hw} ${top} H${hw} V${bottom} H${hw * 0.15} V${midY} H${-hw} Z`} {...style} />;
    case 'museum':
      return (
        <G>
          <Rect x={-hw} y={top} width={hw * 2} height={bottom - top} {...style} />
          <Circle cx={0} cy={midY} r={Math.min(hw, (bottom - top) / 2) * 0.5} {...detail} />
          <Circle cx={0} cy={midY} r={Math.min(hw, (bottom - top) / 2) * 0.28} {...detail} />
        </G>
      );
    case 'bank':
      return (
        <G>
          <Rect x={-hw * 0.85} y={top} width={hw * 1.7} height={bottom - top} {...style} />
          <Path d={`M${-hw * 0.85} ${bottom - 5} H${hw * 0.85}`} {...detail} />
        </G>
      );
    case 'station':
      return (
        <G>
          <Path d={`M${-hw} ${top + 5} Q0 ${top - 4} ${hw} ${top + 5} V${bottom} H${-hw} Z`} {...style} />
          {[-0.5, 0, 0.5].map((t) => (
            <Path key={t} d={`M${hw * t} ${top + 3} V${bottom}`} {...detail} />
          ))}
        </G>
      );
    case 'theatre':
      return <Path d={`M${-hw * 0.8} ${bottom} V${midY} A${hw * 0.8} ${(bottom - top) / 2} 0 0 1 ${hw * 0.8} ${midY} V${bottom} Z`} {...style} />;
    case 'supermarket':
      return (
        <G>
          <Rect x={-hw} y={top} width={hw * 2} height={(bottom - top) * 0.55} {...style} />
          <Rect x={-hw} y={top + (bottom - top) * 0.6} width={hw * 2} height={(bottom - top) * 0.4} fill="#E4E1DA" />
          {Array.from({ length: 6 }, (_, i) => (
            <Path key={i} d={`M${-hw + 4 + i * ((hw * 2 - 8) / 5)} ${top + (bottom - top) * 0.62} v${(bottom - top) * 0.16}`} stroke="#FFFFFF" strokeWidth={0.8} />
          ))}
        </G>
      );
    case 'cafe':
    case 'restaurant':
      return (
        <G>
          <Rect x={-hw} y={top} width={hw * 2} height={(bottom - top) * 0.55} {...style} />
          {Array.from({ length: 5 }, (_, i) => (
            <Circle key={i} cx={-hw + 6 + i * ((hw * 2 - 12) / 4)} cy={top + (bottom - top) * 0.78} r={2.2} fill={P.landmark} />
          ))}
        </G>
      );
    case 'market':
      return (
        <G>
          {[0, 1, 2].map((row) =>
            Array.from({ length: 4 }, (_, col) => (
              <Rect key={`${row}${col}`} x={-hw + 2 + col * ((hw * 2 - 4) / 4)} y={top + row * ((bottom - top) / 3)} width={(hw * 2 - 4) / 4 - 2.5} height={(bottom - top) / 3 - 3} {...style} />
            )),
          )}
        </G>
      );
    case 'gallery':
      return (
        <G>
          <Rect x={-hw} y={top} width={hw * 2} height={bottom - top} {...style} />
          {[-0.5, 0, 0.5].map((t) => (
            <Path key={t} d={`M${hw * t - 6} ${bottom - 3} L${hw * t} ${top + 4} L${hw * t + 6} ${bottom - 3}`} {...detail} />
          ))}
        </G>
      );
    default:
      return <Path d={`M${-hw} ${top} H${hw - 12} V${top + 9} H${hw} V${bottom} H${-hw} Z`} {...style} />;
  }
}

function Trees({ w, h, seed, count, avoid }: { w: number; h: number; seed: number; count: number; avoid?: (x: number, y: number) => boolean }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const x = wobble(seed, i, 5) * (w / 2 - 4);
    const y = wobble(seed, i, 6) * (h / 2 - 4);
    if (avoid?.(x, y)) continue;
    const r = 2.6 + (wobble(seed, i, 7) + 1) * 1.3;
    out.push(<Circle key={i} cx={f(x)} cy={f(y)} r={f(r)} fill={i % 3 ? P.treeA : P.treeB} />);
  }
  return <G>{out}</G>;
}

function Park({ w, h, seed }: { w: number; h: number; seed: number }) {
  const hw = w / 2;
  const hh = h / 2;
  const pond = { x: hw * 0.3, y: -hh * 0.3, rx: Math.min(18, w * 0.18), ry: Math.min(11, h * 0.14) };
  return (
    <G>
      <Path d={`M${-hw} ${hh * 0.45} C ${-hw * 0.3} ${hh * 0.05}, ${hw * 0.1} ${hh * 0.85}, ${hw} ${hh * 0.25}`} stroke={P.path} strokeWidth={2.2} fill="none" />
      <Path d={`M${-hw * 0.15} ${-hh} C ${-hw * 0.35} ${-hh * 0.2}, ${hw * 0.25} ${hh * 0.2}, ${hw * 0.05} ${hh}`} stroke={P.path} strokeWidth={1.8} fill="none" />
      <Path
        d={`M${pond.x - pond.rx} ${pond.y} C ${pond.x - pond.rx} ${pond.y - pond.ry * 1.2}, ${pond.x + pond.rx * 0.6} ${pond.y - pond.ry * 1.3}, ${pond.x + pond.rx} ${pond.y - pond.ry * 0.2} S ${pond.x - pond.rx * 0.2} ${pond.y + pond.ry * 1.4}, ${pond.x - pond.rx} ${pond.y} Z`}
        fill={P.water}
        stroke={P.shore}
        strokeWidth={0.6}
      />
      <Trees w={w} h={h} seed={seed} count={Math.round((w * h) / 160)} avoid={(x, y) => Math.hypot((x - pond.x) / (pond.rx + 4), (y - pond.y) / (pond.ry + 4)) < 1} />
    </G>
  );
}

function Square({ w, h }: { w: number; h: number }) {
  const r = Math.min(w, h) / 2 - 4;
  return (
    <G>
      <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={P.paving} />
      <Circle cx={0} cy={0} r={r} fill="none" stroke={P.pavingLine} strokeWidth={0.8} />
      <Circle cx={0} cy={0} r={r * 0.55} fill="none" stroke={P.pavingLine} strokeWidth={0.8} />
      {[0, 45, 90, 135].map((a) => (
        <Path key={a} d={`M${-r} 0 H${r}`} stroke={P.pavingLine} strokeWidth={0.6} transform={`rotate(${a})`} />
      ))}
      <Circle cx={0} cy={0} r={6} fill={P.water} stroke={P.shore} strokeWidth={0.8} />
      {[-1, 1].map((sx) => [-1, 1].map((sy) => <Circle key={`${sx}${sy}`} cx={sx * (w / 2 - 5)} cy={sy * (h / 2 - 5)} r={3.6} fill={P.treeB} />))}
    </G>
  );
}

function Block({ town, place }: { town: TownSpec; place: Place }) {
  const span = place.span ?? [1, 1];
  const m = margin(town, place.block);
  const ground = inset(outline(town, place.block, span), m);
  const { centre, width, height, angle } = frame(town, place.block, span, m + 2);
  const seed = place.block[0] * 7 + place.block[1] * 13 + 1;
  const green = place.kind === 'park';
  const inner =
    place.kind === 'park' ? (
      <Park w={width} h={height} seed={seed} />
    ) : place.kind === 'square' ? (
      <Square w={width} h={height} />
    ) : (
      <>
        <Lots items={lots(width, height, seed, 'south')} />
        <Landmark kind={place.kind} w={width} h={height} />
      </>
    );
  return (
    <G>
      <Path d={soft(ground, 3)} fill={green ? P.park : place.kind === 'square' ? P.paving : P.fabric} stroke={green ? P.parkEdge : 'none'} strokeWidth={0.8} />
      <G transform={`translate(${f(centre.x)} ${f(centre.y)}) rotate(${angle.toFixed(2)})`}>{inner}</G>
    </G>
  );
}

/** Ordinary blocks around the playing area, so the town runs on past the edge of the map. */
function OuterBlocks({ town }: { town: TownSpec }) {
  const out: ReactNode[] = [];
  for (let c = -1; c < SIZE; c++) {
    for (let r = -1; r < SIZE; r++) {
      if (c >= 0 && r >= 0 && c < SIZE - 1 && r < SIZE - 1) continue;
      const m = MINOR / 2 + 2.5;
      const ground = inset(outline(town, [c, r], [1, 1]), m);
      const { centre, width, height, angle } = frame(town, [c, r], [1, 1], m + 2);
      const seed = (c + 3) * 31 + (r + 3) * 17;
      const green = wobble(c, r, 40) > 0.65;
      out.push(
        <G key={`${c},${r}`}>
          <Path d={soft(ground, 3)} fill={green ? P.park : P.fabric} />
          <G transform={`translate(${f(centre.x)} ${f(centre.y)}) rotate(${angle.toFixed(2)})`}>
            {green ? <Trees w={width} h={height} seed={seed} count={Math.round((width * height) / 220)} /> : <Lots items={lots(width, height, seed)} />}
          </G>
        </G>,
      );
    }
  }
  return <G>{out}</G>;
}

// ---- streets --------------------------------------------------------------------------------

type Street = { name: string; major: boolean; points: XY[]; nodes: (Point | null)[] };

function streets(town: TownSpec): Street[] {
  const out: Street[] = [];
  for (let r = 0; r < SIZE; r++) {
    const nodes: Point[] = Array.from({ length: SIZE }, (_, c) => [c, r] as Point);
    out.push({
      name: town.streetsH[r],
      major: isMajorH(town, r),
      points: [nodeXY(town, [-1, r]), ...nodes.map((p) => nodeXY(town, p)), nodeXY(town, [SIZE, r])],
      nodes: [null, ...nodes, null],
    });
  }
  for (let c = 0; c < SIZE; c++) {
    const nodes: Point[] = Array.from({ length: SIZE }, (_, r) => [c, r] as Point);
    out.push({
      name: town.streetsV[c],
      major: isMajorV(town, c),
      points: [nodeXY(town, [c, -1]), ...nodes.map((p) => nodeXY(town, p)), nodeXY(town, [c, SIZE])],
      nodes: [null, ...nodes, null],
    });
  }
  return out;
}

function runs(street: Street, closed: Set<string>): [number, number][] {
  const out: [number, number][] = [];
  let start = 0;
  for (let i = 0; i < street.points.length - 1; i++) {
    const a = street.nodes[i];
    const b = street.nodes[i + 1];
    if (a && b && closed.has(segmentKey(a, b))) {
      if (i > start) out.push([start, i]);
      start = i + 1;
    }
  }
  if (start < street.points.length - 1) out.push([start, street.points.length - 1]);
  return out;
}

const short = (name: string) => name.replace(/ Street$/, ' St').replace(/ Avenue$/, ' Ave').replace(/ Road$/, ' Rd').replace(/ Lane$/, ' Ln');

/** Text with a white halo, so it stays legible over roads and buildings. */
function Halo({ x, y, size, color, weight = '600', family = fonts.displayBold, children, spacing = 0.2 }: {
  x: number;
  y: number;
  size: number;
  color: string;
  weight?: '500' | '600' | '700';
  family?: string;
  children: string;
  spacing?: number;
}) {
  const common = { x, y, fontSize: size, fontFamily: family, fontWeight: weight, textAnchor: 'middle' as const, letterSpacing: spacing };
  return (
    <G>
      <SvgText {...common} fill={P.halo} stroke={P.halo} strokeWidth={2.6} strokeLinejoin="round">
        {children}
      </SvgText>
      <SvgText {...common} fill={color}>
        {children}
      </SvgText>
    </G>
  );
}

function Water({ side }: { side: NonNullable<TownSpec['water']> }) {
  // A soft shoreline with a slightly deeper channel, not a ruler edge.
  const depth = (k: number) => 24 + 7 * Math.sin(k / 47) + 4 * Math.sin(k / 17 + 1);
  const pts = Array.from({ length: 25 }, (_, i) => i * 15);
  const line = (d: (k: number) => number) =>
    side === 'north'
      ? pts.map((x) => ({ x, y: d(x) }))
      : side === 'south'
        ? pts.map((x) => ({ x, y: VIEW - d(x) }))
        : side === 'west'
          ? pts.map((y) => ({ x: d(y), y }))
          : pts.map((y) => ({ x: VIEW - d(y), y }));
  const edge = line(depth);
  const corners: Record<string, string> = {
    north: `L${VIEW} 0 L0 0 Z`,
    south: `L${VIEW} ${VIEW} L0 ${VIEW} Z`,
    west: `L0 ${VIEW} L0 0 Z`,
    east: `L${VIEW} ${VIEW} L${VIEW} 0 Z`,
  };
  const close = side === 'south' || side === 'east' ? corners[side] : corners[side];
  const shape = `${curve(edge, 0, edge.length - 1)} ${close}`;
  const deep = line((k) => depth(k) * 0.45);
  return (
    <G>
      <Path d={shape} fill={P.water} />
      <Path d={curve(edge, 0, edge.length - 1)} stroke={P.shore} strokeWidth={0.8} fill="none" />
      <Path d={`${curve(deep, 0, deep.length - 1)} ${close}`} fill={P.waterDeep} opacity={0.5} />
    </G>
  );
}

function Roundabout({ at }: { at: XY }) {
  return (
    <G>
      <Circle cx={at.x} cy={at.y} r={15 + CASING} fill={P.casingMajor} />
      <Circle cx={at.x} cy={at.y} r={15} fill={P.roadMajor} />
      <Circle cx={at.x} cy={at.y} r={8.5 + CASING} fill={P.casing} />
      <Circle cx={at.x} cy={at.y} r={8.5} fill={P.park} />
      <Circle cx={at.x} cy={at.y} r={3} fill={P.treeB} />
    </G>
  );
}

function TrafficLights({ at }: { at: XY }) {
  // Two signal heads on opposite corners, small and dark like on a real map legend.
  return (
    <G>
      {[-1, 1].map((s) => (
        <G key={s}>
          <Rect x={f(at.x + s * 9.5 - 1.6)} y={f(at.y + s * 9.5 - 3.6)} width={3.2} height={7.2} rx={1.4} fill="#4A5157" />
          <Circle cx={f(at.x + s * 9.5)} cy={f(at.y + s * 9.5 - 1.8)} r={0.9} fill="#E1705C" />
          <Circle cx={f(at.x + s * 9.5)} cy={f(at.y + s * 9.5 + 1.8)} r={0.9} fill="#7BC490" />
        </G>
      ))}
    </G>
  );
}

/** Everything that doesn't move: drawn once per town, not on every step of the walker. */
const StaticMap = memo(function StaticMap({ town }: { town: TownSpec }) {
  const closed = closedSegments(town);
  const all = streets(town);
  const sorted = [...all].sort((a, b) => Number(a.major) - Number(b.major));
  return (
    <G>
      <Rect x={0} y={0} width={VIEW} height={VIEW} fill={P.land} />
      <OuterBlocks town={town} />
      {town.places.map((p) => (
        <Block key={p.id} town={town} place={p} />
      ))}
      {town.water ? <Water side={town.water} /> : null}
      {/* Casings first, then road surfaces, minor roads under main roads. */}
      {sorted.map((s, i) =>
        runs(s, closed).map(([a, b]) => (
          <Path key={`c${i}-${a}`} d={curve(s.points, a, b)} stroke={s.major ? P.casingMajor : P.casing} strokeWidth={(s.major ? MAJOR : MINOR) + CASING * 2} fill="none" strokeLinecap="butt" strokeLinejoin="round" />
        )),
      )}
      {sorted.map((s, i) =>
        runs(s, closed).map(([a, b]) => (
          <Path key={`r${i}-${a}`} d={curve(s.points, a, b)} stroke={s.major ? P.roadMajor : P.road} strokeWidth={s.major ? MAJOR : MINOR} fill="none" strokeLinecap="butt" strokeLinejoin="round" />
        )),
      )}
      {town.roundabout ? <Roundabout at={nodeXY(town, town.roundabout)} /> : null}
      {(town.lights ?? []).map((p, k) => (
        <TrafficLights key={k} at={nodeXY(town, p)} />
      ))}
      {/* Street names along the road. */}
      {all.map((s, i) => {
        const open = [2, 1, 3].filter((k) => {
          const a = s.nodes[k];
          const b = s.nodes[k + 1];
          return a && b && !closed.has(segmentKey(a, b));
        });
        if (open.length === 0) return null;
        const k = open[i % 2 && open.length > 1 ? 1 : 0];
        const a = s.points[k];
        const b = s.points[k + 1];
        const mid = lerp(a, b, 0.5);
        let angle = deg(sub(b, a));
        if (angle > 90) angle -= 180;
        else if (angle < -90) angle += 180;
        if (i >= SIZE) angle = deg(sub(a, b));
        return (
          <G key={`t${i}`} transform={`translate(${f(mid.x)} ${f(mid.y)}) rotate(${angle.toFixed(2)})`}>
            <Halo x={0} y={2.6} size={s.major ? 7.6 : 7} color={P.label} weight="500" family={fonts.displayMedium} spacing={0.5}>
              {short(s.name)}
            </Halo>
          </G>
        );
      })}
      {/* Named places: a small marker and the name. */}
      {town.places.map((p) => {
        const { centre, height } = frame(town, p.block, p.span ?? [1, 1], margin(town, p.block) + 2);
        const y = p.kind === 'park' || p.kind === 'square' ? centre.y + 2 : centre.y + height * 0.18;
        return (
          <G key={`p${p.id}`}>
            <Circle cx={f(centre.x)} cy={f(y - 9)} r={3.4} fill={POI[p.kind]} stroke={P.halo} strokeWidth={1.2} />
            <Halo x={centre.x} y={y + 2} size={8} color={P.poiText}>
              {p.name}
            </Halo>
          </G>
        );
      })}
      <ScaleAndNorth />
    </G>
  );
});

function ScaleAndNorth() {
  return (
    <G>
      <Path d={`M12 ${VIEW - 12} v-3 M12 ${VIEW - 12} H52 v-3`} stroke="#6B7177" strokeWidth={1} fill="none" />
      <SvgText x={32} y={VIEW - 16} fontSize={6.5} fontFamily={fonts.displayMedium} fill="#6B7177" textAnchor="middle">
        100 m
      </SvgText>
      <G>
        <Circle cx={VIEW - 16} cy={16} r={9} fill="rgba(255,255,255,0.9)" stroke={P.casing} strokeWidth={0.8} />
        <Path d={`M${VIEW - 16} 9.5 l2.6 7 h-5.2 z`} fill={colors.ink} />
        <SvgText x={VIEW - 16} y={23.2} fontSize={5.5} fontFamily={fonts.displayBold} fill={colors.ink} textAnchor="middle">
          N
        </SvgText>
      </G>
    </G>
  );
}

const ROTATION: Record<Heading, number> = { N: 0, E: 90, S: 180, W: 270 };

/** You are here: the location puck of a map app, with a soft beam where you're facing. */
function Walker({ x, y, heading }: { x: number; y: number; heading: Heading }) {
  return (
    <G>
      <G transform={`rotate(${ROTATION[heading]} ${f(x)} ${f(y)})`}>
        <Path d={`M${f(x)} ${f(y)} L${f(x - 11)} ${f(y - 24)} A26 26 0 0 1 ${f(x + 11)} ${f(y - 24)} Z`} fill="rgba(35,42,49,0.16)" />
      </G>
      <Circle cx={f(x)} cy={f(y)} r={8.5} fill="#FFFFFF" stroke="rgba(35,42,49,0.25)" strokeWidth={0.8} />
      <Circle cx={f(x)} cy={f(y)} r={5.6} fill={colors.yellow} stroke={colors.ink} strokeWidth={1.6} />
    </G>
  );
}

function GoalPin({ at }: { at: XY }) {
  return (
    <G>
      <Path d={`M${f(at.x)} ${f(at.y)} c-5 -6 -8 -9.5 -8 -14 a8 8 0 0 1 16 0 c0 4.5 -3 8 -8 14z`} fill={colors.ink} stroke="#FFFFFF" strokeWidth={1.2} />
      <Circle cx={f(at.x)} cy={f(at.y - 14)} r={3} fill="#FFFFFF" />
    </G>
  );
}

export type WalkerState = { x: number; y: number; heading: Heading };

export function TownMap({ town, walker, trail, trailColor, goal, size }: {
  town: TownSpec;
  walker: WalkerState;
  trail: Point[];
  trailColor: string;
  goal?: string | null;
  size: number;
}) {
  const staticLayer = useMemo(() => <StaticMap town={town} />, [town]);
  const goalPlace = goal ? town.places.find((p) => p.id === goal) : undefined;
  const pin = goalPlace ? frame(town, goalPlace.block, goalPlace.span ?? [1, 1], margin(town, goalPlace.block) + 2).centre : null;
  const route = trail.map((p) => nodeXY(town, p)).map((xy) => `${f(xy.x)},${f(xy.y)}`).join(' ');
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} accessible accessibilityLabel="Şehir haritası">
      {staticLayer}
      {trail.length > 1 ? (
        <G>
          <Polyline points={route} stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Polyline points={route} stroke={trailColor} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>
      ) : null}
      {pin ? <GoalPin at={{ x: pin.x, y: pin.y - 14 }} /> : null}
      <Walker x={walker.x} y={walker.y} heading={walker.heading} />
    </Svg>
  );
}
