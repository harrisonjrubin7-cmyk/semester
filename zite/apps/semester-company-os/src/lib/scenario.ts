// Scenario validation for saved simulator scenarios. Pure; tested in tests/scenario.test.ts.
import { CostInputs, emptyInputs } from './costModel';
import { STACK_AREAS, STACK_OPTIONS } from './systemMap';

export const KINDS = ['Lean pilot', 'Multi-institution launch', 'Expanded native platform'] as const;
export type Kind = (typeof KINDS)[number];
export type Stack = Partial<Record<(typeof STACK_AREAS)[number], (typeof STACK_OPTIONS)[number]>>;

const NUM_FIELDS = ['institutions', 'activeStudents', 'staff', 'monthlyActiveShare', 'requestsPerActiveUser', 'aiRequestsPerActiveUser', 'tokensPerAiRequest', 'fileStorageGb', 'egressGb', 'jobsPerMonth', 'supportHoursPerMonth', 'implementationHoursPerInstitution'] as const;

/** Parses stored or submitted inputs; returns a clean object or the first problem. Never trusts the shape. */
export function parseInputs(raw: unknown): { ok: true; inputs: CostInputs } | { ok: false; error: string } {
  let v: unknown = raw;
  if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return { ok: false, error: 'Inputs are not valid JSON.' }; } }
  if (!v || typeof v !== 'object') return { ok: false, error: 'Inputs are missing.' };
  const o = v as Record<string, unknown>;
  const base = emptyInputs();
  const out: CostInputs = { ...base, currency: typeof o.currency === 'string' && /^[A-Za-z]{3}$/.test(o.currency) ? o.currency.toUpperCase() : 'USD' };
  for (const k of NUM_FIELDS) {
    const n = Number(o[k]);
    if (!Number.isFinite(n) || n < 0 || n > 1e9) return { ok: false, error: `${k} must be a number from 0 to 1,000,000,000.` };
    (out as Record<string, unknown>)[k] = n;
  }
  if (out.monthlyActiveShare > 1) return { ok: false, error: 'monthlyActiveShare must be between 0 and 1.' };
  const src = (o.prices ?? {}) as Record<string, unknown>;
  const rev = (o.revenue ?? {}) as Record<string, unknown>;
  const money = (m: unknown) => {
    const x = (m ?? {}) as Record<string, unknown>;
    const amount = x.amount === null || x.amount === undefined || x.amount === '' ? null : Number(x.amount);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return null;
    return { amount, currency: typeof x.currency === 'string' && /^[A-Za-z]{3}$/.test(x.currency) ? x.currency.toUpperCase() : out.currency, period: x.period === 'year' ? 'year' as const : 'month' as const };
  };
  for (const k of Object.keys(base.prices) as (keyof CostInputs['prices'])[]) { const m = money(src[k]); if (!m) return { ok: false, error: `Price ${k} must be blank or a non-negative number.` }; out.prices[k] = m; }
  for (const k of Object.keys(base.revenue) as (keyof CostInputs['revenue'])[]) { const m = money(rev[k]); if (!m) return { ok: false, error: `Revenue ${k} must be blank or a non-negative number.` }; out.revenue[k] = m; }
  return { ok: true, inputs: out };
}

export function parseStack(raw: unknown): Stack {
  let v: unknown = raw;
  if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return {}; } }
  const o = (v ?? {}) as Record<string, unknown>;
  const out: Stack = {};
  for (const a of STACK_AREAS) if ((STACK_OPTIONS as readonly unknown[]).includes(o[a])) out[a] = o[a] as (typeof STACK_OPTIONS)[number];
  return out;
}

export function nameBlocker(name: string): string | null {
  const n = name.trim();
  if (n.length < 2 || n.length > 80) return 'Give the scenario a name of 2–80 characters.';
  return null;
}
