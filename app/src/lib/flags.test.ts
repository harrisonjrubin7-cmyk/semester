import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FLAGS, KILL_SWITCHES, evaluateFlag, type FlagContext } from './flags';
import { capabilityDefinition } from './governance/capability-governance';
import { evaluateActivation, type ActivationReceipt } from './governance/activation';

const NOW = new Date('2026-10-01T12:00:00Z');

function ctx(over: Partial<FlagContext> = {}): FlagContext {
  return {
    environment: 'production',
    tenantId: 'vu',
    now: NOW,
    killSwitches: [],
    tenantPolicy: {},
    capabilities: [],
    ...over,
  };
}

const DASHBOARD_ON: FlagContext['tenantPolicy'] = {
  'module.integration_dashboard': { state: 'production', permittedRoles: [], permittedCohorts: [] },
  'release.integration_dashboard_v1': { state: 'production', permittedRoles: [], permittedCohorts: [] },
};

const LTI_LIVE: Partial<FlagContext> = {
  tenantPolicy: {
    'integration.lms_lti': { state: 'production', permittedRoles: [], permittedCohorts: [] },
    'scope.lms.assignment_dates_read': { state: 'production', permittedRoles: [], permittedCohorts: [] },
  },
  connection: { publicId: 'conn_0123456789abcdef0123', approved: true, status: 'healthy' },
  scopes: [{ key: 'scope.lms.assignment_dates_read', approved: true }],
};

const GRADE_POLICY: FlagContext['tenantPolicy'] = {
  'integration.lms_lti': { state: 'production', permittedRoles: [], permittedCohorts: [] },
  'writeback.lms_grade_passback': { state: 'production', permittedRoles: ['instructor'], permittedCohorts: ['pilot'] },
};
const GRADE_READY: Partial<FlagContext> = {
  tenantPolicy: GRADE_POLICY,
  connection: { publicId: 'conn_0123456789abcdef0123', approved: true, status: 'healthy' },
  scopes: [{ key: 'scope.lms.score_publish', approved: true }],
  role: 'instructor', cohorts: ['pilot'], classification: 'T2',
  courseRule: { allowed: true }, userEligible: true,
};
function receipt(over: Partial<ActivationReceipt> = {}): ActivationReceipt {
  return {
    decisionKey: 'activation:v1:test', requestId: 'request-1', tenantId: 'vu',
    capabilityId: 'CAP-020', operation: 'writeback.lms_grade_passback',
    policyVersion: 'policy-1', configurationVersion: 1,
    issuedAt: '2026-10-01T11:45:00Z', expiresAt: '2026-10-01T12:15:00Z',
    ...over,
  };
}

