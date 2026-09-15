import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { QUIET_DAYS, whereFeed, worthSaying } from './where';

/**
 * The two screens that name a source, and the claim one makes for the other.
 *
 * `screens/Connect.tsx` tells the student, in its own words, that "feed events
 * show on the calendar under Campus, **marked with where they came from**".
 * That was true and half the story: the calendar names the feed, and naming a
 * feed answers *where* without answering *when*. An entry from a subscription
 * that stopped three weeks ago sat under "From your calendars · Department
 * events" looking exactly as authoritative as one pulled that morning, and the
 * cost of believing it is turning up to a seminar that moved.
 *
 * These are source checks rather than renders, which is the weaker kind of
 * test and the honest one here: what is being pinned is that two screens keep
 * asking the same question of the same module, and a render test of one of
 * them would not notice the other drifting.
 */
const connect = readFileSync('src/screens/Connect.tsx', 'utf8');
const calendar = readFileSync('src/screens/Calendar.tsx', 'utf8');

describe('the screens that name a source', () => {
  it('both ask `lib/where.ts` rather than each deciding', () => {
    // Two screens with their own opinion of "stale" is how the two come to
    // disagree — which is the fault `lib/calsource.ts` was written to end for
    // the calendar's four views.
    for (const [name, src] of [['Connect', connect], ['Calendar', calendar]] as const) {
      expect(src, name).toContain("from '../lib/where'");
      expect(src, name).toMatch(/whereFeed\(/);
    }
  });

  it('both say it only when it is worth saying', () => {
    // A badge on every row is a badge nobody reads, and the two screens have
    // to agree about which rows get one.
    expect(connect).toMatch(/worthSaying\(whereFeed\(/);
    expect(calendar).toMatch(/worthSaying\(whereFeed\(/);
  });

  it('Connect still makes the claim this is here to keep honest', () => {
    // If this sentence goes, the test above is guarding nothing in
    // particular and somebody should say so rather than leave it passing.
    expect(connect).toContain('marked with where they came from');
  });

  it('the calendar says when, not only which feed', () => {
    expect(calendar).toMatch(/lastPulled\(feed\.synced/);
  });

  it('Connect leaves the age off a one-off import', () => {
    // It has no URL to re-read, so "checked 40 days ago" is a complaint about
    // a fault nobody can fix.
    expect(connect).toMatch(/f\.url \? ` · \$\{lastPulled\(/);
  });
});

describe('the rule the two screens share', () => {
  const DAY = 86_400_000;
  const NOW = Date.parse('2026-09-15T09:00:00Z');

  it('marks a subscription that has gone quiet and nothing else', () => {
    const quiet = { url: 'https://x/a.ics', synced: NOW - QUIET_DAYS * DAY };
    const fresh = { url: 'https://x/b.ics', synced: NOW - DAY };
    const file = { url: '', synced: NOW - 400 * DAY };
    expect(worthSaying(whereFeed(quiet, NOW))).toBe(true);
    expect(worthSaying(whereFeed(fresh, NOW))).toBe(false);
    expect(worthSaying(whereFeed(file, NOW))).toBe(false);
  });
});
