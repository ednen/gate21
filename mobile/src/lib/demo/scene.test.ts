import { describe, expect, it } from 'vitest';

import { scenarios } from './scenarios';
import * as scene from './scene';

describe('demo scene engine', () => {
  it('judges every hint and option as the server does', () => {
    for (const s of Object.values(scenarios)) {
      const facts = Object.fromEntries(s.facts.map((f) => [f.id, f.values[0]]));
      const plan = [...s.goals.map((g) => `g:${g.id}`), ...s.twists.map((t) => `t:${t.id}`)];
      for (const step of scene.resolve(s, plan, facts, 'Ozan')) {
        if (step.twist) {
          step.options.forEach((o, i) => expect(scene.judge(step, o.text).optionIndex, `${s.slug}/${step.id}/${i}`).toBe(i));
        } else {
          expect(scene.judge(step, step.hint ?? '').goalMet, `${s.slug}/${step.id}`).toBe(true);
        }
      }
    }
  });

  it('plays a Gold scene to the end by following its own suggestions, then writes a report', () => {
    const s = scenarios['arrival-gold'];
    const { session, view } = scene.start(s, 'GOLD', 'Ozan', 'demo-1');
    expect(view.hintsAllowed).toBe(false);
    expect(session.plan.filter((r) => r.startsWith('t:'))).toHaveLength(s.twistSlots.reduce((n, sl) => n + Math.min(2, sl.pool.length), 0));

    let current = view;
    const steps = scene.resolve(s, session.plan, session.facts, 'Ozan');
    current = scene.turn(s, session, 'banana', false, 'Ozan');
    expect(current.goalMet).toBe(false);
    for (const step of steps) {
      current = scene.turn(s, session, step.twist ? step.options[0].text : step.hint ?? '', false, 'Ozan');
      expect(current.goalMet).toBe(true);
    }
    expect(current.completed).toBe(true);
    expect(current.messages.at(-1)?.kind).toBe('closing');

    const report = scene.report(s, session, 'Ozan');
    expect(report.completed).toBe(true);
    expect(report.score).toBe(85);
    expect(report.lines[0].ok).toBe(false);
    expect(report.phrases.length).toBeGreaterThan(0);
    report.memory.forEach((q) => expect(q.options[q.answer]).toBe(session.facts[s.facts.find((f) => f.question === q.question)!.id]));
  });
});
