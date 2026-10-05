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
 *  - the refund window the public site states, and the one the draft policy
 *    sets out;
 *  - the status of that refund policy: nothing on the site may say a refund is
 *    *granted* while the draft says it is not in force.
 *
 * Each parser is checked against a control, because a regex that finds nothing
 * would report every pair in agreement.
 */

const root = join(import.meta.dirname, '../../../..');
const site = [
  readFileSync(join(root, 'company-site/index.html'), 'utf8'),
  readFileSync(join(root, 'company-site/site.js'), 'utf8'),
].join('\n');
const draft = readFileSync(join(root, 'docs/legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md'), 'utf8');
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
  const draftWindow = windows(draft.split('\n').find((l) => /annual plan, cancelled within/i.test(l)) ?? '');

  it('finds the annual refund window in the draft, and refund claims on the site', () => {
    expect(draftWindow).toHaveLength(1);
    expect(refundSentences(text).length).toBeGreaterThan(0);
  });

  it('never states a window the draft does not set out', () => {
    for (const s of refundSentences(text)) for (const w of windows(s)) expect(w, s).toBe(draftWindow[0]);
  });

  it('never presents the refund as granted while the draft is not in force', () => {
    expect(draft).toMatch(/not in force|draft/i);
    for (const s of refundSentences(text).filter((x) => windows(x).length)) {
      expect(s, 'a refund window is stated without saying the policy is undecided').toMatch(/not decided|one option|option|weighing|draft/i);
    }
  });
});
