import { describe, expect, it } from 'vitest';
import {
  buildRegistrationReadinessProjection,
  viewRegistrationReadiness,
  type RegistrationReadinessInput,
  type ReadinessRequestContext,
} from './readiness.ts';

const NOW = '2026-10-08T18:00:00.000Z';

const input = (over: Partial<RegistrationReadinessInput> = {}): RegistrationReadinessInput => ({
  id: 'readiness-2027-spring',
  tenantId: 'school-a',
  subjectId: 'student-1',
  termId: '2027-spring',
  version: 4,
  asOf: NOW,
  authority: 'institution_verified',
  freshness: 'current',
  sources: [
    { id: 'sis-1', authority: 'institution_verified', label: 'Student information system', observedAt: NOW, version: '88' },
    { id: 'plan-1', authority: 'student_entered', label: 'Semester plan', observedAt: NOW, version: '12' },
  ],
  blockers: [],
  holds: [{ id: 'hold-1', state: 'clear', label: 'Registration holds', sourceRefIds: ['sis-1'] }],
  prerequisites: [{ courseId: 'ECON-3010', state: 'met', sourceRefIds: ['sis-1'] }],
  plannedCourses: [{ courseId: 'ECON-3010', sectionId: 'ECON-3010-01', sourceRefIds: ['plan-1'] }],
  window: { state: 'future', opensAt: '2026-11-10T14:00:00.000Z', sourceRefIds: ['sis-1'] },
  conflicts: 0,
  ...over,
});

const context = (over: Partial<ReadinessRequestContext> = {}): ReadinessRequestContext => ({
  tenantId: 'school-a',
  environment: 'production',
  verifiedBy: 'membership',
  actor: { personId: 'student-1', type: 'user', authenticatedAt: NOW },
  membershipIds: ['school-a:student-1'],
  roleGrants: [{ role: 'student', scopeKind: 'tenant', scopeId: 'school-a' }],
  capabilities: ['registration.readiness.view'],
  purpose: 'service_delivery',
  correlationId: 'corr-0123456789',
  requestId: 'req-0123456789',
  receivedAt: NOW,
  ...over,
});

describe('buildRegistrationReadinessProjection', () => {
  it('derives ready only when every official and planned fact supports it', () => {
    const projection = buildRegistrationReadinessProjection(input());
    expect(projection.status).toBe('ready');
    expect(projection.version).toBe(4);
    expect(projection.sources.map((source) => source.id)).toEqual(['sis-1', 'plan-1']);
  });

  it('lets freshness override an otherwise-ready checklist', () => {
    expect(buildRegistrationReadinessProjection(input({ freshness: 'stale' })).status).toBe('stale');
    expect(buildRegistrationReadinessProjection(input({ freshness: 'reconciling' })).status).toBe('reconciling');
    expect(buildRegistrationReadinessProjection(input({ freshness: 'degraded' })).status).toBe('unknown');
  });

  it('distinguishes a blocker, an unknown fact and human review', () => {
    expect(buildRegistrationReadinessProjection(input({ conflicts: 1 })).status).toBe('blocked');
    expect(buildRegistrationReadinessProjection(input({
      prerequisites: [{ courseId: 'ECON-3010', state: 'unknown', sourceRefIds: ['sis-1'] }],
    })).status).toBe('unknown');
    expect(buildRegistrationReadinessProjection(input({
      prerequisites: [{ courseId: 'ECON-3010', state: 'needs_review', sourceRefIds: ['sis-1'] }],
    })).status).toBe('needs_review');
  });

  it('refuses a fact whose source is not in the projection', () => {
    expect(() => buildRegistrationReadinessProjection(input({
      holds: [{ id: 'hold-1', state: 'clear', label: 'Registration holds', sourceRefIds: ['missing-source'] }],
    }))).toThrow(/unknown source reference missing-source/i);
  });
});

describe('viewRegistrationReadiness', () => {
  it('returns the student view with source, freshness and the audit obligation intact', () => {
    const result = viewRegistrationReadiness(context(), buildRegistrationReadinessProjection(input()));
    expect(result.allow).toBe(true);
    if (!result.allow) return;
    expect(result.projection.tenantId).toBe('school-a');
    expect(result.projection.subjectId).toBe('student-1');
    expect(result.projection.holds).toHaveLength(1);
    expect(result.projection.sources).toHaveLength(2);
    expect(result.obligations).toContainEqual({ type: 'audit', eventType: 'registration.readiness_viewed' });
    expect(result.obligations).toContainEqual({ type: 'cite_sources' });
  });

  it('limits an assigned advisor to the policy field list', () => {
    const advisor = context({
      actor: { personId: 'advisor-1', type: 'user', authenticatedAt: NOW },
      membershipIds: ['school-a:advisor-1'],
      roleGrants: [{ role: 'academic_advisor', scopeKind: 'advisee', scopeId: 'student-1' }],
    });
    const result = viewRegistrationReadiness(advisor, buildRegistrationReadinessProjection(input()));
    expect(result.allow).toBe(true);
    if (!result.allow) return;
    expect(result.projection.holds).toBeUndefined();
    expect(result.projection.prerequisites).toHaveLength(1);
  });

  it('allows the tenant registrar to see holds', () => {
    const registrar = context({
      actor: { personId: 'registrar-1', type: 'user', authenticatedAt: NOW },
      membershipIds: ['school-a:registrar-1'],
      roleGrants: [{ role: 'registrar', scopeKind: 'tenant', scopeId: 'school-a' }],
    });
    const result = viewRegistrationReadiness(registrar, buildRegistrationReadinessProjection(input()));
    expect(result.allow).toBe(true);
    if (result.allow) expect(result.projection.holds).toHaveLength(1);
  });

  it('refuses another tenant and an unrelated staff member without returning the projection', () => {
    const projection = buildRegistrationReadinessProjection(input());
    expect(viewRegistrationReadiness(context({ tenantId: 'school-b' }), projection)).toMatchObject({
      allow: false,
      reasonCode: 'cross_tenant',
    });
    expect(viewRegistrationReadiness(context({
      actor: { personId: 'staff-1', type: 'user', authenticatedAt: NOW },
      membershipIds: ['school-a:staff-1'],
      roleGrants: [{ role: 'staff', scopeKind: 'tenant', scopeId: 'school-a' }],
    }), projection)).toMatchObject({ allow: false, reasonCode: 'relationship_not_permitted' });
  });
});
