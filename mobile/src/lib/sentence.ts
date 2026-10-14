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

/** Score for the Survive step: 100 for a clean run, minus 15 for every retry, at least 50. */
export function surviveScore(retries: number): number {
  return Math.max(50, 100 - 15 * retries);
}

/** Average of the numbers, rounded; null when there are none. */
export function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
