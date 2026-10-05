import { describe, expect, it } from 'vitest';
import type { Commitment } from './activities';
import type { Opportunity } from './career';
import {
  EMPTY_SHORTLIST,
  MAX_COMPARE,
  careerDirections,
  catalogAge,
  describedSkills,
  liveShortlist,
  planImpact,
  readRequisites,
  readShortlist,
  relatedFuture,
  requirementFit,
  requisites,
  scheduleFit,
  seatLine,
  tidyCode,
  toggleCompare,
  toggleSaved,
  whyItMayFit,
} from './course-detail';
import type { Requirement, Taken } from './degree';
import { parseCatalog, type CatalogCourse } from './registration';

/**
 * Phase F's model: reading prerequisites against the student's records,
 * requirement and schedule fit, plan impact, related courses, skills from
 * the description, the catalog's age, and the saved-course shortlist.
 */

const course = (over: Partial<CatalogCourse>): CatalogCourse => ({
  id: 'x',
  code: 'ECON 2010',
  section: '01',
  title: 'Intermediate Micro',
  term: 'Spring 2027',
  department: 'ECON',
  credits: 3,
  instructor: '',
  location: '',
  description: '',
  prerequisites: '',
  seats: null,
  meetings: [{ days: [1, 3], start: 9 * 60, end: 10 * 60 + 15 }],
  ...over,
});

const taken = (code: string, current = false): Taken => ({ id: code, code, title: code, term: 'Fall 2026', hours: 3, grade: current ? '' : 'A', current });

const req = (over: Partial<Requirement>): Requirement => ({
  id: 'r',
  programme: 'Economics major',
  name: 'Core theory',
  need: 'courses',
  count: 2,
  accepts: ['ECON 2010', 'ECON 2020'],
  note: '',
  ...over,
});

describe('prerequisites', () => {
  it('reads course codes, and splits corequisites off', () => {
    expect(readRequisites('ECON 1010 and MATH-1100, or instructor consent. Corequisite: ECON 2015')).toEqual({
      prerequisites: ['ECON 1010', 'MATH 1100'],
      corequisites: ['ECON 2015'],
    });
    expect(tidyCode('econ-1010')).toBe('ECON 1010');
  });

  it('compares each with what the student recorded, and never says eligible', () => {
    const c = course({ prerequisites: 'ECON 1010, MATH 1100 and STAT 1010. Taken with ECON 2015 or ECON 2016' });
    const r = requisites(c, [taken('ECON 1010'), taken('MATH 1100', true)], [course({ id: 'y', code: 'ECON 2015' })]);
    expect(r.items.map((i) => [i.code, i.kind, i.state])).toEqual([
      ['ECON 1010', 'prerequisite', 'recorded'],
      ['MATH 1100', 'prerequisite', 'in_progress'],
      ['STAT 1010', 'prerequisite', 'not_recorded'],
      ['ECON 2015', 'corequisite', 'in_cart'],
      ['ECON 2016', 'corequisite', 'not_recorded'],
    ]);
    expect(r.items[2].says).toContain('Check with the department');
    expect(JSON.stringify(r)).not.toMatch(/eligible|you can enroll|you may enroll/i);
    expect(r.unread).toBe(false);
  });

  it('reads codes written in any case, as the same course', () => {
    expect(readRequisites('Econ 1010 and math-1100').prerequisites).toEqual(['ECON 1010', 'MATH 1100']);
  });

  it('does not read ordinary words before a number as a department (the control)', () => {
    expect(readRequisites('ECON 1010 or 1020; any 3000 level course').prerequisites).toEqual(['ECON 1010']);
  });

  it('says when the wording holds conditions it cannot read', () => {
    expect(requisites(course({ prerequisites: 'ECON 1010 or consent of instructor; junior standing' }), [], []).unread).toBe(true);
    expect(requisites(course({ prerequisites: 'None stated' }), [], []).unread).toBe(false);
  });
});

describe('requirement fit', () => {
  it('lists requirements that accept the course and still need something, electives last', () => {
    const reqs = [
      req({ id: 'elective', name: 'Free electives', accepts: [], count: 30, need: 'hours' }),
      req({ id: 'core' }),
      req({ id: 'done', name: 'Intro', accepts: ['ECON'], count: 1 }),
      req({ id: 'other', name: 'Math', accepts: ['MATH'] }),
    ];
    const fit = requirementFit(course({}), reqs, [taken('ECON 1010')]);
    expect(fit.map((f) => [f.requirement.id, f.left, f.unit, f.elective])).toEqual([
      ['core', 2, 'courses', false],
      ['elective', 27, 'credit hours', true],
    ]);
  });
});

