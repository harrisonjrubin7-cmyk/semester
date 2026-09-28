/// <reference types="node" />
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  formEncode, hmacSha256Hex, mapSubscriptionStatus, parseSignatureHeader, sha256Hex, timingSafeEqual, verifySignature,
} from '../../../../supabase/functions/_shared/stripe';
import { strictCorsHeaders, strictOrigin } from '../../../../supabase/functions/_shared/cors';

/*
 * A known vector, computed outside this code (Python's hmac/hashlib) so the
 * test is not the implementation checking itself:
 *
 *   secret  whsec_test_semester_vector
 *   t       1790000000
 *   body    {"id":"evt_1","type":"invoice.paid"}
 *   v1      HMAC-SHA256(secret, "1790000000." + body)
 */
const SECRET = 'whsec_test_semester_vector';
const T = 1790000000;
const BODY = '{"id":"evt_1","type":"invoice.paid"}';
const V1 = '739c98814aba78fb7ae8ce31d4226113f68323ae9da10fc7ba0e9edebb9c585b';
const BODY_SHA = 'd0d68fc7e872c5939afbebc3266f9bf866148a28a9b90b787c8caacc700c6bc6';

describe('the webhook signature', () => {
  it('matches a vector computed independently', async () => {
    expect(await hmacSha256Hex(SECRET, `${T}.${BODY}`)).toBe(V1);
    // And Node's own implementation agrees, as a second opinion.
    expect(createHmac('sha256', SECRET).update(`${T}.${BODY}`).digest('hex')).toBe(V1);
    expect(await sha256Hex(BODY)).toBe(BODY_SHA);
  });

  it('accepts the genuine header', async () => {
    expect(await verifySignature(BODY, `t=${T},v1=${V1}`, SECRET, T + 10)).toBe('ok');
  });

  it('accepts it when a second v1 is present while a secret is rolled', async () => {
    expect(await verifySignature(BODY, `t=${T},v1=${'0'.repeat(64)},v1=${V1},v0=abc`, SECRET, T)).toBe('ok');
  });

  it('refuses a body changed by one character', async () => {
    expect(await verifySignature(BODY.replace('paid', 'pAid'), `t=${T},v1=${V1}`, SECRET, T)).toBe('mismatch');
  });

  it('refuses the right body re-serialised, because the raw bytes are what is signed', async () => {
    const reparsed = JSON.stringify(JSON.parse(BODY), null, 1);
    expect(await verifySignature(reparsed, `t=${T},v1=${V1}`, SECRET, T)).toBe('mismatch');
  });

  it('refuses the wrong secret', async () => {
    expect(await verifySignature(BODY, `t=${T},v1=${V1}`, 'whsec_other', T)).toBe('mismatch');
  });

  it('refuses a timestamp more than five minutes away, either side', async () => {
    expect(await verifySignature(BODY, `t=${T},v1=${V1}`, SECRET, T + 300)).toBe('ok');
    expect(await verifySignature(BODY, `t=${T},v1=${V1}`, SECRET, T + 301)).toBe('stale');
    expect(await verifySignature(BODY, `t=${T},v1=${V1}`, SECRET, T - 301)).toBe('stale');
  });

  it('refuses a missing or malformed header', async () => {
    for (const h of [null, '', `v1=${V1}`, `t=${T}`, `t=abc,v1=${V1}`, `t=${T},v1=nothex`, `t=${T},v0=${V1}`]) {
      expect(await verifySignature(BODY, h, SECRET, T), String(h)).toBe('missing');
    }
    expect(parseSignatureHeader(` t=${T} , v1=${V1} `)).toEqual({ t: T, v1: [V1] });
  });

  it('compares in constant time over equal lengths', () => {
    expect(timingSafeEqual(V1, V1)).toBe(true);
    expect(timingSafeEqual(V1, V1.slice(0, -1) + '0')).toBe(false);
    expect(timingSafeEqual(V1, V1.slice(1))).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });
});

describe('reading the provider', () => {
  it('maps every subscription status onto Semester’s vocabulary', () => {
    expect(mapSubscriptionStatus('active')).toBe('active');
    expect(mapSubscriptionStatus('trialing')).toBe('trialing');
    expect(mapSubscriptionStatus('past_due')).toBe('past_due');
    expect(mapSubscriptionStatus('unpaid')).toBe('past_due');
    expect(mapSubscriptionStatus('canceled')).toBe('ended');
    expect(mapSubscriptionStatus('incomplete_expired')).toBe('ended');
    expect(mapSubscriptionStatus('something_new')).toBeNull();
  });

  it('form-encodes nested parameters the way the API reads them', () => {
    expect(formEncode({ mode: 'subscription', line_items: [{ quantity: 1, price_data: { recurring: { interval: 'month' } } }], skip: undefined }))
      .toBe('mode=subscription&line_items%5B0%5D%5Bquantity%5D=1&line_items%5B0%5D%5Bprice_data%5D%5Brecurring%5D%5Binterval%5D=month');
  });
});

describe('strict CORS, for the functions that fail closed', () => {
  const SITE = 'https://semester.example';

  it('allows only an origin named explicitly', () => {
    expect(strictOrigin(`${SITE}/, http://localhost:5173`, SITE)).toBe(SITE);
    expect(strictOrigin(`${SITE}, http://localhost:5173`, 'http://localhost:5173')).toBe('http://localhost:5173');
  });

  it('allows nobody when nothing is configured, when the list is *, or with no Origin', () => {
    expect(strictOrigin(undefined, SITE)).toBeNull();
    expect(strictOrigin('', SITE)).toBeNull();
    expect(strictOrigin('*', SITE)).toBeNull();
    expect(strictOrigin(SITE, null)).toBeNull();
    expect(strictOrigin(SITE, 'https://evil.example')).toBeNull();
  });

  it('sends no Allow-Origin header at all to an origin it refused', () => {
    expect(strictCorsHeaders(SITE, 'https://evil.example')).not.toHaveProperty('Access-Control-Allow-Origin');
    expect(strictCorsHeaders(undefined, SITE)).not.toHaveProperty('Access-Control-Allow-Origin');
    expect(strictCorsHeaders(SITE, SITE)['Access-Control-Allow-Origin']).toBe(SITE);
  });
});
