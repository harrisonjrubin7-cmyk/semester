import { describe, expect, it } from 'vitest';
import { dateProblem, isRealDate, localDay } from './datefield';

const say = (iso: string) => `«${iso}»`;

describe('isRealDate', () => {
  it('accepts real days, including a leap day', () => {
    for (const d of ['2026-10-04', '2028-02-29', '2026-12-31']) expect(isRealDate(d), d).toBe(true);
  });
  it('refuses the right shape with the wrong calendar, and the wrong shape', () => {
    for (const d of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-10-4', '10/04/2026', '', 'tomorrow']) expect(isRealDate(d), d).toBe(false);
  });
});

describe('localDay', () => {
  it('is the local day, not the evening before — the UTC trap', () => {
    const d = localDay('2026-10-04');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 4]);
  });
});

describe('dateProblem', () => {
  it('is fine empty unless required', () => {
    expect(dateProblem('', {}, say)).toBeUndefined();
    expect(dateProblem('', { required: true }, say)).toBe('Enter a date.');
  });
  it('says what to do, with the bound in the reader’s words', () => {
    expect(dateProblem('2026-09-01', { min: '2026-10-01' }, say)).toBe('Enter a date on or after «2026-10-01».');
    expect(dateProblem('2026-12-01', { max: '2026-11-30' }, say)).toBe('Enter a date on or before «2026-11-30».');
  });
  it('includes both bounds themselves', () => {
    expect(dateProblem('2026-10-01', { min: '2026-10-01', max: '2026-10-01' }, say)).toBeUndefined();
  });
  it('refuses a day that does not exist', () => {
    expect(dateProblem('2026-02-30', {}, say)).toMatch(/real date/);
  });
  it('ignores a bound that is not a date rather than failing every value', () => {
    expect(dateProblem('2026-10-04', { min: 'soon' }, say)).toBeUndefined();
  });
});
