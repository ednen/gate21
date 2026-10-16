import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { closedSegments, type Heading, type Place, type PlaceKind, type Point, segmentKey, SIZE, type TownSpec } from '@/lib/directions';
import { colors, fonts } from '@/theme';

/*
 * A town drawn like an illustrated tourist map. The streets follow the 4×4 grid of crossings
 * the game walks on, but the crossings sit at uneven, slightly wandering positions, so streets
 * bend and blocks are irregular. Buildings vary in shape (an L-shaped hotel, a domed museum,
 * a station with a curved roof), big parks swallow a street, and the town has a square,
 * traffic lights, parked cars and a bus.
 */
export const VIEW = 360;
const RW = 20;
const CURB = 3;

const C = {
  ground: '#D9D7CC',
  asphalt: '#6C747B',
  asphaltEdge: '#596067',
  marking: '#ECEDE8',
  lawn: '#BBD3A2',
  lawnDark: '#A4C48B',
  tree: '#6E9F57',
  treeLight: '#86B56C',
  shade: 'rgba(35,42,49,0.18)',
  water: '#8DC0D6',
  waterEdge: '#6FA6BE',
  path: '#EAE3CD',
  paving: '#E6DFCB',
  pavingLine: '#D3CAB1',
  label: '#F4F4EF',
};

type Look = { roof: string; facade: string; trim: string; sign: string; signText: string };
const LOOK: Record<PlaceKind, Look> = {
  hotel: { roof: '#C9674D', facade: '#9C4934', trim: '#F2D9C9', sign: '#232A31', signText: '#FFC72C' },
  bank: { roof: '#CBD0D5', facade: '#98A1A9', trim: '#F4F5F6', sign: '#2F3740', signText: '#FFFFFF' },
  museum: { roof: '#DCCDA8', facade: '#B2A07A', trim: '#F7F0DE', sign: '#5B4A2B', signText: '#FFFFFF' },
  cafe: { roof: '#E3B27C', facade: '#B57A45', trim: '#FFF4E3', sign: '#3D2A1A', signText: '#FFFFFF' },
  pharmacy: { roof: '#E7ECEE', facade: '#B9C3C8', trim: '#FFFFFF', sign: '#2E7D4F', signText: '#FFFFFF' },
  post: { roof: '#C4473B', facade: '#8D2F27', trim: '#F3D4CF', sign: '#FFC72C', signText: '#232A31' },
  supermarket: { roof: '#A1BAC3', facade: '#6D8B97', trim: '#E8F0F3', sign: '#1F5FA8', signText: '#FFFFFF' },
  station: { roof: '#5E6F7F', facade: '#3F4E5C', trim: '#DCE3EA', sign: '#FFFFFF', signText: '#232A31' },
  theatre: { roof: '#9C7464', facade: '#6E4A3E', trim: '#F1DED6', sign: '#232A31', signText: '#FFC72C' },
  restaurant: { roof: '#D9905D', facade: '#A6633A', trim: '#FBE6D5', sign: '#2E5E3F', signText: '#FFFFFF' },
  gallery: { roof: '#E7E4DB', facade: '#B6B1A3', trim: '#FFFFFF', sign: '#232A31', signText: '#FFFFFF' },
  market: { roof: '#D9D3BE', facade: '#B3AA8C', trim: '#FFFFFF', sign: '#232A31', signText: '#FFFFFF' },
  park: { roof: C.lawn, facade: C.lawnDark, trim: '#FFFFFF', sign: '#2E5E3F', signText: '#FFFFFF' },
  square: { roof: C.paving, facade: C.pavingLine, trim: '#FFFFFF', sign: '#232A31', signText: '#FFFFFF' },
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

/** A stable small number from a crossing, so the same map always wanders the same way. */
function wobble(c: number, r: number, k: number): number {
  const v = Math.sin(c * 12.9898 + r * 78.233 + k * 37.719) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

/** Where a crossing is drawn. */
export function nodeXY(town: TownSpec, [c, r]: Point): XY {
  const cols = town.cols ?? [36, 132, 228, 324];
  const rows = town.rows ?? [36, 132, 228, 324];
  const bend = town.bend ?? 0;
  return { x: cols[c] + bend * wobble(c, r, 1), y: rows[r] + bend * wobble(c, r, 2) };
}

/** A point past the map edge that continues a street outwards. */
function beyond(town: TownSpec, a: Point, inward: Point): XY {
  const p = nodeXY(town, a);
  const q = nodeXY(town, inward);
  return add(p, mul(unit(sub(p, q)), 60));
}

/** Smooth curve through points (Catmull–Rom as cubic Béziers), from point i to point j. */
function curve(points: XY[], from: number, to: number): string {
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  let d = `M${at(from).x.toFixed(1)} ${at(from).y.toFixed(1)}`;
  for (let i = from; i < to; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = add(p1, mul(sub(p2, p0), 1 / 6));
    const c2 = sub(p2, mul(sub(p3, p1), 1 / 6));
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** A polygon moved inwards by d (mitred), used to cut blocks out from between the streets. */
function inset(poly: XY[], d: number): XY[] {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
  }
  const sign = area > 0 ? 1 : -1;
  return poly.map((p, i) => {
    const prev = poly[(i - 1 + n) % n];
    const next = poly[(i + 1) % n];
    const n1 = unit({ x: -(p.y - prev.y) * sign, y: (p.x - prev.x) * sign });
    const n2 = unit({ x: -(next.y - p.y) * sign, y: (next.x - p.x) * sign });
    const bis = unit(add(n1, n2));
    const cos = Math.max(0.5, bis.x * n1.x + bis.y * n1.y);
    return add(p, mul(bis, d / cos));
  });
}

const pts = (poly: XY[]) => poly.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/** The crossings around a block region, clockwise from its north-west corner. */
function outline(town: TownSpec, [c, r]: Point, [w, h]: Point): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < w; i++) out.push(nodeXY(town, [c + i, r]));
  for (let j = 0; j < h; j++) out.push(nodeXY(town, [c + w, r + j]));
  for (let i = w; i > 0; i--) out.push(nodeXY(town, [c + i, r + h]));
  for (let j = h; j > 0; j--) out.push(nodeXY(town, [c, r + j]));
  return out;
}

/** A local frame for drawing inside a block: centre, size and the angle of its north edge. */
function frame(town: TownSpec, block: Point, span: Point) {
  const [c, r] = block;
  const [w, h] = span;
  const nw = nodeXY(town, [c, r]);
  const ne = nodeXY(town, [c + w, r]);
  const se = nodeXY(town, [c + w, r + h]);
  const sw = nodeXY(town, [c, r + h]);
  const centre = mul(add(add(nw, ne), add(se, sw)), 0.25);
  const width = (len(sub(ne, nw)) + len(sub(se, sw))) / 2 - RW - CURB * 2;
  const height = (len(sub(sw, nw)) + len(sub(se, ne))) / 2 - RW - CURB * 2;
  const angle = (deg(sub(ne, nw)) + deg(sub(se, sw))) / 2;
  return { centre, width, height, angle };
}

// ---- small things ---------------------------------------------------------------------------

function Tree({ x, y, r = 6 }: { x: number; y: number; r?: number }) {
  return (
    <G>
      <Circle cx={x + 1.6} cy={y + 2} r={r} fill={C.shade} />
      <Circle cx={x} cy={y} r={r} fill={C.tree} />
      <Circle cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.45} fill={C.treeLight} />
    </G>
  );
}

