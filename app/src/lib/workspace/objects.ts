/**
 * Your documents kept in Semester: every saved version, and who may read them.
 *
 * `supabase/migrations/20261022120000_workspace_objects.sql` is the authority.
 * An object lives in your personal workspace; saving it writes a new version
 * and never changes an old one; a share names one person and either the live
 * object or one exact version. The server checks every rule here again —
 * these functions only call it and say what it answered in words a student
 * can act on.
 *
 * Nothing on the device calls this yet. The editor (`screens/Write.tsx`) keeps
 * its documents and their history on the device (`lib/document.ts`,
 * `lib/docversions.ts`), and that is unchanged: this is the server half a
 * "Save a version to Semester" action will use.
 *
 * Three answers get their own kind, because a screen does something different
 * for each:
 *
 * - `stale` — somebody saved since you read it (SQLSTATE 40001). Reload, then
 *   save on top of what is there now.
 * - `conflict` — the same idempotency key was used for a different request
 *   (23505). A bug in the caller, never the student's doing.
 * - `not-set-up` — this database has no workspace objects yet (the migration is
 *   not applied there). A screen hides the action rather than showing an error.
 *
 * Everything else is `refused` (the server said no, in its own sentence) or
 * `unknown` (no answer came back, so the retry must keep its key).
 */

import { cloud } from '../cloud';
import { ServiceError, serviceError } from '../attempt';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => Number(v) || 0;
const obj = (data: unknown): Row => (data && typeof data === 'object' && !Array.isArray(data) ? (data as Row) : {});

export type ObjectKind = 'document' | 'note' | 'spreadsheet' | 'presentation' | 'file';
export type ContentType = 'text/plain' | 'text/markdown' | 'application/json';
export type Permission = 'read' | 'comment' | 'edit';
export type Access = 'owner' | Permission;

/** The largest version the server keeps, in bytes of UTF-8. */
export const MAX_VERSION_BYTES = 1_048_576;

/** One of your objects, as `workspace_objects_mine` lists it. */
export interface WorkspaceObject {
  id: string;
  kind: ObjectKind;
  title: string;
  /** How many versions have been saved; a save names the revision it read. */
  revision: number;
  /** The current version's id. */
  version: string;
  updatedAt: string;
}

/** What creating or saving answers: the receipt for one new version. */
export interface SaveReceipt {
  object: string;
  version: string;
  versionNumber: number;
  revision: number;
  /** SHA-256 of the body as saved, 64 hex digits. */
  sha256: string;
  byteLength: number;
  savedAt: string;
}

/** One version's content. `revision` and `current` are null for somebody holding only that version. */
export interface ObjectVersion {
  object: string;
  kind: ObjectKind;
  version: string;
  versionNumber: number;
  title: string;
  body: string;
  contentType: ContentType;
  contentSchema: string;
  byteLength: number;
  sha256: string;
  savedAt: string;
  access: Access;
  revision: number | null;
  current: boolean | null;
}

export interface GrantReceipt {
  grant: string;
  object: string;
  /** Null when the grant is to the live object. */
  version: string | null;
  permission: Permission;
  expiresAt: string | null;
  grantedAt: string;
}

/** What a version holds, as the caller sends it. */
export interface Content {
  title: string;
  body: string;
  contentType: ContentType;
  /** A name and a version, like `semester.document/1`. */
  contentSchema: string;
}

export type ObjectsFailure = 'stale' | 'conflict' | 'not-set-up' | 'refused' | 'unknown';

export class ObjectsError extends ServiceError {
  readonly kind: ObjectsFailure;
  constructor(message: string, answered: boolean, kind: ObjectsFailure) {
    super(message, answered);
    this.name = 'ObjectsError';
    this.kind = kind;
  }
}

/**
 * Postgres and PostgREST's ways of saying the thing is not there: undefined
 * function, table or column, and the schema-cache misses.
 */
const NOT_SET_UP = new Set(['42883', '42P01', '42703', 'PGRST202', 'PGRST200', 'PGRST204', 'PGRST205']);

/** A failure from the server, as one of the five kinds. */
export function objectsError(error: { message?: string; code?: string } | null | undefined, fallback: string): ObjectsError {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (NOT_SET_UP.has(code)) {
    return new ObjectsError('Saving to Semester is not set up at your school yet. Your work is still on this device.', true, 'not-set-up');
  }
  if (code === '40001') {
    return new ObjectsError('This changed since you opened it. Reload it to see the latest version, then save again.', true, 'stale');
  }
  if (code === '23505') {
    return new ObjectsError('That save was already sent with different content. Try again.', true, 'conflict');
  }
  const e = serviceError(error, fallback);
  return new ObjectsError(e.message, e.answered, e.answered ? 'refused' : 'unknown');
}

