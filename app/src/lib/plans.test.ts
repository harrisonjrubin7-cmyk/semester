import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALWAYS_INCLUDED, INDIVIDUAL_PAID_ACQUISITION_ENABLED, PILOT_NOTE, PLANS, plan, priceLine } from './plans';

describe('the plans', () => {
  it('are Free, Plus, Pro and Semester Institutional, in that order', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['free', 'plus', 'pro', 'institution']);
    expect(plan('institution').name).toBe('Semester Institutional');
  });

  it('holds every paid individual plan as planned while acquisition is disabled', () => {
    expect(INDIVIDUAL_PAID_ACQUISITION_ENABLED).toBe(false);
    for (const p of PLANS) {
      if (p.price) expect(p.priceStatus, p.id).toBe('planned');
      if (p.priceStatus === 'planned') expect(priceLine(p), p.id).toMatch(/\(planned\)$/);
    }
    expect(PILOT_NOTE).toMatch(/Plus and Pro are planned, not on sale/);
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

/**
 * The price the catalog charges, read from the migrations as they leave it:
 * the last file that prices a Plus interval wins, as it does when they are
 * applied in order. Checkout charges this; the pricing page prints plans.ts.
 */
function catalogPlus(): Record<string, number> {
  const dir = join(import.meta.dirname, '../../../supabase/migrations');
  const out: Record<string, number> = {};
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/\('plus',\s*(\d+),\s*'(month|year)'\)/g)) out[m[2]] = Number(m[1]);
  }
  return out;
}

describe('the Plus price', () => {
  it('can be read from the migrations', () => {
    expect(Object.keys(catalogPlus()).sort()).toEqual(['month', 'year']);
  });

  it('keeps the planned display price aligned with the dormant catalog', () => {
    const p = plan('plus').price!;
    expect(p).toEqual({ monthly: 7.99, yearly: 59 });
    expect(catalogPlus()).toEqual({ month: Math.round(p.monthly * 100), year: Math.round(p.yearly * 100) });
  });
});
