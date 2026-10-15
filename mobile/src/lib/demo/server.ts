/**
 * A stand-in for the Gate 21 API that runs inside the browser, for the demo build
 * (EXPO_PUBLIC_DEMO=1). It answers the same endpoints with the same shapes and keeps one
 * learner's state in localStorage, so the whole app can be tried from a link with no server.
 *
 * Differences from the real API, on purpose:
 * - every week can be opened straight away ("unlockAll", on by default), and the plan is active;
 * - the journey day follows finished lessons instead of the calendar;
 * - scenes use the scripted keyword judge, speech is scored from the browser's own recognizer.
 */
import { chapter as chapterContent, chapterInfo, manifest, placement as placementContent, type ChapterInfo } from '../content';
import { ApiError } from '../errors';
import type {
  Assessment,
  LevelBadge,
  LevelId,
  Me,
  Membership,
  Offers,
  Passport,
  PassportChapter,
  PlacementResult,
  PracticeOverview,
  SceneReport,
  SceneView,
  Step,
  SyncResult,
} from '../types';
import { DEMO_EMAIL } from './flag';
import { scenarios } from './scenarios';
import * as scene from './scene';

const STEPS: Step[] = ['DISCOVER', 'PRONOUNCE', 'RECOGNIZE', 'SPEAK', 'USE', 'SURVIVE', 'MATCH', 'DIALOG', 'FORM'];
const DAILY_GOAL_XP = 50;
const KEY = 'gate21.demo-state';

type ChapterRow = { steps: Step[]; scoreSum: number; scoreCount: number; stars: number; stampedAt: string | null };

export type DemoSettings = { unlockAll: boolean; member: boolean };

type State = {
  user: {
    id: string;
    email: string;
    displayName: string;
    timezone: string;
    reminderHour: number;
    voiceConsent: boolean;
    createdAt: string;
  } | null;
  startDay: number;
  placementScore: number | null;
  finalScore: number | null;
  starterRecommended: boolean;
  graduatedAt: string | null;
  xpTotal: number;
  streakBest: number;
  dailyXp: Record<string, number>;
  attempts: string[];
  chapters: Record<string, ChapterRow>;
  membership: { plan: 'JOURNEY' | 'KEEP_READY'; expiresAt: string } | null;
  sessions: Record<string, scene.Session>;
  settings: DemoSettings;
};

function fresh(): State {
  return {
    user: null,
    startDay: 1,
    placementScore: null,
    finalScore: null,
    starterRecommended: false,
    graduatedAt: null,
    xpTotal: 0,
    streakBest: 0,
    dailyXp: {},
    attempts: [],
    chapters: {},
    membership: null,
    sessions: {},
    settings: { unlockAll: true, member: true },
  };
}

let memory: State | null = null;

function load(): State {
  if (memory) {
    return memory;
  }
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    memory = raw ? { ...fresh(), ...(JSON.parse(raw) as State) } : fresh();
  } catch {
    memory = fresh();
  }
  return memory;
}

function save(): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Private mode or storage full: the demo keeps working in memory for this visit.
  }
}

// ---- helpers --------------------------------------------------------------------------------

const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
const now = () => new Date().toISOString();
const today = () => localDate(new Date());
function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + n));
}

const fail = (status: number, code: string, message = code): never => {
  throw new ApiError(status, code, message);
};

function requireUser(s: State) {
  return s.user ?? fail(401, 'INVALID_REFRESH_TOKEN', 'Please sign in again.');
}

function requiredSteps(slug: string): Step[] {
  return chapterContent(slug)?.steps ?? STEPS;
}

function isComplete(s: State, c: ChapterInfo): boolean {
  const row = s.chapters[c.slug];
  return !!row && c.available && requiredSteps(c.slug).every((st) => row.steps.includes(st));
}

