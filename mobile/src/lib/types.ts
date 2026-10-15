/** Response shapes of the Gate 21 API (see backend controllers). */

export type Step = 'DISCOVER' | 'PRONOUNCE' | 'RECOGNIZE' | 'SPEAK' | 'USE' | 'SURVIVE';
export const STEPS: Step[] = ['DISCOVER', 'PRONOUNCE', 'RECOGNIZE', 'SPEAK', 'USE', 'SURVIVE'];

export type Me = {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  reminderHour: number;
  voiceConsent: boolean;
  memberSince: string;
  journeyDay: number;
  week: number;
  level: string;
  levelTr: string;
  todayDone: boolean;
  todayXp: number;
  dailyGoalXp: number;
  streak: number;
  streakBest: number;
  xp: number;
  speakingAccuracy: number | null;
  placementScore: number | null;
  finalScore: number | null;
  nextChapter: {
    slug: string;
    title: string;
    titleTr: string;
    mission: string;
    missionTr: string;
    scenario: string;
  } | null;
};

export type PassportChapter = {
  slug: string;
  title: string;
  titleTr: string;
  week: number;
  order: number;
  icon: string;
  available: boolean;
  unlocked: boolean;
  stepsDone: number;
  totalSteps: number;
  complete: boolean;
  stars: number;
  stamp: string | null;
  stampedAt: string | null;
};

export type Passport = {
  holder: string;
  issuedAt: string;
  journeyDay: number;
  level: string;
  stamps: number;
  chapters: PassportChapter[];
};

export type Assessment = {
  overall: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  words: { word: string; score: number; errorType: string }[];
  weakestWord: string | null;
  tipTr: string;
};

export type Difficulty = 'READY' | 'CONFIDENT' | 'PRO';

/** A character line. kind: say | twist (the surprise) | transition (scene change) | closing. */
export type SceneMessage = {
  kind: 'say' | 'twist' | 'transition' | 'closing';
  role: string;
  text: string;
  voice: string | null;
};

export type SceneView = {
  sessionId: string;
  scenario: string;
  title: string;
  titleTr: string;
  difficulty: Difficulty;
  briefTr: string | null;
  role: string;
  setting: string;
  voice: string | null;
  userText: string | null;
  goalMet: boolean | null;
  feedbackTr: string | null;
  twist: boolean;
  messages: SceneMessage[];
  stepIndex: number;
  totalSteps: number;
  stepTitleTr: string | null;
  hintsAllowed: boolean;
  hint: string | null;
  hintTr: string | null;
  hintOptions: string[];
  done: boolean;
  completed: boolean;
  model: string;
};

export type SceneReport = {
  sessionId: string;
  title: string;
  completed: boolean;
  score: number;
  failedTurns: number;
  hintsUsed: number;
  lines: { said: string; better: string; noteTr: string; ok: boolean }[];
  hardestTr: string;
  phrases: { en: string; tr: string }[];
  memory: { question: string; questionTr: string; options: string[]; answer: number }[];
  model: string;
};

export type PlacementResult = {
  score: number;
  correct: number;
  total: number;
  level: string;
  startDay: number;
  messageTr: string;
  startDayApplied: boolean;
};

export type SyncResult = {
  accepted: number;
  duplicates: number;
  xpGained: number;
  stampedChapters: string[];
  xpTotal: number;
  streak: number;
};
