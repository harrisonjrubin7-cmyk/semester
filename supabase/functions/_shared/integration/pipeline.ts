// Generated from app/src/lib/integration/pipeline.ts by app/scripts/edge-integration.ts. Do not edit;
// change the source and run `cd app && node scripts/edge-integration.ts`.

/**
 * The gateway's ingest path, the same for every provider:
 *
 *   provider event / API page / batch file
 *   → connection check (kill switch, status, tenant)
 *   → idempotency (the event's key, once)
 *   → per record: schema validation → classification → never-ingest
 *     → consent and scope → mapping and transform → timestamp regression
 *     → provenance and freshness
 *   → run summary, sanitized errors, next cursor
 *
 * Pure: storage is passed in (`IngestStore`), so the worker binds it to the
 * Supabase tables and the contract tests bind it to memory. Nothing here
 * throws on bad provider data — every failure becomes a counted, sanitized,
 * categorised error, which is what the dashboard's conflict view reads.
 */
import type { DataClass } from './classification.ts';
import { withinCeiling } from './classification.ts';
import type { ConflictKind, ConnectionStatus, ErrorCategory, Freshness } from './catalog.ts';
import { namesNeverIngest, type AdapterDeclaration, type EntityMapping, type FieldMapping } from './adapter.ts';
import { MAX_FRESHNESS_MINUTES, freshnessFromAge } from './freshness.ts';
import { redactReference, sanitizeMessage } from './redact.ts';
import { governanceEnvelope, type GovernanceEnvelope } from './governance-envelope.ts';

export interface ExternalRecord {
  entityType: string;
  id: string;
  /** The provider's own last-modified time. */
  updatedAt?: string;
  deleted?: boolean;
  /** Opaque reference to the person this record is about, when personal. */
  subject?: string;
  fields: Record<string, unknown>;
}

export interface ProviderBatch {
  idempotencyKey: string;
  eventType: string;
  eventVersion: string;
  trigger: 'webhook' | 'scheduled' | 'manual' | 'replay';
  cursorBefore: Record<string, unknown>;
  cursorAfter: Record<string, unknown>;
  records: readonly ExternalRecord[];
}

export interface ConnectionState {
  tenantId: string;
  publicId: string;
  status: ConnectionStatus;
  approved: boolean;
  approvedScopes: readonly string[];
  classificationCeiling: DataClass;
  /** Effective, server-read connection override; otherwise the adapter default. */
  freshnessTargetMinutes?: number;
}

export interface CanonicalReference {
  tenantId: string;
  canonicalEntity: string;
  canonicalId: string;
  /** The Semester account this is about, resolved from `subject`. */
  subjectUserId: string | null;
  sourceSystem: string;
  sourceRecordId: string;
  sourceTimestamp: string | null;
  sourceOfTruth: string;
  classification: DataClass;
  freshness: Freshness;
  mappingVersion: number;
  confidence: number;
  externalDeletedAt: string | null;
  values: Record<string, unknown>;
  governance: GovernanceEnvelope;
  /** Refresh clocks without replacing the provider values or identity. */
  metadataOnly: boolean;
}

export interface IngestStore {
  /** Record the key; false if it was already seen for this connection. */
  claimIdempotencyKey(connection: string, key: string): Promise<boolean>;
  /** The last source timestamp stored for this external record, if any. */
  lastSourceTimestamp(connection: string, entity: string, id: string): Promise<string | null>;
  /** A legacy row must be fully remapped before current provenance is assigned. */
  requiresGovernanceRemap?(connection: string, entity: string, id: string): Promise<boolean>;
  /** Map a provider person reference to a Semester account, or null. */
  resolveSubject(tenantId: string, subject: string): Promise<string | null>;
  /** Whether the account has a live consent for this purpose. */
  hasConsent(tenantId: string, userId: string, purpose: string): Promise<boolean>;
}

export interface IngestError {
  category: ErrorCategory;
  entityType: string | null;
  reference: string;
  message: string;
  retryable: boolean;
}

export interface IngestResult {
  status: 'succeeded' | 'partial' | 'failed' | 'duplicate' | 'refused';
  received: number;
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
  references: CanonicalReference[];
  errors: IngestError[];
  cursorAfter: Record<string, unknown> | null;
}

