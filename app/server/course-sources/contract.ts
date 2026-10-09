/**
 * Course-source authority, before storage or extraction.
 *
 * This module deliberately does not upload a byte. It binds the platform file
 * engine to the two course relationships Semester already has:
 *
 * - a student's opaque `public.courses` row, owned by that exact account; or
 * - an institution course key (`<tenant>/<CODE>` plus term) for which the
 *   server has resolved `course:publish` at exact course scope.
 *
 * A route may call this only after reloading the relationship from current
 * server-controlled records. Client-supplied tenant, owner, role, bucket,
 * object key, scan result or retention policy never becomes authority.
 */

import {
  PlatformError,
  advanceFile,
  planUpload,
  safeFilename,
  type FileRecord,
  type RequestContext,
} from '@semester/platform';

type ResourceClassification = FileRecord['classification'];

export const COURSE_SOURCE_BUCKETS = ['student-files', 'course-materials'] as const;
export type CourseSourceBucket = (typeof COURSE_SOURCE_BUCKETS)[number];

export const COURSE_SOURCE_CONTENT_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;
export type CourseSourceContentType = (typeof COURSE_SOURCE_CONTENT_TYPES)[number];

const SHA256 = /^[0-9a-f]{64}$/;
const TERM = /^[0-9]{4}(FA|SP|SU)$/;

/** Same normalization and grammar as `private.course_code` and `lib/courserules.ts`. */
export function canonicalCourseCode(given: string): string {
  const code = given.trim().replace(/\s+/g, ' ').toUpperCase();
  return /^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/.test(code) ? code : '';
}

export interface StudentCourseProof {
  kind: 'student_owned';
  /** Resolved from the current `public.courses` primary key, not a request body. */
  tenantId: string;
  rowOwnerId: string;
  courseRecordId: string;
  courseCode: string;
  term: string;
  /** The current membership row used to bind this account to this tenant. */
  membershipId: string;
}

export interface PublishedCourseProof {
  kind: 'institution_published';
  tenantId: string;
  courseCode: string;
  term: string;
  authorization: {
    capability: 'course:publish';
    scopeKind: 'course';
    scopeId: string;
  };
  /** A current institution policy is required before shared course material can be retained. */
  retentionPolicy: {
    id: string;
    version: number;
    daysAfterWithdrawal: number;
  };
}

export type CourseRelationshipProof = StudentCourseProof | PublishedCourseProof;

export interface CourseSourceIdentity {
  bucket: CourseSourceBucket;
  tenantId: string;
  courseRecordId?: string;
  courseCode: string;
  term: string;
  ownerId: string;
  classification: ResourceClassification;
  retention: {
    policyId: string;
    policyVersion: number;
    daysAfterDeletion: number;
    legalHoldWins: true;
  };
}

export interface CourseSourceRecord extends FileRecord {
  filename: string;
  bucket: CourseSourceBucket;
  course: CourseSourceIdentity;
  idempotencyKey: string;
  provenance: 'imported';
  scan: {
    status: 'not_started' | 'clean' | 'blocked' | 'failed';
    detectedContentType?: CourseSourceContentType;
    scannerVersion?: string;
  };
}

export interface CourseSourceUploadRequest {
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface CourseSourceUploadPlan {
  record: CourseSourceRecord;
  constraints: { contentType: string; maxBytes: number; ttlSeconds: number };
  audit: CourseSourceAuditFact;
}

export interface CourseSourceAuditFact {
  action: 'upload_planned' | 'scan_settled' | 'correction_confirmed';
  tenantId: string;
  actorId: string;
  sourceId: string;
  courseCode: string;
  term: string;
  correlationId: string;
  /** Audit metadata never contains a filename, source excerpt, prompt or extracted text. */
  outcome: 'pending' | 'available' | 'rejected' | 'confirmed';
}

function validBoundedId(value: string, max = 200): boolean {
  return value.length > 0 && value.length <= max && ![...value].some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return point < 32 || point === 127;
  });
}

