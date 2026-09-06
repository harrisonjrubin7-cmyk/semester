import { describe, expect, it } from 'vitest';
import { LEAST_DAYS, planFor, planLine, shapeOf } from './steps';

/** Fixed dates, so a test never depends on when it is run. */
const on = (m: number, d: number) => new Date(2026, m, d);

describe('shapeOf', () => {
  it('knows the shape of the work it recognises', () => {
    expect(shapeOf('essay')).toContain('Gather sources');
    expect(shapeOf('problem set')).toContain('First pass');
  });

  it('reads a kind however the syllabus wrote it', () => {
    // `normalKind` is what makes "Essay", "essays" and "Paper" one thing.
    expect(shapeOf('Essay')).toEqual(shapeOf('essay'));
  });

  it('has an exam study, not an exam submission', () => {
    // A closed-note midterm sat in a room is not submitted, and the generic
    // shape told somebody to "finish and submit" one.
    const out = shapeOf('Midterm 2');
    expect(out.join(' ')).not.toMatch(/submit/i);
    expect(out.join(' ')).toMatch(/drill|practice|practise/i);
    expect(shapeOf('Final Exam')).toEqual(out);
  });

  it('still has a shape for a kind it has never seen', () => {
    const out = shapeOf('viva voce');
    expect(out.length).toBeGreaterThan(1);
    expect(out[out.length - 1]).toMatch(/submit/i);
  });
});

describe('planFor', () => {
  it('lands the last step on the day it is due', () => {
    const steps = planFor('essay', on(8, 25), on(8, 4));
    expect(steps[steps.length - 1].date).toBe('2026-09-25');
  });

  it('starts no earlier than today', () => {
    const steps = planFor('essay', on(8, 25), on(8, 4));
    expect(steps[0].date >= '2026-09-04').toBe(true);
  });

  it('puts the steps in order and never two on one day', () => {
    const steps = planFor('essay', on(8, 25), on(8, 4));
    const dates = steps.map((s) => s.date);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('refuses to plan work that is due today or tomorrow', () => {
    // The refusal is the feature. Five steps compressed into one evening is
    // not a plan, and offering one would be the app lying about the situation.
    expect(planFor('essay', on(8, 4), on(8, 4))).toEqual([]);
    expect(planFor('essay', on(8, 3), on(8, 4))).toEqual([]);
    expect(planFor('essay', on(8, 5), on(8, 4)).length).toBeGreaterThan(0);
  });

  it('gives one step per day at most when the run is short', () => {
    // Three days out, six named steps in the shape: it must drop some.
    const steps = planFor('essay', on(8, 7), on(8, 4));
    expect(steps.length).toBeLessThanOrEqual(4);
    expect(new Set(steps.map((s) => s.date)).size).toBe(steps.length);
  });

  it('keeps starting and submitting when it has to squeeze', () => {
    const full = shapeOf('essay');
    const squeezed = planFor('essay', on(8, 6), on(8, 4)).map((s) => s.title);
    expect(squeezed[0]).toBe(full[0]);
    expect(squeezed[squeezed.length - 1]).toBe(full[full.length - 1]);
  });

  it('never makes more steps than the shape names', () => {
    // A whole term of runway does not turn four steps into forty.
    const steps = planFor('problem set', on(11, 1), on(8, 4));
    expect(steps).toHaveLength(shapeOf('problem set').length);
  });

  it('honours a tighter cap when one is asked for', () => {
    expect(planFor('essay', on(8, 25), on(8, 4), 3)).toHaveLength(3);
  });

  it('reads the day from local time, not UTC', () => {
    // A late-evening `now` in a western timezone used to roll the date
    // forward and shift every step by a day.
    const steps = planFor('essay', new Date(2026, 8, 25, 23, 40), new Date(2026, 8, 4, 23, 40));
    expect(steps[steps.length - 1].date).toBe('2026-09-25');
  });

  it('crosses a month boundary without inventing a 31st of September', () => {
    const steps = planFor('project', on(9, 6), on(8, 28));
    expect(steps.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date))).toBe(true);
    expect(steps.some((s) => s.date.startsWith('2026-10'))).toBe(true);
  });

  it('agrees with its own floor', () => {
    expect(LEAST_DAYS).toBe(1);
  });
});

describe('planLine', () => {
  it('says what will happen before it happens', () => {
    const steps = planFor('essay', on(8, 25), on(8, 4));
    expect(planLine(steps, 'Paper 1')).toContain(`${steps.length} steps`);
  });

  it('explains the refusal rather than showing an empty plan', () => {
    expect(planLine([], 'Paper 1')).toContain('too close');
  });
});
