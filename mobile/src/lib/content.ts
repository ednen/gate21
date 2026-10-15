import AsyncStorage from '@react-native-async-storage/async-storage';

import bundledManifest from '../../../content/manifest.json';
import starterAlphabet from '../../../content/chapters/starter-alphabet.json';
import starterNumbers from '../../../content/chapters/starter-numbers.json';
import starterSpelling from '../../../content/chapters/starter-spelling.json';
import starterPeople from '../../../content/chapters/starter-people.json';
import starterBasics from '../../../content/chapters/starter-basics.json';
import arrivalBronze from '../../../content/chapters/arrival-bronze.json';
import transferBronze from '../../../content/chapters/transfer-bronze.json';
import hotelBronze from '../../../content/chapters/hotel-bronze.json';
import restaurantBronze from '../../../content/chapters/restaurant-bronze.json';
import cafeBronze from '../../../content/chapters/cafe-bronze.json';
import shoppingBronze from '../../../content/chapters/shopping-bronze.json';
import transportBronze from '../../../content/chapters/transport-bronze.json';
import fullTrip from '../../../content/chapters/full-trip.json';
import placementJson from '../../../content/placement.json';
import sosJson from '../../../content/sos.json';
import { apiGet } from './api';
import type { ChapterKind, LevelId, Step } from './types';
import { compareVersions } from './version';

export type ChapterInfo = {
  slug: string;
  kind: ChapterKind;
  stop: string | null;
  week: number;
  day: number;
  order: number;
  title: string;
  titleTr: string;
  icon: string;
  available: boolean;
};

export type LevelInfo = {
  week: number;
  id: LevelId;
  title: string;
  titleTr: string;
  tagline: string;
  message: string;
  messageTr: string;
  trip: string;
  startDay: number;
};

export type Stop = { slug: string; order: number; title: string; titleTr: string; icon: string };

export type Manifest = {
  version: string;
  freeDays: number;
  levels: LevelInfo[];
  graduation: { title: string; titleTr: string; lines: string[]; linesTr: string[] };
  stops: Stop[];
  chapters: ChapterInfo[];
};

/** A word card: the word, its picture (if it can be drawn) and the word used in a sentence. */
export type Word = { en: string; tr: string; picture?: string; example?: string; exampleTr?: string };
export type PronounceItem = { word: string; ipa: string; stress: string; tipTr: string };
/** With `audio`, the prompt is heard (spoken by the device) instead of read. */
export type Question = { prompt: string; options: string[]; answer: number; explainTr: string; tag?: string; audio?: string };
export type DialogLine = { who: string; text: string; gap?: string; options?: string[] };
export type FormField = { label: string; labelTr: string; options: string[]; answer: number; explainTr: string };

export type Chapter = {
  slug: string;
  mission: string;
  missionTr: string;
  stamp: string;
  steps: Step[];
  words?: Word[];
  pronounce?: PronounceItem[];
  match?: string[];
  recognize?: Question[];
  dialog?: { titleTr: string; lines: DialogLine[] };
  form?: { title: string; titleTr: string; situationTr: string; fields: FormField[] };
  speak?: { picture: string; prompt: string; answer: string; accept: string[] };
  use?: {
    word: string;
    phrase: string;
    phraseTr: string;
    situation: string;
    situationTr: string;
    tiles: string[];
  };
  survive?: { scenario: string };
};

export type Placement = {
  questions: Question[];
  speaking: { situationTr: string; phrase: string }[];
  bands: { min: number; level: string; startDay: number; starter: boolean; messageTr: string }[];
};

export type SosPhrase = { en: string; tr: string };

type Pack = { version: string; manifest: Manifest; chapters: Record<string, Chapter> };

const STORAGE_KEY = 'gate21.content-pack';

const bundled: Pack = {
  version: bundledManifest.version,
  manifest: bundledManifest as Manifest,
  chapters: Object.fromEntries(
    [starterAlphabet, starterNumbers, starterSpelling, starterPeople, starterBasics, arrivalBronze, transferBronze,
      hotelBronze, restaurantBronze, cafeBronze, shoppingBronze, transportBronze, fullTrip].map((c) => [c.slug, c as Chapter]),
  ),
};

let current: Pack = bundled;

export const placement = placementJson as Placement;
/** SOS phrases ship inside the app so they work offline and before sign-in. */
export const sosPhrases = (sosJson as { phrases: SosPhrase[] }).phrases;

export function manifest(): Manifest {
  return current.manifest;
}

export function chapter(slug: string): Chapter | undefined {
  return current.chapters[slug];
}

export function chapterInfo(slug: string): ChapterInfo | undefined {
  return current.manifest.chapters.find((c) => c.slug === slug);
}

export function stop(slug: string | null | undefined): Stop | undefined {
  return current.manifest.stops.find((s) => s.slug === slug);
}

export function level(week: number): LevelInfo | undefined {
  return current.manifest.levels.find((l) => l.week === week);
}

export function levelById(id: string): LevelInfo | undefined {
  return current.manifest.levels.find((l) => l.id === id);
}

export { canPlay, matchPairs } from './rules';

/**
 * Loads a newer content pack cached on the device, then checks the API for a newer one.
 * New chapters and fixes ship this way without an app store release.
 */
export async function syncContent(): Promise<void> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) {
      const pack = JSON.parse(cached) as Pack;
      if (compareVersions(pack.version, bundled.version) > 0) {
        current = pack;
      }
    }
  } catch {
    // A corrupt cache is ignored; the bundled pack is always valid.
  }

  try {
    const remote = await apiGet<Manifest>('/api/v1/content/manifest', { auth: false });
    if (compareVersions(remote.version, current.version) <= 0) {
      return;
    }
    const chapters: Record<string, Chapter> = {};
    for (const info of remote.chapters.filter((c) => c.available)) {
      chapters[info.slug] = await apiGet<Chapter>(`/api/v1/content/chapters/${info.slug}`, { auth: false });
    }
    current = { version: remote.version, manifest: remote, chapters };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Offline or API down: keep what we have.
  }
}
