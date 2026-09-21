import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SOURCES } from '../data/misc';

/**
 * What the app tells a student a Brightspace account can do for it.
 *
 * Three files say it and they had drifted into saying two things that are not
 * true. An outside review of the app caught both, and they are the kind that
 * only an outside reader catches, because each one reads as the app being
 * careful:
 *
 *  1. **"the calendar feed carries every due date."** It carries what
 *     instructors put on the Brightspace calendar. That is most of a term and
 *     it is not the syllabus, and the gap is invisible from inside the app —
 *     the student sees a full-looking calendar and a promise that it is
 *     complete, and finds out which one was wrong in week nine.
 *  2. **"no app you install can read them on your behalf, however it asks."**
 *     Grades and submissions really are out of reach today, and the reason is
 *     not impossibility: D2L documents registered OAuth applications and
 *     scopes, so a school that registered this one could grant them. Nobody
 *     has asked Vanderbilt. Saying it cannot be done closes a door the app
 *     would like to walk through during a pilot, and tells a student something
 *     about their university's systems that is false.
 *
 * Both sentences were true-sounding, load-bearing and unpinned. They are
 * pinned here rather than trusted, by the words rather than by their shape,
 * because the failure is a sentence somebody rewrites while tidying the copy.
 *
 * `lib/guidebook.ts` is the control. It is the file that says what the app
 * asks of a student and it makes no claim about Brightspace at all, so a probe
 * matching it would be matching prose rather than the claim.
 */
/*
 * Read with the whitespace flattened.
 *
 * These sentences live in JSX and in block comments, so where a line breaks is
 * the formatter's business and not the claim's. A probe that matched the line
 * breaks would go red on a reflow and pass on a rewrite, which is backwards.
 */
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\s+/g, ' ');

const CONNECT = read('./Connect.tsx');
const COURSES = read('./Courses.tsx');
const LIB = read('../lib/connect.ts');
const CONTROL = read('../lib/guidebook.ts');

/** Every file that describes the Brightspace route to a student. */
const CLAIMING = { 'screens/Connect.tsx': CONNECT, 'screens/Courses.tsx': COURSES, 'lib/connect.ts': LIB };

describe('what the app says a calendar feed carries', () => {
  it.each(Object.entries(CLAIMING))('does not promise every due date in %s', (_name, text) => {
    expect(text).not.toMatch(/carries every due date/);
  });

  it('says instead what a feed actually holds, and what it does not', () => {
    // Asserted positively so the test cannot be satisfied by deleting the
    // paragraph: an app that says nothing about the gap is not fixed, it is
    // quieter.
    expect(CONNECT).toMatch(/not always everything on the syllabus/);
    expect(CONNECT).toMatch(/never says whether you have submitted/);
  });
});

describe('what the app says about grades and submissions', () => {
  it.each(Object.entries(CLAIMING))('does not call richer access impossible in %s', (_name, text) => {
    expect(text).not.toMatch(/however it asks/);
    expect(text).not.toMatch(/no matter how it asks/);
  });

  it('names the missing thing as a permission nobody has asked for', () => {
    expect(CONNECT).toMatch(/registering the app and granting the scopes/);
    expect(COURSES).toMatch(/D2L \* documents registered applications and scopes/);
  });

  it('still tells the student the answer today is no', () => {
    // The correction must not become an implied promise. What is true today
    // is that these are not available, and the screen has to keep saying so.
    expect(CONNECT).toMatch(/no app you install can read them on your own say-so/);
    expect(COURSES).toMatch(/today the honest \* answer is no/);
  });
});

describe('the control', () => {
  it('is a file about what the app asks of you, which makes no Brightspace claim', () => {
    // If this ever matches, the probe above is matching prose rather than the
    // claim, and its clean readings on the other three mean nothing.
    expect(CONTROL).not.toMatch(/carries every due date/);
    expect(CONTROL).not.toMatch(/Valence/);
  });
});

/**
 * The fourth place, which survived the pass that found the other three.
 *
 * Settings › About draws `SOURCES` under the header *Where the numbers come
 * from*, which is the app's own promise about provenance. The list shipped
 * out of the design comp, where four plausible connected accounts are exactly
 * what a mockup should have, and three of its four rows named something this
 * repository does not do:
 *
 *  · Brightspace, “4 courses · synced 6:40 AM · On” — the route is a
 *    read-only .ics feed the student pastes. Nothing syncs on a clock.
 *  · Gradescope, “On” — the word exists nowhere in `app/src` outside sample
 *    course data.
 *  · Apple Calendar, “Two-way” — `lib/connect.ts` says “Apple — sign-in
 *    only. There is no iCloud calendar API”.
 *
 * The prose probes above could not reach it because it is **data**, not a
 * sentence, and that is the only reason it lasted. So this one reads the data.
 *
 * The fourth row was Top Hat, with a join code beside it. Top Hat's only
 * integration surface is LTI, which joins it to an institution's LMS; there is
 * no public API and no student export, so a join code next to three sources
 * marked *On* is the one claim here that could never come true.
 */
const SYNC_CLAIM = /\bsynced?\b|\bsyncing\b|\btwo-way\b/i;

/** Systems the app has no route to, in any file outside sample course data. */
const NO_ROUTE = /\bGradescope\b/i;

const oversold = (row: { label: string; meta: string; state: string }) =>
  SYNC_CLAIM.test(`${row.label} ${row.meta} ${row.state}`) ||
  NO_ROUTE.test(`${row.label} ${row.meta}`);

describe('what the source list claims the app is connected to', () => {
  it.each(SOURCES.map((s) => [s.label, s] as const))(
    'claims no background sync and no system without a route: %s',
    (_label, row) => {
      expect(oversold(row)).toBe(false);
    },
  );

  it('says Top Hat is not connected, rather than printing a join code', () => {
    // Asserted positively so the test cannot be satisfied by deleting the row.
    // Dropping Top Hat would leave a student who has a Top Hat grade category
    // — two of the four shipped courses do — with no answer at all.
    const tophat = SOURCES.find((s) => /top hat/i.test(s.label));
    expect(tophat).toBeDefined();
    expect(`${tophat?.meta} ${tophat?.state}`).toMatch(/not connected/i);
    expect(`${tophat?.meta} ${tophat?.state}`).not.toMatch(/\bjoin code\b/i);
  });
});

describe('the control on the source-list probe', () => {
  /**
   * The list as it shipped. A probe that convicts nothing is indistinguishable
   * from a broken one, so the thing it is supposed to catch is kept here and
   * run through it — which is the revert-and-watch-it-go-red check of
   * `CLAUDE.md`, made permanent instead of done once by hand.
   */
  const AS_SHIPPED = [
    { label: 'Brightspace', meta: '4 courses · synced 6:40 AM', state: 'On' },
    { label: 'Gradescope', meta: 'ECON 1020 problem sets', state: 'On' },
    { label: 'Apple Calendar', meta: 'Two-way, “Fall 2026” calendar', state: 'On' },
  ];

  it.each(AS_SHIPPED.map((s) => [s.label, s] as const))(
    'catches the row it was written for: %s',
    (_label, row) => {
      expect(oversold(row)).toBe(true);
    },
  );

  it('does not simply reject every row, including ones that are real', () => {
    // Canvas is a genuine connection — `lib/canvas.ts`, a token the student
    // issues. A probe that flagged it too would be matching the shape of a
    // source row rather than the claim.
    expect(
      oversold({
        label: 'Canvas',
        meta: 'A token you issue yourself — assignments, and your own submissions',
        state: 'Token',
      }),
    ).toBe(false);
  });
});
