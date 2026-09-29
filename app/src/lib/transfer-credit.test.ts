import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DOCUMENTS,
  EMPTY_TRANSFER_CREDIT,
  evaluate,
  fromPublished,
  normalCode,
  normalInstitution,
  packet,
  parsePathway,
  questions,
  readTransferCredit,
  ruleFor,
  totals,
  type PriorCourse,
  type Rule,
  type TransferCreditData,
} from './transfer-credit';

const course = (id: string, patch: Partial<PriorCourse> = {}): PriorCourse => ({
  id,
  institution: 'Nashville State CC',
  code: 'CSC 1010',
  title: 'Intro to Programming',
  credits: 3,
  grade: 'A',
  term: 'Fall 2025',
  ...patch,
});

const published: Rule[] = fromPublished([
  { partner_scope: 'exp-u/nashville-state-cc', from_course: 'CSC-1010', to_course: 'CS 101', credits: '3.0', status: 'approved' },
  { partner_scope: 'exp-u/nashville-state-cc', from_course: 'MATH 1910', to_course: 'MATH 150', credits: 4, status: 'proposed' },
]);

const imported: Rule[] = [
  { fromInstitution: 'Nashville State CC', fromCourse: 'ENGL 1010', toCourse: 'ENGL 100', credits: 3, source: 'imported' },
  { fromInstitution: 'Nashville State CC', fromCourse: 'CSC 1010', toCourse: 'CS 999', credits: 3, source: 'imported' },
];

const data = (patch: Partial<TransferCreditData> = {}): TransferCreditData => ({
  ...EMPTY_TRANSFER_CREDIT,
  courses: [
    course('pa'),
    course('pb', { code: 'ENGL 1010', title: 'Composition I' }),
    course('pc', { code: 'MATH 1910', title: 'Calculus I', credits: 4 }),
    course('pd', { code: 'ART 1030', title: 'Art Appreciation' }),
  ],
  imported,
  ...patch,
});

describe('matching', () => {
  it('treats spacing, case and punctuation in codes and school names as the same', () => {
    expect(normalCode(' csc-1010 ')).toBe(normalCode('CSC 1010'));
    expect(normalInstitution('exp-u/nashville-state-cc')).toBe(normalInstitution('Nashville State CC'));
  });

  it('only reads approved published rows, and labels them institution verified', () => {
    expect(published).toEqual([
      { fromInstitution: 'exp-u/nashville-state-cc', fromCourse: 'CSC-1010', toCourse: 'CS 101', credits: 3, source: 'institution_verified' },
    ]);
  });

  it('prefers a published rule over an imported one for the same course', () => {
    expect(ruleFor(course('pa'), [...imported, ...published])?.toCourse).toBe('CS 101');
  });

  it('never matches a course from a different school', () => {
    expect(ruleFor(course('px', { institution: 'Belmont University' }), [...published, ...imported])).toBeNull();
  });
});

describe('labels', () => {
  it('gives each course one of the four labels, and never calls a proposed rule published', () => {
    const rows = evaluate(data(), published);
    expect(rows.map((r) => [r.course.code, r.status, r.toCourse])).toEqual([
      ['CSC 1010', 'published', 'CS 101'],
      ['ENGL 1010', 'estimated', 'ENGL 100'],
      // MATH 1910's rule is only proposed, so it is not a match at all.
      ['MATH 1910', 'not_evaluated', null],
      ['ART 1030', 'not_evaluated', null],
    ]);
  });

  it('a student guess is estimated, and sending the packet makes everything unpublished pending review', () => {
    let d = data({ guesses: { pd: { toCourse: 'ART 100', note: 'Same textbook' } } });
    expect(evaluate(d, published).find((r) => r.course.id === 'pd')?.status).toBe('estimated');
    d = { ...d, submittedOn: '2026-10-01' };
    expect(evaluate(d, published).map((r) => r.status)).toEqual(['published', 'pending_review', 'pending_review', 'pending_review']);
  });

  it('totals credits by label', () => {
    const t = totals(evaluate(data(), published));
    expect(t).toMatchObject({ courses: 4, credits: 13 });
    expect(t.byStatus.published).toEqual({ courses: 1, credits: 3 });
    expect(t.byStatus.not_evaluated).toEqual({ courses: 2, credits: 7 });
  });
});

