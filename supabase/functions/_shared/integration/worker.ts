// Generated from app/server/integration/worker.ts by app/scripts/edge-integration.ts. Do not edit;
// change the source and run `cd app && node scripts/edge-integration.ts`.

/**
 * The sync worker: the pipeline (`src/lib/integration/pipeline.ts`) bound to
 * the control-plane tables, for one connection and one batch at a time.
 *
 * It runs with the service role, which bypasses row-level security, so the
 * boundary RLS would have drawn is drawn here instead, in code:
 *
 *   * the school is the connection's own `tenant_id`, read from the database,
 *     and never anything a provider or a caller supplies;
 *   * every row it writes carries that school, and a reference the pipeline
 *     produced for any other school is refused before it is written;
 *   * the connection must be approved and neither paused nor disconnected, the
 *     global, school and connection kill switches must all be off, and only
 *     scopes approved and unexpired *now* are passed to the pipeline;
 *   * the adapter's declaration must validate and match the connection's
 *     domain, and a mock adapter runs only when the caller says so.
 *
 * A person is resolved through the school's SCIM provisioning
 * (`scim_external_identity` → an **active** `institution_membership`), so a
 * deprovisioned student stops receiving imports without anybody remembering to
 * stop them. Consent is `consent_record`, capability
 * `integration:<connection public id>`, status consented and not revoked.
 *
 * The scheduled tick (`tick.ts`) calls it for connections that are due and for
 * replays an operator requested; a webhook endpoint would call it the same way.
 * See `docs/INTEGRATION-OPERATOR-RUNBOOK.md` §4.
 */
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { validateDeclaration, type AdapterDeclaration } from './adapter.ts';
import { ingest, type ConnectionState, type IngestResult, type IngestStore, type ProviderBatch } from './pipeline.ts';
import { hasGovernanceEnvelope } from './governance-envelope.ts';
import { intervalMinutes } from './freshness.ts';
import { payloadHash, redactReference, sanitizeMessage } from './redact.ts';
import { afterFailure, type NextStep } from './retry.ts';
import type { ConnectionStatus, ErrorCategory } from './catalog.ts';
import type { DataClass } from './classification.ts';

/**
 * What a failed pull means. The worker decides what happens next from it, and
 * knows nothing about how it was reached: the classifier is handed in, because
 * the gateway may not import more client source than the boundary ledger
 * records (`importboundaries.ts`), and the code that knows a 401 from a 429 is
 * `provider-client.ts`, which the Edge Function composes in.
 */
export interface Failure {
  category: ErrorCategory;
  /** A short machine code for `integration_sync_errors.error_code`. */
  code: string;
  /** The provider's own request to wait, in milliseconds, when it made one. */
  retryAfterMs?: number;
}
export type FailureClassifier = (error: unknown, now: Date) => Failure;

export interface SyncRequest {
  connectionPublicId: string;
  adapter: AdapterDeclaration;
  trigger: 'webhook' | 'scheduled' | 'manual' | 'replay';
  /** Fetch one batch from the provider. Throwing is a provider failure. */
  fetchBatch: () => Promise<ProviderBatch>;
  /** Turns what `fetchBatch` threw into a category. Required: there is no default that is safe. */
  classify: FailureClassifier;
  /** Which attempt this is, for retry and dead-lettering. 1-based. */
  attempt?: number;
  /** Only tests and the sandbox tenant set this. */
  allowMock?: boolean;
}

export type SyncReport =
  | { outcome: 'refused'; reason: string }
  | { outcome: 'provider_failed'; runId: string; next: NextStep }
  | { outcome: 'ran'; runId: string; result: IngestResult };

interface ConnectionRow {
  id: string;
  public_id: string;
  tenant_id: string;
  provider_domain: string;
  status: ConnectionStatus;
  approved_at: string | null;
  data_classification_ceiling: DataClass;
  freshness_target: string | null;
}

const fail = (reason: string): SyncReport => ({ outcome: 'refused', reason });

async function killed(db: SupabaseClient, tenant: string, publicId: string): Promise<boolean> {
  const { data, error } = await db.from('feature_kill_switch')
    .select('switch_key,tenant_id,engaged')
    .eq('engaged', true)
    .in('switch_key', ['kill.integration_sync', `kill.connection.${publicId}`]);
  if (error) return true; // A switch that cannot be read is treated as thrown.
  return (data ?? []).some((k: { tenant_id: string | null }) => k.tenant_id === null || k.tenant_id === tenant);
}

