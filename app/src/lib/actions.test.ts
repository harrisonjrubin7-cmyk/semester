import { describe, expect, it } from 'vitest';
import {
  ACTION_STATUSES,
  EMPTY_ACTION_CHOICES,
  HISTORY_LIMIT,
  NEXT_LIMIT,
  TRANSITIONS,
  effectiveStatus,
  rank,
  readActionChoices,
  score,
  transition,
  type Action,
  type Choice,
} from './actions';

const NOW = Date.UTC(2026, 8, 27, 12);
const DAY = 86_400_000;

const action = (id: string, patch: Partial<Action> = {}): Action => ({
  id,
  type: 'deadline',
  title: `Action ${id}`,
  whyItMatters: 'It is due.',
  priority: 'normal',
  source: { label: 'student_entered', system: 'Your syllabus' },
  explanation: {
    trigger: 'A deadline is close.',
    factors: ['Due date'],
    expectedImpact: 'You submit on time.',
    limitations: ['Semester cannot see your LMS.'],
    alternatives: ['Ask for an extension.'],
  },
  primary: { label: 'Open', kind: 'navigate', target: '#/courses', requiresConfirmation: false },
  ...patch,
});

const apply = (c: Choice | undefined, ...steps: Parameters<typeof transition>[1][]) => {
  let cur = c;
  for (const e of steps) {
    const r = transition(cur, e, NOW, { until: NOW + DAY, note: 'because' });
    if (!r.ok) throw new Error(r.why);
    cur = r.choice;
  }
  return cur!;
};

describe('the lifecycle', () => {
  it('has a row for every status', () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...ACTION_STATUSES].sort());
  });

  it('lets every status be reopened except none', () => {
    for (const s of ACTION_STATUSES) {
      if (s === 'open') continue;
      expect(TRANSITIONS[s].reopen, s).toBe('open');
    }
  });

  it('moves along allowed edges and records each one', () => {
    const c = apply(undefined, 'start', 'block', 'start', 'complete');
    expect(c.status).toBe('completed');
    expect(c.history.map((h) => `${h.from}>${h.to}`)).toEqual([
      'open>in_progress',
      'in_progress>blocked',
      'blocked>in_progress',
      'in_progress>completed',
    ]);
  });

  it('refuses a move that is not in the table, and says why', () => {
    const done = apply(undefined, 'complete');
    const r = transition(done, 'dismiss', NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.why).toMatch(/completed/);
  });

  it('needs a future time to snooze', () => {
    expect(transition(undefined, 'snooze', NOW).ok).toBe(false);
    expect(transition(undefined, 'snooze', NOW, { until: NOW - 1 }).ok).toBe(false);
    const r = transition(undefined, 'snooze', NOW, { until: NOW + DAY });
    expect(r.ok && r.choice.snoozedUntil).toBe(NOW + DAY);
  });

  it('records a correction or a request for help without moving the action', () => {
    expect(transition(undefined, 'correct', NOW).ok).toBe(false);
    const r = transition(undefined, 'correct', NOW, { note: 'Wrong date' });
    expect(r.ok && r.choice.status).toBe('open');
    expect(r.ok && r.choice.history[0].note).toBe('Wrong date');
    const h = transition(undefined, 'help', NOW, { note: 'Which form?' });
    expect(h.ok && h.choice.status).toBe('open');
  });

  it('keeps history bounded', () => {
    let c: Choice | undefined;
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) c = apply(c, 'start', 'reopen');
    expect(c!.history).toHaveLength(HISTORY_LIMIT);
  });
});

describe('the status an action has now', () => {
  it('wakes a snooze that has run out', () => {
    const c = apply(undefined, 'snooze');
    expect(effectiveStatus(action('a'), c, NOW)).toBe('snoozed');
    expect(effectiveStatus(action('a'), c, NOW + DAY)).toBe('open');
  });

  it('expires a live action past its expiry, but not a finished one', () => {
    const a = action('a', { expiresAt: NOW - 1 });
    expect(effectiveStatus(a, undefined, NOW)).toBe('expired');
    expect(effectiveStatus(a, apply(undefined, 'complete'), NOW)).toBe('completed');
  });
});

