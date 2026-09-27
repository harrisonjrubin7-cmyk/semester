import { describe, expect, it } from 'vitest';
import { changes, line, readSeen, shouldSpeak, sinceLabel, writeSeen, type SinceInput } from './since';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 8, 10, 12, 0);
const LAST = NOW.getTime() - 2 * DAY;

const input = (over: Partial<SinceInput> = {}): SinceInput => ({
  lastSeen: LAST,
  now: NOW,
  tickedAt: {},
  mine: [],
  feeds: [],
  updates: [],
  sittings: [],
  ...over,
});

describe('when to speak at all', () => {
  it('stays quiet within the same sitting', () => {
    // Somebody who closed the tab to look something up does not want a
    // change report on the way back.
    expect(shouldSpeak(NOW.getTime() - HOUR, NOW)).toBe(false);
  });

  it('speaks after a real gap', () => {
    expect(shouldSpeak(NOW.getTime() - 6 * HOUR, NOW)).toBe(true);
  });

  it('stays quiet on a first run, with no mark to compare against', () => {
    expect(shouldSpeak(0, NOW)).toBe(false);
  });
});

describe('what counts as a change', () => {
  it('notices a box ticked on another device', () => {
    const out = changes(input({ tickedAt: { a: LAST + HOUR, b: LAST + 2 * HOUR } }));
    expect(out[0].said).toBe('2 deadlines were ticked on your other device');
  });

  it('does not tell you what you just did yourself', () => {
    // A change log that includes your own actions is one nobody reads twice.
    const out = changes(input({ tickedAt: { a: LAST + HOUR }, mine: ['a'] }));
    expect(out).toEqual([]);
  });

  it('ignores anything older than the mark', () => {
    expect(changes(input({ tickedAt: { a: LAST - HOUR } }))).toEqual([]);
  });

  it('notices a feed that pulled something in', () => {
    const out = changes(
      input({ feeds: [{ id: 'f', name: 'Brightspace', synced: LAST + HOUR, count: 4 }] }),
    );
    expect(out[0].said).toBe('Brightspace brought in 4 events');
  });

  it('ignores a feed that pulled nothing', () => {
    const out = changes(
      input({ feeds: [{ id: 'f', name: 'Brightspace', synced: LAST + HOUR, count: 0 }] }),
    );
    expect(out).toEqual([]);
  });

  it('notices readings added and papers sat', () => {
    const out = changes(
      input({
        updates: [{ id: 'u', created: LAST + HOUR }],
        sittings: [{ id: 's', at: LAST + HOUR }],
      }),
    );
    expect(out.map((c) => c.said)).toEqual([
      '1 reading was added to a course',
      '1 practice paper was sat',
    ]);
  });

  it('says nothing at all on a first run', () => {
    expect(changes(input({ lastSeen: 0, tickedAt: { a: 5 } }))).toEqual([]);
  });

  it('says nothing when nothing moved', () => {
    expect(changes(input())).toEqual([]);
  });
});

describe('how it reads', () => {
  it('names the gap the way a person would', () => {
    expect(sinceLabel(NOW.getTime() - 3 * HOUR, NOW)).toBe('Since earlier today');
    expect(sinceLabel(NOW.getTime() - 30 * HOUR, NOW)).toBe('Since yesterday');
    expect(sinceLabel(NOW.getTime() - 4 * DAY, NOW)).toBe(
      'In the 4 days since you last opened this',
    );
    expect(sinceLabel(NOW.getTime() - 40 * DAY, NOW)).toBe('Since you were last here');
  });

  it('counts calendar days, not elapsed hours', () => {
    // Forty-seven hours divides into one "day", but the day it lands on is
    // the day before yesterday, and calling that yesterday is simply wrong.
    expect(sinceLabel(NOW.getTime() - 47 * HOUR, NOW)).toBe(
      'In the 2 days since you last opened this',
    );
  });

  it('joins several into one sentence', () => {
    const out = changes(
      input({
        tickedAt: { a: LAST + HOUR },
        updates: [{ id: 'u', created: LAST + HOUR }],
        sittings: [{ id: 's', at: LAST + HOUR }],
      }),
    );
    expect(line(out)).toBe(
      '1 deadline was ticked on your other device, 1 reading was added to a course and 1 practice paper was sat.',
    );
  });

  it('does not put a comma in a sentence of one', () => {
    expect(line(changes(input({ tickedAt: { a: LAST + HOUR } })))).toBe(
      '1 deadline was ticked on your other device.',
    );
  });

  it('says nothing rather than an empty sentence', () => {
    expect(line([])).toBe('');
  });
});

describe('where the mark is kept', () => {
  const store = new Map<string, string>();
  const fake = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  const withStorage = (run: () => void) => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
    store.clear();
    try {
      run();
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
    }
  };

  it('does not share a key with the sync stamps', () => {
    withStorage(() => {
      // What `state/shape.ts` writes under `semester.seen`.
      const stamps = JSON.stringify({ state: '2026-09-27T10:00:00Z', courses: {} });
      localStorage.setItem('semester.seen', stamps);
      writeSeen(1_700_000_000_000);
      expect(localStorage.getItem('semester.seen')).toBe(stamps);
      expect(readSeen()).toBe(1_700_000_000_000);
    });
  });

  it('reads a mark left under the old key, so an upgrade loses nothing', () => {
    withStorage(() => {
      localStorage.setItem('semester.seen', '1700000000000');
      expect(readSeen()).toBe(1_700_000_000_000);
    });
  });

  it('reads sync stamps under the old key as no mark rather than a date', () => {
    withStorage(() => {
      localStorage.setItem('semester.seen', JSON.stringify({ courses: {} }));
      expect(readSeen()).toBe(0);
    });
  });
});
