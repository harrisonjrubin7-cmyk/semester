import { describe, expect, it } from 'vitest';
import {
  LONGEST,
  RINGS_FOR,
  SHORTEST,
  alarmDue,
  clockFace,
  gaveUp,
  daysLine,
  lengthLine,
  newAlarm,
  newTimer,
  nextRing,
  pause,
  rang,
  readDuration,
  remaining,
  reset,
  resume,
  ringing,
  silence,
  startRing,
  stillRinging,
  stretch,
  timeLine,
  untilLine,
  whatIsRinging,
} from './clocks';

const AT = new Date(2026, 8, 4, 9, 0).getTime();

describe('reading how long, however it was written', () => {
  it('takes a bare number as minutes, because that is what it means', () => {
    // "25" has never once meant twenty-five seconds.
    expect(readDuration('25')).toBe(25 * 60);
  });

  it('reads a stopwatch face smallest unit last', () => {
    expect(readDuration('1:30')).toBe(90);
    expect(readDuration('1:02:30')).toBe(3750);
  });

  it('takes units the way people type them', () => {
    expect(readDuration('90 min')).toBe(5400);
    expect(readDuration('45s')).toBe(45);
    expect(readDuration('2 hours 5 minutes')).toBe(7500);
    expect(readDuration('1h20')).toBe(4800);
  });

  it('refuses what it cannot read rather than starting a timer at zero', () => {
    expect(readDuration('')).toBeNull();
    expect(readDuration('   ')).toBeNull();
    expect(readDuration('an hour')).toBeNull();
    expect(readDuration('soon')).toBeNull();
  });

  it('refuses a face with impossible parts', () => {
    expect(readDuration('1:70')).toBeNull();
  });

  it('holds the ends, so a misread field cannot make a five-second timer', () => {
    expect(readDuration('1s')).toBe(SHORTEST);
    expect(readDuration('400 hours')).toBe(LONGEST);
  });
});

describe('how a countdown reads', () => {
  it('is always at least mm:ss, the way a clock is', () => {
    expect(clockFace(1500)).toBe('25:00');
    expect(clockFace(9)).toBe('0:09');
    expect(clockFace(3900)).toBe('1:05:00');
    expect(clockFace(-5)).toBe('0:00');
  });

  it('says a length rather than counting one', () => {
    expect(lengthLine(45)).toBe('45 seconds');
    expect(lengthLine(60)).toBe('1 minute');
    expect(lengthLine(1500)).toBe('25 minutes');
    expect(lengthLine(3600)).toBe('1 hour');
    expect(lengthLine(4800)).toBe('1h 20m');
  });
});

describe('a timer counts from the clock, not from a counter', () => {
  it('reads its remainder against the time now', () => {
    const t = newTimer('Pasta', 600, AT);
    expect(remaining(t, AT)).toBe(600);
    expect(remaining(t, AT + 60_000)).toBe(540);
  });

  it('is right on the first frame after a sleeping phone wakes up', () => {
    // The bug this shape exists to prevent: anything that decrements loses
    // time whenever the tab is backgrounded, so a 20-minute timer takes 23.
    const t = newTimer('', 1200, AT);
    expect(remaining(t, AT + 25 * 60_000)).toBe(0);
    expect(ringing(t, AT + 25 * 60_000)).toBe(true);
  });

  it('never counts past zero', () => {
    const t = newTimer('', 60, AT);
    expect(remaining(t, AT + 10 * 60_000)).toBe(0);
  });

  it('keeps the remainder across a pause and picks it up again', () => {
    const t = newTimer('', 600, AT);
    const held = pause(t, AT + 100_000);
    expect(held.endsAt).toBeNull();
    expect(remaining(held, AT + 9_999_999)).toBe(500);
    const back = resume(held, AT + 9_999_999);
    expect(remaining(back, AT + 9_999_999)).toBe(500);
  });

  it('resets to what was asked for, stopped rather than restarted', () => {
    const t = reset(pause(newTimer('', 600, AT), AT + 100_000));
    expect(t.endsAt).toBeNull();
    expect(remaining(t, AT)).toBe(600);
  });

  it('silences a ring but keeps the timer to reuse', () => {
    const t = newTimer('Tea', 60, AT);
    const quiet = silence(t);
    expect(ringing(quiet, AT + 999_999)).toBe(false);
    expect(remaining(reset(quiet), AT)).toBe(60);
  });

  it('adds a minute without losing the rest, which is the usual correction', () => {
    const t = newTimer('', 600, AT);
    const more = stretch(t, 60, AT + 100_000);
    expect(remaining(more, AT + 100_000)).toBe(560);
  });

  it('can be shortened, and will not be stretched below nothing', () => {
    const t = newTimer('', 600, AT);
    expect(remaining(stretch(t, -60, AT), AT)).toBe(540);
    expect(stretch(t, -6000, AT)).toBe(t);
  });
});

