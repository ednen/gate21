import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Heading, Move, Point, TownSpec } from '@/lib/directions';
import { colors, fonts } from '@/theme';

import { drawTown, type Lane, type TownArt } from './art';
import { along, between, nodeXY, VIEW } from './geo';
import { GLYPH } from './glyphs';
import { POI } from './looks';
import { add, f, len, lerp, mul, perp, rand, sub, unit, type XY } from './paint';
import { vehicleParts, type VehicleKind } from './vehicles';

export { along, nodeXY, VIEW };

/*
 * The town as a game board: a carefully drawn city (see art.ts) with the game on top of it —
 * the traveller and where they face, the streets they can take from here, footsteps behind
 * them, the goal, and short flashes of feedback for a right turn, a wrong one and arriving.
 */

export type WalkerState = { x: number; y: number; heading: Heading };
export type MapOption = { move: Move; to: Point };
export type MapPulse = { kind: 'ok' | 'bad' | 'arrive'; at: Point; move?: Move; key: number };

const ROTATION: Record<Heading, number> = { N: 0, E: 90, S: 180, W: 270 };

// ---- time -----------------------------------------------------------------------------------

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Seconds since mount, updated about 30 times a second while `active`. */
function useClock(active: boolean): number {
  const [t, setT] = useState(0);
  const start = useRef(Date.now());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    const tick = () => {
      const now = Date.now();
      if (now - last > 32) {
        last = now;
        setT((now - start.current) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return active ? t : (Date.now() - start.current) / 1000;
}

// ---- static layers --------------------------------------------------------------------------

const Ground = memo(function Ground({ art }: { art: TownArt }) {
  const layers = [...art.painter.layers.values()].sort((a, b) => a.z - b.z || a.order - b.order);
  return (
    <G>
      {layers.map((l, i) => (
        <Path
          key={i}
          d={l.d.join(' ')}
          fill={l.style.fill ?? 'none'}
          stroke={l.style.stroke}
          strokeWidth={l.style.width}
          strokeDasharray={l.style.dash}
          strokeLinecap={l.style.cap ?? 'butt'}
          strokeLinejoin={l.style.join ?? 'miter'}
          opacity={l.style.opacity}
        />
      ))}
    </G>
  );
});

function Halo({ x, y, size, color, children, family = fonts.displayBold, spacing = 0.2, anchor = 'middle' }: {
  x: number;
  y: number;
  size: number;
  color: string;
  children: string;
  family?: string;
  spacing?: number;
  anchor?: 'middle' | 'start';
}) {
  const common = { x, y, fontSize: size, fontFamily: family, textAnchor: anchor, letterSpacing: spacing };
  return (
    <G>
      <SvgText {...common} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={2.8} strokeLinejoin="round" opacity={0.92}>
        {children}
      </SvgText>
      <SvgText {...common} fill={color}>
        {children}
      </SvgText>
    </G>
  );
}

const short = (name: string) => name.replace(/ Street$/, ' St').replace(/ Avenue$/, ' Ave').replace(/ Road$/, ' Rd').replace(/ Lane$/, ' Ln');

const Labels = memo(function Labels({ art, goal, tilt }: { art: TownArt; goal?: string | null; tilt: number }) {
  return (
    <G>
      {art.labels.map((l, i) => (
        <G key={i} transform={`translate(${f(l.at.x)} ${f(l.at.y)}) rotate(${l.angle.toFixed(1)})`}>
          <Halo x={0} y={2.6} size={l.major ? 7.6 : 7} color="#6F757B" family={fonts.displayMedium} spacing={0.6}>
            {short(l.text)}
          </Halo>
        </G>
      ))}
      {art.badges.map((b) => (
        <PlaceBadge key={b.id} kind={b.kind} at={b.at} big={b.id === goal} />
      ))}
      {art.badges.map((b) => (
        <Halo key={`n${b.id}`} x={b.label.x} y={b.label.y} size={b.id === goal ? 8.6 : 7.8} color="#343A40">
          {b.name}
        </Halo>
      ))}
      <Cartouche name={art.look.name} tilt={tilt} />
    </G>
  );
});

function PlaceBadge({ kind, at, big }: { kind: keyof typeof GLYPH; at: XY; big?: boolean }) {
  const s = big ? 15 : 12;
  const g = GLYPH[kind];
  return (
    <G transform={`translate(${f(at.x - s / 2)} ${f(at.y - s / 2)})`}>
      <Rect x={1} y={1.4} width={s} height={s} rx={3} fill="rgba(40,36,30,0.25)" />
      <Rect x={0} y={0} width={s} height={s} rx={3} fill={POI[kind]} stroke="#FFFFFF" strokeWidth={1.1} />
      <G transform={`scale(${s / 12})`}>
        {g.fill ? <Path d={g.fill} fill="#FFFFFF" /> : null}
        {g.stroke ? <Path d={g.stroke} fill="none" stroke="#FFFFFF" strokeWidth={1.15} strokeLinecap="round" strokeLinejoin="round" /> : null}
      </G>
    </G>
  );
}

/** The city's name, a scale bar and a compass that turns with the grid. */
function Cartouche({ name, tilt }: { name: string; tilt: number }) {
  return (
    <G>
      <Rect x={8} y={VIEW - 30} width={70} height={22} rx={3} fill="rgba(255,255,255,0.88)" />
      <SvgText x={14} y={VIEW - 19.5} fontSize={8.4} fontFamily={fonts.display} fill={colors.ink} letterSpacing={0.4}>
        {name}
      </SvgText>
      <Path d={`M14 ${VIEW - 12.5} v-2.2 M14 ${VIEW - 12.5} H50 v-2.2 M32 ${VIEW - 12.5} v-1.4`} stroke="#6B7177" strokeWidth={0.8} fill="none" />
      <SvgText x={53} y={VIEW - 11.6} fontSize={5.6} fontFamily={fonts.displayMedium} fill="#6B7177">
        100 m
      </SvgText>
      <G transform={`translate(${VIEW - 18} 18) rotate(${tilt})`}>
        <Circle r={10} fill="rgba(255,255,255,0.9)" />
        <Circle r={10} fill="none" stroke="#D6D1C6" strokeWidth={0.8} />
        <Path d="M0 -7.2 L2.6 0 L0 -1.2 L-2.6 0 Z" fill={colors.ink} />
        <Path d="M0 7.2 L2.6 0 L0 1.2 L-2.6 0 Z" fill="#B9B4AA" />
      </G>
      <SvgText x={VIEW - 18} y={36} fontSize={6} fontFamily={fonts.display} fill={colors.ink} textAnchor="middle">
        N
      </SvgText>
    </G>
  );
}

// ---- moving things --------------------------------------------------------------------------

type Mover = { lane: Lane; s0: number; speed: number; dir: 1 | -1; kind: VehicleKind; color: string };

function moversOf(art: TownArt): Mover[] {
  const { look } = art;
  const out: Mover[] = [];
  art.lanes.forEach((lane, i) => {
    const count = lane.major ? 3 : 1;
    for (let k = 0; k < count; k++) {
      const roll = rand(i, k, 1);
      const kind: VehicleKind = lane.major && k === 0 && i % 2 === 0 ? 'bus' : roll > 0.55 ? 'taxi' : 'car';
      out.push({
        lane,
        s0: rand(i, k, 2) * lane.length,
        speed: kind === 'bus' ? 9 : 11 + rand(i, k, 3) * 7,
        dir: k % 2 === 0 ? 1 : -1,
        kind,
        color: kind === 'bus' ? look.bus : kind === 'taxi' ? look.taxi : look.cars[Math.floor(rand(i, k, 4) * look.cars.length)],
      });
    }
  });
  return out;
}

function pointOn(lane: Lane, s: number): { p: XY; dir: XY } {
  const { pts, cum } = lane;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < s) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  return { p: lerp(pts[lo], pts[hi], (s - cum[lo]) / seg), dir: unit(sub(pts[hi], pts[lo])) };
}

function Vehicle({ kind, color, at, angle }: { kind: VehicleKind; color: string; at: XY; angle: number }) {
  return (
    <G transform={`translate(${f(at.x)} ${f(at.y)}) rotate(${angle.toFixed(1)})`}>
      {vehicleParts(kind, color).map((p, i) => (
        <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r ?? 0.2} fill={p.fill} />
      ))}
    </G>
  );
}

function Traffic({ art, movers, t }: { art: TownArt; movers: Mover[]; t: number }) {
  const left = art.look.driveLeft;
  return (
    <G>
      {movers.map((m, i) => {
        const L = m.lane.length;
        let s = (((m.s0 + m.dir * m.speed * t) % L) + L) % L;
        let heading = m.dir;
        if (m.lane.deadEnd) {
          // Back and forth: up to the quay, turn, and back again.
          const u = (((m.s0 + m.speed * t) % (2 * L)) + 2 * L) % (2 * L);
          s = u < L ? u : 2 * L - u;
          heading = u < L ? 1 : -1;
        }
        const { p, dir } = pointOn(m.lane, s);
        const travel = mul(dir, heading);
        const side = mul(perp(travel), left ? -m.lane.offset : m.lane.offset);
        const at = add(p, side);
        if (at.x < -20 || at.y < -20 || at.x > VIEW + 20 || at.y > VIEW + 20) return null;
        return <Vehicle key={i} kind={m.kind} color={m.color} at={at} angle={(Math.atan2(travel.y, travel.x) * 180) / Math.PI} />;
      })}
    </G>
  );
}

function Boats({ art, t }: { art: TownArt; t: number }) {
  const water = art.water;
  const lane = useMemo(() => {
    if (!water) return null;
    const pts = water.lane;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
    return { pts, cum, length: cum[cum.length - 1], offset: 0, major: false };
  }, [water]);
  if (!lane) return null;
  const kind: VehicleKind = art.look.boats === 'river' ? 'riverboat' : 'ferry';
  const color = art.look.boats === 'piers' ? '#C9824A' : art.look.boats === 'harbour' ? '#4E7A5F' : '#3E4D5C';
  const boats = [
    { s0: 0.2, dir: 1, speed: 5 },
    { s0: 0.7, dir: -1, speed: 4 },
  ];
  return (
    <G>
      {boats.map((b, i) => {
        const L = lane.length;
        const s = (((b.s0 * L + b.dir * b.speed * t) % L) + L) % L;
        const { p, dir } = pointOn(lane, s);
        const travel = mul(dir, b.dir);
        const angle = (Math.atan2(travel.y, travel.x) * 180) / Math.PI;
        const wake = mul(travel, -9);
        const n = perp(travel);
        return (
          <G key={i}>
            <Path
              d={`M${f(p.x + wake.x * 0.4)} ${f(p.y + wake.y * 0.4)} L${f(p.x + wake.x * 1.6 + n.x * 3)} ${f(p.y + wake.y * 1.6 + n.y * 3)} M${f(p.x + wake.x * 0.4)} ${f(p.y + wake.y * 0.4)} L${f(p.x + wake.x * 1.6 - n.x * 3)} ${f(p.y + wake.y * 1.6 - n.y * 3)}`}
              stroke="rgba(255,255,255,0.75)"
              strokeWidth={0.9}
              strokeLinecap="round"
            />
            <Vehicle kind={i === 1 && art.look.boats === 'harbour' ? 'sail' : kind} color={color} at={p} angle={angle} />
          </G>
        );
      })}
    </G>
  );
}

// ---- the game layer -------------------------------------------------------------------------

/** Footsteps along the streets already walked. */
function Footsteps({ town, trail, color }: { town: TownSpec; trail: Point[]; color: string }) {
  const d = useMemo(() => {
    const parts: string[] = [];
    for (let i = 0; i + 1 < trail.length; i++) {
      const pts = between(town, trail[i], trail[i + 1], 2);
      parts.push(`M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L')}`);
    }
    return parts.join(' ');
  }, [town, trail]);
  if (!d) return null;
  return (
    <G>
      <Path d={d} stroke={color} strokeOpacity={0.22} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={d} stroke={color} strokeWidth={2.6} strokeDasharray="0.1 5" strokeLinecap="round" fill="none" />
    </G>
  );
}

function Options({ town, at, options, preview, bad, t }: { town: TownSpec; at: Point; options: MapOption[]; preview?: Move | null; bad?: Move | null; t: number }) {
  const centre = nodeXY(town, at);
  return (
    <G>
      {options.map((o) => {
        const segment = len(sub(nodeXY(town, o.to), centre));
        const p = along(town, at, o.to, Math.min(0.42, 19 / segment));
        const dir = unit(sub(p, centre));
        const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
        const on = preview === o.move;
        const wrong = bad === o.move;
        const bob = on ? Math.sin(t * 8) * 0.8 : 0;
        return (
          <G key={o.move} transform={`translate(${f(p.x + dir.x * bob)} ${f(p.y + dir.y * bob)})`}>
            <Circle cx={0.8} cy={1.2} r={on || wrong ? 6.2 : 5.2} fill="rgba(30,30,30,0.2)" />
            <Circle r={on || wrong ? 6.2 : 5.2} fill={wrong ? colors.red : on ? colors.yellow : '#FFFFFF'} stroke={wrong ? '#FFFFFF' : colors.ink} strokeOpacity={on || wrong ? 1 : 0.55} strokeWidth={on ? 1.5 : 1} />
            {wrong ? (
              <Path d="M-2 -2 L2 2 M2 -2 L-2 2" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" />
            ) : (
              <Path d="M-1.4 -2.4 L1.6 0 L-1.4 2.4" transform={`rotate(${angle.toFixed(1)})`} stroke={colors.ink} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            )}
          </G>
        );
      })}
    </G>
  );
}

function Walker({ walker, tilt, t, shake }: { walker: WalkerState; tilt: number; t: number; shake: number }) {
  const rot = ROTATION[walker.heading] + tilt;
  const a = ((rot - 90) * Math.PI) / 180;
  const sideways = { x: -Math.sin(a), y: Math.cos(a) };
  const dx = sideways.x * shake;
  const dy = sideways.y * shake;
  const breathe = (Math.sin(t * 3) + 1) / 2;
  return (
    <G transform={`translate(${f(walker.x + dx)} ${f(walker.y + dy)})`}>
      <G transform={`rotate(${rot.toFixed(1)})`}>
        <Path d="M0 0 L-10 -26 A27 27 0 0 1 10 -26 Z" fill="rgba(255,199,44,0.30)" />
        <Path d="M-10 -26 A27 27 0 0 1 10 -26" stroke="rgba(255,199,44,0.85)" strokeWidth={1.2} fill="none" />
      </G>
      <Circle r={10.5 + breathe * 2.5} fill="none" stroke="rgba(255,199,44,0.7)" strokeWidth={1.4} opacity={0.35 + (1 - breathe) * 0.5} />
      <Circle cx={1.4} cy={2} r={8.4} fill="rgba(30,30,30,0.22)" />
      <Circle r={8.6} fill="#FFFFFF" />
      <Circle r={7} fill={colors.yellow} stroke={colors.ink} strokeWidth={1.5} />
      <Path d="M0 -4.8 L3.7 3.2 L0 1.3 L-3.7 3.2 Z" transform={`rotate(${rot.toFixed(1)})`} fill={colors.ink} strokeLinejoin="round" />
    </G>
  );
}

function Ripple({ at, age, color, delay = 0, from = 8, to = 24, life = 0.7 }: { at: XY; age: number; color: string; delay?: number; from?: number; to?: number; life?: number }) {
  const k = (age - delay) / life;
  if (k < 0 || k > 1) return null;
  const e = 1 - (1 - k) ** 3;
  return <Circle cx={at.x} cy={at.y} r={from + (to - from) * e} fill="none" stroke={color} strokeWidth={2.2 * (1 - k) + 0.4} opacity={1 - k} />;
}

/** A small flag over the goal; it waves when there is time to. */
function GoalFlag({ at, color, t }: { at: XY; color: string; t: number }) {
  const w = Math.sin(t * 4) * 0.9;
  const base = { x: at.x + 6.5, y: at.y - 6 };
  return (
    <G>
      <Path d={`M${f(base.x)} ${f(base.y)} V${f(base.y - 15)}`} stroke={colors.ink} strokeWidth={1.2} strokeLinecap="round" />
      <Path d={`M${f(base.x)} ${f(base.y - 15)} Q${f(base.x + 5)} ${f(base.y - 15.5 + w)} ${f(base.x + 9)} ${f(base.y - 13 + w)} L${f(base.x)} ${f(base.y - 9.5)} Z`} fill={color} stroke="#FFFFFF" strokeWidth={0.7} />
      <Circle cx={base.x} cy={base.y} r={1.2} fill={colors.ink} />
    </G>
  );
}

export function TownMap({
  town,
  walker,
  trail,
  trailColor,
  goal,
  size,
  options = [],
  at,
  preview,
  pulse,
  arrived,
}: {
  town: TownSpec;
  walker: WalkerState;
  trail: Point[];
  trailColor: string;
  goal?: string | null;
  size: number;
  /** Streets the traveller can take from here (none while walking). */
  options?: MapOption[];
  at?: Point;
  /** A move the player is pointing at: its street lights up. */
  preview?: Move | null;
  pulse?: MapPulse | null;
  arrived?: boolean;
}) {
  const art = useMemo(() => drawTown(town), [town]);
  const movers = useMemo(() => moversOf(art), [art]);
  const reduced = useReducedMotion();
  const pulseStart = useMemo(() => (pulse ? Date.now() : 0), [pulse]);
  const pulseAge = pulse ? (Date.now() - pulseStart) / 1000 : 99;
  const t = useClock(!reduced || pulseAge < 1.6);
  const tilt = town.tilt ?? 0;

  const badge = goal ? art.badges.find((b) => b.id === goal) : undefined;
  const pulseXY = pulse ? nodeXY(town, pulse.at) : null;
  const shake = pulse?.kind === 'bad' && pulseAge < 0.45 ? Math.sin(pulseAge * 42) * 2.6 * (1 - pulseAge / 0.45) : 0;
  const bad = pulse?.kind === 'bad' && pulseAge < 1.4 ? pulse.move : null;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} accessible accessibilityLabel={`${art.look.name} haritası`}>
      <Ground art={art} />
      <Boats art={art} t={reduced ? 0 : t} />
      <Traffic art={art} movers={movers} t={reduced ? 0 : t} />
      {arrived && goal && art.grounds[goal] ? (
        <G>
          <Path d={art.grounds[goal]} fill="none" stroke="#FFFFFF" strokeWidth={5} opacity={0.9} />
          <Path d={art.grounds[goal]} fill="rgba(255,199,44,0.12)" stroke={colors.yellow} strokeWidth={2.6} opacity={reduced ? 1 : 0.7 + 0.3 * Math.sin(t * 3)} />
        </G>
      ) : null}
      <Footsteps town={town} trail={trail} color={trailColor} />
      <Labels art={art} goal={goal} tilt={tilt} />
      {badge ? <GoalFlag at={badge.at} color={trailColor} t={reduced ? 0 : t} /> : null}
      {at && options.length ? <Options town={town} at={at} options={options} preview={preview} bad={bad} t={reduced ? 0 : t} /> : null}
      {pulse && pulseXY ? (
        pulse.kind === 'ok' ? (
          <Ripple at={pulseXY} age={pulseAge} color={colors.green} />
        ) : pulse.kind === 'bad' ? (
          <Ripple at={pulseXY} age={pulseAge} color={colors.red} to={16} life={0.5} />
        ) : (
          <G>
            <Ripple at={pulseXY} age={pulseAge} color={trailColor} to={34} life={1} />
            <Ripple at={pulseXY} age={pulseAge} color={colors.yellow} delay={0.25} to={30} life={1} />
          </G>
        )
      ) : null}
      <Walker walker={walker} tilt={tilt} t={reduced ? 0 : t} shake={shake} />
    </Svg>
  );
}
