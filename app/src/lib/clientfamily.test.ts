import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FAMILIES, clientFamily, type Family } from './clientfamily';

/**
 * The classifier, and the three copies of the list it classifies into.
 *
 * `clientFamily` is one `if` after another and would be dull to test if the
 * cases were made up. They are not: every string below is a real user agent
 * sent by a real calendar client, because the whole value of this function is
 * that it is right about the four programs that will actually fetch a feed,
 * and a test written from imagination would agree with an implementation
 * written from the same imagination.
 *
 * The case that matters most is the one that looks like a technicality.
 * **Safari on a Mac must be a browser.** Its user agent contains
 * `Intel Mac OS X 10_15_7`, and macOS Calendar's contains `Mac OS X/10.15.7`,
 * so the obvious rule — does it mention Mac OS X — files a person opening a
 * leaked link as the student's own calendar app. That is not a near miss: it
 * is the single signal this feature exists to produce, turned off, on the
 * platform most of these students carry, with nothing anywhere to say so.
 */

const ROOT = join(process.cwd(), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('the programs that actually fetch a calendar', () => {
  const cases: [string, Family, string][] = [
    ['Mac OS X/10.15.7 (19H2) CalendarAgent/954.9', 'apple', 'macOS Calendar'],
    ['iOS/17.2 (21C62) dataaccessd/1.0', 'apple', 'iOS Calendar'],
    ['Mac+OS+X/10.13.6 (17G14042) CalendarAgent/408.1', 'apple', 'an older macOS'],
    ['Mozilla/5.0 (compatible; Google-Calendar-Importer)', 'google', 'Google Calendar'],
    ['Microsoft Office Outlook 16.0', 'outlook', 'Outlook on the desktop'],
    ['Microsoft-WebDAV-MiniRedir/10.0.19043', 'outlook', 'Windows fetching a feed'],
  ];

  for (const [ua, want, who] of cases) {
    it(`reads ${who} as ${want}`, () => {
      expect(clientFamily(ua)).toBe(want);
    });
  }
});

describe('and the thing that is not one of them', () => {
  /*
   * Four real browsers, and the first two are the trap. Both name an Apple
   * operating system; neither is a calendar.
   */
  const browsers: [string, string][] = [
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Safari on macOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
      'Safari on an iPhone',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/120.0.0.0 Safari/537.36',
      'Chrome on Windows',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0', 'Firefox'],
  ];

  for (const [ua, who] of browsers) {
    it(`reads ${who} as a browser, which is what a person looks like`, () => {
      expect(clientFamily(ua)).toBe('browser');
    });
  }

  it('does not read a Mac browser as the Mac calendar, which is the whole trap', () => {
    // Said twice on purpose. A rule keyed on the operating system rather than
    // on the agent passes every other test in this file.
    const safari =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
    const calendar = 'Mac OS X/10.15.7 (19H2) CalendarAgent/954.9';
    expect(clientFamily(safari)).not.toBe(clientFamily(calendar));
    expect([clientFamily(safari), clientFamily(calendar)]).toEqual(['browser', 'apple']);
  });
});

describe('the two kinds of nothing, which are not the same kind', () => {
  it('has no opinion when there is no user agent', () => {
    for (const nothing of ['', '   ', null, undefined]) {
      expect(clientFamily(nothing)).toBe('unknown');
    }
  });

  it('but says "other" for something it was told and did not recognise', () => {
    /*
     * The distinction earns its keep on the day a fifth calendar client
     * appears: `unknown` is a header that was never sent, `other` is one this
     * function has not learned yet. Collapsing them hides the second inside
     * the first, and the second is the one somebody should go and look at.
     */
    expect(clientFamily('curl/8.4.0')).toBe('other');
    expect(clientFamily('python-requests/2.31.0')).toBe('other');
    expect(clientFamily('Semester/1.0')).toBe('other');
  });

  it('never answers with anything outside the list', () => {
    const odd = ['', 'x', '<script>', '../../etc/passwd', 'Mozilla', '🙂', 'a'.repeat(4000)];
    for (const ua of odd) {
      expect(FAMILIES as readonly string[], ua).toContain(clientFamily(ua));
    }
  });
});

describe('the same list in three places, which is three places to drift', () => {
  /**
   * The vocabulary as the database enforces it, read out of the check
   * constraint rather than written down here.
   */
  function fromSql(): string[] {
    const sql = read('supabase/migrations/20260901001300_access_log.sql');
    const constraint = /check \(client in \(([^)]*)\)\)/s.exec(sql);
    expect(constraint, 'access_log no longer constrains client; re-point this guard').toBeTruthy();
    return [...constraint![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
  }

  it('the database refuses exactly what this module can produce', () => {
    /*
     * The failure this catches is silent in the worst direction. Adding a
     * family here and not to the constraint does not break a build or a test
     * — it makes `note_access` raise `check_violation` at runtime, inside a
     * calendar fetch, where the function's own comment says a failure must
     * never be fatal. The log would simply stop recording that client, and
     * the missing entries would look exactly like nobody fetching.
     */
    expect(fromSql()).toEqual([...FAMILIES].sort());
  });

  it('and the deployed function classifies into the same list', () => {
    /*
     * The third copy. It is a copy because a Supabase Edge Function is
     * deployed alone to Deno and cannot import from `app/src` — the same
     * reason `lib/publichost.ts` duplicates `fetchcal`'s rule — so the pin is
     * a test rather than a type.
     */
    const fn = read('supabase/functions/calendar/index.ts');
    const list = /const FAMILY[\s\S]*?\n\}/.exec(fn);
    expect(list, 'the calendar function no longer classifies its caller').toBeTruthy();
    const named = [...new Set([...list![0].matchAll(/'([a-z]+)'/g)].map((m) => m[1]))];
    for (const family of named) {
      expect(FAMILIES as readonly string[], `${family} is in the function and not here`).toContain(
        family,
      );
    }
    // And the two families the function must be able to produce, because they
    // are the ones the feature is about.
    expect(named).toContain('browser');
    expect(named).toContain('apple');
  });

  it('and the list is not empty, which is what a broken read looks like', () => {
    // The control on both sweeps above. An empty array equals an empty array,
    // and a regex that matched nothing would pass the first test against a
    // migration with no constraint in it at all.
    expect(FAMILIES.length).toBeGreaterThan(4);
    expect(fromSql().length).toBe(FAMILIES.length);
  });
});
