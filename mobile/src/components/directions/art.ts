import { closedSegments, type Place, type PlaceKind, type Point, segmentKey, SIZE, type TownSpec } from '@/lib/directions';

import { at, blockFrame, FIRST, halfWidth, LAST, nodeXY, PAVEMENT, type Street, streets, VIEW } from './geo';
import { type Look, lookOf } from './looks';
import {
  add,
  circlePath,
  curve,
  f,
  type Frame,
  frameAt,
  hull,
  len,
  lerp,
  mul,
  Painter,
  perp,
  pick,
  rand,
  rectPts,
  sample,
  shade,
  soft,
  sub,
  unit,
  wobble,
  type XY,
  Z,
} from './paint';
import { vehicleParts, type VehicleKind } from './vehicles';

const up = (p: XY, h: number): XY => ({ x: p.x, y: p.y - h });
/** Depth of a building by how far south its front stands. */
const zOf = (y: number) => Z.building + Math.floor(Math.max(0, y + 60) / 22) * 0.01;
const CLOTHES = ['#5C6B7A', '#A35D4B', '#6E7F5A', '#C49A4A', '#7A6A8A', '#3E4D5C', '#D9D3C7', '#8B5E4A'];

/** A street traffic drives along; on a dead end (a street stopping at the quay) cars turn back. */
export type Lane = { pts: XY[]; cum: number[]; length: number; offset: number; major: boolean; deadEnd?: boolean };
export type StreetLabel = { text: string; at: XY; angle: number; major: boolean };
export type Badge = { id: string; kind: PlaceKind; name: string; at: XY; label: XY };
export type Water = { shore: XY[]; normal: XY[]; lane: XY[] } | null;

export type TownArt = {
  painter: Painter;
  labels: StreetLabel[];
  badges: Badge[];
  grounds: Record<string, string>;
  lanes: Lane[];
  water: Water;
  look: Look;
};

// ---- water ----------------------------------------------------------------------------------

/** The shore runs a short promenade beyond the last street on the water side. */
function waterOf(town: TownSpec): Water {
  if (!town.water) {
    return null;
  }
  const side = town.water;
  const edge = side === 'north' || side === 'west' ? 0 : SIZE - 1;
  const outer = side === 'north' || side === 'west' ? -1 : SIZE;
  const axis = side === 'north' || side === 'south' ? 'H' : 'V';
  const shore: XY[] = [];
  const normal: XY[] = [];
  const lane: XY[] = [];
  const d = halfWidth(town, axis, edge) + PAVEMENT + 11;
  for (let k = FIRST - 1; k <= LAST + 1; k++) {
    const p = nodeXY(town, axis === 'H' ? [k, edge] : [edge, k]);
    const q = nodeXY(town, axis === 'H' ? [k, outer] : [outer, k]);
    const n = unit(sub(q, p));
    shore.push(add(p, mul(n, d + 3 * wobble(k, edge, 11))));
    normal.push(n);
    lane.push(add(p, mul(n, d + 15 + 2 * wobble(k, edge, 12))));
  }
  return { shore, normal, lane };
}

function waterSide(water: NonNullable<Water>): (p: XY) => boolean {
  const pts = sample(water.shore, 0, water.shore.length - 1, 3);
  return (p: XY) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dd = (pts[i].p.x - p.x) ** 2 + (pts[i].p.y - p.y) ** 2;
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    }
    const s = pts[best];
    // The shore's normal, pointing out to the water: turn the tangent towards the water side.
    const n0 = water.normal[Math.min(water.normal.length - 1, Math.round((best / pts.length) * (water.normal.length - 1)))];
    const t = perp(s.dir);
    const n = t.x * n0.x + t.y * n0.y > 0 ? t : mul(t, -1);
    return (p.x - s.p.x) * n.x + (p.y - s.p.y) * n.y > 0;
  };
}

// ---- small things ---------------------------------------------------------------------------

function tree(P: Painter, look: Look, c: XY, r: number, seed: number, kind?: 'palm' | 'blossom' | 'dark') {
  const lifted = up(c, r * 0.5);
  P.circle(Z.treeShadow, { fill: 'rgba(46,56,34,0.18)' }, add(c, { x: r * 0.55, y: r * 0.3 }), r * 0.95);
  if (kind === 'palm') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + wobble(seed, i, 3) * 0.3;
      const tip = add(lifted, { x: Math.cos(a) * r * 1.25, y: Math.sin(a) * r * 1.25 });
      const side = mul(perp({ x: Math.cos(a), y: Math.sin(a) }), r * 0.28);
      const mid = lerp(lifted, tip, 0.45);
      P.poly(Z.tree, { fill: i % 2 ? '#8CA96A' : '#7F9E61' }, [lifted, add(mid, side), tip, sub(mid, side)]);
    }
    P.circle(Z.treeLight, { fill: '#8A7656' }, lifted, r * 0.18);
    return;
  }
  const color = kind === 'blossom' && look.blossom ? look.blossom : kind === 'dark' ? look.treeDark : pick(look.trees, seed, r, 4);
  P.circle(Z.tree, { fill: color }, lifted, r);
  P.circle(Z.treeLight, { fill: shade(color, -0.2) }, add(lifted, { x: -r * 0.3, y: -r * 0.32 }), r * 0.5);
}

function person(P: Painter, c: XY, seed: number) {
  const a = rand(seed, 1, 7) * Math.PI * 2;
  const body: XY[] = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2;
    const x = Math.cos(t) * 1.75;
    const y = Math.sin(t) * 1.05;
    body.push({ x: c.x + x * Math.cos(a) - y * Math.sin(a), y: c.y + x * Math.sin(a) + y * Math.cos(a) });
  }
  P.circle(Z.people - 0.5, { fill: 'rgba(30,30,30,0.13)' }, add(c, { x: 0.9, y: 0.5 }), 1.6);
  P.poly(Z.people, { fill: pick(CLOTHES, seed, 2, 9) }, body);
  P.circle(Z.people + 0.5, { fill: '#4B3F37' }, c, 0.9);
}

function bench(P: Painter, c: XY, angle: number) {
  const F = frameAt(c, angle);
  P.poly(Z.furniture, { fill: 'rgba(30,30,30,0.12)' }, rectPts(F, -1.4, -0.2, 3.6, 1.3));
  P.poly(Z.furniture + 0.1, { fill: '#9A7B5C' }, rectPts(F, -1.8, -0.6, 3.6, 1.2));
}

/** A vehicle painted into the static map (parked, moored). */
export function paintVehicle(P: Painter, kind: VehicleKind, color: string, c: XY, angleDeg: number, z: number = Z.onGround) {
  const F = frameAt(c, angleDeg);
  for (const part of vehicleParts(kind, color)) {
    P.poly(z, { fill: part.fill }, rectPts(F, part.x, part.y, part.w, part.h));
  }
}

// ---- buildings ------------------------------------------------------------------------------

type Ctx = { P: Painter; look: Look; wet: (p: XY) => boolean; town: TownSpec };

