import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRequestContext, PlatformError, type IdSource } from '../../../packages/platform/src/index.ts';
import {
  canonicalCourseCode,
  confirmSourceCorrection,
  planCourseSourceUpload,
  quarantineCourseSource,
  settleCourseSourceScan,
  type CourseRelationshipProof,
} from './contract.ts';

const TENANT = 'vanderbilt';
const ACTOR = 'student-1';
const HASH = 'a'.repeat(64);
const PRIOR = 'b'.repeat(64);
const CORRECTED = 'c'.repeat(64);
const clock = { now: () => new Date('2026-10-08T18:00:00.000Z') };
const ids: IdSource = { next: () => 'server-correlation' };

function context(over: { tenantId?: string; actorId?: string; actorType?: 'user' | 'service'; idempotencyKey?: string } = {}) {
  const tenantId = over.tenantId ?? TENANT;
  const actorId = over.actorId ?? ACTOR;
  return buildRequestContext(
    { headers: { 'idempotency-key': over.idempotencyKey ?? 'upload-attempt-1' } },
    {
      actor: { personId: actorId, type: over.actorType ?? 'user', authenticatedAt: clock.now().toISOString() },
      tenant: { id: tenantId, status: 'active', environment: 'production', verifiedBy: 'membership' },
      membershipIds: [`${tenantId}:${actorId}`],
      roleGrants: [],
    },
    { clock, ids, requestId: 'server-request' },
  );
}

const studentProof = (over: Partial<Extract<CourseRelationshipProof, { kind: 'student_owned' }>> = {}): Extract<CourseRelationshipProof, { kind: 'student_owned' }> => ({
  kind: 'student_owned', tenantId: TENANT, rowOwnerId: ACTOR, courseRecordId: 'econ1020',
  courseCode: 'econ  1020', term: '2026FA', membershipId: `${TENANT}:${ACTOR}`, ...over,
});

const publishedProof = (over: Partial<Extract<CourseRelationshipProof, { kind: 'institution_published' }>> = {}): Extract<CourseRelationshipProof, { kind: 'institution_published' }> => ({
  kind: 'institution_published', tenantId: TENANT, courseCode: 'ECON 1020', term: '2026FA',
  authorization: { capability: 'course:publish', scopeKind: 'course', scopeId: `${TENANT}/ECON 1020` },
  retentionPolicy: { id: 'course-material-policy', version: 2, daysAfterWithdrawal: 90 }, ...over,
});

const request = { filename: '../../Syllabus.pdf', contentType: 'application/pdf', sizeBytes: 2048 };

function plan(proof: CourseRelationshipProof = studentProof()) {
  return planCourseSourceUpload(context(), proof, request, 'source-1', clock.now(), true);
}

const serviceContext = (tenantId = TENANT) => context({ tenantId, actorId: 'course-source-service', actorType: 'service' });

function code(fn: () => unknown): string | undefined {
  try { fn(); } catch (error) { return error instanceof PlatformError ? error.code : undefined; }
  return undefined;
}