describe('the registry', () => {
  it('has unique keys, each prefixed by its type', () => {
    const keys = FLAGS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    const prefix = { module: 'module.', connector: 'integration.', scope: 'scope.', release: 'release.',
      experiment: 'experiment.', ops: 'ops.', safety: 'safety.', writeback: 'writeback.' };
    for (const f of FLAGS) expect(f.key.startsWith(prefix[f.type]), f.key).toBe(true);
  });

  it('defaults every flag off, with an owner, a review date and a rollback', () => {
    for (const f of FLAGS) {
      expect(f.defaultEnabled, f.key).toBe(false);
      expect(f.owner.length, f.key).toBeGreaterThan(0);
      expect(f.rollback.length, f.key).toBeGreaterThan(0);
      expect(f.successCriteria.length, f.key).toBeGreaterThan(0);
      expect(new Date(f.reviewAt) > new Date(f.created), f.key).toBe(true);
    }
  });

  it('gives every temporary flag an expiry after its review', () => {
    for (const f of FLAGS.filter((x) => x.type === 'release' || x.type === 'experiment')) {
      expect(f.expiresAt, f.key).toBeTruthy();
      expect(new Date(f.expiresAt!) > new Date(f.reviewAt), f.key).toBe(true);
    }
  });

  it('marks every connector, scope, write-back and safety flag high-risk', () => {
    for (const f of FLAGS.filter((x) => ['connector', 'scope', 'writeback', 'safety'].includes(x.type))) {
      expect(f.highRisk, f.key).toBe(true);
    }
  });

  it('binds every flag to at least one canonical capability', () => {
    for (const f of FLAGS) {
      expect(f.capabilityIds.length, f.key).toBeGreaterThan(0);
      for (const id of f.capabilityIds) expect(capabilityDefinition(id), `${f.key}: ${id}`).toBeDefined();
    }
    const minimum: Record<string, readonly string[]> = {
      'writeback.registration_submit': ['CAP-050'],
      'writeback.lms_grade_passback': ['CAP-020', 'CAP-021', 'CAP-030'],
      'module.dining': ['CAP-047'],
      'integration.degree_audit_read': ['CAP-044'],
      'integration.erp_bursar_actions': ['CAP-046'],
      'ops.external_ai_generation': ['CAP-027'],
    };
    for (const [key, ids] of Object.entries(minimum)) {
      expect(FLAGS.find((flag) => flag.key === key)?.capabilityIds, key).toEqual(ids);
    }
  });

  it('names only kill switches the database accepts', () => {
    const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20260930010000_module_mode.sql'), 'utf8');
    for (const k of KILL_SWITCHES) expect(sql, k).toContain(`'${k}'`);
    for (const f of FLAGS) for (const k of f.killSwitches) expect(KILL_SWITCHES, f.key).toContain(k);
  });

  it('is written down, key for key, in docs/FEATURE-FLAG-REGISTRY.md', () => {
    const doc = readFileSync(resolve(__dirname, '../../../docs/FEATURE-FLAG-REGISTRY.md'), 'utf8');
    for (const f of FLAGS) expect(doc, f.key).toContain(`\`${f.key}\``);
    for (const k of KILL_SWITCHES) expect(doc, k).toContain(`\`${k}\``);
  });
});

