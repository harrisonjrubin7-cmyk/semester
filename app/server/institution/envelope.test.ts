import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, PlatformError, errorResponse, isErrorCode } from '../../../packages/platform/src/index.ts';
import { CODE_BY_STATUS, correlationIdFor } from './gateway.ts';

/**
 * The gateway's refusals, before and after it moved onto `@semester/platform`.
 *
 * MIGRATION phase 1 says the error builder is replaced "equivalence first": the
 * old one is held here **verbatim** as the golden, and every refusal the gateway
 * can make is fed through both. The gateway's own suite (`gateway.test.ts`,
 * which asserts the envelope on the wire and was not edited) is the other half
 * of the gate; this one says *why* it still passes — the bytes are the same,
 * not merely compatible.
 */

/** The builder as it stood before the move. Do not "fix" this: it is the thing the new one is measured against. */
const legacyRetryable = (status: number) => status === 429 || status === 503;
function legacyEnvelope(status: number, code: string, message: string, correlationId: string, userAction?: { label: string; kind: string; href?: string }) {
  const error: Record<string, unknown> = { code, message, correlation_id: correlationId, retryable: legacyRetryable(status) };
  if (userAction) error.user_action = userAction;
  return { error, message };
}

const platformEnvelope = (status: number, code: string, message: string, correlationId: string, userAction?: { label: string; kind: 'contact_support'; href?: string }) =>
  errorResponse(PlatformError.from(status, code, message, userAction ? { userAction } : {}), correlationId).body;

const CID = 'corr-12345678';
const ACTION = { label: 'Ask the institution to reconcile', kind: 'contact_support' as const };

/** Every code the gateway names beyond its status defaults, read off the source rather than re-typed here. */
const SOURCE = readFileSync(new URL('./gateway.ts', import.meta.url), 'utf8');
const SPECIFIC = [...new Set([...SOURCE.matchAll(/fail\(\d{3}, [^;]*?, '([a-z_-]+)'\)/g)].map((m) => m[1]).concat([...SOURCE.matchAll(/refuse\(\d{3}, '([a-z_-]+)'/g)].map((m) => m[1])))];

describe('the gateway envelope is byte-identical to the one it replaced', () => {
  it('for every status default, with and without a user action', () => {
    const statuses = Object.keys(CODE_BY_STATUS).map(Number);
    expect(statuses.length).toBeGreaterThanOrEqual(12);
    for (const status of statuses) {
      const code = CODE_BY_STATUS[status];
      for (const action of [undefined, ACTION]) {
        expect(JSON.stringify(platformEnvelope(status, code, 'A sentence.', CID, action)), `${status} ${code}`).toBe(JSON.stringify(legacyEnvelope(status, code, 'A sentence.', CID, action)));
      }
    }
  });

  it('for every specific code the source names, at every status it is used at', () => {
    expect(SPECIFIC.length, 'the scan found the specific codes').toBeGreaterThanOrEqual(12);
    for (const code of SPECIFIC) {
      for (const status of [400, 403, 404, 409, 410, 429, 502, 503]) {
        expect(JSON.stringify(platformEnvelope(status, code, 'S.', CID)), `${status} ${code}`).toBe(JSON.stringify(legacyEnvelope(status, code, 'S.', CID)));
      }
    }
  });

  it('control: the comparison can fail — a different retryable flag or a dropped user action is caught', () => {
    expect(JSON.stringify(platformEnvelope(502, 'outcome_uncertain', 'S.', CID))).not.toBe(JSON.stringify(legacyEnvelope(503, 'outcome_uncertain', 'S.', CID)));
    expect(JSON.stringify(platformEnvelope(404, 'not_found', 'S.', CID))).not.toBe(JSON.stringify(legacyEnvelope(404, 'not_found', 'S.', CID, ACTION)));
  });

  it('retryable is true at exactly 429 and 503, for every code, including the ones that share a name with another status', () => {
    for (const status of [400, 401, 403, 404, 409, 410, 413, 415, 500, 502]) {
      expect(platformEnvelope(status, 'outcome_uncertain', 'S.', CID).error.retryable, String(status)).toBe(false);
    }
    for (const status of [429, 503]) expect(platformEnvelope(status, 'read_only', 'S.', CID).error.retryable).toBe(true);
  });
});

describe('the gateway\'s status defaults agree with the platform catalogue', () => {
  it('every default code is in the catalogue at the same status (the one exception is the fallback "error")', () => {
    for (const [status, code] of Object.entries(CODE_BY_STATUS)) {
      expect(isErrorCode(code), `${status} ${code} is not a catalogue code`).toBe(true);
      expect(ERROR_CODES[code as keyof typeof ERROR_CODES].status, `${code}`).toBe(Number(status));
    }
  });

  it('every specific code the source names is one the platform will carry', () => {
    for (const code of SPECIFIC) expect(() => PlatformError.specific(409, code, 'x'), code).not.toThrow();
  });
});

describe('correlation ids still resolve exactly as before', () => {
  const req = (id?: string) => new Request('https://x.test/v1/status', { headers: id === undefined ? {} : { 'x-correlation-id': id } });
  const legacy = /^[A-Za-z0-9._:-]{8,128}$/;

  it('keeps a well-formed id and mints a plain UUID otherwise', () => {
    expect(correlationIdFor(req('client-chosen-1'))).toBe('client-chosen-1');
    const minted = correlationIdFor(req());
    expect(minted).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(legacy.test(minted)).toBe(true);
  });

  it('replaces the five malformed ids the gateway suite names, rather than echoing them', () => {
    for (const bad of ['short', 'has space in it', 'x'.repeat(200), '<script>alert(1)</script>', 'a'.repeat(7)]) {
      const out = correlationIdFor(req(bad));
      expect(out, bad).not.toBe(bad);
      expect(legacy.test(out)).toBe(true);
    }
  });
});