describe('course-source authority contract', () => {
  it('uses the same canonical course grammar as Course Studio', () => {
    expect(canonicalCourseCode(' econ   1020 ')).toBe('ECON 1020');
    expect(canonicalCourseCode('CS 1301L')).toBe('CS 1301L');
    for (const bad of ['', 'ECON1020', 'ECON 10', 'ECON 1020 section 1']) expect(canonicalCourseCode(bad)).toBe('');
    const sql = readFileSync('../supabase/migrations/20260928309000_course_studio.sql', 'utf8');
    const client = readFileSync('src/lib/courserules.ts', 'utf8');
    expect(sql).toContain(`c ~ '${/^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/.source}'`);
    expect(client).toContain(`/^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/`);
  });

  it('binds a student source to the exact current owner, membership, tenant and opaque course row', () => {
    const got = plan();
    expect(got.record.bucket).toBe('student-files');
    expect(got.record.course).toMatchObject({ tenantId: TENANT, ownerId: ACTOR, courseRecordId: 'econ1020', courseCode: 'ECON 1020', classification: 'student_private' });
    expect(got.record.key).toMatch(/^t\/vanderbilt\/student_private\/2026-10\/source-1$/);
    expect(got.record.filename).toBe('Syllabus.pdf');
    expect(got.record.state).toBe('pending_upload');
    expect(got.record.course.retention).toEqual({ policyId: 'student-file-trash', policyVersion: 1, daysAfterDeletion: 30, legalHoldWins: true });

    expect(code(() => plan(studentProof({ tenantId: 'other' })))).toBe('tenant_mismatch');
    expect(code(() => plan(studentProof({ rowOwnerId: 'student-2' })))).toBe('forbidden');
    expect(code(() => plan(studentProof({ membershipId: `${TENANT}:student-2` })))).toBe('forbidden');
    expect(code(() => plan(studentProof({ courseRecordId: '' })))).toBe('forbidden');
  });

  it('binds published material to exact course capability scope and a current retention policy', () => {
    const got = plan(publishedProof());
    expect(got.record.bucket).toBe('course-materials');
    expect(got.record.course).toMatchObject({ courseCode: 'ECON 1020', term: '2026FA', classification: 'internal' });
    expect(got.record.course.retention).toEqual({ policyId: 'course-material-policy', policyVersion: 2, daysAfterDeletion: 90, legalHoldWins: true });

    expect(code(() => plan(publishedProof({ authorization: { capability: 'course:publish', scopeKind: 'course', scopeId: `${TENANT}/PSCI 1100` } })))).toBe('forbidden');
    expect(code(() => plan(publishedProof({ retentionPolicy: { id: '', version: 0, daysAfterWithdrawal: -1 } })))).toBe('precondition_failed');
    expect(code(() => plan(publishedProof({ term: 'fall-2026' })))).toBe('validation_failed');
  });

  it('requires idempotency and the caller-owned rate limiter before planning storage', () => {
    // buildRequestContext omits an absent header; create an otherwise legitimate context without one.
    const ctx = { ...context(), idempotencyKey: undefined };
    expect(code(() => planCourseSourceUpload(ctx, studentProof(), request, 'source-1', clock.now(), true))).toBe('invalid_request');
    expect(code(() => planCourseSourceUpload(context(), studentProof(), request, 'source-1', clock.now(), false))).toBe('rate_limited');
  });

  it('accepts only bounded course documents and leaves archives out of the server contract', () => {
    for (const contentType of [
      'application/pdf', 'text/plain', 'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ]) expect(() => planCourseSourceUpload(context(), studentProof(), { ...request, contentType }, 'source-1', clock.now(), true)).not.toThrow();
    for (const contentType of ['application/zip', 'text/html', 'image/svg+xml', 'application/x-msdownload']) {
      expect(code(() => planCourseSourceUpload(context(), studentProof(), { ...request, contentType }, 'source-1', clock.now(), true))).toBe('unsupported_media_type');
    }
    expect(() => planCourseSourceUpload(context(), studentProof(), { ...request, sizeBytes: 50 * 1024 * 1024 + 1 }, 'source-1', clock.now(), true)).toThrow(/too large/);
  });

  it('keeps an uploaded source quarantined until clean bytes, type and SHA-256 agree', () => {
    const quarantined = quarantineCourseSource(serviceContext(), plan().record);
    expect(quarantined.state).toBe('quarantined');
    const clean = settleCourseSourceScan(serviceContext(), quarantined, { detectedContentType: 'application/pdf', sha256: HASH, scannerVersion: 'scanner-1', verdict: 'clean' });
    expect(clean.record).toMatchObject({ state: 'available', sha256: HASH, scan: { status: 'clean', detectedContentType: 'application/pdf' } });
    expect(clean.audit.outcome).toBe('available');

    for (const result of [
      { detectedContentType: 'text/plain', sha256: HASH, scannerVersion: 'scanner-1', verdict: 'clean' as const },
      { detectedContentType: 'application/pdf', sha256: 'not-a-hash', scannerVersion: 'scanner-1', verdict: 'clean' as const },
      { detectedContentType: 'application/pdf', sha256: HASH, scannerVersion: 'scanner-1', verdict: 'blocked' as const },
      { detectedContentType: 'application/pdf', sha256: HASH, scannerVersion: 'scanner-1', verdict: 'error' as const },
    ]) expect(settleCourseSourceScan(serviceContext(), quarantined, result).record.state).toBe('rejected');
  });

  it('allows only the tenant-bound source service to quarantine and settle a scan', () => {
    const pending = plan().record;
    expect(code(() => quarantineCourseSource(context(), pending))).toBe('forbidden');
    expect(code(() => quarantineCourseSource(serviceContext('other'), pending))).toBe('not_found');
    const quarantined = quarantineCourseSource(serviceContext(), pending);
    const result = { detectedContentType: 'application/pdf', sha256: HASH, scannerVersion: 'scanner-1', verdict: 'clean' as const };
    expect(code(() => settleCourseSourceScan(context(), quarantined, result))).toBe('forbidden');
    expect(code(() => settleCourseSourceScan(serviceContext('other'), quarantined, result))).toBe('not_found');
    const available = settleCourseSourceScan(serviceContext(), quarantined, result).record;
    expect(code(() => settleCourseSourceScan(serviceContext(), available, result))).toBe('precondition_failed');
  });

  it('records confirmed corrections as hash-linked revisions without source text in audit', () => {
    const quarantined = quarantineCourseSource(serviceContext(), plan().record);
    const available = settleCourseSourceScan(serviceContext(), quarantined, { detectedContentType: 'application/pdf', sha256: HASH, scannerVersion: 'scanner-1', verdict: 'clean' }).record;
    const got = confirmSourceCorrection(context(), available, {
      id: 'correction-1', derivedRecordId: 'deadline-1', field: 'due_at',
      priorValueSha256: PRIOR, correctedValueSha256: CORRECTED,
    }, new Date('2026-10-08T19:00:00.000Z'));
    expect(got.correction).toMatchObject({ sourceId: 'source-1', sourceSha256: HASH, confirmedBy: ACTOR, field: 'due_at' });
    expect(got.audit).toEqual({
      action: 'correction_confirmed', tenantId: TENANT, actorId: ACTOR,
      sourceId: 'source-1', courseCode: 'ECON 1020', term: '2026FA',
      correlationId: 'server-correlation', outcome: 'confirmed',
    });
    expect(JSON.stringify(got.audit)).not.toContain('deadline-1');
    expect(JSON.stringify(got.audit)).not.toContain(PRIOR);

    expect(code(() => confirmSourceCorrection(context({ actorId: 'student-2' }), available, {
      id: 'correction-2', derivedRecordId: 'deadline-1', field: 'due_at', priorValueSha256: PRIOR, correctedValueSha256: CORRECTED,
    }, clock.now()))).toBe('not_found');
    expect(code(() => confirmSourceCorrection(context(), { ...available, state: 'quarantined' }, {
      id: 'correction-2', derivedRecordId: 'deadline-1', field: 'due_at', priorValueSha256: PRIOR, correctedValueSha256: CORRECTED,
    }, clock.now()))).toBe('precondition_failed');
    expect(code(() => confirmSourceCorrection(context(), available, {
      id: 'correction-2', derivedRecordId: 'deadline-1', field: 'due_at', priorValueSha256: PRIOR, correctedValueSha256: PRIOR,
    }, clock.now()))).toBe('validation_failed');
  });

  it('keeps audit facts content-free', () => {
    const got = plan();
    expect(got.audit).toEqual({
      action: 'upload_planned', tenantId: TENANT, actorId: ACTOR,
      sourceId: 'source-1', courseCode: 'ECON 1020', term: '2026FA',
      correlationId: 'server-correlation', outcome: 'pending',
    });
    const serialized = JSON.stringify(got.audit);
    expect(serialized).not.toContain('Syllabus.pdf');
    expect(serialized).not.toContain('filename');
    expect(serialized).not.toContain('text');
  });
});
