import { describe, expect, it } from 'vitest';
import {
  REGISTRATION_PILOT_CONTROL,
  evaluateRegistrationPilot,
  type RegistrationPilotEvidence,
} from './registration-operations';

const validEvidence = (): RegistrationPilotEvidence => ({
  tenantId: 'vu-pilot',
  pilotOwner: { name: 'Avery Registrar', seat: 'Registrar pilot owner' },
  observedAt: '2026-10-12T15:00:00.000Z',
  connection: { approved: true, status: 'live' },
  featureStates: {
    'integration.sis_read': 'production',
    'scope.sis.registration_hold_summary_read': 'production',
    'writeback.registration_submit': 'off',
  },
  killSwitches: { 'kill.integration_sync': false, 'kill.writeback': false },
  rollbackRehearsal: { completedAt: '2026-10-10T18:00:00.000Z', evidencePath: 'docs/evidence/registration/rollback-2026-10-10.md' },
});

describe('registration pilot operational readiness', () => {
  it('binds the pilot to the registration runbook, metric, flags and owner seat', () => {
    expect(REGISTRATION_PILOT_CONTROL).toEqual({
      ownerSeat: 'Registrar pilot owner',
      supportQueue: 'support.registrar',
      metric: 'registration_ready',
      runbook: 'docs/runbooks/registration.md',
      requiredProductionFlags: ['integration.sis_read', 'scope.sis.registration_hold_summary_read'],
      prohibitedProductionFlags: ['writeback.registration_submit'],
      killSwitches: ['kill.integration_sync', 'kill.writeback'],
    });
  });

  it('accepts a complete, recent, read-only tenant evidence packet', () => {
    expect(evaluateRegistrationPilot(validEvidence(), new Date('2026-10-12T16:00:00.000Z'))).toEqual({
      ready: true,
      blockers: [],
    });
  });

  it('fails closed when ownership, tenant or live configuration is not proved', () => {
    const evidence = validEvidence();
    evidence.tenantId = ' ';
    evidence.pilotOwner = { name: 'TBD', seat: 'Registrar pilot owner' };
    evidence.connection = { approved: false, status: 'sandbox' };
    evidence.featureStates['integration.sis_read'] = 'preview';
    evidence.featureStates['writeback.registration_submit'] = 'production';
    evidence.killSwitches['kill.integration_sync'] = true;

    expect(evaluateRegistrationPilot(evidence, new Date('2026-10-12T16:00:00.000Z')).blockers).toEqual([
      'tenant_missing',
      'owner_missing',
      'sis_connection_not_live',
      'required_flag_not_production:integration.sis_read',
      'prohibited_flag_not_off:writeback.registration_submit',
      'kill_switch_engaged:kill.integration_sync',
    ]);
  });

  it('rejects missing, future or older-than-fourteen-days evidence', () => {
    const missing = validEvidence();
    delete missing.rollbackRehearsal;
    expect(evaluateRegistrationPilot(missing, new Date('2026-10-12T16:00:00.000Z')).blockers).toContain('rollback_rehearsal_missing');

    const future = validEvidence();
    future.observedAt = '2026-10-13T16:00:00.000Z';
    expect(evaluateRegistrationPilot(future, new Date('2026-10-12T16:00:00.000Z')).blockers).toContain('observation_time_invalid');

    const oldObservation = validEvidence();
    oldObservation.observedAt = '2026-10-10T15:59:59.000Z';
    expect(evaluateRegistrationPilot(oldObservation, new Date('2026-10-12T16:00:00.000Z')).blockers).toContain('observation_stale');

    const stale = validEvidence();
    stale.rollbackRehearsal = { completedAt: '2026-09-01T00:00:00.000Z', evidencePath: 'docs/evidence/registration/rollback-old.md' };
    expect(evaluateRegistrationPilot(stale, new Date('2026-10-12T16:00:00.000Z')).blockers).toContain('rollback_rehearsal_stale');

    const external = validEvidence();
    external.rollbackRehearsal = { completedAt: '2026-10-10T18:00:00.000Z', evidencePath: 'https://example.edu/result' };
    expect(evaluateRegistrationPilot(external, new Date('2026-10-12T16:00:00.000Z')).blockers).toContain('rollback_rehearsal_invalid');
  });

  it('requires explicit safe kill-switch observations rather than treating missing as false', () => {
    const evidence = validEvidence();
    delete (evidence.killSwitches as Partial<RegistrationPilotEvidence['killSwitches']>)['kill.writeback'];
    expect(evaluateRegistrationPilot(evidence, new Date('2026-10-12T16:00:00.000Z')).blockers).toContain(
      'kill_switch_unverified:kill.writeback',
    );
  });
});