function Plaque({ x, y, text, look }: { x: number; y: number; text: string; look: Look }) {
  const width = Math.max(30, text.length * 4.6 + 10);
  return (
    <G>
      <Rect x={x - width / 2} y={y - 6.5} width={width} height={13} rx={2} fill={look.sign} />
      <SvgText x={x} y={y + 3} fontSize={8.6} fontFamily={fonts.display} fontWeight="700" fill={look.signText} textAnchor="middle">
        {text}
      </SvgText>
    </G>
  );
}

function Bench({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  return <Rect x={x - 5} y={y - 1.5} width={10} height={3} rx={1} fill="#8A6A4A" transform={`rotate(${rotate} ${x} ${y})`} />;
}

function Car({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <G transform={`rotate(${angle.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`}>
      <Rect x={x - 6} y={y - 2.4} width={14} height={7.2} rx={2.4} fill="rgba(0,0,0,0.25)" />
      <Rect x={x - 7} y={y - 3.6} width={14} height={7.2} rx={2.4} fill={color} />
      <Rect x={x + 0.5} y={y - 2.6} width={3.5} height={5.2} rx={1} fill="#D6E4EC" />
      <Rect x={x - 5} y={y - 2.6} width={2.5} height={5.2} rx={1} fill="#D6E4EC" opacity={0.8} />
    </G>
  );
}

function Bus({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <G transform={`rotate(${angle.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`}>
      <Rect x={x - 14} y={y - 3.1} width={30} height={9} rx={2.5} fill="rgba(0,0,0,0.25)" />
      <Rect x={x - 15} y={y - 4.5} width={30} height={9} rx={2.5} fill={colors.red} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Rect key={i} x={x - 12 + i * 5.4} y={y - 3.2} width={3.6} height={6.4} rx={0.8} fill="#F6D9D4" />
      ))}
    </G>
  );
}

function TrafficLight({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Rect x={x - 1.6} y={y - 5.8} width={5.6} height={14} rx={2} fill="rgba(0,0,0,0.22)" />
      <Rect x={x - 2.8} y={y - 7} width={5.6} height={14} rx={2} fill={colors.ink} />
      <Circle cx={x} cy={y - 3.8} r={1.5} fill="#E5533D" />
      <Circle cx={x} cy={y} r={1.5} fill="#F2B705" />
      <Circle cx={x} cy={y + 3.8} r={1.5} fill="#4CC07A" />
    </G>
  );
}

