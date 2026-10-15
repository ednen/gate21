/**
 * The scene engine of the API (ScenePlanner, ScriptedRoleplayModel, RoleplayService) ported to
 * TypeScript for the demo build, which runs without a server. Same plan, same keyword judge,
 * same report, so a scene plays here exactly as it does with the scripted model on the server.
 */
import type { Difficulty, SceneMessage, SceneReport, SceneView } from '../types';

export type Option = { text: string; keywords: string[]; reply: string };
export type Goal = {
  id: string;
  titleTr: string;
  ask?: string;
  instruction?: string;
  hint: string;
  hintTr?: string;
  keywords: string[];
  successReply: string;
  retryReply: string;
  role?: string;
  setting?: string;
  voice?: string;
  persona?: string;
};
export type Twist = { id: string; titleTr: string; intro: string; instruction?: string; retryReply: string; options: Option[] };
export type Fact = { id: string; values: string[]; question: string; questionTr: string };
export type Scenario = {
  slug: string;
  chapter: string;
  title: string;
  titleTr: string;
  role: string;
  setting: string;
  voice?: string;
  persona?: string;
  briefTr?: string;
  opening: string;
  closing?: string;
  facts: Fact[];
  goals: Goal[];
  twists: Twist[];
  twistSlots: { after: string; pool: string[] }[];
};

export type SceneStep = {
  id: string;
  twist: boolean;
  titleTr: string;
  ask: string | null;
  hint: string | null;
  hintTr: string | null;
  keywords: string[];
  successReply: string | null;
  retryReply: string;
  options: Option[];
  role: string;
  setting: string;
  voice: string | null;
  segmentStart: boolean;
};

export type Turn = { role: 'AI' | 'USER'; kind: string; text: string; stepId: string; goalMet: boolean | null };

export type Session = {
  id: string;
  scenario: string;
  difficulty: Difficulty;
  plan: string[];
  facts: Record<string, string>;
  stepIndex: number;
  turnCount: number;
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  hintsUsed: number;
  failedTurns: number;
  turns: Turn[];
  report: SceneReport | null;
};

const TWISTS_PER_SLOT: Record<Difficulty, number> = { BRONZE: 1, SILVER: 1, GOLD: 2 };
const HINTS_ALLOWED: Record<Difficulty, boolean> = { BRONZE: true, SILVER: true, GOLD: false };
const MAX_USER_CHARS = 300;

export function difficultyForWeek(week: number): Difficulty {
  return week <= 1 ? 'BRONZE' : week === 2 ? 'SILVER' : 'GOLD';
}

type Random = () => number;
const pick = (n: number, random: Random) => Math.floor(random() * n);

export function plan(s: Scenario, difficulty: Difficulty, random: Random = Math.random): string[] {
  const out: string[] = [];
  for (const goal of s.goals) {
    out.push(`g:${goal.id}`);
    for (const slot of s.twistSlots) {
      if (slot.after === goal.id) {
        const pool = [...slot.pool];
        const count = Math.min(TWISTS_PER_SLOT[difficulty], pool.length);
        for (let i = 0; i < count; i++) {
          out.push(`t:${pool.splice(pick(pool.length, random), 1)[0]}`);
        }
      }
    }
  }
  return out;
}

export function facts(s: Scenario, random: Random = Math.random): Record<string, string> {
  return Object.fromEntries(s.facts.map((f) => [f.id, f.values[pick(f.values.length, random)]]));
}

export function fill(text: string | undefined | null, values: Record<string, string>): string | null {
  if (text == null) {
    return null;
  }
  return text.replace(/\{(\w+)}/g, (whole, key: string) => values[key] ?? whole);
}

export function resolve(s: Scenario, planned: string[], factValues: Record<string, string>, guestName: string): SceneStep[] {
  const values = { ...factValues, name: guestName };
  let role = s.role;
  let setting = s.setting;
  let voice = s.voice ?? null;
  return planned.map((ref, i) => {
    if (ref.startsWith('g:')) {
      const g = s.goals.find((x) => x.id === ref.slice(2));
      if (!g) {
        throw new Error(`Plan refers to missing goal ${ref}`);
      }
      const segmentStart = i > 0 && !!g.role;
      if (g.role) {
        role = g.role;
        setting = g.setting ?? setting;
        voice = g.voice ?? voice;
      }
      return {
        id: g.id,
        twist: false,
        titleTr: g.titleTr,
        ask: fill(g.ask, values),
        hint: fill(g.hint, values),
        hintTr: fill(g.hintTr, values),
        keywords: g.keywords ?? [],
        successReply: fill(g.successReply, values),
        retryReply: fill(g.retryReply, values) ?? '',
        options: [],
        role,
        setting: fill(setting, values) ?? '',
        voice,
        segmentStart,
      };
    }
    const t = s.twists.find((x) => x.id === ref.slice(2));
    if (!t) {
      throw new Error(`Plan refers to missing twist ${ref}`);
    }
    return {
      id: t.id,
      twist: true,
      titleTr: t.titleTr,
      ask: fill(t.intro, values),
      hint: null,
      hintTr: null,
      keywords: [],
      successReply: null,
      retryReply: fill(t.retryReply, values) ?? '',
      options: t.options.map((o) => ({ text: fill(o.text, values) ?? '', keywords: o.keywords, reply: fill(o.reply, values) ?? '' })),
      role,
      setting: fill(setting, values) ?? '',
      voice,
      segmentStart: false,
    };
  });
}

