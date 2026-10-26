import { test, eq } from './harness';
import { checkUpload, decodeBase64, canRead, MAX_BYTES } from '../src/lib/fileRules';

test('a normal PDF is accepted (control)', () => eq(checkUpload('essay.pdf', 'application/pdf', 1000), null));
test('type, size, name and empty files are refused', () => {
  eq(typeof checkUpload('x.exe', 'application/x-msdownload', 10), 'string');
  eq(typeof checkUpload('x.html', 'text/html', 10), 'string');
  eq(typeof checkUpload('big.pdf', 'application/pdf', MAX_BYTES + 1), 'string');
  eq(checkUpload('edge.pdf', 'application/pdf', MAX_BYTES), null);
  eq(typeof checkUpload('../etc/passwd', 'text/plain', 10), 'string');
  eq(typeof checkUpload('  ', 'text/plain', 10), 'string');
  eq(typeof checkUpload('a.txt', 'text/plain', 0), 'string');
});
test('base64 decoding is strict', () => {
  eq(decodeBase64('aGVsbG8=')?.length, 5);
  eq(decodeBase64('aGVsbG8'), null);
  eq(decodeBase64('aGV$bG8='), null);
});
const now = new Date('2026-10-26T12:00:00Z');
const f = { owner: 'u1', deleted: false };
test('owner reads; others need a live grant', () => {
  eq(canRead(f, 'u1', [], now), true);
  eq(canRead(f, 'u2', [], now), false);
  eq(canRead(f, 'u2', [{ grantee: 'u2', expiresAt: '2026-11-01T00:00:00Z', revokedAt: null }], now), true);
  eq(canRead(f, 'u3', [{ grantee: 'u2', expiresAt: '2026-11-01T00:00:00Z', revokedAt: null }], now), false);
});
test('revoked or expired grants and deleted files are denied', () => {
  eq(canRead(f, 'u2', [{ grantee: 'u2', expiresAt: '2026-11-01T00:00:00Z', revokedAt: '2026-10-20T00:00:00Z' }], now), false);
  eq(canRead(f, 'u2', [{ grantee: 'u2', expiresAt: '2026-10-25T00:00:00Z', revokedAt: null }], now), false);
  eq(canRead({ owner: 'u1', deleted: true }, 'u1', [], now), false);
});
