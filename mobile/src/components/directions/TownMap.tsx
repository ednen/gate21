import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { type Heading, type Place, type PlaceKind, type Point, SIZE, type TownSpec } from '@/lib/directions';
import { colors, fonts } from '@/theme';

/*
 * A town drawn like an illustrated tourist map: asphalt streets with zebra crossings, lawns,
 * and buildings in a slight oblique view (roof plus a strip of facade) so they read as
 * buildings at a glance. Everything is laid out from the 4×4 grid of crossings.
 */
export const VIEW = 360;
const M = 36;
const D = 96;
const RW = 20;
const CURB = 3;

export const px = (c: number) => M + c * D;

const C = {
  ground: '#D9D7CC',
  asphalt: '#6C747B',
  asphaltEdge: '#5B6268',
  marking: '#ECEDE8',
  lawn: '#BBD3A2',
  lawnDark: '#9FBF86',
  tree: '#6E9F57',
  treeDark: '#4E7B41',
  trunkShadow: 'rgba(35,42,49,0.18)',
  water: '#8DC0D6',
  path: '#E9E2CC',
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
};

function blockBox([c, r]: Point) {
  const x = px(c) + RW / 2 + CURB;
  const y = px(r) + RW / 2 + CURB;
  const s = D - RW - CURB * 2;
  return { x, y, s };
}

function Tree({ x, y, r = 6 }: { x: number; y: number; r?: number }) {
  return (
    <G>
      <Circle cx={x + 1.6} cy={y + 2} r={r} fill={C.trunkShadow} />
      <Circle cx={x} cy={y} r={r} fill={C.tree} />
      <Circle cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.45} fill="#86B56C" />
    </G>
  );
}

function Plaque({ x, y, text, look, w }: { x: number; y: number; text: string; look: Look; w?: number }) {
  const width = w ?? Math.max(30, text.length * 4.6 + 10);
  return (
    <G>
      <Rect x={x - width / 2} y={y - 6.5} width={width} height={13} rx={2} fill={look.sign} />
      <SvgText x={x} y={y + 3} fontSize={8.6} fontFamily={fonts.display} fontWeight="700" fill={look.signText} textAnchor="middle">
        {text}
      </SvgText>
    </G>
  );
}

/** One block: lawn, its building (or park, or market) and a few trees. */
function Block({ place }: { place: Place }) {
  const { x, y, s } = blockBox(place.block);
  const look = LOOK[place.kind];
  const lawn = <Rect x={x} y={y} width={s} height={s} rx={3} fill={C.lawn} />;

  if (place.kind === 'park') {
    return (
      <G>
        {lawn}
        <Path d={`M${x} ${y + s * 0.7} C ${x + s * 0.35} ${y + s * 0.55}, ${x + s * 0.55} ${y + s * 0.95}, ${x + s} ${y + s * 0.62}`} stroke={C.path} strokeWidth={5} fill="none" />
        <Path d={`M${x + s * 0.48} ${y} C ${x + s * 0.4} ${y + s * 0.3}, ${x + s * 0.6} ${y + s * 0.5}, ${x + s * 0.5} ${y + s}`} stroke={C.path} strokeWidth={4} fill="none" />
        <Ellipse cx={x + s * 0.28} cy={y + s * 0.32} rx={11} ry={8} fill={C.water} stroke="#6FA6BE" strokeWidth={1} />
        <Tree x={x + s * 0.78} y={y + s * 0.22} r={7} />
        <Tree x={x + s * 0.86} y={y + s * 0.42} r={5.5} />
        <Tree x={x + s * 0.18} y={y + s * 0.85} r={6} />
        <Tree x={x + s * 0.72} y={y + s * 0.86} r={5} />
        <Plaque x={x + s / 2} y={y + s * 0.6} text={place.name} look={look} />
      </G>
    );
  }

  if (place.kind === 'market') {
    const stripes = ['#C0392B', '#1F5FA8', '#2E7D4F', '#E3A21A'];
    return (
      <G>
        <Rect x={x} y={y} width={s} height={s} rx={3} fill="#E3DDCB" />
        {[0, 1].map((row) =>
          [0, 1, 2].map((col) => {
            const sx = x + 6 + col * 20;
            const sy = y + 8 + row * 22;
            const fill = stripes[(row * 3 + col) % stripes.length];
            return (
              <G key={`${row}${col}`}>
                <Rect x={sx} y={sy} width={16} height={12} fill={fill} />
                {[0, 1, 2].map((k) => (
                  <Rect key={k} x={sx + 2 + k * 5} y={sy} width={2.5} height={12} fill="#FFFFFF" opacity={0.8} />
                ))}
                <Rect x={sx} y={sy + 12} width={16} height={3} fill="rgba(35,42,49,0.25)" />
              </G>
            );
          }),
        )}
        <Plaque x={x + s / 2} y={y + s - 10} text={place.name} look={look} />
      </G>
    );
  }

  // A building: roof seen from above, a strip of facade on the south side, a sign over the door.
  const bx = x + 7;
  const by = y + 6;
  const bw = s - 14;
  const bh = s - 20;
  const fh = 12;
  const windows = Math.floor(bw / 9);
  return (
    <G>
      {lawn}
      <Rect x={bx + 2} y={by + 3} width={bw} height={bh} fill="rgba(35,42,49,0.18)" />
      <Rect x={bx} y={by} width={bw} height={bh - fh} fill={look.roof} />
      <Line x1={bx} y1={by + 0.6} x2={bx + bw} y2={by + 0.6} stroke={look.trim} strokeWidth={1.2} opacity={0.7} />
      <Rect x={bx} y={by + bh - fh} width={bw} height={fh} fill={look.facade} />
      {Array.from({ length: windows }, (_, i) => (
        <Rect key={i} x={bx + 4 + i * 9} y={by + bh - fh + 3} width={5} height={6} fill={look.trim} opacity={0.85} />
      ))}
      {roofDetail(place.kind, bx, by, bw, bh - fh, look)}
      <Tree x={x + s - 5} y={y + s - 5} r={4.5} />
      <Tree x={x + 5} y={y + s - 5} r={4} />
      <Plaque x={bx + bw / 2} y={by + bh + 6} text={place.name} look={look} />
    </G>
  );
}

