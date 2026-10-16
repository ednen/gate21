import type { Assessment } from '../types';

/**
 * Pronunciation scoring for the browser demo, from what the browser's recognizer heard. Each
 * reference word is matched to the closest word heard (so "chek in" for "check-in" still counts
 * for most of it), weighted by how sure the recognizer was; leftovers and missing words lower
 * fluency and completeness. Scores land anywhere on the scale, not on two fixed values.
 */
const words = (t: string) => t.toLowerCase().match(/[a-z0-9']+/g) ?? [];

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** 1 for the same word, falling towards 0 the more letters differ. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const n = Math.max(a.length, b.length);
  return n ? Math.max(0, 1 - distance(a, b) / n) : 1;
}

/** Of several readings of the same speech, the one closest to what was expected. */
export function closestReading(reference: string, readings: string[]): string {
  const ref = words(reference);
  let best = readings[0] ?? '';
  let bestScore = -1;
  for (const r of readings) {
    const heard = words(r);
    const score = ref.reduce((s, w) => s + Math.max(0, ...heard.map((h) => similarity(w, h))), 0);
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

export function scoreSpeech(reference: string, transcript: string | null, confidence?: number | null, alternatives: string[] = []): Assessment {
  const ref = reference.match(/[A-Za-z0-9']+/g) ?? [];
  // Without a recognizer (some browsers) the demo cannot hear you and gives a friendly score.
  if (transcript == null) {
    const scored = ref.map((w) => ({ word: w, score: 88, errorType: 'None' }));
    return { overall: 87, accuracy: 88, fluency: 85, completeness: 100, words: scored, weakestWord: null, tipTr: 'Çok net! Böyle devam.' };
  }
  const said = closestReading(reference, [transcript, ...alternatives]);
  const heard = words(said);
  // Chrome reports 0.6–0.95 for clear speech; with no figure, assume a fair one.
  const sure = confidence && confidence > 0 ? Math.min(1, Math.max(0.3, confidence)) : 0.8;
  const used = new Set<number>();
  const scored = ref.map((w) => {
    let best = 0;
    let at = -1;
    heard.forEach((h, i) => {
      const s = similarity(w.toLowerCase(), h) - (used.has(i) ? 0.15 : 0);
      if (s > best) {
        best = s;
        at = i;
      }
    });
    if (at >= 0 && best >= 0.5) used.add(at);
    // Short words are easy to mishear, so a near miss on them costs less.
    const lenient = w.length <= 3 ? 0.1 : 0;
    const sim = Math.min(1, best + lenient);
    const score =
      sim >= 0.999
        ? Math.round(70 + 28 * sure)
        : sim >= 0.6
          ? Math.round(45 + 35 * sim * sure)
          : Math.round(12 + 40 * sim);
    const errorType = sim >= 0.999 ? 'None' : sim >= 0.6 ? 'Mispronunciation' : 'Omission';
    return { word: w, score: Math.max(5, Math.min(100, score)), errorType };
  });
  const n = scored.length || 1;
  const found = scored.filter((w) => w.errorType !== 'Omission').length;
  const completeness = Math.round((100 * found) / n);
  const accuracy = scored.length ? Math.round(scored.reduce((a, w) => a + w.score, 0) / n) : 90;
  const extra = Math.max(0, heard.length - used.size);
  const fluency = Math.round(Math.max(40, Math.min(98, 62 + 34 * sure - 6 * extra - (completeness < 100 ? (100 - completeness) * 0.2 : 0))));
  const overall = Math.round(0.6 * accuracy + 0.2 * fluency + 0.2 * completeness);
  const weakest = [...scored].sort((a, b) => a.score - b.score).find((w) => w.score < 80)?.word ?? null;
  const tipTr =
    completeness < 60
      ? 'Cümlenin tamamını söylemeyi dene.'
      : weakest
        ? `“${weakest}” kelimesini biraz daha yavaş ve net söylemeyi dene.`
        : overall >= 90
          ? 'Çok net! Böyle devam.'
          : 'Güzel. Biraz daha akıcı söylemeyi dene.';
  return { overall, accuracy, fluency, completeness, words: scored, weakestWord: weakest, tipTr };
}