const lessonsOfWeek = (week: number) => manifest().chapters.filter((c) => c.kind === 'lesson' && c.week === week);
const levelInfo = (week: number) => manifest().levels.find((l) => l.week === week) ?? manifest().levels[0];
function levelForDay(day: number) {
  return [...manifest().levels].reverse().find((l) => day >= l.startDay) ?? manifest().levels[0];
}

function weekComplete(s: State, week: number): boolean {
  const lessons = lessonsOfWeek(week);
  return lessons.length === 7 && lessons.every((c) => isComplete(s, c));
}

function unlocked(s: State, c: ChapterInfo, journeyDay: number): boolean {
  if (!c.available) {
    return false;
  }
  if (s.settings.unlockAll || c.kind === 'starter' || c.week <= 1) {
    return true;
  }
  return journeyDay >= levelInfo(c.week).startDay || weekComplete(s, c.week - 1);
}

/** The journey day moves with finished lessons, so the whole journey can be tried in one sitting. */
function journeyDay(s: State): number {
  const done = manifest().chapters.filter((c) => c.kind === 'lesson' && isComplete(s, c)).length;
  return Math.min(21, Math.max(s.startDay, done + 1));
}

function starterDone(s: State): boolean {
  const starter = manifest().chapters.filter((c) => c.kind === 'starter' && c.available);
  return starter.length > 0 && starter.every((c) => isComplete(s, c));
}

function membership(s: State): Membership {
  const active = s.settings.member || (!!s.membership && s.membership.expiresAt > now());
  return {
    plan: active ? (s.membership?.plan ?? 'JOURNEY') : 'FREE',
    active,
    expiresAt: active ? (s.membership?.expiresAt ?? addDays(today(), 60)) : null,
    freeDays: manifest().freeDays,
  };
}

function canPlay(s: State, c: ChapterInfo): boolean {
  return c.kind === 'starter' || (c.kind === 'lesson' && c.day <= manifest().freeDays) || membership(s).active;
}

function nextChapter(s: State): ChapterInfo | null {
  const day = journeyDay(s);
  if (s.starterRecommended && !starterDone(s)) {
    const left = manifest().chapters.find((c) => c.kind === 'starter' && c.available && !isComplete(s, c));
    if (left) {
      return left;
    }
  }
  const startWeek = levelForDay(s.startDay).week;
  let skipped: ChapterInfo | null = null;
  for (const c of manifest().chapters) {
    if (!c.available || c.kind === 'starter' || isComplete(s, c) || !unlocked(s, c, day)) {
      continue;
    }
    if (c.week >= startWeek) {
      return c;
    }
    skipped = skipped ?? c;
  }
  return skipped;
}

function activeDays(s: State): string[] {
  return Object.keys(s.dailyXp)
    .filter((d) => s.dailyXp[d] >= DAILY_GOAL_XP)
    .sort()
    .reverse();
}

function streak(s: State): number {
  const days = activeDays(s);
  if (days.length === 0 || days[0] < addDays(today(), -1)) {
    return 0;
  }
  let run = 1;
  for (let i = 1; i < days.length && addDays(days[i], 1) === days[i - 1]; i++) {
    run++;
  }
  return run;
}

function practiceDaysThisWeek(s: State): string[] {
  const t = new Date();
  const monday = localDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7)));
  const sunday = addDays(monday, 6);
  return Object.keys(s.dailyXp)
    .filter((d) => d >= monday && d <= sunday && s.dailyXp[d] > 0)
    .sort();
}

// ---- resources ------------------------------------------------------------------------------