// ---- the scripted judge ---------------------------------------------------------------------

export const normalize = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/’/g, "'").trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function contains(text: string, keyword: string): boolean {
  const k = normalize(keyword);
  // Java's \W is "not [A-Za-z0-9_]", which this mirrors.
  return k !== '' && new RegExp(`(^|[^A-Za-z0-9_])${escape(k)}($|[^A-Za-z0-9_])`).test(text);
}

export function matchOption(options: Option[], text: string): number {
  let best = -1;
  let bestHits = 0;
  options.forEach((o, i) => {
    const hits = o.keywords.filter((k) => contains(text, k)).length;
    if (hits > bestHits) {
      best = i;
      bestHits = hits;
    }
  });
  return best;
}

export type Reply = { reply: string; goalMet: boolean; feedbackTr: string; optionIndex: number };

export function judge(step: SceneStep, said: string): Reply {
  const text = normalize(said);
  if (step.twist) {
    const option = matchOption(step.options, text);
    return option >= 0
      ? { reply: step.options[option].reply, goalMet: true, feedbackTr: 'Harika, sorunu çözdün!', optionIndex: option }
      : { reply: step.retryReply, goalMet: false, feedbackTr: 'Sorunu çözecek bir şey sor ya da iste.', optionIndex: -1 };
  }
  return step.keywords.some((k) => contains(text, k))
    ? { reply: step.successReply ?? '', goalMet: true, feedbackTr: 'Anlaşıldın, devam!', optionIndex: -1 }
    : { reply: step.retryReply, goalMet: false, feedbackTr: 'Tam anlaşılmadı. Soruya cevap vermeyi dene.', optionIndex: -1 };
}

// ---- the session ----------------------------------------------------------------------------

export function start(s: Scenario, difficulty: Difficulty, guestName: string, id: string): { session: Session; view: SceneView } {
  const planned = plan(s, difficulty);
  const factValues = facts(s);
  const steps = resolve(s, planned, factValues, guestName);
  const opening = fill(s.opening, { ...factValues, name: guestName }) ?? '';
  const session: Session = {
    id,
    scenario: s.slug,
    difficulty,
    plan: planned,
    facts: factValues,
    stepIndex: 0,
    turnCount: 0,
    status: 'ACTIVE',
    hintsUsed: 0,
    failedTurns: 0,
    turns: [{ role: 'AI', kind: 'say', text: opening, stepId: steps[0].id, goalMet: null }],
    report: null,
  };
  const messages: SceneMessage[] = [{ kind: 'say', role: steps[0].role, text: opening, voice: steps[0].voice }];
  return { session, view: view(s, session, steps, 0, null, null, null, messages, false, false, guestName) };
}

/** What the characters say after a step is met: a surprise, a new character, the next question or the goodbye. */
function lead(steps: SceneStep[], next: number, current: SceneStep, s: Scenario, values: Record<string, string>): SceneMessage[] {
  if (next >= steps.length) {
    return s.closing ? [{ kind: 'closing', role: current.role, text: fill(s.closing, values) ?? '', voice: current.voice }] : [];
  }
  const step = steps[next];
  if (step.twist) {
    return [{ kind: 'twist', role: step.role, text: step.ask ?? '', voice: step.voice }];
  }
  if (step.segmentStart) {
    return [
      { kind: 'transition', role: step.role, text: step.setting, voice: step.voice },
      { kind: 'say', role: step.role, text: step.ask ?? '', voice: step.voice },
    ];
  }
  return step.ask ? [{ kind: 'say', role: step.role, text: step.ask, voice: step.voice }] : [];
}

export function turn(s: Scenario, session: Session, said: string, hintUsed: boolean, guestName: string): SceneView {
  const steps = resolve(s, session.plan, session.facts, guestName);
  const step = steps[session.stepIndex];
  const userText = said.trim().slice(0, MAX_USER_CHARS);
  const reply = judge(step, userText);
  const values = { ...session.facts, name: guestName };

  const messages: SceneMessage[] = [{ kind: 'say', role: step.role, text: reply.reply, voice: step.voice }];
  const next = reply.goalMet ? session.stepIndex + 1 : session.stepIndex;
  const completed = next >= steps.length;
  if (reply.goalMet) {
    messages.push(...lead(steps, next, step, s, values));
  }
  session.turnCount += 1;
  const done = completed || session.turnCount >= steps.length * 2 + 2;
  session.status = completed ? 'COMPLETED' : done ? 'ABANDONED' : 'ACTIVE';
  session.stepIndex = next;
  session.hintsUsed += hintUsed ? 1 : 0;
  session.failedTurns += reply.goalMet ? 0 : 1;
  session.turns.push({ role: 'USER', kind: 'user', text: userText, stepId: step.id, goalMet: reply.goalMet });
  messages.forEach((m) => session.turns.push({ role: 'AI', kind: m.kind, text: m.text, stepId: step.id, goalMet: null }));
  return view(s, session, steps, Math.min(next, steps.length), userText, reply.goalMet, reply.feedbackTr, messages, done, completed, guestName);
}