/** An ordinary building: a box with a pitched or flat roof and the details of its city. */
function building(ctx: Ctx, F: Frame, x: number, y: number, w: number, h: number, seed: number, heightBoost = 0) {
  const { P, look } = ctx;
  const foot = rectPts(F, x, y, w, h);
  if (foot.some(ctx.wet) || w < 2 || h < 2) {
    return;
  }
  const [lo, hi] = look.height;
  const height = lo + rand(seed, 3, 1) * (hi - lo) + heightBoost;
  const roof = pick(look.roofs, seed, 5, 2);
  const wall = shade(roof, 0.2);
  const z = zOf(Math.max(...foot.map((p) => p.y)));
  const top = P.box(foot, height, roof, wall, { z });
  const pitched = rand(seed, 8, 8) < look.pitched && height < 10;
  const mid = (a: XY, b: XY) => lerp(a, b, 0.5);
  const [a, b, c, d] = top;
  if (pitched) {
    if (w >= h) {
      P.poly(z + 0.002, { fill: shade(roof, -0.1) }, [a, b, mid(b, c), mid(a, d)]);
      P.poly(z + 0.002, { fill: shade(roof, 0.07) }, [mid(a, d), mid(b, c), c, d]);
      P.line(z + 0.003, { stroke: shade(roof, 0.2), width: 0.45 }, [mid(a, d), mid(b, c)]);
    } else {
      P.poly(z + 0.002, { fill: shade(roof, -0.1) }, [a, mid(a, b), mid(d, c), d]);
      P.poly(z + 0.002, { fill: shade(roof, 0.07) }, [mid(a, b), b, c, mid(d, c)]);
      P.line(z + 0.003, { stroke: shade(roof, 0.2), width: 0.45 }, [mid(a, b), mid(d, c)]);
    }
    if (ctx.town.look !== 'sydney' && rand(seed, 4, 4) > 0.45) {
      const t = 0.2 + rand(seed, 5, 5) * 0.6;
      const p = w >= h ? lerp(mid(a, d), mid(b, c), t) : lerp(mid(a, b), mid(d, c), t);
      P.poly(z + 0.004, { fill: '#857870' }, [add(p, { x: -0.8, y: -1.6 }), add(p, { x: 0.8, y: -1.6 }), add(p, { x: 0.8, y: 0.2 }), add(p, { x: -0.8, y: 0.2 })]);
    }
  } else {
    P.path(z + 0.002, { stroke: shade(roof, 0.12), width: 0.5, fill: 'none' }, soft(insetSimple(top, 0.9), 0.4));
    const roll = rand(seed, 9, 6);
    const cx = lerp(lerp(a, b, 0.35 + rand(seed, 1, 2) * 0.3), lerp(d, c, 0.35 + rand(seed, 1, 2) * 0.3), 0.5);
    if (ctx.town.look === 'newyork' && height > 9 && roll > 0.55 && w > 6 && h > 6) {
      // Wooden water tower on legs.
      P.circle(z + 0.003, { fill: 'rgba(40,36,30,0.25)' }, add(cx, { x: 1.6, y: 0.8 }), 2.1);
      P.circle(z + 0.004, { fill: '#8E6F56' }, up(cx, 1.8), 2.1);
      P.circle(z + 0.005, { fill: '#A5836A' }, up(cx, 2.4), 1.5);
    } else if (ctx.town.look === 'sydney' && roll > 0.5 && w > 5 && h > 5) {
      // Solar panels.
      const F2 = frameAt(cx, (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
      P.poly(z + 0.003, { fill: '#5E6C7A' }, rectPts(F2, -w * 0.3, -h * 0.25, w * 0.6, h * 0.5));
      P.line(z + 0.004, { stroke: '#8695A3', width: 0.3 }, [F2(0, -h * 0.25), F2(0, h * 0.25)]);
    } else if (roll > 0.35) {
      P.poly(z + 0.003, { fill: '#E3E1DB', stroke: '#BDB9B0', width: 0.35 }, [add(cx, { x: -1.2, y: -0.9 }), add(cx, { x: 1.2, y: -0.9 }), add(cx, { x: 1.2, y: 0.9 }), add(cx, { x: -1.2, y: 0.9 })]);
    }
  }
  // Floors on the facade that faces us.
  if (height >= 8) {
    const bl = foot[3];
    const br = foot[2];
    for (let k = 3; k < height - 1; k += 3) {
      P.line(z + 0.0005, { stroke: 'rgba(255,255,255,0.26)', width: 0.45 }, [up(bl, k), up(br, k)]);
    }
  }
}

/** Plain polygon inset, good enough for small rectangles. */
function insetSimple(poly: XY[], d: number): XY[] {
  const c = mul(poly.reduce((s, p) => add(s, p), { x: 0, y: 0 }), 1 / poly.length);
  return poly.map((p) => add(p, mul(unit(sub(c, p)), d * 1.4)));
}

type Lot = { x: number; y: number; w: number; h: number };

/** Buildings around the edge of a block with a courtyard or gardens behind them. */
function perimeter(w: number, h: number, seed: number, room: number, landmarkTop?: number): { lots: Lot[]; yard: Lot } {
  const lots: Lot[] = [];
  const depth = Math.max(9, Math.min(15, Math.min(w, h) * 0.24));
  const hw = w / 2;
  const top = -h / 2 + room;
  const bottom = h / 2;
  const run = (from: number, to: number, make: (a: number, b: number, d: number) => Lot) => {
    let a = from;
    let k = 0;
    while (a < to - 3) {
      let size = 6 + rand(seed, k, 3) * 9;
      if (to - (a + size) < 5) size = to - a;
      const d = depth * (0.82 + rand(seed, k, 4) * 0.22);
      lots.push(make(a, a + size - 0.9, d));
      a += size;
      k++;
    }
  };
  run(-hw, hw, (a, b, d) => ({ x: a, y: top, w: b - a, h: d }));
  const sideEnd = landmarkTop !== undefined ? landmarkTop - 1.5 : bottom - depth - 0.9;
  if (landmarkTop === undefined) {
    run(-hw, hw, (a, b, d) => ({ x: a, y: bottom - d, w: b - a, h: d }));
  }
  const sideTop = top + depth + 0.9;
  run(sideTop, sideEnd, (a, b, d) => ({ x: -hw, y: a, w: d * 0.9, h: b - a }));
  run(sideTop, sideEnd, (a, b, d) => ({ x: hw - d * 0.9, y: a, w: d * 0.9, h: b - a }));
  const yard = { x: -hw + depth * 0.9 + 1, y: sideTop, w: w - depth * 1.8 - 2, h: sideEnd - sideTop };
  return { lots, yard };
}

function cityBlock(ctx: Ctx, block: Point, span: Point, seed: number, landmark?: (zone: Zone) => XY) {
  const { P, look } = ctx;
  const bf = blockFrame(ctx.town, block, span);
  if (bf.ground.every(ctx.wet)) {
    return null;
  }
  const { F, width: w, height: h } = bf;
  P.path(Z.ground, { fill: look.courtyard }, soft(bf.ground, 2.5));
  const room = Math.min(look.height[1] * 0.6, h * 0.12);
  const landmarkTop = landmark ? -h / 2 + h * 0.4 : undefined;
  const { lots, yard } = perimeter(w, h, seed, room, landmarkTop);
  // Gardens or a paved yard behind the buildings.
  if (yard.w > 4 && yard.h > 4) {
    const garden = rand(seed, 2, 21) < look.garden;
    const yardPts = rectPts(F, yard.x, yard.y, yard.w, yard.h);
    if (garden && !yardPts.some(ctx.wet)) {
      P.poly(Z.groundDetail, { fill: shade(look.park, -0.06) }, yardPts);
      for (let x = yard.x + 6; x < yard.x + yard.w - 2; x += 5 + rand(seed, x, 1) * 3) {
        P.line(Z.groundDetail + 0.1, { stroke: 'rgba(120,112,92,0.28)', width: 0.4 }, [F(x, yard.y), F(x, yard.y + yard.h * 0.42)]);
        P.line(Z.groundDetail + 0.1, { stroke: 'rgba(120,112,92,0.28)', width: 0.4 }, [F(x, yard.y + yard.h * 0.58), F(x, yard.y + yard.h)]);
      }
      const n = Math.round((yard.w * yard.h) / 260);
      for (let i = 0; i < n; i++) {
        const p = F(yard.x + 3 + rand(seed, i, 31) * (yard.w - 6), yard.y + 3 + rand(seed, i, 32) * (yard.h - 6));
        tree(P, look, p, 1.8 + rand(seed, i, 33) * 2, seed + i, look.palms && i % 3 === 0 ? 'palm' : look.blossom && i % 4 === 1 ? 'blossom' : undefined);
      }
    } else if (!garden && yard.w > 14 && yard.h > 10 && rand(seed, 3, 3) > 0.5) {
      // A parking court with a couple of cars.
      for (let i = 0; i < 3; i++) {
        if (rand(seed, i, 41) > 0.45) {
          const p = F(yard.x + 4 + i * 5, yard.y + yard.h / 2);
          if (!ctx.wet(p)) paintVehicle(P, 'car', pick(look.cars, seed, i, 42), p, bf.angle + 90);
        }
      }
    }
  }
  for (let i = 0; i < lots.length; i++) {
    const l = lots[i];
    building(ctx, F, l.x, l.y, l.w, l.h, seed * 31 + i);
  }
  if (landmark && landmarkTop !== undefined) {
    const zone: Zone = { F, W: w / 2 - 0.5, y0: landmarkTop, y1: h / 2, angle: bf.angle, z: zOf(F(0, h / 2).y) + 0.004, seed };
    return { anchor: landmark(zone), bf };
  }
  return { anchor: bf.centre, bf };
}

type Zone = { F: Frame; W: number; y0: number; y1: number; angle: number; z: number; seed: number };

/** Box helper in a zone's frame. */
function zbox(ctx: Ctx, zn: Zone, x: number, y: number, w: number, h: number, height: number, roof: string, part = 0, wall?: string) {
  return ctx.P.box(rectPts(zn.F, x, y, w, h), height, roof, wall ?? shade(roof, 0.2), { z: zn.z + part * 0.0012 });
}

function colonnade(P: Painter, z: number, a: XY, b: XY, height: number, step: number, color = '#F2EEE5') {
  const n = Math.max(2, Math.floor(len(sub(b, a)) / step));
  for (let i = 0; i <= n; i++) {
    const p = lerp(a, b, 0.06 + (i / n) * 0.88);
    P.line(z, { stroke: color, width: 0.9 }, [up(p, 0.4), up(p, height - 0.8)]);
  }
}

function centreOf(pts: XY[]): XY {
  return mul(pts.reduce((s, p) => add(s, p), { x: 0, y: 0 }), 1 / pts.length);
}

const LANDMARKS: Partial<Record<PlaceKind, (ctx: Ctx, zn: Zone) => XY>> = {
  museum(ctx, zn) {
    const { P } = ctx;
    const { W, y0, y1, F } = zn;
    const H = ctx.town.look === 'newyork' ? 12 : 9;
    const top = zbox(ctx, zn, -W + 0.5, y0 + 1, W * 2 - 1, y1 - y0 - 9, H, '#DCD3C2', 0, '#BEB29C');
    // A dome with ribs and a lantern.
    const c = up(centreOf(top), 2);
    const R = Math.min(W * 0.36, (y1 - y0) * 0.26);
    P.circle(zn.z + 0.004, { fill: 'rgba(60,50,40,0.18)' }, add(c, { x: 2.5, y: 2 }), R + 1);
    P.circle(zn.z + 0.005, { fill: '#C9BFAA' }, c, R + 1);
    P.circle(zn.z + 0.006, { fill: '#A7B8AE' }, up(c, 2), R);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      P.line(zn.z + 0.007, { stroke: '#93A69B', width: 0.45 }, [up(c, 2), add(up(c, 2), { x: Math.cos(a) * R, y: Math.sin(a) * R })]);
    }
    P.circle(zn.z + 0.008, { fill: '#C3D0C8' }, add(up(c, 2), { x: -R * 0.32, y: -R * 0.36 }), R * 0.36);
    P.circle(zn.z + 0.009, { fill: '#87988E' }, up(c, 3.2), 1.1);
    // The portico with its columns, the pediment and the steps.
    P.poly(Z.groundDetail, { fill: '#E7E0D1' }, rectPts(F, -W * 0.5, y1 - 4.5, W, 4.5));
    for (let i = 0; i < 3; i++) P.line(Z.groundDetail + 0.1, { stroke: '#D6CDBB', width: 0.5 }, [F(-W * 0.5, y1 - 3.6 + i * 1.3), F(W * 0.5, y1 - 3.6 + i * 1.3)]);
    const port = zbox(ctx, zn, -W * 0.42, y1 - 11, W * 0.84, 6.5, H - 1, '#E2DACB', 2, '#A59A86');
    const [a, b, cc, d] = port;
    P.poly(zn.z + 0.0035, { fill: '#E8E1D3' }, [a, lerp(a, b, 0.5), lerp(d, cc, 0.5), d]);
    P.poly(zn.z + 0.0035, { fill: '#D2C8B5' }, [lerp(a, b, 0.5), b, cc, lerp(d, cc, 0.5)]);
    colonnade(P, zn.z + 0.0026, F(-W * 0.42, y1 - 4.5), F(W * 0.42, y1 - 4.5), H - 1, 2.6);
    return up(c, R + 5);
  },

  bank(ctx, zn) {
    const { P } = ctx;
    const { W, y0, y1, F } = zn;
    const H = ctx.town.look === 'newyork' ? 16 : 11;
    const foot = [F(-W + 0.5, y0 + 1), F(W - 0.5, y0 + 1), F(W - 0.5, y1 - 8), F(W - 7.5, y1 - 1), F(-W + 0.5, y1 - 1)];
    const top = P.box(foot, H, '#CDC6BA', '#B0A797', { z: zn.z });
    colonnade(P, zn.z + 0.0005, F(-W + 2, y1 - 1), F(W - 8.5, y1 - 1), H, 2.8);
    colonnade(P, zn.z + 0.0005, F(W - 7.5, y1 - 1), F(W - 0.5, y1 - 8), H, 2.6);
    // Cornice, a glazed banking hall in the roof, and a flag.
    P.path(zn.z + 0.002, { stroke: '#B8AF9F', width: 0.8, fill: 'none' }, soft(insetSimple(top, 1), 0.3));
    const c = centreOf(top);
    const F2 = frameAt(c, zn.angle);
    P.poly(zn.z + 0.003, { fill: '#B7C5CA', stroke: '#9FAEB4', width: 0.4 }, rectPts(F2, -W * 0.35, -3.5, W * 0.7, 7));
    for (let i = -2; i <= 2; i++) P.line(zn.z + 0.004, { stroke: '#A3B2B8', width: 0.35 }, [F2(i * W * 0.12, -3.5), F2(i * W * 0.12, 3.5)]);
    const base = top[0];
    const pole = add(base, { x: 2.5, y: 2.5 });
    P.line(zn.z + 0.005, { stroke: '#5B6168', width: 0.6 }, [pole, up(pole, 8)]);
    P.poly(zn.z + 0.006, { fill: '#3F5A7A' }, [up(pole, 8), add(up(pole, 8), { x: 5.5, y: 0.6 }), add(up(pole, 4.6), { x: 5.2, y: 0.6 }), up(pole, 4.6)]);
    return up(c, 6);
  },

  hotel(ctx, zn) {
    const { P } = ctx;
    const { W, y0, y1, F } = zn;
    const H = ctx.town.look === 'newyork' ? 30 : ctx.town.look === 'sydney' ? 22 : 18;
    zbox(ctx, zn, -W + 0.5, y1 - 13, W * 2 - 1, 12, 4, '#D5CFC4', 0);
    // Canopy over the entrance.
    zbox(ctx, zn, -6, y1 - 1.5, 12, 3.5, 3, '#3F454B', 1, '#2F3438');
    const tw = W * 1.35;
    const top = zbox(ctx, zn, -W + 2, y0 + 1, tw, y1 - y0 - 10, H, '#E4DFD5', 2, '#C2B9AB');
    const [a, b, c, d] = top;
    for (let k = 3; k < H - 1; k += 3) P.line(zn.z + 0.0029, { stroke: 'rgba(255,255,255,0.32)', width: 0.5 }, [up(F(-W + 2, y1 - 9), k), up(F(-W + 2 + tw, y1 - 9), k)]);
    // Rooftop pool with a deck and loungers, on the east side of the roof (the badge sits on the west).
    const deck = [lerp(a, b, 0.55), lerp(a, b, 0.93), lerp(d, c, 0.93), lerp(d, c, 0.55)].map((p, i) => lerp(p, i < 2 ? lerp(d, c, 0.74) : lerp(a, b, 0.74), 0.12));
    P.poly(zn.z + 0.004, { fill: '#D9C8AE' }, deck);
    const pool = deck.map((p) => lerp(p, centreOf(deck), 0.3));
    P.poly(zn.z + 0.005, { fill: '#9CCFDD', stroke: '#FFFFFF', width: 0.6 }, pool);
    P.line(zn.z + 0.006, { stroke: 'rgba(255,255,255,0.7)', width: 0.4 }, [lerp(pool[0], pool[3], 0.35), lerp(pool[1], pool[2], 0.3)]);
    for (let i = 0; i < 3; i++) {
      const p = lerp(lerp(deck[0], deck[1], 0.2 + i * 0.3), deck[3], 0.08);
      P.poly(zn.z + 0.006, { fill: '#FFFFFF' }, [add(p, { x: -0.6, y: -0.4 }), add(p, { x: 0.6, y: -0.4 }), add(p, { x: 0.6, y: 1.4 }), add(p, { x: -0.6, y: 1.4 })]);
    }
    return up(lerp(lerp(a, d, 0.5), lerp(b, c, 0.5), 0.28), 3);
  },

  pharmacy(ctx, zn) {
    const { P } = ctx;
    const { W, y0, y1, F } = zn;
    const pw = W * 1.15;
    const top = zbox(ctx, zn, -W + 0.5, y0 + 4, pw, y1 - y0 - 5, 5, '#E3E0D8', 0, '#C9C4BA');
    // Green band over the shop front and a green cross on the roof.
    P.poly(zn.z + 0.0006, { fill: '#3E8A5C' }, [up(F(-W + 0.5, y1 - 1), 3.2), up(F(-W + 0.5 + pw, y1 - 1), 3.2), up(F(-W + 0.5 + pw, y1 - 1), 4.8), up(F(-W + 0.5, y1 - 1), 4.8)]);
    const c = centreOf(top);
    const F2 = frameAt(c, zn.angle);
    const arm = Math.min(5, pw * 0.22);
    const t = arm * 0.42;
    const cross = [[-t, -arm], [t, -arm], [t, -t], [arm, -t], [arm, t], [t, t], [t, arm], [-t, arm], [-t, t], [-arm, t], [-arm, -t], [-t, -t]].map(([x, y]) => F2(x, y));
    P.poly(zn.z + 0.003, { fill: '#3E8A5C', stroke: '#FFFFFF', width: 0.8 }, cross);
    building(ctx, F, -W + 1.5 + pw, y0 + 2, W * 2 - pw - 2, y1 - y0 - 3, zn.seed + 7);
    return up(c, 9);
  },

  post(ctx, zn) {
    const { P, look } = ctx;
    const { W, y0, y1, F } = zn;
    const pw = W * 1.3;
    const top = zbox(ctx, zn, -W + 0.5, y0 + 2, pw, y1 - y0 - 3, 7, '#CDBBA6', 0, '#B08B74');
    P.path(zn.z + 0.002, { stroke: '#B0473B', width: 1, fill: 'none' }, soft(insetSimple(top, 0.8), 0.3));
    // Pillar boxes on the pavement and vans in the yard.
    for (const x of [-W * 0.55, -W * 0.25]) {
      const p = F(x, y1 + 1.2);
      P.circle(Z.furniture, { fill: 'rgba(30,30,30,0.15)' }, add(p, { x: 0.8, y: 0.5 }), 1.4);
      P.circle(Z.furniture + 0.1, { fill: '#A8433A' }, up(p, 1), 1.3);
      P.circle(Z.furniture + 0.2, { fill: '#C35A4E' }, up(p, 1.4), 0.7);
    }
    const yard = rectPts(F, -W + 1.5 + pw, y0 + 2, W * 2 - pw - 2, y1 - y0 - 3);
    P.poly(Z.groundDetail, { fill: shade(look.courtyard, 0.05) }, yard);
    const cy = centreOf(yard);
    paintVehicle(P, 'van', '#B0473B', add(cy, mul(unit(sub(yard[1], yard[0])), -2)), zn.angle + 90);
    paintVehicle(P, 'van', '#B0473B', add(cy, mul(unit(sub(yard[1], yard[0])), 2.4)), zn.angle + 90);
    return up(centreOf(top), 10);
  },

  supermarket(ctx, zn) {
    const { P, look } = ctx;
    const { W, y0, y1, F } = zn;
    const hall = (y1 - y0) * 0.5;
    const top = zbox(ctx, zn, -W + 0.5, y0 + 1, W * 2 - 1, hall, 6, '#DCDAD4', 0, '#BDB9B0');
    P.poly(zn.z + 0.0006, { fill: '#477591' }, [up(F(-W + 0.5, y0 + 1 + hall), 4), up(F(W - 0.5, y0 + 1 + hall), 4), up(F(W - 0.5, y0 + 1 + hall), 5.6), up(F(-W + 0.5, y0 + 1 + hall), 5.6)]);
    const [a, b, , d] = top;
    for (let i = 1; i <= 3; i++) {
      P.line(zn.z + 0.003, { stroke: '#C5D1D5', width: 1.3 }, [lerp(lerp(a, d, i / 4), lerp(b, top[2], i / 4), 0.08), lerp(lerp(a, d, i / 4), lerp(b, top[2], i / 4), 0.6)]);
    }
    for (let i = 0; i < 3; i++) {
      const p = lerp(lerp(a, b, 0.72 + i * 0.08), d, 0.3 + (i % 2) * 0.3);
      P.poly(zn.z + 0.003, { fill: '#ECEAE5', stroke: '#B9B5AC', width: 0.35 }, [add(p, { x: -1.5, y: -1 }), add(p, { x: 1.5, y: -1 }), add(p, { x: 1.5, y: 1 }), add(p, { x: -1.5, y: 1 })]);
    }
    // The car park.
    const lotY = y0 + hall + 2.5;
    const lot = rectPts(F, -W + 0.5, lotY, W * 2 - 1, y1 - lotY - 0.5);
    P.poly(Z.groundDetail, { fill: shade(look.road, -0.12) }, lot);
    const bays = Math.floor((W * 2 - 4) / 4.2);
    for (let i = 0; i <= bays; i++) {
      const x = -W + 2 + i * 4.2;
      P.line(Z.groundDetail + 0.1, { stroke: '#FFFFFF', width: 0.4 }, [F(x, lotY + 0.5), F(x, lotY + 6)]);
      P.line(Z.groundDetail + 0.1, { stroke: '#FFFFFF', width: 0.4 }, [F(x, y1 - 6.5), F(x, y1 - 1)]);
      if (i < bays && rand(zn.seed, i, 51) > 0.35) paintVehicle(P, 'car', pick(look.cars, zn.seed, i, 52), F(x + 2.1, lotY + 3.2), zn.angle + 90);
      if (i < bays && rand(zn.seed, i, 53) > 0.5) paintVehicle(P, 'car', pick(look.cars, zn.seed, i, 54), F(x + 2.1, y1 - 3.8), zn.angle - 90);
    }
    return up(centreOf(top), 9);
  },

  station(ctx, zn) {
    const { P, look } = ctx;
    const { W, y0, y1, F } = zn;
    // Tracks running right through the block, a train, the glass train shed, the concourse and its clock tower.
    const tY = y0 + 11;
    P.poly(Z.groundDetail, { fill: '#CFC9BD' }, rectPts(F, -W - 4, tY, W * 2 + 8, y1 - tY - 0.5));
    const rails = [tY + 2.5, tY + (y1 - tY) / 2, y1 - 3];
    for (const ry of rails) {
      P.line(Z.groundDetail + 0.1, { stroke: '#9A9286', width: 0.45 }, [F(-W - 4, ry - 0.8), F(W + 4, ry - 0.8)]);
      P.line(Z.groundDetail + 0.1, { stroke: '#9A9286', width: 0.45 }, [F(-W - 4, ry + 0.8), F(W + 4, ry + 0.8)]);
    }
    const trainY = rails[1];
    for (let i = 0; i < 3; i++) {
      const x0 = W * 0.05 + i * 9.2;
      zbox(ctx, { ...zn, z: zn.z - 0.002 }, x0, trainY - 2, 8.8, 4, 2.5, '#E9E7E2', 0, look.bus);
    }
    const shed = zbox(ctx, zn, -W + 0.5, tY - 1, W * 1.35, y1 - tY, 6, '#C3D1D7', 1, '#97A5AC');
    const [a, b, c, d] = shed;
    for (let i = 1; i < 10; i++) P.line(zn.z + 0.003, { stroke: '#A9B9C0', width: 0.5 }, [lerp(a, b, i / 10), lerp(d, c, i / 10)]);
    P.line(zn.z + 0.003, { stroke: '#DCE6EA', width: 1.4 }, [lerp(a, d, 0.5), lerp(b, c, 0.5)]);
    zbox(ctx, zn, -W + 0.5, y0 + 1, W * 2 - 1, 8.5, 8, '#CBBFAE', 0, '#AA9C87');
    const tower = zbox(ctx, zn, -W + 3, y0 + 2, 5, 5, 20, '#8E8F93', 3, '#B6A891');
    const face = up(lerp(F(-W + 3, y0 + 7), F(-W + 8, y0 + 7), 0.5), 15);
    P.circle(zn.z + 0.0045, { fill: '#F5F2EA', stroke: '#6E6A62', width: 0.4 }, face, 1.6);
    P.line(zn.z + 0.0046, { stroke: '#3B4147', width: 0.4 }, [face, up(face, 1.1)]);
    return up(lerp(centreOf(tower), centreOf(shed), 0.6), 10);
  },

  cafe(ctx, zn) {
    return terrace(ctx, zn, 'round');
  },
  restaurant(ctx, zn) {
    return terrace(ctx, zn, 'square');
  },

  market(ctx, zn) {
    const { P } = ctx;
    const { W, y0, y1, F } = zn;
    const top = zbox(ctx, zn, -W + 0.5, y0 + 1, W * 2 - 1, 10, 7, '#B9B3A8', 0, '#9C9384');
    const [a, b, c, d] = top;
    P.poly(zn.z + 0.002, { fill: '#C6C0B6' }, [a, b, lerp(b, c, 0.5), lerp(a, d, 0.5)]);
    P.line(zn.z + 0.003, { stroke: '#8F887C', width: 0.5 }, [lerp(a, d, 0.5), lerp(b, c, 0.5)]);
    const awnings = ['#8A7A42', '#4F7A92', '#A85C45', '#5E7F58'];
    const cols = Math.max(3, Math.floor((W * 2) / 9));
    const sw = (W * 2 - 2) / cols;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < cols; i++) {
        const x = -W + 1 + i * sw;
        const y = y0 + 14 + row * ((y1 - y0 - 16) / 2);
        const color = awnings[(i + row) % awnings.length];
        const t = zbox(ctx, zn, x + 0.6, y, sw - 1.6, 5, 2.6, '#F0E8D8', 1 + row, shade(color, 0.1));
        P.poly(zn.z + 0.0012 * (1 + row) + 0.002, { fill: color }, [t[0], lerp(t[0], t[1], 0.33), lerp(t[3], t[2], 0.33), t[3]]);
        P.poly(zn.z + 0.0012 * (1 + row) + 0.002, { fill: color }, [lerp(t[0], t[1], 0.66), t[1], t[2], lerp(t[3], t[2], 0.66)]);
      }
    }
    for (let i = 0; i < 7; i++) person(P, F(-W + 3 + rand(zn.seed, i, 61) * (W * 2 - 6), y0 + 12 + rand(zn.seed, i, 62) * (y1 - y0 - 13)), zn.seed + i);
    return up(centreOf(top), 9);
  },

  gallery(ctx, zn) {
    const { P } = ctx;
    const { W, y0, y1 } = zn;
    const top = zbox(ctx, zn, -W + 0.5, y0 + 2, W * 2 - 1, y1 - y0 - 3, 8, '#D7D2C8', 0, '#B7AFA2');
    const [a, b, c, d] = top;
    for (let i = 0; i < 6; i++) {
      const t0 = 0.1 + i * 0.14;
      P.poly(zn.z + 0.003, { fill: '#9C968A' }, [lerp(a, d, t0), lerp(b, c, t0), lerp(b, c, t0 + 0.05), lerp(a, d, t0 + 0.05)]);
      P.poly(zn.z + 0.003, { fill: '#C6D2D6' }, [lerp(a, d, t0 + 0.05), lerp(b, c, t0 + 0.05), lerp(b, c, t0 + 0.08), lerp(a, d, t0 + 0.08)]);
    }
    return up(centreOf(top), 6);
  },

  theatre(ctx, zn) {
    const { P } = ctx;
    const { W, y0, y1, F } = zn;
    zbox(ctx, zn, -W * 0.5, y0 + 1, W, 8, 16, '#A89BA1', 0, '#8E7F86');
    const fan: XY[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (0.15 + (i / 10) * 0.7);
      fan.push(F(Math.cos(a) * W * 0.95, y0 + 8 + Math.sin(a) * (y1 - y0 - 9)));
    }
    fan.push(F(-W * 0.6, y0 + 8), F(W * 0.6, y0 + 8));
    const top = P.box(hull(fan), 9, '#BCAFB4', '#9B8B92', { z: zn.z + 0.002 });
    return up(centreOf(top), 6);
  },
};

