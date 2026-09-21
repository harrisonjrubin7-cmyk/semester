// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MARKS, PRUNE_DAYS, SAID_KEY, type Mark, marksFor, noteToday } from './activity';

/**
 * The browser's half of the pilot's three figures.
 *
 * The database half is checked in `supabase/activity.check.sql`, which is
 * where the reasoning about what a browser may write lives, and there is no
 * overlap on purpose: that suite asks whether a caller can forge a row about
 * somebody else or about another day, and this one asks whether the right
 * words are sent, once, and only when there is something to say.
 *
 * The first two tests are the ones that would otherwise never fail. Both
 * sides state the same closed vocabulary and the same clock, in two
 * languages, in two deployments that cannot import from each other, and the
 * failure is not a crash: a fourth mark added here and not there is silently
 * filtered out by the function, and the figure it was for reads as zero
 * forever. `lib/referral.test.ts` and `lib/allowance.test.ts` say more about
 * why reading the other side as text is the right instrument for that.
 */

const repo = join(process.cwd(), '..');
const migration = readFileSync(
  join(repo, 'supabase/migrations/20260921151000_activity.sql'),
  'utf8',
);

const rpc = vi.fn();

/*
 * The two exports this module uses are replaced and the rest of `cloud.ts` is
 * left real, which is not tidiness: the disclosure tests at the bottom import
 * `privacy.ts`, and that reads `KEPT_TABLES` out of the same module to build
 * the sentence it prints. A mock that returned only what this file calls
 * would have made those two tests fail on a missing export rather than on the
 * thing they are about — which is how they failed when it did.
 */
vi.mock('./cloud', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./cloud')>()),
  cloudConfigured: true,
  cloud: () => Promise.resolve({ rpc: (...args: unknown[]) => rpc(...args) }),
}));

beforeEach(() => {
  window.localStorage.clear();
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
});

