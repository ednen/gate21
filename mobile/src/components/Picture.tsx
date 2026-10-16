import type { ReactNode } from 'react';
import Svg, { Circle, Defs, FeColorMatrix, Filter, G as Group, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors, fonts } from '@/theme';

/**
 * The word pictures: one simple drawing per concrete word, in the app's ink-and-yellow style.
 * All share a 64×64 grid, a 2.5 stroke and at most two accent colours, so they read as a set
 * and can later be swapped for professional illustrations without touching the content.
 */
export function Picture({ name, size = 72, label, shadow = false }: { name: string; size?: number; label?: string; shadow?: boolean }) {
  const drawing = DRAWINGS[name];
  if (!drawing) {
    return null;
  }
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessible={!!label}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no'}
    >
      {shadow ? (
        <>
          <Defs>
            {/* Every colour becomes one flat grey, keeping only the shape: a word not learned yet. */}
            <Filter id="silhouette">
              <FeColorMatrix type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.65  0 0 0 0 0.70  0 0 0 1 0" />
            </Filter>
          </Defs>
          <Group filter="url(#silhouette)">{drawing}</Group>
        </>
      ) : (
        drawing
      )}
    </Svg>
  );
}

export function hasPicture(name: string | undefined): name is string {
  return !!name && name in DRAWINGS;
}

const INK = colors.ink;
const Y = colors.yellow;
const W = colors.surface;
const R = colors.red;
const B = colors.blue;
const GR = colors.green;
const S = 2.5;

/** A flag: coloured fields inside a rounded frame (x 6–58, y 14–50). */
const FX = 6;
const FY = 14;
const FW = 52;
const FH = 36;
const Flag = ({ children, bg = W }: { children?: ReactNode; bg?: string }) => (
  <>
    <Rect x={FX} y={FY} width={FW} height={FH} rx={3} fill={bg} />
    {children}
    <Rc x={FX} y={FY} w={FW} h={FH} r={3} />
  </>
);
/** Three equal stripes, side by side (vertical) or stacked (horizontal). */
const Tricolor = ({ a, b, c, vertical }: { a: string; b: string; c: string; vertical?: boolean }) => (
  <Flag>
    {[a, b, c].map((fill, i) =>
      vertical ? (
        <Rect key={i} x={FX + (FW / 3) * i} y={FY} width={FW / 3 + 0.2} height={FH} fill={fill} />
      ) : (
        <Rect key={i} x={FX} y={FY + (FH / 3) * i} width={FW} height={FH / 3 + 0.2} fill={fill} />
      ),
    )}
  </Flag>
);
/** A Nordic cross, its upright left of centre. */
const Nordic = ({ bg, cross }: { bg: string; cross: string }) => (
  <Flag bg={bg}>
    <Rect x={FX + 15} y={FY} width={7} height={FH} fill={cross} />
    <Rect x={FX} y={FY + 14.5} width={FW} height={7} fill={cross} />
  </Flag>
);
/** A banknote with a currency sign. */
const Note = ({ sign, fill = GR, size = 13 }: { sign: string; fill?: string; size?: number }) => (
  <>
    <Rc x={6} y={18} w={52} h={28} r={3} fill={fill} />
    <Ci x={32} y={32} r={9} fill={W} />
    <T x={32} y={32 + size * 0.37} size={size}>{sign}</T>
    <Ci x={14} y={32} r={2} fill={W} />
    <Ci x={50} y={32} r={2} fill={W} />
  </>
);

/** Outline. */
const P = ({ d, fill = 'none', w = S }: { d: string; fill?: string; w?: number }) => (
  <Path d={d} stroke={INK} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill={fill} />
);
const Rc = ({ x, y, w, h, r = 3, fill = 'none' }: { x: number; y: number; w: number; h: number; r?: number; fill?: string }) => (
  <Rect x={x} y={y} width={w} height={h} rx={r} stroke={INK} strokeWidth={S} strokeLinejoin="round" fill={fill} />
);
const Ci = ({ x, y, r, fill = 'none' }: { x: number; y: number; r: number; fill?: string }) => (
  <Circle cx={x} cy={y} r={r} stroke={INK} strokeWidth={S} fill={fill} />
);
const Ln = ({ x1, y1, x2, y2, w = S }: { x1: number; y1: number; x2: number; y2: number; w?: number }) => (
  <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={w} strokeLinecap="round" />
);
const T = ({ x, y, size = 12, children, fill = INK }: { x: number; y: number; size?: number; children: ReactNode; fill?: string }) => (
  <SvgText x={x} y={y} fontSize={size} fontFamily={fonts.mono} fontWeight="700" fill={fill} textAnchor="middle">
    {children}
  </SvgText>
);

/** A person: head and shoulders, centred on x. */
const Person = ({ x, y = 0, s = 1, fill = Y, hair }: { x: number; y?: number; s?: number; fill?: string; hair?: 'long' }) => (
  <>
    {hair === 'long' ? <P d={`M${x - 7 * s} ${y + 22 * s}c0-10 2-15 ${7 * s}-15s${7 * s} 5 ${7 * s} 15`} fill={INK} /> : null}
    <Ci x={x} y={y + 18 * s} r={6 * s} fill={W} />
    <P d={`M${x - 11 * s} ${y + 44 * s}c0-9 5-14 ${11 * s}-14s${11 * s} 5 ${11 * s} 14z`} fill={fill} />
  </>
);

