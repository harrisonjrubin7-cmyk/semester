import { describe, expect, it } from 'vitest';
import { welcomeLead, welcomeLine } from './welcome';
import { buildCatalog, type Catalog } from '../data/catalog';
import type { CourseModule, Item } from './types';

/**
 * The first sentence, and the thing it must never do.
 *
 * The onboarding this replaces told a new account it had found 38 obligations
 * across four courses before anything had been uploaded. Every test here is a
 * way of checking that the sentence is built out of what is actually loaded,
 * and says so plainly when that is nothing.
 */

const NOW = new Date(2026, 8, 7, 9, 0);

function catalogOf(items: Partial<Item>[], courses = 1): Catalog {
  const modules: CourseModule[] = Array.from({ length: courses }, (_, n) => ({
    course: {
      id: `c${n}`,
      code: `SUB ${100 + n}`,
      name: `Course ${n}`,
      term: '2026FA',
      room: '',
      professor: '',
      grading: [],
      credits: 3,
    },
    items: n === 0 ? (items as Item[]) : [],
  })) as unknown as CourseModule[];
  return buildCatalog(modules);
}

const item = (over: Partial<Item>): Partial<Item> => ({
  id: Math.random().toString(36).slice(2),
  c: 'c0',
  title: 'A thing',
  kind: 'reading',
  month: 8,
  day: 20,
  year: 2026,
  dueTime: '',
  weight: '',
  ...over,
});

describe('the opening sentence', () => {
  it('says nothing is loaded when nothing is', () => {
    const said = welcomeLine(buildCatalog([]), NOW);
    expect(said).toBe('Nothing loaded yet. Add a syllabus and the semester comes back.');
    // The thing the old one got wrong: no invented counts.
    expect(said).not.toMatch(/\d/);
  });

  it('counts the courses it has, and no deadlines it has not', () => {
    expect(welcomeLine(catalogOf([]), NOW)).toBe('You have 1 course.');
  });

  it('drops the deadline clause when every date has gone by', () => {
    const past = catalogOf([item({ month: 0, day: 4 })]);
    expect(welcomeLine(past, NOW)).toBe('You have 1 course.');
  });

  it('names the courses and the deadlines ahead', () => {
    const cat = catalogOf([item({ month: 8, day: 20 }), item({ month: 8, day: 25 })], 2);
    expect(welcomeLine(cat, NOW)).toBe('You have 2 courses and 2 deadlines ahead.');
  });

  it('adds the final, and punctuates a three-clause list', () => {
    const cat = catalogOf([
      item({ month: 8, day: 20 }),
      item({ month: 11, day: 12, kind: 'exam', title: 'Final exam' }),
    ]);
    expect(welcomeLine(cat, NOW)).toMatch(
      /^You have 1 course, 2 deadlines ahead, and \d+ days until your first final\.$/,
    );
  });

  it('does not say "1 days", or "in 0 days" on the morning of one', () => {
    const tomorrow = catalogOf([item({ month: 8, day: 8, kind: 'exam', title: 'Final exam' })]);
    expect(welcomeLine(tomorrow, NOW)).toContain('1 day until your first final');

    const today = catalogOf([item({ month: 8, day: 7, kind: 'exam', title: 'Final exam' })]);
    expect(welcomeLine(today, NOW)).toContain('and your first final today');
  });
});

describe('the headline against the cards under it', () => {
  it('says what the smaller of the two counts is counting', () => {
    // The step cards say how many dated obligations were read out of the
    // syllabi — the whole term. This counts what has not gone by. Without the
    // word, "43 deadlines" over "48 dated obligations" reads as an error.
    const cat = catalogOf([item({ month: 0, day: 4 }), item({ month: 8, day: 20 })]);
    expect(welcomeLine(cat, NOW)).toContain('1 deadline ahead');
  });
});

describe('the lead paragraph', () => {
  it('describes what will happen when nothing is loaded, and what did when something is', () => {
    expect(welcomeLead(buildCatalog([]))).toContain('goes in as a PDF');
    expect(welcomeLead(catalogOf([]))).toContain('came out of the PDFs');
  });
});