function me(s: State): Me {
  const user = requireUser(s);
  const day = journeyDay(s);
  const level = levelForDay(day);
  const next = nextChapter(s);
  const meta = next ? chapterContent(next.slug) : undefined;
  const scores = Object.values(s.chapters).reduce((a, r) => ({ sum: a.sum + r.scoreSum, n: a.n + r.scoreCount }), { sum: 0, n: 0 });
  const todayXp = s.dailyXp[today()] ?? 0;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    timezone: user.timezone,
    reminderHour: user.reminderHour,
    voiceConsent: user.voiceConsent,
    memberSince: user.createdAt,
    journeyDay: day,
    week: level.week,
    levelId: level.id,
    level: level.title,
    levelTr: level.titleTr,
    trip: level.trip,
    todayDone: todayXp >= DAILY_GOAL_XP,
    todayXp,
    dailyGoalXp: DAILY_GOAL_XP,
    streak: streak(s),
    streakBest: Math.max(s.streakBest, streak(s)),
    xp: s.xpTotal,
    speakingAccuracy: scores.n ? Math.round(scores.sum / scores.n) : null,
    placementScore: s.placementScore,
    finalScore: s.finalScore,
    starterRecommended: s.starterRecommended,
    starterDone: starterDone(s),
    graduatedAt: s.graduatedAt,
    practice: { thisWeek: practiceDaysThisWeek(s).length, weeklyGoal: 2 },
    membership: membership(s),
    nextChapter:
      next && meta
        ? {
            slug: next.slug,
            kind: next.kind,
            stop: next.stop,
            week: next.week,
            day: next.day,
            title: next.title,
            titleTr: next.titleTr,
            mission: meta.mission,
            missionTr: meta.missionTr,
            scenario: meta.survive?.scenario ?? null,
          }
        : null,
  };
}

function levels(s: State): LevelBadge[] {
  return manifest().levels.map((l) => {
    const lessons = lessonsOfWeek(l.week);
    const earned = weekComplete(s, l.week);
    const stamps = lessons.map((c) => s.chapters[c.slug]?.stampedAt).filter((d): d is string => !!d).sort();
    return {
      id: l.id,
      week: l.week,
      title: l.title,
      titleTr: l.titleTr,
      tagline: l.tagline,
      message: l.message,
      messageTr: l.messageTr,
      trip: l.trip,
      lessonsDone: lessons.filter((c) => isComplete(s, c)).length,
      lessons: lessons.length,
      earned,
      earnedAt: earned ? stamps[stamps.length - 1] ?? null : null,
    };
  });
}

function passport(s: State): Passport {
  const user = requireUser(s);
  const day = journeyDay(s);
  const chapters: PassportChapter[] = manifest().chapters.map((c) => {
    const row = s.chapters[c.slug];
    const required = requiredSteps(c.slug);
    const done = row ? STEPS.filter((st) => required.includes(st) && row.steps.includes(st)) : [];
    return {
      slug: c.slug,
      kind: c.kind,
      stop: c.stop,
      title: c.title,
      titleTr: c.titleTr,
      week: c.week,
      day: c.day,
      order: c.order,
      icon: c.icon,
      available: c.available,
      unlocked: unlocked(s, c, day),
      stepsDone: done.length,
      totalSteps: required.length,
      doneSteps: done,
      complete: isComplete(s, c),
      stars: row?.stars ?? 0,
      stamp: chapterContent(c.slug)?.stamp ?? null,
      stampedAt: row?.stampedAt ?? null,
    };
  });
  return {
    holder: user.displayName,
    issuedAt: user.createdAt,
    journeyDay: day,
    level: levelForDay(day).title,
    stamps: chapters.filter((c) => c.stampedAt && c.kind !== 'starter').length,
    levels: levels(s),
    chapters,
  };
}

type AttemptIn = { clientId: string; chapter: string; step: Step; score: number | null; occurredAt?: string };