/** Why this content cannot be saved, or null when it can. The server checks the same. */
export function contentProblem(c: Content): string | null {
  const title = c.title.trim();
  if (title === '') return 'Give it a title first.';
  if (title.length > 200) return 'A title is at most 200 characters.';
  if (new TextEncoder().encode(c.body).length > MAX_VERSION_BYTES) return 'A version is at most 1 MB.';
  if (!/^[a-z][a-z0-9._-]{0,60}\/[0-9]{1,4}$/.test(c.contentSchema)) return 'The content schema is a name and a version, like semester.document/1.';
  if (c.contentType === 'application/json') {
    try {
      JSON.parse(c.body);
    } catch {
      return 'That is not JSON.';
    }
  }
  return null;
}

function receipt(data: unknown): SaveReceipt {
  const r = obj(data);
  return {
    object: text(r.object),
    version: text(r.version),
    versionNumber: num(r.version_number),
    revision: num(r.revision),
    sha256: text(r.content_sha256),
    byteLength: num(r.byte_length),
    savedAt: text(r.saved_at),
  };
}

/** Make a new object in your workspace, with its first version. */
export async function createObject(kind: ObjectKind, content: Content, key: string): Promise<SaveReceipt> {
  const db = await cloud();
  const { data, error } = await db.rpc('workspace_object_create', {
    want_kind: kind,
    want_title: content.title,
    want_body: content.body,
    want_mime: content.contentType,
    want_schema: content.contentSchema,
    want_key: key,
  });
  if (error) throw objectsError(error, 'It was not saved to Semester.');
  return receipt(data);
}

/**
 * Save a new version on top of `expectedRevision` — the revision you read. If
 * anybody saved since, this throws `stale` and writes nothing.
 */
export async function saveVersion(objectId: string, expectedRevision: number, content: Content, key: string): Promise<SaveReceipt> {
  const db = await cloud();
  const { data, error } = await db.rpc('workspace_object_save', {
    want_object: objectId,
    want_expected_revision: expectedRevision,
    want_title: content.title,
    want_body: content.body,
    want_mime: content.contentType,
    want_schema: content.contentSchema,
    want_key: key,
  });
  if (error) throw objectsError(error, 'The new version was not saved.');
  return receipt(data);
}

/** Your own objects, most recently saved first. */
export async function listMine(): Promise<WorkspaceObject[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('workspace_objects_mine');
  if (error) throw objectsError(error, 'Could not load your documents.');
  return (Array.isArray(data) ? (data as Row[]) : []).map((r) => ({
    id: text(r.object),
    kind: text(r.kind) as ObjectKind,
    title: text(r.title),
    revision: num(r.revision),
    version: text(r.version),
    updatedAt: text(r.updated_at),
  }));
}

/** One version's content: the current one when `versionId` is omitted. */
export async function readVersion(objectId: string, versionId: string | null = null): Promise<ObjectVersion> {
  const db = await cloud();
  const { data, error } = await db.rpc('workspace_object_read', { want_object: objectId, want_version: versionId });
  if (error) throw objectsError(error, 'Could not open it.');
  const r = obj(data);
  return {
    object: text(r.object),
    kind: text(r.kind) as ObjectKind,
    version: text(r.version),
    versionNumber: num(r.version_number),
    title: text(r.title),
    body: text(r.body),
    contentType: text(r.mime_type) as ContentType,
    contentSchema: text(r.content_schema),
    byteLength: num(r.byte_length),
    sha256: text(r.content_sha256),
    savedAt: text(r.saved_at),
    access: text(r.access) as Access,
    revision: r.revision == null ? null : num(r.revision),
    current: r.current == null ? null : r.current === true,
  };
}

export interface ShareRequest {
  objectId: string;
  /** Pin the share to this version; null shares the live object. */
  versionId: string | null;
  grantee: string;
  permission: Permission;
  purpose: string;
  expiresAt: string | null;
}

/** Share an object, or one version of it, with one person. Only the owner can. */
export async function share(req: ShareRequest, key: string): Promise<GrantReceipt> {
  const db = await cloud();
  const { data, error } = await db.rpc('workspace_object_grant', {
    want_object: req.objectId,
    want_version: req.versionId,
    want_grantee: req.grantee,
    want_permission: req.permission,
    want_purpose: req.purpose,
    want_expires_at: req.expiresAt,
    want_key: key,
  });
  if (error) throw objectsError(error, 'It was not shared.');
  const r = obj(data);
  return {
    grant: text(r.grant),
    object: text(r.object),
    version: r.version == null ? null : text(r.version),
    permission: text(r.permission) as Permission,
    expiresAt: r.expires_at == null ? null : text(r.expires_at),
    grantedAt: text(r.granted_at),
  };
}

/** Stop a share. Revoking one already revoked answers when it was revoked. */
export async function revoke(grantId: string): Promise<{ grant: string; revokedAt: string }> {
  const db = await cloud();
  const { data, error } = await db.rpc('workspace_object_revoke', { want_grant: grantId });
  if (error) throw objectsError(error, 'The share was not stopped.');
  const r = obj(data);
  return { grant: text(r.grant), revokedAt: text(r.revoked_at) };
}
