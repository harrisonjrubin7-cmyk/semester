import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

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