describe('the two things that live on both sides of the wire', () => {
  /*
   * Written out rather than matched loosely, and asserted to have matched at
   * all, for `allowance.test.ts`'s reason: a regex that stops finding its
   * subject returns null, and a test that only compares when it finds
   * something would pass in silence for the rest of this repository's life.
   */
  it('sends only words the database will accept', () => {
    const check = /check \(mark in \(([^)]*)\)\)/.exec(migration);
    expect(check, 'could not find the mark check in the migration — has it moved?').toBeTruthy();
    const allowed = [...check![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(allowed.length).toBeGreaterThan(0);
    expect([...MARKS].sort()).toEqual(allowed);
  });

  /*
   * The same list a second time, in the function's own filter.
   *
   * It is not the same assertion. The `check` is what a row written by hand
   * in the dashboard meets; the filter is what every row written through the
   * app meets, and `activity.check.sql` measured that each is invisible while
   * the other holds. A client mark missing from *either* is a mark that never
   * arrives, so both are pinned here.
   */
  it('and words the function will not filter out', () => {
    const filter = /where m in \(([^)]*)\)/.exec(migration);
    expect(filter, 'could not find the unknown-mark filter in the migration').toBeTruthy();
    const kept = [...filter![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect([...MARKS].sort()).toEqual(kept);
  });

  it('agrees with the migration about how long a row is kept', () => {
    const prune = /date - (\d+)\)/.exec(migration);
    expect(prune, 'could not find the prune in the migration — has it moved?').toBeTruthy();
    expect(Number(prune![1])).toBe(PRUNE_DAYS);
  });
});

describe('what is true of an account', () => {
  const nothing = { courses: [], reviews: {} };

  it('always says the app was opened', () => {
    expect(marksFor(nothing)).toEqual(['opened']);
  });

  /*
   * The distinction the whole activation figure rests on. A new account that
   * has done nothing but look at the sample semester is not activated, and
   * the sample is a flag on the state row rather than an entry in `courses`
   * — so this is free, and it is worth a test saying it is free, because a
   * later change that put the sample in the list would turn every sign-up
   * into an activation and nothing else would notice.
   */
  it('says course only once there is a course of this account’s own', () => {
    expect(marksFor({ courses: [{}], reviews: {} })).toContain('course');
    expect(marksFor(nothing)).not.toContain('course');
  });

  it('says studied only once a card has been answered', () => {
    expect(marksFor({ courses: [], reviews: { abc: {} } })).toContain('studied');
    expect(marksFor(nothing)).not.toContain('studied');
  });

  it('never invents a word the database has not heard of', () => {
    const every = marksFor({ courses: [{}], reviews: { a: {} } });
    expect(every.sort()).toEqual([...MARKS].sort());
    for (const mark of every) expect(MARKS).toContain(mark);
  });
});

describe('sending it', () => {
  const full = { courses: [{}], reviews: { a: {} } };

  it('sends the marks, once', async () => {
    expect(await noteToday(marksFor(full))).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('note_activity', {
      marks: ['opened', 'course', 'studied'],
    });
  });

  it('and does not send the same marks again the same day', async () => {
    await noteToday(marksFor(full));
    expect(await noteToday(marksFor(full))).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  /*
   * The re-send, which is the whole reason the app does not simply ping once
   * a day. A student who signs in, imports a syllabus and drills a deck has
   * done all three things in one evening; a ping fired only at boot would
   * date two of them to tomorrow, and a student who never opened the app
   * again would be counted as never having activated at all.
   */
  it('sends again when one of the three becomes true', async () => {
    await noteToday(marksFor({ courses: [], reviews: {} }));
    expect(await noteToday(marksFor({ courses: [{}], reviews: {} }))).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1]).toEqual({ marks: ['opened', 'course'] });
  });

  /*
   * The ordering, because the guard is a string and the set is not ordered.
   * `marksFor` happens to return them in funnel order today; a change that
   * returned them in another would otherwise make every ping look new and
   * write one row per render.
   */
  it('treats the same marks in another order as the same marks', async () => {
    await noteToday(marksFor(full));
    window.localStorage.setItem(
      SAID_KEY,
      `${new Date().toISOString().slice(0, 10)}|${['studied', 'opened', 'course'].sort().join(',')}`,
    );
    expect(await noteToday(marksFor(full))).toBe(false);
  });

  /*
   * The order of the two writes, which is the difference between a failed
   * ping costing a retry and costing a day. The first version of this module
   * remembered before it sent.
   */
  it('remembers nothing when the call fails, so the next open retries', async () => {
    rpc.mockResolvedValue({ error: { message: 'offline' } });
    await expect(noteToday(marksFor(full))).rejects.toThrow('offline');
    expect(window.localStorage.getItem(SAID_KEY)).toBeNull();

    rpc.mockResolvedValue({ error: null });
    expect(await noteToday(marksFor(full))).toBe(true);
  });

  it('still sends when this browser has no storage to remember with', async () => {
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('private browsing');
      });
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('private browsing');
      });
    try {
      expect(await noteToday(marksFor(full))).toBe(true);
      expect(rpc).toHaveBeenCalledTimes(1);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  /*
   * The date the guard is keyed to is the database's, not the device's. A
   * student in Nashville is five hours behind UTC, so between seven in the
   * evening and midnight their local date and the row's disagree — and a
   * guard keyed to the local one would skip the evening, which is when this
   * app is used.
   */
  it('keys the guard to the day the row will carry', async () => {
    await noteToday(marksFor(full));
    const said = window.localStorage.getItem(SAID_KEY) ?? '';
    expect(said.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe('where it fires from', () => {
  /*
   * The claim `lib/activity.ts` makes for deriving marks instead of firing
   * events is that there is exactly one call site and nobody editing a screen
   * can forget it. That is a claim about the repository, so it is checked
   * like one — a structural check, in the shape `CLAUDE.md` argues for: it
   * cannot be fooled by a code path a runtime test happened not to take.
   */
  const sources = (): string[] => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const at = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(at);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(at);
      }
    };
    walk(path.join(process.cwd(), 'src'));
    return out;
  };

  it('is the store, and nowhere else', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const callers = sources().filter(
      (f) => !f.endsWith('lib/activity.ts') && /\bnoteToday\(/.test(fs.readFileSync(f, 'utf8')),
    );
    expect(callers.map((f) => f.replace(process.cwd(), ''))).toEqual(['/src/state/store.tsx']);
  });

  it('and fires on the marks rather than on the state', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const store = fs.readFileSync(path.join(process.cwd(), 'src/state/store.tsx'), 'utf8');
    // The dependency array is the thing that decides whether this is one ping
    // an evening or one a keystroke.
    expect(store).toMatch(/\}, \[account, marks\]\);/);
    expect(store).toMatch(/const said = marksFor\(state\)\.join\(','\)/);
    expect(store).toMatch(/useMemo\(\(\) => said\.split\(','\) as Mark\[\], \[said\]\)/);
  });
});