describe('an alarm rings at a time', () => {
  // 4 Sept 2026 is a Friday.
  const friday9am = new Date(2026, 8, 4, 9, 0);

  it('goes off later today when the time has not passed', () => {
    const a = newAlarm('Seminar', 14 * 60, [], friday9am.getTime());
    expect(nextRing(a, friday9am)?.getHours()).toBe(14);
    expect(nextRing(a, friday9am)?.getDate()).toBe(4);
  });

  it('rolls to tomorrow when it has', () => {
    const a = newAlarm('', 6 * 60 + 40, [], friday9am.getTime());
    expect(nextRing(a, friday9am)?.getDate()).toBe(5);
  });

  it('finds the next listed weekday for a repeat', () => {
    const a = newAlarm('Lecture', 8 * 60, [1, 3], friday9am.getTime());
    const next = nextRing(a, friday9am);
    expect(next?.getDay()).toBe(1);
    expect(next?.getDate()).toBe(7);
  });

  it('says nothing when it is switched off', () => {
    const a = { ...newAlarm('', 600, [1], friday9am.getTime()), on: false };
    expect(nextRing(a, friday9am)).toBeNull();
    expect(alarmDue(a, new Date(2026, 8, 7, 10, 0))).toBe(false);
  });

  it('is due in its own minute and not the one after', () => {
    const a = newAlarm('', 9 * 60 + 30, [], friday9am.getTime());
    expect(alarmDue(a, new Date(2026, 8, 4, 9, 29))).toBe(false);
    expect(alarmDue(a, new Date(2026, 8, 4, 9, 30))).toBe(true);
    expect(alarmDue(a, new Date(2026, 8, 4, 9, 31))).toBe(false);
  });

  it('does not fire an alarm the day slept through', () => {
    // A tab opened at lunchtime firing the 7am alarm is worse than silence:
    // it is a missed alarm pretending it was not.
    const a = newAlarm('', 7 * 60, [], friday9am.getTime());
    expect(alarmDue(a, new Date(2026, 8, 4, 12, 0))).toBe(false);
  });

  it('rings once a day, not every minute of it', () => {
    const a = newAlarm('', 9 * 60, [1, 2, 3, 4, 5], friday9am.getTime());
    const after = rang(a, friday9am);
    expect(alarmDue(after, friday9am)).toBe(false);
    // ...and still comes round on the next listed day.
    expect(nextRing(after, friday9am)?.getDate()).toBe(7);
  });

  it('goes on ringing past its own minute, because that is what an alarm is', () => {
    // Being on another tab for ninety seconds must not mean missing it.
    const a = startRing(newAlarm('', 9 * 60, [], friday9am.getTime()), friday9am);
    expect(stillRinging(a, new Date(2026, 8, 4, 9, 4))).toBe(true);
    expect(alarmDue(a, new Date(2026, 8, 4, 9, 0))).toBe(false);
  });

  it('gives up after ten minutes rather than greeting you at dinner', () => {
    const a = startRing(newAlarm('', 9 * 60, [], friday9am.getTime()), friday9am);
    const later = new Date(friday9am.getTime() + RINGS_FOR + 1000);
    expect(stillRinging(a, later)).toBe(false);
    expect(gaveUp(a, later)).toBe(true);
    expect(gaveUp(rang(a, later), later)).toBe(false);
  });

  it('stops when it is stopped', () => {
    const a = startRing(newAlarm('', 9 * 60, [1], friday9am.getTime()), friday9am);
    const stopped = rang(a, friday9am);
    expect(stillRinging(stopped, friday9am)).toBe(false);
    expect(alarmDue(stopped, friday9am)).toBe(false);
  });

  it('switches a one-off off once it has rung, and leaves a repeat on', () => {
    const once = rang(newAlarm('', 600, [], friday9am.getTime()), friday9am);
    expect(once.on).toBe(false);
    const repeat = rang(newAlarm('', 600, [5], friday9am.getTime()), friday9am);
    expect(repeat.on).toBe(true);
  });

  it('keeps the days it was given, deduplicated and in order', () => {
    expect(newAlarm('', 600, [3, 1, 1, 9, -2], AT).days).toEqual([1, 3]);
  });
});

