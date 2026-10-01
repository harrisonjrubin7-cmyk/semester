import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_MAY,
  AUTOMATION_MUST_NOT,
  FAILOVER_RULES,
  INCIDENT_LIFECYCLE,
  RECOVERY_OBJECTIVES,
  validateIncident,
} from './incident-recovery';

describe('incident and recovery control contract', () => {
  it('labels every objective as proposed, approval-required, and unmeasured', () => {
    expect(RECOVERY_OBJECTIVES).toHaveLength(5);
    expect(RECOVERY_OBJECTIVES.every((objective) => objective.approval === 'institution_approval_required')).toBe(true);
    expect(RECOVERY_OBJECTIVES.every((objective) => objective.evidence === 'unmeasured')).toBe(true);
    expect(RECOVERY_OBJECTIVES.find((objective) => objective.tier === 'tier0')).toMatchObject({ proposedRtoMinutes: 60, proposedRpoMinutes: 15 });
  });

  it('only automates fail-safe actions and never weakens a control to look available', () => {
    expect(FAILOVER_RULES.every((rule) => AUTOMATION_MAY.includes(rule.automatedAction))).toBe(true);
    expect(AUTOMATION_MUST_NOT).toContain('weaken_authentication');
    expect(AUTOMATION_MUST_NOT).toContain('retry_ambiguous_official_write');
    expect(AUTOMATION_MUST_NOT).toContain('share_private_student_details');
  });

  it('uses the same detect-to-verified-close lifecycle for every incident', () => {
    expect(INCIDENT_LIFECYCLE).toEqual(['detect', 'contain', 'communicate', 'recover', 'verify', 'close']);
  });

  it('does not allow an incident to close without a commander, next update, and verification', () => {
    expect(validateIncident({
      id: 'INC-1', severity: 'P0', declaredAt: 100, commander: '', affectedServices: ['Identity'],
      studentVisibleEffect: 'Sign-in unavailable', privateStudentDataIncluded: false, status: 'close', nextUpdateAt: 100, verification: [],
    })).toEqual(['named incident commander', 'future next-update time', 'recovery verification']);
    expect(validateIncident({
      id: 'INC-2', severity: 'P1', declaredAt: 100, commander: 'Incident lead', affectedServices: ['LTI'],
      studentVisibleEffect: 'Course launch unavailable', privateStudentDataIncluded: false, status: 'close', nextUpdateAt: 200, verification: ['Valid launch succeeds; invalid token is rejected'],
    })).toEqual([]);
  });
});
