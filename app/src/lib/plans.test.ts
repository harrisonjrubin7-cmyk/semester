import { describe, expect, it } from 'vitest';
import { ALWAYS_INCLUDED, PILOT_NOTE, PLANS, plan, priceLine } from './plans';

describe('the plans', () => {
  it('are Free, Plus, Pro and Institution Access, in that order', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['free', 'plus', 'pro', 'institution']);
  });

  it('sell nothing yet: every paid price is marked planned', () => {
    for (const p of PLANS) {
      if (p.price) expect(p.priceStatus, p.id).toBe('planned');
      if (p.priceStatus === 'planned') expect(priceLine(p), p.id).toMatch(/\(planned\)$/);
    }
    expect(PILOT_NOTE).toMatch(/not on sale yet/);
  });

  it('never put export, deletion or saved plans behind a paywall', () => {
    for (const p of PLANS) {
      for (const promise of ALWAYS_INCLUDED) {
        expect(p.includes.some((i) => i.toLowerCase() === promise.toLowerCase()), `${p.id} lists "${promise}" as a feature`).toBe(false);
      }
    }
    expect(ALWAYS_INCLUDED).toEqual(
      expect.arrayContaining(['Export all of your data', 'Delete your account and your data']),
    );
  });

  it('writes prices the way people read them', () => {
    expect(priceLine(plan('free'))).toBe('Free');
    expect(priceLine(plan('plus'))).toBe('$7.99 a month or $59 a year (planned)');
    expect(priceLine(plan('institution'))).toBe('Through your university');
  });
});
