/**
 * The route table and the rules that choose and fail over between routes:
 * `GW-03`, `GW-04`, `GW-06`, `GW-07`, `GW-08` of docs/ai-governance/02-model-gateway.md.
 *
 * Today a route is `{ model, provider, estimatedCents }` and `chooseModel`
 * picks the cheapest one the tenant allows under a cost ceiling. That is the
 * last step of selection with none of the first ones: nothing asks whether the
 * route may process this tenant's region, whether the model is a pinned
 * version, whether its data handling is attested, or whether there is any
 * evidence it works for this feature. And there is no failover at all, so the
 * rules for it had never been written where a test could hold them.
 *
 * This file is those rules, as pure functions over rows. It reads no network,
 * no database and no clock (`today` is an argument). It is **not wired**: the
 * runtime still calls `chooseModel`, and a second provider is not installed.
 * Wiring it is the next slice, and it can be done against these tests.
 *
 * ## The rules, in one place
 *
 * - A route is **eligible** only if it passes every filter, and a refusal says
 *   which one. Nothing is relaxed to find a route: no eligible route means no
 *   chain, and the caller says the model is unavailable.
 * - A fallback is eligible only if it is **on the tenant's pre-approved,
 *   ordered list** and passes every filter for this request. A cheaper, healthier
 *   route that is not on the list is never a fallback.
 * - **A refusal is not an outage.** A model that declines, or a policy that
 *   stops the request, never fails over. A stream cut mid-answer is never
 *   stitched from a second provider.
 * - The budget reservation covers the **worst route in the chain**.
 */

export const ROUTE_STATUSES = ['candidate', 'canary', 'active', 'deprecated', 'withdrawn'] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export type Capability = 'vision' | 'structured-output' | 'long-context' | 'tool-use';
export type RouteTier = 0 | 1 | 2 | 3;

export interface RouteRow {
  id: string;
  provider: string;
  /** A pinned version identifier. An alias is a silent model change and is never eligible. */
  model: string;
  /** The regions the provider will process in. */
  regions: readonly string[];
  /** Attested values count only with a contract reference. Published provider language is not a contract. */
  attestation: { zeroRetention: boolean; noTraining: boolean; contract: string | null };
  capabilities: readonly Capability[];
  estimatedCents: number;
  p95Ms: number;
  status: RouteStatus;
  /** While `canary`, the only tenants it may serve. */
  canaryTenants?: readonly string[];
  approvedTiers: readonly RouteTier[];
  /** ISO day the feature's evaluation evidence for this route expires; null when there is none. */
  evidenceUntil: string | null;
}

export interface RouteRequest {
  tenantId: string;
  /** The tenant's data zone: fixed at onboarding. */
  zone: string;
  /** The route ids the tenant allows. */
  allowed: readonly string[];
  /** The tenant's pre-approved fallback route ids, in order. */
  fallback: readonly string[];
  needs: readonly Capability[];
  tier: RouteTier;
  maxCents: number;
  requireZeroRetention: boolean;
  requireNoTraining: boolean;
  /** An ISO day, passed in. */
  today: string;
  /** Route ids whose circuit breaker is open. */
  open: ReadonlySet<string>;
}

export type Refusal =
  | 'not-allowed' | 'alias' | 'zone' | 'capability' | 'status' | 'tier'
  | 'evidence' | 'attestation' | 'cost' | 'breaker';

/** A pinned model carries a snapshot date and is not a moving alias. */
export function isPinned(model: string): boolean {
  if (/(^|[-_.@:])(latest|preview|stable|current)($|[-_.@:])/i.test(model)) return false;
  return /(^|[-_.@:])(\d{4}-\d{2}-\d{2}|\d{8})($|[-_.@:])/.test(model);
}

