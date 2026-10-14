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

export type SceneView = {
  sessionId: string;
  scenario: string;
  title: string;
  titleTr: string;
  role: string;
  setting: string;
  userText: string | null;
  reply: string;
  goalMet: boolean | null;
  feedbackTr: string | null;
  twist: boolean;
  goalIndex: number;
  totalGoals: number;
  hint: string | null;
  hintOptions: string[];
  done: boolean;
  completed: boolean;
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