describe('schedule fit', () => {
  const job: Commitment = { id: 'j', name: 'Library desk', kind: 'job', role: '', where: '', url: '', note: '', days: [3], at: 10 * 60, minutes: 120, hours: 0, active: true, created: 0 };

  it('finds overlaps with the cart and with timed commitments, with their sources', () => {
    const clash = course({ id: 'b', code: 'PSCI 1100', meetings: [{ days: [1], start: 9 * 60 + 30, end: 10 * 60 + 45 }] });
    const found = scheduleFit(course({}), [clash], [job]);
    expect(found.map((c) => [c.with, c.day, c.source])).toEqual([
      ['PSCI 1100 (in your cart)', 1, 'imported'],
      ['Library desk', 3, 'student_entered'],
    ]);
  });

  it('names the meeting that actually overlaps when a section meets twice a day', () => {
    const twice = course({ meetings: [{ days: [1], start: 9 * 60, end: 10 * 60 }, { days: [1], start: 14 * 60, end: 15 * 60 }] });
    const clash = course({ id: 'b', code: 'PSCI 1100', meetings: [{ days: [1], start: 14 * 60 + 30, end: 15 * 60 + 30 }] });
    expect(scheduleFit(twice, [clash], []).map((c) => [c.day, c.from, c.to])).toEqual([[1, 14 * 60, 15 * 60]]);
  });

  it('ignores another section of the same course, which is a swap, not a clash', () => {
    const other = course({ id: 'b', section: '02' });
    expect(scheduleFit(course({}), [other], [])).toEqual([]);
  });
});

describe('plan impact', () => {
  it('says the credits before and after, against the target', () => {
    const cart = [course({ id: 'a', code: 'A 1000', credits: 12 })];
    expect(planImpact(course({}), cart, 15).says).toBe('Your cart goes from 12 to 15 credits. That matches your target of 15.');
    expect(planImpact(course({ credits: 4 }), cart, 15).says).toContain('1 over your target of 15');
    expect(planImpact(course({}), cart, null).says).toBe('Your cart goes from 12 to 15 credits.');
  });

  it('warns when another section of the same course is in the cart', () => {
    const impact = planImpact(course({}), [course({ id: 'b', section: '02' })], 15);
    expect(impact.sameCourse?.section).toBe('02');
    expect(impact.says).toContain('would count it twice');
  });
});

describe('related future courses', () => {
  it('are the catalog courses that list this one as a prerequisite, once per code', () => {
    const catalog = [
      course({}),
      course({ id: 'n1', code: 'ECON 3010', prerequisites: 'ECON 2010' }),
      course({ id: 'n2', code: 'ECON 3010', section: '02', prerequisites: 'ECON 2010' }),
      course({ id: 'n3', code: 'ECON 3050', prerequisites: 'ECON-2010 and MATH 1100' }),
      course({ id: 'n4', code: 'HIST 3000', prerequisites: 'ECON 2020' }),
    ];
    expect(relatedFuture(course({}), catalog).map((c) => c.code)).toEqual(['ECON 3010', 'ECON 3050']);
  });
});

describe('skills and career directions', () => {
  it('reads skills only from the description’s own words', () => {
    expect(describedSkills(course({ description: 'Regression and statistics in Stata; a written research brief.' }))).toEqual(
      expect.arrayContaining(['Data analysis', 'Writing', 'Research']),
    );
    expect(describedSkills(course({ description: '' }))).toEqual([]);
  });

  it('names only opportunities the student saved', () => {
    const saved = [
      { title: 'Research assistant', organization: 'Econ lab', skills: 'Data analysis, Stata', description: '', requirements: '' },
      { title: 'Barista', organization: 'Café', skills: 'Customer service', description: '', requirements: '' },
    ] as Opportunity[];
    expect(careerDirections(['Data analysis'], saved)).toEqual([{ title: 'Research assistant · Econ lab', skills: ['data analysis'] }]);
    expect(careerDirections(['Data analysis'], [])).toEqual([]);
  });
});

