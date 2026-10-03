import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLANS } from '../plans';

/**
 * Policy drift: a published claim against the thing that would have to make it
 * true.
 *
 * A price on the site that the app does not charge, or a refund window the
 * refund policy does not grant, is not a typo. It is a promise, and on a site a
 * procurement reviewer reads it is the one they will hold Semester to. These
 * checks keep three pairs in agreement:
 *
 *  - the Plus price the public site states, and the plan the app describes;
 *  - the refund window the public site states, and the effective policy
 *    sets out;
 *  - the status of that refund policy: the policy must carry an effective date
 *    before the site presents a refund as granted.
 *
 * Each parser is checked against a control, because a regex that finds nothing
 * would report every pair in agreement.
 */

const root = join(import.meta.dirname, '../../../..');
const site = [
  readFileSync(join(root, 'company-site/index.html'), 'utf8'),
  readFileSync(join(root, 'company-site/site.js'), 'utf8'),
].join('\n');
const policy = readFileSync(join(root, 'docs/legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md'), 'utf8');
const plus = PLANS.find((p) => p.id === 'plus')!;

const money = (n: number) => `$${n}`;
const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/\s+/g, ' ');
const text = plain(site);

/** Every sentence of `s` that mentions a refund. */
const refundSentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter((x) => /refund/i.test(x));
const windows = (s: string) => [...s.matchAll(/within (\d+) days?/gi)].map((m) => Number(m[1]));

describe('the site and the plans', () => {
  it('states the Plus price the app describes', () => {
    const row = /Plus: (\$[\d.]+) a month or (\$[\d.]+) a year/.exec(text);
    expect(row, 'the price row was not found; the parser is broken or the row moved').not.toBeNull();
    expect(row![1]).toBe(money(plus.price!.monthly));
    expect(row![2]).toBe(money(plus.price!.yearly));
  });

  it('states the same Plus price in the billing toggle script', () => {
    expect(site).toContain(`'${money(plus.price!.monthly)}<small> / month</small>'`);
    expect(site).toContain(`'${money(plus.price!.yearly)}<small> / year</small>'`);
  });
});

describe('the site and the refund policy', () => {
  const policyWindow = windows(policy.split('\n').find((l) => /annual plan, cancelled within/i.test(l)) ?? '');

  it('finds the annual refund window in the policy, and refund claims on the site', () => {
    expect(policyWindow).toHaveLength(1);
    expect(refundSentences(text).length).toBeGreaterThan(0);
  });

  it('never states a window the policy does not set out', () => {
    for (const s of refundSentences(text)) for (const w of windows(s)) expect(w, s).toBe(policyWindow[0]);
  });

  it('presents the refund as granted only with an effective policy', () => {
    expect(policy).toMatch(/\*\*Effective date:\*\* October 3, 2026/);
    expect(policy).not.toMatch(/not in force|\[DECIDE/i);
  });
});