/** The pipeline's storage, bound to one connection's school. */
export function tableStore(db: SupabaseClient, connection: ConnectionRow, adapter: AdapterDeclaration): IngestStore {
  const canonicalOf = (external: string) => adapter.entities.find((e) => e.externalEntity === external)?.canonicalEntity;
  const sourceSystem = `${adapter.provider} ${adapter.product}`.trim();
  const remap = new Set<string>();
  const key = (entity: string, id: string) => JSON.stringify([entity, id]);
  return {
    async claimIdempotencyKey() {
      // Claimed by `runSync` itself, before the pipeline runs, so a duplicate
      // costs no provider records; by the time the pipeline asks, it is ours.
      return true;
    },
    async lastSourceTimestamp(_c, entity, id) {
      const type = canonicalOf(entity);
      if (!type) return null;
      const { data } = await db.from('canonical_entity_references').select('source_timestamp,display')
        .eq('tenant_id', connection.tenant_id).eq('connection_id', connection.id).eq('source_system', sourceSystem)
        .eq('source_record_id', id).eq('canonical_entity_type', type).is('external_deleted_at', null).maybeSingle();
      const stored = data as { source_timestamp: string | null; display: Record<string, unknown> } | null;
      if (stored && !hasGovernanceEnvelope(stored.display?._governance)) remap.add(key(entity, id));
      else remap.delete(key(entity, id));
      return stored?.source_timestamp ?? null;
    },
    async requiresGovernanceRemap(_c, entity, id) { return remap.has(key(entity, id)); },
    async resolveSubject(tenant, subject) {
      if (tenant !== connection.tenant_id) return null;
      const { data: identity } = await db.from('scim_external_identity').select('membership_id')
        .eq('tenant_id', tenant).eq('external_id', subject).eq('active', true).maybeSingle();
      const membershipId = (identity as { membership_id: string } | null)?.membership_id;
      if (!membershipId) return null;
      const { data: member } = await db.from('institution_membership').select('auth_user_id')
        .eq('tenant_id', tenant).eq('id', membershipId).eq('status', 'active').maybeSingle();
      return (member as { auth_user_id: string | null } | null)?.auth_user_id ?? null;
    },
    async hasConsent(tenant, userId, purpose) {
      if (tenant !== connection.tenant_id) return false;
      const { data } = await db.from('consent_record').select('id')
        .eq('tenant_id', tenant).eq('subject_user_id', userId).eq('capability', purpose)
        .eq('status', 'consented').is('revoked_at', null).limit(1);
      return (data ?? []).length > 0;
    },
  };
}