function sync(s: State, attempts: AttemptIn[]): SyncResult {
  requireUser(s);
  let accepted = 0;
  let xpGained = 0;
  const touched = new Set<string>();
  const weeksBefore = new Map(manifest().levels.map((l) => [l.week, weekComplete(s, l.week)]));
  for (const a of attempts) {
    if (!chapterInfo(a.chapter)?.available) {
      fail(400, 'UNKNOWN_CHAPTER');
    }
  }
  for (const a of attempts) {
    if (s.attempts.includes(a.clientId)) {
      continue;
    }
    s.attempts.push(a.clientId);
    accepted++;
    const score = a.score == null ? null : Math.max(0, Math.min(100, a.score));
    const xp = (a.step === 'SURVIVE' ? 50 : 10) + (score != null && score >= 80 ? 5 : 0);
    xpGained += xp;
    s.dailyXp[today()] = (s.dailyXp[today()] ?? 0) + xp;
    const row = (s.chapters[a.chapter] ??= { steps: [], scoreSum: 0, scoreCount: 0, stars: 0, stampedAt: null });
    if (!row.steps.includes(a.step)) {
      row.steps.push(a.step);
    }
    if (score != null) {
      row.scoreSum += score;
      row.scoreCount++;
    }
    touched.add(a.chapter);
  }

  const stamped: string[] = [];
  for (const slug of touched) {
    const info = chapterInfo(slug);
    const row = s.chapters[slug];
    if (info && isComplete(s, info)) {
      const avg = row.scoreCount ? Math.round(row.scoreSum / row.scoreCount) : null;
      row.stars = avg == null ? 1 : avg >= 85 ? 3 : avg >= 70 ? 2 : 1;
      if (!row.stampedAt) {
        row.stampedAt = now();
        stamped.push(slug);
      }
    }
  }
  const levelsEarned = manifest()
    .levels.filter((l) => !weeksBefore.get(l.week) && weekComplete(s, l.week))
    .map((l) => l.id as LevelId);
  let graduated = false;
  if (!s.graduatedAt && manifest().levels.every((l) => weekComplete(s, l.week))) {
    s.graduatedAt = now();
    graduated = true;
  }
  s.xpTotal += xpGained;
  s.streakBest = Math.max(s.streakBest, streak(s));
  return {
    accepted,
    duplicates: attempts.length - accepted,
    xpGained,
    stampedChapters: stamped,
    levelsEarned,
    graduated,
    xpTotal: s.xpTotal,
    streak: streak(s),
  };
}

function placementSubmit(s: State, body: { kind: 'INITIAL' | 'FINAL'; answers: (number | null)[]; speakingScores?: number[] }): PlacementResult {
  requireUser(s);
  const questions = placementContent.questions;
  if (body.answers.length !== questions.length) {
    fail(400, 'WRONG_ANSWER_COUNT');
  }
  const correct = questions.filter((q, i) => body.answers[i] === q.answer).length;
  const written = Math.round((60 * correct) / questions.length);
  const spoken = body.speakingScores ?? [];
  const speaking = spoken.length
    ? Math.round(0.3 * (spoken.reduce((a, b) => a + Math.max(0, Math.min(100, b)), 0) / spoken.length))
    : Math.floor(written / 2);
  const score = Math.min(100, 10 + written + speaking);
  const band = placementContent.bands.reduce((match, b) => (score >= b.min ? b : match), placementContent.bands[0]);
  let applied = false;
  if (body.kind === 'INITIAL') {
    applied = s.attempts.length === 0;
    s.placementScore = score;
    if (applied) {
      s.startDay = band.startDay;
    }
    s.starterRecommended = band.starter;
  } else {
    s.finalScore = score;
  }
  return {
    score,
    correct,
    total: questions.length,
    level: band.level,
    startDay: band.startDay,
    messageTr: band.messageTr,
    starter: band.starter,
    startDayApplied: applied,
  };
}

