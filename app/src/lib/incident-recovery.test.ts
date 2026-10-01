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
    expect(RECOVERY_OBJECTIVES.every((objective) => objective.rtoMinutes === null && objective.rpoMinutes === null)).toBe(true);
    expect(RECOVERY_OBJECTIVES.map((objective) => objective.tier)).toEqual(['tier0', 'tier1', 'tier2', 'tier3', 'restricted']);
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
      id: 'INC-1', severity: 'SEV1', declaredAt: 100, commander: '', affectedServices: ['Identity'], tenantScope: { scope: 'platform_wide' },
      studentVisibleEffect: 'Sign-in unavailable', privateStudentDataIncluded: false, status: 'close', nextUpdateAt: 100, verification: [],
    }, 150)).toEqual(['named incident commander', 'recovery verification', 'complete close-out evidence']);
    expect(validateIncident({
      id: 'INC-2', severity: 'SEV2', declaredAt: 100, commander: 'Incident lead', affectedServices: ['LTI'], tenantScope: { scope: 'tenant_specific', tenantIds: ['vanderbilt'] },
      studentVisibleEffect: 'Course launch unavailable', privateStudentDataIncluded: false, status: 'close', nextUpdateAt: 200, verification: ['Valid launch succeeds; invalid token is rejected'],
      closeOut: { measuredTimeline: '10:00–10:30 UTC', impact: 'Launch unavailable', recoveryPoint: 'No data loss', communications: ['Status update sent'], correctiveActions: [{ action: 'Add regression', owner: 'Integrations', dueAt: 300, requiredEvidence: 'Passing launch test' }] },
    }, 150)).toEqual([]);
  });

  it('rejects overdue updates for active incidents and blank verification evidence', () => {
    expect(validateIncident({
      id: 'INC-3', severity: 'SEV3', declaredAt: 100, commander: 'Incident lead', affectedServices: ['Sources'], tenantScope: { scope: 'tenant_specific', tenantIds: ['vanderbilt'] },
      studentVisibleEffect: 'Source stale', privateStudentDataIncluded: false, status: 'recover', nextUpdateAt: 200, verification: [],
    }, 201)).toContain('future next-update time');
    expect(validateIncident({
      id: 'INC-4', severity: 'SEV2', declaredAt: 100, commander: 'Incident lead', affectedServices: ['LTI'], tenantScope: { scope: 'suspected_cross_tenant', tenantIds: ['vanderbilt'] },
      studentVisibleEffect: 'Course launch unavailable', privateStudentDataIncluded: false, status: 'verify', nextUpdateAt: 300, verification: ['   '],
    }, 201)).toContain('recovery verification');
  });

  it('requires tenant scope and rejects private student data at runtime', () => {
    const record = {
      id: 'INC-5', severity: 'SEV1', declaredAt: 100, commander: 'Incident lead', affectedServices: ['Identity'],
      tenantScope: { scope: 'tenant_specific', tenantIds: [] }, studentVisibleEffect: 'Access unavailable',
      privateStudentDataIncluded: true, status: 'contain', nextUpdateAt: 300, verification: [],
    } as unknown as Parameters<typeof validateIncident>[0];
    expect(validateIncident(record, 200)).toEqual(expect.arrayContaining(['tenant scope', 'private student data excluded']));
  });

  it('rejects blank-only affected service entries', () => {
    expect(validateIncident({
      id: 'INC-6', severity: 'SEV2', declaredAt: 100, commander: 'Incident lead', affectedServices: ['   '],
      tenantScope: { scope: 'platform_wide' }, studentVisibleEffect: 'Service unavailable',
      privateStudentDataIncluded: false, status: 'contain', nextUpdateAt: 300, verification: [],
    }, 200)).toContain('affected service');
  });

  it('rejects non-finite update times and unknown lifecycle statuses at runtime', () => {
    const base = {
      id: 'INC-7', severity: 'SEV2' as const, declaredAt: 100, commander: 'Incident lead', affectedServices: ['Identity'],
      tenantScope: { scope: 'platform_wide' } as const, studentVisibleEffect: 'Access unavailable',
      privateStudentDataIncluded: false as const, status: 'contain' as const, nextUpdateAt: Number.NaN, verification: [],
    };
    expect(validateIncident(base, 200)).toContain('future next-update time');
    expect(validateIncident({ ...base, status: 'closed', nextUpdateAt: 300 } as unknown as Parameters<typeof validateIncident>[0], 200)).toContain('known incident status');
  });
});