export interface IngestInput {
  adapter: AdapterDeclaration;
  connection: ConnectionState;
  batch: ProviderBatch;
  store: IngestStore;
  killSwitchEngaged: boolean;
  now: Date;
}

const empty = (status: IngestResult['status'], received: number, errors: IngestError[] = []): IngestResult => ({
  status, received, created: 0, updated: 0, unchanged: 0, rejected: errors.length ? received : 0,
  references: [], errors, cursorAfter: null,
});

function typeOk(f: FieldMapping, v: unknown): boolean {
  switch (f.type) {
    case 'string': return typeof v === 'string';
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    case 'datetime': return typeof v === 'string' && !Number.isNaN(Date.parse(v));
    case 'url': return typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v);
    case 'enum': return typeof v === 'string';
    default: return false;
  }
}

function transform(f: FieldMapping, v: unknown): unknown {
  switch (f.transform ?? 'none') {
    case 'trim': return typeof v === 'string' ? v.trim() : v;
    case 'lower': return typeof v === 'string' ? v.trim().toLowerCase() : v;
    case 'iso_datetime': return typeof v === 'string' ? new Date(v).toISOString() : v;
    default: return v;
  }
}

type Checked =
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; kind: ConflictKind | 'schema_validation'; detail: string };

function mapFields(mapping: EntityMapping, rec: ExternalRecord): Checked {
  for (const name of Object.keys(rec.fields)) {
    if (namesNeverIngest(name)) return { ok: false, kind: 'classification_block', detail: `field ${name} is never ingested` };
  }
  const values: Record<string, unknown> = {};
  for (const f of mapping.fields) {
    const raw = rec.fields[f.external];
    if (raw === undefined || raw === null || raw === '') {
      if (f.required) return { ok: false, kind: 'missing_required', detail: `${f.external} is required` };
      continue;
    }
    if (!typeOk(f, raw)) return { ok: false, kind: 'type_mismatch', detail: `${f.external} is not a ${f.type}` };
    if (f.type === 'enum' && !f.enumValues?.includes(String(raw))) {
      return { ok: false, kind: 'enum_mismatch', detail: `${f.external} has a value outside its enum` };
    }
    try {
      values[f.canonical] = transform(f, raw);
    } catch {
      return { ok: false, kind: 'transform_error', detail: `${f.external} could not be transformed` };
    }
  }
  return { ok: true, values };
}

