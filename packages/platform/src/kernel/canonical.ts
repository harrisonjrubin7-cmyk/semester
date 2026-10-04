/**
 * Canonical JSON and SHA-256, the two things every hash in this package is
 * made of: the audit chain, the idempotency request hash, cursor binding.
 *
 * Canonical means keys sorted at every depth and `undefined` dropped, so two
 * objects that mean the same thing hash the same whichever order a client
 * wrote the keys in. A hash over `JSON.stringify` alone would call a replayed
 * request a conflicting one the first time a client library reordered a field.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sorted(value));
}

function sorted(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : sorted(v)));
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== undefined) out[key] = sorted(v);
  }
  return out;
}

const HEX = '0123456789abcdef';

export const toHex = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += HEX[b >> 4] + HEX[b & 15];
  return s;
};

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toHex(new Uint8Array(digest));
}

export const hashOf = (value: unknown): Promise<string> => sha256Hex(canonicalJson(value));

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  try {
    const bin = atob(padded);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/** HMAC-SHA-256. The key is imported per call; callers cache nothing secret. */
export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data as BufferSource));
}

/** Constant-time comparison of two byte strings of any length. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
