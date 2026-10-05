import { FLAGS, evaluateFlag, type FlagContext, type FlagDecision } from '../flags';
import {
  DATA_CLASSES, DESTINATIONS, PLATFORM_ROUTES, routeAllowed,
  type ClassRoute, type DataClass, type Destination,
} from '../integration/classification';

/**
 * What a school's contract permits, enforced beside what its settings say.
 *
 * A school signs for some modules, some data, a region, a retention window and
 * an AI arrangement, and every one of those is a place the running product can
 * quietly come to differ from the paper: a module switched on that was never
 * bought, a provider the order form does not name, a retention shorter than the
 * contract requires. This is the contract as data, and three things done with
 * it: a **decision** for a request ("may this school use this module, send this
 * class of data there, run this many more AI tokens"), a **drift report** that
 * compares a school's live configuration to it, and a **validator** for the
 * contract itself.
 *
 * ## It only ever narrows
 *
 * The contract is one more gate after the platform's, never a way around one.
 * `evaluateUnderContract` asks the contract first and then the flag evaluator,
 * and allows only what both allow; a data route uses the same `routeAllowed`
 * as the platform floor, so a contract can close a route and cannot open one
 * the floor keeps shut. A school with **no contract recorded** is not
 * constrained by this layer at all — the other gates still apply — and the
 * decision says so in words rather than returning a bare "allowed".
 *
 * ## Who writes it
 *
 * Not the school's own administrator. A contract a tenant admin could edit is a
 * contract the tenant could widen, which is the thing it exists to prevent. This
 * module is pure and stores nothing. Contracts are files in `contracts/`, one
 * per tenant, written by the owner alone (D-1019) and checked by
 * `contractfiles.ts`; `.github/CODEOWNERS` routes that directory to him.
 */

export type Tier = 'standard' | 'priority' | 'named';
export type AiSource = 'institution_only' | 'any_authorized';

export interface TenantContract {
  tenantId: string;
  /** ISO dates. The term is `[effectiveFrom, effectiveTo)`; null is open-ended. */
  effectiveFrom: string;
  effectiveTo: string | null;
  /** Flag keys the contract includes. Anything else is off for this school. */
  modules: readonly string[];
  /** Flag keys that must stay off whatever else is configured. */
  prohibited: readonly string[];
  ai: {
    providers: readonly string[];
    sources: AiSource;
    /** Tokens per contract year, or null for unmetered. */
    annualTokenBudget: number | null;
  };
  /** Only closes routes. Checked with the platform's own `routeAllowed`. */
  dataRoutes?: Partial<Record<DataClass, Partial<ClassRoute>>>;
  /** Where student data may be stored and processed. */
  regions: readonly string[];
  /** Days a record must be kept, and the most it may be, or null for unconstrained. */
  retention: { minDays: number; maxDays: number } | null;
  adminMfa: boolean;
  support: { tier: Tier; escalation: string | null };
}

export type Ask =
  | { kind: 'module'; key: string }
  | { kind: 'ai'; provider: string; source: 'institution' | 'other' }
  | { kind: 'ai_tokens'; usedThisYear: number; asking: number }
  | { kind: 'data'; cls: DataClass; dest: Destination; region: string }
  | { kind: 'admin_action'; mfa: boolean };

export interface ContractDecision {
  /** False when there is no contract, so nothing here constrained the request. */
  applies: boolean;
  allowed: boolean;
  /** The part of the contract that decided it. */
  clause: string;
  reason: string;
}

const NONE: ContractDecision = {
  applies: false, allowed: true, clause: 'none',
  reason: 'No contract is recorded for this school, so this layer does not constrain it; the platform’s other gates still apply.',
};
const no = (clause: string, reason: string): ContractDecision => ({ applies: true, allowed: false, clause, reason });
const yes = (clause: string, reason: string): ContractDecision => ({ applies: true, allowed: true, clause, reason });

const day = (iso: string) => Date.parse(iso);

export function inTerm(c: Pick<TenantContract, 'effectiveFrom' | 'effectiveTo'>, now: Date): boolean {
  const t = now.getTime();
  return t >= day(c.effectiveFrom) && (c.effectiveTo === null || t < day(c.effectiveTo));
}