export async function runSync(db: SupabaseClient, req: SyncRequest, now: () => Date = () => new Date()): Promise<SyncReport> {
  // ── Is this allowed to run at all ────────────────────────────────────────
  const problems = validateDeclaration(req.adapter);
  if (problems.length) return fail(`adapter declaration: ${problems[0]}`);
  if (req.adapter.mock && !req.allowMock) return fail('a mock adapter cannot run against a real connection');

  const { data: row, error } = await db.from('integration_connections')
    .select('id,public_id,tenant_id,provider_domain,status,approved_at,data_classification_ceiling,freshness_target')
    .eq('public_id', req.connectionPublicId).maybeSingle();
  if (error || !row) return fail('no such connection');
  const c = row as ConnectionRow;
  if (c.provider_domain !== req.adapter.domain) return fail(`adapter is ${req.adapter.domain}, connection is ${c.provider_domain}`);
  if (!c.approved_at) return fail('connection not approved');
  if (c.status === 'paused' || c.status === 'disconnected') return fail(`connection ${c.status}`);
  if (await killed(db, c.tenant_id, c.public_id)) return fail('kill switch engaged');

  // The connector's own flag, for this school. Approval says a connection may
  // run; the flag says the school has turned it on. Both are required, and a
  // flag that is absent, unreadable or short of production is off.
  const { data: flagRow, error: flagError } = await db.from('tenant_feature_policy').select('state')
    .eq('tenant_id', c.tenant_id).eq('capability', req.adapter.featureFlag).maybeSingle();
  if (flagError || (flagRow as { state: string } | null)?.state !== 'production') {
    return fail(`${req.adapter.featureFlag} is not on for this school`);
  }

  const { data: scopeRows } = await db.from('integration_scopes').select('scope_key,expires_at')
    .eq('connection_id', c.id).eq('approved', true);
  const at = now();
  const approvedScopes = (scopeRows ?? [])
    .filter((s: { expires_at: string | null }) => !s.expires_at || new Date(s.expires_at) > at)
    .map((s: { scope_key: string }) => s.scope_key);

  // ── The run ──────────────────────────────────────────────────────────────
  const { data: run, error: runError } = await db.from('integration_sync_runs').insert({
    tenant_id: c.tenant_id, connection_id: c.id, trigger_type: req.trigger, sync_mode: req.adapter.modes[0],
    status: 'running', started_at: at.toISOString(), retry_count: Math.max(0, (req.attempt ?? 1) - 1),
  }).select('id').single();
  if (runError || !run) return fail(`could not open a run: ${sanitizeMessage(runError?.message)}`);
  const runId = (run as { id: string }).id;

  let batch: ProviderBatch;
  try {
    batch = await req.fetchBatch();
  } catch (e) {
    // What the failure was decides what happens next: a dead grant or a refused
    // credential is `authentication` and dead-letters at once, a throttle is
    // `rate_limit` and carries the provider's wait, and only an outage or an
    // unknown error is `provider_unavailable`.
    const failure = req.classify(e, now());
    const next = afterFailure(failure.category, req.attempt ?? 1, now(), undefined, undefined, failure.retryAfterMs);
    await db.from('integration_sync_errors').insert({
      tenant_id: c.tenant_id, sync_run_id: runId, connection_id: c.id, error_category: failure.category,
      error_code: failure.code, sanitized_message: sanitizeMessage(e), severity: 'error', retryable: next.kind === 'retry',
      retry_count: Math.max(0, (req.attempt ?? 1) - 1),
    });
    if (next.kind === 'dead_letter') {
      await db.from('integration_dead_letter_events').insert({
        tenant_id: c.tenant_id, connection_id: c.id, sync_run_id: runId, reason: next.reason.slice(0, 500),
        attempts: req.attempt ?? 1,
      });
    }
    await db.from('integration_sync_runs').update({ status: 'failed', completed_at: now().toISOString(), errors_count: 1 })
      .eq('id', runId).eq('tenant_id', c.tenant_id);
    await db.from('integration_connections').update({
      last_attempt_at: now().toISOString(), last_error_at: now().toISOString(),
      status: c.status === 'healthy' || c.status === 'degraded' ? 'error' : c.status, updated_at: now().toISOString(),
    }).eq('id', c.id).eq('tenant_id', c.tenant_id);
    return { outcome: 'provider_failed', runId, next };
  }

  // Idempotency as a constraint: the second delivery of a key is refused by
  // the unique index, and nothing from it is ingested.
  const { error: eventError } = await db.from('integration_webhook_events').insert({
    tenant_id: c.tenant_id, connection_id: c.id, event_type: batch.eventType.slice(0, 120),
    event_version: batch.eventVersion.slice(0, 40), idempotency_key: batch.idempotencyKey,
    payload_hash: await payloadHash(batch.records), processing_status: 'processing',
  });
  const duplicate = eventError !== null && /duplicate|unique/i.test(eventError.message ?? '');
  if (eventError && !duplicate) {
    await db.from('integration_sync_runs').update({ status: 'failed', completed_at: now().toISOString() })
      .eq('id', runId).eq('tenant_id', c.tenant_id);
    return fail(`could not record the event: ${sanitizeMessage(eventError.message)}`);
  }

  const connection: ConnectionState = {
    tenantId: c.tenant_id, publicId: c.public_id, status: c.status, approved: true,
    approvedScopes, classificationCeiling: c.data_classification_ceiling,
    freshnessTargetMinutes: intervalMinutes(c.freshness_target) ?? req.adapter.freshnessTargetMinutes,
  };
  const store = tableStore(db, c, req.adapter);
  const result = duplicate
    ? { status: 'duplicate' as const, received: batch.records.length, created: 0, updated: 0,
        unchanged: batch.records.length, rejected: 0, references: [], errors: [], cursorAfter: null }
    : await ingest({ adapter: req.adapter, connection, batch, store, killSwitchEngaged: false, now: now() });

  // ── Write what the pipeline decided, inside this school only ─────────────
  const foreign = result.references.filter((r) => r.tenantId !== c.tenant_id);
  if (foreign.length) throw new Error('The pipeline produced a reference for another school; nothing was written.');

  const sourceSystem = `${req.adapter.provider} ${req.adapter.product}`.trim();
  const writes = result.references.filter((r) => !r.metadataOnly);
  const refreshes = result.references.filter((r) => r.metadataOnly);
  if (writes.length) {
    const { error: refError } = await db.from('canonical_entity_references').upsert(
      writes.map((r) => ({
        tenant_id: c.tenant_id, canonical_entity_type: r.canonicalEntity, canonical_entity_id: r.canonicalId,
        subject_user_id: r.subjectUserId, connection_id: c.id, source_system: sourceSystem,
        source_record_id: r.sourceRecordId, source_timestamp: r.sourceTimestamp, source_of_truth: r.sourceOfTruth,
        classification: r.classification, freshness_status: r.freshness, mapping_version: r.mappingVersion,
        confidence: r.confidence, external_deleted_at: r.externalDeletedAt,
        // display is a small FLAT object by SQL contract; the reserved
        // metadata is encoded, not a nested payload or provider-controlled field.
        display: { ...r.values, _governance: JSON.stringify(r.governance) },
        updated_at: now().toISOString(),
      })),
      // A record's identity includes its connection: two connections to the
      // same product at one school must not overwrite each other's rows.
      { onConflict: 'tenant_id,connection_id,source_system,source_record_id,canonical_entity_type' },
    );
    if (refError) {
      result.errors.push({ category: 'unknown', entityType: null, reference: 'redacted',
        message: sanitizeMessage(refError.message), retryable: true });
      result.status = 'failed';
      result.cursorAfter = null;
    }
  }
  if (refreshes.length) {
    // One atomic, tenant-scoped database update. Values stay in the database;
    // a concurrently replaced/deleted source revision cannot be refreshed.
    const { data: refreshed, error: refreshError } = await db.rpc('integration_refresh_governance', {
      want_tenant: c.tenant_id, want_connection: c.id, want_source: sourceSystem,
      want_records: refreshes.map((r) => ({ entity: r.canonicalEntity, id: r.sourceRecordId,
        timestamp: r.sourceTimestamp, governance: JSON.stringify(r.governance) })),
      want_at: now().toISOString(),
    });
    if (refreshError || refreshed !== refreshes.length) {
      result.errors.push({ category: 'unknown', entityType: null, reference: 'redacted',
        message: sanitizeMessage(refreshError?.message ?? 'Source revision changed during metadata refresh; retry the batch.'), retryable: true });
      result.status = 'failed';
      result.cursorAfter = null;
    }
  }
  if (result.errors.length) {
    await db.from('integration_sync_errors').insert(result.errors.map((e) => ({
      tenant_id: c.tenant_id, sync_run_id: runId, connection_id: c.id, external_entity_type: e.entityType,
      external_record_reference_redacted: e.reference, error_category: e.category, sanitized_message: e.message,
      severity: 'error', retryable: e.retryable,
    })));
  }

  const done = now().toISOString();
  const runStatus = result.status === 'duplicate' || result.status === 'succeeded' ? 'succeeded'
    : result.status === 'partial' ? 'partial' : 'failed';
  if (!duplicate) {
    if (runStatus === 'failed' && result.errors.some((e) => e.retryable)) {
      // Release the claim. A batch that failed for a reason another attempt
      // can fix (a save that did not land) must not stay claimed, or its own
      // retry or redelivery would look like a duplicate and be dropped.
      await db.from('integration_webhook_events').delete()
        .eq('connection_id', c.id).eq('idempotency_key', batch.idempotencyKey).eq('tenant_id', c.tenant_id);
    } else {
      // Kept, including a batch refused for good (schema, scope, consent,
      // classification): redelivering it cannot change the answer, so it is
      // a duplicate rather than a fresh failure logged on every delivery.
      await db.from('integration_webhook_events').update({
        processing_status: runStatus === 'failed' ? 'rejected' : 'processed', processed_at: done,
      }).eq('connection_id', c.id).eq('idempotency_key', batch.idempotencyKey).eq('tenant_id', c.tenant_id);
    }
  }
  await db.from('integration_sync_runs').update({
    status: runStatus, completed_at: done, cursor_before: batch.cursorBefore, cursor_after: result.cursorAfter,
    records_received: result.received, records_created: result.created, records_updated: result.updated,
    records_unchanged: result.unchanged, records_rejected: result.rejected, errors_count: result.errors.length,
  }).eq('id', runId).eq('tenant_id', c.tenant_id);

  const nextStatus: ConnectionStatus = runStatus === 'succeeded' ? 'healthy' : runStatus === 'partial' ? 'degraded' : 'error';
  await db.from('integration_connections').update({
    status: nextStatus,
    last_attempt_at: done,
    ...(runStatus !== 'failed' ? { last_successful_sync_at: done } : { last_error_at: done }),
    ...(result.cursorAfter ? { cursor_state: result.cursorAfter } : {}),
    updated_at: done,
  }).eq('id', c.id).eq('tenant_id', c.tenant_id);

  return { outcome: 'ran', runId, result };
}

