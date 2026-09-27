import { describe, expect, it } from 'vitest';
import { transition, type Choice } from './actions';
import { todayActions } from './today-actions';
import {
  STATUS_SENTENCE,
  doneForToday,
  isCalm,
  itemSource,
  planCommitments,
  timeFirstLabel,
  type CommitmentRow,
} from './today-center';
import type { PathSnapshot } from './today-decision';
import type { DatedItem } from './types';

const NOW = new Date(2026, 8, 27, 10, 0).getTime();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const item = (id: string, daysAway: number, confirmed = true): DatedItem => {
  const date = new Date(NOW + daysAway * DAY);
  return {
    id,
    c: 'econ',
    title: `Quiz ${id}`,
    kind: 'quiz',
    date: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    dueShort: daysAway === 0 ? 'Today' : `In ${daysAway} days`,
    dow: '',
    mon: '',
    isToday: daysAway === 0,
    isPast: daysAway < 0,
    daysAway,
    dueAt: 17 * 60,
    checked: confirmed ? { confirmed: true } : undefined,
  } as unknown as DatedItem;
};

const choose = (event: Parameters<typeof transition>[1], at = NOW): Choice => {
  const r = transition(undefined, event, at);
  if (!r.ok) throw new Error(r.why);
  return r.choice;
};

describe('what Today may say', () => {
  it('describes the path in the three approved sentences only', () => {
    expect(STATUS_SENTENCE).toEqual({
      moving: 'On track based on your current plan.',
      review: 'A few choices could affect your timeline.',
      incomplete: 'Add a few details to see a clearer path.',
    });
  });

  it('knows the words it does not use', () => {
    for (const bad of ['You are behind', 'At risk of failing', 'at-risk']) expect(isCalm(bad)).toBe(false);
    for (const s of Object.values(STATUS_SENTENCE)) expect(isCalm(s)).toBe(true);
  });

  it('holds every action Today proposes to those words', () => {
    // The guard on BL-1.4's proposals: a new rung that says "behind" fails here.
    for (const state of ['incomplete', 'review', 'moving'] as const) {
      const path = {
        state, heading: '', detail: '', creditLine: '', covered: 0, total: 3, percent: 0,
        unresolved: 1, firstUnresolved: 'Statistics', source: 'Only what you entered.',
      } satisfies PathSnapshot;
      const actions = todayActions({
        path, upcoming: [item('q', 0), item('r', 5, false)], done: {}, reviewDue: 2, catalogEmpty: true,
      });
      for (const a of actions) {
        const e = a.explanation;
        const words = [a.title, a.whyItMatters, e.trigger, e.expectedImpact, ...e.factors, ...e.limitations, ...e.alternatives];
        expect(isCalm(words.join(' ')), a.id).toBe(true);
      }
    }
  });

  it('labels a confirmed date imported and an unconfirmed one needs review', () => {
    expect(itemSource(item('a', 1))).toBe('imported');
    expect(itemSource(item('b', 1, false))).toBe('needs_review');
  });
});

describe('done for today', () => {
  it('appears after the student closes something and nothing pressing is left', () => {
    expect(doneForToday({ upcoming: [item('today', 0), item('later', 3)], done: { today: true }, now: NOW }, {})?.line)
      .toBe('You are set for today. Your next deadline is in 3 days.');
  });

  it('does not appear while something is due today or tomorrow, or before anything was closed', () => {
    expect(doneForToday({ upcoming: [item('q', 1)], done: {}, now: NOW }, {})).toBeNull();
    expect(doneForToday({ upcoming: [item('later', 3)], done: {}, now: NOW }, {})).toBeNull();
  });

  it('counts an action completed in the Action Center today, and not yesterday', () => {
    expect(doneForToday({ upcoming: [], done: {}, now: NOW }, { 'path:complete': choose('complete') })?.line)
      .toBe('You are set for today. Nothing else is recorded as due.');
    expect(doneForToday({ upcoming: [], done: {}, now: NOW }, { 'path:complete': choose('complete', NOW - DAY) })).toBeNull();
  });

  it('treats a deadline completed in the Action Center as closed', () => {
    const choices = { 'deadline:q': choose('complete') };
    expect(doneForToday({ upcoming: [item('q', 1), item('later', 4)], done: {}, now: NOW }, choices)?.line)
      .toBe('You are set for today. Your next deadline is in 4 days.');
  });
});

describe('time first', () => {
  it('says the day before anything else, in calendar days', () => {
    expect(timeFirstLabel(NOW + HOUR, NOW)).toBe('Today');
    expect(timeFirstLabel(NOW + DAY, NOW)).toBe('Tomorrow');
    expect(timeFirstLabel(NOW + 3 * DAY, NOW)).toBe('In 3 days');
    expect(timeFirstLabel(NOW + 9 * DAY, NOW)).toBe('In 9 days');
    expect(timeFirstLabel(NOW - DAY, NOW)).toBe('Yesterday');
    // 23:00 tomorrow is tomorrow, not "in 2 days" by 24-hour periods.
    expect(timeFirstLabel(new Date(2026, 8, 28, 23, 0).getTime(), NOW)).toBe('Tomorrow');
  });
});

describe('commitments', () => {
  const row = (id: string, hours: number, patch: Partial<CommitmentRow> = {}): CommitmentRow => ({
    id, at: NOW + hours * HOUR, title: id, meta: '', kind: 'deadline', ...patch,
  });

  it('has at most one urgent card and four rows, the time first', () => {
    const plan = planCommitments(
      [row('a', 2), row('b', 5), row('c', 30), row('d', 60), row('e', 80), row('f', 200), row('g', 220)],
      NOW,
    );
    expect(plan.urgent?.id).toBe('a');
    expect(plan.urgent?.when).toBe('Today');
    expect(plan.rows.map((r) => r.id)).toEqual(['b', 'c', 'd', 'e']);
    expect(plan.rows.map((r) => r.when)).toEqual(['Today', 'Tomorrow', 'In 2 days', 'In 3 days']);
  });

  it('never makes a class urgent, and leaves out what the Action Center leads with', () => {
    const plan = planCommitments([row('lecture', 1, { kind: 'class' }), row('q4', 3, { itemId: 'q4' })], NOW, 'q4');
    expect(plan.urgent).toBeNull();
    expect(plan.rows.map((r) => r.id)).toEqual(['lecture']);
  });

  it('keeps every row when nothing leads', () => {
    expect(planCommitments([row('x', 30, { kind: 'class' })], NOW).rows).toHaveLength(1);
  });

  it('folds same-day work for one course into one row', () => {
    const plan = planCommitments(
      [row('x', 30, { group: 'econ', kind: 'class' }), row('y', 31, { group: 'econ' }), row('z', 32, { group: 'bus' })],
      NOW,
    );
    expect(plan.rows).toHaveLength(2);
    expect(plan.rows[0]).toMatchObject({ id: 'x', count: 2, meta: '2 items' });
  });
});
