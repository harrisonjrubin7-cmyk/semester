/**
 * Evidence required before the read-only registration-readiness pilot can be
 * described as operationally ready for one tenant.
 *
 * This evaluator does not read production and does not activate anything. It
 * validates a dated evidence packet captured by an authorized operator. An
 * absent packet therefore stays a blocker rather than becoming an assumption.
 */

export const REGISTRATION_PILOT_CONTROL = {
  ownerSeat: 'Registrar pilot owner',
  supportQueue: 'support.registrar',
  metric: 'registration_ready',
  runbook: 'docs/runbooks/registration.md',
  requiredProductionFlags: ['integration.sis_read', 'scope.sis.registration_hold_summary_read'],
  prohibitedProductionFlags: ['writeback.registration_submit'],
  killSwitches: ['kill.integration_sync', 'kill.writeback'],
} as const;

type FeatureState = 'off' | 'preview' | 'sandbox' | 'production';

export interface RegistrationPilotEvidence {
  tenantId: string;
  pilotOwner: { name: string; seat: string };
  observedAt: string;
  connection: { approved: boolean; status: 'draft' | 'pending' | 'approved' | 'live' | 'paused' | 'disconnected' | 'failed' | 'revoked' | 'expired' | 'rejected' | 'deleted' | 'archived' | 'error' | 'unknown' | 'sandbox' };
  featureStates: Record<(typeof REGISTRATION_PILOT_CONTROL.requiredProductionFlags)[number] | (typeof REGISTRATION_PILOT_CONTROL.prohibitedProductionFlags)[number], FeatureState>;
  killSwitches: Record<(typeof REGISTRATION_PILOT_CONTROL.killSwitches)[number], boolean>;
  rollbackRehearsal?: { completedAt: string; evidencePath: string };
}

export type RegistrationPilotBlocker =
  | 'tenant_missing'
  | 'owner_missing'
  | 'observation_time_invalid'
  | 'observation_stale'
  | 'sis_connection_not_live'
  | `required_flag_not_production:${(typeof REGISTRATION_PILOT_CONTROL.requiredProductionFlags)[number]}`
  | `prohibited_flag_not_off:${(typeof REGISTRATION_PILOT_CONTROL.prohibitedProductionFlags)[number]}`
  | `kill_switch_engaged:${(typeof REGISTRATION_PILOT_CONTROL.killSwitches)[number]}`
  | `kill_switch_unverified:${(typeof REGISTRATION_PILOT_CONTROL.killSwitches)[number]}`
  | 'rollback_rehearsal_missing'
  | 'rollback_rehearsal_invalid'
  | 'rollback_rehearsal_stale';

const DAY = 24 * 60 * 60 * 1000;
const PLACEHOLDER_OWNER = /^(?:tbd|todo|unassigned|unknown|n\/a|none)$/i;

function validPastInstant(value: string, now: Date): Date | null {
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed <= now ? parsed : null;
}

export function evaluateRegistrationPilot(
  evidence: RegistrationPilotEvidence,
  now = new Date(),
): { ready: boolean; blockers: RegistrationPilotBlocker[] } {
  const blockers: RegistrationPilotBlocker[] = [];
  if (!evidence.tenantId.trim()) blockers.push('tenant_missing');
  if (
    !evidence.pilotOwner.name.trim()
    || PLACEHOLDER_OWNER.test(evidence.pilotOwner.name.trim())
    || evidence.pilotOwner.seat !== REGISTRATION_PILOT_CONTROL.ownerSeat
  ) blockers.push('owner_missing');
  const observedAt = validPastInstant(evidence.observedAt, now);
  if (!observedAt) blockers.push('observation_time_invalid');
  else if (now.valueOf() - observedAt.valueOf() > DAY) blockers.push('observation_stale');
  if (!evidence.connection.approved || evidence.connection.status !== 'live') blockers.push('sis_connection_not_live');

  for (const key of REGISTRATION_PILOT_CONTROL.requiredProductionFlags) {
    if (evidence.featureStates[key] !== 'production') blockers.push(`required_flag_not_production:${key}`);
  }
  for (const key of REGISTRATION_PILOT_CONTROL.prohibitedProductionFlags) {
    if (evidence.featureStates[key] !== 'off') blockers.push(`prohibited_flag_not_off:${key}`);
  }
  for (const key of REGISTRATION_PILOT_CONTROL.killSwitches) {
    if (evidence.killSwitches[key] === true) blockers.push(`kill_switch_engaged:${key}`);
    else if (evidence.killSwitches[key] !== false) blockers.push(`kill_switch_unverified:${key}`);
  }

  if (!evidence.rollbackRehearsal) {
    blockers.push('rollback_rehearsal_missing');
  } else {
    const completedAt = validPastInstant(evidence.rollbackRehearsal.completedAt, now);
    if (
      !completedAt
      || !/^docs\/evidence\/registration\/[a-z0-9][a-z0-9._-]*\.(?:md|json)$/i.test(evidence.rollbackRehearsal.evidencePath)
    ) blockers.push('rollback_rehearsal_invalid');
    else if (now.valueOf() - completedAt.valueOf() > 14 * DAY) blockers.push('rollback_rehearsal_stale');
  }

  return { ready: blockers.length === 0, blockers };
}
