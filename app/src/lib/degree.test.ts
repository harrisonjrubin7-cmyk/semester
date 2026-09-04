import { describe, expect, it } from 'vitest';
import {
  COMMON_SCALE,
  accepts,
  countingIn,
  forProgramme,
  gpa,
  gpaLine,
  hours,
  newRequirement,
  newTaken,
  progress,
  progressLine,
  programmes,
  readAccepts,
  readRequirements,
  readTaken,
  rollup,
  rollupLine,
  spare,
  type Requirement,
  type Taken,
} from './degree';

const AT = 1_788_000_000_000;

const course = (patch: Partial<Taken>) => newTaken(patch, AT);
const req = (patch: Partial<Requirement>) => newRequirement(patch, AT);

const TAKEN: Taken[] = [
  course({ code: 'ECON 1010', title: 'Macro', term: 'Spring 2026', hours: 3, grade: 'A-' }),
  course({ code: 'ECON 1020', title: 'Micro', term: 'Fall 2026', hours: 3, current: true }),
  course({ code: 'CORE 2500', title: 'Sports, Culture, and Society', term: 'Fall 2026', hours: 3, current: true }),
  course({ code: 'HIST 1200', title: 'Modern Europe', term: 'Spring 2026', hours: 3, grade: 'B+' }),
];

describe('what a requirement accepts', () => {
  it('takes the codes you listed', () => {
    const r = req({ accepts: ['ECON 1010', 'ECON 1020'] });
    expect(accepts(r, TAKEN[0])).toBe(true);
    expect(accepts(r, TAKEN[3])).toBe(false);
  });

  it('takes a bare department as every course in it', () => {
    // Which is how most distribution blocks are actually written.
    const r = req({ accepts: ['ECON'] });
    expect(accepts(r, TAKEN[0])).toBe(true);
    expect(accepts(r, TAKEN[1])).toBe(true);
    expect(accepts(r, TAKEN[3])).toBe(false);
  });

  it('takes anything when nothing is listed, which is a free elective block', () => {
    expect(accepts(req({ accepts: [] }), TAKEN[3])).toBe(true);
  });

  it('does not care how the code was spaced or cased', () => {
    const r = req({ accepts: ['econ  1010'] });
    expect(accepts(r, course({ code: ' ECON 1010 ' }))).toBe(true);
  });
});

describe('in progress is not done', () => {
  it('counts them separately, always', () => {
    // Rolling them together is how somebody arrives at their last semester one
    // course short.
    const p = progress(req({ accepts: ['ECON'], count: 2 }), TAKEN);
    expect(p.have).toBe(1);
    expect(p.willHave).toBe(2);
    expect(p.met).toBe(false);
    expect(p.meetsAfter).toBe(true);
    expect(p.left).toBe(0);
    expect(progressLine(p)).toContain('this term covers the rest');
  });

  it('calls met only what is finished', () => {
    const p = progress(req({ accepts: ['ECON 1010'], count: 1 }), TAKEN);
    expect(p.met).toBe(true);
    expect(p.meetsAfter).toBe(false);
    expect(progressLine(p)).toContain('Met');
  });

  it('agrees its unit with what is needed, not with what is done', () => {
    // "1 of 2 course" is what pluralising off `have` produced, and the browser
    // showed it where no unit test had.
    const partly = progress(req({ accepts: ['ECON'], count: 2 }), [TAKEN[0]]);
    expect(progressLine(partly)).toContain('1 of 2 courses');
    const one = progress(req({ accepts: ['PSCI'], count: 1 }), TAKEN);
    expect(progressLine(one)).toContain('0 of 1 course.');
  });

  it('says how many are still to find', () => {
    const p = progress(req({ accepts: ['PSCI'], count: 3 }), TAKEN);
    expect(p.left).toBe(3);
    expect(progressLine(p)).toContain('3 to find');
  });

  it('counts hours where a requirement is written in hours', () => {
    const p = progress(req({ need: 'hours', count: 9, accepts: [] }), TAKEN);
    expect(p.have).toBe(6);
    expect(p.willHave).toBe(12);
  });
});

describe('a programme, rolled up', () => {
  const reqs = [
    req({ programme: 'Economics', name: 'Intro', accepts: ['ECON 1010'], count: 1 }),
    req({ programme: 'Economics', name: 'Micro', accepts: ['ECON 1020'], count: 1 }),
    req({ programme: 'Economics', name: 'Electives', accepts: ['ECON'], count: 4 }),
    req({ programme: 'AXLE', name: 'History', accepts: ['HIST'], count: 1 }),
  ];

  it('separates finished from finishing', () => {
    const r = rollup(reqs, TAKEN, 'Economics');
    expect(r.met).toBe(1);
    expect(r.after).toBe(2);
    expect(r.total).toBe(3);
    expect(rollupLine(r)).toContain('1 more finishes if this term goes through');
  });

  it('never states a percentage', () => {
    // "78% of the way through a major" feels like progress and tells nobody
    // which course to register for.
    for (const p of ['Economics', 'AXLE']) {
      expect(rollupLine(rollup(reqs, TAKEN, p))).not.toContain('%');
    }
  });

  it('lists the programmes in the order they were entered', () => {
    expect(programmes(reqs)).toEqual(['Economics', 'AXLE']);
  });

  it('gives every requirement of one programme', () => {
    expect(forProgramme(reqs, TAKEN, 'AXLE')).toHaveLength(1);
  });

  it('has something to say about a programme with nothing in it', () => {
    expect(rollupLine(rollup(reqs, TAKEN, 'Nothing'))).toContain('Nothing recorded');
  });
});

