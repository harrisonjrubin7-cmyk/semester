import { describe, expect, it } from 'vitest';
import {
  AUTHORITATIVE_FIELDS, CLOCK, LIMITS, REPEAT_EVERY, TASK_FIELDS, clampClock, isDay, decodeCursor, encodeCursor, formatClock, normalizeInstant, parseClock, validateBatch, validateCommand,
} from './contract.ts';
import { TASK_ID, T0, clock, createTask } from './fixtures.ts';

describe('the clock', () => {
  it('compares as text because it is fixed width', () => {
    expect(clock(999_999_999_999) < clock(1_000_000_000_000)).toBe(true);
    expect(clock(5, 'dev-a', 9) < clock(5, 'dev-a', 10)).toBe(true);
    expect(clock(5, 'dev-a') < clock(5, 'dev-b')).toBe(true);
  });

  it('round-trips, and refuses what is not one', () => {
    const c = clock(T0, 'phone-1', 7);
    expect(CLOCK.test(c)).toBe(true);
    expect(formatClock(parseClock(c)!)).toBe(c);
    for (const bad of ['', '123.0000.dev', `${T0}.0000.`, `${T0}.0000.has space`, 42, null, `${T0}.00000.dev`]) expect(parseClock(bad)).toBeNull();
  });

  it('believes the past and pulls a claim from the future back to the skew allowance', () => {
    expect(clampClock(parseClock(clock(T0 - 86_400_000))!, T0)).toEqual({ clock: clock(T0 - 86_400_000), clamped: false });
    expect(clampClock(parseClock(clock(T0 + LIMITS.clockSkewMs))!, T0).clamped).toBe(false);
    expect(clampClock(parseClock(clock(T0 + LIMITS.clockSkewMs + 1))!, T0)).toEqual({ clock: clock(T0 + LIMITS.clockSkewMs), clamped: true });
  });
});

describe('instants', () => {
  it('normalises offsets to UTC and refuses anything without one', () => {
    expect(normalizeInstant('2026-10-05T10:00:00-05:00')).toBe('2026-10-05T15:00:00.000Z');
    for (const bad of ['2026-10-05', '2026-10-05T10:00:00', 'tomorrow', '2026-13-45T10:00:00Z', 5, null]) expect(normalizeInstant(bad)).toBeNull();
  });
});

describe('cursors', () => {
  it('round-trip, and refuse the wrong kind, junk and the oversized', () => {
    expect(decodeCursor(encodeCursor({ k: 's', seq: 7 }), 's')).toEqual({ k: 's', seq: 7 });
    expect(decodeCursor(encodeCursor({ k: 's', seq: 7 }), 'k')).toBe('invalid');
    expect(decodeCursor(encodeCursor({ k: 's', seq: -1 }), 's')).toBe('invalid');
    expect(decodeCursor(encodeCursor({ k: 'k', key: 'x', id: 'not-a-uuid' }), 'k')).toBe('invalid');
    expect(decodeCursor('%%%', 's')).toBe('invalid');
    expect(decodeCursor('A'.repeat(301), 's')).toBe('invalid');
    expect(decodeCursor(null, 's')).toBeNull();
    expect(decodeCursor('', 'k')).toBeNull();
  });
});

describe('commands', () => {
  it('accepts the good one, normalising what it was given', () => {
    const v = validateCommand(createTask({ title: '  padded  ', notes: '', dueAt: '2026-10-08T12:00:00-05:00' }));
    expect(v).toMatchObject({ ok: true, value: { type: 'task.create', id: TASK_ID, fields: { title: 'padded', notes: null, dueAt: '2026-10-08T17:00:00.000Z' } } });
  });

  it('refuses a clock stamped by a different device than the command says', () => {
    const c = { ...createTask(), clock: clock(T0, 'someone-else') };
    expect(validateCommand(c)).toMatchObject({ ok: false, issues: [{ path: 'command.clock' }] });
  });

  it('refuses an update that changes nothing', () => {
    const c = { ...createTask(), type: 'task.update', changes: {} } as Record<string, unknown>;
    delete c.fields;
    expect(validateCommand(c)).toMatchObject({ ok: false });
  });

  it('bounds the issues it reports', () => {
    const v = validateCommand({ type: 'task.create', fields: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`k${i}`, 1])) });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.issues.length).toBeLessThanOrEqual(20);
  });

  it('checks a batch\'s shape and leaves each command to be judged alone', () => {
    expect(validateBatch({ commands: [{}, 1, null] })).toMatchObject({ ok: true });
    expect(validateBatch({ commands: Array.from({ length: LIMITS.batchMax }, () => ({})) })).toMatchObject({ ok: true });
    expect(validateBatch({ commands: Array.from({ length: LIMITS.batchMax + 1 }, () => ({})) })).toMatchObject({ ok: false });
  });
});

