# CQRS read-model architecture

Design only. Phase 0 changes no database object.

## 1. Principles and what already exists

Bounded CQRS: authoritative tables and controlled RPCs are the **command side**;
restricted, versioned read models are the **query side**; an outbox plus a
worker is the **projection side**. No event sourcing, no table duplication.

**Reconcile first** (the brief's rule). Present in production today:

| Brief asks for | Already exists | Decision |
|---|---|---|
| `private.domain_outbox_events` | **Yes**, 0 rows. Has aggregate type/id, event type/version, environment, tenant, producer, correlation, causation, idempotency key, payload, data classification, retention class, occurred, published, attempts, last error, dead-lettered. One-outcome check; unique `(aggregate_type, aggregate_id, idempotency_key)`; partial pending index. | **Extend, do not recreate.** Add `customer_id`, `actor_type`, `actor_id`, `payload_hash`, `next_attempt_at`, `claim_id`, `claimed_at`. Additive and nullable. |
| `private.projection_event_receipts` | **Yes** as `private.domain_event_receipts` `(consumer, event_id)`, outcome processed/skipped/failed. | **Reuse**, with `consumer = projection name@version`. No new table. |
| `ops.projection_watermarks` | No | New, in `private` (see 3). |
| `ops.projection_invalidations` | No | New. |
| `ops.projection_rebuild_runs` | No | New. |
| `ops.read_model_registry` | No | New. |
| Claim with `FOR UPDATE SKIP LOCKED` | **Yes**, proven pattern in `claim_support_notifications` (5-minute stale claim, service-role only). | **Copy the pattern.** |
| Worker | Edge Function `support-reply-notify` and `integration-tick` set the pattern (cron bearer, claim RPC, dead letter at attempt 8). | New Edge Function `ops-projector` following it. |
| Producer in same transaction | `private.productivity_commit` already does this. | Same shape for ops producers. |

Schema naming: the brief says `ops.*`. There is no `ops` schema and
`rls-coverage.check.sql`, `grants.check.sql` and `definerregister.test.ts` all
scan `public` and `private`. **Recommendation: keep new tables in `private`**
with a `projection_` prefix. A new schema would need to be kept out of the API's
exposed schemas and added to every guard. Open decision B-01.

## 2. Command side

Unchanged. Domain RPCs write the source row and, in the same transaction, call
one helper:

```
private.emit_domain_event(aggregate_type, aggregate_id, event_type, event_version,
  tenant_id, customer_id, correlation_id, causation_id, actor_type, actor_id,
  idempotency_key, payload_sanitized, data_classification)
```

The helper computes `payload_hash`, rejects payloads containing keys on a
deny-list (email, name, body, token, secret, raw), and inserts with
`ON CONFLICT (aggregate_type, aggregate_id, idempotency_key) DO NOTHING`.
Execute is revoked from every client role.

Producers to add, in priority order: tenant rollout/plan/feature/SSO,
approval request and decision, support ticket severity change, pilot metric,
integration failure and dead letter, trust artifact and control evidence,
legal-hold/DSR deadlines, kill switch, role grant/expiry, break-glass.
**Producing an event must never fail the command**: wrap in a savepoint only
where the existing code already does (as `log_break_glass_override` does); for
new producers, a failed insert should abort the command so source and event stay
atomic.

## 3. Projection side

```
private.projection_watermark(projection, version, last_event_id, last_occurred_at,
  last_processed_at, source_updated_at, status, last_error, lag_seconds)
private.projection_invalidation(id, namespace, tenant_id, customer_id,
  resource_id, version, reason, occurred_at, correlation_id)
private.projection_rebuild_run(id, projection, from_version, to_version, mode,
  status, started_at, finished_at, parity_ok, events_replayed)
private.read_model_registry(name, version, capability, scope_kind,
  freshness_slo_seconds, source_tables, redaction_profile, status)
```

Worker loop, one Edge Function invoked by pg_cron (service role, server only):

1. `claim_domain_events(consumer, limit)`: `FOR UPDATE SKIP LOCKED`, sets
   `claim_id`, treats claims older than 5 minutes as stale.
2. For each event: apply projection function inside one transaction that also
   inserts the receipt `(consumer, event_id)`. The receipt primary key makes the
   effect idempotent.
3. On success: update watermark; write invalidation rows for affected namespaces.
4. On failure: increment attempts, `next_attempt_at = now() + 2^attempts` seconds
   with jitter, capped; after the cap set `dead_lettered_at` and write a
   `failed` receipt. Cap proposal: 8, matching the support outbox.
5. Dead-letter replay is an approval-class action: RPC
   `ops_replay_dead_letter(event_id, evidence)` requires a capability, writes a
   console audit event, is idempotent (a replayed event keeps its receipt key).

Do not call the worker "live" without a watermark. A projection with no
watermark row is **unknown**, not fresh.

## 4. Query side: one envelope for every read

Every read RPC returns:

```
{ data,
  meta: { generatedAt, sourceUpdatedAt, computedAt, freshness, coverage,
          authority, modelVersion, correlationId },
  permissions: { canView, canExport, allowedActions },
  warnings }
```

- `freshness` is computed from the watermark, not asserted:
  `fresh | stale | failed | unknown`, against `freshness_slo_seconds`.
- `authority` says where the number came from: `source` (live query of the
  authoritative table), `projection`, or `derived`.
- `coverage` says what is missing (for example "integration health excludes
  tenants with no connection").
- Forbidden is an **error**, SQLSTATE `42501`, never an empty `data`.
- Lists take `limit` (max 100), keyset `cursor`, and a closed filter set.
- Each function: `SECURITY DEFINER`, `search_path = ''`, check
  `auth.uid() is not null`, check `private.has_capability(cap, scope_kind,
  scope_id)`, filter by scope **inside** the query, return only the minimum
  columns, then write a sensitive-read audit event where the data class
  requires it. Execute granted to `authenticated` only.

Read models, with first source of truth and capability:

| Read model | Source tables | Capability and scope |
|---|---|---|
| `ops_executive_overview` | rollout, approvals, support aggregates, release evidence, renewals | `console:operate` platform |
| `ops_operations_inbox` | approvals, break-glass reviews, rollout gates, support SLA, integration failures, evidence expiry, DSR deadlines | per item class, see permission matrix |
| `ops_tenant_overview` | schools, plan, rollout, SSO, feature policy, module mode | `console:operate` platform, or `tenant:configure` over that school |
| `ops_customer_360` | customer, commitments, contracts, subscriptions (amounts banded) | `account:manage` / `billing:read` |
| `ops_pilot_overview` | gtm pilots, metrics, outcomes, implementation | `account:manage` platform |
| `ops_support_overview` | ticket aggregates by severity and age | `support:ticket` platform |
| `ops_release_overview` | kill switches, cohorts, release evidence, beta known issues | `console:operate` |
| `ops_integration_overview` | connections, sync runs, error and dead-letter counts | `integration:view` |
| `ops_compliance_overview`, `ops_trust_overview` | controls, evidence expiry, trust artifacts, grants (counts) | `compliance:manage`, `trust:publish` |
| `ops_privacy_overview` | DSR counts, deadlines, holds (counts) | `audit:read` / `hold:read` |
| `ops_security_overview` | break-glass, role grants, kill switches, advisor classification | `console:operate` + security seat |
| `ops_incident_overview`, `ops_slo_overview`, `ops_access_review_overview` | **new tables required** (Phase 4) | `incident:communicate`, `console:operate` |
| `ops_audit_search` | wraps `console_audit_read` and per-domain audit tables | `audit:read` |
| `ops_projection_dashboard` | watermarks, outbox counts, dead letters | `console:operate` |

Not every read model needs a projection. **Start with live-query RPCs** (authority
`source`) for the ones whose sources are small, and add a projection only where a
measured cost or a cross-domain join demands it. Tenant health and the inbox are
the two that genuinely need projections.

## 5. Tenant health, explainable

Seven components scored from named sources: commercial, implementation,
adoption, support, reliability, integration, security/compliance, relationship.
Each component stores `band`, optional `score`, `drivers[]` (signed, with the
source row and as-of time), `recommended_action`, `owner`, `due`. The overall band is the
**worst** of the components weighted by a documented, versioned rule, never a
hidden model. Missing data renders "no data", not green.

Adoption has no authoritative source today (no usage telemetry table for the
console to read). That component is `unknown` until one is named. Same for
reliability until SLO tables exist (Phase 4).

## 6. Lifecycle state machine

Sixteen states as in the brief. Stored as one row per tenant with an
append-only history, each transition checked by a guard function: required
capability, required evidence, approvals, customer communication, blockers,
audit event, rollback path, next review. **Reuse `tenant_rollout` gates first**:
launch-readiness through live-pilot already have a gate-ordered state machine
(`guard_tenant_rollout`). Only the pre-contract and post-annual states
(Prospect through Contracting, Renewal risk through Purge eligible) are new, and
the offboarding states map onto `school_offboarding`. Do not duplicate them.

## 7. Failure modes and what the UI does

| State | Behaviour |
|---|---|
| Fresh | Normal. |
| Stale (past SLO) | Show last value, both timestamps, banner naming decisions not to be made from it, disable high-risk actions. |
| Failed | Same, red, plus the last error class (sanitized). |
| Unknown | Render "not measured", never a number. |
| Forbidden | Error state with no protected data in it. |
| Offline | Cached read-only view with stale timestamp; controlled actions disabled. |

Any controlled action runs an **authoritative server preflight** (the command RPC
re-checks the live source), regardless of what the projection said.
