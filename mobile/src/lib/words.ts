import type { Word } from './content';
import type { Step } from './types';

/** The step that turns a chapter's words into learned words: the matching game. */
export const LEARNING_STEP: Step = 'MATCH';

export type CollectionWord = Word & { chapter: string; learned: boolean };
export type CollectionSection = { key: string; title: string; subtitle: string; words: CollectionWord[]; learned: number };

type ChapterProgress = { slug: string; complete: boolean; doneSteps: Step[] };
type Pending = { chapter: string; step: Step };

/**
 * Chapters whose words count as learned: the matching step is done on the server, the chapter
 * is complete, or the step was just finished on this device and is still waiting to sync.
 */
export function learnedChapters(progress: ChapterProgress[], pending: Pending[]): Set<string> {
  const learned = new Set<string>();
  for (const c of progress) {
    if (c.complete || (c.doneSteps ?? []).includes(LEARNING_STEP)) {
      learned.add(c.slug);
    }
  }
  for (const a of pending) {
    if (a.step === LEARNING_STEP) {
      learned.add(a.chapter);
    }
  }
  return learned;
}

/**
 * The word collection, one section per chapter in learning order. A word that appears in
 * several chapters is shown once, where it first appears, and counts as learned as soon as
 * any of those chapters is learned.
 */
export function buildCollection(
  chapters: { slug: string; title: string; subtitle: string; words: Word[] }[],
  learned: Set<string>,
): { sections: CollectionSection[]; total: number; learned: number } {
  const key = (w: Word) => w.en.trim().toLowerCase();
  const learnedWords = new Set<string>();
  for (const c of chapters) {
    if (learned.has(c.slug)) {
      c.words.forEach((w) => learnedWords.add(key(w)));
    }
  }
  const seen = new Set<string>();
  const sections: CollectionSection[] = [];
  for (const c of chapters) {
    const words: CollectionWord[] = [];
    for (const w of c.words) {
      if (seen.has(key(w))) {
        continue;
      }
      seen.add(key(w));
      words.push({ ...w, chapter: c.slug, learned: learnedWords.has(key(w)) });
    }
    if (words.length > 0) {
      sections.push({ key: c.slug, title: c.title, subtitle: c.subtitle, words, learned: words.filter((w) => w.learned).length });
    }
  }
  const total = sections.reduce((n, s) => n + s.words.length, 0);
  return { sections, total, learned: sections.reduce((n, s) => n + s.learned, 0) };
}
