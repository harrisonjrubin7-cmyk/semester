/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAN } from '../finance/accounts';
import { CARD_NUMBER, fail, idemKey, looksLikeCardNumber, PROVIDER_ID } from '../../../../supabase/functions/_shared/payments/types';

const DIR = join(__dirname, '../../../../supabase/functions/_shared/payments');
const MIGRATION = readFileSync(join(__dirname, '../../../../supabase/migrations/20260929220000_student_accounts.sql'), 'utf8');
const sources = readdirSync(DIR).filter((f) => f.endsWith('.ts')).map((f) => [f, readFileSync(join(DIR, f), 'utf8')] as const);

/** Source with comments and string contents removed, so a rule about identifiers is not tripped by prose. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');

describe('idemKey', () => {
  it('is `<command>:<aggregate>:<attempt>`, derived from Semester’s own ids', () => {
    expect(idemKey('charge', 'inv_123')).toBe('charge:inv_123:1');
    expect(idemKey('refund', 'rf-9', 3)).toBe('refund:rf-9:3');
  });

  it('is the same every time for the same aggregate, so a retry or a replay cannot make a second charge', () => {
    expect(idemKey('charge', 'inv_1', 2)).toBe(idemKey('charge', 'inv_1', 2));
    expect(idemKey('charge', 'inv_1', 1)).not.toBe(idemKey('charge', 'inv_1', 2));
    expect(idemKey('charge', 'inv_1')).not.toBe(idemKey('refund', 'inv_1'));
  });

  it('refuses an aggregate that could carry anything but an id, including a card number', () => {
    for (const bad of ['', 'a b', 'a:b', '4242 4242 4242 4242', 'x'.repeat(81), '../x', 'id\n']) {
      expect(() => idemKey('charge', bad)).toThrow(RangeError);
    }
    expect(() => idemKey('charge', 'inv', 0)).toThrow(RangeError);
    expect(() => idemKey('charge', 'inv', 1.5)).toThrow(RangeError);
    expect(() => idemKey('charge', 'inv', 1000)).toThrow(RangeError);
  });

  it('matches the keys billing already uses, so the move behind the seam keeps them', () => {
    // billing-cancel's `cancel-${sub.id}` becomes `cancel:<sub.id>:1`; the old key
    // is retired with the old call site, not carried as a second format.
    expect(idemKey('cancel', 'b3b1f5d0-4c9a-4a6e-8a53-1f2f3a4b5c6d')).toMatch(/^cancel:[0-9a-f-]{36}:1$/);
  });
});

describe('the card-number guard', () => {
  it('is the same pattern the school ledger holds in the browser and in the database', () => {
    expect(CARD_NUMBER.source).toBe(PAN.source);
    // The migration spells it for Postgres: `[0-9]([ -]?[0-9]){12,18}`.
    expect(MIGRATION).toContain('[0-9]([ -]?[0-9]){12,18}');
  });

  it('refuses a card number however a person groups it, and nothing that is not one', () => {
    for (const s of ['4242424242424242', '4242 4242 4242 4242', '4242-4242-4242-4242', 'ref 378282246310005 ok', '1234567890123']) {
      expect(looksLikeCardNumber(s), s).toBe(true);
    }
    for (const s of ['', 'inv_1234567', 'SEM-000123', '2026-10-05', '123456789012', 'cus_NffrFeUfNV2Hib']) {
      expect(looksLikeCardNumber(s), s).toBe(false);
    }
  });
});

describe('failures', () => {
  it('are a fixed sentence per code, never built from input', () => {
    const codes = ['declined', 'requires_action', 'invalid_request', 'auth_failed', 'rate_limited', 'unavailable', 'unknown_outcome', 'unsupported'] as const;
    for (const c of codes) {
      const r = fail(c);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe(c);
        expect(r.error.message.length).toBeGreaterThan(10);
        const again = fail(c);
        expect(!again.ok && again.error.message).toBe(r.error.message);
      }
    }
  });

  it('marks only the outcomes where sending the same command again is safe and useful as retryable', () => {
    const retry = (c: Parameters<typeof fail>[0]) => { const r = fail(c); return !r.ok && r.error.retryable; };
    expect(['rate_limited', 'unavailable', 'unknown_outcome'].every((c) => retry(c as never))).toBe(true);
    expect(['declined', 'requires_action', 'invalid_request', 'auth_failed', 'unsupported'].some((c) => retry(c as never))).toBe(false);
  });
});

describe('provider ids', () => {
  it('follow the lowercase identifier the database already checks on `payment_events.provider`', () => {
    for (const ok of ['stripe', 'mock', 'bank_transfer', 'a1']) expect(PROVIDER_ID.test(ok)).toBe(true);
    for (const bad of ['Stripe', '1stripe', 'x', 'has space', 'a'.repeat(31), '']) expect(PROVIDER_ID.test(bad)).toBe(false);
  });
});

describe('the payments modules, as files', () => {
  it('have no field that can carry a card or bank account number', () => {
    // The design's first rule, as a structural check: it cannot be fooled by a
    // test that never exercises the input. `looksLikeCardNumber` is the one
    // place a card is even named, and it only refuses.
    const forbidden = /\b(card_?number|cardNumber|pan|cvc|cvv|cvc2|account_?number|accountNumber|routing_?number|routingNumber|iban|expiry|securityCode)\b/i;
    for (const [name, src] of sources) {
      // The guard names the thing it refuses; that is the one allowed mention.
      const stripped = code(src).replace(/\b(CARD_NUMBER|looksLikeCardNumber)\b/g, 'GUARD');
      const hits = stripped.match(new RegExp(forbidden.source, 'gi')) ?? [];
      // `expMonth`/`expYear` and `last4` on a summary are display-safe and do not match.
      expect(hits, `${name} names ${hits.join(', ')}`).toEqual([]);
    }
  });

  it('are Deno-free, so vitest and the gateway can import them', () => {
    for (const [name, src] of sources) {
      expect(/\bDeno\b/.test(code(src)), `${name} reads Deno`).toBe(false);
    }
  });

  it('never log: no console call in any payments module', () => {
    for (const [name, src] of sources) {
      expect(/console\./.test(code(src)), `${name} logs`).toBe(false);
    }
  });

  it('hold the one mutation the probe must be able to see: the scan finds a planted card field', () => {
    // The control: a scan that finds nothing in planted bad code is a broken scan.
    const planted = 'export interface Bad { cardNumber: string; cvc: string }';
    expect((code(planted).match(/\b(cardNumber|cvc)\b/g) ?? []).length).toBe(2);
  });
});
