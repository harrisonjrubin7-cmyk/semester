import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  QUIET_DAYS,
  TRUST,
  aboutWhere,
  lastPulled,
  saysWhere,
  weakest,
  whereFeed,
  worthSaying,
  type Where,
} from './where';

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-15T09:00:00Z');
const ALL: Where[] = ['official', 'connected', 'made', 'yours', 'sample', 'stale'];

describe('the ordering', () => {
  it('runs from the institution’s record down to a copy nobody has checked', () => {
    expect([...ALL].sort((a, b) => TRUST[a] - TRUST[b])).toEqual([
      'official',
      'connected',
      'made',
      'yours',
      'sample',
      'stale',
    ]);
  });

  it('gives every state a distinct place, so a sort is never a coin toss', () => {
    expect(new Set(Object.values(TRUST)).size).toBe(ALL.length);
  });

  it('puts an unchecked copy below a guess somebody made on purpose', () => {
    // The one placement worth arguing. A guess knows it is a guess; a copy of
    // something that may have moved does not.
    expect(TRUST.stale).toBeGreaterThan(TRUST.yours);
  });
});

describe('the words', () => {
  it('names every state', () => {
    expect(ALL.map(saysWhere)).toEqual([
      'Official',
      'Connected',
      'Made here',
      'Yours',
      'Sample',
      'Out of date',
    ]);
  });

  it('explains every state in a finished sentence', () => {
    for (const w of ALL) {
      expect(aboutWhere(w).length, w).toBeGreaterThan(0);
      expect(aboutWhere(w).endsWith('.'), w).toBe(true);
    }
  });

  it('gives no two states the same word', () => {
    expect(new Set(ALL.map(saysWhere)).size).toBe(ALL.length);
  });
});

describe('which are worth interrupting for', () => {
  it('is the two that mean “not about you” and “not current”, plus official', () => {
    expect(ALL.filter(worthSaying)).toEqual(['official', 'sample', 'stale']);
  });

  it('says nothing about the ordinary states of an ordinary semester', () => {
    // A badge on every row is a badge nobody reads.
    for (const w of ['connected', 'made', 'yours'] as Where[]) {
      expect(worthSaying(w), w).toBe(false);
    }
  });
});

describe('where a calendar feed stands', () => {
  it('calls a fresh subscription connected', () => {
    expect(whereFeed({ url: 'https://x/cal.ics', synced: NOW - DAY }, NOW)).toBe('connected');
  });

  it('calls a subscription that has gone quiet out of date', () => {
    expect(whereFeed({ url: 'https://x/cal.ics', synced: NOW - QUIET_DAYS * DAY }, NOW)).toBe('stale');
  });

  it('holds the line one day inside the window', () => {
    expect(whereFeed({ url: 'https://x/cal.ics', synced: NOW - (QUIET_DAYS - 1) * DAY }, NOW)).toBe(
      'connected',
    );
  });

  it('never calls a file imported once out of date, however old it gets', () => {
    /*
     * The one that is easy to get wrong. A one-off import has no URL to
     * re-read and was never going to update, so a staleness warning on it is
     * a warning about a fault nobody can fix — on every imported .ics in the
     * app, forever.
     */
    for (const age of [0, 1, 30, 400]) {
      expect(whereFeed({ url: '', synced: NOW - age * DAY }, NOW), `${age} days`).toBe('yours');
    }
  });

  it('calls a subscription that has never pulled out of date, not connected', () => {
    // "Connected" on a feed that has never once succeeded is the app claiming
    // a link it does not have.
    expect(whereFeed({ url: 'https://x/cal.ics', synced: 0 }, NOW)).toBe('stale');
  });

  it('is not fooled by a stamp from the future', () => {
    // A device with a wrong clock, or a server stamp. `daysBetween` goes
    // negative, which must not read as "very stale".
    expect(whereFeed({ url: 'https://x/cal.ics', synced: NOW + 5 * DAY }, NOW)).toBe('connected');
  });
});

describe('when it last pulled, in words', () => {
  it('says never when it never has', () => {
    expect(lastPulled(0, NOW)).toBe('never checked');
  });

  it('reads today, yesterday, then a count', () => {
    expect(lastPulled(NOW - 60_000, NOW)).toBe('checked today');
    expect(lastPulled(NOW - DAY, NOW)).toBe('checked yesterday');
    expect(lastPulled(NOW - 9 * DAY, NOW)).toBe('checked 9 days ago');
  });

  it('does not count backwards for a stamp from the future', () => {
    expect(lastPulled(NOW + 3 * DAY, NOW)).toBe('checked today');
  });
});

describe('what a group of rows is worth', () => {
  it('is its weakest row, not its best', () => {
    // A week with one out-of-date row is a week you cannot act on without
    // checking. Reporting the group at its best row says the opposite.
    expect(weakest(['official', 'connected', 'stale'])).toBe('stale');
  });

  it('is the only row when there is one', () => {
    expect(weakest(['made'])).toBe('made');
  });

  it('makes no claim about an empty set', () => {
    expect(weakest([])).toBeNull();
  });
});

/**
 * The tripwire.
 *
 * `server/institution/` has an empty production adapter registry, so nothing
 * in this build can honestly say Official. The word ships anyway, because a
 * vocabulary that gains its most important term late is one every existing
 * caller has been written around.
 *
 * When an adapter lands, this test fails. That is what it is for: somebody
 * then has to decide what earns the word, rather than discovering that
 * "Official" has quietly been dead code for a year.
 */
describe('nothing in this build is Official', () => {
  it('has no production adapter to read one from', () => {
    const registry = readFileSync('server/institution/adapters.ts', 'utf8');
    // The empty registry, however it is spelled — an array or object literal
    // with nothing in it.
    expect(registry).toMatch(/=\s*(\[\s*\]|\{\s*\})/);
  });

  it('is not returned by the one function that decides a state', () => {
    const feeds = [
      { url: '', synced: 0 },
      { url: '', synced: NOW },
      { url: 'https://x/cal.ics', synced: 0 },
      { url: 'https://x/cal.ics', synced: NOW },
      { url: 'https://x/cal.ics', synced: NOW - 90 * DAY },
    ];
    expect(feeds.map((f) => whereFeed(f, NOW))).not.toContain('official');
  });
});
