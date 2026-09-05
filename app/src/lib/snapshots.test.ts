import { describe, expect, it } from 'vitest';
import {
  KEEP_DAYS,
  LOCAL_LINE,
  MOST,
  NONE_LINE,
  RESTORE_LINE,
  changed,
  costLine,
  countsOf,
  dueForDaily,
  reasonLabel,
  stale,
  whenLine,
  type Snapshot,
} from './snapshots';

const now = new Date(2026, 8, 5, 14, 0, 0);
const ago = (hours: number) => now.getTime() - hours * 3_600_000;

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  id: 'a',
  at: ago(1),
  reason: 'daily',
  bytes: 1000,
  counts: {},
  ...over,
});

describe('what was in one', () => {
  it('counts a list by its length and a map by its keys', () => {
    const counts = countsOf({
      notes: [{}, {}, {}],
      done: { a: true, b: true },
      courses: [{}],
    });
    expect(counts.notes).toBe(3);
    expect(counts.done).toBe(2);
    expect(counts.courses).toBe(1);
  });

  it('leaves out anything that is not the shape it should be', () => {
    // A store that has been through an older version, or a hand-edited file.
    expect(countsOf({ notes: 'nope', done: [1, 2] })).toEqual({});
  });

  it('says nothing about keys a backup does not carry', () => {
    expect(countsOf({ secretKey: ['x'] })).toEqual({});
  });
});

describe('when the daily one is due', () => {
  it('is due when nothing was taken today', () => {
    expect(dueForDaily([], now)).toBe(true);
    expect(dueForDaily([snap({ at: ago(30) })], now)).toBe(true);
  });

  it('is not due once today has one', () => {
    expect(dueForDaily([snap({ at: ago(6) })], now)).toBe(false);
  });

  it('counts by the calendar day, not by elapsed hours', () => {
    // Somebody who opens the app at 9am daily should get one a day, not one
    // every other day.
    const lastNight = new Date(2026, 8, 4, 22, 0, 0).getTime();
    expect(dueForDaily([snap({ at: lastNight })], now)).toBe(true);
  });

  it('does not count one taken before an import as the day’s copy', () => {
    // Otherwise a day that began with an import never gets its own copy, and
    // the one it has is from after whatever went wrong.
    expect(dueForDaily([snap({ at: ago(2), reason: 'import' })], now)).toBe(true);
  });
});

describe('what gets thrown away', () => {
  it('keeps everything from the last day, however many there are', () => {
    // The day of the mistake is the day the extra copies are worth having.
    const today = [
      snap({ id: 'a', at: ago(1), reason: 'import' }),
      snap({ id: 'b', at: ago(3), reason: 'import' }),
      snap({ id: 'c', at: ago(8) }),
      snap({ id: 'd', at: ago(20), reason: 'bulk' }),
    ];
    expect(stale(today, now)).toEqual([]);
  });

  it('thins an older day down to its newest', () => {
    const list = [
      snap({ id: 'new', at: ago(48) }),
      snap({ id: 'old', at: ago(52) }),
      snap({ id: 'older', at: ago(56) }),
    ];
    expect(stale(list, now).sort()).toEqual(['old', 'older']);
  });

  it('drops anything past the week', () => {
    const list = [snap({ id: 'ancient', at: ago((KEEP_DAYS + 1) * 24) }), snap({ id: 'fine' })];
    expect(stale(list, now)).toEqual(['ancient']);
  });

  it('caps the total, so a day of importing cannot fill the disk', () => {
    const many = Array.from({ length: MOST + 6 }, (_, i) =>
      snap({ id: `s${i}`, at: ago(i * 0.5), reason: 'import' }),
    );
    const dropped = stale(many, now);
    expect(many.length - dropped.length).toBe(MOST);
    // And it drops the oldest, not the newest.
    expect(dropped).not.toContain('s0');
    expect(dropped).toContain(`s${MOST + 5}`);
  });

  it('has nothing to say about an empty list', () => {
    expect(stale([], now)).toEqual([]);
  });
});

describe('what a restore would change', () => {
  it('says what would go, with both numbers', () => {
    const rows = changed({ notes: 12 }, { notes: 9 });
    expect(rows).toHaveLength(1);
    expect(rows[0].loses).toBe(true);
    expect(rows[0].line).toBe('notes — 12 now, 9 then. 3 would go.');
  });

  it('says what would come back', () => {
    const [row] = changed({ courses: 3 }, { courses: 4 });
    expect(row.loses).toBe(false);
    expect(row.line).toContain('would come back');
  });

  it('is silent about what does not move', () => {
    expect(changed({ notes: 4, courses: 4 }, { notes: 4, courses: 4 })).toEqual([]);
  });

  it('treats a missing section as zero rather than skipping it', () => {
    // A snapshot taken before a feature existed has no key for it, and
    // restoring it really would empty that list.
    const [row] = changed({ tasks: 5 }, {});
    expect(row.loses).toBe(true);
    expect(row.line).toContain('tasks — 5 now, 0 then');
    expect(row.line).toContain('5 would go');
  });

  it('uses the words a person would use, not the key names', () => {
    expect(changed({ done: 40 }, { done: 31 })[0].line).toContain('what you have ticked off');
  });

  it('does not say "1 notes" in the case that matters most', () => {
    // The labels are plural phrases, so a count in front of one produces
    // "1 notes" exactly when somebody is deciding whether to lose a note.
    expect(changed({ notes: 1 }, { notes: 0 })[0].line).not.toMatch(/1 notes/);
  });
});

describe('the headline above it', () => {
  it('says plainly when nothing changes', () => {
    expect(costLine([])).toContain('Nothing would change');
  });

  it('says when a restore costs nothing', () => {
    expect(costLine([{ loses: false }])).toContain('Nothing would be lost');
  });

  it('refuses to be reassuring when something goes', () => {
    // It replaces; it does not merge. Softening that is how somebody loses a
    // week and believes the app told them otherwise.
    const said = costLine([{ loses: true }, { loses: false }]);
    expect(said).toContain('not merged in');
    expect(said).toContain('it goes');
  });
});

describe('how it is described', () => {
  it('says how long ago the way somebody deciding would', () => {
    expect(whenLine(ago(0.005), now)).toBe('Just now');
    expect(whenLine(ago(0.5), now)).toBe('30 minutes ago');
    expect(whenLine(ago(3), now)).toBe('Today, 3 hours ago');
    expect(whenLine(ago(26), now)).toBe('Yesterday');
    expect(whenLine(ago(72), now)).toBe('3 days ago');
  });

  it('names every reason it takes one', () => {
    for (const r of ['daily', 'import', 'restore', 'bulk', 'close', 'asked']) {
      expect(reasonLabel(r)).not.toBe('Saved');
    }
    expect(reasonLabel('whatever')).toBe('Saved');
  });

  it('does not let these be mistaken for a backup', () => {
    // They survive a mistake, not a lost phone, and the difference matters.
    expect(LOCAL_LINE).toContain('stay on this device');
    expect(LOCAL_LINE).toContain('not synced');
    expect(LOCAL_LINE).toContain('Take it with you');
    expect(NONE_LINE).toContain('No copies yet');
  });

  it('says a restore is itself undoable, and only here', () => {
    expect(RESTORE_LINE).toContain('does not merge');
    expect(RESTORE_LINE).toContain('copy of right now first');
    expect(RESTORE_LINE).toContain('only from this device');
  });
});