// ---- blocks ---------------------------------------------------------------------------------

/** What stands on a block, drawn in the block's own frame (centred at 0,0, w × h). */
function Building({ place, w, h }: { place: Place; w: number; h: number }) {
  const look = LOOK[place.kind];
  const hw = w / 2;
  const hh = h / 2;
  const plaqueY = hh - 8;
  const top = -hh + 4;
  const bottom = hh - 18;
  const fh = 9;
  const facade = (x: number, y: number, width: number) => (
    <G>
      <Rect x={x} y={y} width={width} height={fh} fill={look.facade} />
      {Array.from({ length: Math.max(1, Math.floor((width - 4) / 8)) }, (_, i) => (
        <Rect key={i} x={x + 4 + i * 8} y={y + 2.5} width={4.5} height={4.5} fill={look.trim} opacity={0.85} />
      ))}
    </G>
  );
  const shadow = (d: string) => <Path d={d} fill={C.shade} transform="translate(2 3)" />;
  const trees = (
    <>
      <Tree x={hw - 5} y={hh - 4} r={4.5} />
      <Tree x={-hw + 5} y={hh - 4} r={4} />
    </>
  );

  switch (place.kind) {
    case 'hotel': {
      // An L: a main wing along the street and a short wing to the back.
      const x0 = -hw + 6;
      const x1 = hw - 6;
      const wing = (x1 - x0) * 0.42;
      const mid = top + (bottom - top) * 0.45;
      const d = `M${x0} ${top} H${x1} V${bottom} H${x1 - wing} V${mid} H${x0} Z`;
      return (
        <G>
          {shadow(d)}
          <Path d={d} fill={look.roof} />
          <Rect x={x0 + 6} y={top + 5} width={14} height={7} fill={look.trim} opacity={0.4} />
          {facade(x0, mid - fh, x1 - wing - x0)}
          {facade(x1 - wing, bottom - fh, wing)}
          <Tree x={x0 + 8} y={bottom - 4} r={5.5} />
          <Tree x={x0 + 22} y={bottom - 2} r={4.5} />
          <Plaque x={0} y={plaqueY} text={place.name} look={look} />
        </G>
      );
    }
    case 'museum':
    case 'bank': {
      const x0 = -hw + 8;
      const width = w - 16;
      const d = `M${x0} ${top} h${width} V${bottom} h${-width} Z`;
      const cy = (top + bottom - fh) / 2;
      const r = Math.min(width, bottom - top) / 3.2;
      return (
        <G>
          {shadow(d)}
          <Path d={d} fill={look.roof} />
          {place.kind === 'museum' ? (
            <>
              <Circle cx={0} cy={cy} r={r} fill={look.trim} opacity={0.8} />
              <Circle cx={0} cy={cy} r={r} fill="none" stroke={look.facade} strokeWidth={1} />
              <Line x1={0} y1={cy - r} x2={0} y2={cy + r} stroke={look.facade} strokeWidth={0.8} />
            </>
          ) : (
            <Path d={`M0 ${top + 4} L${width / 2 - 4} ${bottom - fh - 2} L${-width / 2 + 4} ${bottom - fh - 2} Z`} fill={look.trim} opacity={0.55} />
          )}
          <Rect x={x0} y={bottom - fh} width={width} height={fh} fill={look.facade} />
          {Array.from({ length: 6 }, (_, i) => (
            <Rect key={i} x={x0 + 3 + i * ((width - 8) / 5)} y={bottom - fh + 1} width={2.4} height={fh - 2} fill={look.trim} />
          ))}
          {trees}
          <Plaque x={0} y={plaqueY} text={place.name} look={look} />
        </G>
      );
    }
    case 'station': {
      // A long hall with a curved glass roof.
      const x0 = -hw + 5;
      const width = w - 10;
      const d = `M${x0} ${top + 6} Q0 ${top - 6} ${x0 + width} ${top + 6} V${bottom} H${x0} Z`;
      return (
        <G>
          {shadow(d)}
          <Path d={d} fill={look.roof} />
          {Array.from({ length: 5 }, (_, i) => (
            <Line key={i} x1={x0 + 6 + i * ((width - 12) / 4)} y1={top + 4} x2={x0 + 6 + i * ((width - 12) / 4)} y2={bottom - fh} stroke={look.trim} strokeWidth={1} opacity={0.5} />
          ))}
          {facade(x0, bottom - fh, width)}
          <Circle cx={0} cy={(top + bottom) / 2 - 3} r={7.5} fill={colors.surface} stroke={look.facade} strokeWidth={2} />
          <SvgText x={0} y={(top + bottom) / 2 + 0.5} fontSize={9} fontFamily={fonts.display} fontWeight="700" fill={look.facade} textAnchor="middle">
            S
          </SvgText>
          <Plaque x={0} y={plaqueY} text={place.name} look={look} />
        </G>
      );
    }
    case 'theatre': {
      // A round auditorium behind a lit marquee.
      const r = Math.min(w, bottom - top) / 2.4;
      return (
        <G>
          <Circle cx={2} cy={top + r + 3} r={r} fill={C.shade} />
          <Circle cx={0} cy={top + r} r={r} fill={look.roof} />
          <Circle cx={0} cy={top + r} r={r * 0.55} fill="none" stroke={look.trim} strokeWidth={1} opacity={0.6} />
          <Rect x={-hw + 10} y={bottom - fh} width={w - 20} height={fh} fill={look.facade} />
          {Array.from({ length: 8 }, (_, i) => (
            <Circle key={i} cx={-hw + 14 + i * ((w - 28) / 7)} cy={bottom - fh / 2} r={1.5} fill={colors.yellow} />
          ))}
          {trees}
          <Plaque x={0} y={plaqueY} text={place.name} look={look} />
        </G>
      );
    }
    case 'cafe':
    case 'restaurant': {
      // A narrow building at the back and a terrace of umbrellas in front.
      const x0 = -hw + 6;
      const width = w - 12;
      const back = top + (bottom - top) * 0.5;
      const d = `M${x0} ${top} h${width} V${back} h${-width} Z`;
      const brand = place.kind === 'cafe' ? colors.red : colors.green;
      return (
        <G>
          {shadow(d)}
          <Path d={d} fill={look.roof} />
          {facade(x0, back - fh, width)}
          {Array.from({ length: Math.floor(width / 5) }, (_, i) => (
            <Rect key={i} x={x0 + i * 5} y={back} width={2.5} height={4} fill={i % 2 ? '#FFFFFF' : brand} />
          ))}
          {[0, 1, 2].map((i) => (
            <G key={i}>
              <Circle cx={x0 + 10 + i * ((width - 20) / 2) + 1.2} cy={back + 14.5} r={6} fill={C.shade} />
              <Circle cx={x0 + 10 + i * ((width - 20) / 2)} cy={back + 13} r={6} fill={i % 2 ? brand : '#FFFFFF'} stroke={brand} strokeWidth={1} />
            </G>
          ))}
          <Plaque x={0} y={plaqueY} text={place.name} look={look} />
        </G>
      );
    }
    case 'supermarket': {
      // A big flat box and its car park.
      const x0 = -hw + 4;
      const width = w - 8;
      const back = top + (bottom - top) * 0.55;
      const d = `M${x0} ${top} h${width} V${back} h${-width} Z`;
      const lot = [colors.red, colors.blue];
      return (
        <G>
          {shadow(d)}
          <Path d={d} fill={look.roof} />
          {[0, 1, 2].map((i) => (
            <Rect key={i} x={x0 + 6 + i * (width / 3)} y={top + 4} width={width / 3 - 12} height={back - top - 16} fill={look.trim} opacity={0.45} />
          ))}
          {facade(x0, back - fh, width)}
          <Rect x={x0} y={back + 2} width={width} height={bottom - back + 4} fill="#8B9298" />
          {Array.from({ length: 5 }, (_, i) => (
            <Line key={i} x1={x0 + 4 + i * ((width - 8) / 4)} y1={back + 3} x2={x0 + 4 + i * ((width - 8) / 4)} y2={back + 11} stroke={C.marking} strokeWidth={0.8} />
          ))}
          {[0, 2].map((i, k) => (
            <Rect key={i} x={x0 + 6 + i * ((width - 8) / 4)} y={back + 4} width={7} height={11} rx={1.5} fill={lot[k]} />
          ))}
          <Plaque x={0} y={plaqueY} text={place.name} look={look} />
        </G>
      );
    }
    case 'market': {
      const stripes = [colors.red, colors.blue, colors.green, '#E3A21A'];
      return (
        <G>
          {[0, 1].map((row) =>
            [0, 1, 2].map((col) => {
              const sx = -hw + 6 + col * ((w - 12) / 3) + (row ? 6 : 0);
              const sy = top + 2 + row * 20;
              const fill = stripes[(row * 3 + col) % stripes.length];
              return (
                <G key={`${row}${col}`} transform={`rotate(${row ? -4 : 3} ${sx + 7} ${sy + 6})`}>
                  <Rect x={sx + 1.5} y={sy + 2} width={15} height={12} fill={C.shade} />
                  <Rect x={sx} y={sy} width={15} height={12} fill={fill} />
                  {[0, 1, 2].map((k) => (
                    <Rect key={k} x={sx + 2 + k * 5} y={sy} width={2.5} height={12} fill="#FFFFFF" opacity={0.8} />
                  ))}
                </G>
              );
            }),
          )}
          <Plaque x={0} y={plaqueY} text={place.name} look={look} />
        </G>
      );
    }
    default: {
      // A building with a notch out of one corner, so blocks don't all read as boxes.
      const x0 = -hw + 7;
      const x1 = hw - 7;
      const notch = 12;
      const d = `M${x0} ${top} H${x1 - notch} V${top + notch} H${x1} V${bottom} H${x0} Z`;
      const span = x1 - x0 - 8;
      return (
        <G>
          {shadow(d)}
          <Path d={d} fill={look.roof} />
          {place.kind === 'pharmacy' ? (
            <>
              <Rect x={-3} y={(top + bottom - fh) / 2 - 8} width={6} height={16} fill={colors.green} />
              <Rect x={-8} y={(top + bottom - fh) / 2 - 3} width={16} height={6} fill={colors.green} />
            </>
          ) : place.kind === 'gallery' ? (
            [0, 1, 2].map((i) => (
              <Path key={i} d={`M${x0 + 4 + i * (span / 3)} ${bottom - fh - 2} l${span / 6} ${-(bottom - top - fh - 8)} l${span / 6} ${bottom - top - fh - 8}`} fill={look.trim} opacity={0.6} />
            ))
          ) : (
            <Rect x={x0 + 6} y={top + 5} width={14} height={8} fill={look.trim} opacity={0.4} />
          )}
          {facade(x0, bottom - fh, x1 - x0)}
          {trees}
          <Tree x={x1 - 4} y={top + 4} r={4.5} />
          <Plaque x={0} y={plaqueY} text={place.name} look={look} />
        </G>
      );
    }
  }
}

