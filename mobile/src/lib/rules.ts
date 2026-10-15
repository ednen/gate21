import type { Chapter, ChapterInfo, Word } from './content';

/** Pairs for the matching game: the chapter's chosen words, else its first six. */
export function matchPairs(c: Pick<Chapter, 'words' | 'match'>): Word[] {
  const words = c.words ?? [];
  const chosen = c.match?.length ? c.match.map((en) => words.find((w) => w.en === en)).filter((w): w is Word => !!w) : words;
  return chosen.slice(0, 6);
}

/**
 * Whether a chapter can be opened with the learner's plan. The Starter pack and the first
 * free journey days are open to everyone; the server enforces the same rule for scenes.
 */
export function canPlay(info: Pick<ChapterInfo, 'kind' | 'day'>, membershipActive: boolean, freeDays: number): boolean {
  return info.kind === 'starter' || (info.kind === 'lesson' && info.day <= freeDays) || membershipActive;
}
