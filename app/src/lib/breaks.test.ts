import { describe, expect, it } from 'vitest';
import {
  BREAK_MINUTES,
  FOCUS_MINUTES,
  SNOOZE_MINUTES,
  breakDue,
  cameBack,
  focusedFor,
  snooze,
  startClock,
  switchOff,
  takeBreak,
} from './breaks';

const MIN = 60_000;
const T0 = Date.UTC(2026, 8, 27, 14, 0);
const at = (minutes: number) => T0 + minutes * MIN;

describe('the break reminder', () => {
  it('waits for fifty minutes of focus', () => {
    const c = startClock(T0);
    expect(breakDue(c, at(FOCUS_MINUTES - 1))).toBe(false);
    expect(breakDue(c, at(FOCUS_MINUTES))).toBe(true);
    expect(focusedFor(c, at(FOCUS_MINUTES))).toBe(50);
  });

  it('starts the next stretch when the break ends', () => {
    const taken = takeBreak(startClock(T0), at(50));
    expect(breakDue(taken, at(51))).toBe(false);
    // The break itself is not focus: fifty more minutes after it ends.
    expect(breakDue(taken, at(50 + BREAK_MINUTES + FOCUS_MINUTES - 1))).toBe(false);
    expect(breakDue(taken, at(50 + BREAK_MINUTES + FOCUS_MINUTES))).toBe(true);
  });

  it('snoozes for ten minutes, not the rest of the session', () => {
    const later = snooze(startClock(T0), at(50));
    expect(breakDue(later, at(50 + SNOOZE_MINUTES - 1))).toBe(false);
    expect(breakDue(later, at(50 + SNOOZE_MINUTES))).toBe(true);
  });

  it('can be switched off for the session', () => {
    expect(breakDue(switchOff(startClock(T0)), at(500))).toBe(false);
  });

  it('counts time away as a break, and a glance away as nothing', () => {
    const c = startClock(T0);
    const back = cameBack(c, at(30), at(30 + BREAK_MINUTES));
    expect(back.since).toBe(at(30 + BREAK_MINUTES));
    expect(breakDue(back, at(50))).toBe(false);
    expect(cameBack(c, at(30), at(31))).toBe(c);
  });
});
