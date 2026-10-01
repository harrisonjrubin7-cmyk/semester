import { FLAGS, flagDefinition, type FlagContext, type KillSwitchRow, type TenantPolicyRow } from '../flags';
// Aliased: `spendnames.test.ts` reads any call to a function of that name, with a braced
// argument, as the AI spend meter recording a reply.
import { arrayOf, bool, int, oneOf, record as struct, subset, type Gen } from './property';

/**
 * Generated flag contexts, shared by the properties that hold the flag
 * evaluator and anything layered on it to the same standard: one generator, so
 * two test files cannot each decide what "a school's configuration" looks like.
 * Test support only; nothing in the app imports it.
 */

export const T0 = Date.parse('2026-10-01T00:00:00Z');
export const DAY = 86_400_000;

// ── Flags ─────────────────────────────────────────────────────────────────

export const KEYS = FLAGS.map((f) => f.key);
export const SWITCHES = [...new Set(FLAGS.flatMap((f) => f.killSwitches))];
const STATES = ['off', 'preview', 'sandbox', 'production'] as const;
const ENVS = ['development', 'preview', 'production'] as const;
const TENANTS = ['t1', 't2'] as const;

const policyRow: Gen<TenantPolicyRow | null> = {
  gen: (r) => (r.int(0, 3) === 0 ? null : {
    state: STATES[r.int(0, 3)]!,
    permittedRoles: r.int(0, 2) === 0 ? ['admin'] : [],
    permittedCohorts: r.int(0, 3) === 0 ? ['pilot'] : [],
  }),
  *shrink(v) {
    if (v === null) return;
    yield null;
    if (v.permittedRoles.length) yield { ...v, permittedRoles: [] };
    if (v.permittedCohorts.length) yield { ...v, permittedCohorts: [] };
    if (v.state !== 'off') yield { ...v, state: 'off' };
  },
};

export interface Draw {
  key: string;
  env: (typeof ENVS)[number];
  tenant: string | null;
  days: number;
  kills: { key: string; tenant: string | null; engaged: boolean }[];
  policy: Record<string, TenantPolicyRow | null>;
  caps: string[];
  scopes: Record<string, 'missing' | 'ok' | 'unapproved' | 'expired'>;
  /** Switch on everything a flag needs except what the scopes say, so the later steps are reached. */
  favourable: boolean;
  connection: 'none' | 'approved' | 'unapproved';
  role: string | null;
  cohort: boolean;
  course: boolean | null;
  eligible: boolean | null;
}

export const scopeKeys = [...new Set(FLAGS.flatMap((f) => f.needsScopes ?? []))];
export const caps = [...new Set(FLAGS.flatMap((f) => (f.capability ? [f.capability] : [])))];

const rawDraw: Gen<Draw> = struct({
  key: oneOf(KEYS),
  env: oneOf(ENVS),
  tenant: oneOf<string | null>([...TENANTS, null]),
  days: int(-400, 800),
  kills: arrayOf(struct({ key: oneOf(SWITCHES), tenant: oneOf<string | null>([null, ...TENANTS]), engaged: bool }), 4),
  // A row for the flag, its module and a few others, each possibly absent.
  policy: {
    gen: (r) => Object.fromEntries(KEYS.map((k) => [k, policyRow.gen(r)])),
    *shrink(v) {
      for (const k of Object.keys(v)) if (v[k] !== null) yield { ...v, [k]: null };
    },
  } as Gen<Record<string, TenantPolicyRow | null>>,
  caps: subset(caps),
  scopes: {
    gen: (r) => Object.fromEntries(scopeKeys.map((k) => [k, (['missing', 'ok', 'ok', 'unapproved', 'expired'] as const)[r.int(0, 4)]!])),
    *shrink(v) {
      for (const k of Object.keys(v)) if (v[k] !== 'ok') yield { ...v, [k]: 'ok' as const };
    },
  } as Gen<Draw['scopes']>,
  favourable: bool,
  connection: oneOf(['none', 'approved', 'unapproved'] as const),
  role: oneOf<string | null>([null, 'admin', 'student']),
  cohort: bool,
  course: oneOf<boolean | null>([null, true, false]),
  eligible: oneOf<boolean | null>([null, true, false]),
});

/**
 * Bias a draw toward reaching the later steps: switch the flag and its module
 * on, grant every capability, approve the connection. Applied once, when the
 * value is generated, so the context and the properties' own reading of it are
 * the same thing; shrinking may undo it, which only simplifies the case.
 */
const favouring = (g: Gen<Draw>): Gen<Draw> => ({
  gen: (r) => {
    const d = g.gen(r);
    if (!d.favourable) return d;
    const def = flagDefinition(d.key)!;
    const on: TenantPolicyRow = { state: 'production', permittedRoles: [], permittedCohorts: [] };
    return {
      ...d,
      policy: { ...d.policy, [d.key]: on, ...(def.module ? { [def.module]: on } : {}) },
      caps, connection: 'approved', tenant: d.tenant ?? 't1',
    };
  },
  shrink: (v) => g.shrink(v),
});

export function context(d: Draw): FlagContext {
  const now = new Date(T0 + d.days * DAY);
  const tenantPolicy: Record<string, TenantPolicyRow> = {};
  for (const [k, row] of Object.entries(d.policy)) if (row) tenantPolicy[k] = row;
  return {
    environment: d.env,
    tenantId: d.tenant,
    now,
    killSwitches: d.kills.map((k): KillSwitchRow => ({ key: k.key, tenantId: k.tenant, engaged: k.engaged })),
    tenantPolicy,
    capabilities: d.caps,
    scopes: Object.entries(d.scopes).filter(([, v]) => v !== 'missing').map(([key, v]) => ({
      key, approved: v !== 'unapproved', expiresAt: v === 'expired' ? new Date(now.getTime() - DAY).toISOString() : null,
    })),
    connection: d.connection === 'none' ? null : { publicId: 'c1', approved: d.connection === 'approved', status: 'healthy' },
    role: d.role ?? undefined,
    roles: d.role ? [d.role] : [],
    cohorts: d.cohort ? ['pilot'] : [],
    courseRule: d.course === null ? null : { allowed: d.course },
    userEligible: d.eligible === null ? undefined : d.eligible,
    // Test-only receipt keeps scope/eligibility properties non-vacuous after
    // the activation gate. It grants no real tenant or capability activation.
    activationReceipt: d.tenant === null ? null : {
      decisionKey: 'activation:v1:property-fixture', requestId: 'property-fixture', tenantId: d.tenant,
      capabilityId: flagDefinition(d.key)!.capabilityIds[0]!, operation: d.key,
      policyVersion: 'test-policy', configurationVersion: 1,
      issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    },
  };
}

export const draw = favouring(rawDraw);
