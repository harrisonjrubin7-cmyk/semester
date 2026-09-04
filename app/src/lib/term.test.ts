import { describe, expect, it } from 'vitest';
import { LEGACY_TERM, SEASONS, isPast, readTerm, sortTerms, termId, termNow, yearFor } from './term';

describe('reading a term id', () => {
  it('takes the six characters a course stores', () => {
    expect(readTerm('2026FA')).toEqual({
      id: '2026FA',
      label: 'Fall 2026',
      year: 2026,
      startMonth: 7,
    });
  });

  it('reads every season', () => {
    expect(readTerm('2027SP').label).toBe('Spring 2027');
    expect(readTerm('2027SU').label).toBe('Summer 2027');
    expect(readTerm('2027WI').label).toBe('Winter 2027');
  });

  it('is not fussy about case', () => {
    expect(readTerm('2026fa').id).toBe('2026FA');
  });

  it('falls back for a course saved before terms existed', () => {
    // Not "the term it is today": those courses hold Fall 2026 dates, and
    // filing them under the current term would move every deadline by a year.
    expect(readTerm(undefined).id).toBe(LEGACY_TERM);
    expect(readTerm('').id).toBe(LEGACY_TERM);
    expect(readTerm('rubbish').id).toBe(LEGACY_TERM);
  });

  it('does not loop forever on a broken legacy constant', () => {
    expect(readTerm(LEGACY_TERM).id).toBe(LEGACY_TERM);
  });
});

describe('which year a month falls in', () => {
  it('is the term’s year, for every ordinary term', () => {
    const fall = readTerm('2026FA');
    expect(yearFor(fall, 7)).toBe(2026); // August
    expect(yearFor(fall, 11)).toBe(2026); // December
    const spring = readTerm('2027SP');
    expect(yearFor(spring, 0)).toBe(2027);
    expect(yearFor(spring, 4)).toBe(2027);
  });

  it('rolls over for a winter session that crosses new year', () => {
    const winter = readTerm('2026WI');
    expect(yearFor(winter, 11)).toBe(2026); // December 2026
    expect(yearFor(winter, 0)).toBe(2027); // January 2027
  });
});

describe('the term it is now', () => {
  it('reads the season off the month', () => {
    expect(termNow(new Date(2026, 8, 3)).id).toBe('2026FA');
    expect(termNow(new Date(2027, 1, 3)).id).toBe('2027SP');
    expect(termNow(new Date(2027, 5, 3)).id).toBe('2027SU');
    expect(termNow(new Date(2027, 11, 3)).id).toBe('2027WI');
  });

  it('puts January in this spring, not last winter', () => {
    expect(termNow(new Date(2028, 0, 9)).id).toBe('2028SP');
  });
});

describe('ordering and standing', () => {
  it('sorts newest first, which is what a picker wants', () => {
    expect(sortTerms(['2026FA', '2027SP', '2026SP', '2027FA']).map((t) => t.id)).toEqual([
      '2027FA',
      '2027SP',
      '2026FA',
      '2026SP',
    ]);
  });

  it('does not list the same term twice', () => {
    expect(sortTerms(['2026FA', '2026FA'])).toHaveLength(1);
  });

  it('calls a term past once the next one has begun', () => {
    const now = new Date(2027, 1, 3); // Spring 2027
    expect(isPast(readTerm('2026FA'), now)).toBe(true);
    expect(isPast(readTerm('2027SP'), now)).toBe(false);
    expect(isPast(readTerm('2027FA'), now)).toBe(false);
  });
});

describe('the id itself', () => {
  it('is built the same way it is read', () => {
    for (const s of SEASONS) {
      expect(readTerm(termId(2026, s.code)).id).toBe(`2026${s.code}`);
    }
  });

  it('sorts correctly as a plain string within a year', () => {
    expect(['2026FA', '2026SP', '2026SU'].sort()).toEqual(['2026FA', '2026SP', '2026SU']);
  });
});
