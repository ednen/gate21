import { shade } from './paint';

/** A vehicle seen from above, nose pointing along +x, centred on 0,0. */
export type Part = { x: number; y: number; w: number; h: number; fill: string; r?: number };
export type VehicleKind = 'car' | 'taxi' | 'bus' | 'van' | 'ferry' | 'riverboat' | 'sail';

const GLASS = '#56616C';
const SHADOW = 'rgba(30,30,30,0.16)';

export function vehicleParts(kind: VehicleKind, color: string): Part[] {
  switch (kind) {
    case 'bus': {
      const L = 12;
      const W = 3.5;
      return [
        { x: -L / 2 + 0.7, y: -W / 2 + 0.7, w: L, h: W, fill: SHADOW, r: 0.8 },
        { x: -L / 2, y: -W / 2, w: L, h: W, fill: color, r: 0.8 },
        { x: -L / 2 + 0.6, y: -W / 2 + 0.25, w: L - 1.2, h: 0.55, fill: GLASS },
        { x: -L / 2 + 0.6, y: W / 2 - 0.8, w: L - 1.2, h: 0.55, fill: GLASS },
        { x: L / 2 - 1, y: -W / 2 + 0.4, w: 0.7, h: W - 0.8, fill: GLASS },
        { x: -L / 2 + 2, y: -W / 2 + 1.1, w: 2.4, h: W - 2.2, fill: shade(color, -0.2) },
        { x: L / 2 - 5, y: -W / 2 + 1.1, w: 2.4, h: W - 2.2, fill: shade(color, -0.2) },
      ];
    }
    case 'van': {
      const L = 6.6;
      const W = 3;
      return [
        { x: -L / 2 + 0.6, y: -W / 2 + 0.6, w: L, h: W, fill: SHADOW, r: 0.7 },
        { x: -L / 2, y: -W / 2, w: L, h: W, fill: color, r: 0.7 },
        { x: L / 2 - 1.9, y: -W / 2 + 0.35, w: 0.9, h: W - 0.7, fill: GLASS },
        { x: -L / 2 + 0.5, y: -W / 2 + 0.4, w: L - 2.7, h: W - 0.8, fill: shade(color, -0.12) },
      ];
    }
    case 'ferry': {
      const L = 17;
      const W = 5.4;
      return [
        { x: -L / 2 + 1, y: -W / 2 + 1, w: L, h: W, fill: 'rgba(40,70,90,0.18)', r: 2.6 },
        { x: -L / 2, y: -W / 2, w: L, h: W, fill: '#F1EEE6', r: 2.6 },
        { x: -L / 2 + 3, y: -W / 2 + 1, w: L - 6.5, h: W - 2, fill: color, r: 0.8 },
        { x: -L / 2 + 4.2, y: -W / 2 + 1.7, w: L - 9, h: W - 3.4, fill: shade(color, -0.25), r: 0.5 },
      ];
    }
    case 'riverboat': {
      const L = 15;
      const W = 4;
      return [
        { x: -L / 2 + 1, y: -W / 2 + 1, w: L, h: W, fill: 'rgba(40,70,90,0.18)', r: 1.8 },
        { x: -L / 2, y: -W / 2, w: L, h: W, fill: '#EDEAE3', r: 1.8 },
        { x: -L / 2 + 2.5, y: -W / 2 + 0.8, w: L - 6, h: W - 1.6, fill: color, r: 0.6 },
      ];
    }
    case 'sail':
      return [
        { x: -3.4, y: -1.2, w: 7, h: 2.4, fill: '#F4F2EC', r: 1.2 },
        { x: -2.2, y: -0.25, w: 4.6, h: 0.5, fill: '#B8B2A6' },
      ];
    default: {
      const L = 5.6;
      const W = 2.7;
      const parts: Part[] = [
        { x: -L / 2 + 0.55, y: -W / 2 + 0.55, w: L, h: W, fill: SHADOW, r: 0.9 },
        { x: -L / 2, y: -W / 2, w: L, h: W, fill: color, r: 0.9 },
        { x: L / 2 - 2.1, y: -W / 2 + 0.35, w: 0.9, h: W - 0.7, fill: GLASS },
        { x: -L / 2 + 0.55, y: -W / 2 + 0.4, w: 0.7, h: W - 0.8, fill: GLASS },
        { x: -L / 2 + 1.35, y: -W / 2 + 0.35, w: L - 3.5, h: W - 0.7, fill: shade(color, -0.1) },
      ];
      if (kind === 'taxi') {
        parts.push({ x: -0.6, y: -0.55, w: 1.2, h: 1.1, fill: '#F6EBC4' });
      }
      return parts;
    }
  }
}