export function contractDecision(c: TenantContract | null, ask: Ask, now: Date): ContractDecision {
  if (c === null) return NONE;
  if (!inTerm(c, now)) return no('term', `The contract is not in force (${c.effectiveFrom} to ${c.effectiveTo ?? 'open'}).`);
  switch (ask.kind) {
    case 'module':
      if (c.prohibited.includes(ask.key)) return no('prohibited', `${ask.key} is prohibited by this school’s contract.`);
      return c.modules.includes(ask.key) ? yes('modules', `${ask.key} is included.`) : no('modules', `${ask.key} is not included in this school’s contract.`);
    case 'ai':
      if (!c.ai.providers.includes(ask.provider)) return no('ai.providers', `${ask.provider} is not a permitted AI provider for this school.`);
      if (c.ai.sources === 'institution_only' && ask.source !== 'institution') return no('ai.sources', 'This school permits AI only with its own institution-hosted sources.');
      return yes('ai.providers', `${ask.provider} is permitted.`);
    case 'ai_tokens':
      if (c.ai.annualTokenBudget === null) return yes('ai.budget', 'AI use is unmetered.');
      return ask.usedThisYear + ask.asking <= c.ai.annualTokenBudget
        ? yes('ai.budget', 'Within the annual token budget.')
        : no('ai.budget', `This would exceed the annual token budget of ${c.ai.annualTokenBudget}.`);
    case 'data':
      if (!c.regions.includes(ask.region)) return no('residency', `${ask.region} is outside the regions this contract permits.`);
      return routeAllowed(ask.cls, ask.dest, c.dataRoutes)
        ? yes('data', 'The route is open.')
        : no('data', `${ask.cls} data may not go to ${ask.dest} for this school.`);
    case 'admin_action':
      return c.adminMfa && !ask.mfa ? no('admin.mfa', 'This contract requires multi-factor authentication for every administrator action.') : yes('admin.mfa', 'Authentication meets the contract.');
  }
}

/** A flag decision with the contract asked first. It allows only what both allow. */
export function evaluateUnderContract(key: string, ctx: FlagContext, c: TenantContract | null, now: Date): FlagDecision & { clause: string } {
  const gate = contractDecision(c, { kind: 'module', key }, now);
  if (!gate.allowed) return { allowed: false, step: 'tenant_entitlement', reason: gate.reason, clause: gate.clause };
  return { ...evaluateFlag(key, ctx), clause: gate.clause };
}

// ── Drift ─────────────────────────────────────────────────────────────────

/** What a school's live configuration says, as far as the contract cares. */
export interface LiveConfiguration {
  modulesOn: readonly string[];
  aiProviders: readonly string[];
  aiSources: AiSource;
  aiTokensUsedThisYear: number;
  regions: readonly string[];
  retentionDays: number | null;
  adminMfaRequired: boolean;
}

export interface Violation {
  clause: string;
  detail: string;
}

/** Every way the live configuration differs from the paper. Empty means it matches. */
export function contractViolations(c: TenantContract, live: LiveConfiguration, now: Date): Violation[] {
  const out: Violation[] = [];
  if (!inTerm(c, now)) out.push({ clause: 'term', detail: 'The contract is not in force, yet the school is configured.' });
  for (const m of live.modulesOn) {
    if (c.prohibited.includes(m)) out.push({ clause: 'prohibited', detail: `${m} is on and the contract prohibits it.` });
    else if (!c.modules.includes(m)) out.push({ clause: 'modules', detail: `${m} is on and the contract does not include it.` });
  }
  for (const p of live.aiProviders) if (!c.ai.providers.includes(p)) out.push({ clause: 'ai.providers', detail: `${p} is enabled and is not a permitted provider.` });
  if (c.ai.sources === 'institution_only' && live.aiSources !== 'institution_only') out.push({ clause: 'ai.sources', detail: 'AI is configured for sources beyond the school’s own, which the contract does not permit.' });
  if (c.ai.annualTokenBudget !== null && live.aiTokensUsedThisYear > c.ai.annualTokenBudget) out.push({ clause: 'ai.budget', detail: `${live.aiTokensUsedThisYear} tokens used against a budget of ${c.ai.annualTokenBudget}.` });
  for (const r of live.regions) if (!c.regions.includes(r)) out.push({ clause: 'residency', detail: `Data is held in ${r}, outside the permitted regions.` });
  if (c.retention && live.retentionDays !== null && (live.retentionDays < c.retention.minDays || live.retentionDays > c.retention.maxDays)) {
    out.push({ clause: 'retention', detail: `Retention is ${live.retentionDays} days; the contract requires ${c.retention.minDays} to ${c.retention.maxDays}.` });
  }
  if (c.retention && live.retentionDays === null) out.push({ clause: 'retention', detail: 'No retention is configured and the contract sets a window.' });
  if (c.adminMfa && !live.adminMfaRequired) out.push({ clause: 'admin.mfa', detail: 'Administrators are not required to use multi-factor authentication and the contract requires it.' });
  return out;
}