describe('what the alarm list says', () => {
  const friday9am = new Date(2026, 8, 4, 9, 0);

  it('names a pattern rather than listing it', () => {
    expect(daysLine([])).toBe('Once');
    expect(daysLine([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(daysLine([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(daysLine([0, 6])).toBe('Weekends');
    expect(daysLine([1, 3, 5])).toBe('Mon, Wed, Fri');
  });

  it('writes a time the way a clock does', () => {
    expect(timeLine(0)).toBe('12:00 AM');
    expect(timeLine(6 * 60 + 40)).toBe('6:40 AM');
    expect(timeLine(12 * 60)).toBe('12:00 PM');
    expect(timeLine(13 * 60 + 5)).toBe('1:05 PM');
  });

  it('counts down in the unit that is useful at that distance', () => {
    const soon = newAlarm('', 9 * 60 + 12, [], friday9am.getTime());
    expect(untilLine(soon, friday9am)).toBe('In 12 minutes');
    const later = newAlarm('', 16 * 60, [], friday9am.getTime());
    expect(untilLine(later, friday9am)).toBe('In about 7 hours');
    const tomorrow = newAlarm('', 6 * 60 + 40, [], friday9am.getTime());
    expect(untilLine(tomorrow, friday9am)).toBe('Tomorrow, 6:40 AM');
    const monday = newAlarm('', 8 * 60, [1], friday9am.getTime());
    expect(untilLine(monday, friday9am)).toBe('Mon, 8:00 AM');
    const off = { ...soon, on: false };
    expect(untilLine(off, friday9am)).toBe('Off');
    // An alarm going off now must not quietly announce its next one instead.
    expect(untilLine(startRing(soon, friday9am), friday9am)).toBe('Ringing');
  });
});

describe('what is going off', () => {
  it('gathers both kinds, because either has to be dismissed', () => {
    const friday = new Date(2026, 8, 4, 9, 30);
    const done = newTimer('', 60, friday.getTime() - 120_000);
    const notYet = newTimer('', 3600, friday.getTime());
    const a = startRing(newAlarm('', 9 * 60 + 30, [], friday.getTime()), friday);
    const out = whatIsRinging([done, notYet], [a], friday);
    expect(out.timers).toEqual([done]);
    expect(out.alarms).toEqual([a]);
  });

  it('is empty when nothing is', () => {
    const friday = new Date(2026, 8, 4, 9, 0);
    const out = whatIsRinging([newTimer('', 3600, friday.getTime())], [], friday);
    expect(out.timers).toEqual([]);
    expect(out.alarms).toEqual([]);
  });
});