/** A town square: paving, a fountain, benches and four trees. */
function Square({ place, w, h }: { place: Place; w: number; h: number }) {
  const r = Math.min(w, h) / 2 - 6;
  return (
    <G>
      <Circle cx={0} cy={-4} r={r} fill="none" stroke={C.pavingLine} strokeWidth={1} />
      <Circle cx={0} cy={-4} r={r * 0.62} fill="none" stroke={C.pavingLine} strokeWidth={1} />
      <Circle cx={0} cy={-4} r={9} fill="#CFC6AE" />
      <Circle cx={0} cy={-4} r={7} fill={C.water} />
      <Circle cx={0} cy={-4} r={2.4} fill="#E6F2F7" />
      <Bench x={-r * 0.62} y={-4} rotate={90} />
      <Bench x={r * 0.62} y={-4} rotate={90} />
      <Bench x={0} y={-4 - r * 0.62} />
      {[-1, 1].map((sx) => [-1, 1].map((sy) => <Tree key={`${sx}${sy}`} x={sx * (w / 2 - 7)} y={sy * (h / 2 - 7) - (sy > 0 ? 4 : 0)} r={5} />))}
      <Plaque x={0} y={h / 2 - 8} text={place.name} look={LOOK.square} />
    </G>
  );
}

/** A park: winding paths, a pond, trees and benches. Big parks get more of everything. */
function Park({ place, w, h }: { place: Place; w: number; h: number }) {
  const hw = w / 2;
  const hh = h / 2;
  const trees: [number, number, number][] = [];
  const count = Math.round((w * h) / 700);
  for (let i = 0; i < count; i++) {
    const tx = wobble(i, 3, 5) * 0.82 * (hw - 8);
    const ty = wobble(i, 7, 9) * 0.82 * (hh - 8);
    const pond = Math.hypot(tx - hw * 0.35, ty + hh * 0.3) < 22;
    const sign = Math.abs(tx) < 30 && ty > hh * 0.45;
    if (!pond && !sign) {
      trees.push([tx, ty, 4.5 + (wobble(i, 1, 2) + 1) * 1.5]);
    }
  }
  return (
    <G>
      <Path d={`M${-hw} ${hh * 0.4} C ${-hw * 0.3} ${-hh * 0.1}, ${hw * 0.1} ${hh * 0.9}, ${hw} ${hh * 0.2}`} stroke={C.path} strokeWidth={5} fill="none" strokeLinecap="round" />
      <Path d={`M${-hw * 0.1} ${-hh} C ${-hw * 0.3} ${-hh * 0.3}, ${hw * 0.2} ${hh * 0.2}, ${hw * 0.05} ${hh}`} stroke={C.path} strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path
        d={`M${hw * 0.22} ${-hh * 0.45} c 6 -9 22 -8 24 2 c 2 9 -8 14 -16 12 c -9 -2 -12 -6 -8 -14 z`}
        fill={C.water}
        stroke={C.waterEdge}
        strokeWidth={1}
      />
      {trees.map(([x, y, r], i) => (
        <Tree key={i} x={x} y={y} r={r} />
      ))}
      <Bench x={-hw * 0.35} y={hh * 0.2} rotate={-20} />
      <Bench x={hw * 0.55} y={hh * 0.35} rotate={10} />
      <Plaque x={0} y={hh * 0.68} text={place.name} look={LOOK.park} />
    </G>
  );
}