describe('the disclosure', () => {
  /*
   * The build-out plan asks for this to be "disclosed in Privacy", which is a
   * sentence on a screen rather than a line in a migration — and a sentence
   * is exactly the thing that gets left behind when the feature is what
   * changes. So the two are tied together here: a record the app sends and
   * the page does not name is what this goes red for.
   */
  it('names on the privacy page what this sends, and keeps the sentence it rests on', async () => {
    const { CLAIMS } = await import('./privacy');
    const said = CLAIMS.map((c) => `${c.heading} ${c.body}`).join(' ');
    expect(said).toMatch(/which days you opened the app|days you had the app open/i);
    // Both promises the page makes about analytics, which this feature is the
    // first thing in the app that could have made false.
    expect(said).toContain('no third-party analytics');
    expect(said).toMatch(/Signed out, none of it happens at all/);
  });

  it('and says the clock the database actually runs', async () => {
    const { CLAIMS } = await import('./privacy');
    const said = CLAIMS.map((c) => c.body).join(' ');
    // Not the number — the page says "a little over a year" because that is
    // what 400 days is to a person, and a page that said "400 days" would be
    // precise about the wrong thing. What is pinned is that it says there is
    // a clock at all, which is the part that would otherwise quietly stop
    // being true in the other direction.
    expect(said).toMatch(/kept for a little over a year/);
    expect(PRUNE_DAYS).toBeGreaterThan(365);
  });
});

describe('the report, which is a third copy of the same windows', () => {
  /*
   * `supabase/analytics.sql` is what the pilot is read from, and
   * `supabase/activity.check.sql` is the only place its arithmetic is run
   * against a population whose answer is known in advance. They are separate
   * files, in the same language, that cannot import from each other — the
   * gap `referral.test.ts` and `allowance.test.ts` describe, in a third
   * place.
   *
   * What drifts is never the shape of the query. It is a number: the seven
   * days activation is measured inside, the twenty-eight to thirty-four the
   * return has to land in, the thirty-four a cohort has to be older than. Move
   * one in the report and the suite goes on proving the old one, in green.
   *
   * The suite names its alias `f_day0` because `day0` is already a variable in
   * the block, so the alias is normalised away before matching rather than
   * written twice into every pattern.
   */
  const read = (rel: string): string => {
    const fs = require('node:fs') as typeof import('node:fs');
    return fs.readFileSync(join(repo, rel), 'utf8');
  };
  const report = () => read('supabase/analytics.sql');
  const suite = () => read('supabase/activity.check.sql').replaceAll('f_day0', 'day0');

  const all = (text: string, re: RegExp): string[] =>
    [...text.matchAll(re)].map((m) => m[1]);

  it('measures activation inside the same window on both sides', () => {
    const re = /at <= (?:f\.)?day0 \+ (\d+)/g;
    const inReport = all(report(), re);
    const inSuite = all(suite(), re);
    expect(inReport.length, 'the activation window is no longer in analytics.sql').toBeGreaterThan(0);
    expect(inSuite.length, 'the activation window is no longer in activity.check.sql').toBeGreaterThan(0);
    // Every use on each side is the same number, and the two sides agree.
    expect(new Set([...inReport, ...inSuite]).size).toBe(1);
  });

  it('and counts a return inside the same band', () => {
    const re = /between (?:f\.)?day0 \+ (\d+) and (?:f\.)?day0 \+ (\d+)/;
    const inReport = re.exec(report());
    const inSuite = re.exec(suite());
    expect(inReport, 'the retention band is no longer in analytics.sql').toBeTruthy();
    expect(inSuite, 'the retention band is no longer in activity.check.sql').toBeTruthy();
    expect([inSuite![1], inSuite![2]]).toEqual([inReport![1], inReport![2]]);
  });

  /*
   * The exclusion, which is the one with teeth, and it is checked *within*
   * each query rather than across the file.
   *
   * Both queries carry a cutoff of the same shape — `day0 <= today - n` — and
   * the first draft of this test matched the first one it found, which was
   * activation's seven, and then compared it against retention's band. It
   * failed for the right reason and would have passed for the wrong one the
   * moment somebody reordered the file. So each section is sliced out by its
   * own heading and asked about itself: a cohort must be older than the
   * window it is being measured over, or the newest week reports a number
   * that is guaranteed to rise — or, for retention, one that is guaranteed to
   * be nought. The newest week is the one anybody looks at.
   */
  const section = (text: string, from: string, to: string | null): string => {
    const start = text.indexOf(from);
    expect(start, `analytics.sql no longer has a section headed ${from}`).toBeGreaterThan(-1);
    const end = to === null ? text.length : text.indexOf(to);
    return text.slice(start, end === -1 ? text.length : end);
  };
  const cutoff = (text: string): string => {
    const m = /day0 <= \(now\(\) at time zone 'utc'\)::date - (\d+)/.exec(text);
    expect(m, 'this section no longer excludes the cohorts it cannot measure').toBeTruthy();
    return m![1];
  };

  it('excludes a cohort younger than the activation window it is measured over', () => {
    const part = section(report(), '-- ── 2 · Activation', '-- ── 3 ·');
    const window = /at <= f\.day0 \+ (\d+)/.exec(part);
    expect(window, 'the activation window is no longer in that section').toBeTruthy();
    expect(cutoff(part)).toBe(window![1]);
  });

  it('and a cohort whose retention band has not finished', () => {
    const part = section(report(), '-- ── 3 · 30-day retention', '-- ── 4 ·');
    const band = /between f\.day0 \+ \d+ and f\.day0 \+ (\d+)/.exec(part);
    expect(band, 'the retention band is no longer in that section').toBeTruthy();
    expect(cutoff(part)).toBe(band![1]);
    // And the suite proves the arithmetic over a cohort chosen by the same
    // margin, which is what makes its answer a check on this file.
    expect(suite()).toMatch(new RegExp(`day0 <= today - ${band![1]}\\b`));
  });

  it('and weekly active use is a week of opens on both sides', () => {
    for (const text of [report(), suite()]) {
      expect(text).toContain("date_trunc('week', day)");
      expect(text).toContain("mark = 'opened'");
    }
  });

  /*
   * The control the report itself opens with, asserted to still be there.
   * Every query in that file returns nothing both when nobody used the app
   * and when nothing is writing to the table, and those mean opposite things.
   */
  it('and the report still leads with the control that tells an outage from a fact', () => {
    const text = report();
    expect(text).toContain('count(distinct mark)');
    expect(text).toMatch(/written_today/);
    expect(text.indexOf('written_today')).toBeLessThan(text.indexOf("date_trunc('week', day)"));
  });
});

