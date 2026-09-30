import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLAGS, KILL_SWITCHES } from './flags';
import { DESTINATIONS, GROUPS } from './nav';
import { PLANS } from './plans';
import { PARTIES } from './trust/subprocessors';

/**
 * Complexity budgets: the surface a person has to hold in their head, counted
 * and capped the way `perf-budgets.json` caps bytes.
 *
 * Every count here is something a student, an administrator or a procurement
 * reviewer has to learn: places to go, switches that change behaviour, plans,
 * parties that touch data. A proposal that pushes one over its budget has to
 * raise the number in `complexity-budgets.json` in the same change, which
 * puts the increase in front of a reviewer as a diff instead of letting it
 * arrive as a side effect. The fix for a failure is to reuse what exists or
 * retire something; raising the figure is the last resort and is argued in
 * the pull request.
 *
 * Budgets are set from measurement. A budget that has drifted well above the
 * count is no longer a budget, so the other direction fails too: lower the
 * figure when the surface shrinks.
 */

const budgets: Record<string, number | string> = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../complexity-budgets.json'), 'utf8'),
);

const measured: Record<string, number> = {
  flags: FLAGS.length,
  killSwitches: KILL_SWITCHES.length,
  destinations: DESTINATIONS.length,
  groups: GROUPS.length,
  plans: PLANS.length,
  subprocessors: PARTIES.filter((p) => p.kind === 'subprocessor').length,
};

/** How far a budget may sit above its count before it stops constraining anything. */
const slack = (n: number) => Math.max(2, Math.ceil(n * 0.1));

describe('complexity budgets', () => {
  it('measures something for every metric, so an empty import cannot read as within budget', () => {
    for (const [k, n] of Object.entries(measured)) expect(n, k).toBeGreaterThan(0);
  });

  it('has a budget for exactly the metrics measured', () => {
    const { measuredOn, ...figures } = budgets;
    expect(measuredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Object.keys(figures).sort()).toEqual(Object.keys(measured).sort());
  });

  for (const [k, n] of Object.entries(measured)) {
    it(`${k}: ${n} is within its budget`, () => {
      expect(n, `${k} is over budget; reuse or retire something, or raise it in complexity-budgets.json and argue it in the PR`).toBeLessThanOrEqual(Number(budgets[k]));
    });
    it(`${k}: the budget is not stale`, () => {
      expect(Number(budgets[k]), `${k}'s budget has drifted above its count; lower it`).toBeLessThanOrEqual(n + slack(n));
    });
  }
});