describe('the packet', () => {
  it('says it is a request, lists every course with its label, asks the open questions and lists documents', () => {
    const d = data({ documents: ['transcript'] });
    const rows = evaluate(d, published);
    const text = packet(d, rows, 'Expansion University');
    expect(text.split('\n')[1]).toMatch(/request for official evaluation, not a decision/);
    expect(text).toContain('• CSC 1010 Intro to Programming (Nashville State CC, Fall 2025, 3 cr, grade A) → CS 101 [Published equivalency]');
    expect(text).toContain('Will ENGL 1010 (Nashville State CC) count as ENGL 100?');
    expect(text).toContain('How will ART 1030 (Nashville State CC) be evaluated');
    expect(text).toContain('[x] Official transcript ordered');
    expect(text.match(/\[ \]/g)).toHaveLength(DOCUMENTS.length - 1);
    expect(text).not.toMatch(/\bwill transfer\b|guaranteed|approved for you/i);
  });

  it('asks nothing about a course with a published equivalency', () => {
    expect(questions(evaluate(data(), published)).some((q) => q.includes('CSC 1010'))).toBe(false);
  });
});

describe('reading a pathway file', () => {
  it('reads quoted fields and blank credits', () => {
    const rules = parsePathway('From Institution,from_course,to_course,credits\r\n"Nashville State, CC",CSC 1010,CS 101,\n');
    expect(rules).toEqual([{ fromInstitution: 'Nashville State, CC', fromCourse: 'CSC 1010', toCourse: 'CS 101', credits: null, source: 'imported' }]);
  });

  it('refuses a missing header, a missing value and nonsense credits', () => {
    expect(() => parsePathway('a,b,c\n1,2,3')).toThrow(/header/);
    expect(() => parsePathway('from_institution,from_course,to_course\nX,,Y')).toThrow(/Row 2/);
    expect(() => parsePathway('from_institution,from_course,to_course,credits\nX,A,B,lots')).toThrow(/credits/);
  });
});

describe('saved data', () => {
  it('round-trips', () => {
    const d = data({ guesses: { pd: { toCourse: 'ART 100', note: '' } }, submittedOn: '2026-10-01', documents: ['exams'] });
    expect(readTransferCredit(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it('refuses a stored row that claims to be published — published rules are read fresh, never stored', () => {
    expect(() => readTransferCredit({ ...data(), imported: published })).toThrow(/claims to be published/);
  });

  it('drops guesses for courses that are gone, and unknown document ids', () => {
    const got = readTransferCredit({ ...data(), guesses: { gone: { toCourse: 'X', note: '' } }, documents: ['transcript', 'nope'] });
    expect(got.guesses).toEqual({});
    expect(got.documents).toEqual(['transcript']);
  });

  it('refuses duplicate ids, bad credits and a malformed date', () => {
    expect(() => readTransferCredit({ ...data(), courses: [course('pa'), course('pa')] })).toThrow();
    expect(() => readTransferCredit({ ...data(), courses: [course('pa', { credits: -1 })] })).toThrow();
    expect(() => readTransferCredit({ ...data(), submittedOn: 'October' })).toThrow();
  });
});

describe('what it writes', () => {
  it('writes to no table — the official evaluation is the institution’s', () => {
    const lib = readFileSync(new URL('./transfer-credit.ts', import.meta.url), 'utf8');
    const reader = readFileSync(new URL('./transfer-published.ts', import.meta.url), 'utf8');
    expect(lib).not.toMatch(/from\(['"]/);
    expect(reader).toMatch(/from\('articulation_rules'\)/);
    expect(reader).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(reader).toMatch(/\.eq\('status', 'approved'\)/);
  });
});