/** Small touches that tell buildings apart from above. */
function roofDetail(kind: PlaceKind, x: number, y: number, w: number, h: number, look: Look): ReactNode {
  switch (kind) {
    case 'museum':
      return (
        <G>
          <Circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) / 3} fill={look.trim} opacity={0.65} />
          <Circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) / 3} fill="none" stroke={look.facade} strokeWidth={1} />
          <Line x1={x + w / 2} y1={y + h / 2 - Math.min(w, h) / 3} x2={x + w / 2} y2={y + h / 2 + Math.min(w, h) / 3} stroke={look.facade} strokeWidth={0.8} />
        </G>
      );
    case 'gallery':
      return (
        <G>
          {[0, 1, 2].map((i) => (
            <Path key={i} d={`M${x + 6 + i * ((w - 12) / 3)} ${y + h - 4} l${(w - 12) / 6} -${h - 10} l${(w - 12) / 6} ${h - 10}`} fill={look.trim} opacity={0.6} />
          ))}
        </G>
      );
    case 'bank':
      return (
        <G>
          <Path d={`M${x + w / 2} ${y + 4} L${x + w - 6} ${y + h - 3} L${x + 6} ${y + h - 3} Z`} fill={look.trim} opacity={0.55} />
          <Line x1={x + w / 2} y1={y + 4} x2={x + w / 2} y2={y + h - 3} stroke={look.facade} strokeWidth={1} />
        </G>
      );
    case 'pharmacy':
      return (
        <G>
          <Rect x={x + w / 2 - 3} y={y + h / 2 - 9} width={6} height={18} fill={colors.green} />
          <Rect x={x + w / 2 - 9} y={y + h / 2 - 3} width={18} height={6} fill={colors.green} />
        </G>
      );
    case 'supermarket':
      return (
        <G>
          {[0, 1, 2].map((i) => (
            <Rect key={i} x={x + 6 + i * 14} y={y + 6} width={10} height={h - 12} fill={look.trim} opacity={0.5} />
          ))}
        </G>
      );
    case 'station':
      return (
        <G>
          <Rect x={x + 6} y={y + h / 2 - 3} width={w - 12} height={6} fill={look.trim} opacity={0.5} />
          <Circle cx={x + w / 2} cy={y + h / 2} r={8} fill={colors.surface} stroke={look.facade} strokeWidth={2} />
          <SvgText x={x + w / 2} y={y + h / 2 + 3.5} fontSize={10} fontFamily={fonts.display} fontWeight="700" fill={look.facade} textAnchor="middle">
            S
          </SvgText>
        </G>
      );
    case 'cafe':
    case 'restaurant':
      return (
        <G>
          {Array.from({ length: Math.floor(w / 6) }, (_, i) => (
            <Rect key={i} x={x + i * 6} y={y + h - 6} width={3} height={6} fill={i % 2 ? '#FFFFFF' : kind === 'cafe' ? colors.red : colors.green} />
          ))}
        </G>
      );
    case 'theatre':
      return (
        <G>
          {Array.from({ length: 6 }, (_, i) => (
            <Circle key={i} cx={x + 8 + i * ((w - 16) / 5)} cy={y + h - 4} r={1.6} fill={colors.yellow} />
          ))}
        </G>
      );
    case 'hotel':
    case 'post':
    default:
      return <Rect x={x + w / 2 - 8} y={y + 6} width={16} height={10} fill={look.trim} opacity={0.4} />;
  }
}

