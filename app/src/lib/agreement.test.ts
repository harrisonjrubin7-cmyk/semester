import { describe, expect, it } from 'vitest';
import { HEADINGS, RESPONSIBILITY, agreementLines, summary } from './agreement';
import { STATE_LABEL, USES, type PolicySource } from './toolkit/policy';

const src = (patch: Partial<PolicySource>): PolicySource => ({ layer: 'course', link: '', text: '', effective: '', lastVerified: '', by: 'instructor', ...patch });

describe('the course agreement', () => {
  it('shows a use nobody has spoken to as not on file, never as allowed', () => {
    const lines = agreementLines([undefined, undefined]);
    expect(lines).toHaveLength(USES.length);
    expect(lines.every((l) => l.bucket === 'unknown' && l.by === '')).toBe(true);
    expect(summary(lines)).toMatch(/Nothing is on file/);
  });

  it('reads an instructor blanket, with who said it', () => {
    const lines = agreementLines([src({ blanket: 'prohibited' })]);
    expect(lines.every((l) => l.bucket === 'not' && l.by === 'your instructor')).toBe(true);
  });

  it('keeps a required use apart from an optional disclosure, and named uses over a blanket', () => {
    const lines = agreementLines([src({ blanket: 'prohibited', uses: { practice: 'allowed', explanation: 'limited', revision: 'required' } })]);
    const b = (u: string) => lines.find((l) => l.use === u)!.bucket;
    expect(b('practice')).toBe('may');
    expect(b('explanation')).toBe('disclose');
    expect(b('revision')).toBe('required');
    expect(b('brainstorming')).toBe('not');
  });

  it('lets an instructor outrank the student’s own record, and the record fill only what is unsaid', () => {
    const lines = agreementLines([src({ by: 'instructor', uses: { practice: 'prohibited' } }), src({ by: 'student-record', blanket: 'allowed' })]);
    expect(lines.find((l) => l.use === 'practice')!.bucket).toBe('not');
    const other = lines.find((l) => l.use === 'brainstorming')!;
    expect(other.bucket).toBe('may');
    expect(other.by).toBe('your own record of the syllabus');
  });

  it('keeps the student’s responsibility and the refusal on every course, unchanged', () => {
    expect(RESPONSIBILITY.join(' ')).toMatch(/responsible for your final work/);
    expect(RESPONSIBILITY.join(' ')).toMatch(/will not complete a prohibited/);
    expect(Object.keys(HEADINGS).sort()).toEqual(['disclose', 'may', 'not', 'required', 'unknown']);
  });
});

describe('the headings use the policy\'s own words', () => {
  it('never turns a requirement into a permission', () => {
    expect(HEADINGS.required).toBe(STATE_LABEL.required);
    expect(HEADINGS.disclose).toBe(STATE_LABEL.limited);
    expect(HEADINGS.required).not.toMatch(/\bmay\b/i);
  });

  it('counts a required use in the summary', () => {
    const lines = agreementLines([src({ uses: { revision: 'required' } })]);
    expect(summary(lines)).toMatch(/1 required/);
  });
});
