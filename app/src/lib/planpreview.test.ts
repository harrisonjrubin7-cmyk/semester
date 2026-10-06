import { describe, expect, it } from 'vitest';
import { coursesForPlan, readPlanDraft, unmatchedNamed } from './planpreview';

describe('readPlanDraft', () => {
  it('reads a term and a list of codes', () => {
    const read = readPlanDraft('Fall 2026', 'econ 1020\nPSCI 1104, math 1300');
    expect(read).toEqual({
      ok: true,
      draft: { term: 'Fall 2026', codes: ['ECON 1020', 'PSCI 1104', 'MATH 1300'] },
    });
  });

  it('asks for a term before it asks for courses', () => {
    expect(readPlanDraft('  ', 'ECON 1020')).toMatchObject({ ok: false, field: 'term' });
  });

  it('refuses a sentence where a code belongs', () => {
    const read = readPlanDraft('Fall 2026', 'my economics class');
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error).toMatch(/ECON 1020/);
  });

  it('drops a repeated code rather than making two courses', () => {
    const read = readPlanDraft('Fall 2026', 'ECON 1020, econ 1020');
    expect(read).toMatchObject({ ok: true, draft: { codes: ['ECON 1020'] } });
  });
});

describe('coursesForPlan', () => {
  it('makes an empty course for each code, tagged with the term', () => {
    const read = readPlanDraft('Fall 2026', 'ECON 1020');
    if (!read.ok) throw new Error('draft');
    const [course] = coursesForPlan(read.draft);
    expect(course.course.code).toBe('ECON 1020');
    expect(course.course.term).toBe('Fall 2026');
    expect(course.course.source).toBe('Added by hand');
    expect(course.items).toEqual([]);
    expect(course.schedule).toEqual([]);
  });

  it('does not reuse an id the catalogue already holds', () => {
    const read = readPlanDraft('Fall 2026', 'ECON 1020, PSCI 1104');
    if (!read.ok) throw new Error('draft');
    const made = coursesForPlan(read.draft, ['econ-1020']);
    expect(made.map((m) => m.course.id)).toEqual(['econ-1020-2', 'psci-1104']);
  });
});

describe('unmatchedNamed', () => {
  const named = [
    { code: 'ECON 1020', term: 'Fall 2026' },
    { code: 'PSCI 1104', term: 'Fall 2026' },
  ];

  it('keeps every named code when the catalog file has no section of that code', () => {
    expect(unmatchedNamed(named, [{ code: 'MATH 1300' }])).toEqual(named);
  });

  it('drops a code once the file contains a section of it, and does not invent a seat', () => {
    const file = [{ code: 'econ  1020', seats: 12 }];
    const left = unmatchedNamed(named, file);
    expect(left).toEqual([{ code: 'PSCI 1104', term: 'Fall 2026' }]);
    expect(JSON.stringify(left)).not.toMatch(/seats|section/);
  });

  it('does not treat a shorter code as the same course', () => {
    expect(unmatchedNamed([{ code: 'ECON 1020', term: null }], [{ code: 'ECON 102' }])).toEqual([
      { code: 'ECON 1020', term: null },
    ]);
  });
});