function view(
  s: Scenario,
  session: Session,
  steps: SceneStep[],
  index: number,
  userText: string | null,
  goalMet: boolean | null,
  feedbackTr: string | null,
  messages: SceneMessage[],
  done: boolean,
  completed: boolean,
  guestName: string,
): SceneView {
  const current = index < steps.length ? steps[index] : steps[steps.length - 1];
  const hints = HINTS_ALLOWED[session.difficulty];
  const showHints = !done && hints;
  return {
    sessionId: session.id,
    scenario: s.slug,
    title: s.title,
    titleTr: s.titleTr,
    difficulty: session.difficulty,
    briefTr: fill(s.briefTr, { ...session.facts, name: guestName }),
    role: current.role,
    setting: current.setting,
    voice: current.voice,
    userText,
    goalMet,
    feedbackTr,
    twist: messages.some((m) => m.kind === 'twist'),
    messages,
    stepIndex: index,
    totalSteps: steps.length,
    stepTitleTr: current.titleTr,
    hintsAllowed: hints,
    hint: showHints && !current.twist ? current.hint : null,
    hintTr: showHints && !current.twist ? current.hintTr : null,
    hintOptions: showHints && current.twist ? current.options.map((o) => o.text) : [],
    done,
    completed,
    model: 'demo',
  };
}

// ---- the report -----------------------------------------------------------------------------

export function report(s: Scenario, session: Session, guestName: string): SceneReport {
  const steps = resolve(s, session.plan, session.facts, guestName);
  const byId = new Map(steps.map((st) => [st.id, st]));
  const failures = new Map<string, number>();
  const seen = new Set<string>();

  const lines = session.turns
    .filter((t) => t.role === 'USER')
    .map((t) => {
      const step = byId.get(t.stepId);
      const firstTry = !seen.has(t.stepId);
      seen.add(t.stepId);
      if (!t.goalMet) {
        failures.set(t.stepId, (failures.get(t.stepId) ?? 0) + 1);
      }
      const better = !step
        ? t.text
        : step.twist
          ? step.options[Math.max(matchOption(step.options, normalize(t.text)), 0)].text
          : step.hint ?? t.text;
      const ok = !!t.goalMet && firstTry;
      const noteTr = ok
        ? 'Doğal ve anlaşılır.'
        : t.goalMet
          ? 'Anlaşıldın; böyle söylemek daha doğal olur.'
          : 'Bu cümle istenen şeyi karşılamadı. Şöyle söyleyebilirsin.';
      return { said: t.text, better, noteTr, ok };
    });

  let hardestTr = 'Hiç takılmadan bitirdin — harika!';
  let worst = 0;
  failures.forEach((count, id) => {
    if (count > worst) {
      worst = count;
      hardestTr = `En çok “${byId.get(id)?.titleTr ?? 'bir adım'}” anında zorlandın (${count} tekrar).`;
    }
  });

  const phrases: { en: string; tr: string }[] = [];
  const used = new Set<string>();
  const order = [...[...failures.keys()].map((id) => byId.get(id)), ...steps.filter((st) => st.twist), ...steps];
  for (const step of order) {
    if (!step || phrases.length === 3) {
      continue;
    }
    const phrase = step.twist && step.options.length > 0 ? { en: step.options[0].text, tr: '' } : { en: step.hint, tr: step.hintTr ?? '' };
    if (phrase.en && !used.has(phrase.en)) {
      used.add(phrase.en);
      phrases.push({ en: phrase.en, tr: phrase.tr });
    }
  }

  const memory = s.facts.flatMap((f) => {
    const value = session.facts[f.id];
    const mentioned = !!value && session.turns.some((t) => t.role === 'AI' && t.text.includes(value));
    if (!mentioned) {
      return [];
    }
    const others = shuffle(f.values.filter((v) => v !== value)).slice(0, 2);
    const options = shuffle([...others, value]);
    return [{ question: f.question, questionTr: f.questionTr, options, answer: options.indexOf(value) }];
  });

  return {
    sessionId: session.id,
    title: s.title,
    completed: session.status === 'COMPLETED',
    score: Math.max(40, 100 - 15 * session.failedTurns - 10 * session.hintsUsed),
    failedTurns: session.failedTurns,
    hintsUsed: session.hintsUsed,
    lines,
    hardestTr,
    phrases,
    memory,
    model: 'demo',
  };
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = pick(i + 1, Math.random);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