// ── The contract itself ───────────────────────────────────────────────────

const FLAG_KEYS = new Set(FLAGS.map((f) => f.key));
const isDate = (s: unknown): s is string => typeof s === 'string' && !Number.isNaN(Date.parse(s));

/** What is wrong with a contract as written. Empty means it can be used. */
export function contractProblems(c: TenantContract): string[] {
  const p: string[] = [];
  if (!c.tenantId) p.push('tenantId is empty.');
  if (!isDate(c.effectiveFrom)) p.push('effectiveFrom is not a date.');
  if (c.effectiveTo !== null && !isDate(c.effectiveTo)) p.push('effectiveTo is not a date.');
  if (isDate(c.effectiveFrom) && c.effectiveTo !== null && isDate(c.effectiveTo) && day(c.effectiveTo) <= day(c.effectiveFrom)) p.push('effectiveTo is not after effectiveFrom.');
  for (const k of [...c.modules, ...c.prohibited]) if (!FLAG_KEYS.has(k)) p.push(`${k} is not a registered flag.`);
  for (const k of c.modules) if (c.prohibited.includes(k)) p.push(`${k} is both included and prohibited.`);
  if (c.regions.length === 0) p.push('No region is permitted, so no data could be stored.');
  if (new Set(c.regions).size !== c.regions.length) p.push('A region is listed twice.');
  if (c.ai.annualTokenBudget !== null && (!Number.isFinite(c.ai.annualTokenBudget) || c.ai.annualTokenBudget < 0)) p.push('The token budget is not a non-negative number.');
  if (c.retention && !(Number.isInteger(c.retention.minDays) && Number.isInteger(c.retention.maxDays) && c.retention.minDays >= 1 && c.retention.minDays <= c.retention.maxDays)) p.push('Retention must be whole days with 1 ≤ min ≤ max.');
  if (c.support.tier === 'named' && !c.support.escalation) p.push('A named support tier needs a named escalation path.');
  for (const cls of Object.keys(c.dataRoutes ?? {}) as DataClass[]) {
    if (!DATA_CLASSES.includes(cls)) { p.push(`${cls} is not a data class.`); continue; }
    for (const dest of Object.keys(c.dataRoutes![cls]!) as Destination[]) {
      if (!DESTINATIONS.includes(dest)) p.push(`${dest} is not a destination.`);
      else if (c.dataRoutes![cls]![dest] && !PLATFORM_ROUTES[cls][dest]) p.push(`${cls} to ${dest} is opened by the contract and closed by the platform floor; a contract may only close routes.`);
    }
  }
  return p;
}

/**
 * A contract read from a stored row. Anything that is not exactly a contract is
 * refused with the reason, never repaired: a half-read contract that allows
 * more than the paper does is the failure this file exists to prevent.
 */
export function readContract(raw: unknown): { contract: TenantContract } | { error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { error: 'The contract is not an object.' };
  const r = raw as Record<string, unknown>;
  const strings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  const ai = r.ai as Record<string, unknown> | undefined;
  const support = r.support as Record<string, unknown> | undefined;
  if (typeof r.tenantId !== 'string') return { error: 'tenantId is missing.' };
  if (!strings(r.modules) || !strings(r.prohibited) || !strings(r.regions)) return { error: 'modules, prohibited and regions must be lists of text.' };
  if (!ai || !strings(ai.providers) || (ai.sources !== 'institution_only' && ai.sources !== 'any_authorized')) return { error: 'The AI arrangement is missing or unreadable.' };
  if (!(ai.annualTokenBudget === null || typeof ai.annualTokenBudget === 'number')) return { error: 'The token budget is not a number or null.' };
  if (typeof r.adminMfa !== 'boolean') return { error: 'adminMfa must be true or false.' };
  if (!support || !['standard', 'priority', 'named'].includes(support.tier as string) || !(support.escalation === null || typeof support.escalation === 'string')) return { error: 'The support arrangement is unreadable.' };
  const contract = raw as TenantContract;
  const problems = contractProblems(contract);
  return problems.length === 0 ? { contract } : { error: problems[0]! };
}
