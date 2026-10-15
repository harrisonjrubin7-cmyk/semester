/**
 * The read envelope: one typed answer to "what is this screen allowed to claim?"
 *
 * `docs/architecture/frontend-backend-contracts.md` states the rule — the
 * frontend renders server-owned facts and does not infer authority, freshness
 * or permission — and `universal-state-model.md` lists the fourteen states.
 * Both called this "Phase B"; until now every screen decided for itself. This
 * is the type and the one function that turns an envelope into what may be
 * drawn.
 *
 * Three rules are enforced here rather than left to each renderer:
 *
 * - **Unknown fails closed.** A state this build does not know is
 *   `unavailable`, never `connected` or `verified`.
 * - **Denial leaks nothing.** `permission_denied` drops `data`.
 * - **A claim needs its evidence.** `verified` without a verifier time, or
 *   from a derived/student source, is `connected`; `connected` with no
 *   observation time or one past `staleAfter` is `stale`. Null freshness is
 *   unknown, not current.
 */

import type { SourceLabel } from '../source';

export const OPERATIONAL_STATES = [
  'loading', 'empty', 'connected', 'syncing', 'stale', 'offline', 'permission_denied',
  'unavailable', 'error', 'pending_approval', 'draft', 'verified', 'archived', 'deleted',
] as const;
export type OperationalState = (typeof OPERATIONAL_STATES)[number];

export type Authority = 'student' | 'semester' | 'institution' | 'sis' | 'lms' | 'partner' | 'provider' | 'derived';

/** Authorities that may be the origin of a `verified` claim. */
const MAY_VERIFY: readonly Authority[] = ['institution', 'sis', 'lms', 'partner', 'provider'];

export interface Recovery {
  action: string;
  label: string;
}

export interface ReadEnvelope<T> {
  schemaVersion: string;
  data: T | null;
  state: OperationalState;
  authority: Authority;
  source: { id: string; label: string; kind: SourceLabel | string };
  observedAt: string | null;
  verifiedAt: string | null;
  staleAfter: string | null;
  permission: { canRead: boolean; allowedActions: string[]; reasonCode?: string };
  recovery: Recovery[];
  supportReference?: string;
  correlationId: string;
  limitations: string[];
}

export const ENVELOPE_VERSION = '1';

export function isOperationalState(value: unknown): value is OperationalState {
  return typeof value === 'string' && (OPERATIONAL_STATES as readonly string[]).includes(value);
}

/** The state the screen may claim: the envelope's own, corrected by its evidence. */
export function effectiveState<T>(env: ReadEnvelope<T>, now: number): OperationalState {
  const claimed: unknown = env.state;
  if (!isOperationalState(claimed)) return 'unavailable';
  if (!env.permission.canRead) return 'permission_denied';
  if (claimed === 'verified') {
    if (!env.verifiedAt || !MAY_VERIFY.includes(env.authority)) return pastDue(env, now) ? 'stale' : 'connected';
  }
  if (claimed === 'connected' || claimed === 'verified') {
    if (!env.observedAt || Number.isNaN(Date.parse(env.observedAt))) return 'stale';
    if (pastDue(env, now)) return 'stale';
  }
  return claimed;
}

function pastDue<T>(env: ReadEnvelope<T>, now: number): boolean {
  if (!env.observedAt || Number.isNaN(Date.parse(env.observedAt))) return true;
  if (!env.staleAfter) return false;
  const limit = Date.parse(env.staleAfter);
  return Number.isNaN(limit) || now >= limit;
}

/** What a renderer draws. The eight the brief names, plus the content itself. */
export type Surface = 'content' | 'loading' | 'empty' | 'denied' | 'offline' | 'pending' | 'degraded' | 'failed';

export interface Presentation<T> {
  surface: Surface;
  state: OperationalState;
  /** Null whenever the surface must not show it (denied, loading, failed). */
  data: T | null;
  /** True when `data` is shown beside a notice rather than instead of one. */
  withNotice: boolean;
  recovery: Recovery[];
  limitations: string[];
}

export function present<T>(env: ReadEnvelope<T>, now: number): Presentation<T> {
  const state = effectiveState(env, now);
  const hasData = env.data !== null && env.data !== undefined;
  const base = { state, recovery: env.recovery, limitations: env.limitations };
  switch (state) {
    case 'loading':
      return { ...base, surface: 'loading', data: null, withNotice: false };
    case 'permission_denied':
      return { ...base, surface: 'denied', data: null, withNotice: false, limitations: [] };
    case 'empty':
      return { ...base, surface: 'empty', data: null, withNotice: false };
    case 'error':
      return { ...base, surface: 'failed', data: null, withNotice: false };
    case 'pending_approval':
      return { ...base, surface: 'pending', data: env.data, withNotice: hasData };
    case 'offline':
      return { ...base, surface: 'offline', data: env.data, withNotice: hasData };
    case 'stale':
    case 'syncing':
    case 'unavailable':
      // Last known data stays, beside a notice; with none, the notice stands alone.
      return { ...base, surface: 'degraded', data: env.data, withNotice: hasData };
    case 'archived':
    case 'deleted':
      return { ...base, surface: hasData ? 'content' : 'empty', data: env.data, withNotice: hasData };
    default:
      return { ...base, surface: hasData ? 'content' : 'empty', data: env.data, withNotice: false };
  }
}

let counter = 0;
/** A correlation id good for one session; the server's, when there is one, wins. */
export function localCorrelationId(): string {
  counter += 1;
  return `local-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/** An envelope with the safe defaults: unknown freshness, nothing allowed, no recovery. */
export function envelope<T>(over: Partial<ReadEnvelope<T>> & Pick<ReadEnvelope<T>, 'state' | 'source' | 'authority'>): ReadEnvelope<T> {
  return {
    schemaVersion: ENVELOPE_VERSION,
    data: null,
    observedAt: null,
    verifiedAt: null,
    staleAfter: null,
    permission: { canRead: true, allowedActions: [] },
    recovery: [],
    correlationId: localCorrelationId(),
    limitations: [],
    ...over,
  };
}