function terrace(ctx: Ctx, zn: Zone, shape: 'round' | 'square'): XY {
  const { P, look } = ctx;
  const { W, y0, y1, F } = zn;
  const mid = (y0 + y1) / 2;
  const roof = pick(look.roofs, zn.seed, 1, 71);
  const top = zbox(ctx, zn, -W + 0.5, y0 + 1, W * 2 - 1, mid - y0 - 1, 5, roof, 0);
  const awning = shape === 'round' ? ['#946640', '#EFE6D6'] : ['#6E7F5A', '#EFE6D6'];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = F(-W + 0.5 + (i / n) * (W * 2 - 1), mid);
    const b = F(-W + 0.5 + ((i + 1) / n) * (W * 2 - 1), mid);
    P.poly(zn.z + 0.0007, { fill: awning[i % 2] }, [up(a, 3.2), up(b, 3.2), up(b, 4.6), up(a, 4.6)]);
  }
  P.poly(Z.groundDetail, { fill: '#E3D8C4' }, rectPts(F, -W + 0.5, mid + 1, W * 2 - 1, y1 - mid - 1.5));
  const count = Math.max(2, Math.floor((W * 2) / 11));
  for (let i = 0; i < count; i++) {
    const c = F(-W + 5 + i * ((W * 2 - 10) / Math.max(1, count - 1)), mid + (y1 - mid) / 2 + 0.5);
    person(P, add(c, { x: -3.2, y: 1.6 }), zn.seed + i * 3);
    person(P, add(c, { x: 3, y: -1.2 }), zn.seed + i * 3 + 1);
    const lifted = up(c, 3);
    P.circle(Z.furniture, { fill: 'rgba(40,36,30,0.15)' }, add(c, { x: 1.6, y: 0.8 }), 3.6);
    if (shape === 'round') {
      P.circle(Z.sign, { fill: '#EFE7D8', stroke: '#CDBFA6', width: 0.4 }, lifted, 3.7);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        P.line(Z.sign + 0.1, { stroke: '#D6C9B1', width: 0.35 }, [lifted, add(lifted, { x: Math.cos(a) * 3.7, y: Math.sin(a) * 3.7 })]);
      }
    } else {
      const F2 = frameAt(lifted, zn.angle + 45);
      P.poly(Z.sign, { fill: '#B48A6C', stroke: '#9C735A', width: 0.4 }, rectPts(F2, -2.8, -2.8, 5.6, 5.6));
      P.line(Z.sign + 0.1, { stroke: '#9C735A', width: 0.35 }, [F2(-2.8, -2.8), F2(2.8, 2.8)]);
      P.line(Z.sign + 0.1, { stroke: '#9C735A', width: 0.35 }, [F2(2.8, -2.8), F2(-2.8, 2.8)]);
    }
    P.circle(Z.sign + 0.2, { fill: '#B6A68C' }, lifted, 0.5);
  }
  return up(centreOf(top), 8);
}