function identityFor(ctx: RequestContext, proof: CourseRelationshipProof): CourseSourceIdentity {
  if (proof.tenantId !== ctx.tenantId) {
    throw new PlatformError('tenant_mismatch', 'That course belongs to a different school.');
  }
  const courseCode = canonicalCourseCode(proof.courseCode);
  if (!courseCode || !TERM.test(proof.term)) {
    throw new PlatformError('validation_failed', 'The course needs a valid code and term.');
  }

  if (proof.kind === 'student_owned') {
    if (proof.rowOwnerId !== ctx.actor.personId || !ctx.membershipIds.includes(proof.membershipId)) {
      throw new PlatformError('forbidden', 'You do not have access to that course.');
    }
    if (proof.membershipId !== `${ctx.tenantId}:${ctx.actor.personId}` || !validBoundedId(proof.courseRecordId)) {
      throw new PlatformError('forbidden', 'The course relationship could not be verified.');
    }
    return {
      bucket: 'student-files',
      tenantId: ctx.tenantId,
      courseRecordId: proof.courseRecordId,
      courseCode,
      term: proof.term,
      ownerId: ctx.actor.personId,
      classification: 'student_private',
      retention: {
        policyId: 'student-file-trash',
        policyVersion: 1,
        daysAfterDeletion: 30,
        legalHoldWins: true,
      },
    };
  }

  const expectedScope = `${ctx.tenantId}/${courseCode}`;
  if (
    proof.authorization.capability !== 'course:publish' ||
    proof.authorization.scopeKind !== 'course' ||
    proof.authorization.scopeId !== expectedScope
  ) {
    throw new PlatformError('forbidden', 'You do not publish material for that course.');
  }
  const policy = proof.retentionPolicy;
  if (
    !validBoundedId(policy.id, 120) ||
    !Number.isInteger(policy.version) || policy.version < 1 ||
    !Number.isInteger(policy.daysAfterWithdrawal) || policy.daysAfterWithdrawal < 0 || policy.daysAfterWithdrawal > 3650
  ) {
    throw new PlatformError('precondition_failed', 'A current course-material retention policy is required.');
  }
  return {
    bucket: 'course-materials',
    tenantId: ctx.tenantId,
    courseCode,
    term: proof.term,
    ownerId: ctx.actor.personId,
    classification: 'internal',
    retention: {
      policyId: policy.id,
      policyVersion: policy.version,
      daysAfterDeletion: policy.daysAfterWithdrawal,
      legalHoldWins: true,
    },
  };
}

/**
 * Plan one document upload. Archives stay unsupported until a bounded,
 * sandboxed expander validates every child; local ZIP intake is not evidence
 * that a server may safely accept one.
 */
export function planCourseSourceUpload(
  ctx: RequestContext,
  proof: CourseRelationshipProof,
  request: CourseSourceUploadRequest,
  sourceId: string,
  at: Date,
  rateLimitAllowed: boolean,
): CourseSourceUploadPlan {
  if (!ctx.idempotencyKey) {
    throw new PlatformError('invalid_request', 'An idempotency key is required for a course-source upload.');
  }
  if (!rateLimitAllowed) {
    throw new PlatformError('rate_limited', 'Too many course-source uploads. Try again shortly.', { retryAfterSeconds: 60 });
  }
  if (!(COURSE_SOURCE_CONTENT_TYPES as readonly string[]).includes(request.contentType)) {
    throw new PlatformError('unsupported_media_type', 'Upload a PDF, Word document, slide deck or plain-text file.');
  }
  const course = identityFor(ctx, proof);
  const planned = planUpload(ctx, {
    filename: request.filename,
    contentType: request.contentType,
    sizeBytes: request.sizeBytes,
    classification: course.classification,
  }, sourceId, at);
  const record: CourseSourceRecord = {
    ...planned.record,
    filename: safeFilename(request.filename),
    bucket: course.bucket,
    course,
    idempotencyKey: ctx.idempotencyKey,
    provenance: 'imported',
    scan: { status: 'not_started' },
  };
  return {
    record,
    constraints: planned.constraints,
    audit: {
      action: 'upload_planned', tenantId: ctx.tenantId, actorId: ctx.actor.personId,
      sourceId, courseCode: course.courseCode, term: course.term, correlationId: ctx.correlationId, outcome: 'pending',
    },
  };
}

function assertSourceService(ctx: RequestContext, record: CourseSourceRecord): void {
  if (record.tenantId !== ctx.tenantId) throw new PlatformError('not_found', 'We could not find that source.');
  if (ctx.actor.type !== 'service') throw new PlatformError('forbidden', 'Only the course-source service may settle stored bytes.');
}

