import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { plan } from './plans';

const root = join(import.meta.dirname, '../../..');
const html = readFileSync(join(root, 'company-site/index.html'), 'utf8');
const js = readFileSync(join(root, 'company-site/site.js'), 'utf8');

/**
 * The pricing page printed "save 37%" while the catalog's own two prices
 * ($7.99 a month, $59 a year) give 38.5%. The figure sat in markup nothing
 * compared with `plans.ts`, which is how the two prices drifted before (D-134).
 * A saving may be understated, never overstated, so the label is the computed
 * figure rounded down.
 */
describe('company-site Plus pricing', () => {
  const price = plan('plus').price!;

  it('states the annual saving the catalog prices actually give', () => {
    const printed = Number(/Annual · save (\d+)%/.exec(html)?.[1]);
    const computed = Math.floor((1 - price.yearly / (price.monthly * 12)) * 100);
    expect(printed).toBe(computed);
  });

  it('shows the catalog prices in the toggle and the commercial terms', () => {
    expect(js).toContain(`$${price.monthly}<small> / month</small>`);
    expect(js).toContain(`$${price.yearly}<small> / year</small>`);
    expect(html).toContain(`$${price.monthly} a month or $${price.yearly} a year (planned; not yet on sale)`);
  });
});