// ---- parks and squares ----------------------------------------------------------------------

function park(ctx: Ctx, place: Place) {
  const { P, look } = ctx;
  const span = place.span ?? [1, 1];
  const bf = blockFrame(ctx.town, place.block, span);
  const { F, width: w, height: h } = bf;
  const seed = place.block[0] * 7 + place.block[1] * 13 + 3;
  P.path(Z.ground, { fill: look.park }, soft(bf.ground, 4));
  P.path(Z.groundDetail + 0.5, { fill: 'none', stroke: look.parkEdge, width: 2.2 }, soft(bf.ground, 4));
  const hw = w / 2;
  const hh = h / 2;
  const pathStyle = { stroke: '#EDE6D4', width: 2.4, fill: 'none', cap: 'round' as const };
  const p1 = [F(-hw, hh * 0.45), F(-hw * 0.3, hh * 0.05), F(hw * 0.1, hh * 0.85), F(hw, hh * 0.3)];
  const p2 = [F(-hw * 0.15, -hh), F(-hw * 0.35, -hh * 0.2), F(hw * 0.25, hh * 0.2), F(hw * 0.05, hh)];
  const d1 = `M${f(p1[0].x)} ${f(p1[0].y)} C${f(p1[1].x)} ${f(p1[1].y)} ${f(p1[2].x)} ${f(p1[2].y)} ${f(p1[3].x)} ${f(p1[3].y)}`;
  const d2 = `M${f(p2[0].x)} ${f(p2[0].y)} C${f(p2[1].x)} ${f(p2[1].y)} ${f(p2[2].x)} ${f(p2[2].y)} ${f(p2[3].x)} ${f(p2[3].y)}`;
  P.path(Z.groundDetail + 1, pathStyle, d1);
  P.path(Z.groundDetail + 1, pathStyle, d2);
  // Pond.
  const pc = { x: hw * 0.32, y: -hh * 0.32 };
  const rx = Math.min(20, w * 0.2);
  const ry = Math.min(12, h * 0.15);
  const pond: XY[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const k = 1 + 0.16 * wobble(seed, i, 5);
    pond.push(F(pc.x + Math.cos(a) * rx * k, pc.y + Math.sin(a) * ry * k));
  }
  P.path(Z.groundDetail + 2, { fill: look.water, stroke: look.waterEdge, width: 0.7 }, closedCurve(pond));
  P.path(Z.groundDetail + 2.1, { fill: 'none', stroke: 'rgba(255,255,255,0.55)', width: 0.5 }, `M${f(F(pc.x - rx * 0.4, pc.y).x)} ${f(F(pc.x - rx * 0.4, pc.y).y)} q3 -1.2 6 0`);
  // Flower beds, a bandstand, trees and benches.
  const beds = [
    { x: -hw * 0.55, y: -hh * 0.5, c: '#D2A08E' },
    { x: hw * 0.55, y: hh * 0.55, c: '#C4A8BB' },
  ];
  for (const b of beds) {
    P.path(Z.groundDetail + 2, { fill: b.c, stroke: shade(b.c, 0.12), width: 0.5 }, circlePath(F(b.x, b.y), 3.4));
  }
  const pav = F(-hw * 0.18, hh * 0.38);
  const oct: XY[] = [];
  for (let i = 0; i < 8; i++) oct.push(add(pav, { x: Math.cos((i / 8) * Math.PI * 2) * 4, y: Math.sin((i / 8) * Math.PI * 2) * 4 }));
  const top = P.box(oct, 3.5, '#9DA79F', '#B9B2A2', { z: zOf(pav.y) });
  P.circle(zOf(pav.y) + 0.003, { fill: '#B1BAB3' }, centreOf(top), 1.5);
  const avoid = (x: number, y: number) =>
    Math.hypot((x - pc.x) / (rx + 5), (y - pc.y) / (ry + 5)) < 1 || Math.hypot(F(x, y).x - pav.x, F(x, y).y - pav.y) < 8;
  const n = Math.round((w * h) / 120);
  for (let i = 0; i < n; i++) {
    // Trees gather in clumps rather than sprinkling evenly.
    const clump = i % 5;
    const cx = wobble(seed, clump, 8) * hw * 0.8;
    const cy = wobble(seed, clump, 9) * hh * 0.8;
    const x = Math.max(-hw + 3, Math.min(hw - 3, cx + wobble(seed, i, 10) * hw * 0.45));
    const y = Math.max(-hh + 3, Math.min(hh - 3, cy + wobble(seed, i, 11) * hh * 0.45));
    if (avoid(x, y)) continue;
    const r = 2.2 + rand(seed, i, 12) * 3.4;
    const kind = look.palms && rand(seed, i, 13) > 0.8 ? 'palm' : look.blossom && rand(seed, i, 14) > 0.85 ? 'blossom' : rand(seed, i, 15) > 0.82 ? 'dark' : undefined;
    tree(P, look, F(x, y), r, seed + i, kind);
  }
  // Edge trees along the railings.
  const ring = bf.ground;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const steps = Math.floor(len(sub(b, a)) / 13);
    for (let k = 1; k < steps; k++) {
      const p = lerp(a, b, k / steps);
      tree(P, look, add(p, mul(unit(sub(bf.centre, p)), 3)), 2.6 + rand(seed, k, i) * 1.2, seed + k * 7 + i, look.palms && k % 3 === 0 ? 'palm' : undefined);
    }
  }
  bench(P, F(-hw * 0.3, hh * 0.05 - 2.6), bf.angle - 15);
  bench(P, F(hw * 0.4, hh * 0.45 - 2.4), bf.angle + 20);
  for (let i = 0; i < 6; i++) {
    const t = rand(seed, i, 16);
    const p = i % 2 ? lerp(lerp(p1[0], p1[1], t), lerp(p1[2], p1[3], t), t) : lerp(lerp(p2[0], p2[1], t), lerp(p2[2], p2[3], t), t);
    person(P, p, seed + i * 11);
  }
  return { anchor: bf.centre, bf };
}

