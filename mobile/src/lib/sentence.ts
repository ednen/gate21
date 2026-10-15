/** Joins sentence tiles with spaces, without a space before punctuation. */
export function joinTiles(tiles: string[]): string {
  return tiles.reduce((text, tile) => {
    if (text === '') {
      return tile;
    }
    return /^[?.!,]/.test(tile) ? text + tile : `${text} ${tile}`;
  }, '');
}

/** Deterministic shuffle so the tile order is stable for a chapter but never the answer order. */
export function shuffledOrder(length: number, seed: string): number[] {
  const order = Array.from({ length }, (_, i) => i);
  let h = 2166136261;
  for (const ch of seed) {
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  }
  for (let i = order.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = Math.abs(h) % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (length > 1 && order.every((v, i) => v === i)) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

/** The Survive score: the server's scene score, minus 5 for every memory question missed (at least 40). */
export function surviveScore(sceneScore: number, memoryMissed: number): number {
  return Math.max(40, sceneScore - 5 * memoryMissed);
}

/** Average of the numbers, rounded; null when there are none. */
export function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
