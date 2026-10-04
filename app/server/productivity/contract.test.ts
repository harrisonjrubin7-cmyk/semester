import { describe, expect, it } from 'vitest';
import {
  CLOCK, LIMITS, clampClock, decodeCursor, encodeCursor, formatClock, normalizeInstant, parseClock, validateBatch, validateCommand,
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
