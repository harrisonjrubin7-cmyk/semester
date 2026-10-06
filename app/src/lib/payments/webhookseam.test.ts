/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(join(__dirname, '../../../../supabase/functions/_shared/billingwebhook.ts'), 'utf8');

/** Source with comments and string contents removed, so prose and messages do not trip a rule about code. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');

/** Things only a reader of Stripe's event shape or a verifier of its signature would name. */
const OWN_READING = /\b(verifySignature|mapSubscriptionStatus|isoFromSeconds|sha256Hex|JSON\.parse|total_taxes|total_tax_amounts|client_reference_id|amount_refunded|automatic_tax|subscription_details|current_period_end|requires_location_inputs)\b/;

describe('the billing webhook handler, as a file', () => {
  it('reads and verifies events only through the Stripe adapter', () => {
    const found = code(SRC).match(new RegExp(OWN_READING.source, 'g')) ?? [];
    expect(found, `billingwebhook.ts names ${found.join(', ')}; that reading belongs in payments/`).toEqual([]);
  });

  it('imports the adapter that does it', () => {
    expect(SRC).toMatch(/from '\.\/payments\/stripeadapter\.ts'/);
    expect(SRC).toMatch(/adapter\.verifyWebhook\(/);
    expect(SRC).toMatch(/adapter\.normalize\(/);
  });

  it('answers each refusal in the sentence it always used', () => {
    // The three signature failures stay one sentence: the endpoint never says why.
    expect(SRC).toMatch(/missing: 'Invalid signature\.', stale: 'Invalid signature\.', mismatch: 'Invalid signature\.'/);
  });

  it('control: the scan finds a planted reading of Stripe’s event shape', () => {
    const planted = "const tax = o.total_taxes; const ok = await verifySignature(raw, h, s, n);";
    expect((code(planted).match(new RegExp(OWN_READING.source, 'g')) ?? []).length).toBe(2);
  });
});