function closedCurve(pts: XY[]): string {
  const ext = [...pts, pts[0], pts[1], pts[2]];
  return `${curve(ext, 1, ext.length - 2)}Z`;
}

function square(ctx: Ctx, place: Place) {
  const { P, look } = ctx;
  const bf = blockFrame(ctx.town, place.block, place.span ?? [1, 1]);
  const { F, width: w, height: h } = bf;
  const seed = place.block[0] * 11 + place.block[1] * 5 + 9;
  P.path(Z.ground, { fill: '#E9E2D2' }, soft(bf.ground, 2.5));
  const R = Math.min(w, h) / 2 - 3;
  const c = bf.centre;
  P.circle(Z.groundDetail, { fill: '#E1D8C5' }, c, R);
  P.path(Z.groundDetail + 0.2, { fill: 'none', stroke: '#D5CAB4', width: 0.7 }, circlePath(c, R));
  P.path(Z.groundDetail + 0.2, { fill: 'none', stroke: '#D5CAB4', width: 0.6 }, circlePath(c, R * 0.6));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + (bf.angle * Math.PI) / 180;
    P.line(Z.groundDetail + 0.2, { stroke: '#DDD3BF', width: 0.45 }, [add(c, { x: Math.cos(a) * R * 0.6, y: Math.sin(a) * R * 0.6 }), add(c, { x: Math.cos(a) * R, y: Math.sin(a) * R })]);
  }
  // Fountain.
  P.circle(Z.onGround, { fill: '#CFC4AE' }, c, 8);
  P.circle(Z.onGround + 0.1, { fill: look.water }, c, 6.8);
  P.circle(Z.onGround + 0.2, { fill: 'none', stroke: 'rgba(255,255,255,0.7)', width: 0.6 }, c, 4.2);
  P.circle(Z.onGround + 0.3, { fill: '#C9C0AC' }, c, 2);
  P.circle(Z.onGround + 0.4, { fill: '#E6F0F3' }, up(c, 1.2), 1.1);
  // Trees in planters at the corners, benches facing the fountain, people.
  const corners = [F(-w / 2 + 5, -h / 2 + 5), F(w / 2 - 5, -h / 2 + 5), F(w / 2 - 5, h / 2 - 5), F(-w / 2 + 5, h / 2 - 5)];
  corners.forEach((p, i) => {
    P.circle(Z.onGround, { fill: '#CDBFA6' }, p, 3.8);
    tree(P, look, p, 3.6, seed + i, look.palms && i % 2 ? 'palm' : undefined);
  });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 360 + 45 + bf.angle;
    const p = add(c, { x: Math.cos((a * Math.PI) / 180) * R * 0.78, y: Math.sin((a * Math.PI) / 180) * R * 0.78 });
    bench(P, p, a + 90);
  }
  for (let i = 0; i < 10; i++) {
    const a = rand(seed, i, 2) * Math.PI * 2;
    const r = 10 + rand(seed, i, 3) * (R - 10);
    person(P, add(c, { x: Math.cos(a) * r, y: Math.sin(a) * r }), seed + i * 5);
  }
  // A kiosk with a striped awning.
  const kiosk = F(-w / 2 + 6, h / 2 - 14);
  const top = P.box(rectPts(frameAt(kiosk, bf.angle), -2.5, -2, 5, 4), 3, '#E9E3D6', '#C9BFAE', { z: zOf(kiosk.y) });
  P.poly(zOf(kiosk.y) + 0.002, { fill: '#857860' }, [top[0], lerp(top[0], top[1], 0.5), lerp(top[3], top[2], 0.5), top[3]]);
  return { anchor: c, bf };
}

