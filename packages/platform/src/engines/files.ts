/**
 * The file service: tenant-prefixed keys, classified content, short-lived
 * signed URLs, and a lifecycle that never serves an unscanned byte.
 *
 * Object storage is where tenant isolation is most often *assumed*: a bucket
 * "per environment", a key that is a UUID and therefore "unguessable". Neither
 * is a control. Here the key is `t/<tenantId>/<classification>/<yyyy-mm>/<fileId>`
 * and every operation parses it and checks the prefix against the request's
 * tenant *before* anything touches the store — so a key from another tenant is
 * refused by construction, whatever the bucket policy says (which is a second
 * line, not the first).
 *
 * Lifecycle: `pending_upload → quarantined → available | rejected → deleted`.
 * A file is served only from `available`. `quarantined` means uploaded but not
 * yet scanned and type-verified; `rejected` is a scan or sniff failure. A
 * legal hold blocks deletion at any state, and a retention class says when a
 * deletion may happen at all (see RETENTION.md).
 */

import type { ResourceClassification } from '../seam/institution.ts';
import { PlatformError } from '../gateway/errors.ts';
import type { RequestContext } from '../tenancy/context.ts';
import { isId } from '../tenancy/organization.ts';

export const FILE_STATES = ['pending_upload', 'quarantined', 'available', 'rejected', 'deleted'] as const;
export type FileState = (typeof FILE_STATES)[number];

export interface FileRecord {
  id: string;
  tenantId: string;
  ownerId: string;
  classification: ResourceClassification;
  state: FileState;
  contentType: string;
  sizeBytes: number;
  sha256?: string;
  key: string;
  legalHold: boolean;
  createdAt: string;
}

/** Extensions are not types. These are the content types accepted at all; anything else is refused at upload planning. */
export const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/mpeg',
  'audio/mp4',
  'video/mp4',
] as const;

/** Per-classification caps on one object, in bytes. */
export const MAX_BYTES: Record<ResourceClassification, number> = {
  public: 100 * 1024 * 1024,
  internal: 100 * 1024 * 1024,
  student_private: 50 * 1024 * 1024,
  education_record: 25 * 1024 * 1024,
};

/** Signed URL lifetimes, in seconds. Records are shortest: a URL is a bearer credential. */
export const MAX_URL_TTL_S: Record<ResourceClassification, number> = {
  public: 3600,
  internal: 900,
  student_private: 300,
  education_record: 120,
};

const KEY = /^t\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})\/(public|internal|student_private|education_record)\/(\d{4}-\d{2})\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})$/;

export function objectKey(tenantId: string, classification: ResourceClassification, fileId: string, at: Date): string {
  if (!isId(tenantId) || !isId(fileId)) throw new PlatformError('invalid_request', 'Invalid file id.');
  return `t/${tenantId}/${classification}/${at.toISOString().slice(0, 7)}/${fileId}`;
}

export interface ParsedKey {
  tenantId: string;
  classification: ResourceClassification;
  month: string;
  fileId: string;
}

export function parseObjectKey(key: string): ParsedKey | null {
  const m = KEY.exec(key);
  return m ? { tenantId: m[1], classification: m[2] as ResourceClassification, month: m[3], fileId: m[4] } : null;
}

/** The check every store operation starts with. Refuses a key that is malformed, traverses, or belongs to another tenant. */
export function assertKeyInTenant(ctx: { tenantId: string }, key: string): ParsedKey {
  const parsed = key.includes('..') || key.includes('//') ? null : parseObjectKey(key);
  if (!parsed || parsed.tenantId !== ctx.tenantId) throw new PlatformError('not_found', 'We could not find that file.');
  return parsed;
}

/** A filename for display and download headers: no path, no control characters, bounded. Never part of the key. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').replace(/^\.+/, '').trim().slice(0, 120);
  return cleaned || 'file';
}

export interface UploadRequest {
  filename: string;
  contentType: string;
  sizeBytes: number;
  classification: ResourceClassification;
}

export interface UploadPlan {
  record: FileRecord;
  /** What the browser must send: the exact type and size it declared, enforced by the storage layer's signed policy. */
  constraints: { contentType: string; maxBytes: number; ttlSeconds: number };
}

