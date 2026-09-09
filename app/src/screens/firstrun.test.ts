import { describe, expect, it } from 'vitest';
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
    for (const g of gates.filter((g) => g.showsOwn)) {
      expect(g.line, `${g.file} shows tasks or appointments and must gate on nothingYet`).toContain(
        'nothingYet(',
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
