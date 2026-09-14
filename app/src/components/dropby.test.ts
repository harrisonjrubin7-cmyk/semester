import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * "Office hours worth going to" says something about office hours.
 *
 * The file's own doc comment promised it: "Where the course has office hours
 * recorded it names the next one. Where it does not, it says so and offers
 * the editor, because 'they are on your syllabus and the app does not have
 * them' is the more useful sentence in that case than silence."
 *
 * The saying-so and the offering were one branch, gated on the course being
 * one you added. So for the semester the app ships with — which is what every
 * new student sees first — a section under that heading named a course, said
 * what had gone wrong, and never mentioned an office hour at all. Measured on
 * the deployed build, a card read in full: "BUS 1600. 3 deadlines went by
 * unticked in the last three weeks. Or write to Dr. Eric Hogue first."
 *
 * Checked by reading the file. The failure is a branch that renders null: it
 * throws nothing, types fine, and shows up only as an absence on a screen
 * nobody re-reads once it works for their own courses.
 */
const SOURCE = readFileSync(new URL('./DropBy.tsx', import.meta.url), 'utf8');

describe('a course with no office hours recorded', () => {
  it('is told so whether or not it is one of yours', () => {
    // The sentence must not sit inside a `yours ?` branch. Both wordings are
    // reached from the same else, with `yours` choosing between them rather
    // than deciding whether anything is said.
    const said = SOURCE.indexOf('does not have this course');
    expect(said).toBeGreaterThan(0);
    const gate = SOURCE.lastIndexOf(') : yours ? (', said);
    expect(gate, 'the sentence is gated on the course being yours again').toBe(-1);
  });

  it('says it two ways, because the reason differs', () => {
    // Yours: it is on your syllabus and you can add it. The app's own: there
    // is no syllabus behind it, so "add them" would be a dead end.
    expect(SOURCE).toContain('They are on the syllabus');
    expect(SOURCE).toContain('no syllabus behind it');
  });

  it('offers the editor only for a course that can be edited', () => {
    const add = SOURCE.indexOf('Add them');
    expect(add).toBeGreaterThan(0);
    const before = SOURCE.slice(Math.max(0, add - 700), add);
    expect(before).toContain('{yours ? (');
  });
});
