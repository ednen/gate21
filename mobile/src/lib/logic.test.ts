import { describe, expect, it } from 'vitest';

import { acknowledge, type Attempt, enqueue, MAX_BATCH, nextBatch } from './queue';
import { average, joinTiles, shuffledOrder, surviveScore } from './sentence';
import { canPlay, matchPairs } from './rules';
import { compareVersions } from './version';
import { buildCollection, learnedChapters } from './words';
import hotel from '../../../content/chapters/hotel-bronze.json';
import alphabet from '../../../content/chapters/starter-alphabet.json';

const attempt = (id: string): Attempt => ({
  clientId: id,
  chapter: 'airport',
  step: 'DISCOVER',
  score: null,
  occurredAt: '2026-10-14T10:00:00Z',
});

describe('offline queue', () => {
  it('does not queue the same attempt twice', () => {
    const q = enqueue(enqueue([], attempt('a')), attempt('a'));
    expect(q).toHaveLength(1);
  });

  it('sends the oldest attempts first in bounded batches', () => {
    const q = Array.from({ length: 250 }, (_, i) => attempt(String(i)));
    const batch = nextBatch(q);
    expect(batch).toHaveLength(MAX_BATCH);
    expect(batch[0].clientId).toBe('0');
  });

  it('keeps attempts queued while a batch was in flight', () => {
    const sent = [attempt('a'), attempt('b')];
    const queueNow = [...sent, attempt('c')];
    expect(acknowledge(queueNow, sent).map((a) => a.clientId)).toEqual(['c']);
  });
});

describe('sentence builder', () => {
  it('joins tiles without a space before punctuation', () => {
    expect(joinTiles(['Where', 'is', 'the', 'check-in counter', '?'])).toBe('Where is the check-in counter?');
  });

  it('never presents the tiles already in the right order', () => {
    for (const seed of ['airport', 'hotel', 'restaurant', 'shopping', 'x']) {
      const order = shuffledOrder(5, seed);
      expect([...order].sort()).toEqual([0, 1, 2, 3, 4]);
      expect(order).not.toEqual([0, 1, 2, 3, 4]);
      expect(shuffledOrder(5, seed)).toEqual(order);
    }
  });
});

describe('scores', () => {
  it('takes memory misses off the scene score, with a floor', () => {
    expect(surviveScore(100, 0)).toBe(100);
    expect(surviveScore(85, 2)).toBe(75);
    expect(surviveScore(45, 3)).toBe(40);
  });

  it('averages scores', () => {
    expect(average([])).toBeNull();
    expect(average([80, 85])).toBe(83);
  });
});

describe('content versions', () => {
  it('compares numerically, not as text', () => {
    expect(compareVersions('2026.10.10', '2026.10.9')).toBe(1);
    expect(compareVersions('2026.9.1', '2026.10.1')).toBe(-1);
    expect(compareVersions('2026.10.1', '2026.10.1')).toBe(0);
  });
});

describe('matching game', () => {
  it('uses the words the chapter chose, in order', () => {
    expect(matchPairs(hotel).map((w) => w.en)).toEqual(hotel.match);
    expect(matchPairs(hotel).every((w) => !!w.picture)).toBe(true);
  });

  it('falls back to the first six words and never shows more than six', () => {
    const words = alphabet.words.slice(0, 9);
    expect(matchPairs({ words }).map((w) => w.en)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(matchPairs({ words, match: ['Z', 'A'] }).map((w) => w.en)).toEqual(['A']);
  });
});

describe('plan access', () => {
  it('keeps the Starter pack and the first free days open to everyone', () => {
    expect(canPlay({ kind: 'starter', day: 0 }, false, 2)).toBe(true);
    expect(canPlay({ kind: 'lesson', day: 2 }, false, 2)).toBe(true);
    expect(canPlay({ kind: 'lesson', day: 3 }, false, 2)).toBe(false);
    expect(canPlay({ kind: 'simulation', day: 21 }, false, 2)).toBe(false);
    expect(canPlay({ kind: 'lesson', day: 17 }, true, 2)).toBe(true);
  });
});

describe('word collection', () => {
  const chapters = [
    { slug: 'a', title: 'A', subtitle: '', words: [{ en: 'passport', tr: 'pasaport' }, { en: 'receipt', tr: 'fiş' }] },
    { slug: 'b', title: 'B', subtitle: '', words: [{ en: 'Receipt', tr: 'fiş' }, { en: 'taxi', tr: 'taksi' }] },
  ];

  it('counts a chapter as learned after its matching step, on the server or still queued', () => {
    const learned = learnedChapters(
      [{ slug: 'a', complete: false, doneSteps: ['DISCOVER', 'MATCH'] }, { slug: 'b', complete: false, doneSteps: ['DISCOVER'] }],
      [{ chapter: 'c', step: 'MATCH' }, { chapter: 'b', step: 'PRONOUNCE' }],
    );
    expect([...learned].sort()).toEqual(['a', 'c']);
  });

  it('shows each word once and marks it learned from any chapter', () => {
    const c = buildCollection(chapters, new Set(['b']));
    expect(c.sections.map((s) => s.words.map((w) => w.en))).toEqual([['passport', 'receipt'], ['taxi']]);
    expect(c.sections[0].words.map((w) => w.learned)).toEqual([false, true]);
    expect(c.total).toBe(3);
    expect(c.learned).toBe(2);
  });
});
