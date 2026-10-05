import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INDIVIDUAL_PAID_ACQUISITION_ENABLED, PILOT_NOTE, plan, priceLine } from './plans';

const root = join(import.meta.dirname, '../../..');

describe('the current individual-sale boundary', () => {
  it('holds new paid acquisition and labels individual prices as planned', () => {
    expect(INDIVIDUAL_PAID_ACQUISITION_ENABLED).toBe(false);
    expect(PILOT_NOTE).toMatch(/planned, not on sale/i);
    expect(priceLine(plan('plus'))).toMatch(/\(planned\)$/);
    expect(priceLine(plan('pro'))).toMatch(/\(planned\)$/);
  });

  it('fails the server checkout closed independent of environment configuration', () => {
    const source = readFileSync(join(root, 'supabase/functions/billing-checkout/index.ts'), 'utf8');
    expect(source).toContain('individualPaidAcquisitionApproved = false');
    expect(source).toContain('liveEnabled: individualPaidAcquisitionApproved && billingOperationsRequested');
    expect(source).not.toMatch(/liveEnabled:\s*Deno\.env/);
  });

  it('does not advertise an available individual purchase on the public pricing surfaces', () => {
    const pages = readFileSync(join(root, 'app/src/site/pages.tsx'), 'utf8');
    const more = readFileSync(join(root, 'app/src/site/more.tsx'), 'utf8');
    const claims = readFileSync(join(root, 'app/src/lib/ops/claims.ts'), 'utf8');
    for (const text of [pages, more, claims]) {
      expect(text).not.toMatch(/Plus (?:can be|is) bought/i);
      expect(text).toMatch(/planned, not on sale|paid acquisition is held/i);
    }
  });
});
