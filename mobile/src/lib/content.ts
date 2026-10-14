import AsyncStorage from '@react-native-async-storage/async-storage';

import bundledManifest from '../../../content/manifest.json';
import airport from '../../../content/chapters/airport.json';
import hotel from '../../../content/chapters/hotel.json';
import restaurant from '../../../content/chapters/restaurant.json';
import shopping from '../../../content/chapters/shopping.json';
import placementJson from '../../../content/placement.json';
import sosJson from '../../../content/sos.json';
import { apiGet } from './api';
import { compareVersions } from './version';

export type ChapterInfo = {
  slug: string;
  week: number;
  order: number;
  title: string;
  titleTr: string;
  icon: string;
  available: boolean;
};

export type Manifest = {
  version: string;
  weeks: { week: number; level: string; levelTr: string; startDay: number }[];
  chapters: ChapterInfo[];
};

export type Word = { en: string; tr: string };
export type PronounceItem = { word: string; ipa: string; stress: string; tipTr: string };
export type Question = { prompt: string; options: string[]; answer: number; explainTr: string; tag?: string };

export type Chapter = {
  slug: string;
  mission: string;
  missionTr: string;
  stamp: string;
  words: Word[];
  pronounce: PronounceItem[];
  recognize: Question[];
  speak: { scene: string; prompt: string; answer: string; accept: string[] };
  use: {
    word: string;
    phrase: string;
    phraseTr: string;
    situation: string;
    situationTr: string;
    tiles: string[];
  };
  survive: { scenario: string };
};

export type Placement = {
  questions: Question[];
  speaking: { situationTr: string; phrase: string }[];
  bands: { min: number; level: string; startDay: number; messageTr: string }[];
};

export type SosPhrase = { en: string; tr: string };

type Pack = { version: string; manifest: Manifest; chapters: Record<string, Chapter> };

const STORAGE_KEY = 'gate21.content-pack';

const bundled: Pack = {
  version: bundledManifest.version,
  manifest: bundledManifest as Manifest,
  chapters: { airport, hotel, restaurant, shopping } as Record<string, Chapter>,
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
