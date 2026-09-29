import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkoutEndpoint, startCheckout } from './membership';

/**
 * Nothing may say Plus cannot be bought while the app can sell it.
 *
 * D-128 put a checkout on the Account screen; for a day afterwards the known
 * limitations, three claims, two pricing sentences, the site's membership
 * preview and two tests still said "no checkout". The tests defended the old
 * claim, so fixing the copy turned them red. This holds every place that
 * speaks to a reader to what the code does: while `startCheckout` exists, the
 * stale sentences are refused, wherever they are.
 */
const root = join(import.meta.dirname, '../../..');

const STALE: readonly RegExp[] = [
  /nothing is for sale, and nothing can be bought/i,
  /there is no checkout and no billing/i,
  /no billing provider and no checkout/i,
  /no billing exists yet/i,
  /shown here once checkout exists/i,
  /paid plans are not on sale yet/i,
  /plus and pro are not on sale yet/i,
  /nothing is on sale/i,
  /there is no checkout on this site/i,
];
const stale = (text: string) => STALE.filter((re) => re.test(text)).map(String);

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

describe('the copy about buying Semester', () => {
  it('has a checkout to be honest about', () => {
    expect(typeof startCheckout).toBe('function');
    expect(checkoutEndpoint('https://x.supabase.co')).toContain('/functions/v1/billing-checkout');
  });

  it('can tell a stale sentence from a true one', () => {
    expect(stale('Nothing is for sale, and nothing can be bought.')).toHaveLength(1);
    expect(stale('Paid plans are not on sale yet.')).toHaveLength(1);
    expect(stale('Plus can be bought from the Account screen; Pro is not on sale yet.')).toEqual([]);
    expect(stale('Nothing can be bought on this site.')).toEqual([]);
  });

  it('is not contradicted by the app, the site, the company site or the pilot documents', () => {
    const files = [
      ...walk(join(root, 'app/src')),
      join(root, 'company-site/index.html'),
      join(root, 'docs/pilot/KNOWN-LIMITATIONS.md'),
      join(root, 'ops/claims/README.md'),
    ];
    const found = files.flatMap((f) => stale(readFileSync(f, 'utf8')).map((re) => `${f.replace(root, '')}: ${re}`));
    expect(found).toEqual([]);
  });
});
