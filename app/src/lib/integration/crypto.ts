/**
 * The few primitives the connector framework shares: HMAC, a comparison that
 * does not leak where two strings differ, and URL-safe encodings.
 *
 * WebCrypto only, so the same code runs in the gateway, the worker and the
 * browser tests. Nothing here logs, and nothing returns a secret it was given.
 */
const encoder = new TextEncoder();

const hex = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/**
 * Equal strings, compared in time that depends on the longer length and not on
 * the first byte that differs. A length mismatch is folded into the result
 * rather than returned early.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Base64Url(text: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))));
}

export function randomBase64Url(
  byteLength = 32,
  fill: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (b) => { crypto.getRandomValues(b); return b; },
): string {
  return base64Url(fill(new Uint8Array(byteLength)));
}