function Block({ town, place }: { town: TownSpec; place: Place }) {
  const span = place.span ?? [1, 1];
  const ground = inset(outline(town, place.block, span), RW / 2 + CURB);
  const { centre, width, height, angle } = frame(town, place.block, span);
  const fill = place.kind === 'square' ? C.paving : place.kind === 'market' ? '#E3DDCB' : C.lawn;
  const inner =
    place.kind === 'park' ? (
      <Park place={place} w={width} h={height} />
    ) : place.kind === 'square' ? (
      <Square place={place} w={width} h={height} />
    ) : (
      <Building place={place} w={width} h={height} />
    );
  return (
    <G>
      <Polygon points={pts(ground)} fill={fill} stroke={fill} strokeWidth={5} strokeLinejoin="round" />
      <G transform={`translate(${centre.x.toFixed(1)} ${centre.y.toFixed(1)}) rotate(${angle.toFixed(2)})`}>{inner}</G>
    </G>
  );
}

// ---- streets --------------------------------------------------------------------------------

type Street = { name: string; points: XY[]; nodes: (Point | null)[] };

/** Each street as a list of points: off the map, the four crossings, off the map again. */
function streets(town: TownSpec): Street[] {
  const out: Street[] = [];
  for (let r = 0; r < SIZE; r++) {
    const nodes: Point[] = Array.from({ length: SIZE }, (_, c) => [c, r] as Point);
    out.push({
      name: town.streetsH[r],
      points: [beyond(town, [0, r], [1, r]), ...nodes.map((p) => nodeXY(town, p)), beyond(town, [SIZE - 1, r], [SIZE - 2, r])],
      nodes: [null, ...nodes, null],
    });
  }
  for (let c = 0; c < SIZE; c++) {
    const nodes: Point[] = Array.from({ length: SIZE }, (_, r) => [c, r] as Point);
    out.push({
      name: town.streetsV[c],
      points: [beyond(town, [c, 0], [c, 1]), ...nodes.map((p) => nodeXY(town, p)), beyond(town, [c, SIZE - 1], [c, SIZE - 2])],
      nodes: [null, ...nodes, null],
    });
  }
  return out;
}