function Crossings({ c, r }: { c: number; r: number }) {
  const x = px(c);
  const y = px(r);
  const stripes = [-6, -2, 2, 6];
  const out: ReactNode[] = [];
  const off = RW / 2 + 4;
  // Zebra stripes just outside the crossing, on every arm that exists.
  if (r > 0) stripes.forEach((s, i) => out.push(<Rect key={`n${i}`} x={x + s - 1} y={y - off - 5} width={2} height={5} fill={C.marking} />));
  if (r < SIZE - 1) stripes.forEach((s, i) => out.push(<Rect key={`s${i}`} x={x + s - 1} y={y + off} width={2} height={5} fill={C.marking} />));
  if (c > 0) stripes.forEach((s, i) => out.push(<Rect key={`w${i}`} x={x - off - 5} y={y + s - 1} width={5} height={2} fill={C.marking} />));
  if (c < SIZE - 1) stripes.forEach((s, i) => out.push(<Rect key={`e${i}`} x={x + off} y={y + s - 1} width={5} height={2} fill={C.marking} />));
  return <G>{out}</G>;
}

function Roundabout({ at }: { at: Point }) {
  const x = px(at[0]);
  const y = px(at[1]);
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
      <Circle cx={VIEW - 18} cy={18} r={11} fill="rgba(255,255,255,0.85)" stroke={colors.ink} strokeWidth={1} />
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

function GoalPin({ place }: { place: Place }) {
  const { x, y, s } = blockBox(place.block);
  const cx = x + s / 2;
  const cy = y + 6;
  return (
    <G>
      <Ellipse cx={cx} cy={cy + 2} rx={5} ry={2} fill="rgba(35,42,49,0.35)" />
      <Path d={`M${cx} ${cy} c-6 -8 -10 -12 -10 -18 a10 10 0 0 1 20 0 c0 6 -4 10 -10 18z`} fill={colors.red} stroke={colors.surface} strokeWidth={1.5} />
      <Circle cx={cx} cy={cy - 18} r={4} fill={colors.surface} />
    </G>
  );
}

/** Printed maps abbreviate street types. */
const short = (name: string) =>
  name.replace(/ Street$/, ' St').replace(/ Avenue$/, ' Ave').replace(/ Road$/, ' Rd').replace(/ Lane$/, ' Ln');

/** The edges of the map: more town (lawns, trees, rooftops) or water. */
function Edges({ water }: { water?: TownSpec['water'] }) {
  const inner = px(0) - RW / 2 - 1;
  const outer = px(SIZE - 1) + RW / 2 + 1;
  const strips: Record<string, { x: number; y: number; w: number; h: number; vertical: boolean }> = {
    north: { x: 0, y: 0, w: VIEW, h: inner, vertical: false },
    south: { x: 0, y: outer, w: VIEW, h: VIEW - outer, vertical: false },
    west: { x: 0, y: 0, w: inner, h: VIEW, vertical: true },
    east: { x: outer, y: 0, w: VIEW - outer, h: VIEW, vertical: true },
  };
  const out: ReactNode[] = [];
  for (const [side, b] of Object.entries(strips)) {
    if (side === water) {
      out.push(<Rect key={side} x={b.x} y={b.y} width={b.w} height={b.h} fill={C.water} />);
      for (let i = 0; i < 9; i++) {
        const t = 18 + i * 40;
        const wx = b.vertical ? b.x + b.w / 2 - 4 + (i % 2) * 5 : t;
        const wy = b.vertical ? t : b.y + b.h / 2 - 2 + (i % 2) * 5;
        out.push(<Path key={`${side}w${i}`} d={`M${wx} ${wy} q3 -3 6 0 t6 0`} stroke="#E6F2F7" strokeWidth={1.2} fill="none" />);
      }
      continue;
    }
    // Lawn in each gap between streets, with a tree or two.
    for (let k = 0; k <= SIZE; k++) {
      const a = k === 0 ? 0 : px(k - 1) + RW / 2 + 1 + CURB;
      const e = k === SIZE ? VIEW : px(k) - RW / 2 - 1 - CURB;
      if (e - a < 10) {
        continue;
      }
      const rx = b.vertical ? b.x + (side === 'west' ? 0 : CURB) : a;
      const ry = b.vertical ? a : b.y + (side === 'north' ? 0 : CURB);
      const rw = b.vertical ? b.w - CURB : e - a;
      const rh = b.vertical ? e - a : b.h - CURB;
      out.push(<Rect key={`${side}${k}`} x={rx} y={ry} width={rw} height={rh} fill={k % 2 ? C.lawn : '#CFCBBD'} />);
      if (k % 2) {
        out.push(<Tree key={`${side}t${k}`} x={rx + rw / 2} y={ry + rh / 2} r={5.5} />);
      } else if (rw > 20 && rh > 14) {
        out.push(<Rect key={`${side}r${k}`} x={rx + 4} y={ry + 4} width={rw - 8} height={rh - 8} fill="#BDB6A4" />);
      }
    }
  }
  return <G>{out}</G>;
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
  const midH = px(1) + D / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} accessible accessibilityLabel="Şehir haritası">
      <Rect x={0} y={0} width={VIEW} height={VIEW} fill={C.ground} />
      <Edges water={town.water} />
      {town.places.map((p) => (
        <Block key={p.id} place={p} />
      ))}
      {/* Streets: full-length asphalt with a soft edge, centre dashes between crossings. */}
      {Array.from({ length: SIZE }, (_, i) => (
        <G key={`h${i}`}>
          <Rect x={0} y={px(i) - RW / 2 - 1} width={VIEW} height={RW + 2} fill={C.asphaltEdge} />
          <Rect x={0} y={px(i) - RW / 2} width={VIEW} height={RW} fill={C.asphalt} />
        </G>
      ))}
      {Array.from({ length: SIZE }, (_, i) => (
        <G key={`v${i}`}>
          <Rect x={px(i) - RW / 2 - 1} y={0} width={RW + 2} height={VIEW} fill={C.asphaltEdge} />
          <Rect x={px(i) - RW / 2} y={0} width={RW} height={VIEW} fill={C.asphalt} />
        </G>
      ))}
      {Array.from({ length: SIZE }, (_, i) =>
        Array.from({ length: SIZE + 1 }, (_, k) => {
          const a = k === 0 ? 0 : px(k - 1) + RW / 2 + 12;
          const b = k === SIZE ? VIEW : px(k) - RW / 2 - 12;
          if (b - a < 8) {
            return null;
          }
          return (
            <G key={`d${i}-${k}`}>
              <Line x1={a} y1={px(i)} x2={b} y2={px(i)} stroke={C.marking} strokeWidth={1.2} strokeDasharray="5 5" opacity={0.7} />
              <Line x1={px(i)} y1={a} x2={px(i)} y2={b} stroke={C.marking} strokeWidth={1.2} strokeDasharray="5 5" opacity={0.7} />
            </G>
          );
        }),
      )}
      {Array.from({ length: SIZE }, (_, c) =>
        Array.from({ length: SIZE }, (_, r) =>
          town.roundabout && town.roundabout[0] === c && town.roundabout[1] === r ? null : <Crossings key={`x${c}${r}`} c={c} r={r} />,
        ),
      )}
      {town.roundabout ? <Roundabout at={town.roundabout} /> : null}
      {/* Street names, written along the road like on a printed map. */}
      {/* Clear the centre line under each name. */}
      {town.streetsH.map((name, i) => (
        <Rect key={`mh${i}`} x={midH - short(name).length * 2.3 - 4} y={px(i) - 5} width={short(name).length * 4.6 + 8} height={10} fill={C.asphalt} />
      ))}
      {town.streetsV.map((name, i) => (
        <Rect key={`mv${i}`} x={px(i) - 5} y={midH + (i % 2 ? D : 0) - short(name).length * 2.3 - 4} width={10} height={short(name).length * 4.6 + 8} fill={C.asphalt} />
      ))}
      {town.streetsH.map((name, i) => (
        <SvgText key={`nh${i}`} x={midH} y={px(i) + 3} fontSize={8} fontFamily={fonts.displayBold} fontWeight="600" fill={C.label} textAnchor="middle" letterSpacing={0.4}>
          {short(name)}
        </SvgText>
      ))}
      {town.streetsV.map((name, i) => (
        <SvgText
          key={`nv${i}`}
          x={px(i) + 3}
          y={midH + (i % 2 ? D : 0)}
          fontSize={8}
          fontFamily={fonts.displayBold}
          fontWeight="600"
          fill={C.label}
          textAnchor="middle"
          letterSpacing={0.4}
          transform={`rotate(-90 ${px(i) + 3} ${midH + (i % 2 ? D : 0)})`}
        >
          {short(name)}
        </SvgText>
      ))}
      {trail.length > 1 ? (
        <Polyline
          points={trail.map(([c, r]) => `${px(c)},${px(r)}`).join(' ')}
          stroke={trailColor}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.9}
        />
      ) : null}
      {goalPlace ? <GoalPin place={goalPlace} /> : null}
      <Walker x={walker.x} y={walker.y} heading={walker.heading} />
      <Compass />
    </Svg>
  );
}
