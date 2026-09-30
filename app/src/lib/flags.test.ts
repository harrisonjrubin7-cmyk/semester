import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FLAGS, KILL_SWITCHES, evaluateFlag, type FlagContext } from './flags';

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
  'module.integration_dashboard': { state: 'production' },
  'release.integration_dashboard_v1': { state: 'production' },
};

const LTI_LIVE: Partial<FlagContext> = {
  tenantPolicy: {
    'integration.lms_lti': { state: 'production' },
    'scope.lms.assignment_dates_read': { state: 'production' },
  },
  connection: { publicId: 'conn_0123456789abcdef0123', approved: true, status: 'healthy' },
  scopes: [{ key: 'scope.lms.assignment_dates_read', approved: true }],
};

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
      tenantPolicy: { 'release.integration_dashboard_v1': { state: 'production' } }, capabilities: ['integration:view'] }));
    expect(d).toMatchObject({ allowed: false, step: 'tenant_entitlement' });
  });

  it('treats preview as off in production and on in a preview environment', () => {
    const policy = { 'module.integration_dashboard': { state: 'preview' as const }, 'release.integration_dashboard_v1': { state: 'preview' as const } };
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ tenantPolicy: policy, capabilities: ['integration:view'] })).allowed).toBe(false);
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ environment: 'preview', tenantPolicy: policy, capabilities: ['integration:view'] })).allowed).toBe(true);
  });

  it('is role-scoped: without the verified capability it is refused', () => {
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ tenantPolicy: DASHBOARD_ON })))
      .toMatchObject({ allowed: false, step: 'capability' });
  });

  it('honours a tenant’s permitted roles', () => {
    const policy = { ...DASHBOARD_ON, 'release.integration_dashboard_v1': { state: 'production' as const, permittedRoles: ['integration_admin'] } };
    const base = { tenantPolicy: policy, capabilities: ['integration:view'] };
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ ...base, role: 'university_admin' })).step).toBe('role_policy');
    expect(evaluateFlag('release.integration_dashboard_v1', ctx({ ...base, role: 'integration_admin' })).allowed).toBe(true);
  });

  it('lets a global kill switch win over everything a school set', () => {
    const d = evaluateFlag('scope.lms.assignment_dates_read', ctx({
      ...LTI_LIVE, killSwitches: [{ key: 'kill.integration_sync', tenantId: null, engaged: true }] }));
    expect(d).toMatchObject({ allowed: false, step: 'kill_switch' });
    expect(evaluateFlag('scope.lms.assignment_dates_read', ctx(LTI_LIVE)).allowed).toBe(true);
  });

  it('applies a school’s kill switch only to that school', () => {
    const sw = [{ key: 'kill.integration_sync', tenantId: 'other', engaged: true }];
    expect(evaluateFlag('scope.lms.assignment_dates_read', ctx({ ...LTI_LIVE, killSwitches: sw })).allowed).toBe(true);
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
    const on = { tenantPolicy: { 'ops.external_ai_generation': { state: 'production' as const } } };
    expect(evaluateFlag('ops.external_ai_generation', ctx({ ...on, classification: 'T3' })).allowed).toBe(true);
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
      tenantPolicy: { 'writeback.lms_grade_passback': { state: 'production' } } }));
    expect(d.allowed).toBe(false);
  });
});
