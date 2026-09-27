import { describe, expect, it } from 'vitest';
import type { Choice } from './actions';
import { readTerm } from './term';
import { nextTerm, schedulesFor, termWindow, wrapped, wrappedText, type WrappedInput } from './wrapped';

/**
 * Phase L's model. What the recap counts is what the student chose and did,
 * inside the term, and nothing else; what it says has no streak, rank or
 * comparison in it; and what an export holds is counts and the term, never a
 * name, a course or a date.
 */

const FALL = readTerm('2026FA');
const at = (iso: string) => new Date(iso).getTime();
const choice = (event: 'complete' | 'snooze', when: string): Choice => ({
  status: event === 'complete' ? 'completed' : 'snoozed',
  history: [{ event, at: at(when), from: 'open', to: event === 'complete' ? 'completed' : 'snoozed' }],
});

const base = (over: Partial<WrappedInput> = {}): WrappedInput => ({
  term: FALL,
  done: {},
  tickedAt: {},
  sessions: [],
  taken: [],
  schedulesSaved: 0,
  meetings: [],
  artifacts: [],
  bullets: [],
  eventsSaved: 0,
  actionChoices: {},
  ...over,
});

const full = base({
  done: { d1: true, d2: true, d3: true, d4: false },
  tickedAt: { d1: at('2026-09-10T12:00:00'), d2: at('2026-11-20T12:00:00'), d3: at('2026-07-20T12:00:00'), d4: at('2026-09-12T12:00:00') },
  sessions: [{ doneAt: at('2026-09-01T20:00:00') }, { doneAt: at('2026-10-01T20:00:00') }, { doneAt: undefined }, { doneAt: at('2027-01-10T20:00:00') }],
  taken: [
    { term: 'Fall 2026', grade: 'A', current: false },
    { term: 'Fall 2026', grade: '', current: true },
    { term: 'Spring 2026', grade: 'B', current: false },
  ],
  schedulesSaved: 2,
  meetings: [{ date: '2026-10-03', agenda: ['Minor options'] }, { date: '2026-10-04', agenda: [] }, { date: '2026-05-01', agenda: ['x'] }],
  artifacts: [{ date: '2026-10' }, { date: '2026-03' }],
  bullets: [{ final: true, updated: at('2026-10-05T12:00:00') }, { final: false, updated: at('2026-10-05T12:00:00') }],
  eventsSaved: 4,
  actionChoices: { a: choice('complete', '2026-09-15T12:00:00'), b: choice('snooze', '2026-09-15T12:00:00'), c: choice('complete', '2026-06-15T12:00:00') },
});

describe('the term', () => {
  it('runs from the first of its month to the first of the next season’s', () => {
    expect(termWindow(FALL)).toEqual({ start: at('2026-08-01T00:00:00'), end: at('2026-12-01T00:00:00') });
    expect(termWindow(readTerm('2027SP'))).toEqual({ start: at('2027-01-01T00:00:00'), end: at('2027-05-01T00:00:00') });
    expect(termWindow(readTerm('2026WI'))).toEqual({ start: at('2026-12-01T00:00:00'), end: at('2027-01-01T00:00:00') });
  });

  it('plans the next main term', () => {
    expect(nextTerm(FALL).label).toBe('Spring 2027');
    expect(nextTerm(readTerm('2027SP')).label).toBe('Fall 2027');
    expect(nextTerm(readTerm('2026WI')).label).toBe('Spring 2027');
  });
});

describe('what it counts', () => {
  const w = wrapped(full);
  const count = (key: string) => [...w.made, ...w.forward].find((l) => l.key === key)?.count ?? 0;

  it('counts only what happened inside the term', () => {
    expect(count('deadlines')).toBe(2);
    expect(count('study')).toBe(2);
    expect(count('actions')).toBe(1);
    expect(count('artifacts')).toBe(1);
  });

  it('counts only what the student finished or made, not what they put off', () => {
    expect(count('bullets')).toBe(1);
    expect(count('agendas')).toBe(1);
    expect(count('courses')).toBe(1);
  });

  it('reads like the brief', () => {
    expect(w.title).toBe('Your Fall 2026 in Semester');
    expect(w.made.map((l) => l.text)).toEqual([
      '2 semester plans saved',
      '2 study sessions finished',
      '1 advisor agenda prepared',
      '1 portfolio project recorded',
      '4 campus events saved',
    ]);
    expect(w.forward.map((l) => l.text)).toEqual([
      'Ticking off 2 deadlines',
      'Finishing 1 next step you chose',
      'Completing 1 course on your record',
      'Writing 1 résumé bullet in your own words',
    ]);
  });

  it('leaves a zero out rather than showing it', () => {
    const w2 = wrapped(base({ schedulesSaved: 1 }));
    expect(w2.made.map((l) => l.key)).toEqual(['schedules']);
    expect(w2.forward).toEqual([]);
    expect(wrappedText(w2)).not.toMatch(/\b0\b/);
  });

  it('says a quiet term is fine, and nothing else', () => {
    const w3 = wrapped(base());
    expect(w3.empty).toBe(true);
    expect(wrappedText(w3)).toContain('A quiet term in Semester. That is fine.');
  });

  it('has no streak, rank, comparison or pressure in anything it can say', () => {
    for (const w4 of [w, wrapped(base()), wrapped(base({ schedulesSaved: 1 }))]) {
      const said = [w4.title, ...w4.made.map((l) => l.text), ...w4.forward.map((l) => l.text), wrappedText(w4)].join(' ');
      expect(said).not.toMatch(/streak|rank|top \d|percent|%|than (other|your classmates)|behind|failing|at risk|could have|missed|only \d/i);
    }
  });

  it('is the same whatever else is passed in — usage is not an input', () => {
    const withUsage = { ...full, visited: { today: true, study: true }, recent: ['today'], opens: 400, countScreens: true } as unknown as WrappedInput;
    expect(wrappedText(wrapped(withUsage))).toBe(wrappedText(wrapped(full)));
  });
});

describe('what an export holds', () => {
  it('is counts and the term: no course, title, name or date', () => {
    // The records carry names, codes, agenda text and dates; none may leave.
    const named = {
      ...full,
      taken: [{ term: 'Fall 2026', grade: 'A', current: false, code: 'ECON 9999', title: 'Secret Seminar' }],
    } as unknown as WrappedInput;
    const text = wrappedText(wrapped(named));
    expect(text.startsWith('YOUR FALL 2026 IN SEMESTER')).toBe(true);
    for (const withheld of ['Minor options', 'ECON 9999', 'Secret Seminar', '2026-10-03', '2026-10', 'Sep ', 'Oct ']) {
      expect(text).not.toContain(withheld);
    }
    expect(text).toContain('Made on my own device from my own records.');
  });
});

describe('saved schedules', () => {
  const plan = (...terms: string[]) => ({ courses: terms.map((term) => ({ term })) });
  const plans = [plan('2027SP', '2027SP'), plan('Spring 2027'), plan('2027FA', '2027FA', '2027SP')];

  it('count once, in the recap of the term they were planned from', () => {
    expect(schedulesFor(plans, readTerm('2026FA'))).toBe(2);
    expect(schedulesFor(plans, readTerm('2027SP'))).toBe(1);
  });

  it('are not the same number in every recap (the control)', () => {
    expect(schedulesFor(plans, readTerm('2026SP'))).toBe(0);
    expect(schedulesFor([], readTerm('2026FA'))).toBe(0);
  });
});