export function planUpload(ctx: RequestContext, req: UploadRequest, fileId: string, at: Date): UploadPlan {
  if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(req.contentType)) {
    throw new PlatformError('validation_failed', 'That kind of file cannot be uploaded.');
  }
  if (!Number.isInteger(req.sizeBytes) || req.sizeBytes < 1) throw new PlatformError('validation_failed', 'That file is empty.');
  if (req.sizeBytes > MAX_BYTES[req.classification]) throw new PlatformError('validation_failed', 'That file is too large.');
  const key = objectKey(ctx.tenantId, req.classification, fileId, at);
  return {
    record: {
      id: fileId,
      tenantId: ctx.tenantId,
      ownerId: ctx.actor.personId,
      classification: req.classification,
      state: 'pending_upload',
      contentType: req.contentType,
      sizeBytes: req.sizeBytes,
      key,
      legalHold: false,
      createdAt: at.toISOString(),
    },
    constraints: { contentType: req.contentType, maxBytes: req.sizeBytes, ttlSeconds: Math.min(300, MAX_URL_TTL_S[req.classification]) },
  };
}

export const FILE_TRANSITIONS: Readonly<Record<FileState, readonly FileState[]>> = {
  pending_upload: ['quarantined', 'deleted'],
  quarantined: ['available', 'rejected', 'deleted'],
  available: ['deleted'],
  rejected: ['deleted'],
  deleted: [],
};

export function advanceFile(f: FileRecord, to: FileState): FileRecord {
  if (!FILE_TRANSITIONS[f.state].includes(to)) throw new PlatformError('precondition_failed', `A ${f.state} file cannot become ${to}.`);
  if (to === 'deleted' && f.legalHold) throw new PlatformError('precondition_failed', 'This file is under a legal hold and cannot be deleted.');
  return { ...f, state: to };
}

/** Whether the bytes may be served: available, same tenant, and the caller has been through policy already. */
export function downloadPlan(ctx: RequestContext, f: FileRecord, requestedTtlSeconds: number): { key: string; ttlSeconds: number } {
  if (f.tenantId !== ctx.tenantId) throw new PlatformError('not_found', 'We could not find that file.');
  assertKeyInTenant(ctx, f.key);
  if (f.state !== 'available') throw new PlatformError('precondition_failed', 'That file is not ready.');
  return { key: f.key, ttlSeconds: Math.max(1, Math.min(requestedTtlSeconds, MAX_URL_TTL_S[f.classification])) };
}

/** What an object-store adapter must do. The reference implementation is below; S3/R2/GCS bind the same three operations. */
export interface ObjectStore {
  put(ctx: { tenantId: string }, key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(ctx: { tenantId: string }, key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  delete(ctx: { tenantId: string }, key: string): Promise<void>;
  list(ctx: { tenantId: string }, prefix: string): Promise<string[]>;
}

export class MemoryObjectStore implements ObjectStore {
  private readonly objects = new Map<string, { bytes: Uint8Array; contentType: string }>();

  async put(ctx: { tenantId: string }, key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    assertKeyInTenant(ctx, key);
    this.objects.set(key, { bytes: new Uint8Array(bytes), contentType });
  }

  async get(ctx: { tenantId: string }, key: string) {
    assertKeyInTenant(ctx, key);
    return this.objects.get(key) ?? null;
  }

  async delete(ctx: { tenantId: string }, key: string): Promise<void> {
    assertKeyInTenant(ctx, key);
    this.objects.delete(key);
  }

  async list(ctx: { tenantId: string }, prefix: string): Promise<string[]> {
    // A listing is always rooted at the caller's own tenant prefix, whatever prefix was asked for.
    const root = `t/${ctx.tenantId}/`;
    if (!prefix.startsWith(root)) throw new PlatformError('not_found', 'We could not find that.');
    return [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}
