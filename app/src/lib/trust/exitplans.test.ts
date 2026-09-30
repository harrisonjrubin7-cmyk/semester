import { describe, expect, it } from 'vitest';
import { EXIT_PLANS } from './exitplans';
import { PARTIES } from './subprocessors';

/**
 * Every subprocessor has an exit plan, and every plan is for a subprocessor.
 *
 * The clock is the one place a test reads the date, and it is here on purpose:
 * a plan nobody has looked at since it was written is a claim that has
 * quietly stopped being checked, which is what a review date is for.
 */

const subprocessors = PARTIES.filter((p) => p.kind === 'subprocessor').map((p) => p.name);

describe('subprocessor exit plans', () => {
  it('reads both lists, so an empty one cannot read as covered', () => {
    expect(subprocessors.length).toBeGreaterThan(0);
    expect(EXIT_PLANS.length).toBeGreaterThan(0);
  });

  it('covers every subprocessor, exactly once', () => {
    expect(EXIT_PLANS.map((p) => p.party).sort()).toEqual([...subprocessors].sort());
  });

  it('says something in every field', () => {
    for (const p of EXIT_PLANS) {
      for (const k of ['fallback', 'replacement', 'exit'] as const) expect(p[k].trim().length, `${p.party} ${k}`).toBeGreaterThan(20);
    }
  });

  it('has a review date that has not passed', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const p of EXIT_PLANS) {
      expect(p.reviewBy, p.party).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.reviewBy >= today, `${p.party} exit plan is overdue for review (${p.reviewBy})`).toBe(true);
    }
  });
});
