import { test, eq } from './harness';
import { authorizeCall, validScopes, InstallRow } from '../src/lib/devAuth';

const now = new Date('2026-10-23T12:00:00Z');
const i = (o: Partial<InstallRow> = {}): InstallRow => ({ tenantId: 't1', appId: 'a1', scopes: ['catalog:read'], status: 'active', appStatus: 'sandbox', expiresAt: '2026-11-01T00:00:00Z', ...o });
const code = (d: ReturnType<typeof authorizeCall>) => (d.ok ? 'OK' : d.code);

test('granted scope on active install is allowed', () => eq(code(authorizeCall(i(), 'catalog:read', now)), 'OK'));
test('revoked install fails on the next call', () => eq(code(authorizeCall(i({ status: 'revoked' }), 'catalog:read', now)), 'REVOKED'));
test('suspended app fails even with active install', () => eq(code(authorizeCall(i({ appStatus: 'suspended' }), 'catalog:read', now)), 'APP_SUSPENDED'));
test('expired token fails', () => eq(code(authorizeCall(i({ expiresAt: '2026-10-01T00:00:00Z' }), 'catalog:read', now)), 'EXPIRED'));
test('ungranted scope fails', () => eq(code(authorizeCall(i(), 'sections:read', now)), 'SCOPE_NOT_GRANTED'));
test('unknown token fails', () => eq(code(authorizeCall(null, 'catalog:read', now)), 'NO_INSTALL'));
test('education-record scopes can never be granted', () => eq(typeof validScopes(['grades:read']), 'string'));
test('unknown scopes rejected, valid accepted', () => { eq(typeof validScopes(['x:y']), 'string'); eq(validScopes(['catalog:read', 'events:read']), null); });
