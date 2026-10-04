import { describe, expect, it } from 'vitest';
import { caseText, lintCase, lintText, luhn } from './eval-lint';
import { CASES, type EvalCase } from './model-quality';

/**
 * The evaluation-data lint, and the set it guards. Each kind is planted and
 * must be found; the reserved forms a synthetic set is allowed must pass; and
 * the fifteen cases that exist must be clean, which is only worth saying
 * because the lint is shown to find what it is looking for.
 */

const kinds = (text: string) => lintText(text).map((f) => f.kind);

describe('what the lint finds', () => {
  it('finds a real-looking address of each kind', () => {
    expect(kinds('write to jane.doe@gmail.com about it')).toEqual(['email']);
    expect(kinds('professor.lee@vanderbilt.edu')).toEqual(['email']);
    expect(kinds('call 303-441-9027 after class')).toEqual(['phone']);
    expect(kinds('she lives at 1500 Oak Street')).toEqual(['street_address']);
    expect(kinds('the lab is at 36.1447, -86.8027 exactly')).toEqual(['coordinates']);
    expect(kinds('her number is 123-45-6789')).toEqual(['ssn']);
    expect(kinds('card 4111 1111 1111 1111 on file')).toEqual(['card']);
  });

  it('finds a tenant’s student id shape when told it', () => {
    expect(lintText('ID 00481234', { studentId: /\b\d{8}\b/ }).map((f) => f.kind)).toEqual(['student_id']);
    expect(lintText('ID 00481234')).toEqual([]);
  });

  it('finds several kinds in one text and reports each', () => {
    expect(kinds('a@gmail.com and 123-45-6789').sort()).toEqual(['email', 'ssn']);
  });
});

describe('what a synthetic set may contain', () => {
  it('passes reserved addresses, which cannot reach a person', () => {
    for (const ok of ['student@example.com', 'ta@cs.example.edu', 'x@school.test', 'y@mail.invalid', 'z@example.org']) {
      expect(lintText(ok), ok).toEqual([]);
    }
  });

  it('passes the fiction telephone range and nothing else beside it', () => {
    expect(lintText('call 615-555-0123')).toEqual([]);
    expect(kinds('call 615-555-0223')).toEqual(['phone']);
    expect(kinds('call 615-556-0123')).toEqual(['phone']);
  });

  it('does not take a long run of digits for a card unless it passes the Luhn check', () => {
    expect(luhn('4111111111111111')).toBe(true);
    expect(luhn('4111111111111112')).toBe(false);
    expect(lintText('case number 4111 1111 1111 1112')).toEqual([]);
    expect(lintText('a 16 digit order 1234567812345678')).toEqual([]);
  });

  it('lets course content through: a room number and a class time are medium findings and do not block', () => {
    expect(lintText('The midterm is in Room 204 every Tuesday at 3pm.')).toEqual([]);
  });

  it('is not fooled by a lookalike: an email with a reserved name inside a real domain still counts', () => {
    expect(kinds('a@example.com.evil.io')).toEqual(['email']);
    expect(kinds('a@notexample.com')).toEqual(['email']);
  });
});

describe('the cases that exist', () => {
  it('has fifteen of them, and each is clean', () => {
    expect(CASES).toHaveLength(15);
    for (const c of CASES) expect(lintCase(c), c.id).toEqual([]);
  });

  it('reads every field of a case, shown by planting in each one in turn', () => {
    const base = CASES[0];
    const bad = ' Reach me at real.person@gmail.com.';
    const planted: [string, EvalCase][] = [
      ['the prompt as built', { ...base, build: () => ({ ...base.build(), system: base.build().system + bad }) }],
      ['a message', { ...base, build: () => ({ ...base.build(), messages: [{ role: 'user' as const, content: bad }] }) }],
      ['the good reply', { ...base, good: base.good + bad }],
      ['a reply a check refuses', { ...base, checks: [{ ...base.checks[0], refuses: bad }, ...base.checks.slice(1)] }],
      ['a reply a check accepts', { ...base, checks: [{ ...base.checks[0], accepts: [bad] }, ...base.checks.slice(1)] }],
    ];
    for (const [where, c] of planted) {
      expect(lintCase(c).map((f) => f.kind), where).toEqual(['email']);
    }
    expect(caseText(base)).not.toContain('real.person');
  });
});
