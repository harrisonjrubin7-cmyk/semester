import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_MODELS,
  MODEL_NOT_ON_PLAN,
  PLAN_MODELS,
  clampRequest,
  modelsForPlan,
} from '../../../supabase/functions/_shared/clamp';
import { planFromSubscriptions } from '../../../supabase/functions/_shared/sharedplan';

/**
 * What a plan may ask the shared key for.
 *
 * The shared key's cap counts calls and the models cost very different
 * amounts per call, so which model a call names is most of what an account can
 * spend. `PLAN_MODELS` is that decision; these tests hold it in place, and hold
 * the reading of "which plan is this account on" to the rule
 * `public.my_entitlements()` already uses.
 */

const request = (model: string) => ({
  model,
  max_tokens: 1000,
  messages: [{ role: 'user', content: 'Explain opportunity cost.' }],
});

const clamp = (plan: string | null | undefined, model: string) => {
  const raw = JSON.stringify(request(model));
  return clampRequest(raw, raw.length, { models: modelsForPlan(plan) });
};

describe('which models each plan covers', () => {
  const free = new Set<string>(PLAN_MODELS.free);
  const plus = new Set<string>(PLAN_MODELS.plus);
  const pro = new Set<string>(PLAN_MODELS.pro);

  it('widens as the plan does: every Free model is on Plus and every Plus model is on Pro', () => {
    for (const m of free) expect(plus.has(m), m).toBe(true);
    for (const m of plus) expect(pro.has(m), m).toBe(true);
    expect(free.size).toBeLessThan(plus.size);
    expect(plus.size).toBeLessThan(pro.size);
  });

  it('puts every model the shared key knows on the widest plan, so a new one is placed on purpose', () => {
    expect([...pro].sort()).toEqual([...ALLOWED_MODELS].sort());
  });

  it('keeps the two dearest models off Free, which is the whole point', () => {
    expect(free.has('claude-opus-5')).toBe(false);
    expect(free.has('claude-fable-5-1')).toBe(false);
    expect(plus.has('claude-fable-5-1')).toBe(false);
  });

  it('answers any plan it does not know as Free, including names an object would inherit', () => {
    for (const plan of [null, undefined, '', 'admin', 'semester_access', 'constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect([...modelsForPlan(plan)], String(plan)).toEqual([...PLAN_MODELS.free]);
    }
  });
});

describe('what the shared key says to a model outside the plan', () => {
  it('serves Free the models it covers', () => {
    for (const m of PLAN_MODELS.free) expect(clamp('free', m).ok, m).toBe(true);
  });

  it('refuses Free the dearest two, with a code and the list, and does not swap one in', () => {
    for (const m of ['claude-opus-5', 'claude-fable-5-1']) {
      const out = clamp('free', m);
      expect(out, m).toMatchObject({ ok: false, status: 400, code: MODEL_NOT_ON_PLAN });
      if (out.ok) continue;
      expect([...(out.allowed ?? [])]).toEqual([...PLAN_MODELS.free]);
      expect(out.message).toMatch(/your plan/i);
      expect(out.message).toMatch(/own key/i);
    }
  });

  it('serves Plus Opus 5 but not Fable 5.1, and Pro both', () => {
    expect(clamp('plus', 'claude-opus-5').ok).toBe(true);
    expect(clamp('plus', 'claude-fable-5-1')).toMatchObject({ ok: false, code: MODEL_NOT_ON_PLAN });
    expect(clamp('pro', 'claude-fable-5-1').ok).toBe(true);
  });

  it('refuses the app’s own default model on Free, which is why the app has to learn the list', () => {
    expect(clamp('free', 'claude-opus-5')).toMatchObject({ ok: false, code: MODEL_NOT_ON_PLAN });
  });

  it('still refuses a model nobody offers, as it always did, on every plan', () => {
    for (const plan of ['free', 'plus', 'pro']) {
      expect(clamp(plan, 'claude-opus-4-1')).toMatchObject({ ok: false, status: 400, code: MODEL_NOT_ON_PLAN });
    }
  });

  it('leaves every other refusal without a code', () => {
    const raw = JSON.stringify({ ...request('claude-haiku-4-5'), messages: [] });
    const out = clampRequest(raw, raw.length, { models: modelsForPlan('free') });
    expect(out).toMatchObject({ ok: false, status: 400 });
    expect(out).not.toHaveProperty('code');
  });
});

describe('which plan an account is on', () => {
  const NOW = new Date('2026-10-05T12:00:00Z');
  const later = '2026-11-05T12:00:00Z';
  const earlier = '2026-09-05T12:00:00Z';
  const sub = (over: Record<string, unknown> = {}) => ({
    plan_code: 'plus',
    status: 'active',
    current_period_end: later,
    subscription_entitlements: [{ entitlement_key: 'plan.multiple' }],
    ...over,
  });
  const plan = (rows: unknown) => planFromSubscriptions(rows, NOW);

  it('is Free with no subscription at all', () => {
    expect(plan([])).toBe('free');
    expect(plan(null)).toBe('free');
    expect(plan(undefined)).toBe('free');
    expect(plan('plus')).toBe('free');
  });

  it('is Plus for a live Plus subscription that holds entitlements', () => {
    expect(plan([sub()])).toBe('plus');
  });

  it('keeps paid features through the statuses where they keep working', () => {
    for (const status of ['trialing', 'active', 'past_due', 'grace']) {
      expect(plan([sub({ status })]), status).toBe('plus');
    }
  });

  it('is Free once the subscription is cancelled or ended', () => {
    for (const status of ['canceled', 'ended', 'unknown', 7, null]) {
      expect(plan([sub({ status })]), String(status)).toBe('free');
    }
  });

  it('is Free once the paid period has ended, or when the date cannot be read', () => {
    expect(plan([sub({ current_period_end: earlier })])).toBe('free');
    for (const bad of ['not a date', '', null, undefined, 1760000000000]) {
      expect(plan([sub({ current_period_end: bad })]), String(bad)).toBe('free');
    }
  });

  it('is Free when dunning has removed the entitlements, which is how a lapsed payer is told from a paying one', () => {
    // `past_due` with entitlements is grace, and keeps paid features; the same
    // status with none is what `run_dunning()` leaves at restriction.
    expect(plan([sub({ status: 'past_due', subscription_entitlements: [{ entitlement_key: 'x' }] })])).toBe('plus');
    expect(plan([sub({ status: 'past_due', subscription_entitlements: [] })])).toBe('free');
    expect(plan([sub({ subscription_entitlements: null })])).toBe('free');
    expect(plan([sub({ subscription_entitlements: undefined })])).toBe('free');
  });

  it('takes the best plan held, and does not let a lapsed wider one count', () => {
    expect(plan([sub(), sub({ plan_code: 'pro' })])).toBe('pro');
    expect(plan([sub(), sub({ plan_code: 'pro', status: 'canceled' })])).toBe('plus');
    expect(plan([sub({ plan_code: 'pro', current_period_end: earlier }), sub()])).toBe('plus');
  });

  it('ignores a plan the table does not know, and rows that are not rows', () => {
    expect(plan([sub({ plan_code: 'semester_access' })])).toBe('free');
    expect(plan([sub({ plan_code: 'constructor' }), sub({ plan_code: '__proto__' })])).toBe('free');
    expect(plan([null, 'x', 7, [], sub()])).toBe('plus');
  });

  it('says what is true today about Pro: with no entitlement rows seeded, a Pro subscription reads as Free', () => {
    // `pro` has a plan row and no `plan_entitlements` (the pricing review's F2).
    // Pro cannot be bought, so nobody is affected, and the day it can be this
    // is the line that fails and says what to seed.
    expect(plan([sub({ plan_code: 'pro', subscription_entitlements: [] })])).toBe('free');
  });
});

describe('the function', () => {
  const source = readFileSync(new URL('../../../supabase/functions/claude/index.ts', import.meta.url), 'utf8');
  const at = (needle: string) => {
    const i = source.indexOf(needle);
    expect(i, needle).toBeGreaterThan(-1);
    return i;
  };

  it('reads the plan and clamps to it before the call is counted, so a refusal costs nobody a call', () => {
    const plan = at("from('billing_accounts')");
    const clampCall = at('clampRequest(raw');
    const counted = at("rpc('count_call'");
    expect(plan).toBeLessThan(clampCall);
    expect(clampCall).toBeLessThan(counted);
  });

  it('passes the plan’s list to the clamp rather than the full one', () => {
    expect(source).toMatch(/clampRequest\(raw,[\s\S]*?\{\s*models:\s*modelsForPlan\(plan\)\s*\}\s*\)/);
  });

  it('serves a plan it cannot read as Free, and never as an error', () => {
    expect(source).toMatch(/let plan: SharedPlan = 'free'/);
    expect(source).toMatch(/serving this account as free/);
  });

  it('carries the code and the list on the refusal', () => {
    expect(source).toMatch(/allowed_models:\s*clamped\.allowed/);
    expect(source).toMatch(/code:\s*clamped\.code/);
  });
});
