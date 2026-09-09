import { describe, expect, it } from 'vitest';
import { nothingOnToday } from './Today';
import { EMPTY_CATALOG, buildCatalog } from '../data/catalog';
import ECON from '../data/courses/econ';
import type { PersonalTask } from '../lib/types';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * "Nothing yet", on the screens where that can be untrue.
 *
 * Seven screens answer an empty app with `FirstRun`, and all seven asked the
 * same question: `catalog.empty`. On five that is the right question — Courses,
 * Study, Behind, Tonight and Meet are about graded coursework, and there is no
 * such thing without a syllabus. On the two that also show what the student put
 * in themselves it was the wrong one.
 *
 * Measured, with no courses and one task and one appointment dated today: the
 * calendar said "Nothing on the calendar yet" and Today said "Nothing on today
 * yet". Both entries were made through this app's own screens, both were dated,
 * and only Personal would show them.
 *
 * ## What this test can and cannot do
 *
 * It cannot open a screen — a browser did that, for a fresh install, for a task,
 * an appointment and a connected-calendar entry one at a time, and for the
 * shipped semester as the control. What it can do is hold the pairing, which is
 * the part that rots: a screen that grows a personal list and keeps the old
 * question looks completely correct and tells somebody there is nothing there.
 */

const DIR = new URL('.', import.meta.url);
const OWN = /state\.(tasks|appointments|feedEvents)\b/;

/** Every screen that answers an empty app with `FirstRun`, and how it asks. */
const gates = readdirSync(DIR)
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => ({ file: f, src: readFileSync(new URL(f, DIR), 'utf8') }))
  .flatMap(({ file, src }) =>
    src
      .split('\n')
      .filter((line) => line.includes('return <FirstRun'))
      .map((line) => ({ file, line, showsOwn: OWN.test(src) })),
  );

describe('the FirstRun gate', () => {
  it('is on the screens it is supposed to be on', () => {
    // The slice above found something to check, and the shape has not moved.
    expect(gates.length).toBeGreaterThan(4);
    expect(gates.filter((g) => g.showsOwn).map((g) => g.file).sort()).toEqual([
      'Calendar.tsx',
      'Today.tsx',
    ]);
  });

  it('asks about the student’s own entries wherever the screen shows them', () => {
    // `nothingOnToday` on Today rather than `nothingYet` directly: that screen
    // has two shapes and only one of them can draw a task. See the describe
    // below, and the note on the function itself.
    for (const g of gates.filter((g) => g.showsOwn)) {
      expect(g.line, `${g.file} shows tasks or appointments and must ask about them`).toMatch(
        /nothingYet\(|nothingOnToday\(/,
      );
    }
  });

  it('leaves the coursework screens asking the simpler question', () => {
    // Not a style rule: `nothingYet` on Tonight would put somebody with one
    // task in front of a ranking of graded work with nothing in it.
    for (const g of gates.filter((g) => !g.showsOwn)) {
      expect(g.line, `${g.file} has no personal list, so catalog.empty is the whole test`).toContain(
        'catalog.empty',
      );
    }
  });
});

describe('which Today is being gated', () => {
  const none = { tasks: [], appointments: [], feedEvents: [] };
  const withTask = {
    ...none,
    tasks: [
      { id: 't', title: 't', date: '2026-09-09', time: '', note: '', done: false, created: 0, courseId: null },
    ] as PersonalTask[],
  };
  const CAT = buildCatalog([ECON]);

  /*
   * `TabHome` draws the student's own tasks and appointments in sections of
   * their own. `FeedHome` is one list built from `feed(catalog, …)`, which
   * reads classes and deadlines and nothing else.
   *
   * Measured under all four navigations with one task, one appointment and no
   * courses: tabs, springboard and shelves each showed both, and feed showed
   * "WED · SEP 9 Today ALL DUE CLASSES" and nothing else — a header, three
   * chips and an empty screen, which is worse than the first-run screen it
   * had replaced. Found by a review bot, on the one navigation of four that
   * the browser sweep for this change had not been run under.
   */
  // The shapes are `today`, `feed` and `springboard` — `tabs` and `shelves`
  // are navigations, and both map to `today`. Written as 'tabs' first, which
  // vitest ran green because it does not typecheck; tsc is what said so.
  it('lets a task through on the Today that can draw one', () => {
    expect(nothingOnToday('today', EMPTY_CATALOG, withTask)).toBe(false);
    expect(nothingOnToday('springboard', EMPTY_CATALOG, withTask)).toBe(false);
  });

  it('does not, on the feed, which cannot', () => {
    expect(nothingOnToday('feed', EMPTY_CATALOG, withTask)).toBe(true);
  });

  it('agrees with itself once there is a syllabus', () => {
    expect(nothingOnToday('feed', CAT, none)).toBe(false);
    expect(nothingOnToday('today', CAT, none)).toBe(false);
  });

  it('shows the first run to somebody who has nothing at all', () => {
    expect(nothingOnToday('today', EMPTY_CATALOG, none)).toBe(true);
    expect(nothingOnToday('feed', EMPTY_CATALOG, none)).toBe(true);
  });
});
