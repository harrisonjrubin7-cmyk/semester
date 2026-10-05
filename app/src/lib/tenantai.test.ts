import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MEMBERSHIP_UNREADABLE_MESSAGE,
  TENANT_BUDGET_MESSAGE,
  TENANT_MANAGED_MESSAGE,
  loadSchoolAi,
  schoolAiDecision,
  schoolOf,
  sharedKeyAudience,
  type PolicyReader,
  type ProfileReader,
  type SchoolAiFacts,
} from '../../../supabase/functions/_shared/tenantai';

/**
 * The shared key is for individual accounts with no school. `claude/index.ts` said so in a comment
 * ("the shared key serves individual accounts with no school, so only the global row can stop it")
 * and nothing enforced it: an account that belonged to a school was served like any other, and the
 * school's AI decision was never read. These hold the decision, and then hold the function to asking
 * it before it spends anything. See `docs/decisions/proposed/0005-*.md` and risk RISK-008.
 */

const reader = (result: { data: unknown; error: unknown } | 'throws'): ProfileReader => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => {
          if (result === 'throws') throw new Error('network');
          return result;
        },
      }),
    }),
  }),
});

describe('who the shared key serves', () => {
  it('serves an account with no school', () => {
    expect(sharedKeyAudience({ school: null, failed: false })).toEqual({ serve: true, school: null });
  });

  it('hands an account that belongs to a school on to the school\'s decision, never straight through', () => {
    expect(sharedKeyAudience({ school: 'northstar', failed: false })).toEqual({ serve: true, school: 'northstar' });
  });

  it('does not serve anyone whose membership could not be read: unknown is not "no school"', () => {
    expect(sharedKeyAudience({ school: null, failed: true })).toEqual({ serve: false, reason: 'membership-unreadable' });
    expect(sharedKeyAudience({ school: 'northstar', failed: true })).toEqual({ serve: false, reason: 'membership-unreadable' });
  });

  it('says what happened without blaming anyone or promising a way round', () => {
    for (const m of [TENANT_MANAGED_MESSAGE, TENANT_BUDGET_MESSAGE, MEMBERSHIP_UNREADABLE_MESSAGE]) {
      expect(m.length).toBeGreaterThan(20);
      expect(m).not.toMatch(/own key|bypass|workaround/i);
    }
  });
});

const on = (over: Partial<SchoolAiFacts> = {}): SchoolAiFacts => ({
  feature: { state: 'production', permitted_roles: ['student'], permitted_cohorts: [] },
  policy: { allowed_providers: ['anthropic'], monthly_budget_cents: 10_000 },
  cohortRows: 0,
  memberships: [{ status: 'active', roles: ['student'] }],
  spentCents: 250,
  ...over,
});