function practice(s: State): PracticeOverview {
  const days = practiceDaysThisWeek(s);
  const phrases = new Map<string, { en: string; tr: string }>();
  Object.values(s.sessions)
    .filter((x) => x.report)
    .reverse()
    .forEach((x) =>
      x.report!.phrases.forEach((p) => {
        if (p.en && phrases.size < 20 && !phrases.has(p.en.toLowerCase())) {
          phrases.set(p.en.toLowerCase(), p);
        }
      }),
    );
  const scenes = manifest()
    .chapters.filter((c) => c.available && s.chapters[c.slug]?.stampedAt)
    .flatMap((c) => {
      const scenario = chapterContent(c.slug)?.survive?.scenario;
      return scenario ? [{ chapter: c.slug, scenario, title: c.title, titleTr: c.titleTr, icon: c.icon, week: c.week }] : [];
    });
  return { weeklyGoal: 2, practiceDays: days, thisWeek: days.length, phrases: [...phrases.values()], scenes };
}

function offers(s: State): Offers {
  return {
    current: membership(s),
    storeConnected: true,
    plans: [
      {
        id: 'JOURNEY',
        title: 'Gate 21 Journey',
        titleTr: '21 günlük yolculuk',
        price: '₺449',
        periodTr: 'Tek seferlik · 60 gün erişim',
        featuresTr: [
          '21 günün bütün dersleri (Bronz, Gümüş, Altın)',
          'Her durakta yapay zekâlı sahneler ve raporlar',
          'Full Trip simülasyonu ve final testi',
          'Başlangıç paketi ve SOS her zaman ücretsiz',
        ],
      },
      {
        id: 'KEEP_READY',
        title: 'Keep your English travel ready',
        titleTr: 'İngilizcen seyahate hazır kalsın',
        price: '₺99/ay',
        periodTr: 'Aylık · yolculuğu bitirenlere',
        featuresTr: [
          'Bütün sahneleri yeniden oyna, her seferinde yeni sürprizler',
          'Raporlarındaki kalıplarla kısa tekrarlar',
          'Haftada 2 pratik hedefi ve hatırlatmalar',
          'Yeni şehirler ve bölümler eklendikçe',
        ],
      },
    ],
  };
}

