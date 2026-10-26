// Developer app authorization. Pure; unit-tested in tests/devAuth.test.ts.
export const SCOPES = {
  'catalog:read': 'Read published course catalog (synthetic in sandbox)',
  'sections:read': 'Read section times and capacity (synthetic in sandbox)',
  'events:read': 'Read public campus events (synthetic in sandbox)',
} as const;
export type Scope = keyof typeof SCOPES;
// Never grantable to third-party apps: education records, grades, enrollment writes, money.
export const FORBIDDEN_SCOPES = ['grades:read', 'enrollments:write', 'records:read', 'payments:write'];

export type InstallRow = { tenantId: string; appId: string; scopes: string[]; status: 'active' | 'revoked'; appStatus: 'sandbox' | 'suspended'; expiresAt: string | null };
export type Decision = { ok: true } | { ok: false; code: 'NO_INSTALL' | 'REVOKED' | 'APP_SUSPENDED' | 'EXPIRED' | 'SCOPE_NOT_GRANTED' | 'UNKNOWN_SCOPE'; message: string };

export function validScopes(scopes: string[]): string | null {
  const bad = scopes.filter((s) => !(s in SCOPES));
  if (bad.some((s) => FORBIDDEN_SCOPES.includes(s))) return `Scope ${bad.join(', ')} can never be granted to an app.`;
  if (bad.length) return `Unknown scope: ${bad.join(', ')}.`;
  if (!scopes.length) return 'Choose at least one scope.';
  return null;
}

/** Checked on EVERY call, so a revocation applies to the very next request. */
export function authorizeCall(install: InstallRow | null, scope: string, now: Date): Decision {
  if (!(scope in SCOPES)) return { ok: false, code: 'UNKNOWN_SCOPE', message: 'Unknown scope.' };
  if (!install) return { ok: false, code: 'NO_INSTALL', message: 'Token is not valid for any installation.' };
  if (install.status === 'revoked') return { ok: false, code: 'REVOKED', message: 'This installation was revoked.' };
  if (install.appStatus === 'suspended') return { ok: false, code: 'APP_SUSPENDED', message: 'This app is suspended.' };
  if (install.expiresAt && new Date(install.expiresAt) <= now) return { ok: false, code: 'EXPIRED', message: 'This token has expired.' };
  if (!install.scopes.includes(scope)) return { ok: false, code: 'SCOPE_NOT_GRANTED', message: `Scope ${scope} was not granted.` };
  return { ok: true };
}
