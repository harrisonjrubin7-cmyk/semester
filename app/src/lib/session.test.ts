// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  LONGEST,
  SHORTEST,
  abandoned,
  begin,
  carryOn,
  clockLine,
  elapsed,
  finish,
  hold,
  readSitting,
  running,
  writeSitting,
} from './session';

const T0 = 1_757_000_000_000;
const min = (n: number) => n * 60_000;

const work = { id: 'econ-ps1', courseId: 'econ', kind: 'Problem set', title: 'Problem Set 1' };

describe('the clock', () => {
  it('counts from the moment it started', () => {
    const s = begin(work, T0);
    expect(elapsed(s, T0)).toBe(0);
    expect(elapsed(s, T0 + min(47))).toBe(47);
    expect(running(s)).toBe(true);
  });

  it('rounds down, so it never claims a minute that has not passed', () => {
    expect(elapsed(begin(work, T0), T0 + min(1) + 59_000)).toBe(1);
    expect(elapsed(begin(work, T0), T0 + 59_000)).toBe(0);
  });

  it('stops counting while held', () => {
    const held = hold(begin(work, T0), T0 + min(20));
    expect(running(held)).toBe(false);
    expect(elapsed(held, T0 + min(200))).toBe(20);
  });

  it('picks up where it left off', () => {
    let s = begin(work, T0);
    s = hold(s, T0 + min(20));
    s = carryOn(s, T0 + min(90));
    expect(elapsed(s, T0 + min(105))).toBe(35);
  });

  it('ignores a second hold or a second start', () => {
    const s = hold(begin(work, T0), T0 + min(10));
    expect(hold(s, T0 + min(30))).toEqual(s);
    const on = carryOn(begin(work, T0), T0 + min(30));
    expect(on.since).toBe(T0);
  });

  it('does not go backwards when the device clock does', () => {
    // A phone correcting its clock, or a laptop waking with a stale time.
    expect(elapsed(begin(work, T0), T0 - min(30))).toBe(0);
  });
});

describe('what it will and will not record', () => {
  it('hands back the minutes for an ordinary session', () => {
    expect(finish(begin(work, T0), T0 + min(73))).toEqual({
      minutes: 73,
      tooLong: false,
      tooShort: false,
    });
  });

  it('marks a session that ran overnight rather than recording it', () => {
    // The failure mode that would quietly ruin every estimate the app makes:
    // closing a laptop is not pressing stop.
    const out = finish(begin(work, T0), T0 + min(11 * 60));
    expect(out.tooLong).toBe(true);
    expect(out.minutes).toBe(11 * 60);
  });

  it('marks a mis-tap', () => {
    expect(finish(begin(work, T0), T0 + min(1)).tooShort).toBe(true);
    expect(finish(begin(work, T0), T0 + min(SHORTEST)).tooShort).toBe(false);
  });

  it('counts held time towards the ceiling too', () => {
    // Otherwise a timer paused at seven hours and resumed for two more slips
    // through as a nine-hour session.
    let s = begin(work, T0);
    s = hold(s, T0 + min(LONGEST - 30));
    s = carryOn(s, T0 + min(LONGEST));
    expect(finish(s, T0 + min(LONGEST + 60)).tooLong).toBe(true);
  });
});

describe('the number recorded and the number shown', () => {
  it('are the same number, given the same clock', () => {
    // The caller hands `finish` the same clock it drew the display from, so
    // that a session showing "46 min" cannot be filed as 47. This is the
    // property that makes doing so safe.
    for (const at of [T0, T0 + 30_000, T0 + min(46) + 55_000, T0 + min(180)]) {
      const s = begin(work, T0);
      expect(finish(s, at).minutes).toBe(elapsed(s, at));
    }
  });

  it('holds across a pause and a resume too', () => {
    let s = begin(work, T0);
    s = hold(s, T0 + min(20) + 40_000);
    s = carryOn(s, T0 + min(90));
    const at = T0 + min(103) + 20_000;
    expect(finish(s, at).minutes).toBe(elapsed(s, at));
  });
});

describe('a timer that was left running', () => {
  it('is called abandoned once it passes the ceiling', () => {
    const s = begin(work, T0);
    expect(abandoned(s, T0 + min(LONGEST - 1))).toBe(false);
    expect(abandoned(s, T0 + min(LONGEST + 1))).toBe(true);
  });

  it('is not the same as a paused one, which may sit for days', () => {
    const held = hold(begin(work, T0), T0 + min(30));
    expect(abandoned(held, T0 + min(60 * 24 * 3))).toBe(false);
  });

  it('is nothing at all when there is no session', () => {
    expect(abandoned(null, T0)).toBe(false);
    expect(running(null)).toBe(false);
  });
});

describe('how a duration reads', () => {
  it('says minutes under the hour and hours over it', () => {
    expect(clockLine(0)).toBe('0 min');
    expect(clockLine(47)).toBe('47 min');
    expect(clockLine(60)).toBe('1 h');
    expect(clockLine(73)).toBe('1 h 13 min');
    expect(clockLine(120)).toBe('2 h');
  });

  it('never shows a negative', () => {
    expect(clockLine(-5)).toBe('0 min');
  });
});

describe('surviving a reload', () => {
  afterEach(() => localStorage.clear());

  it('comes back as it went in', () => {
    const s = begin(work, T0);
    writeSitting(s);
    expect(readSitting()).toEqual(s);
  });

  it('is nothing when there is nothing, or when what is there is not one', () => {
    expect(readSitting()).toBeNull();
    localStorage.setItem('semester.sitting.v1', 'not json');
    expect(readSitting()).toBeNull();
    localStorage.setItem('semester.sitting.v1', '{"courseId":"econ"}');
    expect(readSitting()).toBeNull();
  });

  it('refuses figures that would poison a median', () => {
    localStorage.setItem(
      'semester.sitting.v1',
      JSON.stringify({ courseId: 'econ', since: T0, banked: -900 }),
    );
    expect(readSitting()).toBeNull();
  });

  it('is cleared by writing nothing', () => {
    writeSitting(begin(work, T0));
    writeSitting(null);
    expect(readSitting()).toBeNull();
  });
});
