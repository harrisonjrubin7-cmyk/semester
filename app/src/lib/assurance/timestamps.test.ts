import { describe, expect, it } from 'vitest';
import { isIsoTimestamp } from './timestamps';

describe('isIsoTimestamp', () => {
  it('accepts well-formed UTC and offset timestamps', () => {
    expect(isIsoTimestamp('2026-10-01T09:00:00.000Z')).toBe(true);
    expect(isIsoTimestamp('2026-10-01T09:00Z')).toBe(true);
    expect(isIsoTimestamp('2026-10-01T09:00:00+14:00')).toBe(true);
  });

  it('refuses impossible calendar dates that Date.parse would normalise', () => {
    expect(isIsoTimestamp('2026-02-30T09:00:00Z')).toBe(false);
    expect(isIsoTimestamp('2026-04-31T00:00:00Z')).toBe(false);
    expect(isIsoTimestamp('2026-02-29T00:00:00Z')).toBe(false);
    expect(isIsoTimestamp('2026-13-01T00:00:00Z')).toBe(false);
  });

  it('accepts 29 February in a leap year', () => {
    expect(isIsoTimestamp('2028-02-29T00:00:00Z')).toBe(true);
  });

  it('refuses out-of-range clock fields and offsets', () => {
    expect(isIsoTimestamp('2026-10-01T24:00:00Z')).toBe(false);
    expect(isIsoTimestamp('2026-10-01T09:60:00Z')).toBe(false);
    expect(isIsoTimestamp('2026-10-01T09:00:60Z')).toBe(false);
    expect(isIsoTimestamp('2026-10-01T09:00:00+24:00')).toBe(false);
  });

  it('bounds a UTC offset to 14 hours, and 14 only with zero minutes', () => {
    expect(isIsoTimestamp('2026-10-01T09:00:00+14:00')).toBe(true);
    expect(isIsoTimestamp('2026-10-01T09:00:00-14:00')).toBe(true);
    expect(isIsoTimestamp('2026-10-01T09:00:00+14:01')).toBe(false);
    expect(isIsoTimestamp('2026-10-01T09:00:00+15:00')).toBe(false);
    expect(isIsoTimestamp('2026-10-01T09:00:00-14:30')).toBe(false);
  });

  it('refuses locale dates and free text', () => {
    expect(isIsoTimestamp('10/01/2026')).toBe(false);
    expect(isIsoTimestamp('yesterday')).toBe(false);
  });
});
