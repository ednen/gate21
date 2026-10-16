import { describe, expect, it } from 'vitest';

import bronze from '../../../content/chapters/transport-bronze.json';
import gold from '../../../content/chapters/transport-gold.json';
import silver from '../../../content/chapters/transport-silver.json';
import { applyMove, checkRound, type Directions, routeOf, turnTo } from './directions';

const all = [bronze, silver, gold].map((c) => ({ slug: c.slug, d: (c as unknown as { directions: Directions }).directions }));

describe('walking directions', () => {
  it('turns relative to where the walker is facing', () => {
    expect(turnTo('N', 'left')).toBe('W');
    expect(turnTo('S', 'left')).toBe('E');
    expect(turnTo('W', 'right')).toBe('N');
  });

  it('counts roundabout exits clockwise: first left, second straight, third right', () => {
    const town = { streetsH: [], streetsV: [], roundabout: [1, 2] as [number, number], places: [] };
    expect(applyMove(town, [1, 2], 'N', 'exit1')).toEqual({ at: [0, 2], heading: 'W' });
    expect(applyMove(town, [1, 2], 'N', 'exit2')).toEqual({ at: [1, 1], heading: 'N' });
    expect(applyMove(town, [1, 2], 'N', 'exit3')).toEqual({ at: [2, 2], heading: 'E' });
    expect(applyMove(town, [1, 2], 'N', 'left')).toBeNull();
    expect(applyMove(town, [1, 3], 'N', 'exit1')).toBeNull();
  });

  it('every round of every chapter can be walked and ends at its goal', () => {
    for (const { slug, d } of all) {
      expect(d.rounds.length, slug).toBeGreaterThanOrEqual(3);
      d.rounds.forEach((round, i) => expect(checkRound(d.town, round), `${slug} round ${i + 1}`).toEqual([]));
    }
  });

  it('gets harder: street names in week 2, roundabouts in week 3', () => {
    const says = (d: Directions) => d.rounds.flatMap((r) => r.steps.map((s) => s.say)).join(' ');
    expect(says(all[0].d)).not.toMatch(/Street|Avenue|exit/);
    expect(says(all[1].d)).toMatch(/Street|Avenue/);
    expect(all[2].d.rounds.some((r) => r.steps.some((s) => s.moves.some((m) => m.startsWith('exit'))))).toBe(true);
    expect(routeOf(all[2].d.town, all[2].d.rounds[0])).toHaveLength(4);
  });
});