// ---- roads ----------------------------------------------------------------------------------

type Run = { street: Street; from: number; to: number };

function streetRuns(town: TownSpec, list: Street[]): Run[] {
  const closed = closedSegments(town);
  const out: Run[] = [];
  for (const s of list) {
    let start = 0;
    const end = s.points.length - 1;
    const cut: number[] = [];
    for (let i = 0; i < end; i++) {
      const a = s.nodes[i];
      const b = s.nodes[i + 1];
      const inside = (p: Point) => p[0] >= 0 && p[1] >= 0 && p[0] < SIZE && p[1] < SIZE;
      if (inside(a) && inside(b) && closed.has(segmentKey(a, b))) cut.push(i);
    }
    for (const i of cut) {
      if (i > start) out.push({ street: s, from: start, to: i });
      start = i + 1;
    }
    if (start < end) out.push({ street: s, from: start, to: end });
  }
  return out;
}

function roads(ctx: Ctx, list: Street[], water: Water, wet: ((p: XY) => boolean) | null): Run[] {
  const { P, look, town } = ctx;
  const runs = streetRuns(town, list).filter((r) => !(wet && r.street.points.slice(r.from, r.to + 1).every(wet)));
  for (const r of runs) {
    const d = curve(r.street.points, r.from, r.to);
    const w = r.street.major ? 12.5 : 8.5;
    P.path(Z.casing, { stroke: look.kerb, width: w + 1.6, fill: 'none', join: 'round' }, d);
    P.path(r.street.major ? Z.road + 0.5 : Z.road, { stroke: r.street.major ? look.roadMajor : look.road, width: w, fill: 'none', join: 'round' }, d);
    if (r.street.major) {
      // A dashed centre line that stops short of each crossing.
      for (let i = r.from; i < r.to; i++) {
        const pts = sample(r.street.points, i, i + 1, 2).map((s) => s.p);
        const trim = Math.ceil(pts.length * 0.16);
        if (pts.length > trim * 2 + 2) {
          P.path(Z.roadMark, { stroke: look.marking, width: 0.7, fill: 'none', dash: '4 4' }, `M${pts.slice(trim, -trim).map((p) => `${f(p.x)} ${f(p.y)}`).join('L')}`);
        }
      }
    }
  }
  // Bridges: parapets where a street crosses the water.
  if (water && wet && look.bridges) {
    for (const r of runs) {
      const pts = sample(r.street.points, r.from, r.to, 2).filter((s) => wet(s.p));
      if (pts.length < 2) continue;
      const half = (r.street.major ? 12.5 : 8.5) / 2 + 1;
      for (const side of [-1, 1]) {
        const line = pts.map((s) => add(s.p, mul(perp(s.dir), side * half)));
        P.line(Z.roadTop, { stroke: '#BDB5A6', width: 1.5, cap: 'round' }, line);
        if (side === 1) P.line(Z.casing - 1, { stroke: 'rgba(40,60,80,0.18)', width: 3 }, line.map((p) => add(p, { x: 2, y: 1.5 })));
      }
    }
  }
  return runs;
}