/** The tenant-bound storage service moves bytes into quarantine; it never makes them readable. */
export function quarantineCourseSource(ctx: RequestContext, record: CourseSourceRecord): CourseSourceRecord {
  assertSourceService(ctx, record);
  return { ...record, ...advanceFile(record, 'quarantined') };
}

export interface CourseSourceScanResult {
  detectedContentType: string;
  sha256: string;
  scannerVersion: string;
  verdict: 'clean' | 'blocked' | 'error';
}

/** A scanner/type failure settles as rejected, never as a readable partial success. */
export function settleCourseSourceScan(
  ctx: RequestContext,
  record: CourseSourceRecord,
  result: CourseSourceScanResult,
): { record: CourseSourceRecord; audit: CourseSourceAuditFact } {
  assertSourceService(ctx, record);
  if (record.state !== 'quarantined') throw new PlatformError('precondition_failed', 'That source is not awaiting a scan.');
  const detectedAllowed = (COURSE_SOURCE_CONTENT_TYPES as readonly string[]).includes(result.detectedContentType);
  const clean = result.verdict === 'clean' && detectedAllowed && result.detectedContentType === record.contentType && SHA256.test(result.sha256) && validBoundedId(result.scannerVersion, 120);
  const next = advanceFile(record, clean ? 'available' : 'rejected');
  const settled: CourseSourceRecord = {
    ...record,
    ...next,
    ...(SHA256.test(result.sha256) ? { sha256: result.sha256 } : {}),
    scan: clean
      ? { status: 'clean', detectedContentType: result.detectedContentType as CourseSourceContentType, scannerVersion: result.scannerVersion }
      : { status: result.verdict === 'blocked' ? 'blocked' : 'failed' },
  };
  return {
    record: settled,
    audit: {
      action: 'scan_settled', tenantId: ctx.tenantId, actorId: ctx.actor.personId,
      sourceId: record.id, courseCode: record.course.courseCode, term: record.course.term,
      correlationId: ctx.correlationId, outcome: clean ? 'available' : 'rejected',
    },
  };
}

export interface ConfirmedSourceCorrection {
  id: string;
  sourceId: string;
  sourceSha256: string;
  derivedRecordId: string;
  field: string;
  priorValueSha256: string;
  correctedValueSha256: string;
  confirmedBy: string;
  confirmedAt: string;
}

/**
 * Record correction lineage without copying the corrected value into audit.
 * Consumers propagate the new derived revision; the immutable source stays as
 * the evidence of what was originally read.
 */
export function confirmSourceCorrection(
  ctx: RequestContext,
  record: CourseSourceRecord,
  input: Omit<ConfirmedSourceCorrection, 'sourceId' | 'sourceSha256' | 'confirmedBy' | 'confirmedAt'>,
  at: Date,
): { correction: ConfirmedSourceCorrection; audit: CourseSourceAuditFact } {
  if (record.tenantId !== ctx.tenantId || record.ownerId !== ctx.actor.personId) {
    throw new PlatformError('not_found', 'We could not find that source.');
  }
  if (record.state !== 'available' || !record.sha256) {
    throw new PlatformError('precondition_failed', 'Only a ready source can support a correction.');
  }
  if (
    !validBoundedId(input.id) || !validBoundedId(input.derivedRecordId) || !validBoundedId(input.field, 80) ||
    !SHA256.test(input.priorValueSha256) || !SHA256.test(input.correctedValueSha256) ||
    input.priorValueSha256 === input.correctedValueSha256
  ) {
    throw new PlatformError('validation_failed', 'That correction is incomplete.');
  }
  return {
    correction: {
      ...input,
      sourceId: record.id,
      sourceSha256: record.sha256,
      confirmedBy: ctx.actor.personId,
      confirmedAt: at.toISOString(),
    },
    audit: {
      action: 'correction_confirmed', tenantId: ctx.tenantId, actorId: ctx.actor.personId,
      sourceId: record.id, courseCode: record.course.courseCode, term: record.course.term,
      correlationId: ctx.correlationId, outcome: 'confirmed',
    },
  };
}
