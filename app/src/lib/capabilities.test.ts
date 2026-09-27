import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { forSchool, readGrants } from './capabilities';
import { OPERATIONS_CAPABILITY, operationsAllowed } from './institution-ops';
import { TENANT_ADMIN_CAPABILITY, controlPlaneView } from './control-plane';

/**
 * What the app is told it may offer. The database half — that the function
 * agrees with private.has_capability — is `supabase/my-capabilities.check.sql`.
 */

const g = (capability: string, scopeKind: string, scopeId = '') => ({ capability, scopeKind, scopeId });

describe('capabilities over a school', () => {
  it('counts a grant over exactly this school, and nothing else — not even the platform', () => {
    const grants = [
      g('outcomes:read', 'school', 'vanderbilt'),
      g('report:read', 'platform'),
      g('tenant:configure', 'school', 'other-u'),
      g('mentee:read', 'cohort', 'vanderbilt/2030'),
    ];
    expect(forSchool(grants, 'vanderbilt')).toEqual(['outcomes:read']);
    expect(forSchool(grants, '')).toEqual([]);
  });

  it('opens Operations for outcomes:read over the school — and not for a grant at another school', () => {
    expect(operationsAllowed(forSchool([g(OPERATIONS_CAPABILITY, 'school', 'vanderbilt')], 'vanderbilt'))).toBe(true);
    expect(operationsAllowed(forSchool([g(OPERATIONS_CAPABILITY, 'school', 'other-u')], 'vanderbilt'))).toBe(false);
  });

  it('does not open Operations for a platform grant, which no school policy honours', () => {
    expect(operationsAllowed(forSchool([g(OPERATIONS_CAPABILITY, 'platform')], 'vanderbilt'))).toBe(false);
  });

  it('lets the Control tab edit on tenant:configure, and no longer on the capability that never existed', () => {
    const view = (capability: string) =>
      controlPlaneView({
        tenantId: 'v', viewedTenantId: 'v', featureState: 'sandbox', gatewayStatus: 'sandbox tested',
        verifiedCapabilities: [{ tenantId: 'v', capability, verified: true }],
        approvedSourceCount: 0, activeConsentCount: 0, auditEventCount: 0,
      }).canEdit;
    expect(view(TENANT_ADMIN_CAPABILITY)).toBe(true);
    expect(view('tenant_admin')).toBe(false);
  });

  it('names a capability the migrations define and the tenant policy table actually requires', () => {
    const dir = new URL('../../../supabase/migrations/', import.meta.url);
    const sql = readdirSync(dir).map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
    expect(sql).toMatch(new RegExp(`\\('${TENANT_ADMIN_CAPABILITY}',`));
    expect(sql).toMatch(new RegExp(`on public\\.tenant_feature_policy[\\s\\S]{0,200}has_capability\\('${TENANT_ADMIN_CAPABILITY}'`));
  });

  it('reads nothing it does not understand', () => {
    expect(readGrants(null)).toEqual([]);
    expect(readGrants([{ capability: 'x' }, { capability: 'a', scope_kind: 'platform', scope_id: '' }])).toEqual([g('a', 'platform')]);
  });
});
