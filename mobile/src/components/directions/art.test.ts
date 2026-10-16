import { describe, expect, it } from 'vitest';

import bronze from '../../../../content/chapters/transport-bronze.json';
import gold from '../../../../content/chapters/transport-gold.json';
import silver from '../../../../content/chapters/transport-silver.json';
import { type Directions, SIZE } from '../../lib/directions';
import { drawTown } from './art';
import { along, nodeXY, VIEW } from './geo';

const all = [bronze, silver, gold].map((c) => ({ slug: c.slug, d: (c as unknown as { directions: Directions }).directions }));

describe('town maps', () => {
  it('keeps every crossing of the game well inside the map, with room for the arrows around it', () => {
    for (const { slug, d } of all) {
      for (let c = 0; c < SIZE; c++) {
        for (let r = 0; r < SIZE; r++) {
          const p = nodeXY(d.town, [c, r]);
          expect([slug, p.x > 18 && p.x < VIEW - 18 && p.y > 18 && p.y < VIEW - 18]).toEqual([slug, true]);
        }
      }
    }
  });

  it('gives each city its own look', () => {
    expect(new Set(all.map(({ d }) => d.town.look)).size).toBe(3);
  });

  it('draws every place with a badge, in a few hundred batched paths', () => {
    for (const { d } of all) {
      const art = drawTown(d.town);
      expect(art.badges.map((b) => b.id).sort()).toEqual(d.town.places.map((p) => p.id).sort());
      expect(art.painter.layers.size).toBeLessThan(900);
      expect(art.lanes.length).toBeGreaterThan(3);
    }
  });

  it('walks along the street from one crossing to the next', () => {
    const town = all[0].d.town;
    expect(along(town, [1, 1], [2, 1], 0)).toEqual(nodeXY(town, [1, 1]));
    const end = along(town, [1, 1], [2, 1], 1);
    const b = nodeXY(town, [2, 1]);
    expect(Math.hypot(end.x - b.x, end.y - b.y)).toBeLessThan(0.5);
  });
});
