/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RESPONSE_TOOLS, noteFor, toolIn, type ResponseTool } from './clicker';
import { SOURCES } from '../data/misc';
import econ from '../data/courses/econ';
import psci from '../data/courses/psci';
import core from '../data/courses/core';
import bus from '../data/courses/bus';

/**
 * The tools this app names, and the row that has to name them.
 *
 * Two halves, and the tests are about keeping them apart. The parser
 * recognises none of these words and must go on recognising none — that is
 * `TOPHAT.md`'s argument and `lib/clicker.ts`'s header. The **disclosure** must
 * name them all, because its whole job is to be found by somebody looking for
 * the word on their own screen.
 *
 * The assertion that ties the two together reads the shipped course data: every
 * response tool a shipped syllabus actually mentions has to be named in the
 * source list. A course added tomorrow with an iClicker category makes that go
 * red, which is the day the answer needs to be there.
 */

const GUIDES = [econ, psci, core, bus];

/** Every grading category across the shipped courses. */
const categories = GUIDES.flatMap((m) =>
  m.course.grading.map((g) => ({ code: m.course.code, what: g.what })),
);

/** The source row that explains a clicker. */
const row = SOURCES.find((s) => /top hat/i.test(s.label));

describe('reading a tool out of a category name', () => {
  it('finds each one written the way a syllabus writes it', () => {
    expect(toolIn('Top Hat participation')).toBe('Top Hat');
    expect(toolIn('Attendance (Top Hat 782449)')).toBe('Top Hat');
    expect(toolIn('iClicker points')).toBe('iClicker');
    expect(toolIn('Poll Everywhere participation')).toBe('Poll Everywhere');
  });

  /*
   * A syllabus writes `iClicker`, `i>clicker`, `IClicker` and `i clicker`
   * about equally often, and all four are the same tool. Matched on letters
   * alone, which is the loosest rule that cannot reach a different product.
   */
  it('reads the spellings of iClicker as one tool', () => {
    for (const spelling of ['iClicker', 'i>clicker', 'IClicker', 'i clicker', 'I-Clicker']) {
      expect(toolIn(`${spelling} participation`), spelling).toBe('iClicker');
    }
    expect(toolIn('TopHat attendance')).toBe('Top Hat');
    expect(toolIn('poll everywhere')).toBe('Poll Everywhere');
  });

  /*
   * The control, and the one that matters: a category naming no tool gets no
   * note. A rule matching `clicker` on its own would claim "clicker questions"
   * is iClicker, which is a guess about a course this app has not read — and
   * the note it produced would tell a student to go and look somewhere that
   * does not exist.
   */
  it('says nothing about a category that names no tool', () => {
    for (const what of [
      'Problem sets (lowest dropped)',
      'Attendance',
      'Attendance — 2 free absences',
      'Clicker questions',
      'Six quizzes, 5% each',
      'SONA research participation',
      'Final exam',
      '',
    ]) {
      expect(toolIn(what), what).toBeNull();
    }
  });

  it('gives every tool a note that names it and refuses the connection', () => {
    for (const tool of RESPONSE_TOOLS) {
      const note = noteFor(tool);
      expect(note, tool).toContain(tool);
      expect(note, tool).toMatch(/no app can read it/i);
      // Not "yet", and not "coming": there is no route to earn here, and
      // implying one is the mistake `TOPHAT.md` opens by quoting.
      expect(note, tool).not.toMatch(/\b(yet|soon|coming|connect your)\b/i);
    }
  });
});

describe('the row that has to be found', () => {
  it('control: the source list is there, and so is the clicker row', () => {
    // A missing row would make every assertion below vacuous, and deleting the
    // row is the way this test is most easily satisfied by accident.
    expect(SOURCES.length).toBeGreaterThan(3);
    expect(row).toBeDefined();
  });

  /*
   * Every tool in the vocabulary, named in the row.
   *
   * This is the coupling the change is for. The row shipped saying `Top Hat`
   * alone, and a student whose course uses iClicker read the same list and
   * found no answer — so adding a tool to `RESPONSE_TOOLS` without adding it
   * here would recreate exactly that, quietly, for the next tool.
   */
  it('names every tool the app knows about', () => {
    const text = `${row?.label} ${row?.meta}`;
    for (const tool of RESPONSE_TOOLS) {
      expect(text, `the source row does not name ${tool}`).toContain(tool);
    }
  });

  /*
   * And the tools the shipped syllabi actually mention, which is the half
   * derived from data rather than from the list. A course added with a
   * Mentimeter category makes this go red before a student ever meets it.
   */
  it('names every tool a shipped course’s grading table mentions', () => {
    const named = new Set<ResponseTool>();
    for (const { what } of categories) {
      const tool = toolIn(what);
      if (tool) named.add(tool);
    }
    // The control: the shipped decks really do carry one, so this is a
    // measurement rather than an empty loop. Both Top Hat courses, as
    // `TOPHAT.md` records.
    expect([...named]).toEqual(['Top Hat']);

    const text = `${row?.label} ${row?.meta}`;
    for (const tool of named) expect(text).toContain(tool);
  });

  it('still refuses to claim the connection, for all of them', () => {
    const text = `${row?.meta} ${row?.state}`;
    expect(text).toMatch(/not connected/i);
    expect(text).not.toMatch(/\bjoin code\b/i);
    expect(text).not.toMatch(/\bsynced?\b|\btwo-way\b|\bon\b(?!e)/i);
  });
});

describe('what is deliberately not built', () => {
  /*
   * The parser has no vocabulary and must not grow one. This asserts it from
   * the outside: none of the tool names appears in the files that decide what
   * a grading row *is*, so a category named for a tool nobody taught the app
   * still arrives. `lib/clicker.ts`'s header has the argument; this is the
   * thing that notices if somebody acts against it.
   *
   * Read as text rather than by calling anything, because the fault would be a
   * new branch rather than a wrong answer, and a test that exercised the
   * parser would have to guess which category it had learned to drop.
   */
  it('keeps the tool names out of the parsing', () => {
    const files = ['generate.ts', 'harvest.ts', 'grades.ts'];
    for (const file of files) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      // The control first: the file is the one being checked.
      expect(source.length, file).toBeGreaterThan(1_000);
      for (const tool of RESPONSE_TOOLS) {
        expect(source, `${file} has learned the name ${tool}`).not.toContain(tool);
      }
    }
  });
});
