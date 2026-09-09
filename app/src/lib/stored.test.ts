import { describe, expect, it } from 'vitest';
import { bool, num, nums, rows, str } from './stored';
import { readAppointments } from './appointment';
import { readCommitments } from './activities';
import { readFeedEvents } from './ics';
import { readUpdates } from './updates';
import { readSpent } from './pace';
import { readWindows } from './windows';
import { filled, pressing, readTermDates, sheet } from './registrar';
import { hoursOn, hoursAWeek } from './windows';
import { hoursOf, weeklyHours } from './activities';
import { learned } from './pace';
import { isoToDate } from './date';
import { readPlaces, DEFAULT_RADIUS } from './place';
import { matchPlace } from './rooms';
import { projects, readSources } from './sources';
import { clockFace, lengthLine, nextRing, readAlarms, readTimers, remaining, running } from './clocks';

/**
 * A row carrying nothing but its id.
 *
 * The shape a build that predates a field leaves behind, and the one every
 * crash below was found with — one such row in one list at a time, driven
 * against the running app.
 */
const thin: Record<string, unknown> = { id: 'x1' };

describe('the primitives', () => {
  it('coerce rather than reject', () => {
    expect(str(undefined)).toBe('');
    expect(str(7)).toBe('');
    expect(str('a')).toBe('a');
    expect(num(undefined)).toBe(0);
    expect(num(NaN)).toBe(0);
    expect(num(Infinity)).toBe(0);
    expect(num('5')).toBe(0);
    expect(num(undefined, -1)).toBe(-1);
    expect(num(5)).toBe(5);
    // A truthy string must not become a flag: `rolling: 'no'` is not rolling.
    expect(bool('yes')).toBe(false);
    expect(bool(true)).toBe(true);
    expect(nums([1, 'x', null, 3, NaN])).toEqual([1, 3]);
    expect(nums('mon')).toEqual([]);
  });

  it('give every row an id, so two blank ones stay two rows', () => {
    const got = rows<{ id: string }>([{}, {}, null, 'x', { id: 'kept' }], 'p');
    expect(got).toHaveLength(3);
    expect(new Set(got.map((r) => r.id)).size).toBe(3);
    expect(got[2].id).toBe('kept');
  });

  /*
   * The one property a field-by-field rebuild would cost. `lib/migrate.ts`
   * loads a copy written by a newer build and says of it "the app reads what it
   * recognises and ignores the rest" — ignoring a field is not deleting it, and
   * an older build must not strip it on the next save.
   */
  it('keep a field this build has never heard of', () => {
    const [w] = readWindows([{ id: 'w1', label: 'Evenings', days: [1], from: 0, to: 60, colour: 'blue' }]);
    expect((w as unknown as { colour: string }).colour).toBe('blue');
    const [c] = readCommitments([{ id: 'c1', days: [], hours: 1, mascot: 'anchor' }]);
    expect((c as unknown as { mascot: string }).mascot).toBe('anchor');
  });
});

describe('a stored window', () => {
  /*
   * The only one of these that took down more than a screen. `hoursOn` is
   * called from a hook the whole app hangs off rather than from inside one
   * screen's boundary, so `w.days.includes` on a window without `days` was an
   * uncaught TypeError and a blank document — measured on Behind, which then
   * left every screen after it blank too.
   */
  it('always has the days the hour arithmetic filters on', () => {
    const [w] = readWindows([thin]);
    expect(w.days).toEqual([]);
    expect(() => hoursOn([w], 1)).not.toThrow();
    expect(hoursOn([w], 1)).toBe(0);
    expect(hoursAWeek([w])).toBe(0);
  });

  it('keeps a window that is genuinely set', () => {
    const [w] = readWindows([{ id: 'w1', label: 'Evenings', days: [1, 2], from: 19 * 60, to: 23 * 60 }]);
    expect(hoursOn([w], 1)).toBe(4);
    expect(hoursAWeek([w])).toBe(8);
  });

  it('reads a span whose ends are not numbers as no span, not as NaN hours', () => {
    const [w] = readWindows([{ id: 'w1', days: [1], from: '7pm', to: null }]);
    expect(hoursOn([w], 1)).toBe(0);
    expect(Number.isNaN(hoursAWeek([w]))).toBe(false);
  });
});