/** Zebra crossings on every arm of every crossing in the playing grid. */
function crossings(ctx: Ctx) {
  const { P, look, town } = ctx;
  const closed = closedSegments(town);
  for (let c = 0; c < SIZE; c++) {
    for (let r = 0; r < SIZE; r++) {
      const here: Point = [c, r];
      const isRb = !!town.roundabout && town.roundabout[0] === c && town.roundabout[1] === r;
      const centre = nodeXY(town, here);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const there: Point = [c + dc, r + dr];
        const inGrid = there[0] >= 0 && there[1] >= 0 && there[0] < SIZE && there[1] < SIZE;
        if (inGrid && closed.has(segmentKey(here, there))) continue;
        const across = dr === 0 ? halfWidth(town, 'V', c) : halfWidth(town, 'H', r);
        const roadHalf = dr === 0 ? halfWidth(town, 'H', r) : halfWidth(town, 'V', c);
        const dir = unit(sub(nodeXY(town, there), centre));
        const dist = isRb ? 19 : across + PAVEMENT * 0.6 + 2.4;
        const mid = add(centre, mul(dir, dist));
        const n = perp(dir);
        for (let k = -roadHalf + 1; k <= roadHalf - 1; k += 1.8) {
          const p = add(mid, mul(n, k));
          P.line(Z.roadMark + 0.5, { stroke: look.marking, width: 0.95 }, [add(p, mul(dir, -1.5)), add(p, mul(dir, 1.5))]);
        }
      }
    }
  }
}

function roundabout(ctx: Ctx, at: XY) {
  const { P, look } = ctx;
  P.circle(Z.roadTop, { fill: look.kerb }, at, 16.6);
  P.circle(Z.roadTop + 0.1, { fill: look.roadMajor }, at, 15.8);
  P.circle(Z.roadTop + 0.2, { fill: 'none', stroke: look.marking, width: 0.6, dash: '2.5 2.5' }, at, 12.2);
  P.circle(Z.roadTop + 0.3, { fill: look.kerb }, at, 8.6);
  P.circle(Z.roadTop + 0.4, { fill: look.park }, at, 7.8);
  tree(ctx.P, look, at, 3.4, 99, look.palms ? 'palm' : undefined);
}

function trafficLights(ctx: Ctx, at: XY) {
  const { P } = ctx;
  for (const s of [-1, 1]) {
    const base = add(at, { x: s * 10.5, y: s * 10.5 });
    P.poly(Z.sign, { fill: 'rgba(30,30,30,0.18)' }, rectPts(frameAt(add(base, { x: 1.4, y: 0.8 }), 0), -1.4, -3.2, 2.8, 6.4));
    P.poly(Z.sign + 0.1, { fill: '#3E454B' }, rectPts(frameAt(up(base, 2), 0), -1.4, -3.2, 2.8, 6.4));
    P.circle(Z.sign + 0.2, { fill: '#E07160' }, up(base, 3.8), 0.75);
    P.circle(Z.sign + 0.2, { fill: '#6F767C' }, up(base, 2), 0.75);
    P.circle(Z.sign + 0.2, { fill: '#7FC796' }, up(base, 0.2), 0.75);
  }
}

/** Parked cars, street trees, lamps and the odd bus stop along the kerbs. */
function streetLife(ctx: Ctx, runs: Run[], wet: ((p: XY) => boolean) | null) {
  const { P, look, town } = ctx;
  const rb = town.roundabout ? nodeXY(town, town.roundabout) : null;
  let n = 0;
  for (const r of runs) {
    const s = r.street;
    const half = s.major ? 6.25 : 4.25;
    for (let i = r.from; i < r.to; i++) {
      const pts = sample(s.points, i, i + 1, 1);
      const L = pts.length;
      for (let k = Math.floor(L * 0.22); k < L * 0.78; k += 7) {
        n++;
        const { p, dir } = pts[k];
        if ((wet && wet(p)) || (rb && len(sub(p, rb)) < 26)) continue;
        const side = rand(n, i, 81) > 0.5 ? 1 : -1;
        const nrm = perp(dir);
        const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
        // Parked cars on side streets.
        if (!s.major && rand(n, s.index, 82) > 0.52) {
          paintVehicle(P, 'car', pick(look.cars, n, i, 83), add(p, mul(nrm, side * (half - 1.7))), angle + (rand(n, 1, 84) > 0.5 ? 0 : 180));
        }
        // Street trees and lamps on the pavement.
        const kerbSide = add(p, mul(nrm, -side * (half + PAVEMENT * 0.55)));
        if (rand(n, s.index, 85) > (town.look === 'newyork' ? 0.75 : 0.5)) {
          tree(P, look, kerbSide, 2.4 + rand(n, 2, 86) * 1.1, n, look.palms && rand(n, 3, 87) > 0.6 ? 'palm' : undefined);
        } else if (rand(n, s.index, 88) > 0.4) {
          P.circle(Z.furniture, { fill: 'rgba(30,30,30,0.15)' }, add(kerbSide, { x: 1.2, y: 0.6 }), 0.7);
          P.circle(Z.furniture + 0.1, { fill: '#61676D' }, up(kerbSide, 1.2), 0.75);
        }
        if (rand(n, s.index, 89) > 0.82) person(P, add(p, mul(nrm, side * (half + PAVEMENT * 0.5))), n);
      }
    }
  }
}

/** London's red phone boxes, New York's subway entrances, Sydney's bus shelters. */
function cityMarks(ctx: Ctx) {
  const { P, town } = ctx;
  const spots: [Point, number, number][] = [
    [[1, 1], 0.32, 1],
    [[2, 2], 0.6, -1],
    [[0, 2], 0.45, 1],
  ];
  for (const [[c, r], t, side] of spots) {
    if (c + 1 >= SIZE) continue;
    const a = nodeXY(town, [c, r]);
    const b = nodeXY(town, [c + 1, r]);
    const dir = unit(sub(b, a));
    const p = add(lerp(a, b, t), mul(perp(dir), side * (halfWidth(town, 'H', r) + PAVEMENT * 0.5)));
    const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    if (town.look === 'london') {
      P.box(rectPts(frameAt(p, angle), -1, -1, 2, 2), 3.4, '#B9483D', '#A53E34', { z: Z.sign + 0.3 });
    } else if (town.look === 'newyork') {
      const F = frameAt(p, angle);
      P.poly(Z.furniture, { fill: 'none', stroke: '#3E7A5A', width: 0.6 }, rectPts(F, -3, -1.2, 6, 2.4));
      P.circle(Z.sign, { fill: '#4F9A6E' }, up(F(-3, -1.2), 2.2), 0.8);
      P.circle(Z.sign, { fill: '#4F9A6E' }, up(F(3, -1.2), 2.2), 0.8);
    } else {
      P.box(rectPts(frameAt(p, angle), -3.2, -0.8, 6.4, 1.6), 2.6, '#C7D3D8', '#A4B0B5', { z: Z.sign + 0.3 });
    }
  }
}