describe('whether a school has turned AI on for its student', () => {
  it('serves when every part holds', () => {
    expect(schoolAiDecision(on())).toEqual({ serve: true });
  });

  it('does not serve when the school has no decision recorded, or one row is missing', () => {
    expect(schoolAiDecision(on({ feature: null }))).toMatchObject({ serve: false, reason: 'not-turned-on' });
    expect(schoolAiDecision(on({ policy: null }))).toMatchObject({ serve: false, reason: 'not-turned-on' });
  });

  it('serves only a feature in production: off, preview and sandbox are not a launch, and an unknown state is not one', () => {
    for (const state of ['off', 'preview', 'sandbox', 'PRODUCTION', '', null, 7]) {
      expect(schoolAiDecision(on({ feature: { state, permitted_roles: ['student'], permitted_cohorts: [] } }))).toMatchObject({ serve: false });
    }
  });

  it('holds a pilot cohort: named cohorts need a live member row, and no cohorts means the whole school', () => {
    const pilot = { state: 'production', permitted_roles: ['student'], permitted_cohorts: ['pilot-a'] };
    expect(schoolAiDecision(on({ feature: pilot, cohortRows: 0 }))).toMatchObject({ serve: false, reason: 'not-turned-on' });
    expect(schoolAiDecision(on({ feature: pilot, cohortRows: 1 }))).toEqual({ serve: true });
    expect(schoolAiDecision(on({ cohortRows: 0 }))).toEqual({ serve: true });
  });

  it('needs exactly one active membership with a permitted role', () => {
    expect(schoolAiDecision(on({ memberships: [] }))).toMatchObject({ serve: false });
    expect(schoolAiDecision(on({ memberships: [{ status: 'suspended', roles: ['student'] }] }))).toMatchObject({ serve: false });
    expect(schoolAiDecision(on({ memberships: [{ status: 'active', roles: ['faculty'] }] }))).toMatchObject({ serve: false });
    expect(schoolAiDecision(on({ memberships: [{ status: 'active', roles: 'student' }] }))).toMatchObject({ serve: false });
    expect(schoolAiDecision(on({ memberships: [{ status: 'active', roles: ['student'] }, { status: 'active', roles: ['student'] }] }))).toMatchObject({ serve: false });
    // No permitted roles named means nobody is permitted, not everybody.
    expect(schoolAiDecision(on({ feature: { state: 'production', permitted_roles: [], permitted_cohorts: [] } }))).toMatchObject({ serve: false });
  });

  it('needs the school to allow this provider', () => {
    expect(schoolAiDecision(on({ policy: { allowed_providers: ['openai'], monthly_budget_cents: 10_000 } }))).toMatchObject({ serve: false, reason: 'not-turned-on' });
    expect(schoolAiDecision(on({ policy: { allowed_providers: [], monthly_budget_cents: 10_000 } }))).toMatchObject({ serve: false });
  });

  it('refuses a spent, unset or unreadable budget with its own reason', () => {
    expect(schoolAiDecision(on({ spentCents: 10_000 }))).toEqual({ serve: false, reason: 'budget' });
    expect(schoolAiDecision(on({ policy: { allowed_providers: ['anthropic'], monthly_budget_cents: 0 } }))).toEqual({ serve: false, reason: 'budget' });
    expect(schoolAiDecision(on({ policy: { allowed_providers: ['anthropic'], monthly_budget_cents: 'lots' } }))).toEqual({ serve: false, reason: 'budget' });
    expect(schoolAiDecision(on({ spentCents: null }))).toEqual({ serve: false, reason: 'budget' });
    expect(schoolAiDecision(on({ spentCents: 'many' }))).toEqual({ serve: false, reason: 'budget' });
    expect(schoolAiDecision(on({ spentCents: 9_999 }))).toEqual({ serve: true });
  });
});

type Rows = Record<string, { data?: unknown; error?: unknown } | 'throws'>;
/** A stand-in client: every chain method returns the chain, and the end of it answers for its table. */
const policyReader = (rows: Rows, rpc: { data?: unknown; error?: unknown } = { data: 0 }): PolicyReader => ({
  from: (table: string) => {
    const answer = async () => {
      const r = rows[table];
      if (r === 'throws') throw new Error('network');
      return { data: r?.data ?? null, error: r?.error ?? null };
    };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'in', 'limit']) chain[m] = () => chain;
    chain.maybeSingle = answer;
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => answer().then(res, rej);
    return chain;
  },
  rpc: async () => ({ data: rpc.data ?? null, error: rpc.error ?? null }),
});

const good: Rows = {
  tenant_feature_policy: { data: { state: 'production', permitted_roles: ['student'], permitted_cohorts: [] } },
  ai_policy: { data: { allowed_providers: ['anthropic'], monthly_budget_cents: 5000 } },
  institution_membership: { data: [{ status: 'active', roles: ['student'] }] },
};