describe('a stored commitment', () => {
  it('always has the days the clash detector reads', () => {
    const [c] = readCommitments([thin]);
    expect(c.days).toEqual([]);
    expect(() => hoursOf(c)).not.toThrow();
    expect(weeklyHours([c])).toBe(0);
  });

  it('reads as active unless it was switched off', () => {
    // Saved before the field existed is a commitment somebody entered and
    // never turned off.
    expect(readCommitments([thin])[0].active).toBe(true);
    expect(readCommitments([{ ...thin, active: false }])[0].active).toBe(false);
  });

  it('keeps null as the real state it is — no fixed time', () => {
    expect(readCommitments([thin])[0].at).toBeNull();
    expect(readCommitments([{ ...thin, at: 17 * 60 }])[0].at).toBe(17 * 60);
  });

  it('falls back to a kind that exists', () => {
    expect(readCommitments([{ ...thin, kind: 'quidditch' }])[0].kind).toBe('other');
  });
});

describe('a stored update', () => {
  it('always has the two lists every reader of it iterates', () => {
    const [u] = readUpdates([thin]);
    expect(u.cards).toEqual([]);
    expect(u.terms).toEqual([]);
    expect(() => [...u.cards]).not.toThrow();
  });

  it('keeps the material, rather than dropping a row somebody added by hand', () => {
    const [u] = readUpdates([{ id: 'u1', title: 'Oct 8 lecture', body: 'notes', cards: 'lots' }]);
    expect(u.title).toBe('Oct 8 lecture');
    expect(u.body).toBe('notes');
    expect(u.cards).toEqual([]);
  });

  it('reads a unit that is not a whole number as a unit of its own', () => {
    expect(readUpdates([thin])[0].unit).toBeNull();
    expect(readUpdates([{ ...thin, unit: 1.5 }])[0].unit).toBeNull();
    expect(readUpdates([{ ...thin, unit: 0 }])[0].unit).toBe(0);
  });
});

describe('a stored work report', () => {
  it('always has the course the pace table names it by', () => {
    const [s] = readSpent([thin]);
    expect(s.courseId).toBe('');
    expect(() => learned([s])).not.toThrow();
    expect(learned([s])[0].courseId).toBe('');
  });

  it('keeps the hour, which was still worked', () => {
    const [s] = readSpent([{ id: 's1', minutes: 90, kind: 'paper' }]);
    expect(learned([s])[0].minutes).toBe(90);
  });
});

describe('a stored calendar event', () => {
  it('always has the date the month grid splits', () => {
    const [e] = readFeedEvents([thin]);
    expect(e.date).toBe('');
    expect(() => isoToDate(e.date)).not.toThrow();
  });

  it('keeps null as an all-day entry', () => {
    expect(readFeedEvents([thin])[0].at).toBeNull();
    expect(readFeedEvents([{ ...thin, at: 600 }])[0].at).toBe(600);
  });
});

describe('a stored appointment', () => {
  it('always has the date the month grid splits', () => {
    const [a] = readAppointments([thin]);
    expect(a.date).toBe('');
    expect(a.title).toBe('');
    expect(() => isoToDate(a.date)).not.toThrow();
  });
});

describe('a stored registrar sheet', () => {
  it('always has a date the arithmetic can read, or none', () => {
    const [d] = readTermDates([thin]);
    expect(d.iso).toBe('');
    expect(filled([d])).toEqual([]);
    expect(() => pressing([d], new Date(2026, 8, 9))).not.toThrow();
  });

  it('leaves out a date that is words rather than a day', () => {
    // "some time in October" is not nothing, and it is not a day either — it
    // reached `daysTo`, came back NaN, and sorted the list by NaN.
    const rows = readTermDates([{ id: 'a', iso: 'some time in October' }, { id: 'b', iso: '2026-10-08' }]);
    expect(filled(rows).map((d) => d.id)).toEqual(['b']);
  });
});