describe('the fields the app\'s task carries', () => {
  const issue = (over: Record<string, unknown>) => {
    const v = validateCommand(createTask(over));
    return v.ok ? null : v.issues.map((i) => `${i.path} ${i.issue}`).join('; ');
  };
  const steps = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, text: `step ${i}`, done: false }));

  it('accepts a task with all of them, and keeps them as sent', () => {
    const full = {
      dueOn: '2026-10-09', whenText: '6:30 PM', plannedFrom: 'deadline-1',
      repeat: { every: 'weekly', until: '2026-12-18', except: ['2026-11-27', '2026-11-20'] },
      steps: [{ id: 's1', text: 'Skim', done: true }, { id: 's2', text: 'Notes', done: false }],
    };
    const v = validateCommand(createTask(full));
    expect(v).toMatchObject({ ok: true, value: { fields: { dueOn: '2026-10-09', whenText: '6:30 PM', plannedFrom: 'deadline-1', steps: full.steps } } });
    // The skipped days are stored sorted, so the same rule always hashes and compares the same.
    expect(v.ok && (v.value as { fields: { repeat: unknown } }).fields.repeat).toEqual({ every: 'weekly', until: '2026-12-18', except: ['2026-11-20', '2026-11-27'] });
  });

  it('lists every one of them in the field list the router and the document are held to', () => {
    for (const f of ['dueOn', 'whenText', 'repeat', 'steps', 'plannedFrom']) expect(TASK_FIELDS).toContain(f);
    expect(AUTHORITATIVE_FIELDS.task).toContain('dueOn');
  });

  it('knows a day from a date that does not exist', () => {
    for (const ok of ['2026-10-09', '2028-02-29', '2026-12-31']) expect(isDay(ok), ok).toBe(true);
    for (const bad of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-10-9', '2026-10-09T00:00:00Z', '', 20261009, null]) expect(isDay(bad), String(bad)).toBe(false);
  });

  it.each([
    ['a day that does not exist', { dueOn: '2026-02-30' }, 'dueOn'],
    ['a day with a time on it', { dueOn: '2026-10-09T10:00:00Z' }, 'dueOn'],
    ['free text past its bound', { whenText: 'x'.repeat(LIMITS.whenTextMax + 1) }, 'whenText'],
    ['a repeat rule that never stops', { repeat: { every: 'weekly' } }, 'repeat.until'],
    ['a repeat rule with an unknown cadence', { repeat: { every: 'hourly', until: '2026-12-18' } }, 'repeat.every'],
    ['a repeat rule with an unknown key', { repeat: { every: 'weekly', until: '2026-12-18', count: 4 } }, 'repeat.count'],
    ['a repeat rule that skips a day that does not exist', { repeat: { every: 'daily', until: '2026-12-18', except: ['2026-02-30'] } }, 'repeat.except'],
    ['more skipped days than a series can have', { repeat: { every: 'daily', until: '2026-12-18', except: Array.from({ length: LIMITS.repeatExceptMax + 1 }, (_, i) => new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10)) } }, 'repeat.except'],
    ['steps that are not a list', { steps: { not: 'a list' } }, 'steps'],
    ['more steps than a task can hold', { steps: steps(LIMITS.stepsMax + 1) }, 'steps'],
    ['two steps with one id', { steps: [{ id: 'a', text: 'one', done: false }, { id: 'a', text: 'two', done: false }] }, 'steps[1].id'],
    ['a step with no text', { steps: [{ id: 'a', text: '', done: false }] }, 'steps[0].text'],
    ['a step with no done flag', { steps: [{ id: 'a', text: 'one' }] }, 'steps[0].done'],
    ['a step with an unknown key', { steps: [{ id: 'a', text: 'one', done: false, note: 'x' }] }, 'steps[0].note'],
    ['a source reference past its bound', { plannedFrom: 'x'.repeat(LIMITS.plannedFromMax + 1) }, 'plannedFrom'],
  ])('refuses %s', (_name, over, path) => {
    // The control is the first test above: the same command without the one bad field is accepted.
    expect(issue(over)).toContain(path);
  });

  it('refuses too many skipped days because of their number, not because one is malformed', () => {
    const days = Array.from({ length: LIMITS.repeatExceptMax + 1 }, (_, i) => new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10));
    expect(days.every(isDay)).toBe(true);
    expect(issue({ repeat: { every: 'daily', until: '2028-12-31', except: days } })).toContain(`has more than ${LIMITS.repeatExceptMax} days`);
  });

  it('takes the largest of each exactly at the bound', () => {
    expect(issue({ whenText: 'x'.repeat(LIMITS.whenTextMax) })).toBeNull();
    expect(issue({ steps: steps(LIMITS.stepsMax) })).toBeNull();
    expect(issue({ plannedFrom: 'x'.repeat(LIMITS.plannedFromMax) })).toBeNull();
    const daysFrom2027 = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10));
    expect(issue({ repeat: { every: 'daily', until: '2028-12-31', except: daysFrom2027(LIMITS.repeatExceptMax) } })).toBeNull();
  });

  it('lets a clear be said as null (a task with no repeat, no day and no free text), and an empty list for no steps', () => {
    expect(issue({ repeat: null, dueOn: null, whenText: null, plannedFrom: null, steps: [] })).toBeNull();
    expect(REPEAT_EVERY).toEqual(['daily', 'weekdays', 'weekly', 'fortnightly', 'monthly']);
  });
});