describe('reading a school\'s decision', () => {
  it('reads what the decision needs and the decision serves it', async () => {
    const facts = await loadSchoolAi(policyReader(good, { data: 12 }), 'northstar', 'u1');
    expect(facts).not.toBeNull();
    expect(schoolAiDecision(facts!)).toEqual({ serve: true });
  });

  it('asks about the cohort only when the school names one', async () => {
    const pilot: Rows = { ...good, tenant_feature_policy: { data: { state: 'production', permitted_roles: ['student'], permitted_cohorts: ['pilot-a'] } }, feature_cohort_members: { data: [{ cohort: 'pilot-a' }] } };
    expect(schoolAiDecision((await loadSchoolAi(policyReader(pilot), 'northstar', 'u1'))!)).toEqual({ serve: true });
    const out: Rows = { ...pilot, feature_cohort_members: { data: [] } };
    expect(schoolAiDecision((await loadSchoolAi(policyReader(out), 'northstar', 'u1'))!)).toMatchObject({ serve: false });
  });

  it('returns null, never a service, when any read fails, throws or has a shape it does not know', async () => {
    for (const table of ['tenant_feature_policy', 'ai_policy', 'institution_membership']) {
      expect(await loadSchoolAi(policyReader({ ...good, [table]: { error: { message: 'boom' } } }), 'northstar', 'u1')).toBeNull();
      expect(await loadSchoolAi(policyReader({ ...good, [table]: 'throws' }), 'northstar', 'u1')).toBeNull();
    }
    expect(await loadSchoolAi(policyReader(good, { error: { message: 'boom' } }), 'northstar', 'u1')).toBeNull();
    expect(await loadSchoolAi(policyReader({ ...good, institution_membership: { data: { status: 'active' } } }), 'northstar', 'u1')).toBeNull();
    const pilot: Rows = { ...good, tenant_feature_policy: { data: { state: 'production', permitted_roles: ['student'], permitted_cohorts: ['p'] } }, feature_cohort_members: { error: { message: 'boom' } } };
    expect(await loadSchoolAi(policyReader(pilot), 'northstar', 'u1')).toBeNull();
  });
});

describe('reading which school an account belongs to', () => {
  it('reads no school as no school', async () => {
    expect(await schoolOf(reader({ data: null, error: null }), 'u1')).toEqual({ school: null, failed: false });
    expect(await schoolOf(reader({ data: { school_id: null }, error: null }), 'u1')).toEqual({ school: null, failed: false });
  });

  it('reads a school', async () => {
    expect(await schoolOf(reader({ data: { school_id: 'northstar' }, error: null }), 'u1')).toEqual({ school: 'northstar', failed: false });
  });

  it('treats an error, a throw, and a shape it does not know as a failed read, never as no school', async () => {
    expect((await schoolOf(reader({ data: null, error: { message: 'boom' } }), 'u1')).failed).toBe(true);
    expect((await schoolOf(reader('throws'), 'u1')).failed).toBe(true);
    expect((await schoolOf(reader({ data: { school_id: 42 }, error: null }), 'u1')).failed).toBe(true);
    expect((await schoolOf(reader({ data: { school_id: '' }, error: null }), 'u1')).failed).toBe(true);
  });
});

describe('the shared-key function asks before it spends anything', () => {
  const source = readFileSync(new URL('../../../supabase/functions/claude/index.ts', import.meta.url), 'utf8');
  const at = (needle: string) => {
    const i = source.indexOf(needle);
    expect(i, `claude/index.ts does not contain ${needle}`).toBeGreaterThan(-1);
    return i;
  };

  it('reads the membership, then the school\'s kill switch, policy and decision', () => {
    at('schoolOf(admin, userId)');
    at('sharedKeyAudience(');
    const school = source.slice(at('audience.school !== null'), at('clampRequest('));
    expect(school).toMatch(/aiGenerationKilled\(admin, audience\.school\)/);
    expect(school).toMatch(/loadSchoolAi\(admin, audience\.school, userId\)/);
    expect(school).toMatch(/schoolAiDecision\(facts\)/);
  });

  it('refuses with 403 a school that has not turned AI on or has spent its budget, and 503 when it cannot read', () => {
    const decision = source.slice(at('sharedKeyAudience('), at('clampRequest('));
    expect(decision).toMatch(/TENANT_MANAGED_MESSAGE[\s\S]{0,200}403/);
    expect(decision).toMatch(/TENANT_BUDGET_MESSAGE[\s\S]{0,200}403/);
    expect(decision).toMatch(/MEMBERSHIP_UNREADABLE_MESSAGE[\s\S]{0,200}503/);
    // A school whose policy cannot be read is refused, not waved through.
    expect(decision).toMatch(/if \(!facts\)[\s\S]{0,200}503/);
  });

  it('asks before the plan is read, the body is clamped, a dollar is reserved or a call is counted', () => {
    const ask = at('schoolAiDecision(facts)');
    for (const later of ["from('billing_accounts')", 'clampRequest(', "rpc('add_spend'", "rpc('count_call'", 'fetch(ANTHROPIC']) {
      expect(ask, `the school's decision is asked after ${later}`).toBeLessThan(at(later));
    }
  });
});