/** The open stretches of a street, as runs of point indices. */
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

/** Printed maps abbreviate street types. */
const short = (name: string) => name.replace(/ Street$/, ' St').replace(/ Avenue$/, ' Ave').replace(/ Road$/, ' Rd').replace(/ Lane$/, ' Ln');

function Water({ side }: { side: NonNullable<TownSpec['water']> }) {
  // A wavy shoreline, not a ruler edge.
  const shore = (k: number) => 12 + 6 * Math.sin(k / 38) + 3 * Math.sin(k / 13);
  const steps = Array.from({ length: 37 }, (_, i) => 360 - i * 10);
  const edge = {
    north: `M0 0 H${VIEW} ` + steps.map((x) => `L${x} ${shore(x).toFixed(1)}`).join(' '),
    south: `M0 ${VIEW} H${VIEW} ` + steps.map((x) => `L${x} ${(VIEW - shore(x)).toFixed(1)}`).join(' '),
    west: `M0 0 V${VIEW} ` + steps.map((y) => `L${shore(y).toFixed(1)} ${y}`).join(' '),
    east: `M${VIEW} 0 V${VIEW} ` + steps.map((y) => `L${(VIEW - shore(y)).toFixed(1)} ${y}`).join(' '),
  }[side];
  return (
    <G>
      <Path d={`${edge} Z`} fill={C.water} stroke={C.waterEdge} strokeWidth={1.2} />
      {[40, 130, 220, 310].map((t, i) => {
        const p = side === 'north' || side === 'south' ? { x: t, y: side === 'north' ? 7 : VIEW - 8 } : { x: side === 'west' ? 7 : VIEW - 8, y: t };
        return <Path key={i} d={`M${p.x - 6} ${p.y} q3 -3 6 0 t6 0`} stroke="#E6F2F7" strokeWidth={1.2} fill="none" />;
      })}
    </G>
  );
}

/** The rest of the city around the edges: rooftops and the odd tree, in muted colours. */
function Surroundings() {
  const roofs = ['#CBC6B5', '#C6C0AD', '#D1CCBC', '#C2BBA6'];
  const out: ReactNode[] = [];
  for (let gx = 0; gx < 14; gx++) {
    for (let gy = 0; gy < 15; gy++) {
      const x = gx * 27 - 6 + wobble(gx, gy, 21) * 4;
      const y = gy * 25 - 6 + wobble(gx, gy, 22) * 4;
      const roll = wobble(gx, gy, 23);
      if (roll > 0.55) {
        out.push(<Tree key={`${gx}-${gy}`} x={x + 10} y={y + 9} r={6} />);
      } else if (roll > -0.8) {
        out.push(<Rect key={`${gx}-${gy}`} x={x} y={y} width={19 + roll * 3} height={16} rx={1.5} fill={roofs[(gx + gy) % roofs.length]} />);
      }
    }
  }
  return <G>{out}</G>;
}

