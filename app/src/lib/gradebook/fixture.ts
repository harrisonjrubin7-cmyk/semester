/**
 * A small course for the gradebook's tests: two instructors, a TA, the
 * registrar, two enrolled students and one who is enrolled somewhere else.
 * The same people `supabase/gradebook.check.sql` makes, so the two suites
 * describe one course.
 */
import type { Actor, Gradebook, Scheme } from './model';

export const PROF: Actor = { id: 'prof', capabilities: ['grades:enter', 'grades:moderate', 'grades:release', 'grades:export'] };
export const TA: Actor = { id: 'ta', capabilities: ['grades:enter'] };
/** A second instructor on the course: who moderates another grader's grades. */
export const SECOND: Actor = { id: 'second', capabilities: PROF.capabilities };
export const REGISTRAR: Actor = { id: 'registrar', capabilities: ['grades:export'] };
/** Faculty on another course: no capability here at all. */
export const OTHER_PROF: Actor = { id: 'other-prof', capabilities: [] };
export const ANA: Actor = { id: 'ana', capabilities: [] };
export const BEN: Actor = { id: 'ben', capabilities: [] };
/** Enrolled in another course, not this one. */
export const CAL: Actor = { id: 'cal', capabilities: [] };

export const SCHEME: Scheme = {
  categories: [
    { key: 'problem-sets', name: 'Problem sets', weight: 40, dropLowest: 1 },
    { key: 'exams', name: 'Exams', weight: 60, dropLowest: 0 },
  ],
  letters: [
    { letter: 'A', min: 90 },
    { letter: 'B', min: 80 },
    { letter: 'C', min: 70 },
    { letter: 'D', min: 60 },
    { letter: 'F', min: 0 },
  ],
  moderationRequired: false,
};

export function course(over: Partial<Gradebook> = {}): Gradebook {
  return {
    course: 'ECON 1020',
    term: '2026FA',
    scheme: SCHEME,
    items: [
      { id: 'ps1', categoryKey: 'problem-sets', title: 'Problem set 1', pointsPossible: 10, lineItem: 'lti:ps1' },
      { id: 'ps2', categoryKey: 'problem-sets', title: 'Problem set 2', pointsPossible: 10, lineItem: 'lti:ps2' },
      { id: 'ps3', categoryKey: 'problem-sets', title: 'Problem set 3', pointsPossible: 10, lineItem: null },
      { id: 'mid', categoryKey: 'exams', title: 'Midterm', pointsPossible: 100, lineItem: 'lti:mid' },
    ],
    roster: new Set([ANA.id, BEN.id]),
    entries: [],
    regrades: [],
    resolutions: [],
    operations: {},
    ...over,
  };
}

export const AT = '2026-10-01T15:00:00.000Z';