describe('evaluation', () => {
  it('refuses a key nobody registered', () => {
    expect(evaluateFlag('module.nope', ctx())).toMatchObject({ allowed: false, step: 'unknown_flag' });
  });

  it('is off when nothing has been set (the disabled state)', () => {
    for (const f of FLAGS) expect(evaluateFlag(f.key, ctx({ capabilities: ['integration:view'] })).allowed, f.key).toBe(false);
  });

  it('turns the dashboard on for a school that enabled it and a verified viewer', () => {
    const d = evaluateFlag('release.integration_dashboard_v1', ctx({ tenantPolicy: DASHBOARD_ON, capabilities: ['integration:view'] }));
    expect(d).toMatchObject({ allowed: true, step: 'allowed' });
  });

  it('is tenant-scoped: another school’s policy does not apply', () => {
    const d = evaluateFlag('release.integration_dashboard_v1', ctx({ tenantId: null, tenantPolicy: DASHBOARD_ON, capabilities: ['integration:view'] }));
    expect(d.step).toBe('environment');
  });

  it('needs the parent module as well as the flag', () => {
    const d = evaluateFlag('release.integration_dashboard_v1', ctx({
      tenantPolicy: { 'release.integration_dashboard_v1': { state: 'production', permittedRoles: [], permittedCohorts: [] } }, capabilities: ['integration:view'] }));
    expect(d).toMatchObject({ allowed: false, step: 'tenant_entitlement' });
  });

  it('treats preview as off in production and on in a preview environment', () => {
    const policy = { 'module.integration_dashboard': { state: 'preview' as const, permittedRoles: [], permittedCohorts: [] }, 'release.integration_dashboard_v1': { state: 'preview' as const, permittedRoles: [], permittedCohorts: [] } };
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ tenantPolicy: policy, capabilities: ['integration:view'] })).allowed).toBe(false);
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ environment: 'preview', tenantPolicy: policy, capabilities: ['integration:view'] })).allowed).toBe(true);
  });

  it('is role-scoped: without the verified capability it is refused', () => {
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ tenantPolicy: DASHBOARD_ON })))
      .toMatchObject({ allowed: false, step: 'capability' });
  });

  it('honours a tenant’s permitted roles', () => {
    const policy = { ...DASHBOARD_ON, 'release.integration_dashboard_v1': { state: 'production' as const, permittedRoles: ['integration_admin'], permittedCohorts: [] } };
    const base = { tenantPolicy: policy, capabilities: ['integration:view'] };
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ ...base, role: 'university_admin' })).step).toBe('role_policy');
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ ...base, role: 'integration_admin' })).allowed).toBe(true);
    // Every role held at the school counts, not only the one being worn.
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ ...base, roles: ['university_admin', 'integration_admin'] })).allowed).toBe(true);
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ ...base, roles: ['university_admin'] })).step).toBe('role_policy');
    // Roles that were never read are none.
    expect(evaluateFlag('release.integration_dashboard_v1', ctx(base)).step).toBe('role_policy');
  });

  it('will not take a policy row without its narrowing', () => {
    // The P1 this closes: callers built `{ state }` alone and a staff-only
    // preview read as open. The row type now requires both lists; this line
    // is what that looks like, and it must not compile.
    // @ts-expect-error — a tenant row without permittedRoles and permittedCohorts
    const bare: FlagContext['tenantPolicy'] = { 'release.integration_dashboard_v1': { state: 'production' } };
    expect(bare).toBeTruthy();
  });

  it('honours a tenant’s release cohorts, after its roles', () => {
    const policy = { ...DASHBOARD_ON, 'release.integration_dashboard_v1': { state: 'production' as const, permittedRoles: [], permittedCohorts: ['first-year-2027'] } };
    const base = { tenantPolicy: policy, capabilities: ['integration:view'] };
    expect(evaluateFlag('release.integration_dashboard_v1', ctx(base))).toMatchObject({ allowed: false, step: 'cohort_policy' });
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ ...base, cohorts: ['honors'] })).step).toBe('cohort_policy');
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ ...base, cohorts: ['honors', 'first-year-2027'] })).allowed).toBe(true);
    // A cohort narrows; it never widens past a step that already said no.
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ ...base, capabilities: [], cohorts: ['first-year-2027'] })).step).toBe('capability');
    const both = { ...DASHBOARD_ON, 'release.integration_dashboard_v1': { state: 'production' as const, permittedRoles: ['integration_admin'], permittedCohorts: ['first-year-2027'] } };
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ tenantPolicy: both, capabilities: ['integration:view'], role: 'university_admin', cohorts: ['first-year-2027'] })).step).toBe('role_policy');
    // No cohort named: the step does not apply.
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ tenantPolicy: DASHBOARD_ON, capabilities: ['integration:view'] })).allowed).toBe(true);
  });

  it('lets a global kill switch win over everything a school set', () => {
    const d = evaluateFlag('scope.lms.assignment_dates_read', ctx({
      ...LTI_LIVE, killSwitches: [{ key: 'kill.integration_sync', tenantId: null, engaged: true }] }));
    expect(d).toMatchObject({ allowed: false, step: 'kill_switch' });
    expect(evaluateFlag('scope.lms.assignment_dates_read', ctx({ ...LTI_LIVE, activationReceipt: receipt({ capabilityId: 'CAP-021', operation: 'scope.lms.assignment_dates_read' }) })).allowed).toBe(true);
  });

  it('applies a school’s kill switch only to that school', () => {
    const sw = [{ key: 'kill.integration_sync', tenantId: 'other', engaged: true }];
    expect(evaluateFlag('scope.lms.assignment_dates_read', ctx({ ...LTI_LIVE, activationReceipt: receipt({ capabilityId: 'CAP-021', operation: 'scope.lms.assignment_dates_read' }), killSwitches: sw })).allowed).toBe(true);
    const mine = [{ key: 'kill.integration_sync', tenantId: 'vu', engaged: true }];
    expect(evaluateFlag('scope.lms.assignment_dates_read', ctx({ ...LTI_LIVE, killSwitches: mine })).step).toBe('kill_switch');
  });

  it('stops one connection with its own switch', () => {
    const sw = [{ key: 'kill.connection.conn_0123456789abcdef0123', tenantId: 'vu', engaged: true }];
    expect(evaluateFlag('scope.lms.assignment_dates_read', ctx({ ...LTI_LIVE, killSwitches: sw })).step).toBe('kill_switch');
  });

  it('refuses without an approved, live connection', () => {
    expect(evaluateFlag('scope.lms.assignment_dates_read', ctx({ ...LTI_LIVE, connection: null })).step).toBe('connection');
    expect(evaluateFlag('scope.lms.assignment_dates_read', ctx({ ...LTI_LIVE,
      connection: { publicId: 'conn_x', approved: true, status: 'paused' } })).step).toBe('connection');
  });

  it('refuses an unapproved or expired scope', () => {
    expect(evaluateFlag('scope.lms.assignment_dates_read', ctx({ ...LTI_LIVE,
      scopes: [{ key: 'scope.lms.assignment_dates_read', approved: false }] })).step).toBe('scope');
    expect(evaluateFlag('scope.lms.assignment_dates_read', ctx({ ...LTI_LIVE,
      scopes: [{ key: 'scope.lms.assignment_dates_read', approved: true, expiresAt: '2026-09-30T00:00:00Z' }] })).step).toBe('scope');
  });

  it('refuses by data classification', () => {
    const on = { tenantPolicy: { 'ops.external_ai_generation': { state: 'production' as const, permittedRoles: [], permittedCohorts: [] } } };
    expect(evaluateFlag('ops.external_ai_generation', ctx({ ...on, classification: 'T3', activationReceipt: receipt({ capabilityId: 'CAP-027', operation: 'ops.external_ai_generation' }) })).allowed).toBe(true);
    expect(evaluateFlag('ops.external_ai_generation', ctx({ ...on, classification: 'T4' })).step).toBe('classification');
  });

  it('applies a course rule and user eligibility last', () => {
    expect(evaluateFlag('scope.lms.assignment_dates_read', ctx({ ...LTI_LIVE, courseRule: { allowed: false } })).step).toBe('course_rule');
    expect(evaluateFlag('scope.lms.assignment_dates_read', ctx({ ...LTI_LIVE, userEligible: false })).step).toBe('user_eligibility');
  });

  it('turns a temporary flag off after it expires (the rollback state)', () => {
    const late = ctx({ now: new Date('2027-03-02T00:00:00Z'), tenantPolicy: DASHBOARD_ON, capabilities: ['integration:view'] });
    expect(evaluateFlag('release.integration_dashboard_v1', late).step).toBe('environment');
  });

  it('keeps write-back off even when a school enables the flag, until every gate is met', () => {
    const d = evaluateFlag('writeback.lms_grade_passback', ctx({
      tenantPolicy: { 'writeback.lms_grade_passback': { state: 'production', permittedRoles: [], permittedCohorts: [] } } }));
    expect(d.allowed).toBe(false);
    expect(evaluateFlag('writeback.lms_grade_passback', ctx(GRADE_READY)))
      .toMatchObject({ allowed: false, step: 'activation_contract' });
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ tenantPolicy: DASHBOARD_ON, capabilities: ['integration:view'] })))
      .toMatchObject({ allowed: true, step: 'allowed' });
  });

  it('cannot open grade passback with a real standard-capability activation', () => {
    const capability = capabilityDefinition('CAP-020')!;
    expect(capability).toMatchObject({ activationClass: 'standard', maturity: 'L3' });
    const activation = evaluateActivation({
      requestId: 'grade-request', tenantId: 'vu', actorId: 'instructor-1',
      purpose: 'publish approved grades', capabilityId: capability.id,
      operation: 'writeback.lms_grade_passback',
    }, capability, {
      now: NOW.toISOString(), policyVersion: 'policy-1',
      configuration: {
        id: 'config-1', tenant_id: 'vu', domain: 'features', state: 'published', version: 1,
        settings: { default_release_stage: 'on' }, note: '', based_on: null,
        created_by: 'author-1', published_by: 'approver-1',
        created_at: NOW.toISOString(), updated_at: NOW.toISOString(), published_at: NOW.toISOString(),
      },
      requirements: (['authorization', 'entitlement'] as const).map((key) => ({
        key, status: 'satisfied', tenantId: 'vu', references: [`ref:${key}`],
      })),
      killSwitchEngaged: false, existingWorkflow: false,
    });
    // Use the actual evaluator output, never a hand-authored receipt.
    expect(evaluateFlag('writeback.lms_grade_passback', ctx({ ...GRADE_READY, activationReceipt: activation.receipt })))
      .toMatchObject({ allowed: false, step: 'activation_contract' });
    expect(activation).toMatchObject({ outcome: 'deny', reason: 'product_maturity_insufficient', receipt: null });
  });

  it('denies fully enabled registration submit without an activation receipt', () => {
    const key = 'writeback.registration_submit';
    const enabled = ctx({
      tenantPolicy: { [key]: { state: 'production', permittedRoles: ['registrar'], permittedCohorts: ['pilot'] } },
      connection: { publicId: 'conn_0123456789abcdef0123', approved: true, status: 'healthy' },
      scopes: [{ key: 'scope.sis.registration_write', approved: true }],
      capabilities: ['integration:approve'], role: 'registrar', cohorts: ['pilot'],
      classification: 'T2', courseRule: { allowed: true }, userEligible: true,
    });
    expect(evaluateFlag(key, enabled)).toMatchObject({ allowed: false, step: 'activation_contract' });
    // A synthetic scoped receipt proves every pre-existing gate was satisfied.
    expect(evaluateFlag(key, { ...enabled, activationReceipt: receipt({ capabilityId: 'CAP-050', operation: key }) }))
      .toMatchObject({ allowed: true, step: 'allowed' });
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ tenantPolicy: DASHBOARD_ON, capabilities: ['integration:view'] })))
      .toMatchObject({ allowed: true, step: 'allowed' });
  });

  it('requires a matching current receipt for the exact tenant, capability and operation', () => {
    expect(evaluateFlag('writeback.lms_grade_passback', ctx({ ...GRADE_READY, activationReceipt: receipt() })))
      .toMatchObject({ allowed: true, step: 'allowed' });
    for (const bad of [
      receipt({ tenantId: 'other' }), receipt({ capabilityId: 'CAP-050' }),
      receipt({ operation: 'writeback.registration_submit' }),
      receipt({ expiresAt: NOW.toISOString() }), receipt({ issuedAt: '2026-10-01T12:01:00Z' }),
      receipt({ policyVersion: '   ' }), receipt({ configurationVersion: null }),
      receipt({ configurationVersion: 0 }), receipt({ configurationVersion: 1.5 }),
      receipt({ configurationVersion: Number.NaN }),
    ]) {
      expect(evaluateFlag('writeback.lms_grade_passback', ctx({ ...GRADE_READY, activationReceipt: bad })))
        .toMatchObject({ allowed: false, step: 'activation_contract' });
    }
    // Denied or unmet activation decisions carry no receipt; neither an absent
    // value nor that null can open a high-risk product surface.
    for (const absent of [undefined, null]) {
      expect(evaluateFlag('writeback.lms_grade_passback', ctx({ ...GRADE_READY, activationReceipt: absent })))
        .toMatchObject({ allowed: false, step: 'activation_contract' });
    }
  });

  it('rejects receipt timestamps with impossible calendar dates', () => {
    const malformed = receipt({
      issuedAt: '2026-09-31T11:45:00Z', expiresAt: '2026-09-31T12:15:00Z',
    });
    expect(evaluateFlag('writeback.lms_grade_passback', ctx({ ...GRADE_READY, activationReceipt: malformed })))
      .toMatchObject({ allowed: false, step: 'activation_contract' });
  });

  it('preserves every prior gate and gives the kill switch precedence', () => {
    const active = { ...GRADE_READY, activationReceipt: receipt() };
    expect(evaluateFlag('writeback.lms_grade_passback', ctx({ ...active, killSwitches: [{ key: 'kill.writeback', tenantId: 'vu', engaged: true }] })).step).toBe('kill_switch');
    expect(evaluateFlag('writeback.lms_grade_passback', ctx({ ...active, connection: null })).step).toBe('connection');
    expect(evaluateFlag('writeback.lms_grade_passback', ctx({ ...active, scopes: [] })).step).toBe('scope');
    expect(evaluateFlag('writeback.lms_grade_passback', ctx({ ...active, role: 'student' })).step).toBe('role_policy');
    expect(evaluateFlag('writeback.lms_grade_passback', ctx({ ...active, cohorts: [] })).step).toBe('cohort_policy');
    expect(evaluateFlag('writeback.lms_grade_passback', ctx({ ...active, courseRule: { allowed: false } })).step).toBe('course_rule');
    expect(evaluateFlag('writeback.lms_grade_passback', ctx({ ...active, userEligible: false })).step).toBe('user_eligibility');
  });
});
