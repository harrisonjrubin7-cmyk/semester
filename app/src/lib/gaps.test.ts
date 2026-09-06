import { describe, expect, it } from 'vitest';
import { findGaps, subjectOf } from './gaps';
import BUS from '../data/courses/bus';
import ECON from '../data/courses/econ';
import type { CourseModule, CourseUpdate } from './types';

/**
 * What a course is still missing.
 *
 * The measure of this file is not how much it finds. It is how little of what
 * it finds is noise: a checklist with four false rows is a checklist somebody
 * closes, and then the one real row goes unread. So most of what is tested
 * here is what it declines to say.
 *
 * Run against the two real courses, because the first version passed every
 * fixture and produced twelve rows on BUS 1600, eight of them meaningless.
 */

const empty = (over: Partial<CourseUpdate> = {}): CourseUpdate => ({
  id: 'u1',
  courseId: BUS.course.id,
  unit: null,
  title: '',
  source: '',
  body: '',
  cards: [],
  terms: [],
  fileIds: [],
  created: 0,
  ...over,
});

describe('what a graded item is about', () => {
  it('finds the thing named after a dash', () => {
    expect(subjectOf('Group Assignment 1 — ECOALF case')).toBe('ECOALF case');
    expect(subjectOf('Read the Simply Good Jars case')).toBe('Simply Good Jars case');
  });

  it('does not split a hyphenated word', () => {
    // "Midterm case write-up — Opera Philadelphia" gave "up — Opera
    // Philadelphia" until the dash had to be an em dash or spaced.
    expect(subjectOf('Midterm case write-up — Opera Philadelphia')).toBe('Opera Philadelphia');
  });

  it('says nothing about a generic assessment', () => {
    /*
     * The failure that made the first version useless. "Midterm 1" will never
     * be mentioned in a card, because the material for a midterm is the units
     * it covers rather than its name — so asking whether the material mentions
     * it flagged every exam on every course.
     */
    for (const title of ['Midterm 1', 'Problem Set 3', 'Final exam', 'Group Assignment 2']) {
      expect(subjectOf(title), title).toBe('');
    }
  });

  it('says nothing about a logistics note', () => {
    // These name something after a dash and none of it is material.
    for (const title of [
      'SONA session 1 — last day of window 1',
      'Final exam — 40 MC + 10 short answer',
      'Group Assignment 2 — in class',
    ]) {
      expect(subjectOf(title), title).toBe('');
    }
  });
});

describe('against the real courses', () => {
  it('finds the four cases BUS 1600 grades and does not cover', () => {
    const gaps = findGaps(BUS, []);
    expect(gaps).toHaveLength(4);
    expect(gaps.map((g) => g.says).join(' ')).toContain('ECOALF case');
    expect(gaps.map((g) => g.says).join(' ')).toContain('Simply Good Jars case');
    for (const g of gaps) expect(g.kind).toBe('graded-no-material');
  });

  it('says nothing at all about ECON 1020', () => {
    // Its units all have cards and its graded items are generic exams. A row
    // here would be a row somebody has to learn to ignore.
    expect(findGaps(ECON, [])).toEqual([]);
  });

  it('stays quiet once the material is added', () => {
    const covered = findGaps(BUS, [
      empty({
        title: 'ECOALF case',
        cards: [{ q: 'What did ECOALF do?', a: 'Recycled ocean plastic into a premium brand.' }],
      }),
    ]);
    expect(covered.length).toBe(3);
    expect(covered.map((g) => g.says).join(' ')).not.toContain('ECOALF');
  });
});

describe('a unit with nothing to study from', () => {
  const bare = (): CourseModule => ({
    ...BUS,
    guide: {
      ...BUS.guide,
      units: [
        { name: 'Full', mastery: 0, cards: [{ q: 'q', a: 'a' }] },
        { name: 'Empty', mastery: 0, cards: [] },
      ],
    },
    items: [],
  });

  it('names it', () => {
    const gaps = findGaps(bare(), []);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].says).toBe('Empty has no cards.');
    expect(gaps[0].action.screen).toBe('update');
  });

  it('counts cards added since the import, so it is not reported twice', () => {
    // A unit filled in by a slide deck in week seven is not empty, and saying
    // it is would send somebody to fill it again.
    const gaps = findGaps(bare(), [empty({ unit: 1, cards: [{ q: 'q', a: 'a' }] })]);
    expect(gaps).toEqual([]);
  });
});

describe('ordering and silence', () => {
  it('puts what carries a weight above what does not', () => {
    const mixed: CourseModule = {
      ...BUS,
      guide: { ...BUS.guide, units: [{ name: 'Empty', mastery: 0, cards: [] }] },
    };
    const gaps = findGaps(mixed, []);
    expect(gaps[0].kind).toBe('graded-no-material');
    expect(gaps.some((g) => g.kind === 'unit-no-cards')).toBe(true);
  });

  it('returns nothing rather than a row saying there is nothing', () => {
    // No "all clear" card. A screen with nothing to say shows nothing.
    expect(findGaps({ ...BUS, guide: { ...BUS.guide, units: [] }, items: [] }, [])).toEqual([]);
  });

  it('ignores another course’s added material', () => {
    const gaps = findGaps(BUS, [empty({ courseId: 'econ', title: 'ECOALF case' })]);
    expect(gaps).toHaveLength(4);
  });
});
