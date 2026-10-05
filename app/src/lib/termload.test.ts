import { describe, expect, it } from 'vitest';
import { EMPTY_REGISTRATION_DAY, readRegistrationDay } from './registration-day';
import { HOURS_PER_CREDIT, termLoad } from './termload';

/**
 * The term-load check, held to what it promises: the same inputs give the same
 * sentences, every limit comes from the student, nothing says "allowed", and
 * each rule has a boundary that is tested on both sides.
 */

describe('an empty plan', () => {
  it('has no load to estimate and no flags', () => {
    const t = termLoad({ credits: 0, min: 12, max: 18, target: 15, studyHours: 30 });
    expect(t.flags).toEqual([]);
    expect(t.lines).toEqual(['Nothing is in the plan yet, so there is no load to estimate.']);
    expect(t.estimatedHours).toBe(0);
  });
});

describe('credit limits the student entered', () => {
  it('flags under the minimum, and not at it', () => {
    expect(termLoad({ credits: 11, min: 12 }).flags).toContain('under-min');
    expect(termLoad({ credits: 12, min: 12 }).flags).not.toContain('under-min');
  });
  it('flags over the maximum, and not at it, and says approval may be needed', () => {
    const over = termLoad({ credits: 19, max: 18 });
    expect(over.flags).toContain('over-max');
    expect(over.lines.join(' ')).toMatch(/1 credit over the 18-credit maximum you entered; your school may need approval/);
    expect(termLoad({ credits: 18, max: 18 }).flags).not.toContain('over-max');
  });
  it('attributes every limit to the student and never knows a school\'s own', () => {
    const t = termLoad({ credits: 9, min: 12 });
    expect(t.lines.join(' ')).toContain('you entered');
    expect(termLoad({ credits: 9 }).missing).toContain('your school’s credit limits');
  });
});

describe('the target', () => {
  it('flags a gap either way and is silent when met', () => {
    expect(termLoad({ credits: 12, target: 15 }).lines.join(' ')).toContain('3 credits under your 15-credit target');
    expect(termLoad({ credits: 16, target: 15 }).lines.join(' ')).toContain('1 credit over your 15-credit target');
    expect(termLoad({ credits: 15, target: 15 }).flags).not.toContain('off-target');
  });
  it('is reported as missing when not set, rather than guessed', () => {
    expect(termLoad({ credits: 15 }).missing).toContain('the load you mean to take');
  });
});

describe('the hours estimate', () => {
  it('is credits times the stated assumption, and says the assumption', () => {
    const t = termLoad({ credits: 15 });
    expect(t.estimatedHours).toBe(15 * HOURS_PER_CREDIT);
    expect(t.assumption).toContain('not your school');
    expect(t.lines.join(' ')).toContain('Estimated 30 hours a week');
  });
  it('honours an override and rounds to a tenth', () => {
    expect(termLoad({ credits: 15, hoursPerCredit: 2.5 }).estimatedHours).toBe(37.5);
    expect(termLoad({ credits: 3, hoursPerCredit: 0 }).estimatedHours).toBe(3 * HOURS_PER_CREDIT); // 0 falls back
  });
  it('compares with the hours the student has, with three outcomes and exact edges', () => {
    // 15 credits -> 30 hours.
    expect(termLoad({ credits: 15, studyHours: 29 }).flags).toContain('over-capacity');
    expect(termLoad({ credits: 15, studyHours: 30 }).flags).toContain('tight'); // 30 > 25.5
  });
  it('fits only below 85% of the hours', () => {
    expect(termLoad({ credits: 15, studyHours: 36 }).flags).not.toContain('tight'); // 30 <= 30.6
    expect(termLoad({ credits: 15, studyHours: 35.3 }).flags).not.toContain('tight'); // 30 <= 30.005
    expect(termLoad({ credits: 15, studyHours: 36 }).lines.join(' ')).toContain('fits inside the 36 hours');
    expect(termLoad({ credits: 15, studyHours: 35 }).flags).toContain('tight'); // 30 > 29.75
  });
  it('says the hours were not compared when the student has not said how many they have', () => {
    expect(termLoad({ credits: 15 }).missing).toContain('the study hours you have each week');
  });
});

describe('the whole verdict', () => {
  it('is "fits" only when nothing is over and nothing is missing', () => {
    const t = termLoad({ credits: 15, target: 15, min: 12, max: 18, studyHours: 40 });
    expect(t.flags).toEqual(['fits']);
    expect(t.missing).toEqual([]);
    // Same inputs with one thing unsaid is not "fits": absence of a problem is not a verdict.
    expect(termLoad({ credits: 15, target: 15, min: 12, max: 18 }).flags).not.toContain('fits');
  });
  it('is deterministic, and never says allowed, must, or approved', () => {
    const input = { credits: 21, target: 15, min: 12, max: 18, studyHours: 20 };
    expect(termLoad(input)).toEqual(termLoad({ ...input }));
    const said = termLoad(input).lines.join(' ');
    expect(said).not.toMatch(/\b(not allowed|must|denied|approved|you may not)\b/i);
  });
});

describe('what is stored', () => {
  it('reads an older save with the three new numbers empty', () => {
    const old = { opensAt: null, source: 'student_entered', backups: {}, checks: [], creditTarget: 15, portalUrl: null, remind: true, manual: false };
    const read = readRegistrationDay(old);
    expect([read.minCredits, read.maxCredits, read.studyHours]).toEqual([null, null, null]);
    expect(EMPTY_REGISTRATION_DAY).toMatchObject({ minCredits: null, maxCredits: null, studyHours: null });
  });
  it('keeps sensible numbers and drops nonsense', () => {
    const base = { ...EMPTY_REGISTRATION_DAY };
    const read = readRegistrationDay({ ...base, minCredits: 12, maxCredits: 41, studyHours: -3 });
    expect([read.minCredits, read.maxCredits, read.studyHours]).toEqual([12, null, null]);
    expect(readRegistrationDay({ ...base, studyHours: 100 }).studyHours).toBe(100);
    expect(readRegistrationDay({ ...base, studyHours: 101 }).studyHours).toBeNull();
    expect(readRegistrationDay({ ...base, minCredits: 'twelve' }).minCredits).toBeNull();
  });
});