export async function ingest(input: IngestInput): Promise<IngestResult> {
  const { adapter, connection, batch, store, now } = input;
  const received = batch.records.length;
  const freshnessTargetMinutes = connection.freshnessTargetMinutes ?? adapter.freshnessTargetMinutes;
  const refuse = (message: string, category: ErrorCategory = 'scope_failure') =>
    empty('refused', received, [{ category, entityType: null, reference: 'redacted', message, retryable: false }]);

  if (!Number.isFinite(now.getTime()) || !Number.isFinite(adapter.retentionDays) || adapter.retentionDays <= 0 || adapter.retentionDays > 36500
    || !Number.isFinite(adapter.freshnessTargetMinutes) || adapter.freshnessTargetMinutes <= 0 || adapter.freshnessTargetMinutes > MAX_FRESHNESS_MINUTES
    || !Number.isFinite(freshnessTargetMinutes) || freshnessTargetMinutes <= 0 || freshnessTargetMinutes > MAX_FRESHNESS_MINUTES
    || !adapter.sourceOfTruth.trim()) {
    return refuse('Invalid adapter governance or processing clock.', 'schema_validation');
  }

  // Connection gate. A mock adapter never runs against a real tenant connection.
  if (input.killSwitchEngaged) return refuse('Integration sync is stopped by a kill switch.', 'provider_unavailable');
  if (!connection.approved) return refuse('The connection is not approved.');
  if (connection.status === 'paused') return refuse('The connection is paused.', 'provider_unavailable');
  if (connection.status === 'disconnected') return refuse('The connection is disconnected.');
  if (!withinCeiling(adapter.classificationCeiling, connection.classificationCeiling)) {
    return refuse('The adapter declares more than the connection is approved for.', 'classification_block');
  }

  // Idempotency: an event delivered twice is counted once.
  if (!(await store.claimIdempotencyKey(connection.publicId, batch.idempotencyKey))) {
    return { ...empty('duplicate', received), unchanged: received };
  }

  const result: IngestResult = {
    status: 'succeeded', received, created: 0, updated: 0, unchanged: 0, rejected: 0,
    references: [], errors: [], cursorAfter: batch.cursorAfter,
  };
  const seenIds = new Set<string>();

  for (const rec of batch.records) {
    const reference = await redactReference(connection.tenantId, rec.id);
    const reject = (category: ErrorCategory, detail: string, retryable = false) => {
      result.rejected += 1;
      result.errors.push({ category, entityType: rec.entityType, reference, message: sanitizeMessage(detail), retryable });
    };

    const mapping = adapter.entities.find((e) => e.externalEntity === rec.entityType);
    if (!mapping) { reject('schema_validation', `unmapped entity ${rec.entityType}`); continue; }

    const dupKey = `${rec.entityType}:${rec.id}`;
    if (seenIds.has(dupKey)) { reject('duplicate_external_id', 'the same external id appears twice in one batch'); continue; }
    seenIds.add(dupKey);

    if (!withinCeiling(mapping.classification, connection.classificationCeiling)) {
      reject('classification_block', `${mapping.classification} exceeds the connection ceiling`);
      continue;
    }
    if (!connection.approvedScopes.includes(mapping.scope)) {
      reject('scope_failure', `${mapping.scope} is not approved`);
      continue;
    }

    let subjectUserId: string | null = null;
    if (mapping.personal) {
      if (!rec.subject) { reject('missing_required', 'a personal record has no subject'); continue; }
      subjectUserId = await store.resolveSubject(connection.tenantId, rec.subject);
      if (!subjectUserId) { reject('scope_failure', 'the subject is not a Semester account at this school'); continue; }
      if (adapter.consentRequired
          && !(await store.hasConsent(connection.tenantId, subjectUserId, `integration:${connection.publicId}`))) {
        reject('consent_block', 'no live consent for this connection');
        continue;
      }
    }

    const checked = mapFields(mapping, rec);
    if (!checked.ok) { reject(checked.kind, checked.detail); continue; }

    const previous = await store.lastSourceTimestamp(connection.publicId, rec.entityType, rec.id);
    if (previous && rec.updatedAt && Date.parse(rec.updatedAt) < Date.parse(previous)) {
      reject('timestamp_regression', 'the provider sent an older version than the one stored');
      continue;
    }
    const remap = await store.requiresGovernanceRemap?.(connection.publicId, rec.entityType, rec.id) ?? false;
    const unchanged = Boolean(!remap && previous && rec.updatedAt && Date.parse(rec.updatedAt) === Date.parse(previous) && !rec.deleted);
    // Reconfirmed records still refresh their persisted governance clocks.
    if (unchanged) result.unchanged += 1;

    // Freshness is the age of Semester's copy, not of the provider's edit: a
    // record confirmed this minute is live however long ago it last changed.
    // It decays from here as `freshnessFromAge` is re-read against the
    // connection's last successful sync.
    const freshness = freshnessFromAge(now, freshnessTargetMinutes, now, true);
    result.references.push({
      tenantId: connection.tenantId,
      canonicalEntity: mapping.canonicalEntity,
      canonicalId: `${adapter.id}:${rec.entityType}:${reference.slice(7, 23)}`,
      subjectUserId,
      sourceSystem: `${adapter.provider} ${adapter.product}`.trim(),
      sourceRecordId: rec.id,
      sourceTimestamp: rec.updatedAt ?? null,
      sourceOfTruth: adapter.sourceOfTruth,
      classification: mapping.classification,
      freshness,
      mappingVersion: mapping.version,
      confidence: 1,
      externalDeletedAt: rec.deleted ? now.toISOString() : null,
      values: rec.deleted || unchanged ? {} : checked.values,
      metadataOnly: unchanged,
      governance: governanceEnvelope(adapter, mapping, connection.publicId, now, freshnessTargetMinutes),
    });
    if (!unchanged) {
      if (previous) result.updated += 1; else result.created += 1;
    }
  }

  if (result.rejected === received && received > 0) {
    result.status = 'failed';
    result.cursorAfter = null; // Do not advance past a batch nothing was taken from.
  } else if (result.rejected > 0) {
    result.status = 'partial';
  }
  return result;
}