function Roundabout({ at }: { at: XY }) {
  const { x, y } = at;
  return (
    <G>
      <Circle cx={x} cy={y} r={22} fill={C.asphalt} />
      <Circle cx={x} cy={y} r={11} fill={C.lawn} stroke={C.marking} strokeWidth={1.5} />
      <Circle cx={x - 3} cy={y - 2} r={2} fill="#E3A21A" />
      <Circle cx={x + 3} cy={y + 2} r={2} fill={colors.red} />
      <Circle cx={x + 2} cy={y - 4} r={1.6} fill="#FFFFFF" />
      {/* Clockwise arrows on the ring, as traffic goes in the UK and Australia. */}
      {[0, 90, 180, 270].map((a) => (
        <Path key={a} d={`M${x + 16} ${y - 4} l3 4 l-4 1`} stroke={C.marking} strokeWidth={1.4} fill="none" transform={`rotate(${a} ${x} ${y})`} />
      ))}
    </G>
  );
}

function Compass() {
  return (
    <G>
      <Circle cx={VIEW - 18} cy={18} r={11} fill="rgba(255,255,255,0.88)" stroke={colors.ink} strokeWidth={1} />
      <Path d={`M${VIEW - 18} 9 l4 10 l-4 -2.5 l-4 2.5 z`} fill={colors.red} />
      <SvgText x={VIEW - 18} y={27} fontSize={6.5} fontFamily={fonts.display} fontWeight="700" fill={colors.ink} textAnchor="middle">
        N
      </SvgText>
    </G>
  );
}

const ROTATION: Record<Heading, number> = { N: 0, E: 90, S: 180, W: 270 };

/** The walker: a yellow marker with an arrow showing which way they face. */
function Walker({ x, y, heading }: { x: number; y: number; heading: Heading }) {
  return (
    <G>
      <Ellipse cx={x + 1.5} cy={y + 3} rx={9} ry={7} fill="rgba(35,42,49,0.3)" />
      <G transform={`rotate(${ROTATION[heading]} ${x} ${y})`}>
        <Circle cx={x} cy={y} r={9.5} fill={colors.yellow} stroke={colors.ink} strokeWidth={2.5} />
        <Path d={`M${x} ${y - 6} l5 7 h-3.2 v4 h-3.6 v-4 h-3.2 z`} fill={colors.ink} />
      </G>
    </G>
  );
}