const DRAWINGS: Record<string, ReactNode> = {
  // ---- airport & documents -------------------------------------------------------------
  passport: (
    <>
      <Rc x={16} y={8} w={32} h={48} r={4} fill={B} />
      <Ci x={32} y={28} r={8} fill="none" />
      <P d="M24 28h16M32 20c-3 3-3 13 0 16M32 20c3 3 3 13 0 16" w={1.5} />
      <Ln x1={24} y1={46} x2={40} y2={46} />
    </>
  ),
  visa: (
    <>
      <Rc x={8} y={10} w={48} h={44} r={3} fill={W} />
      <Ln x1={32} y1={10} x2={32} y2={54} w={1.5} />
      <Rc x={36} y={16} w={16} h={22} r={2} fill={GR} />
      <T x={44} y={30} size={6} fill={W}>VISA</T>
      <Ln x1={13} y1={20} x2={27} y2={20} w={1.5} />
      <Ln x1={13} y1={27} x2={25} y2={27} w={1.5} />
      <Ci x={20} y={41} r={7} fill="none" />
      <Ln x1={38} y1={46} x2={50} y2={46} w={1.5} />
    </>
  ),
  officer: (
    <>
      <Person x={32} y={6} fill={B} />
      <P d="M23 18h18l-2-6H25z" fill={INK} />
      <Rc x={12} y={46} w={40} h={10} r={2} fill={Y} />
    </>
  ),
  'boarding-pass': (
    <>
      <Rc x={6} y={18} w={52} h={28} r={4} fill={W} />
      <Ln x1={42} y1={18} x2={42} y2={46} w={1.5} />
      <P d="M14 32l6-2 8-6 2 1-4 6 6 1 2-2h2l-1 4 1 4h-2l-2-2-6 1 4 6-2 1-8-6z" fill={Y} w={1.5} />
      <Ln x1={47} y1={26} x2={53} y2={26} w={2} />
      <Ln x1={47} y1={32} x2={53} y2={32} w={2} />
      <Ln x1={47} y1={38} x2={51} y2={38} w={2} />
    </>
  ),
  form: (
    <>
      <Rc x={14} y={6} w={36} h={52} r={3} fill={W} />
      <Ln x1={20} y1={16} x2={34} y2={16} />
      <Rc x={20} y={24} w={24} h={6} r={1} fill={Y} />
      <Rc x={20} y={36} w={24} h={6} r={1} />
      <Ln x1={20} y1={50} x2={30} y2={50} />
    </>
  ),
  suitcase: (
    <>
      <Rc x={14} y={18} w={36} h={36} r={5} fill={Y} />
      <P d="M25 18v-6h14v6" />
      <Ln x1={24} y1={18} x2={24} y2={54} />
      <Ln x1={40} y1={18} x2={40} y2={54} />
      <Ci x={22} y={58} r={2} fill={INK} />
      <Ci x={42} y={58} r={2} fill={INK} />
    </>
  ),
  briefcase: (
    <>
      <Rc x={8} y={20} w={48} h={32} r={4} fill={colors.inkLine} />
      <P d="M24 20v-6h16v6" />
      <Ln x1={8} y1={34} x2={56} y2={34} />
      <Rc x={28} y={30} w={8} h={8} r={1} fill={Y} />
    </>
  ),
  exit: (
    <>
      <Rc x={6} y={18} w={52} h={28} r={4} fill={GR} />
      <T x={26} y={37} size={13} fill={W}>EXIT</T>
      <P d="M46 32h7M50 28l4 4-4 4" w={2} />
    </>
  ),
  sun: (
    <>
      <Ci x={32} y={32} r={11} fill={Y} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return <Ln key={a} x1={32 + Math.cos(r) * 17} y1={32 + Math.sin(r) * 17} x2={32 + Math.cos(r) * 24} y2={32 + Math.sin(r) * 24} />;
      })}
    </>
  ),
  calendar: (
    <>
      <Rc x={10} y={12} w={44} h={42} r={4} fill={W} />
      <P d="M10 24h44" />
      <Rect x={10} y={12} width={44} height={12} rx={4} fill={R} stroke={INK} strokeWidth={S} />
      <Ln x1={20} y1={8} x2={20} y2={16} />
      <Ln x1={44} y1={8} x2={44} y2={16} />
      <T x={32} y={47} size={18}>7</T>
    </>
  ),
  gate: (
    <>
      <Rc x={6} y={8} w={52} h={22} r={3} fill={Y} />
      <T x={32} y={23.5} size={10}>GATE 12</T>
      <P d="M14 30v26M50 30v26M14 42h36" />
      <P d="M24 56v-8h16v8" fill={W} />
    </>
  ),
  seat: (
    <>
      <P d="M12 10h16a4 4 0 0 1 4 4v26H16a4 4 0 0 1-4-4z" fill={B} />
      <P d="M16 40h24a4 4 0 0 1 4 4v4H16z" fill={B} />
      <P d="M18 48v8M38 48v8" />
      <Rc x={16} y={12} w={12} h={7} r={2} fill={W} />
      <Rc x={42} y={10} w={18} h={12} r={2} fill={W} />
      <T x={51} y={19.5} size={8}>14A</T>
    </>
  ),
  camera: (
    <>
      <Rc x={8} y={18} w={48} h={34} r={5} fill={colors.inkLine} />
      <P d="M22 18l4-6h12l4 6" fill={colors.inkLine} />
      <Ci x={32} y={35} r={10} fill={W} />
      <Ci x={32} y={35} r={5} fill={B} />
      <Ci x={48} y={25} r={2} fill={Y} />
    </>
  ),
  target: (
    <>
      <Ci x={30} y={34} r={22} fill={W} />
      <Ci x={30} y={34} r={14} fill={R} />
      <Ci x={30} y={34} r={6} fill={W} />
      <P d="M30 34L54 10M46 10h8v8" />
    </>
  ),
  'single-bed': (
    <>
      <P d="M18 52V20M18 38h28v14M46 52V38" />
      <Rc x={20} y={28} w={10} h={8} r={3} fill={W} />
      <P d="M32 38v-6h10a4 4 0 0 1 4 4v2" fill={Y} />
      <Ci x={50} y={14} r={7} fill={Y} />
      <T x={50} y={17.5} size={9}>1</T>
    </>
  ),
  'double-bed': (
    <>
      <P d="M4 52V20M4 38h56v14M60 52V38" />
      <Rc x={6} y={28} w={12} h={8} r={3} fill={W} />
      <Rc x={20} y={28} w={12} h={8} r={3} fill={W} />
      <P d="M34 38v-6h22a4 4 0 0 1 4 4v2" fill={Y} />
      <Ci x={50} y={14} r={7} fill={Y} />
      <T x={50} y={17.5} size={9}>2</T>
    </>
  ),
  'room-service': (
    <>
      <P d="M10 44a22 22 0 0 1 44 0z" fill={colors.line} />
      <Ci x={32} y={19} r={3} fill={INK} />
      <Ln x1={6} y1={48} x2={58} y2={48} w={4} />
      <P d="M20 56h24" />
      <P d="M40 30c2 2 4 5 4 8" w={2} />
    </>
  ),
  // ---- week 2 · New York ----------------------------------------------------------------
  fingerprint: (
    <>
      <P d="M32 8a20 20 0 0 1 20 20v8M12 36v-8A20 20 0 0 1 22 10.7" />
      <P d="M32 16a12 12 0 0 1 12 12v10c0 8-3 14-7 18M20 28a12 12 0 0 1 6-10.4" />
      <P d="M32 24a4 4 0 0 1 4 4v10c0 6-2 11-5 15M28 28v8c0 6-2 10-5 14M20 36v4c0 4-1 8-3 11" />
    </>
  ),
  scanner: (
    <>
      <Rc x={8} y={30} w={48} h={24} r={4} fill={colors.inkLine} />
      <Rc x={14} y={34} w={36} h={12} r={2} fill="#9CC4F0" />
      <P d="M18 30V14a3 3 0 0 1 6 0v16M26 30V10a3 3 0 0 1 6 0v20M34 30V12a3 3 0 0 1 6 0v18M42 30V18a3 3 0 0 1 6 0v12" fill={Y} />
    </>
  ),
  nervous: (
    <>
      <Ci x={30} y={34} r={22} fill={Y} />
      <P d="M20 30h6M36 30h6M22 44c3-3 5 3 8 0s5 3 8 0" />
      <P d="M52 10c-3 5-5 8-2 11s6-1 2-11z" fill="#9CC4F0" w={2} />
    </>
  ),
  sweat: (
    <>
      <P d="M18 58V30l-6-8a3 3 0 0 1 5-3l6 7V12a3 3 0 0 1 6 0v12V8a3 3 0 0 1 6 0v16V12a3 3 0 0 1 6 0v28c0 10-6 18-14 18z" fill={Y} />
      <P d="M52 18c-3 5-4 8-1 10s6-1 1-10zM54 38c-2 4-3 6-1 8s4-1 1-8z" fill="#9CC4F0" w={2} />
    </>
  ),
  first: (
    <>
      <P d="M22 40l-6 18 10-4 6 8 4-16zM42 40l6 18-10-4-6 8-4-16z" fill={R} />
      <Ci x={32} y={26} r={18} fill={Y} />
      <T x={32} y={31} size={14}>1st</T>
    </>
  ),
  skyline: (
    <>
      <P d="M4 56V36h8V24h6v32M18 56V16h10v40M28 56V8l4-4 4 4v48M36 56V20h10v36M46 56V30h12v26" fill={W} />
      <P d="M2 56h60" />
      {[22, 30, 38].map((y) => <Ln key={y} x1={22} y1={y} x2={24} y2={y} w={2} />)}
      {[16, 24, 32, 40].map((y) => <Ln key={y} x1={32} y1={y} x2={32} y2={y + 2} w={2} />)}
    </>
  ),
  customs: (
    <>
      <Rc x={6} y={26} w={34} h={26} r={4} fill={Y} />
      <P d="M16 26v-6h14v6" />
      <Ci x={44} y={22} r={10} fill={W} />
      <P d="M51 29l8 8" w={4} />
    </>
  ),
  'green-channel': (
    <>
      <Rc x={4} y={14} w={56} h={36} r={4} fill={GR} />
      <T x={32} y={30} size={8} fill={W}>NOTHING TO</T>
      <T x={32} y={42} size={8} fill={W}>DECLARE</T>
    </>
  ),
  driver: (
    <>
      <Person x={32} y={6} fill={B} />
      <P d="M23 18h18l-2-7H25z" fill={INK} />
      <Ln x1={21} y1={18} x2={43} y2={18} w={3} />
    </>
  ),
  'name-sign': (
    <>
      <Rc x={6} y={14} w={52} h={26} r={3} fill={W} />
      <T x={32} y={31} size={12}>OZAN</T>
      <P d="M18 40v18M46 40v18" />
    </>
  ),
  arrivals: (
    <>
      <Rc x={4} y={16} w={56} h={32} r={4} fill={Y} />
      <P d="M12 38l26-6 4 4-6 2" w={2} fill="none" />
      <P d="M12 38l6-10 4 1-2 7" w={2} />
      <T x={42} y={30} size={8}>ARR</T>
    </>
  ),
  car: (
    <>
      <P d="M6 42v-8l6-12h40l6 12v8z" fill={B} />
      <P d="M14 32l4-8h28l4 8z" fill="#DCEBF7" />
      <Ci x={18} y={44} r={5} fill={INK} />
      <Ci x={46} y={44} r={5} fill={INK} />
    </>
  ),
  trunk: (
    <>
      <P d="M4 46v-10l8-12h22l6 10h16v12z" fill={B} />
      <P d="M12 34l4-8h16l4 8z" fill="#DCEBF7" />
      <P d="M56 34l4-18" w={3} />
      <Rc x={42} y={24} w={12} h={10} r={2} fill={Y} />
      <Ci x={16} y={48} r={5} fill={INK} />
      <Ci x={46} y={48} r={5} fill={INK} />
    </>
  ),
  seatbelt: (
    <>
      <P d="M16 8h16a4 4 0 0 1 4 4v30H20a4 4 0 0 1-4-4z" fill={colors.inkLine} />
      <P d="M20 42h28a4 4 0 0 1 4 4v4H20z" fill={colors.inkLine} />
      <Path d="M34 12 18 46" stroke={R} strokeWidth={6} strokeLinecap="round" />
      <Rc x={14} y={42} w={10} h={8} r={2} fill={W} />
    </>
  ),
  highway: (
    <>
      <P d="M24 6 8 58h48L40 6z" fill={colors.inkLine} />
      <Path d="M32 10v8M32 26v8M32 42v10" stroke={Y} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  // ---- hotel requests ---------------------------------------------------------------------
  view: (
    <>
      <Rc x={8} y={8} w={48} h={44} r={3} fill="#DCEBF7" />
      <P d="M12 48V36h6v-6h6v18M26 48V24h8v24M36 48V32h6v16M44 48V28h8v20" fill={W} w={2} />
      <Ln x1={32} y1={8} x2={32} y2={52} />
      <P d="M4 56h56" />
    </>
  ),
  quiet: (
    <>
      <P d="M40 8a20 20 0 1 0 16 30A18 18 0 0 1 40 8z" fill={Y} />
      <T x={20} y={24} size={11}>Z</T>
      <T x={12} y={14} size={8}>z</T>
    </>
  ),
  towels: (
    <>
      <Rc x={10} y={34} w={44} h={10} r={3} fill={W} />
      <Rc x={12} y={24} w={40} h={10} r={3} fill="#9CC4F0" />
      <Rc x={14} y={14} w={36} h={10} r={3} fill={Y} />
      <Rc x={8} y={44} w={48} h={10} r={3} fill={W} />
    </>
  ),
  alarm: (
    <>
      <Ci x={32} y={34} r={20} fill={W} />
      <P d="M32 22v12l8 4" />
      <P d="M10 18l8-8M54 18l-8-8M20 56l-4 4M44 56l4 4" />
    </>
  ),
  safe: (
    <>
      <Rc x={8} y={8} w={48} h={46} r={4} fill={colors.inkLine} />
      <Rc x={14} y={14} w={36} h={34} r={2} fill={colors.line} />
      <Ci x={30} y={31} r={8} fill={W} />
      <P d="M30 25v6h5" w={2} />
      <Rc x={42} y={26} w={4} h={10} r={1} fill={Y} />
    </>
  ),
  upgrade: (
    <>
      <P d="M32 6 12 28h12v26h16V28h12z" fill={Y} />
      <P d="M32 34l2 4 4 .6-3 3 .8 4.4-3.8-2-3.8 2 .8-4.4-3-3 4-.6z" fill={W} w={1.5} />
    </>
  ),
  // ---- diner ------------------------------------------------------------------------------
  'thumbs-up': <P d="M22 56V28l10-20c4 0 6 3 5 8l-2 10h14a4 4 0 0 1 4 5l-4 20a4 4 0 0 1-4 3zM10 28h12v28H10z" fill={Y} />,
  peanut: (
    <>
      <P d="M24 8c-8 0-12 8-10 16 1 4 4 6 4 10s-4 8-2 14c2 8 12 10 18 6 4-3 4-7 6-10s8-4 10-10c3-8-3-16-10-16-6 0-8 4-12 4s-4-14-4-14z" fill="#D9A066" />
      <P d="M20 18c2 2 4 2 6 0M28 44c2 2 4 2 6 0" w={1.5} />
      <Path d="M8 56 56 8" stroke={R} strokeWidth={4} strokeLinecap="round" />
    </>
  ),
  wheat: (
    <>
      <P d="M32 58V14" />
      {[18, 28, 38].map((y) => (
        <Group key={y}>
          <P d={`M32 ${y + 6}c-6 0-10-4-10-10 6 0 10 4 10 10z`} fill={Y} w={2} />
          <P d={`M32 ${y + 6}c6 0 10-4 10-10-6 0-10 4-10 10z`} fill={Y} w={2} />
        </Group>
      ))}
      <Path d="M8 56 56 8" stroke={R} strokeWidth={4} strokeLinecap="round" />
    </>
  ),
  chili: (
    <>
      <P d="M44 14c-8 2-10 10-16 20S12 52 8 54c12 2 30-6 38-20 4-8 2-16-2-20z" fill={R} />
      <P d="M44 14c0-4 2-6 6-8M44 14c2 0 6 2 6 6" fill={GR} />
    </>
  ),
  steak: (
    <>
      <P d="M10 30c0-12 14-20 28-18s18 12 16 22-12 18-26 16S10 42 10 30z" fill="#B5503C" />
      <Ci x={40} y={28} r={6} fill={W} />
      <P d="M20 28c4 4 10 6 16 4" w={2} />
    </>
  ),
  fire: <P d="M32 58c-12 0-20-8-20-18 0-8 6-12 8-20 4 6 8 6 8 6 0-10 4-16 10-20 0 10 14 16 14 32 0 12-8 20-20 20z" fill={R} />,
  fries: (
    <>
      <P d="M18 24v-14M24 24V8M30 24V12M36 24V6M42 24V10M46 24V14" w={3} />
      <Path d="M18 24v-14M24 24V8M30 24V12M36 24V6M42 24V10M46 24V14" stroke={Y} strokeWidth={2} strokeLinecap="round" />
      <P d="M14 24h36l-4 34H18z" fill={R} />
    </>
  ),
  split: (
    <>
      <P d="M8 8h20v44l-4-3-4 3-4-3-4 3-4-3z" fill={W} />
      <P d="M36 12h20v44l-4-3-4 3-4-3-4 3-4-3z" fill={W} />
      <T x={18} y={30} size={9}>½</T>
      <T x={46} y={34} size={9}>½</T>
    </>
  ),
  // ---- coffee shop --------------------------------------------------------------------------
  decaf: (
    <>
      <P d="M12 22h34v18a14 14 0 0 1-14 14h-6a14 14 0 0 1-14-14z" fill={W} />
      <P d="M46 26h4a6 6 0 0 1 0 12h-4" />
      <T x={29} y={42} size={11}>DE</T>
      <T x={48} y={16} size={10}>z</T>
    </>
  ),
  espresso: (
    <>
      <P d="M18 28h22v10a10 10 0 0 1-10 10h-2a10 10 0 0 1-10-10z" fill={W} />
      <P d="M40 32h3a4 4 0 0 1 0 8h-3" />
      <P d="M20 31h18" w={5} />
      <P d="M10 52h40" />
      <T x={52} y={22} size={10}>+1</T>
    </>
  ),
  iced: (
    <>
      <P d="M16 10h32l-4 46H20z" fill="#DCEBF7" />
      <Rc x={22} y={16} w={9} h={9} r={2} fill={W} />
      <Rc x={33} y={20} w={9} h={9} r={2} fill={W} />
      <P d="M19 32h26l-2 24H21z" fill="#C89B6D" />
      <P d="M38 4l-4 16" w={3} />
    </>
  ),
  refill: (
    <>
      <P d="M8 14h22l-2 16H12z" fill={colors.inkLine} />
      <P d="M30 18l8-4" />
      <Path d="M38 16c2 8 2 14 2 18" stroke="#8A5A2B" strokeWidth={3} strokeLinecap="round" fill="none" />
      <P d="M30 36h22v12a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8z" fill={W} />
    </>
  ),
  bagel: (
    <>
      <Ci x={32} y={34} r={22} fill="#D9A066" />
      <Ci x={32} y={34} r={7} fill={W} />
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180;
        return <Ci key={a} x={32 + Math.cos(r) * 14} y={34 + Math.sin(r) * 14} r={1.2} fill={INK} />;
      })}
    </>
  ),
  toaster: (
    <>
      <Rc x={8} y={26} w={48} h={28} r={8} fill={colors.line} />
      <P d="M20 26V14h8v12M34 26V12h8v14" fill="#D9A066" />
      <Rc x={52} y={34} w={6} h={4} r={1} fill={INK} />
    </>
  ),
  outlet: (
    <>
      <Rc x={14} y={10} w={36} h={44} r={6} fill={W} />
      <Rc x={24} y={20} w={4} h={10} r={1} fill={INK} />
      <Rc x={36} y={20} w={4} h={10} r={1} fill={INK} />
      <P d="M28 40a4 4 0 0 1 8 0v4h-8z" fill={INK} />
    </>
  ),
  // ---- gift shop ----------------------------------------------------------------------------
  souvenir: (
    <>
      <Ci x={32} y={28} r={20} fill="#DCEBF7" />
      <P d="M22 38V24h4v14M28 38V16l2-2 2 2v22M34 38V22h6v16" fill={W} w={2} />
      <P d="M16 48h32l-4 10H20z" fill={R} />
    </>
  ),
  gift: (
    <>
      <Rc x={10} y={24} w={44} h={32} r={3} fill={R} />
      <Rc x={8} y={18} w={48} h={10} r={2} fill={R} />
      <Path d="M32 18v38M8 23h48" stroke={Y} strokeWidth={4} />
      <P d="M32 18c-4-10-14-10-12-2 1 3 8 2 12 2zM32 18c4-10 14-10 12-2-1 3-8 2-12 2z" fill={Y} />
    </>
  ),
  mug: (
    <>
      <P d="M12 16h32v32a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8z" fill={W} />
      <P d="M44 24h4a8 8 0 0 1 0 16h-4" />
      <T x={28} y={40} size={10} fill={R}>NY</T>
    </>
  ),
  postcard: (
    <>
      <Rc x={4} y={14} w={56} h={36} r={2} fill={W} />
      <Ln x1={32} y1={20} x2={32} y2={44} w={1.5} />
      <Rc x={44} y={18} w={10} h={12} r={1} fill={R} />
      <Ln x1={36} y1={36} x2={54} y2={36} w={1.5} />
      <Ln x1={36} y1={42} x2={50} y2={42} w={1.5} />
      <P d="M10 26h16M10 32h14M10 38h16" w={1.5} />
    </>
  ),
  sale: (
    <>
      <P d="M30 8h22v22L28 54 8 34z" fill={R} />
      <Ci x={44} y={16} r={3} fill={W} />
      <T x={30} y={36} size={10} fill={W}>-30%</T>
    </>
  ),
  tax: (
    <>
      <P d="M16 6h32v52l-5-4-5 4-6-4-6 4-5-4-5 4z" fill={W} />
      <Ln x1={22} y1={16} x2={42} y2={16} w={2} />
      <Ln x1={22} y1={24} x2={38} y2={24} w={2} />
      <T x={32} y={42} size={11} fill={R}>+TAX</T>
    </>
  ),
  fragile: (
    <>
      <Rc x={8} y={14} w={48} h={40} r={2} fill="#D9A066" />
      <P d="M24 22h16l-2 12a6 6 0 0 1-12 0z" fill={W} w={2} />
      <P d="M32 40v8M27 48h10" w={2} />
      <Path d="M28 24l4 4-3 3" stroke={R} strokeWidth={2} fill="none" />
    </>
  ),
  parcel: (
    <>
      <P d="M8 24l24-12 24 12v24L32 60 8 48z" fill="#D9A066" />
      <P d="M8 24l24 12 24-12M32 36v24" />
      <P d="M44 8l12 4-4 8" w={2} />
      <P d="M56 12C48 14 42 20 40 26" w={2} />
    </>
  ),
  // ---- subway -------------------------------------------------------------------------------
  'day-pass': (
    <>
      <Rc x={6} y={16} w={52} h={32} r={5} fill={Y} />
      <T x={32} y={32} size={10}>1 DAY</T>
      <Ln x1={14} y1={40} x2={50} y2={40} w={2} />
    </>
  ),
  updown: (
    <>
      <P d="M20 54V12M10 22l10-10 10 10" />
      <P d="M44 10v42M34 42l10 10 10-10" />
      <Ci x={20} y={54} r={4} fill={Y} />
      <Ci x={44} y={10} r={4} fill={Y} />
    </>
  ),
  transfer: (
    <>
      <Path d="M6 20h52" stroke={R} strokeWidth={5} strokeLinecap="round" />
      <Path d="M6 44h52" stroke={GR} strokeWidth={5} strokeLinecap="round" />
      <Ci x={32} y={20} r={6} fill={W} />
      <Ci x={32} y={44} r={6} fill={W} />
      <P d="M32 26v12M28 34l4 4 4-4" />
    </>
  ),
  express: (
    <>
      <Rc x={18} y={12} w={40} h={34} r={8} fill={colors.line} />
      <Rc x={22} y={18} w={32} h={12} r={2} fill="#DCEBF7" />
      <Ci x={38} y={40} r={4} fill={R} />
      <P d="M4 20h10M2 30h12M6 40h8" w={3} />
      <P d="M24 46l-4 8M52 46l4 8" />
    </>
  ),
  turnstile: (
    <>
      <Rc x={8} y={20} w={14} h={36} r={2} fill={colors.inkLine} />
      <Rc x={42} y={20} w={14} h={36} r={2} fill={colors.inkLine} />
      <P d="M22 34h20M22 34l14-10M22 34l14 10" w={3} />
      <Rc x={10} y={24} w={10} h={6} r={1} fill={GR} />
    </>
  ),
  // ---- countries ---------------------------------------------------------------------------
  'flag-italy': <Tricolor vertical a="#009246" b={W} c="#CE2B37" />,
  'flag-france': <Tricolor vertical a="#0055A4" b={W} c="#EF4135" />,
  'flag-mexico': (
    <>
      <Tricolor vertical a="#006847" b={W} c="#CE1126" />
      <Ci x={32} y={32} r={4} fill="#8C6A2F" />
    </>
  ),
  'flag-germany': <Tricolor a={INK} b="#DD0000" c="#FFCE00" />,
  'flag-hungary': <Tricolor a="#CE2939" b={W} c="#477050" />,
  'flag-russia': <Tricolor a={W} b="#0039A6" c="#D52B1E" />,
  'flag-spain': (
    <Flag bg="#AA151B">
      <Rect x={FX} y={FY + 9} width={FW} height={18} fill="#F1BF00" />
    </Flag>
  ),
  'flag-portugal': (
    <Flag bg="#FF0000">
      <Rect x={FX} y={FY} width={21} height={FH} fill="#006600" />
      <Circle cx={FX + 21} cy={32} r={7} fill="#FFE000" stroke={INK} strokeWidth={1.5} />
    </Flag>
  ),
  'flag-switzerland': (
    <Flag bg="#DA291C">
      <Rect x={28} y={20} width={8} height={24} fill={W} />
      <Rect x={20} y={28} width={24} height={8} fill={W} />
    </Flag>
  ),
  'flag-sweden': <Nordic bg="#006AA7" cross="#FECC00" />,
  'flag-denmark': <Nordic bg="#C8102E" cross={W} />,
  'flag-uk': (
    <Flag bg="#012169">
      <Line x1={FX} y1={FY} x2={FX + FW} y2={FY + FH} stroke={W} strokeWidth={7} />
      <Line x1={FX + FW} y1={FY} x2={FX} y2={FY + FH} stroke={W} strokeWidth={7} />
      <Line x1={FX} y1={FY} x2={FX + FW} y2={FY + FH} stroke="#C8102E" strokeWidth={2.5} />
      <Line x1={FX + FW} y1={FY} x2={FX} y2={FY + FH} stroke="#C8102E" strokeWidth={2.5} />
      <Rect x={27} y={FY} width={10} height={FH} fill={W} />
      <Rect x={FX} y={27} width={FW} height={10} fill={W} />
      <Rect x={29} y={FY} width={6} height={FH} fill="#C8102E" />
      <Rect x={FX} y={29} width={FW} height={6} fill="#C8102E" />
    </Flag>
  ),
  'flag-usa': (
    <Flag>
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <Rect key={i} x={FX} y={FY + (FH / 13) * i} width={FW} height={FH / 13 + 0.1} fill="#B22234" />
      ))}
      <Rect x={FX} y={FY} width={23} height={(FH / 13) * 7} fill="#3C3B6E" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => <Circle key={`${r}${c}`} cx={FX + 4 + c * 5} cy={FY + 4 + r * 6} r={1.2} fill={W} />),
      )}
    </Flag>
  ),
  'flag-japan': (
    <Flag>
      <Circle cx={32} cy={32} r={10} fill="#BC002D" />
    </Flag>
  ),
  'flag-south-korea': (
    <Flag>
      <Path d="M22 32a10 10 0 0 1 20 0a5 5 0 0 0-10 0a5 5 0 0 1-10 0z" fill="#CD2E3A" />
      <Path d="M22 32a10 10 0 0 0 20 0a5 5 0 0 0-10 0a5 5 0 0 1-10 0z" fill="#0047A0" />
      <Ln x1={11} y1={22} x2={16} y2={18} w={2} />
      <Ln x1={48} y1={18} x2={53} y2={22} w={2} />
      <Ln x1={11} y1={42} x2={16} y2={46} w={2} />
      <Ln x1={48} y1={46} x2={53} y2={42} w={2} />
    </Flag>
  ),

  // ---- paying ------------------------------------------------------------------------------
  contactless: (
    <>
      <Rc x={4} y={22} w={36} h={24} r={4} fill={B} />
      <Rc x={9} y={31} w={8} h={6} r={1.5} fill={Y} />
      <P d="M46 24a12 12 0 0 1 0 20M52 19a19 19 0 0 1 0 30M40 28a6 6 0 0 1 0 12" />
    </>
  ),
  euro: <Note sign="€" fill={B} />,
  change: (
    <>
      <Ci x={26} y={36} r={14} fill={Y} />
      <Ci x={26} y={36} r={9} />
      <Ci x={42} y={26} r={12} fill={Y} />
      <T x={42} y={30.5} size={12}>$</T>
    </>
  ),
  dollar: <Note sign="$" />,
  aud: <Note sign="A$" fill={Y} size={10} />,
  'card-reader': (
    <>
      <Rc x={16} y={6} w={32} h={52} r={5} fill={W} />
      <Rc x={21} y={11} w={22} h={13} r={2} fill={GR} />
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <Ci key={`${r}${c}`} x={25 + c * 7} y={32 + r * 7} r={2} fill={INK} />))}
      <Rc x={4} y={20} w={20} h={13} r={2} fill={B} />
    </>
  ),
  'pin-pad': (
    <>
      <Rc x={14} y={4} w={36} h={56} r={5} fill={W} />
      <Rc x={19} y={9} w={26} h={12} r={2} fill={INK} />
      <T x={32} y={18.5} size={9} fill={Y}>****</T>
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <Rc key={`${r}${c}`} x={19 + c * 9} y={26 + r * 9} w={7} h={6} r={1.5} fill={c === 2 && r === 2 ? GR : Y} />))}
      <Rc x={28} y={53} w={7} h={4} r={1} fill={Y} />
    </>
  ),
  atm: (
    <>
      <Rc x={8} y={4} w={48} h={56} r={4} fill={GR} />
      <Rc x={14} y={10} w={36} h={10} r={2} fill={W} />
      <T x={32} y={18.5} size={9}>ATM</T>
      <Rc x={16} y={25} w={32} h={14} r={2} fill={INK} />
      <Rc x={20} y={45} w={24} h={5} r={1.5} fill={INK} />
      <Rc x={24} y={48} w={16} h={10} r={1} fill={W} />
    </>
  ),
  'currency-exchange': (
    <>
      <Ci x={18} y={22} r={12} fill={B} />
      <T x={18} y={26.5} size={12} fill={W}>€</T>
      <Ci x={46} y={42} r={12} fill={GR} />
      <T x={46} y={46.5} size={12} fill={W}>$</T>
      <P d="M34 14h14v10M30 50H16V40" w={3} />
      <P d="M44 20l4 4 4-4M12 44l4-4 4 4" w={3} />
    </>
  ),
  surcharge: (
    <>
      <Rc x={4} y={20} w={40} h={28} r={4} fill={B} />
      <Rc x={9} y={30} w={8} h={6} r={1.5} fill={Y} />
      <Ci x={48} y={18} r={12} fill={Y} />
      <T x={48} y={22} size={10}>+2%</T>
    </>
  ),
  declined: (
    <>
      <Rc x={4} y={18} w={44} h={30} r={4} fill={B} />
      <Ln x1={4} y1={27} x2={48} y2={27} w={5} />
      <Ci x={46} y={44} r={12} fill={R} />
      <Path d="M41 39l10 10M51 39l-10 10" stroke={W} strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // ---- week 3 · Sydney ------------------------------------------------------------------
  'lost-luggage': (
    <>
      <Rc x={10} y={20} w={30} h={30} r={5} fill={Y} />
      <P d="M19 20v-6h12v6" />
      <Ci x={46} y={20} r={12} fill={W} />
      <T x={46} y={25} size={14} fill={R}>?</T>
    </>
  ),
  damaged: (
    <>
      <Rc x={14} y={18} w={36} h={34} r={5} fill={Y} />
      <P d="M25 18v-6h14v6" />
      <P d="M30 18l-4 10 6 4-4 10 4 10" w={2} />
      <Ci x={22} y={56} r={2.5} fill={INK} />
      <P d="M40 56l4 4M44 56l-4 4" w={2} />
    </>
  ),
  'baggage-desk': (
    <>
      <Rc x={6} y={4} w={52} h={14} r={3} fill={Y} />
      <T x={32} y={14.5} size={8}>BAGGAGE</T>
      <Person x={32} y={10} s={0.7} fill={B} />
      <Rc x={8} y={40} w={48} h={18} r={2} fill={W} />
    </>
  ),
  'ref-number': (
    <>
      <Rc x={6} y={18} w={52} h={28} r={4} fill={W} />
      <T x={32} y={30} size={7}>REF</T>
      <T x={32} y={40} size={9}>SYD48213</T>
    </>
  ),
  'bag-tag': (
    <>
      <Rc x={18} y={18} w={28} h={40} r={4} fill={GR} />
      <Ci x={32} y={26} r={3} fill={W} />
      <P d="M32 23V8M24 8h16" w={2} />
      <T x={32} y={44} size={9} fill={W}>SYD</T>
    </>
  ),
  van: (
    <>
      <P d="M4 44V16h34v28zM38 24h12l8 10v10H38z" fill={W} />
      <Rc x={42} y={27} w={8} h={7} r={1} fill="#DCEBF7" />
      <Ci x={16} y={46} r={5} fill={INK} />
      <Ci x={48} y={46} r={5} fill={INK} />
      <P d="M12 26h18M12 32h12" w={2} />
    </>
  ),
  refund: (
    <>
      <Rc x={14} y={22} w={44} h={26} r={3} fill={GR} />
      <T x={36} y={39} size={11} fill={W}>$</T>
      <P d="M14 14H8a4 4 0 0 0-4 4v12M4 30l-3-4M4 30l3-4" w={3} />
    </>
  ),
  question: (
    <>
      <P d="M8 12h48v32H28l-12 10V44H8z" fill={W} />
      <T x={32} y={35} size={18}>?</T>
    </>
  ),
  meter: (
    <>
      <Rc x={8} y={14} w={48} h={34} r={4} fill={INK} />
      <Rc x={12} y={20} w={40} h={14} r={2} fill={GR} />
      <T x={32} y={31} size={10} fill={W}>$ 0.00</T>
      <Ci x={18} y={41} r={2.5} fill={R} />
      <Ci x={28} y={41} r={2.5} fill={Y} />
    </>
  ),
  'u-turn': (
    <>
      <P d="M18 58V26a12 12 0 0 1 24 0v18" w={4} />
      <P d="M34 38l8 8 8-8" w={4} />
    </>
  ),
  toll: (
    <>
      <P d="M6 20h52" w={4} />
      <Rc x={8} y={20} w={14} h={34} r={2} fill={Y} />
      <Path d="M22 34h34" stroke={R} strokeWidth={4} strokeLinecap="round" />
      <Ci x={44} y={14} r={7} fill={Y} />
      <T x={44} y={17.5} size={9}>$</T>
    </>
  ),
  bridge: (
    <>
      <P d="M4 44h56" w={3} />
      <P d="M8 44c6-30 42-30 48 0" />
      {[16, 24, 32, 40, 48].map((x) => <Ln key={x} x1={x} y1={x === 32 ? 22 : x === 24 || x === 40 ? 25 : 32} x2={x} y2={44} w={1.5} />)}
      <Rc x={4} y={30} w={6} h={24} r={1} fill={colors.line} />
      <Rc x={54} y={30} w={6} h={24} r={1} fill={colors.line} />
      <P d="M2 54c6-3 10 3 16 0s10 3 16 0 10 3 16 0 8 3 12 0" w={2} />
    </>
  ),
  detour: (
    <>
      <Rc x={6} y={8} w={52} h={22} r={3} fill={Y} />
      <T x={32} y={23} size={10}>DETOUR</T>
      <P d="M14 56V44h20l8-8M36 36h6v6" w={3} />
    </>
  ),
  rideshare: (
    <>
      <Rc x={18} y={4} w={28} h={56} r={5} fill={INK} />
      <Rc x={21} y={10} w={22} h={42} r={2} fill={W} />
      <P d="M24 36v-4l3-6h10l3 6v4z" fill={Y} w={1.5} />
      <Ci x={32} y={18} r={3} fill={R} />
    </>
  ),
  'pull-over': (
    <>
      <P d="M50 4v56" w={4} />
      <P d="M14 46V30l14-16" w={3} />
      <P d="M22 14h7v7" w={3} />
      <Rc x={34} y={36} w={12} h={18} r={3} fill={B} />
    </>
  ),
  aircon: (
    <>
      <Rc x={6} y={12} w={52} h={22} r={4} fill={W} />
      <P d="M12 28h40" w={2} />
      <P d="M18 40c-2 4 2 6 0 10M32 40c-2 4 2 6 0 10M46 40c-2 4 2 6 0 10" w={2} />
      <Ci x={50} y={19} r={2} fill={GR} />
    </>
  ),
  noise: (
    <>
      <P d="M8 26h10l12-10v32L18 38H8z" fill={W} />
      <P d="M38 22c4 4 4 16 0 20M44 16c8 8 8 24 0 32M50 10c12 12 12 32 0 44" />
    </>
  ),
  broken: (
    <>
      <P d="M22 8h20l6 22H16z" fill={Y} />
      <P d="M32 30v20M22 56h20" />
      <P d="M28 8l4 8-4 6 6 8" w={2} />
    </>
  ),
  'out-of-order': (
    <>
      <Rc x={6} y={14} w={52} h={36} r={3} fill={W} />
      <T x={32} y={30} size={8} fill={R}>OUT OF</T>
      <T x={32} y={41} size={8} fill={R}>ORDER</T>
    </>
  ),
  leak: (
    <>
      <P d="M10 14h26a8 8 0 0 1 8 8v6h-8v-4H10z" fill={colors.line} />
      <P d="M40 36c-3 5-5 8-2 11s6-1 2-11zM42 50c-2 3-3 5-1 7s4-1 1-7z" fill="#9CC4F0" w={2} />
    </>
  ),
  complaint: (
    <>
      <P d="M8 10h48v34H28L16 54V44H8z" fill={R} />
      <T x={32} y={34} size={20} fill={W}>!</T>
    </>
  ),
  manager: (
    <>
      <Person x={32} y={6} fill={INK} />
      <P d="M32 36l-3 4 3 10 3-10z" fill={R} w={1.5} />
      <Rc x={44} y={44} w={14} h={10} r={2} fill={W} />
    </>
  ),
  overbooked: (
    <>
      <Rc x={10} y={12} w={44} h={42} r={4} fill={W} />
      <Rect x={10} y={12} width={44} height={10} rx={4} fill={R} stroke={INK} strokeWidth={S} />
      <Path d="M22 30l20 18M42 30 22 48" stroke={R} strokeWidth={4} strokeLinecap="round" />
    </>
  ),
  // ---- food problems ----------------------------------------------------------------------
  'wrong-order': (
    <>
      <Ci x={28} y={36} r={20} fill={W} />
      <Ci x={28} y={36} r={12} fill={Y} />
      <Ci x={50} y={14} r={10} fill={R} />
      <Path d="M45 9l10 10M55 9 45 19" stroke={W} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  snowflake: (
    <>
      <P d="M32 6v52M9 19l46 26M9 45l46-26" />
      <P d="M26 10l6 6 6-6M26 54l6-6 6 6" w={2} />
    </>
  ),
  burnt: (
    <>
      <Rc x={14} y={22} w={36} h={30} r={8} fill="#4A3426" />
      <P d="M22 14c-2 3 2 5 0 8M32 10c-2 3 2 5 0 8M42 14c-2 3 2 5 0 8" w={2} />
    </>
  ),
  'double-charge': (
    <>
      <Rc x={4} y={14} w={40} h={26} r={4} fill={B} />
      <Rc x={18} y={26} w={40} h={26} r={4} fill={B} />
      <T x={38} y={44} size={11} fill={W}>×2</T>
    </>
  ),
  free: (
    <>
      <P d="M30 8h22v22L28 54 8 34z" fill={GR} />
      <Ci x={44} y={16} r={3} fill={W} />
      <T x={30} y={36} size={9} fill={W}>FREE</T>
    </>
  ),
  'doggy-bag': (
    <>
      <P d="M14 24h36l-4 32H18z" fill={W} />
      <P d="M14 24l6-10h24l6 10" fill={W} />
      <P d="M26 14c0-6 12-6 12 0" />
    </>
  ),
  // ---- café chat --------------------------------------------------------------------------
  'flat-white': (
    <>
      <P d="M10 26h36v10a16 16 0 0 1-16 16h-4a16 16 0 0 1-16-16z" fill={W} />
      <P d="M46 30h4a6 6 0 0 1 0 12h-4" />
      <P d="M14 30h28" w={5} />
      <P d="M28 34c-4-4-8 0-4 4l4 4 4-4c4-4 0-8-4-4z" fill={W} w={1.5} />
      <P d="M6 56h44" />
    </>
  ),
  swap: (
    <>
      <P d="M10 18h36M38 10l8 8-8 8" w={3} />
      <P d="M54 46H18M26 38l-8 8 8 8" w={3} />
    </>
  ),
  chair: (
    <>
      <P d="M18 8v48M18 32h28v24M18 32V8h22v24" />
      <Rc x={16} y={30} w={32} h={6} r={2} fill={Y} />
    </>
  ),
  globe: (
    <>
      <Ci x={32} y={32} r={24} fill="#9CC4F0" />
      <P d="M20 18c6 2 4 8 10 8s2 8 8 8M40 46c-4-2-8 0-8 4" fill={GR} w={2} />
      <P d="M8 32h48" w={1.5} />
    </>
  ),
  binoculars: (
    <>
      <Ci x={18} y={40} r={12} fill={INK} />
      <Ci x={46} y={40} r={12} fill={INK} />
      <Ci x={18} y={40} r={6} fill="#9CC4F0" />
      <Ci x={46} y={40} r={6} fill="#9CC4F0" />
      <P d="M14 28l4-16h8l2 16M50 28l-4-16h-8l-2 16M28 30h8" fill={colors.inkLine} />
    </>
  ),
  beach: (
    <>
      <Ci x={46} y={16} r={8} fill={Y} />
      <P d="M2 42c8-4 14 4 22 0s14 4 22 0 12 4 16 0v20H2z" fill="#9CC4F0" />
      <P d="M16 34l14-22M30 12c-6-2-14 2-16 8l16-8 2 16c4-6 4-14-2-16z" fill={R} w={2} />
    </>
  ),
  sunset: (
    <>
      <P d="M12 42a20 20 0 0 1 40 0z" fill={Y} />
      <P d="M4 42h56M10 50h44M18 58h28" />
      <P d="M32 8v8M12 16l5 5M52 16l-5 5" w={2} />
    </>
  ),
  // ---- returns & market ----------------------------------------------------------------------
  exchange: (
    <>
      <Rc x={4} y={12} w={20} h={20} r={3} fill={Y} />
      <Rc x={40} y={32} w={20} h={20} r={3} fill={GR} />
      <P d="M28 18h14l-4-4M36 46H22l4 4" w={3} />
    </>
  ),
  faulty: (
    <>
      <P d="M14 38V30a18 18 0 0 1 36 0v8" w={4} />
      <Rc x={8} y={36} w={12} h={18} r={4} fill={INK} />
      <Rc x={44} y={36} w={12} h={18} r={4} fill={INK} />
      <Path d="M28 40l4 6-4 6M36 40l-4 6 4 6" stroke={R} strokeWidth={2.5} fill="none" />
    </>
  ),
  'gift-card': (
    <>
      <Rc x={6} y={16} w={52} h={32} r={5} fill={R} />
      <Path d="M24 16v32M6 30h52" stroke={Y} strokeWidth={4} />
      <T x={41} y={43} size={6.5} fill={W}>CREDIT</T>
    </>
  ),
  warranty: (
    <>
      <P d="M32 6l20 8v16c0 14-10 22-20 28-10-6-20-14-20-28V14z" fill={GR} />
      <Path d="M22 32l7 7 13-14" stroke={W} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  stall: (
    <>
      <P d="M4 22l6-12h44l6 12z" fill={R} />
      <P d="M4 22c0 5 9 5 9 0 0 5 10 5 10 0 0 5 9 5 9 0 0 5 10 5 10 0 0 5 9 5 9 0 0 5 9 5 9 0" fill={W} w={2} />
      <P d="M10 28v30M54 28v30M6 44h52" />
      <Rc x={14} y={36} w={10} h={8} r={1} fill={Y} />
      <Rc x={30} y={36} w={10} h={8} r={1} fill={GR} />
    </>
  ),
  haggle: (
    <>
      <P d="M22 8h18v18L20 46 4 30z" fill={W} />
      <T x={24} y={28} size={9}>$60</T>
      <P d="M46 24v28M38 44l8 8 8-8" w={3} />
    </>
  ),
  handshake: (
    <>
      <P d="M4 28l14-8 10 4 8-4 14 4 10 8-10 12-8 4-14-8-12 4z" fill={Y} />
      <P d="M28 24l8 8M34 36l6 6M28 40l6 6" w={2} />
    </>
  ),
  'stop-hand': (
    <>
      <P d="M22 58V30l-6-8a3 3 0 0 1 5-3l6 7V10a3 3 0 0 1 6 0v14V6a3 3 0 0 1 6 0v18V10a3 3 0 0 1 6 0v18V18a3 3 0 0 1 6 0v22c0 10-6 18-14 18z" fill={R} />
    </>
  ),
  // ---- finding the way ------------------------------------------------------------------------
  lost: (
    <>
      <Person x={26} y={12} s={0.85} />
      <Ci x={48} y={16} r={10} fill={Y} />
      <T x={48} y={21} size={13}>?</T>
    </>
  ),
  turn: (
    <>
      <P d="M32 58V30a8 8 0 0 0-8-8H10M18 14l-8 8 8 8" w={4} />
      <P d="M32 30a8 8 0 0 1 8-8h14M46 14l8 8-8 8" w={4} />
    </>
  ),
  'traffic-light': (
    <>
      <Ln x1={32} y1={44} x2={32} y2={60} w={3} />
      <Rc x={21} y={4} w={22} h={42} r={6} fill={INK} />
      <Ci x={32} y={14} r={5} fill={R} />
      <Ci x={32} y={25} r={5} fill={Y} />
      <Ci x={32} y={36} r={5} fill={GR} />
    </>
  ),
  'town-square': (
    <>
      <Rc x={6} y={10} w={52} h={46} r={4} fill="#E6DFCB" />
      <Ci x={32} y={33} r={14} fill="none" />
      <Ci x={32} y={33} r={7} fill={B} />
      <Ln x1={32} y1={20} x2={32} y2={26} w={2} />
      <Ci x={14} y={18} r={5} fill={GR} />
      <Ci x={50} y={18} r={5} fill={GR} />
      <Ci x={14} y={48} r={5} fill={GR} />
      <Ci x={50} y={48} r={5} fill={GR} />
    </>
  ),
  'turn-left': (
    <>
      <P d="M16 58V30M48 58V30" w={2} />
      <P d="M36 58V32a8 8 0 0 0-8-8H12M20 16l-8 8 8 8" w={4} />
    </>
  ),
  'turn-right': (
    <>
      <P d="M16 58V30M48 58V30" w={2} />
      <P d="M28 58V32a8 8 0 0 1 8-8h16M44 16l8 8-8 8" w={4} />
    </>
  ),
  block: (
    <>
      <Rc x={14} y={14} w={36} h={36} r={2} fill={Y} />
      <P d="M4 10h56M4 54h56M10 4v56M54 4v56" w={2} />
      <Rc x={20} y={20} w={10} h={10} r={1} fill={W} />
      <Rc x={34} y={30} w={10} h={14} r={1} fill={W} />
    </>
  ),
  'street-sign': (
    <>
      <Ln x1={32} y1={22} x2={32} y2={60} w={3} />
      <Rc x={6} y={8} w={52} h={16} r={2} fill={GR} />
      <T x={32} y={19.5} size={8} fill={W}>2ND AVE</T>
      <Rc x={18} y={30} w={28} h={10} r={2} fill={GR} />
      <T x={32} y={37.5} size={7} fill={W}>44 ST</T>
    </>
  ),
  roundabout: (
    <>
      <P d="M28 4v14M36 4v14M28 46v14M36 46v14M4 28h14M4 36h14M46 28h14M46 36h14" w={2} />
      <Ci x={32} y={32} r={17} fill={W} />
      <Ci x={32} y={32} r={8} fill={GR} />
      <P d="M44 20l2 6-6 1M20 44l-2-6 6-1" w={2.5} />
    </>
  ),
  crossroads: (
    <>
      <Rect x={24} y={4} width={16} height={56} fill={W} />
      <Rect x={4} y={24} width={56} height={16} fill={W} />
      <P d="M24 4v20H4M40 4v20h20M24 60V40H4M40 60V40h20" w={2.5} />
      <P d="M32 8v8M32 48v8M8 32h8M48 32h8" w={2} />
    </>
  ),
  'second-exit': (
    <>
      <Ci x={32} y={34} r={15} />
      <Ci x={32} y={34} r={6} fill={GR} />
      <P d="M32 60V49M17 34H6M47 34h11" w={2} />
      <P d="M32 19V4M26 10l6-6 6 6" w={3.5} />
      <Ci x={50} y={14} r={8} fill={Y} />
      <T x={50} y={18} size={10}>2</T>
    </>
  ),
  straight: (
    <>
      <P d="M32 58V8M20 20 32 8l12 12" w={4} />
      <P d="M16 58V30M48 58V30" w={2} />
    </>
  ),
  corner: (
    <>
      <P d="M8 8v48h48" w={3} />
      <Rc x={14} y={34} w={16} h={16} r={2} fill={Y} />
      <P d="M40 20l-6 6M34 20h6v6" w={2} />
    </>
  ),
  opposite: (
    <>
      <Rc x={4} y={8} w={18} h={48} r={2} fill={W} />
      <Rc x={42} y={8} w={18} h={48} r={2} fill={Y} />
      <P d="M24 32h16M34 26l6 6-6 6M30 26l-6 6 6 6" w={2} />
    </>
  ),
  'next-to': (
    <>
      <Rc x={6} y={16} w={24} h={40} r={2} fill={W} />
      <Rc x={34} y={24} w={24} h={32} r={2} fill={Y} />
      <P d="M18 8v4M46 16v4" w={2} />
    </>
  ),
  ferry: (
    <>
      <P d="M6 38h52l-8 12H14z" fill={W} />
      <Rc x={16} y={24} w={30} h={14} r={2} fill={GR} />
      <Rc x={24} y={14} w={14} h={10} r={2} fill={Y} />
      <P d="M2 56c6-3 10 3 16 0s10 3 16 0 10 3 16 0 8 3 12 0" w={2} />
    </>
  ),
  cancelled: (
    <>
      <Rc x={6} y={12} w={52} h={40} r={3} fill={INK} />
      <T x={32} y={28} size={8} fill={Y}>MANLY 15:30</T>
      <Rc x={10} y={34} w={44} h={12} r={2} fill={R} />
      <T x={32} y={43} size={8} fill={W}>CANCELLED</T>
    </>
  ),
  walk: (
    <>
      <Ci x={36} y={10} r={6} fill={Y} />
      <P d="M34 18l-6 18 8 8-2 14M28 36l-8 22M32 22l10 8 8-2M32 22l-12 6-4 8" w={3.5} />
    </>
  ),
  // ---- transfer -------------------------------------------------------------------------
  taxi: (
    <>
      <P d="M8 40v-8l6-12h36l6 12v8z" fill={Y} />
      <P d="M16 30l4-8h24l4 8z" fill={W} />
      <Rc x={26} y={14} w={12} h={5} r={1} fill={INK} />
      <Ci x={18} y={42} r={5} fill={INK} />
      <Ci x={46} y={42} r={5} fill={INK} />
    </>
  ),
  'taxi-sign': (
    <>
      <Ln x1={32} y1={30} x2={32} y2={58} />
      <Rc x={10} y={8} w={44} h={22} r={4} fill={Y} />
      <T x={32} y={24} size={13}>TAXI</T>
    </>
  ),
  'map-pin': (
    <>
      <P d="M32 58S14 38 14 26a18 18 0 0 1 36 0c0 12-18 32-18 32z" fill={R} />
      <Ci x={32} y={26} r={6} fill={W} />
    </>
  ),
  map: (
    <>
      <P d="M8 14l16-6 16 6 16-6v42l-16 6-16-6-16 6z" fill={W} />
      <Ln x1={24} y1={8} x2={24} y2={50} />
      <Ln x1={40} y1={14} x2={40} y2={56} />
      <P d="M14 36c6-6 12 4 20-4s10-6 14-2" w={2} />
      <Ci x={44} y={26} r={3} fill={R} />
    </>
  ),
  clock: (
    <>
      <Ci x={32} y={32} r={22} fill={W} />
      <P d="M32 18v14l9 6" />
      <Ci x={32} y={32} r={2} fill={INK} />
    </>
  ),
  traffic: (
    <>
      <Rc x={22} y={6} w={20} h={46} r={6} fill={colors.inkLine} />
      <Ci x={32} y={16} r={5} fill={R} />
      <Ci x={32} y={29} r={5} fill={Y} />
      <Ci x={32} y={42} r={5} fill={GR} />
      <Ln x1={32} y1={52} x2={32} y2={60} />
    </>
  ),
  card: (
    <>
      <Rc x={6} y={16} w={52} h={34} r={5} fill={B} />
      <Ln x1={6} y1={26} x2={58} y2={26} w={5} />
      <Rc x={12} y={34} w={10} h={8} r={1.5} fill={Y} />
      <Ln x1={30} y1={42} x2={50} y2={42} w={2} />
    </>
  ),
  cash: (
    <>
      <Rc x={6} y={18} w={52} h={28} r={3} fill={GR} />
      <Ci x={32} y={32} r={8} fill={W} />
      <T x={32} y={36.5} size={11}>£</T>
      <Ci x={14} y={32} r={2} fill={W} />
      <Ci x={50} y={32} r={2} fill={W} />
    </>
  ),
  coins: (
    <>
      <Ci x={26} y={36} r={14} fill={Y} />
      <Ci x={26} y={36} r={9} />
      <Ci x={42} y={26} r={12} fill={Y} />
      <T x={42} y={30.5} size={12}>£</T>
    </>
  ),
  receipt: (
    <>
      <P d="M16 6h32v52l-5-4-5 4-6-4-6 4-5-4-5 4z" fill={W} />
      <Ln x1={22} y1={16} x2={42} y2={16} w={2} />
      <Ln x1={22} y1={24} x2={38} y2={24} w={2} />
      <Ln x1={22} y1={32} x2={42} y2={32} w={2} />
      <Ln x1={22} y1={42} x2={42} y2={42} />
    </>
  ),
  // ---- hotel ----------------------------------------------------------------------------
  hotel: (
    <>
      <Rc x={12} y={10} w={40} h={48} r={2} fill={W} />
      {[18, 28, 38].map((y) => (
        <Group key={y}>
          <Rc x={18} y={y} w={8} h={6} r={1} fill={Y} />
          <Rc x={38} y={y} w={8} h={6} r={1} fill={Y} />
        </Group>
      ))}
      <P d="M27 58V48h10v10" fill={B} />
    </>
  ),
  bed: (
    <>
      <P d="M6 50V18M6 36h52v14M58 50V36" />
      <Rc x={10} y={26} w={14} h={10} r={4} fill={W} />
      <P d="M26 36v-8h24a8 8 0 0 1 8 8" fill={Y} />
    </>
  ),
  bell: (
    <>
      <P d="M12 46a20 20 0 0 1 40 0z" fill={Y} />
      <Ln x1={8} y1={50} x2={56} y2={50} w={4} />
      <Ln x1={32} y1={20} x2={32} y2={26} />
      <Ln x1={28} y1={20} x2={36} y2={20} />
    </>
  ),
  'key-card': (
    <>
      <Group rotation={-10} origin="32, 29">
        <Rc x={10} y={14} w={44} h={30} r={5} fill={Y} />
        <Rc x={16} y={20} w={10} h={8} r={1.5} fill={INK} />
      </Group>
      <P d="M34 46l6 10M40 46l4 6" w={2} />
    </>
  ),
  croissant: (
    <>
      <P d="M8 40c4-14 14-22 24-22s20 8 24 22c-6 2-10-2-12-6-4 6-8 8-12 8s-8-2-12-8c-2 4-6 8-12 6z" fill={Y} />
      <P d="M24 26l4 10M40 26l-4 10M32 20v14" w={2} />
    </>
  ),
  lift: (
    <>
      <Rc x={14} y={6} w={36} h={52} r={3} fill={W} />
      <Ln x1={32} y1={14} x2={32} y2={58} />
      <P d="M22 32l4-5 4 5M34 27l4 5 4-5" w={2} />
      <Rect x={26} y={8} width={12} height={4} fill={Y} />
    </>
  ),
  wifi: (
    <>
      <P d="M8 26a34 34 0 0 1 48 0M16 34a22 22 0 0 1 32 0M24 42a10 10 0 0 1 16 0" />
      <Ci x={32} y={50} r={3.5} fill={Y} />
    </>
  ),
  stairs: <P d="M8 54h12V42h12V30h12V18h12V8" fill="none" />,
  door: (
    <>
      <Rc x={18} y={6} w={28} h={52} r={2} fill={B} />
      <Ci x={40} y={34} r={2.5} fill={Y} />
      <P d="M8 58h48" />
    </>
  ),
  // ---- food & drink ---------------------------------------------------------------------
  table: (
    <>
      <P d="M6 26h52M12 26l-4 28M52 26l4 28M20 26v20M44 26v20" />
      <Rc x={22} y={12} w={8} h={14} r={2} fill={Y} />
      <Rc x={34} y={12} w={8} h={14} r={2} fill={Y} />
    </>
  ),
  menu: (
    <>
      <Rc x={14} y={6} w={36} h={52} r={3} fill={R} />
      <Rc x={19} y={12} w={26} h={40} r={2} fill={W} />
      <T x={32} y={22} size={7}>MENU</T>
      <Ln x1={23} y1={30} x2={41} y2={30} w={1.8} />
      <Ln x1={23} y1={37} x2={38} y2={37} w={1.8} />
      <Ln x1={23} y1={44} x2={41} y2={44} w={1.8} />
    </>
  ),
  water: (
    <>
      <P d="M18 12h28l-4 44H22z" fill={W} />
      <P d="M20 28h24l-3 28H23z" fill="#9CC4F0" />
    </>
  ),
  soup: (
    <>
      <P d="M8 30h48a24 24 0 0 1-48 0z" fill={Y} />
      <P d="M24 12c-3 4 3 8 0 12M32 10c-3 4 3 8 0 12M40 12c-3 4 3 8 0 12" w={2} />
    </>
  ),
  salad: (
    <>
      <P d="M8 32h48a24 24 0 0 1-48 0z" fill={W} />
      <P d="M14 32c0-8 6-12 10-10 2-6 10-6 12-2 4-4 12-2 12 6v6" fill={GR} />
      <Ci x={28} y={28} r={3} fill={R} />
    </>
  ),
  fish: (
    <>
      <P d="M8 32c8-12 24-14 36-4l12-8v24l-12-8C32 46 16 44 8 32z" fill={Y} />
      <Ci x={18} y={30} r={2} fill={INK} />
      <P d="M44 50h12M40 56h16" w={3} />
    </>
  ),
  plate: (
    <>
      <Ci x={32} y={34} r={20} fill={W} />
      <Ci x={32} y={34} r={13} fill={Y} />
      <P d="M6 14v14a4 4 0 0 0 4 4v22M6 14v8M10 14v8M14 14v14a4 4 0 0 1-4 4" w={2} />
      <P d="M58 14c-4 2-4 14 0 18v22" w={2} />
    </>
  ),
  leaf: (
    <>
      <P d="M14 50C10 26 26 10 54 10c0 28-16 44-40 40z" fill={GR} />
      <P d="M14 50C24 38 32 30 44 20" w={2} />
    </>
  ),
  coffee: (
    <>
      <P d="M12 22h34v18a14 14 0 0 1-14 14h-6a14 14 0 0 1-14-14z" fill={W} />
      <P d="M46 26h4a6 6 0 0 1 0 12h-4" />
      <P d="M14 26h30" w={6} />
      <P d="M22 8c-2 3 2 6 0 9M30 8c-2 3 2 6 0 9M38 8c-2 3 2 6 0 9" w={2} />
    </>
  ),
  tea: (
    <>
      <P d="M12 24h34v16a14 14 0 0 1-14 14h-6a14 14 0 0 1-14-14z" fill="#E0A85A" />
      <P d="M46 28h4a6 6 0 0 1 0 12h-4" />
      <P d="M34 24V12" w={1.5} />
      <Rc x={30} y={8} w={8} h={6} r={1} fill={Y} />
    </>
  ),
  latte: (
    <>
      <P d="M16 10h32l-4 46H20z" fill={W} />
      <P d="M18 26h28l-1.5 14h-25z" fill="#C89B6D" />
      <P d="M19.5 40h25l-1.5 16H21z" fill="#F3E3CC" />
    </>
  ),
  takeaway: (
    <>
      <P d="M18 16h28l-4 42H22z" fill={W} />
      <Rc x={14} y={10} w={36} h={7} r={2} fill={INK} />
      <P d="M20 30h24l-1.5 14h-21z" fill={Y} />
    </>
  ),
  milk: (
    <>
      <P d="M22 20l4-8h12l4 8v36H22z" fill={W} />
      <Rc x={26} y={6} w={12} h={6} r={1} fill={B} />
      <P d="M22 32h20v14H22z" fill="#9CC4F0" />
    </>
  ),
  sugar: (
    <>
      <Rc x={10} y={26} w={20} h={20} r={2} fill={W} />
      <Rc x={34} y={30} w={20} h={20} r={2} fill={W} />
      <Rc x={22} y={10} w={20} h={18} r={2} fill={W} />
    </>
  ),
  cake: (
    <>
      <Rc x={10} y={30} w={44} h={24} r={3} fill={Y} />
      <P d="M10 38c6 4 10-4 15 0s10 4 15 0 9-4 14 0" fill="none" />
      <Rc x={30} y={16} w={4} h={14} r={1} fill={W} />
      <P d="M32 8c-3 3 0 6 0 6s3-3 0-6z" fill={R} w={1.5} />
    </>
  ),
  sizes: (
    <>
      <Rc x={4} y={22} w={16} h={20} r={3} fill={W} />
      <Rc x={23} y={18} w={18} h={28} r={3} fill={Y} />
      <Rc x={44} y={14} w={16} h={36} r={3} fill={W} />
      <T x={12} y={36} size={10}>S</T>
      <T x={32} y={36} size={11}>M</T>
      <T x={52} y={36} size={11}>L</T>
    </>
  ),
  // ---- shopping -------------------------------------------------------------------------
  jacket: (
    <>
      <P d="M22 8l-14 8v40h14V30M42 8l14 8v40H42V30" fill={B} />
      <P d="M22 8l10 12 10-12M22 8v48h20V8" fill={B} />
      <Ln x1={32} y1={20} x2={32} y2={56} />
    </>
  ),
  shirt: (
    <>
      <P d="M22 8l-14 10 6 10 6-4v32h24V24l6 4 6-10-14-10c-2 4-6 6-10 6s-8-2-10-6z" fill={R} />
    </>
  ),
  shoes: (
    <>
      <P d="M6 46v-12c6 0 10-6 12-10h8c2 8 10 10 20 12 8 2 12 6 12 10z" fill={Y} />
      <P d="M6 46h52v6H6z" fill={INK} />
    </>
  ),
  'fitting-room': (
    <>
      <P d="M8 8h48" />
      <P d="M12 8c0 16 6 32 0 50h22V8" fill={R} />
      <Person x={46} y={12} s={0.85} fill={Y} />
    </>
  ),
  mirror: (
    <>
      <P d="M32 6c10 0 16 10 16 22S42 52 32 52 16 40 16 28 22 6 32 6z" fill="#DCEBF7" />
      <P d="M24 20l6-6M24 30l12-12" w={2} />
      <P d="M24 58h16M32 52v6" />
    </>
  ),
  tag: (
    <>
      <P d="M30 8h22v22L28 54 8 34z" fill={Y} />
      <Ci x={44} y={16} r={3} fill={W} />
      <T x={30} y={36} size={11}>£</T>
    </>
  ),
  'too-small': (
    <>
      <P d="M24 18l-10 6 4 7 4-3v18h20V28l4 3 4-7-10-6c-2 3-4 4-8 4s-6-1-8-4z" fill={R} />
      <P d="M6 10v44M58 10v44M2 14l4-4 4 4M54 14l4-4 4 4" w={2} />
    </>
  ),
  bag: (
    <>
      <P d="M12 22h40l-4 34H16z" fill={Y} />
      <P d="M24 26v-8a8 8 0 0 1 16 0v8" />
    </>
  ),
  check: (
    <>
      <Ci x={32} y={32} r={24} fill={GR} />
      <Path d="M20 33l8 8 16-17" stroke={W} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  cross: (
    <>
      <Ci x={32} y={32} r={24} fill={R} />
      <Path d="M22 22l20 20M42 22 22 42" stroke={W} strokeWidth={5} strokeLinecap="round" fill="none" />
    </>
  ),
  // ---- transport ------------------------------------------------------------------------
  ticket: (
    <>
      <P d="M6 20h52v8a4 4 0 0 0 0 8v8H6v-8a4 4 0 0 0 0-8z" fill={Y} />
      <P d="M42 20v24" w={1.5} />
      <Ln x1={14} y1={30} x2={34} y2={30} w={2} />
      <Ln x1={14} y1={36} x2={28} y2={36} w={2} />
    </>
  ),
  'arrow-right': (
    <>
      <Ci x={14} y={32} r={6} fill={Y} />
      <P d="M22 32h32M44 22l10 10-10 10" />
    </>
  ),
  'arrows-both': (
    <>
      <P d="M10 24h40M40 14l10 10-10 10" />
      <P d="M54 42H14M24 32 14 42l10 10" />
      <Ci x={10} y={24} r={4} fill={Y} />
    </>
  ),
  metro: (
    <>
      <Circle cx={32} cy={32} r={20} stroke={R} strokeWidth={8} fill={W} />
      <Rect x={6} y={27} width={52} height={10} fill={B} stroke={INK} strokeWidth={1.5} />
      <T x={32} y={35.5} size={8} fill={W}>METRO</T>
    </>
  ),
  line: (
    <>
      <P d="M6 46c10 0 12-28 26-28s16 28 26 28" fill="none" w={5} />
      <Path d="M6 46c10 0 12-28 26-28s16 28 26 28" stroke={R} strokeWidth={3} fill="none" />
      {[6, 32, 58].map((x, i) => (
        <Ci key={x} x={x} y={i === 1 ? 18 : 46} r={4.5} fill={W} />
      ))}
    </>
  ),
  platform: (
    <>
      <Rc x={8} y={8} w={30} h={34} r={8} fill={W} />
      <Rc x={12} y={14} w={22} h={10} r={2} fill="#9CC4F0" />
      <Ci x={16} y={34} r={2} fill={INK} />
      <Ci x={30} y={34} r={2} fill={INK} />
      <P d="M4 50h56" w={4} />
      <Rc x={44} y={14} w={14} h={14} r={2} fill={Y} />
      <T x={51} y={25} size={11}>2</T>
    </>
  ),
  'bus-stop': (
    <>
      <Ln x1={20} y1={18} x2={20} y2={58} />
      <Ci x={20} y={14} r={10} fill={R} />
      <T x={20} y={17.5} size={8} fill={W}>BUS</T>
      <Rc x={30} y={30} w={26} h={20} r={2} fill={W} />
      <Ln x1={34} y1={36} x2={52} y2={36} w={1.8} />
      <Ln x1={34} y1={42} x2={48} y2={42} w={1.8} />
    </>
  ),
  bus: (
    <>
      <Rc x={10} y={8} w={44} h={44} r={6} fill={R} />
      <Rc x={14} y={14} w={36} h={16} r={2} fill={W} />
      <Ci x={20} y={42} r={3} fill={Y} />
      <Ci x={44} y={42} r={3} fill={Y} />
      <P d="M16 52v6M48 52v6" w={4} />
    </>
  ),
  // ---- people & basics ------------------------------------------------------------------
  me: (
    <>
      <Person x={30} y={4} />
      <P d="M54 14c-6 2-10 10-12 22" w={2.5} />
      <P d="M40 30l2 7 5-5" w={2.5} />
    </>
  ),
  you: (
    <>
      <Person x={40} y={4} />
      <P d="M6 40h14l6-6" w={3} />
      <P d="M20 40c2 2 6 2 8 0" w={2} />
    </>
  ),
  man: <Person x={32} y={4} fill={B} />,
  woman: <Person x={32} y={4} fill={R} hair="long" />,
  we: (
    <>
      <Person x={18} y={8} s={0.85} fill={Y} />
      <Person x={46} y={8} s={0.85} fill={Y} />
      <Person x={32} y={4} s={0.95} fill={Y} />
    </>
  ),
  they: (
    <>
      <Person x={14} y={14} s={0.7} fill={colors.line} />
      <Person x={32} y={14} s={0.7} fill={colors.line} />
      <Person x={50} y={14} s={0.7} fill={colors.line} />
    </>
  ),
  wave: (
    <>
      <P d="M22 56V30l-6-8a3 3 0 0 1 5-3l6 7V12a3 3 0 0 1 6 0v12V8a3 3 0 0 1 6 0v16V12a3 3 0 0 1 6 0v28c0 10-6 16-14 16z" fill={Y} />
      <P d="M50 10c4 2 6 6 6 10M8 20c0-4 2-8 6-10" w={2} />
    </>
  ),
  hands: (
    <>
      <P d="M30 56V24c0-6-4-12-6-14-3 2-4 8-4 14v10l-6 12 6 10z" fill={Y} />
      <P d="M34 56V24c0-6 4-12 6-14 3 2 4 8 4 14v10l6 12-6 10z" fill={Y} />
    </>
  ),
  heart: <P d="M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z" fill={R} />,
  sorry: (
    <>
      <Ci x={32} y={32} r={24} fill={Y} />
      <P d="M22 26c2-2 6-2 8 0M34 26c2-2 6-2 8 0M24 44c4-4 12-4 16 0" />
    </>
  ),
  'raise-hand': (
    <>
      <Person x={26} y={18} s={0.85} />
      <P d="M36 40l8-24" w={3} />
      <Ci x={45} y={12} r={4} fill={Y} />
    </>
  ),
  toilet: (
    <>
      <Rc x={6} y={14} w={52} h={36} r={5} fill={B} />
      <T x={32} y={38} size={18} fill={W}>WC</T>
    </>
  ),
  help: (
    <>
      <Ci x={32} y={32} r={24} fill={R} />
      <T x={32} y={37} size={14} fill={W}>SOS</T>
    </>
  ),
};