/** Why a route may not serve this request, or null if it may. Checked in a fixed order so the reason is stable. */
export function refusal(row: RouteRow, req: RouteRequest): Refusal | null {
  if (!req.allowed.includes(row.id)) return 'not-allowed';
  if (!isPinned(row.model)) return 'alias';
  if (!row.regions.includes(req.zone)) return 'zone';
  if (!req.needs.every((n) => row.capabilities.includes(n))) return 'capability';
  const live = row.status === 'active' || (row.status === 'canary' && (row.canaryTenants ?? []).includes(req.tenantId));
  if (!live) return 'status';
  if (!row.approvedTiers.includes(req.tier)) return 'tier';
  if (req.tier >= 1 && (row.evidenceUntil === null || row.evidenceUntil < req.today)) return 'evidence';
  const attested = row.attestation.contract !== null;
  if (req.requireZeroRetention && !(attested && row.attestation.zeroRetention)) return 'attestation';
  if (req.requireNoTraining && !(attested && row.attestation.noTraining)) return 'attestation';
  if (!Number.isFinite(row.estimatedCents) || row.estimatedCents < 0 || row.estimatedCents > req.maxCents) return 'cost';
  if (req.open.has(row.id)) return 'breaker';
  return null;
}

export interface RouteDecision {
  /** The primary first, then the approved fallbacks in order. Empty means no route may serve this request. */
  chain: readonly RouteRow[];
  /** Why each route that was considered did not make the chain. */
  refused: Readonly<Record<string, Refusal>>;
}

/** Cost, then observed latency, then id, so the choice is deterministic and testable. */
const byRank = (a: RouteRow, b: RouteRow) =>
  a.estimatedCents - b.estimatedCents || a.p95Ms - b.p95Ms || a.id.localeCompare(b.id);

export function selectRoutes(table: readonly RouteRow[], req: RouteRequest): RouteDecision {
  const refused: Record<string, Refusal> = {};
  const eligible: RouteRow[] = [];
  for (const row of table) {
    const why = refusal(row, req);
    if (why) refused[row.id] = why;
    else eligible.push(row);
  }
  const primary = [...eligible].sort(byRank)[0];
  if (!primary) return { chain: [], refused };
  const fallbacks: RouteRow[] = [];
  for (const id of req.fallback) {
    const row = eligible.find((r) => r.id === id);
    if (row && row.id !== primary.id && !fallbacks.includes(row)) fallbacks.push(row);
  }
  return { chain: [primary, ...fallbacks], refused };
}

export type Failure = 'timeout' | 'server-error' | 'invalid-response' | 'refusal' | 'policy' | 'partial-stream';

export type Next =
  | { do: 'retry' }
  | { do: 'next'; index: number }
  | { do: 'stop'; reason: 'refusal' | 'policy' | 'partial-stream' | 'exhausted' };

/**
 * What to do after a route fails.
 *
 * One retry on the same route for a timeout or a server error, then the next
 * route; the next route straight away for an invalid response. A refusal, a
 * policy stop and a stream cut part-way never fail over: shopping for a model
 * that complies defeats the refusal, and an answer stitched from two providers
 * is not an answer either of them gave.
 */
export function afterFailure(chainLength: number, state: { index: number; retried: boolean }, failure: Failure): Next {
  if (failure === 'refusal' || failure === 'policy' || failure === 'partial-stream') return { do: 'stop', reason: failure };
  if ((failure === 'timeout' || failure === 'server-error') && !state.retried) return { do: 'retry' };
  const index = state.index + 1;
  return index < chainLength ? { do: 'next', index } : { do: 'stop', reason: 'exhausted' };
}

/** The amount to reserve: the worst route the chain could land on, not the first. */
export const reserveCents = (chain: readonly RouteRow[]): number => chain.reduce((m, r) => Math.max(m, r.estimatedCents), 0);

/** Whether a different provider than the primary handled the request, which changes who processed the tenant's data. */
export const fellBack = (chain: readonly RouteRow[], usedIndex: number): boolean =>
  usedIndex > 0 && chain[usedIndex]?.provider !== chain[0]?.provider;
