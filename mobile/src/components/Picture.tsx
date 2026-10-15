import type { ReactNode } from 'react';
import Svg, { Circle, G as Group, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors, fonts } from '@/theme';

/**
 * The word pictures: one simple drawing per concrete word, in the app's ink-and-yellow style.
 * All share a 64×64 grid, a 2.5 stroke and at most two accent colours, so they read as a set
 * and can later be swapped for professional illustrations without touching the content.
 */
export function Picture({ name, size = 72, label }: { name: string; size?: number; label?: string }) {
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
      {drawing}
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