/** Pronunciation score from the browser's transcript: how many of the reference words were heard. */
export function assess(reference: string, transcript: string | null): Assessment {
  const words = reference.match(/[A-Za-z0-9']+/g) ?? [];
  if (transcript === '') {
    fail(422, 'SPEECH_NOT_RECOGNIZED');
  }
  const heard = new Set((transcript ?? '').toLowerCase().match(/[a-z0-9']+/g) ?? []);
  // Without a recognizer (some browsers) the demo cannot hear you and gives a friendly score.
  const scored = words.map((w) => ({
    word: w,
    score: transcript == null ? 88 : heard.has(w.toLowerCase()) ? 94 : 42,
    errorType: transcript == null || heard.has(w.toLowerCase()) ? 'None' : 'Omission',
  }));
  const found = scored.filter((w) => w.errorType === 'None').length;
  const completeness = words.length ? Math.round((100 * found) / words.length) : 100;
  const accuracy = scored.length ? Math.round(scored.reduce((a, w) => a + w.score, 0) / scored.length) : 90;
  const fluency = transcript == null ? 85 : 88;
  const overall = Math.round(0.6 * accuracy + 0.2 * fluency + 0.2 * completeness);
  const weakest = scored.find((w) => w.score < 80)?.word ?? null;
  const tipTr =
    completeness < 60
      ? 'Cümlenin tamamını söylemeyi dene.'
      : weakest
        ? `“${weakest}” kelimesini biraz daha yavaş ve net söylemeyi dene.`
        : 'Çok net! Böyle devam.';
  return { overall, accuracy, fluency, completeness, words: scored, weakestWord: weakest, tipTr };
}

// ---- routing --------------------------------------------------------------------------------

type Body = Record<string, unknown> | FormData | undefined;

function field(body: Body, name: string): string | null {
  if (body instanceof FormData) {
    const v = body.get(name);
    return typeof v === 'string' ? v : null;
  }
  const v = body?.[name];
  return typeof v === 'string' ? v : null;
}

function signIn(s: State, email: string, displayName: string, timezone?: string) {
  s.user = {
    id: uuid(),
    email,
    displayName,
    timezone: timezone ?? 'Europe/Istanbul',
    reminderHour: 20,
    voiceConsent: false,
    createdAt: now(),
  };
  return { accessToken: 'demo-access', refreshToken: 'demo-refresh', expiresIn: 3600 };
}

function route(method: string, path: string, body: Body): unknown {
  const s = load();
  const p = path.replace(/\?.*$/, '');

  if (method === 'POST' && p === '/api/v1/auth/register') {
    const b = body as { displayName: string; email: string; timezone?: string };
    const settings = s.settings;
    Object.assign(s, fresh(), { settings });
    return signIn(s, b.email, b.displayName?.trim() || 'Gezgin', b.timezone);
  }
  if (method === 'POST' && p === '/api/v1/auth/login') {
    const b = body as { email: string };
    // The automatic demo sign-in continues whoever used this browser last.
    if (s.user && (b.email === DEMO_EMAIL || s.user.email.toLowerCase() === b.email.toLowerCase())) {
      return { accessToken: 'demo-access', refreshToken: 'demo-refresh', expiresIn: 3600 };
    }
    const settings = s.settings;
    Object.assign(s, fresh(), { settings });
    return signIn(s, b.email, b.email === DEMO_EMAIL ? 'Gezgin' : b.email.split('@')[0] || 'Gezgin');
  }
  if (p === '/api/v1/auth/logout') {
    return undefined;
  }
  if (p === '/api/v1/auth/refresh') {
    return s.user ? { accessToken: 'demo-access', refreshToken: 'demo-refresh', expiresIn: 3600 } : fail(401, 'INVALID_REFRESH_TOKEN');
  }

  if (p === '/api/v1/me') {
    if (method === 'DELETE') {
      const settings = s.settings;
      Object.assign(s, fresh(), { settings });
      return undefined;
    }
    if (method === 'PATCH') {
      const user = requireUser(s);
      const b = body as { voiceConsent?: boolean; displayName?: string; reminderHour?: number };
      if (b.voiceConsent !== undefined) {
        user.voiceConsent = b.voiceConsent;
      }
      if (b.displayName) {
        user.displayName = b.displayName.trim();
      }
      if (b.reminderHour !== undefined) {
        user.reminderHour = b.reminderHour;
      }
    }
    return me(s);
  }
  if (p === '/api/v1/progress/passport') {
    return passport(s);
  }
  if (p === '/api/v1/progress/sync') {
    return sync(s, (body as { attempts: AttemptIn[] }).attempts);
  }
  if (p === '/api/v1/placement') {
    return placementSubmit(s, body as Parameters<typeof placementSubmit>[1]);
  }
  if (p === '/api/v1/practice') {
    return practice(s);
  }
  if (p === '/api/v1/practice/done') {
    if (!membership(s).active) {
      fail(402, 'MEMBERSHIP_REQUIRED');
    }
    s.dailyXp[today()] = (s.dailyXp[today()] ?? 0) + 20;
    s.xpTotal += 20;
    return practice(s);
  }
  if (p === '/api/v1/membership') {
    return offers(s);
  }
  if (p === '/api/v1/membership/purchase') {
    const plan = (body as { plan: 'JOURNEY' | 'KEEP_READY' }).plan;
    s.membership = { plan, expiresAt: new Date(Date.now() + (plan === 'JOURNEY' ? 60 : 30) * 86400000).toISOString() };
    return membership(s);
  }
  if (p === '/api/v1/speech/assess') {
    requireUser(s);
    return assess(field(body, 'referenceText') ?? '', field(body, 'transcript'));
  }

  if (method === 'POST' && p === '/api/v1/roleplay/sessions') {
    const user = requireUser(s);
    const slug = (body as { scenario: string }).scenario;
    const scenario = scenarios[slug] ?? fail(404, 'SCENARIO_NOT_FOUND');
    const info = chapterInfo(scenario.chapter) ?? fail(404, 'SCENARIO_NOT_FOUND');
    if (!canPlay(s, info)) {
      fail(402, 'MEMBERSHIP_REQUIRED');
    }
    const { session, view } = scene.start(scenario, scene.difficultyForWeek(info.week), user.displayName, uuid());
    s.sessions[session.id] = session;
    pruneSessions(s);
    return view;
  }
  const turnMatch = p.match(/^\/api\/v1\/roleplay\/sessions\/([^/]+)\/(turns|report)$/);
  if (turnMatch) {
    const user = requireUser(s);
    const session = s.sessions[turnMatch[1]] ?? fail(404, 'SESSION_NOT_FOUND');
    const scenario = scenarios[session.scenario];
    if (turnMatch[2] === 'report') {
      if (session.status === 'ACTIVE') {
        fail(409, 'SESSION_ACTIVE');
      }
      session.report ??= scene.report(scenario, session, user.displayName);
      return session.report satisfies SceneReport;
    }
    if (session.status !== 'ACTIVE') {
      fail(409, 'SESSION_FINISHED');
    }
    // What the browser heard wins over the suggested line, like the server's transcript.
    const transcript = field(body, 'transcript');
    if (transcript === '') {
      fail(422, 'SPEECH_NOT_RECOGNIZED');
    }
    const said = transcript ?? field(body, 'text') ?? '';
    if (!said.trim()) {
      fail(400, 'TEXT_REQUIRED');
    }
    return scene.turn(scenario, session, said, field(body, 'hintUsed') === 'true', user.displayName) satisfies SceneView;
  }

  return fail(404, 'NOT_FOUND', `Demo has no ${method} ${p}`);
}

/** Only the newest 40 scenes are kept, so localStorage stays small. */
function pruneSessions(s: State) {
  const ids = Object.keys(s.sessions);
  ids.slice(0, Math.max(0, ids.length - 40)).forEach((id) => delete s.sessions[id]);
}

/** Answers one API call. Resolves with the JSON body; rejects with an ApiError like the real client. */
export async function demoRequest<T>(method: string, path: string, body?: Body): Promise<T> {
  // A short pause, so loading states show as they would on a phone.
  await new Promise((r) => setTimeout(r, 120));
  try {
    return route(method, path, body) as T;
  } finally {
    save();
  }
}

// ---- the demo panel -------------------------------------------------------------------------

export function demoSettings(): DemoSettings {
  return { ...load().settings };
}

export function setDemoSettings(next: Partial<DemoSettings>): void {
  const s = load();
  s.settings = { ...s.settings, ...next };
  save();
}

/**
 * Marks every lesson of a week as finished except the last one, so the next lesson played
 * earns the week's badge (and, in week 3, the graduation).
 */
export function finishWeekButOne(week: number): void {
  const s = load();
  const lessons = lessonsOfWeek(week);
  lessons.slice(0, -1).forEach((c) => {
    s.chapters[c.slug] = { steps: [...requiredSteps(c.slug)], scoreSum: 90, scoreCount: 1, stars: 3, stampedAt: now() };
  });
  for (let w = 1; w < week; w++) {
    lessonsOfWeek(w)
      .filter((c) => !isComplete(s, c))
      .forEach((c) => {
        s.chapters[c.slug] = { steps: [...requiredSteps(c.slug)], scoreSum: 90, scoreCount: 1, stars: 3, stampedAt: now() };
      });
  }
  s.graduatedAt = null;
  save();
}

/** Forgets all progress but keeps the account, the placement result and the panel settings. */
export function resetProgress(): void {
  const s = load();
  Object.assign(s, { chapters: {}, attempts: [], dailyXp: {}, xpTotal: 0, streakBest: 0, graduatedAt: null, sessions: {}, finalScore: null });
  save();
}