function waterArt(ctx: Ctx, water: NonNullable<Water>) {
  const { P, look } = ctx;
  const { shore, normal } = water;
  // Without bridges the water lies over the street ends, so streets stop at the quay.
  const zw = look.bridges ? Z.water : Z.roadTop + 1;
  const zd = zw + 2;
  const far = shore.map((p, i) => add(p, mul(normal[i], 400)));
  const edge = curve(shore, 0, shore.length - 1);
  const back = [...far].reverse().map((p) => `L${f(p.x)} ${f(p.y)}`).join('');
  P.path(zw, { fill: look.water }, `${edge}${back}Z`);
  const deep = shore.map((p, i) => add(p, mul(normal[i], 26)));
  P.path(zw + 0.5, { fill: shade(look.water, 0.05) }, `${curve(deep, 0, deep.length - 1)}${back}Z`);
  P.path(zd, { fill: 'none', stroke: look.quay, width: 2.2 }, edge);
  P.path(zd + 0.1, { fill: 'none', stroke: look.waterEdge, width: 0.6 }, curve(shore.map((p, i) => add(p, mul(normal[i], 1.4))), 0, shore.length - 1));
  // Ripples.
  for (let i = 1; i < shore.length - 1; i++) {
    for (let j = 0; j < 3; j++) {
      const p = add(lerp(shore[i], shore[i + 1], rand(i, j, 91)), mul(normal[i], 8 + j * 9 + rand(i, j, 92) * 5));
      const t = perp(normal[i]);
      P.line(zd, { stroke: 'rgba(255,255,255,0.5)', width: 0.6, cap: 'round' }, [add(p, mul(t, -2.5)), add(p, mul(normal[i], -0.6)), add(p, mul(t, 2.5))]);
    }
  }
  // Promenade trees along the shore.
  const pts = sample(shore, 1, shore.length - 2, 14);
  pts.forEach((s, i) => {
    const n0 = normal[Math.min(normal.length - 1, Math.round((i / pts.length) * (normal.length - 1)))];
    tree(P, look, add(s.p, mul(n0, -5.5)), 2.8, i * 3 + 5, look.palms && i % 2 === 0 ? 'palm' : undefined);
  });
  // Piers, a wharf or moored boats.
  if (look.boats === 'piers' || look.boats === 'harbour') {
    const count = look.boats === 'piers' ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const idx = 2 + Math.round((i + 0.5) * ((shore.length - 5) / count));
      const p = shore[idx];
      const n0 = normal[idx];
      const angle = (Math.atan2(n0.y, n0.x) * 180) / Math.PI;
      const F = frameAt(p, angle);
      P.poly(zd + 1, { fill: 'rgba(40,60,80,0.18)' }, rectPts(F, 1, -3.2, 30, 8));
      P.poly(zd + 1.1, { fill: '#D8D2C6', stroke: '#C2BAAA', width: 0.4 }, rectPts(F, -1, -4.5, 30, 9));
      if (look.boats === 'piers') {
        P.box(rectPts(F, 3, -3, 20, 6), 3, '#BDB6AA', '#A39B8E', { z: zd + 1.2 });
      } else {
        paintVehicle(P, 'ferry', '#4E7A5F', F(18, 9.5), angle, zd + 1.3);
        for (let k = 0; k < 3; k++) {
          const sp = F(10 + k * 9, -12 - (k % 2) * 6);
          paintVehicle(P, 'sail', '#FFFFFF', sp, angle + 90, zd + 1.3);
          P.poly(zd + 1.4, { fill: '#FFFFFF', stroke: '#D5D2CA', width: 0.3 }, [up(sp, 0.2), add(up(sp, 5.5), { x: 0.4, y: 0 }), add(sp, { x: 3, y: -0.6 })]);
        }
      }
    }
  } else {
    const idx = Math.round(shore.length * 0.65);
    const n0 = normal[idx];
    const p = add(shore[idx], mul(n0, 4.5));
    paintVehicle(P, 'riverboat', '#3E4D5C', p, (Math.atan2(n0.y, n0.x) * 180) / Math.PI + 90, zd + 1);
  }
}

/** Vehicle lanes for the moving traffic: whole streets, not interrupted, not through the roundabout. */
function lanesOf(town: TownSpec, runs: Run[], wet: ((p: XY) => boolean) | null): Lane[] {
  const lanes: Lane[] = [];
  for (const r of runs) {
    if (r.from !== 0 || r.to !== r.street.points.length - 1) continue;
    if (town.roundabout && r.street.nodes.some((n) => n[0] === town.roundabout![0] && n[1] === town.roundabout![1])) continue;
    let pts = sample(r.street.points, r.from, r.to, 2).map((s) => s.p);
    let deadEnd = false;
    if (wet && !lookOf(town).bridges && pts.some(wet)) {
      // Keep the longest stretch on land.
      let best: XY[] = [];
      let cur: XY[] = [];
      for (const p of pts) {
        if (wet(p)) cur = [];
        else cur.push(p);
        if (cur.length > best.length) best = [...cur];
      }
      pts = best.slice(0, -3);
      deadEnd = true;
      if (pts.length < 20) continue;
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
    lanes.push({ pts, cum, length: cum[cum.length - 1], offset: (r.street.major ? 12.5 : 8.5) / 4, major: r.street.major, deadEnd });
  }
  return lanes;
}

// ---- the whole town -------------------------------------------------------------------------

export function drawTown(town: TownSpec): TownArt {
  const look = lookOf(town);
  const P = new Painter();
  const water = waterOf(town);
  const wet = water ? waterSide(water) : null;
  const ctx: Ctx = { P, look, town, wet: wet ?? (() => false) };
  P.path(Z.land, { fill: look.land }, `M-40 -40H${VIEW + 40}V${VIEW + 40}H-40Z`);
  if (water) waterArt(ctx, water);

  const badges: Badge[] = [];
  const grounds: Record<string, string> = {};
  const taken = new Set<string>();
  for (const place of town.places) {
    const [w, h] = place.span ?? [1, 1];
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) taken.add(`${place.block[0] + i},${place.block[1] + j}`);
    const seed = place.block[0] * 7 + place.block[1] * 13 + 1;
    const draw = LANDMARKS[place.kind];
    const res =
      place.kind === 'park'
        ? park(ctx, place)
        : place.kind === 'square'
          ? square(ctx, place)
          : cityBlock(ctx, place.block, place.span ?? [1, 1], seed, (zone) => (draw ? draw(ctx, zone) : LANDMARKS.gallery!(ctx, zone)));
    if (!res) continue;
    grounds[place.id] = soft(res.bf.ground, 3);
    const anchor = res.anchor;
    badges.push({ id: place.id, kind: place.kind, name: place.name, at: anchor, label: add(anchor, { x: 0, y: 11 }) });
  }
  // The rest of the town, out to the edges of the map.
  for (let c = FIRST; c < LAST; c++) {
    for (let r = FIRST; r < LAST; r++) {
      if (taken.has(`${c},${r}`)) continue;
      const seed = (c + 5) * 31 + (r + 5) * 17;
      const bf = blockFrame(town, [c, r]);
      if (bf.ground.every((p) => p.x < -30 || p.y < -30 || p.x > VIEW + 30 || p.y > VIEW + 30)) continue;
      if (wet && bf.ground.some(wet)) continue;
      const roll = rand(c, r, 40);
      if (roll > 0.86) {
        // A small garden square.
        P.path(Z.ground, { fill: look.park }, soft(bf.ground, 3));
        P.path(Z.groundDetail + 0.5, { fill: 'none', stroke: look.parkEdge, width: 1.6 }, soft(bf.ground, 3));
        const n = Math.round((bf.width * bf.height) / 170);
        for (let i = 0; i < n; i++) {
          tree(P, look, bf.F(wobble(seed, i, 5) * (bf.width / 2 - 4), wobble(seed, i, 6) * (bf.height / 2 - 4)), 2.4 + rand(seed, i, 7) * 2.8, seed + i, look.palms && i % 3 === 0 ? 'palm' : look.blossom && i % 5 === 1 ? 'blossom' : undefined);
        }
      } else {
        cityBlock(ctx, [c, r], [1, 1], seed);
      }
    }
  }

  const list = streets(town);
  const runs = roads(ctx, list, water, wet);
  crossings(ctx);
  if (town.roundabout) roundabout(ctx, nodeXY(town, town.roundabout));
  for (const p of town.lights ?? []) trafficLights(ctx, nodeXY(town, p));
  streetLife(ctx, runs, wet);
  cityMarks(ctx);

  // Street names, along the road, on an open stretch inside the grid.
  const closed = closedSegments(town);
  const labels: StreetLabel[] = [];
  list
    .filter((s) => s.name)
    .forEach((s, i) => {
      const options = [1, 2, 0].filter((k) => !closed.has(segmentKey(s.nodes[at(k)], s.nodes[at(k + 1)])));
      if (options.length === 0) return;
      const k = options[i % 2 && options.length > 1 ? 1 : 0];
      const a = s.points[at(k)];
      const b = s.points[at(k + 1)];
      const mid = lerp(a, b, 0.5);
      let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      if (angle > 90) angle -= 180;
      else if (angle < -90) angle += 180;
      if (s.axis === 'V') angle = (Math.atan2(a.y - b.y, a.x - b.x) * 180) / Math.PI;
      labels.push({ text: s.name!, at: mid, angle, major: s.major });
    });

  return { painter: P, labels, badges, grounds, lanes: lanesOf(town, runs, wet), water, look };
}
