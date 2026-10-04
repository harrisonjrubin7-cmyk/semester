import { describe, expect, it } from 'vitest';
import { transition } from '../../../../packages/institution/src/workflow';
import {
  ERROR_CODES,
  addDays,
  andThen,
  daysBetween,
  defineMachine,
  err,
  fixedClock,
  isIsoDate,
  isRetryable,
  map,
  ok,
  send,
} from './index';

describe('the error model', () => {
  it('gives every code a retry answer and a result that carries it', () => {
    for (const code of ERROR_CODES) {
      const r = err(code, 'A sentence.');
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe(code);
        expect(r.error.retryable).toBe(isRetryable(code));
        expect(r.error.message).not.toBe('');
      }
    }
  });

  it('retries only what could succeed unchanged', () => {
    expect(ERROR_CODES.filter(isRetryable).sort()).toEqual(['conflict', 'unavailable']);
  });

  it('maps a success, passes a failure through, and stops a chain at the first failure', () => {
    expect(map(ok(2), (n) => n * 2)).toEqual(ok(4));
    const failed = err('not_found', 'Gone.');
    expect(map(failed, () => 1)).toBe(failed);
    let ran = false;
    expect(andThen(failed, () => { ran = true; return ok(1); })).toBe(failed);
    expect(ran).toBe(false);
    expect(andThen(ok(1), (n) => ok(n + 1))).toEqual(ok(2));
  });
});

describe('time', () => {
  it('reads a real day, not a well-shaped string', () => {
    for (const good of ['2026-02-28', '2028-02-29', '2026-12-31']) expect(isIsoDate(good)).toBe(true);
    for (const bad of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '26-01-01', '2026-1-1', '', null, 20260101]) {
      expect(isIsoDate(bad)).toBe(false);
    }
  });

  it('adds days across a month, a year and a leap day, with no zone involved', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between, signed', () => {
    expect(daysBetween('2026-09-09', '2026-09-12')).toBe(3);
    expect(daysBetween('2026-09-12', '2026-09-09')).toBe(-3);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('stands still when it is fixed', () => {
    const c = fixedClock('2026-09-09', 600, 42);
    expect(c.local()).toEqual({ day: '2026-09-09', minutes: 600 });
    expect(c.now()).toBe(42);
  });
});

describe('a machine defined by events', () => {
  const door = defineMachine<'closed' | 'open' | 'locked', 'open' | 'close' | 'lock' | 'unlock'>({
    type: 'door',
    initial: 'closed',
    terminal: [],
    on: { closed: { open: 'open', lock: 'locked' }, open: { close: 'closed' }, locked: { unlock: 'closed' } },
  });

  it('agrees with the ADR 0009 evaluator on every state and every event', () => {
    let legal = 0;
    for (const from of door.states) {
      for (const event of door.events) {
        const mine = send(door, from, event);
        const target = door.spec.on[from][event];
        if (target === undefined) {
          expect(mine.ok).toBe(false);
          if (!mine.ok) expect(mine.error.code).toBe('invalid_transition');
        } else {
          legal++;
          expect(mine).toEqual(ok(target));
          expect(transition(door.definition, from, target).ok).toBe(true);
        }
      }
    }
    // The control: a machine that refused everything would pass the loop above.
    expect(legal).toBe(4);
  });

  it('derives its states and events from the table', () => {
    expect([...door.states].sort()).toEqual(['closed', 'locked', 'open']);
    expect([...door.events].sort()).toEqual(['close', 'lock', 'open', 'unlock']);
    expect(door.definition.initial).toBe('closed');
  });
});
