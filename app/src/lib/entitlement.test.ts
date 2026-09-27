import { describe, expect, it } from 'vitest';
import { ENTITLEMENT_STEPS, resolveEntitlement, type EntitlementRequest } from '../../../supabase/functions/_shared/entitlement';

const now = new Date('2026-09-27T12:00:00Z');

const allowed = (): EntitlementRequest => ({
  now,
  killSwitched: false,
  environment: 'staging',
  moduleEnvironments: ['local', 'staging'],
  module: 'research',
  tenant: { planStatus: 'active', planEndsAt: '2027-06-30T00:00:00Z', modules: ['research'], requireSso: true },
  session: { viaInstitutionSso: true },
  membership: { status: 'active' },
  capabilities: ['research:use'],
  requiredCapability: 'research:use',
  course: { id: 'course-1', inScope: ['course-1'], policy: 'guided' },
  dataTier: 2,
  maxDataTier: 3,
  usage: { used: 4, allowance: 10 },
});

/** One mutation per step, each breaking exactly that step and nothing earlier. */
const breaks: Record<(typeof ENTITLEMENT_STEPS)[number], (r: EntitlementRequest) => void> = {
  'kill-switch': (r) => { r.killSwitched = true; },
  environment: (r) => { r.environment = 'production'; },
  'tenant-plan': (r) => { r.tenant.planEndsAt = '2026-09-01T00:00:00Z'; },
  module: (r) => { r.tenant.modules = []; },
  'sso-policy': (r) => { r.session.viaInstitutionSso = false; },
  lifecycle: (r) => { r.membership = { status: 'deprovisioned' }; },
  capability: (r) => { r.capabilities = []; },
  'course-scope': (r) => { r.course!.inScope = []; },
  'course-policy': (r) => { r.course!.policy = 'prohibited'; },
  'data-classification': (r) => { r.dataTier = 5; },
  'individual-plan': (r) => {
    r.tenant.modules = [];
    r.personal = { modules: ['research'], expiresAt: '2026-09-26T00:00:00Z' };
  },
  'usage-allowance': (r) => { r.usage = { used: 10, allowance: 10 }; },
};

describe('entitlement resolution', () => {
  it('allows the control request from the tenant plan', () => {
    expect(resolveEntitlement(allowed())).toEqual({ allowed: true, source: 'tenant' });
  });

  it.each(ENTITLEMENT_STEPS.map((step) => [step]))('refuses at %s and names it', (step) => {
    const request = allowed();
    breaks[step](request);
    expect(resolveEntitlement(request)).toMatchObject({ allowed: false, step });
  });

  it('reports the earliest refusal when several steps fail', () => {
    const request = allowed();
    breaks.capability(request);
    breaks.lifecycle(request);
    breaks['usage-allowance'](request);
    expect(resolveEntitlement(request)).toMatchObject({ allowed: false, step: 'lifecycle' });
  });

  it('lets a current personal or sponsored grant supply a module the tenant lacks', () => {
    const request = allowed();
    request.tenant.modules = [];
    request.personal = { modules: ['research'], expiresAt: '2027-01-01T00:00:00Z' };
    expect(resolveEntitlement(request)).toEqual({ allowed: true, source: 'personal' });
  });

  it('never lets a personal grant stand in for lifecycle or capability', () => {
    const request = allowed();
    request.personal = { modules: ['research'] };
    request.membership = { status: 'suspended' };
    expect(resolveEntitlement(request)).toMatchObject({ allowed: false, step: 'lifecycle' });
  });

  it('treats a malformed data tier as unclassified T3, not as T0', () => {
    const request = allowed();
    request.dataTier = Number.NaN;
    request.maxDataTier = 2;
    expect(resolveEntitlement(request)).toMatchObject({ allowed: false, step: 'data-classification' });
  });
});