describe('source and freshness', () => {
  it('flags a catalog imported more than two months ago', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    expect(catalogAge('2026-09-01T00:00:00Z', now)).toEqual({ at: Date.parse('2026-09-01T00:00:00Z'), stale: false });
    expect(catalogAge('2026-06-01T00:00:00Z', now).stale).toBe(true);
    expect(catalogAge(null, now)).toEqual({ at: null, stale: false });
  });

  it('never promises a seat', () => {
    expect(seatLine(course({ seats: 12 }))).toBe('12 seats reported in the catalog file when it was imported — not live availability, and not a seat for you.');
    expect(seatLine(course({ seats: null }))).toBe('The catalog file does not give seats.');
  });

  it('keeps only https links from a catalog, and carries the modality', () => {
    const rows = [
      { code: 'A 1000', title: 'A', term: 'T', credits: 3, url: 'https://catalog.example.edu/a', modality: 'Hybrid' },
      { code: 'B 1000', title: 'B', term: 'T', credits: 3, url: 'javascript:alert(1)' },
      { code: 'C 1000', title: 'C', term: 'T', credits: 3, url: 'http://catalog.example.edu/c' },
    ];
    const [a, b, c] = parseCatalog(JSON.stringify({ courses: rows })).courses;
    expect([a.url, a.modality]).toEqual(['https://catalog.example.edu/a', 'Hybrid']);
    expect(b.url).toBeUndefined();
    expect(c.url).toBeUndefined();
  });
});

describe('why it may fit', () => {
  it('gives reasons from the facts, says what it cannot know, and promises nothing', () => {
    const c = course({ prerequisites: 'ECON 1010' });
    const cart: CatalogCourse[] = [];
    const reqs = requisites(c, [taken('ECON 1010')], cart);
    const fit = requirementFit(c, [req({})], []);
    const why = whyItMayFit({ course: c, fit, reqs, clashes: [], impact: planImpact(c, cart, 15) });
    expect(why.reasons).toEqual([
      'It may count toward Economics major: Core theory, where 2 courses are still needed.',
      'Its meeting times do not overlap your cart or your timed commitments.',
      'Every course its prerequisites name is in what you have recorded.',
      'It keeps your cart at or under your 15-credit target.',
    ]);
    expect(why.limitations.join(' ')).toContain('Only your school’s degree audit decides');
    expect(JSON.stringify(why)).not.toMatch(/guarantee|will count|eligible|easy A|workload is|rating/i);
  });
});

describe('the shortlist', () => {
  it('saves, compares up to three saved courses, and forgets a comparison when unsaved', () => {
    let l = EMPTY_SHORTLIST;
    l = toggleCompare(l, 'a');
    expect(l.compare).toEqual([]);
    for (const id of ['a', 'b', 'c', 'd']) l = toggleCompare(toggleSaved(l, id), id);
    expect(l.compare).toHaveLength(MAX_COMPARE);
    l = toggleSaved(l, 'a');
    expect(l).toEqual({ saved: ['b', 'c', 'd'], compare: ['b', 'c'] });
  });

  it('reads what it wrote, and refuses anything else', () => {
    expect(readShortlist({ saved: ['a', 'b'], compare: ['b', 'z'] })).toEqual({ saved: ['a', 'b'], compare: ['b'] });
    expect(() => readShortlist({ saved: [3] })).toThrow();
    expect(() => readShortlist(null)).toThrow();
  });

  it('holds against the catalog on the device: gone or reused ids count for nothing', () => {
    let l = EMPTY_SHORTLIST;
    l = toggleSaved(l, 's1', 'econ-1010');
    l = toggleSaved(l, 's2', 'MATH 1100');
    expect(readShortlist(JSON.parse(JSON.stringify(l)))).toEqual(l);
    // A new school's file: s1 is gone, and s2 now names a different course.
    const next = [{ id: 's2', code: 'HIST 2000' }, { id: 's3', code: 'ECON 1010' }];
    expect(liveShortlist(l, next).saved).toEqual([]);
    // The same catalog keeps both (the control).
    expect(liveShortlist(l, [{ id: 's1', code: 'ECON 1010' }, { id: 's2', code: 'MATH 1100' }]).saved).toEqual(['s1', 's2']);
  });
});