// ── Reconciliation ─────────────────────────────────────────────────────────

export interface ReconcilePlan { stillThere: string[]; goneAtSource: string[]; unknownHere: string[] }

/** Which local records the provider no longer has, and which it has that we do not. */
export function reconcilePlan(localIds: Iterable<string>, providerIds: Iterable<string>): ReconcilePlan {
  const local = new Set(localIds);
  const remote = new Set(providerIds);
  return {
    stillThere: [...local].filter((id) => remote.has(id)).sort(),
    goneAtSource: [...local].filter((id) => !remote.has(id)).sort(),
    unknownHere: [...remote].filter((id) => !local.has(id)).sort(),
  };
}

/**
 * Compare one entity type's local references with the provider's full list of
 * ids, mark those the source deleted (their values cleared, the row kept as
 * provenance of the deletion), and record the outcome on the run.
 */
export async function reconcile(
  db: SupabaseClient,
  req: { connectionPublicId: string; adapter: AdapterDeclaration; canonicalEntity: string; providerIds: string[]; runId: string },
  now: () => Date = () => new Date(),
): Promise<ReconcilePlan | { refused: string }> {
  const { data: row } = await db.from('integration_connections').select('id,tenant_id,approved_at,status')
    .eq('public_id', req.connectionPublicId).maybeSingle();
  const c = row as { id: string; tenant_id: string; approved_at: string | null; status: string } | null;
  if (!c || !c.approved_at) return { refused: 'no approved connection' };
  const sourceSystem = `${req.adapter.provider} ${req.adapter.product}`.trim();
  const { data: locals } = await db.from('canonical_entity_references').select('source_record_id')
    .eq('tenant_id', c.tenant_id).eq('connection_id', c.id).eq('source_system', sourceSystem)
    .eq('canonical_entity_type', req.canonicalEntity).is('external_deleted_at', null);
  const plan = reconcilePlan((locals ?? []).map((l: { source_record_id: string }) => l.source_record_id), req.providerIds);
  if (plan.goneAtSource.length) {
    const { error: tombstoneError } = await db.rpc('integration_tombstone_references', {
      want_tenant: c.tenant_id, want_connection: c.id, want_source: sourceSystem,
      want_entity: req.canonicalEntity, want_ids: plan.goneAtSource, want_at: now().toISOString(),
    });
    if (tombstoneError) return { refused: `could not reconcile: ${sanitizeMessage(tombstoneError.message)}` };
  }
  const state = plan.goneAtSource.length || plan.unknownHere.length ? 'mismatched' : 'matched';
  await db.from('integration_sync_runs').update({ reconciliation_state: state }).eq('id', req.runId).eq('tenant_id', c.tenant_id);
  if (plan.unknownHere.length) {
    await db.from('integration_sync_errors').insert({
      tenant_id: c.tenant_id, sync_run_id: req.runId, connection_id: c.id, external_entity_type: req.canonicalEntity,
      external_record_reference_redacted: 'redacted', error_category: 'deletion_mismatch', severity: 'warning', retryable: true,
      sanitized_message: `${plan.unknownHere.length} record(s) at the source are not here; the next incremental sync should bring them.`,
    });
  }
  return plan;
}

/** Exposed for the runbook's replay step: the same reference hashing the pipeline uses. */
export { redactReference };
