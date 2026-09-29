import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALWAYS_INCLUDED, PILOT_NOTE, PLANS, plan, priceLine } from './plans';

describe('the plans', () => {
  it('are Free, Plus, Pro and Institution Access, in that order', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['free', 'plus', 'pro', 'institution']);
  });

  it('sell Plus in the app and nothing else: every other paid price is marked planned', () => {
    for (const p of PLANS) {
      if (p.price) expect(p.priceStatus, p.id).toBe(p.id === 'plus' ? 'in-app' : 'planned');
      if (p.priceStatus === 'planned') expect(priceLine(p), p.id).toMatch(/\(planned\)$/);
      if (p.priceStatus === 'in-app') expect(priceLine(p), p.id).toMatch(/, bought in the app$/);
    }
    expect(PILOT_NOTE).toMatch(/^Plus is bought in the app/);
    expect(PILOT_NOTE).toMatch(/Pro is not on sale yet/);
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
    expect(priceLine(plan('plus'))).toBe('$7.99 a month or $59 a year, bought in the app');
    expect(priceLine(plan('pro'))).toBe('$14.99 a month or $99 a year (planned)');
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

  it('is the same on the pricing page and at checkout: $7.99 a month or $59 a year', () => {
    const p = plan('plus').price!;
    expect(p).toEqual({ monthly: 7.99, yearly: 59 });
    expect(catalogPlus()).toEqual({ month: Math.round(p.monthly * 100), year: Math.round(p.yearly * 100) });
  });
});

/**
 * The guard nobody wrote before #964: a plan the catalog can charge for is a
 * plan the app sells, and nothing Semester publishes may say otherwise. Plus
 * went on sale while four registers and the pricing page still said nothing
 * could be bought; this fails the day that happens again, in either direction.
 */
describe('what is said about buying', () => {
  const read = (rel: string) => readFileSync(join(import.meta.dirname, rel), 'utf8');
  const SOLD_NOTHING = /nothing can be bought|nothing is for sale|no checkout and no billing|there is no billing provider and no checkout|no billing exists yet|shown here once checkout exists|plus and pro are not on sale/i;

  it('marks in-app exactly the plans the catalog charges for', () => {
    const charged = Object.keys(catalogPlus()).length > 0;
    expect(plan('plus').priceStatus === 'in-app', 'plus').toBe(charged);
    for (const p of PLANS.filter((x) => x.id !== 'plus')) expect(p.priceStatus, p.id).not.toBe('in-app');
  });

  it('is never "nothing can be bought" anywhere while a plan is sold in the app', () => {
    const sold = PLANS.some((p) => p.priceStatus === 'in-app');
    const sources = {
      'lib/knownlimitations.ts': read('./knownlimitations.ts'),
      'lib/ops/claims.ts': read('./ops/claims.ts'),
      'lib/plans.ts': read('./plans.ts'),
      'site/pages.tsx': read('../site/pages.tsx'),
      'company-site/index.html': read('../../../company-site/index.html'),
    };
    for (const [file, text] of Object.entries(sources)) {
      if (sold) expect(text, file).not.toMatch(SOLD_NOTHING);
    }
  });
});
