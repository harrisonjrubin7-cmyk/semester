import { describe, expect, it } from 'vitest';
import { TRUST_TEXT } from './source';
import { gradeSource, gradeSourceText, surfaceSource } from './pilotfacts';

describe('pilot fact sources', () => {
  it('does not call a seeded grade institution verified, even if a caller claims it is', () => {
    expect(gradeSource(true, true)).toBe('sample');
    expect(gradeSourceText(true, true)).toBe(TRUST_TEXT.sample);
    expect(gradeSourceText(true, true)).not.toBe(TRUST_TEXT.institution_verified);
  });

  it('calls a live, unseeded release institution verified', () => {
    expect(gradeSource(false, true)).toBe('institution_verified');
  });

  it('calls device arithmetic estimated', () => {
    expect(gradeSource(false, false)).toBe('estimated');
  });

  it('labels the four surfaces without promoting a seed', () => {
    expect(surfaceSource('today', { seeded: true })).toBe('sample');
    expect(surfaceSource('today', { seeded: false })).toBe('estimated');
    expect(surfaceSource('degree', { seeded: true })).toBe('sample');
    expect(surfaceSource('account', { seeded: false })).toBe('student_entered');
    expect(surfaceSource('account', { seeded: true, institutional: true })).toBe('sample');
    expect(surfaceSource('registration', { seeded: false })).toBe('unavailable_stale');
    expect(surfaceSource('registration', { seeded: false, institutional: true })).toBe('institution_verified');
  });
});
