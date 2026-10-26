# Automated student freshness feed specification

Status: proposed execution specification, 2026-10-08; no connector or feed deployed/tested. Owners proposed: data/integration engineering, SRE, institutional source owners, privacy/security and student experience. Assign actual owners before implementation.

## 1. Purpose and boundary

Keep student workspace facts, graph relationships, resources and Action Center projections current, explainable and permission-correct. The feed is deterministic infrastructure, not an autonomous record editor or AI prompt stream. Student records never enter provider payloads or generic analytics. Freshness cannot grant authority.

## 2. Inputs and source registry

Each approved source binding declares tenant/context, issuer, entity/predicate authority, allowed read/write scope, source identity/version semantics, webhook/poll strategy, completeness guarantees, retention, integration owner, approval expiry and offboarding rules. Never infer webhook support or revision ordering from vendor name. If source has no ordered revision, use snapshots/digests plus conditional source reads and reconciliation; do not impose lexical ordering on opaque versions.

## 3. Fact freshness contract

fact_id, tenant_id, node/predicate, source binding/record/version, source_updated_at (nullable), observed_at, last_successful_validation_at, source_effective_period, content_digest, verification_state, policy_version, provenance and authorized access scope.

Freshness policy fields: domain/predicate, maximum observation age, maximum source age where meaningful, validity semantics, unknown-clock handling, clock-skew tolerance, stale action behavior, notification rule, requires_execution_revalidation, source outage policy and accountable approver. No universal numeric durations are set in this draft.

Authority, access and freshness are independent dimensions. Freshness states: current, stale, unknown, degraded. Authority states: valid, conflicting, expired, revoked. Access: allowed or denied. A historic valid snapshot need not be stale merely because its content was authored long ago; source-specific policies define whether a later revision must be checked.

## 4. Processing path

1. Webhook or polling scheduler acquires approved connector identity and bounded lease.
2. Validate tenant/context, signature/token as applicable, event ID and source schema; reject/quarantine invalid messages.
3. Stage minimal raw input with scoped retention; resolve canonical IDs and mapping version.
4. Compare approved source version semantics; prevent old revisions replacing current projections; no unsupported deletion inferred from absence in an incomplete snapshot.
5. Within one transaction append accepted fact/version/lineage and outbox event. Projection promotion requires validation and relevant reconciliation, not just successful parsing.
6. Dispatcher delivers at least once. Consumers deduplicate by source event, fact version and projection version; idempotency keys use scoped namespaces.
7. Update graph/search/Action Center projections under permission rules. An updated official deadline creates a proposed plan adjustment, not silent overwrite of student preferences.
8. Scheduler evaluates due freshness checks even if no webhook arrives. Reconcile snapshots and detect missing/out-of-order events.
9. Acknowledge source cursor only after durable processing according to adapter contract. Keep ingestion watermark separate from subscriber cursor.

## 5. Event envelope

Proposed fields: event_id, tenant_id, source_binding_id, source_event_key, fact_id, fact_version, event_type, occurred_at, observed_at, outbox_sequence, mapping_version, policy_version, correlation_id. Types: fact_observed, fact_changed, freshness_changed, source_degraded, conflict_detected, authority_revoked, access_revoked, fact_tombstoned.

Do not put grade values, transcript text, file contents, sensitive titles or user identifiers beyond approved minimized scope in public/generic notifications. Client fetches details through current authorization. Do not expose source binding/internal record IDs unless permitted.

## 6. Student feed and cursor contract

Logical operations, not existing endpoints: subscribe(scope), fetch_changes(opaque_cursor), acknowledge(cursor), refresh_fact(fact_id), inspect_source(fact_id).

Subscriptions are bound to authenticated principal, tenant, purpose and current grants. Opaque server-bound cursors carry scope/filter version and checkpoint but cannot authorize access. A replayed cursor rechecks current permissions. Use per-subscriber filtered sequence/checkpoint semantics so global tenant sequence gaps or total counts do not disclose hidden records. Sign or server-store cursors, expire them under approved retention, and return resync-required if scope/history changes.

Initial sync returns only currently allowed items. Cursor resumes do not replay expired grants. Revocation stops subscriptions and future fetches; invalidate eligible caches/indexes and provide only a minimal removal signal for items previously visible to that subscriber. Treat screenshots/downloaded copies honestly: a revocation cannot guarantee their erasure. Audit authorized feed export.

## 7. Student presentation

Each fact shows source category, last checked time, relevant source-update time if known, current/stale/unknown status and action path. Accessibility requires understandable labels/announcements without disruptive notification flooding. Optional reminders respect user preferences; essential blocked-action explanations remain available.

Examples:
- Source confirms unchanged assignment: last checked advances; source updated does not.
- Registrar source unavailable: registration inputs become degraded/unknown according to policy; no locally invented eligibility.
- Course rule changes: preserve prior rule, invalidate related readiness evaluations, explain review/recheck.
- Imported note snapshot: show imported source/time; do not imply automatic live sync.
- Owner revokes resource: remove future access, derived search visibility and eligible cached content.

## 8. Consequential-action gate

At execution recheck tenant membership, capability/grant, approved source binding, effective rule/catalog, required freshness, policy/source version and exact approval. Source state change invalidates stale approvals where material. Refresh/reconcile if required. Timeout stays pending; do not double-submit. Readiness is not enrollment confirmation. Existing readiness design also includes holds, window, credit load, alternatives and official handoff. [file:193]

## 9. Reliability, incident and recovery

Use exponential backoff with jitter within approved retry/rate budgets, dead-letter quarantine with owner, poison-event isolation and per-source circuit breakers. Source outages cannot silently mark all data deleted or current. Replaying outbox must not recreate revoked grants or duplicate tasks. Rebuild projections from authorized canonical versions and retention/tombstone rules; reconcile before traffic. Define SLI formulas for ingestion lag, last successful validation age, stale critical facts, drift, authorized event delivery and revocation completion; targets require baseline and approval.

## 10. Acceptance suite

FF-01 duplicate event produces one accepted version/obligation.
FF-02 old source revision cannot overwrite newer projection.
FF-03 opaque/incomparable versions trigger approved reconciliation, not lexical compare.
FF-04 source outage/unknown clock displays degraded/unknown and blocks required action.
FF-05 unchanged revalidation advances checked time only.
FF-06 revoked grant denies fetch, cursor replay, stream and search/cache access.
FF-07 tenant A cannot observe B feed items or infer hidden event counts.
FF-08 transaction failure cannot leave fact committed without durable outbox, or publish uncommitted content.
FF-09 dead-letter and replay are scoped, idempotent and audited.
FF-10 rule change invalidates readiness but preserves personal plan edits.
FF-11 partial snapshot cannot imply authorized deletion.
FF-12 forbidden synthetic records remain absent from provider payloads/logs.
FF-13 assistive-technology users understand updates, stale facts and recovery options.
FF-14 backup restore re-applies tombstones/holds and current grants before access.
FF-15 stale approval fails before official side effect; authoritative receipt reconciles retries.

## 11. Activation evidence

Approved source registry/policies, actual mapping/implementation refs, scoped CI/transport tests, independent isolation/privacy/accessibility review, monitoring alerts/runbooks, rehearsal/recovery, support owner and exact institutional authorization. Any critical exposure, prohibited egress or official-integrity defect blocks enablement.

Existing graph and integration plans remain design-stage; the integration factory excerpt says no connector built. This spec adds proposed implementation detail and does not establish runtime capability. [file:109][file:192]
