import { describe, expect, it } from 'vitest';

import { acknowledge, type Attempt, enqueue, MAX_BATCH, nextBatch } from './queue';
import { average, joinTiles, shuffledOrder, surviveScore } from './sentence';
import { compareVersions } from './version';

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
  it('rewards surviving without retries', () => {
    expect(surviveScore(0)).toBe(100);
    expect(surviveScore(2)).toBe(70);
    expect(surviveScore(9)).toBe(50);
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
