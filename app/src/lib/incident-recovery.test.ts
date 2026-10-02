import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_MAY,
  AUTOMATION_MUST_NOT,
  FAILOVER_RULES,
  INCIDENT_LIFECYCLE,
  RECOVERY_OBJECTIVES,
  validateIncident,
} from './incident-recovery';

const DETECTION = { signal: 'monitor alert', firstObservedAt: 90, correlationIds: ['trace-1'] };

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
      id: 'INC-1', severity: 'SEV1', declaredAt: 100, detection: DETECTION, commander: '', affectedServices: ['Identity'], tenantScope: { scope: 'platform_wide' },
      studentVisibleEffect: 'Sign-in unavailable', privateStudentDataIncluded: false, status: 'close', nextUpdateAt: 100, verification: [],
    }, 150)).toEqual(['named incident commander', 'recovery verification', 'complete close-out evidence']);
    expect(validateIncident({
      id: 'INC-2', severity: 'SEV2', declaredAt: 100, detection: DETECTION, commander: 'Incident lead', affectedServices: ['LTI'], tenantScope: { scope: 'tenant_specific', tenantIds: ['vanderbilt'] },
      studentVisibleEffect: 'Course launch unavailable', privateStudentDataIncluded: false, status: 'close', nextUpdateAt: 200, verification: ['Valid launch succeeds; invalid token is rejected'],
      closeOut: { measuredTimeline: '10:00–10:30 UTC', impact: 'Launch unavailable', recoveryPoint: 'No data loss', stabilizedAt: 150, communications: ['Status update sent'], correctiveActions: [{ action: 'Add regression', owner: 'Integrations', severity: 'SEV2', dueAt: 300, requiredEvidence: 'Passing launch test', verificationEvidence: 'CI run 3546 passed' }], postIncidentReview: { completedAt: 160, evidence: 'Review PIR-2 approved' } },
    }, 200)).toEqual([]);
  });

  it('rejects overdue updates for active incidents and blank verification evidence', () => {
    expect(validateIncident({
      id: 'INC-3', severity: 'SEV3', declaredAt: 100, detection: DETECTION, commander: 'Incident lead', affectedServices: ['Sources'], tenantScope: { scope: 'tenant_specific', tenantIds: ['vanderbilt'] },
      studentVisibleEffect: 'Source stale', privateStudentDataIncluded: false, status: 'recover', nextUpdateAt: 200, verification: [],
    }, 201)).toContain('future next-update time');
    expect(validateIncident({
      id: 'INC-4', severity: 'SEV2', declaredAt: 100, detection: DETECTION, commander: 'Incident lead', affectedServices: ['LTI'], tenantScope: { scope: 'suspected_cross_tenant', tenantIds: ['vanderbilt'] },
      studentVisibleEffect: 'Course launch unavailable', privateStudentDataIncluded: false, status: 'verify', nextUpdateAt: 300, verification: ['   '],
    }, 201)).toContain('recovery verification');
  });

  it('requires tenant scope and rejects private student data at runtime', () => {
    const record = {
      id: 'INC-5', severity: 'SEV1', declaredAt: 100, detection: DETECTION, commander: 'Incident lead', affectedServices: ['Identity'],
      tenantScope: { scope: 'tenant_specific', tenantIds: [] }, studentVisibleEffect: 'Access unavailable',
      privateStudentDataIncluded: true, status: 'contain', nextUpdateAt: 300, verification: [],
    } as unknown as Parameters<typeof validateIncident>[0];
    expect(validateIncident(record, 200)).toEqual(expect.arrayContaining(['tenant scope', 'private student data excluded']));
  });

  it('rejects blank-only affected service entries', () => {
    expect(validateIncident({
      id: 'INC-6', severity: 'SEV2', declaredAt: 100, detection: DETECTION, commander: 'Incident lead', affectedServices: ['   '],
      tenantScope: { scope: 'platform_wide' }, studentVisibleEffect: 'Service unavailable',
      privateStudentDataIncluded: false, status: 'contain', nextUpdateAt: 300, verification: [],
    }, 200)).toContain('affected service');
  });

  it('rejects non-finite update times and unknown lifecycle statuses at runtime', () => {
    const base = {
      id: 'INC-7', severity: 'SEV2' as const, declaredAt: 100, detection: DETECTION, commander: 'Incident lead', affectedServices: ['Identity'],
      tenantScope: { scope: 'platform_wide' } as const, studentVisibleEffect: 'Access unavailable',
      privateStudentDataIncluded: false as const, status: 'contain' as const, nextUpdateAt: Number.NaN, verification: [],
    };
    expect(validateIncident(base, 200)).toContain('future next-update time');
    expect(validateIncident({ ...base, status: 'closed', nextUpdateAt: 300 } as unknown as Parameters<typeof validateIncident>[0], 200)).toContain('known incident status');
  });

  it('rejects unknown severities and tenant-scope discriminants at runtime', () => {
    const base = {
      id: 'INC-8', severity: 'P1', declaredAt: 100, detection: DETECTION, commander: 'Incident lead', affectedServices: ['Identity'],
      tenantScope: { scope: 'other', tenantIds: ['tenant-a'] }, studentVisibleEffect: 'Access unavailable',
      privateStudentDataIncluded: false, status: 'contain', nextUpdateAt: 300, verification: [],
    } as unknown as Parameters<typeof validateIncident>[0];
    expect(validateIncident(base, 200)).toEqual(expect.arrayContaining(['known incident severity', 'tenant scope']));
  });

  it('keeps suspected cross-tenant incidents at SEV1 until disproven', () => {
    const record = {
      id: 'INC-9', severity: 'SEV2', declaredAt: 100, detection: DETECTION, commander: 'Incident lead', affectedServices: ['Identity'],
      tenantScope: { scope: 'suspected_cross_tenant', tenantIds: ['tenant-a'] }, studentVisibleEffect: 'Isolation under review',
      privateStudentDataIncluded: false, status: 'contain', nextUpdateAt: 300, verification: [],
    } as unknown as Parameters<typeof validateIncident>[0];
    expect(validateIncident(record, 200)).toContain('SEV1 for suspected cross-tenant scope');
  });

  it('returns gaps for invalid declaration times and partial close-out payloads', () => {
    const record = {
      id: 'INC-10', severity: 'SEV1', declaredAt: Number.NaN, detection: DETECTION, commander: 'Incident lead', affectedServices: ['Identity'],
      tenantScope: { scope: 'platform_wide' }, studentVisibleEffect: 'Access unavailable', privateStudentDataIncluded: false,
      status: 'close', nextUpdateAt: 300, verification: ['Tenant checks pass'], closeOut: { measuredTimeline: '10:00 UTC' },
    } as unknown as Parameters<typeof validateIncident>[0];
    expect(validateIncident(record, 200)).toEqual(expect.arrayContaining(['finite declaration time', 'complete close-out evidence']));
  });

  it('requires every recorded corrective action to be complete', () => {
    const record = {
      id: 'INC-11', severity: 'SEV1', declaredAt: 100, detection: DETECTION, commander: 'Incident lead', affectedServices: ['Identity'],
      tenantScope: { scope: 'platform_wide' }, studentVisibleEffect: 'Access unavailable', privateStudentDataIncluded: false,
      status: 'close', nextUpdateAt: 300, verification: ['Tenant checks pass'],
      closeOut: {
        measuredTimeline: '10:00–10:30 UTC', impact: 'Sign-in unavailable', recoveryPoint: 'No data loss', stabilizedAt: 150, communications: ['Status update'],
        correctiveActions: [
          { action: 'Add regression', owner: 'Identity', severity: 'SEV1', dueAt: 300, requiredEvidence: 'Passing test', verificationEvidence: ' ' },
          { action: ' ', owner: '', severity: 'unknown', dueAt: Number.NaN, requiredEvidence: '', verificationEvidence: '' },
        ], postIncidentReview: { completedAt: 160, evidence: 'Review PIR-11 approved' },
      },
    } as unknown as Parameters<typeof validateIncident>[0];
    expect(validateIncident(record, 200)).toContain('complete close-out evidence');
  });

  it('rejects corrective-action deadlines before the incident declaration', () => {
    const record = {
      id: 'INC-11B', severity: 'SEV3', declaredAt: 100, detection: DETECTION, commander: 'Incident lead', affectedServices: ['Sources'],
      tenantScope: { scope: 'platform_wide' }, studentVisibleEffect: 'Sources stale', privateStudentDataIncluded: false,
      status: 'close', nextUpdateAt: 300, verification: ['Freshness checks pass'],
      closeOut: {
        measuredTimeline: 'timeline', impact: 'stale source', recoveryPoint: 'refreshed', stabilizedAt: 150, communications: ['update'],
        correctiveActions: [{ action: 'add check', owner: 'Sources', severity: 'SEV3', dueAt: 50, requiredEvidence: 'test', verificationEvidence: 'CI passed' }],
      },
    } as Parameters<typeof validateIncident>[0];
    expect(validateIncident(record, 200)).toContain('complete close-out evidence');
  });

  it('rejects future declarations and incomplete detection evidence', () => {
    const record = {
      id: 'INC-12', severity: 'SEV2', declaredAt: 500,
      detection: { signal: ' ', firstObservedAt: 500, correlationIds: [] },
      commander: 'Incident lead', affectedServices: ['Identity'], tenantScope: { scope: 'platform_wide' },
      studentVisibleEffect: 'Access unavailable', privateStudentDataIncluded: false,
      status: 'contain', nextUpdateAt: 300, verification: [],
    } as unknown as Parameters<typeof validateIncident>[0];
    expect(validateIncident(record, 200)).toEqual(expect.arrayContaining([
      'declaration time not in future', 'detection evidence', 'future next-update time',
    ]));
  });

  it('rejects a first observation recorded after declaration', () => {
    const record = {
      id: 'INC-13', severity: 'SEV2', declaredAt: 100,
      detection: { signal: 'monitor alert', firstObservedAt: 150, correlationIds: ['trace-13'] },
      commander: 'Incident lead', affectedServices: ['Identity'], tenantScope: { scope: 'platform_wide' },
      studentVisibleEffect: 'Access unavailable', privateStudentDataIncluded: false,
      status: 'contain', nextUpdateAt: 300, verification: [],
    } as Parameters<typeof validateIncident>[0];
    expect(validateIncident(record, 200)).toContain('detection evidence');
  });

  it('requires timely written review evidence before closing a SEV1 or SEV2 incident', () => {
    const record = {
      id: 'INC-14', severity: 'SEV2', declaredAt: 100, detection: DETECTION,
      commander: 'Incident lead', affectedServices: ['Identity'], tenantScope: { scope: 'platform_wide' },
      studentVisibleEffect: 'Access unavailable', privateStudentDataIncluded: false,
      status: 'close', nextUpdateAt: 300, verification: ['Access checks pass'],
      closeOut: {
        measuredTimeline: '10:00–10:30 UTC', impact: 'Access unavailable', recoveryPoint: 'No data loss', stabilizedAt: 150,
        communications: ['Status update'], correctiveActions: [{ action: 'Add regression', owner: 'Identity', severity: 'SEV2', dueAt: 300, requiredEvidence: 'Passing test', verificationEvidence: 'CI run passed' }],
      },
    } as Parameters<typeof validateIncident>[0];
    expect(validateIncident(record, 200)).toContain('complete close-out evidence');
  });

  it('rejects stabilization or review times outside the incident timeline', () => {
    const record = {
      id: 'INC-15', severity: 'SEV3', declaredAt: 100, detection: DETECTION,
      commander: 'Incident lead', affectedServices: ['Sources'], tenantScope: { scope: 'platform_wide' },
      studentVisibleEffect: 'Sources stale', privateStudentDataIncluded: false,
      status: 'close', nextUpdateAt: 300, verification: ['Freshness checks pass'],
      closeOut: { measuredTimeline: 'timeline', impact: 'stale source', recoveryPoint: 'refreshed', stabilizedAt: 500, communications: ['update'], correctiveActions: [{ action: 'add check', owner: 'Sources', severity: 'SEV3', dueAt: 600, requiredEvidence: 'test', verificationEvidence: 'CI passed' }] },
    } as Parameters<typeof validateIncident>[0];
    expect(validateIncident(record, 200)).toContain('complete close-out evidence');
  });

  it('rejects finite timestamps outside the JavaScript date range without hanging', () => {
    const record = {
      id: 'INC-16', severity: 'SEV1', declaredAt: 100, detection: DETECTION,
      commander: 'Incident lead', affectedServices: ['Identity'], tenantScope: { scope: 'platform_wide' },
      studentVisibleEffect: 'Access unavailable', privateStudentDataIncluded: false,
      status: 'close', nextUpdateAt: 300, verification: ['Access checks pass'],
      closeOut: {
        measuredTimeline: 'timeline', impact: 'access unavailable', recoveryPoint: 'no data loss',
        stabilizedAt: -Number.MAX_VALUE, communications: ['update'],
        correctiveActions: [{ action: 'add check', owner: 'Identity', severity: 'SEV1', dueAt: 600, requiredEvidence: 'test', verificationEvidence: 'CI passed' }],
        postIncidentReview: { completedAt: 160, evidence: 'PIR complete' },
      },
    } as Parameters<typeof validateIncident>[0];
    expect(validateIncident(record, 200)).toContain('complete close-out evidence');
  });

  it('rejects non-representable declaration, observation, update, and action dates', () => {
    const impossible = -Number.MAX_VALUE;
    const record = {
      id: 'INC-17', severity: 'SEV3', declaredAt: impossible,
      detection: { signal: 'monitor alert', firstObservedAt: impossible, correlationIds: ['trace-17'] },
      commander: 'Incident lead', affectedServices: ['Sources'], tenantScope: { scope: 'platform_wide' },
      studentVisibleEffect: 'Sources stale', privateStudentDataIncluded: false,
      status: 'close', nextUpdateAt: 300, verification: ['Freshness checks pass'],
      closeOut: {
        measuredTimeline: 'timeline', impact: 'stale source', recoveryPoint: 'refreshed', stabilizedAt: 150,
        communications: ['update'], correctiveActions: [{
          action: 'add check', owner: 'Sources', severity: 'SEV3', dueAt: impossible,
          requiredEvidence: 'test', verificationEvidence: 'CI passed',
        }],
      },
    } as Parameters<typeof validateIncident>[0];
    expect(validateIncident(record, 200)).toEqual(expect.arrayContaining([
      'finite declaration time', 'detection evidence', 'complete close-out evidence',
    ]));
    expect(validateIncident({ ...record, status: 'contain', nextUpdateAt: impossible }, 200)).toContain('future next-update time');
  });
});