describe('double counting, which is allowed because rules differ', () => {
  it('counts a course everywhere it is listed, and names where', () => {
    // Allowed at some universities and forbidden at others, and the app cannot
    // know which — so it is visible rather than silently applied or ignored.
    const reqs = [
      req({ programme: 'Sports & Society', name: 'Core', accepts: ['CORE 2500'], count: 1 }),
      req({ programme: 'AXLE', name: 'Social sciences', accepts: ['CORE'], count: 1 }),
    ];
    const where = countingIn(reqs, TAKEN[2]);
    expect(where.map((r) => r.programme)).toEqual(['Sports & Society', 'AXLE']);
  });
});

describe('courses counting towards nothing', () => {
  it('names them, because it means one of two useful things', () => {
    // Either it really is a free elective, or a requirement is not entered
    // yet. The app does not guess which.
    const reqs = [req({ programme: 'Economics', accepts: ['ECON'], count: 2 })];
    expect(spare(reqs, TAKEN).map((c) => c.code)).toEqual(['CORE 2500', 'HIST 1200']);
  });

  it('finds none where a free-elective block takes everything', () => {
    expect(spare([req({ accepts: [] })], TAKEN)).toEqual([]);
  });
});

describe('the GPA, on a scale you state', () => {
  it('weights by hours', () => {
    // A− over 3 hours and B+ over 3 hours.
    const g = gpa(TAKEN, COMMON_SCALE);
    expect(g?.hours).toBe(6);
    expect(g?.gpa).toBeCloseTo(3.5, 2);
  });

  it('leaves out what is still in progress', () => {
    expect(gpa(TAKEN, COMMON_SCALE)?.hours).toBe(6);
  });

  it('leaves out a grade the scale does not have, and says how many', () => {
    // A GPA that quietly dropped three pass/fail courses is one somebody will
    // compare against their transcript and not be able to explain.
    const withPass = [...TAKEN, course({ code: 'MUSC 1000', hours: 1, grade: 'P' })];
    const g = gpa(withPass, COMMON_SCALE);
    expect(g?.uncounted.map((c) => c.code)).toEqual(['MUSC 1000']);
    expect(gpaLine(g)).toContain('1 course is left out');
  });

  it('always says whose arithmetic it is', () => {
    expect(gpaLine(gpa(TAKEN, COMMON_SCALE))).toContain('not the registrar');
  });

  it('has nothing to say before anything is finished', () => {
    const doing = [course({ code: 'ECON 1020', hours: 3, current: true })];
    expect(gpa(doing, COMMON_SCALE)).toBeNull();
    expect(gpaLine(null)).toContain('No finished course');
  });

  it('takes a scale that is not the common one', () => {
    const noMinus = { A: 4, B: 3, C: 2 };
    const g = gpa([course({ code: 'X 1', hours: 3, grade: 'A' })], noMinus);
    expect(g?.gpa).toBe(4);
  });
});

describe('credit hours', () => {
  it('reports finished and finished-plus-this-term separately', () => {
    expect(hours(TAKEN)).toEqual({ done: 6, withThisTerm: 12 });
  });
});

describe('reading what was typed and what was stored', () => {
  it('reads a list of codes however it was punctuated', () => {
    expect(readAccepts('econ 1010, ECON 1020\nhist 1200;')).toEqual([
      'ECON 1010',
      'ECON 1020',
      'HIST 1200',
    ]);
    expect(readAccepts('   ')).toEqual([]);
  });

  it('makes a stored requirement safe', () => {
    const [r] = readRequirements([{ id: 'a', need: 'furlongs', count: -2, accepts: 'no' }]);
    expect(r.need).toBe('courses');
    expect(r.count).toBe(1);
    expect(r.accepts).toEqual([]);
  });

  it('makes a stored course safe', () => {
    const [c] = readTaken([{ id: 'a', code: ' econ 1020 ', hours: 'three', current: 'yes' }]);
    expect(c.code).toBe('ECON 1020');
    expect(c.hours).toBe(0);
    expect(c.current).toBe(false);
  });

  it('takes anything that is not a list as nothing', () => {
    expect(readRequirements(null)).toEqual([]);
    expect(readTaken('x')).toEqual([]);
  });
});
