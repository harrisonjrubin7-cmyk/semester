import { describe, expect, it } from 'vitest';
import { ADULT_AGE, MINIMUM_AGE, SAID, ageOn, standing, todayIso } from './age';

describe('the age rules', () => {
  it('set the minimum at 13 and the adult age at 18', () => {
    expect(MINIMUM_AGE).toBe(13);
    expect(ADULT_AGE).toBe(18);
  });

  it('count whole years, turning over on the birthday and not before', () => {
    expect(ageOn('2010-06-15', '2023-06-14')).toBe(12);
    expect(ageOn('2010-06-15', '2023-06-15')).toBe(13);
    expect(ageOn('2008-12-31', '2026-12-30')).toBe(17);
    expect(ageOn('2008-12-31', '2026-12-31')).toBe(18);
  });

  it('refuse under 13, and call 13 to 17 minors', () => {
    expect(standing('2010-06-15', '2023-06-14')).toBe('under_minimum');
    expect(standing('2010-06-15', '2023-06-15')).toBe('minor');
    expect(standing('2008-12-31', '2026-12-30')).toBe('minor');
    expect(standing('2008-12-31', '2026-12-31')).toBe('adult');
  });

  it('treat a leap-day birthday by the calendar', () => {
    expect(standing('2008-02-29', '2026-02-28')).toBe('minor');
    expect(standing('2008-02-29', '2026-03-01')).toBe('adult');
  });

  it('refuse what is not a birth date rather than guess', () => {
    for (const bad of ['', 'yesterday', '2011-02-30', '2011-13-01', '3000-01-01', '1850-01-01', '2026-10-01']) {
      expect(standing(bad, '2026-09-29'), bad).toBe('invalid');
    }
  });

  it('read today in the person’s own calendar', () => {
    expect(todayIso(new Date(2026, 8, 29, 23, 30))).toBe('2026-09-29');
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('tell an under-13 that nothing was sent, and a minor what stays theirs', () => {
    expect(SAID.under_minimum).toMatch(/at least 13/);
    expect(SAID.under_minimum).toMatch(/Nothing was sent and nothing was created/);
    expect(SAID.minor).toMatch(/report anything and share with a parent or guardian/);
  });
});