describe('the document the figures are quoted from', () => {
  /*
   * `ANALYTICS.md` is what a reader — an adviser, a university, the person
   * writing the deck — takes the definitions from, and a definition that has
   * quietly stopped matching the query is worse than none: it reads well, it
   * is specific, and it is wrong in the direction of whoever last tuned a
   * number without opening it.
   *
   * The same bidirectional shape `retention.test.ts` uses on `RETENTION.md`,
   * narrowed to the three things that can drift: the windows, the vocabulary,
   * and the sentence about running the control first.
   */
  const doc = (): string => {
    const fs = require('node:fs') as typeof import('node:fs');
    return fs.readFileSync(join(repo, 'ANALYTICS.md'), 'utf8').replace(/\s+/g, ' ');
  };
  const report = (): string => {
    const fs = require('node:fs') as typeof import('node:fs');
    return fs.readFileSync(join(repo, 'supabase/analytics.sql'), 'utf8');
  };

  it('carries no placeholder where an answer should be', () => {
    const said = doc();
    for (const placeholder of ['TODO', 'TBD', 'FIXME', '<owner>', 'XXX']) {
      expect(said).not.toContain(placeholder);
    }
  });

  it('quotes the activation window the query actually uses', () => {
    const days = /at <= f\.day0 \+ (\d+)/.exec(report())?.[1];
    expect(days).toBeTruthy();
    expect(doc()).toContain(`within **${days} days** of arriving`);
  });

  it('and the retention band', () => {
    const band = /between f\.day0 \+ (\d+) and f\.day0 \+ (\d+)/.exec(report());
    expect(band).toBeTruthy();
    expect(doc()).toContain(`**${band![1]} and ${band![2]} days**`);
    expect(doc()).toContain(`younger than ${band![2]} days are excluded`);
  });

  it('and names the three marks the schema will accept, and no others', () => {
    for (const mark of MARKS) expect(doc()).toContain(`\`${mark}\``);
    // The other direction: a mark the document describes that the app cannot
    // send would send a reader looking for a figure nothing produces.
    const named = [...doc().matchAll(/\| `([a-z_]+)` \|/g)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(0);
    for (const mark of named) expect(MARKS).toContain(mark as Mark);
  });

  it('and still says to run the control first', () => {
    expect(doc()).toMatch(/Run block 0 first, every time/);
  });
});

/** Types only, so the file fails to compile if the vocabulary narrows. */
const _typed: Mark[] = [...MARKS];
void _typed;