function GoalPin({ town, place }: { town: TownSpec; place: Place }) {
  const { centre, height } = frame(town, place.block, place.span ?? [1, 1]);
  const cx = centre.x;
  const cy = centre.y - height / 2 + 14;
  return (
    <G>
      <Ellipse cx={cx} cy={cy + 2} rx={5} ry={2} fill="rgba(35,42,49,0.35)" />
      <Path d={`M${cx} ${cy} c-6 -8 -10 -12 -10 -18 a10 10 0 0 1 20 0 c0 6 -4 10 -10 18z`} fill={colors.red} stroke={colors.surface} strokeWidth={1.5} />
      <Circle cx={cx} cy={cy - 18} r={4} fill={colors.surface} />
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
  const goalPlace = goal ? town.places.find((p) => p.id === goal) : undefined;
  const closed = closedSegments(town);
  const all = streets(town);
  const isRound = (p: Point) => !!town.roundabout && town.roundabout[0] === p[0] && town.roundabout[1] === p[1];

  // Every crossing's open arms, for zebra crossings.
  const arms: { at: Point; to: Point }[] = [];
  for (let c = 0; c < SIZE; c++) {
    for (let r = 0; r < SIZE; r++) {
      const here: Point = [c, r];
      if (isRound(here)) {
        continue;
      }
      for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const to: Point = [c + dc, r + dr];
        const insideMap = to[0] >= 0 && to[1] >= 0 && to[0] < SIZE && to[1] < SIZE;
        if (insideMap && !closed.has(segmentKey(here, to))) {
          arms.push({ at: here, to });
        }
      }
    }
  }

  // A few parked cars and a bus, on open stretches between crossings.
  const vehicles: ReactNode[] = [];
  const palette = ['#E3A21A', '#F4F4F0', '#1F5FA8', '#2E7D4F', '#9AA3AB'];
  let count = 0;
  all.forEach((s, si) => {
    for (let i = 1; i < s.points.length - 2; i++) {
      const a = s.nodes[i];
      const b = s.nodes[i + 1];
      if (!a || !b || closed.has(segmentKey(a, b)) || wobble(si, i, 11) < 0.3) {
        continue;
      }
      const pa = s.points[i];
      const pb = s.points[i + 1];
      const dir = unit(sub(pb, pa));
      const side = mul({ x: -dir.y, y: dir.x }, RW / 4 + 0.5);
      // Parked away from the middle of the stretch, where the street name is written.
      const at = add(lerp(pa, pb, wobble(si, i, 4) > 0 ? 0.27 : 0.73), side);
      vehicles.push(
        count === 2 ? (
          <Bus key={`v${si}-${i}`} x={at.x} y={at.y} angle={deg(dir)} />
        ) : (
          <Car key={`v${si}-${i}`} x={at.x} y={at.y} angle={deg(dir)} color={palette[count % palette.length]} />
        ),
      );
      count++;
    }
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} accessible accessibilityLabel="Şehir haritası">
      <Rect x={0} y={0} width={VIEW} height={VIEW} fill={C.ground} />
      <Surroundings />
      {town.water ? <Water side={town.water} /> : null}
      {/* Streets: a darker edge, the asphalt, then the centre line. */}
      {(['edge', 'asphalt', 'dash'] as const).map((layer) =>
        all.map((s, i) =>
          runs(s, closed).map(([a, b]) => (
            <Path
              key={`${layer}${i}-${a}`}
              d={curve(s.points, a, b)}
              stroke={layer === 'edge' ? C.asphaltEdge : layer === 'asphalt' ? C.asphalt : C.marking}
              strokeWidth={layer === 'edge' ? RW + 2 : layer === 'asphalt' ? RW : 1.2}
              strokeDasharray={layer === 'dash' ? '5 6' : undefined}
              opacity={layer === 'dash' ? 0.7 : 1}
              fill="none"
              strokeLinecap={layer === 'dash' ? 'butt' : 'round'}
              strokeLinejoin="round"
            />
          )),
        ),
      )}
      {/* Crossing patches clear the centre lines; zebra stripes on every arm. */}
      {Array.from({ length: SIZE * SIZE }, (_, k) => {
        const xy = nodeXY(town, [k % SIZE, Math.floor(k / SIZE)]);
        return <Circle key={`n${k}`} cx={xy.x} cy={xy.y} r={RW / 2 + 0.5} fill={C.asphalt} />;
      })}
      {arms.map(({ at, to }, k) => {
        const p = nodeXY(town, at);
        const u = unit(sub(nodeXY(town, to), p));
        const v = { x: -u.y, y: u.x };
        const base = add(p, mul(u, RW / 2 + 5));
        return (
          <G key={`z${k}`}>
            {[-6, -2, 2, 6].map((t) => {
              const c = add(base, mul(v, t));
              const a = sub(c, mul(u, 2.5));
              const b = add(c, mul(u, 2.5));
              return <Line key={t} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.marking} strokeWidth={2} />;
            })}
          </G>
        );
      })}
      {town.roundabout ? <Roundabout at={nodeXY(town, town.roundabout)} /> : null}
      {town.places.map((p) => (
        <Block key={p.id} town={town} place={p} />
      ))}
      {vehicles}
      {(town.lights ?? []).map((p, k) => {
        const xy = nodeXY(town, p);
        const o = RW / 2 + 6;
        return (
          <G key={`l${k}`}>
            <TrafficLight x={xy.x - o} y={xy.y - o} />
            <TrafficLight x={xy.x + o} y={xy.y + o} />
          </G>
        );
      })}
      {/* Street names along the road, on an open stretch near the middle. */}
      {all.map((s, i) => {
        const open = [2, 3, 1].filter((k) => {
          const a = s.nodes[k];
          const b = s.nodes[k + 1];
          return a && b && !closed.has(segmentKey(a, b));
        });
        if (open.length === 0) {
          return null;
        }
        const k = open[i % 2 === 0 || open.length === 1 ? 0 : 1];
        const a = s.points[k];
        const b = s.points[k + 1];
        const mid = lerp(a, b, 0.5);
        let angle = deg(sub(b, a));
        if (angle > 90) {
          angle -= 180;
        } else if (angle < -90) {
          angle += 180;
        }
        if (i >= SIZE) {
          angle = deg(sub(a, b));
        }
        const text = short(s.name);
        const w = text.length * 4.5 + 8;
        return (
          <G key={`t${i}`} transform={`translate(${mid.x.toFixed(1)} ${mid.y.toFixed(1)}) rotate(${angle.toFixed(2)})`}>
            <Rect x={-w / 2} y={-5} width={w} height={10} fill={C.asphalt} />
            <SvgText x={0} y={3} fontSize={8} fontFamily={fonts.displayBold} fontWeight="600" fill={C.label} textAnchor="middle" letterSpacing={0.4}>
              {text}
            </SvgText>
          </G>
        );
      })}
      {trail.length > 1 ? (
        <Polyline
          points={trail
            .map((p) => {
              const xy = nodeXY(town, p);
              return `${xy.x.toFixed(1)},${xy.y.toFixed(1)}`;
            })
            .join(' ')}
          stroke={trailColor}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.9}
        />
      ) : null}
      {goalPlace ? <GoalPin town={town} place={goalPlace} /> : null}
      <Walker x={walker.x} y={walker.y} heading={walker.heading} />
      <Compass />
    </Svg>
  );
}
