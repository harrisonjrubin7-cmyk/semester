/**
 * One connection's health, decided in one place, and what the screens say
 * about it.
 *
 * The status words are the database's (`ConnectionStatus`); this adds a
 * *reason*, so "error" is never the whole story, and a precedence, so two
 * signals that disagree always resolve the same way. Pure: the worker, the
 * dashboard and the tests all call `connectionHealth` with explicit inputs.
 *
 * Degraded does not mean broken for the student. `degradedExperience` always
 * names the native screen that still does the job (`fallback.ts`) and never
 * lets an imported fact be called official once it is not live or recent.
 */
import type { ConnectionStatus, Freshness, ProviderDomain } from './catalog.ts';
import { freshnessFromAge, isOfficialCurrent } from './freshness.ts';
import { NATIVE_FALLBACK } from './fallback.ts';

export type BreakerState = 'closed' | 'open' | 'half_open';

export type HealthReason =
  | 'ok' | 'not_approved' | 'never_synced' | 'kill_switch' | 'paused_by_operator'
  | 'reauthorization_required' | 'circuit_open' | 'provider_unavailable' | 'rate_limited'
  | 'schema_drift' | 'partial_failure' | 'dead_letters_waiting' | 'stale';

export interface HealthInput {
  approved: boolean;
  paused: boolean;
  killSwitchEngaged: boolean;
  auth: 'ok' | 'needs_reauth';
  breaker: BreakerState;
  rateLimitedUntil: Date | null;
  lastSuccessAt: Date | null;
  lastRun: { status: 'succeeded' | 'partial' | 'failed'; at: Date } | null;
  freshnessTargetMinutes: number;
  openDeadLetters: number;
  driftHeld: boolean;
  now: Date;
}

export interface Health {
  status: ConnectionStatus;
  reason: HealthReason;
  freshness: Freshness;
}

/** Decide in this order; the first rule that applies wins. */
export function connectionHealth(i: HealthInput): Health {
  const freshness = freshnessFromAge(i.lastSuccessAt, i.freshnessTargetMinutes, i.now, i.lastSuccessAt !== null);
  const is = (status: ConnectionStatus, reason: HealthReason): Health => ({ status, reason, freshness });

  if (!i.approved) return is('configuring', 'not_approved');
  if (i.killSwitchEngaged) return is('paused', 'kill_switch');
  if (i.paused) return is('paused', 'paused_by_operator');
  if (i.auth === 'needs_reauth') return is('error', 'reauthorization_required');
  if (i.breaker === 'open') return is('error', 'circuit_open');
  if (!i.lastRun && !i.lastSuccessAt) return is('configuring', 'never_synced');
  if (i.lastRun?.status === 'failed') {
    // A failure on top of data still inside its target is a wobble; a failure
    // with nothing current behind it is an outage.
    const covered = freshness === 'live' || freshness === 'recent';
    return is(covered ? 'degraded' : 'error', 'provider_unavailable');
  }
  if (i.rateLimitedUntil && i.rateLimitedUntil.getTime() > i.now.getTime()) return is('degraded', 'rate_limited');
  if (i.driftHeld) return is('degraded', 'schema_drift');
  if (i.lastRun?.status === 'partial') return is('degraded', 'partial_failure');
  if (i.openDeadLetters > 0) return is('degraded', 'dead_letters_waiting');
  if (freshness === 'stale') return is('degraded', 'stale');
  return is('healthy', 'ok');
}

/** What an operator should do next, by reason. Staff-facing; never shown to a student. */
export const OPERATOR_NEXT_STEP: Record<HealthReason, string> = {
  ok: 'Nothing to do.',
  not_approved: 'A university admin who is not the connection’s owner has to approve it.',
  never_synced: 'Waiting for the first scheduled pull. Run one from the dashboard to check the connection now.',
  kill_switch: 'A kill switch is engaged. Resume only after the incident that engaged it is closed.',
  paused_by_operator: 'Paused on purpose. Resume it when the school is ready.',
  reauthorization_required: 'The provider refused the stored grant. Have the school re-authorize; retrying will not help.',
  circuit_open: 'The provider has failed repeatedly, so calls are stopped. It will probe again on its own; check the provider’s status page.',
  provider_unavailable: 'The last pull failed. Check the provider and the sync errors; it retries with back-off.',
  rate_limited: 'The provider asked us to slow down. It resumes on its own after the wait.',
  schema_drift: 'The provider’s data changed shape. Review the held entity and propose a mapping version.',
  partial_failure: 'Some records were rejected. Open the run to see which kinds, then fix the mapping or ask the provider.',
  dead_letters_waiting: 'Events failed every retry. Review the dead letters, then replay or resolve them.',
  stale: 'Nothing new has arrived inside the freshness target. Run a pull and check the schedule.',
};

export interface DegradedExperience {
  /** The state, in words and with a glyph, so colour never carries it alone. */
  badge: string;
  /** For the student surface, or null when there is nothing to say. */
  student: string | null;
  staff: string;
  /** The native screen that still does this job. Always present. */
  nativeRoute: string;
  augments: string;
  /** Whether a card may call what it shows the school’s official current record. */
  officialCurrent: boolean;
  /** Always true: no connector state removes the native journey. */
  coreJourneyAvailable: true;
}

const BADGE: Record<ConnectionStatus, string> = {
  disconnected: '○ Not connected', configuring: '◐ Setting up', healthy: '● Up to date',
  degraded: '▲ Delayed', paused: '❚❚ Paused', error: '✕ Not updating',
};

export function degradedExperience(domain: ProviderDomain, health: Health, sourceLabel: string): DegradedExperience {
  const fb = NATIVE_FALLBACK[domain];
  const quiet = health.status === 'healthy' || health.status === 'configuring' || health.status === 'disconnected';
  const student = quiet ? null
    : `${sourceLabel} isn’t updating right now. ${fb.augments} still works here, and anything we imported keeps the date it was last updated.`;
  return {
    badge: BADGE[health.status],
    student,
    staff: OPERATOR_NEXT_STEP[health.reason],
    nativeRoute: fb.nativeRoute,
    augments: fb.augments,
    officialCurrent: isOfficialCurrent(health.freshness, 'connected_institutional') && health.status === 'healthy',
    coreJourneyAvailable: true,
  };
}
