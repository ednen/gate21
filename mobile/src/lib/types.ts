/** Response shapes of the Gate 21 API (see backend controllers). */

/** Step kinds; every chapter lists the steps it uses, in order. */
export type Step = 'DISCOVER' | 'PRONOUNCE' | 'RECOGNIZE' | 'SPEAK' | 'USE' | 'SURVIVE' | 'MATCH' | 'DIALOG' | 'FORM' | 'DIRECTIONS';

export type LevelId = 'BRONZE' | 'SILVER' | 'GOLD';
export type ChapterKind = 'lesson' | 'starter' | 'simulation';

export type Membership = {
  plan: 'FREE' | 'JOURNEY' | 'KEEP_READY';
  active: boolean;
  expiresAt: string | null;
  freeDays: number;
};

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
  levelId: LevelId;
  level: string;
  levelTr: string;
  trip: string;
  todayDone: boolean;
  todayXp: number;
  dailyGoalXp: number;
  streak: number;
  streakBest: number;
  xp: number;
  speakingAccuracy: number | null;
  placementScore: number | null;
  finalScore: number | null;
  starterRecommended: boolean;
  starterDone: boolean;
  graduatedAt: string | null;
  practice: { thisWeek: number; weeklyGoal: number };
  membership: Membership;
  nextChapter: {
    slug: string;
    kind: ChapterKind;
    stop: string | null;
    week: number;
    day: number;
    title: string;
    titleTr: string;
    mission: string;
    missionTr: string;
    scenario: string | null;
  } | null;
};

export type PassportChapter = {
  slug: string;
  kind: ChapterKind;
  stop: string | null;
  title: string;
  titleTr: string;
  week: number;
  day: number;
  order: number;
  icon: string;
  available: boolean;
  unlocked: boolean;
  stepsDone: number;
  totalSteps: number;
  doneSteps: Step[];
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
  levels: LevelBadge[];
  chapters: PassportChapter[];
};

/** Bronze / Silver / Gold Traveller: earned when all seven lessons of the week are done. */
export type LevelBadge = {
  id: LevelId;
  week: number;
  title: string;
  titleTr: string;
  tagline: string;
  message: string;
  messageTr: string;
  trip: string;
  lessonsDone: number;
  lessons: number;
  earned: boolean;
  earnedAt: string | null;
};

export type Offer = { id: 'JOURNEY' | 'KEEP_READY'; title: string; titleTr: string; price: string; periodTr: string; featuresTr: string[] };
export type Offers = { current: Membership; storeConnected: boolean; plans: Offer[] };

export type PracticeOverview = {
  weeklyGoal: number;
  practiceDays: string[];
  thisWeek: number;
  phrases: { en: string; tr: string }[];
  scenes: { chapter: string; scenario: string; title: string; titleTr: string; icon: string; week: number }[];
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

export type Difficulty = LevelId;

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
  starter: boolean;
  startDayApplied: boolean;
};

export type SyncResult = {
  accepted: number;
  duplicates: number;
  xpGained: number;
  stampedChapters: string[];
  levelsEarned: LevelId[];
  graduated: boolean;
  xpTotal: number;
  streak: number;
};