describe('ranking', () => {
  it('shows its working, and the parts add up', () => {
    const s = score(action('a', { dueAt: NOW + DAY / 2, priority: 'high' }), undefined, NOW);
    const { urgency, impact, actionability, confidence, fatigue } = s.parts;
    expect(s.score).toBe(urgency + impact + actionability + confidence - fatigue);
    expect(urgency).toBe(40);
  });

  it('puts the soonest, weightiest action first', () => {
    const r = rank(
      [action('later', { dueAt: NOW + 10 * DAY }), action('soon', { dueAt: NOW + DAY / 2, priority: 'high' })],
      {},
      NOW,
    );
    expect(r.mostImportant?.action.id).toBe('soon');
    expect(r.next.map((s) => s.action.id)).toEqual(['later']);
  });

  it('ranks an estimate below the same fact from the institution', () => {
    const est = score(action('e', { source: { label: 'estimated', system: 'x' } }), undefined, NOW);
    const ver = score(action('v', { source: { label: 'institution_verified', system: 'x' } }), undefined, NOW);
    expect(ver.score).toBeGreaterThan(est.score);
  });

  it('sinks something snoozed again and again', () => {
    let c: Choice | undefined;
    for (let i = 0; i < 3; i++) c = apply(c, 'snooze', 'reopen');
    expect(score(action('a'), c, NOW).parts.fatigue).toBe(9);
  });

  it('shows one most important and at most five next, the rest behind View all', () => {
    const many = Array.from({ length: 9 }, (_, i) => action(`a${i}`, { dueAt: NOW + i * DAY }));
    const r = rank(many, {}, NOW);
    expect(r.mostImportant).not.toBeNull();
    expect(r.next).toHaveLength(NEXT_LIMIT);
    expect(r.rest).toHaveLength(9 - 1 - NEXT_LIMIT);
  });

  it('leaves out what was snoozed, done or dismissed', () => {
    const choices = {
      s: apply(undefined, 'snooze'),
      d: apply(undefined, 'complete'),
      x: apply(undefined, 'dismiss'),
    };
    const r = rank([action('s'), action('d'), action('x'), action('o')], choices, NOW);
    expect(r.mostImportant?.action.id).toBe('o');
    expect(r.hidden.map((h) => h.action.id).sort()).toEqual(['d', 's', 'x']);
  });

  it('orders the same inputs the same way every time', () => {
    const same = [action('b'), action('a'), action('c')];
    const one = rank(same, {}, NOW);
    const two = rank([...same].reverse(), {}, NOW);
    expect([one.mostImportant, ...one.next].map((s) => s?.action.id)).toEqual(
      [two.mostImportant, ...two.next].map((s) => s?.action.id),
    );
  });
});

describe('the stored choices', () => {
  it('round-trips through its own reader', () => {
    const store = { version: 1 as const, choices: { a: apply(undefined, 'start', 'snooze') } };
    expect(readActionChoices(JSON.parse(JSON.stringify(store)))).toEqual(store);
    expect(readActionChoices(EMPTY_ACTION_CHOICES)).toEqual(EMPTY_ACTION_CHOICES);
  });

  it('refuses a value that is not an action store at all', () => {
    for (const bad of [null, [], {}, { version: 2, choices: {} }]) expect(() => readActionChoices(bad)).toThrow();
  });

  it('drops an entry it cannot read rather than guessing', () => {
    const read = readActionChoices({
      version: 1,
      choices: {
        good: { status: 'open', history: [{ event: 'reopen', at: NOW, from: 'completed', to: 'open' }] },
        badStatus: { status: 'finished', history: [] },
        badEntry: { status: 'open', history: [{ event: 'explode', at: NOW, from: 'open', to: 'open' }] },
      },
    });
    expect(Object.keys(read.choices).sort()).toEqual(['badEntry', 'good']);
    expect(read.choices.badEntry.history).toEqual([]);
  });
});