describe('a stored place', () => {
  it('always has the label a room is matched against', () => {
    const [p] = readPlaces([{ id: 'p1', lat: 36.1, lon: -86.8 }]);
    expect(p.label).toBe('');
    expect(matchPlace('Buttrick Hall 101', [p])).toBeNull();
  });

  it('leaves out a place with no coordinates, rather than offering one at NaN', () => {
    // A distance from an undefined coordinate is NaN, which sorts a list into
    // no order and shows as "NaN m"; zero would be a real place off the coast
    // of Africa and `nearest` would offer it as where you might be standing.
    expect(readPlaces([{ id: 'p1', label: 'Buttrick' }])).toEqual([]);
    expect(readPlaces([{ id: 'p2', label: 'B', lat: 36.1, lon: -86.8 }])).toHaveLength(1);
  });

  it('gives a place with no radius the default one', () => {
    expect(readPlaces([{ id: 'p1', label: 'B', lat: 1, lon: 2 }])[0].radius).toBe(DEFAULT_RADIUS);
  });
});

describe('a stored source', () => {
  it('always has the project name the screen groups by', () => {
    const [s] = readSources([thin]);
    expect(s.project).toBe('');
    expect(() => projects([s])).not.toThrow();
    expect(projects([s])).toEqual([]);
  });

  it('keeps the line that was pasted', () => {
    const [s] = readSources([{ id: 's1', raw: 'Keynes (1936)', project: 'Essay 2' }]);
    expect(s.raw).toBe('Keynes (1936)');
    expect(projects([s])).toEqual(['Essay 2']);
  });
});

describe('a stored timer', () => {
  /*
   * Nothing threw here; it just said NaN — on Today, on Clocks and in Field at
   * once, because a running timer follows you across the app.
   */
  it('reads as paused rather than as a clock face of NaN', () => {
    const [t] = readTimers([thin]);
    expect(t.endsAt).toBeNull();
    expect(remaining(t, Date.now())).toBe(0);
    expect(clockFace(remaining(t, Date.now()))).toBe('0:00');
    expect(lengthLine(t.seconds)).not.toContain('NaN');
    // `t.endsAt !== null` is true of undefined, so such a timer used to read
    // as running for ever and never as paused.
    expect(running(t)).toBe(false);
  });

  it('keeps a timer that is genuinely running', () => {
    const at = Date.now();
    const [t] = readTimers([{ id: 't1', label: 'Pomodoro', seconds: 1500, endsAt: at + 60_000, left: 1500 }]);
    expect(running(t)).toBe(true);
    expect(remaining(t, at)).toBe(60);
  });
});

describe('a stored alarm', () => {
  it('always has the days the next ring is worked out from', () => {
    const [a] = readAlarms([{ ...thin, on: true }]);
    expect(a.days).toEqual([]);
    expect(() => nextRing(a, new Date(2026, 8, 9, 6, 0))).not.toThrow();
  });

  it('is off unless it was saved on, because an alarm in doubt must not fire', () => {
    expect(readAlarms([thin])[0].on).toBe(false);
    expect(readAlarms([{ ...thin, on: 'yes' }])[0].on).toBe(false);
  });
});

describe('the registrar sheet', () => {
  /*
   * `filled` is the guard that keeps an undated landmark out of the
   * arithmetic, and it asks `d.iso !== ''` — true of `undefined`, so the row
   * went straight through it into `daysTo` and `isoToDate` split nothing.
   */
  it('reads a landmark’s dates back as strings, so the empty check works', () => {
    const [row] = sheet([{ id: 'addDrop' } as never]).filter((d) => d.id === 'addDrop');
    expect(row.iso).toBe('');
    expect(row.until).toBe('');
    expect(row.iso !== '').toBe(false);
  });

  it('does the same for a row against a landmark that no longer exists', () => {
    const extra = sheet([{ id: 'gone-in-a-later-build', label: 'Mine' } as never]).find(
      (d) => d.id === 'gone-in-a-later-build',
    );
    expect(extra?.iso).toBe('');
  });

  it('still keeps a date the student typed', () => {
    const row = sheet([{ id: 'addDrop', iso: '2026-09-04', until: '' } as never]).find(
      (d) => d.id === 'addDrop',
    );
    expect(row?.iso).toBe('2026-09-04');
  });

  it('takes a saved sheet that is not a list as nothing', () => {
    expect(() => sheet('none' as never)).not.toThrow();
    expect(sheet('none' as never).every((d) => d.iso === '')).toBe(true);
  });
});
