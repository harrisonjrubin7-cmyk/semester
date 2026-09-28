# Zero-trust, events, API governance, extensibility and observability — the register

Four architecture documents were handed to this repository on 28 September
2026: a zero-trust deep dive, the full *Zero-Trust, Event-Driven, API,
Extensibility and Observability Architecture* specification, a companion on
the remaining cross-cutting reinforcements (secrets, analytics separation,
resilience, ADRs), and the product modernization blueprint. Between them they
name roughly ninety things. This file is the map from each of those to what
the tree already had, what landed with it, and what is open — because a
roadmap that does not know what is already built asks for the same work
twice, and this repository has done that before (`CLAUDE.md`).

Three columns of status, and they mean exactly this:

- **Had** — it existed on `main` before this register, at the path named.
- **Landed** — it arrived with this register (ADRs 0007–0010 and the change
  that carried them).
- **Open** — it does not exist. Where a partial exists, the row says which
  part.

Nothing here is a promise about a date. The stages at the end are an order,
and the order is the specification's.

---

## 1 · Zero trust

| Item | Status | Where, or what is missing |
| --- | --- | --- |
| Server-side authorization on every request | Had | Row-level security at the data (ADR 0002, `supabase/check.sh`, 70 check suites); the gateway re-authenticates and re-checks the adapter on every call (`server/institution/gateway.ts`) |
| Tenant resolved server-side from verified membership, never the client | Had | `server/institution/auth.ts`, `membership.ts`: roles come from `institution_membership`, never from `user_metadata` |
| Canonical `AuthorizationRequest` / `AuthorizationDecision` / obligations | Landed | `packages/institution/src/policy.ts`, ADR 0007 |
| Central policy decision point that fails closed | Landed | `decide()` — unknown action, unverified tenant, missing correlation id, no membership, expired grant are each a denial before any rule runs |
| Action vocabulary and resource taxonomy | Landed, partial | `POLICY_ACTIONS` holds the three high-risk actions the specification specifies; `RESOURCE_CLASSIFICATIONS`, `SOURCE_KINDS`, `TENANT_VERIFICATIONS`. **Open:** every other sensitive action is still named only where it is checked |
| Policy evaluation sequence (12 steps) | Landed | `decide()` runs steps 1–8; steps 9–12 (workflow state, RLS, audit, minimal fields) are the caller's, and `applyObligations` does step 12's masking |
| Support-access rule: live student grant, matching ticket, scope, window, masked, audited | Landed as policy; had as data | `policy.ts` rule; `20260925103000_support_access.sql` (seven-day maximum, consent-bound, pseudonymous event log). **Open:** the support read path does not yet call `decide()` |
| AI source-retrieval rule: enrolment or share, live source, permitted mode, provider clearance, citation | Landed as policy | `policy.ts`. **Open:** `server/institution/intelligence.ts` keeps its own checks; adoption is the next step |
| Grade-passback rule: capability or bound service, deployment bound, ready, permitted, idempotent, fresh MFA | Landed as policy | `policy.ts`. **Open:** `supabase/functions/_shared/ltiags.ts` decides for itself today |
| Field-level masking and minimization | Landed | `applyObligations` (`mask_fields`, `limit_fields`); had for identity claims in `packages/institution/src/identity.ts` |
| Fresh-MFA obligation for high-impact actions | Landed as obligation | `require_fresh_mfa` on a human-triggered passback. **Open:** no enforcement point turns it into a challenge; the gateway re-fetches membership on commit but has no step-up |
| Service identities bound to tenant, audience, scope, expiry | Had, partial | SCIM credentials (`20260928200000_scim_gateway.sql`), integration-tick auth (`20260928101000`); `tenant.verifiedBy: 'service_binding'` names it in the request |
| Log allow/deny for sensitive actions without secrets | Landed, partial | Denials carry a `reasonCode`; the gateway's audit row now carries the correlation id. **Open:** writing the decision's reason code to an audit row is the adopting route's job |
| Negative / refusal / revocation test suite | Landed | `policy.test.ts` (25 cases, each with its control inside it); had for RLS in every `*.check.sql` |
| Break-glass with expiry, approval, banner, audit, review | Open | Named in `docs/PLATFORM_REQUIREMENTS.md`; no workflow, table or screen |
| Demo cannot touch education records | Landed | `decide()`; had as a deployment decision in #900/#901 (the product and the demo are separate) |
| Quarterly policy review | Open | No cadence recorded; see §9 |

## 2 · Event-driven workflows

| Item | Status | Where, or what is missing |
| --- | --- | --- |
| Event envelope with id, type, version, producer, environment, tenant, actor, subject, correlation, causation, idempotency, classification, retention | Landed | `packages/institution/src/events.ts`, ADR 0008 |
| Event catalog (identity, action, LMS, integration, AI, support/security, commercial, credential) | Landed | `EVENT_TYPES`, 50 types, each versioned with a classification floor and a retention class |
| Transactional outbox table | Landed | `private.domain_outbox_events` (`20260928320000_audit_correlation_and_outbox.sql`); `outbox.check.sql` |
| Publisher with retry and dead letter | Landed | `drainOutbox` against any `OutboxStore`; `MemoryOutbox` is the reference. **Open:** the Postgres-bound store and the scheduled job that runs it |
| Idempotent consumers with a receipt per (consumer, event) | Landed | `processOnce`, `private.domain_event_receipts` |
| Consumer rules (idempotent, tenant-checked, ordering not assumed, unknown optional fields tolerated) | Landed | `validateEvent`, `processOnce`; the tenant check is in `processOnce`, ordering is not promised anywhere |
| Retry with backoff, dead letter, operator replay for integrations | Had | `app/src/lib/integration/retry.ts`, `server/integration/worker.ts`, `tick.ts`; `docs/INTEGRATION-OPERATOR-RUNBOOK.md` |
| Any producer writing to the outbox | Open | None yet. Order, per the specification's phases: high-risk gateway writes → integration sync, notifications, support, source freshness → passback, assessment recovery, billing, credentials |
| Event schema registry and replay | Open | The catalog is the registry in code; a replay tool and a versioning rule beyond "version must match" are not written |
| Tenant-safe analytics projections | Open | `ANALYTICS.md` and `docs/ANALYTICS-EVENTS.md` define marks; no projection consumes events |

## 3 · Workflow state machines

| Item | Status | Where |
| --- | --- | --- |
| Assessment submission (with recovery and ambiguity paths) | Landed | `packages/institution/src/workflow.ts`, ADR 0009 |
| Grade passback (draft → … → reconciled; retry; ambiguous → reconciliation) | Landed | `workflow.ts` |
| Data export / deletion (legal hold, optional export, certificate, retained-with-explanation) | Landed | `workflow.ts`; had as data in `deletion.check.sql` and `docs/DATA-PORTABILITY-AND-OFFBOARDING.md` |
| Support access | Landed | `workflow.ts`; had as data in `20260925103000_support_access.sql` |
| Two-phase university action | Had | `server/institution/journal.ts` — the `uncertain` state is the model every machine here follows |
| Tenant go-live | Had | `app/src/lib/governance/rollout.ts`, `20260928050000_tenant_rollout.sql` |
| LTI launch, integration sync, billing/dunning, credential verification, offboarding, contract approval, registration handoff, advisor and accommodation sharing | Open | No definitions. Each is added the same way: states, table, exhaustive test |
| Screens that only offer legal moves | Open | No screen reads `transition()` yet |

## 4 · Data contracts and API governance

| Item | Status | Where, or what is missing |
| --- | --- | --- |
| Data contract shape (owner, purpose, classification, source, freshness, retention, access, schema, consumers, compatibility, change notice) | Had | `app/src/lib/governance/data-contracts.ts`, `docs/data-contract.md`, `docs/operating-model/DATA-STEWARDSHIP.md` |
| Schema drift and contract testing in CI | Had, partial | `docs/SCHEMA-DRIFT-AND-CONTRACT-TESTING.md`; `supabase/check.sh` proves the schema; `packages/contract` is the client wire shape. **Open:** a consumer-driven contract test per registered contract |
| Contract registry screen (`/ops/data-governance/contracts`) | Open | The contracts are a TypeScript list; no screen renders them with validation and deprecation state |
| Standard error envelope | Landed | `{ error: { code, message, correlation_id, retryable, user_action? }, message }` on every gateway refusal; ADR 0010. **Open:** edge functions (`supabase/functions/*`) still answer in their own shapes |
| Every endpoint defines owner, audience, version, auth, scope, tenant resolution, schemas, rate limit, idempotency, error contract, audit, observability, deprecation, tests | Had, partial | The gateway's routes have version (`/v1`), auth, tenant resolution, rate limit (`gateway_take_rate_limit`, `20260928230000_direct_rate_limits.sql`), body limits, error contract and tests. **Open:** no per-endpoint manifest; idempotency keys exist for the two-phase action (the review id) and nowhere else |
| HTTPS only; no client-supplied tenant; explicit versioning; cursor pagination | Had | `lib/university.ts` refuses a non-secure gateway; `/records` is cursor-paginated |
| Idempotency keys on consequential writes | Landed in policy; had for actions | `grade.passback.submit` refuses without one; the review id is the action's |
| API lifecycle (proposal → reviews → sandbox → docs → beta → release → deprecation → retirement) | Open | `docs/COMPONENT-RELEASE-CHECKLIST.md` and `governance/quality-gates.ts` cover the product surface, not an API's lifecycle |
| Webhook governance (signature, replay protection, delivery logs, customer disable) | Open, inbound partial | Inbound: LTI and SCIM verify signatures and credentials. Outbound webhooks do not exist |

## 5 · Platform extensibility

| Item | Status | Where |
| --- | --- | --- |
| Layered model: configurable UI → policy extensions → adapters → declarative workflows → APIs → embedded → plugins | Had as governance | `docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md` (hard boundaries, capabilities and flags) |
| Tenant feature flags and kill switches | Had | `feature_kill_switch`, `feature_state()`, `app/src/lib/experience-flags.ts` |
| Tenant policy configuration | Had | `effective_ai_policy()`, `20260928011845_tenant_sso_policy.sql`, `tenant_plan` |
| Integration adapters | Had | `InstitutionAdapter` (`server/institution/adapter.ts`), the integration control plane (`20260927170000`) |
| LTI Deep Linking | Had | `supabase/functions/_shared/ltideeplink.ts` |
| Extension manifest (scopes, allowed and prohibited fields, signing, support owner, deprecation) | Open | Governance doc describes it; no schema or validator |
| Partner due-diligence pipeline, sandbox, certification | Open | `server/institution/sandbox.ts` is a sandbox *adapter* for screens, not a partner sandbox |
| Avoid: arbitrary customer code, direct SQL, unscoped tokens, per-tenant forks | Had | None exist, and `docs/DO-NOT-BUILD.md` says so |

## 6 · Observability and audit

| Item | Status | Where, or what is missing |
| --- | --- | --- |
| Correlation id across browser → API → audit → telemetry | Landed | `X-Correlation-Id` accepted and minted in the gateway, written to `gateway_audit.correlation_id` and to the telemetry event; `lib/university.ts` sends one per call. ADR 0010 |
| Correlation id across database jobs, integrations, AI requests, notifications, tickets | Open | The outbox row carries it; nothing downstream reads it yet. Edge functions carry no id |
| Request id minted per request | Had (response only) → Landed (in telemetry too) | `X-Request-Id` |
| Canonical audit event (actor, tenant, scope, action, target, outcome, reason, ticket, correlation, source, before/after refs) | Landed, partial | The gateway audit row now has correlation; `outcome`, `reasonCode`, `ticketId`, `source` and before/after refs are not columns. Support access events have most of this shape already (`support_access_event`) |
| Audit separated from operational logs; append-only; access audited | Had, partial | `private.gateway_audit`, `role_grant_audit`, `moderation_audit`, `support_access_event` are service-role only. **Open:** "audit record access is itself audited" and integrity checks for gaps |
| Telemetry by layer (browser, API, database, jobs, integrations, AI, LMS, business, security) | Had, partial | API: `GatewayTelemetryEvent`; AI: `gateway_intelligence_audit`; browser and database: not wired. `MONITORING.md` §"the four things" says what is watched and by whom |
| Alert design (page vs ticket) | Had, partial | `MONITORING.md` §"the one alert"; error budgets in `governance/error-budgets.ts` (#895); SLO register (#839). **Open:** the page-immediately list (cross-tenant anomaly, break-glass, systemic write failure, restore failure, auth outage, secret exposure) is not instrumented |
| Dashboards per audience | Open | A status page exists (#902); no operator dashboards |
| Restore, incident and alert drills | Had | `RESTORE.md`, `supabase/restore.sh`, `docs/CRISIS-RESPONSE-RUNBOOK.md`, `governance/incident-comms.ts` |

## 7 · The companion's remaining reinforcements

| Item | Status | Where |
| --- | --- | --- |
| Secure document intelligence (allowlist, scan, quarantine, anchors, no cross-tenant index) | Had, partial | `supabase/functions/_shared/mediascan.ts`, `docs/COMMUNITY-MEDIA-SAFETY.md`; source anchors in the study pipeline. **Open:** a quarantine state and prompt-injection treatment as a named step |
| Search and AI use one permission-aware source layer | Had as decision | ADR 0006; `intelligence.ts` scopes retrieval to tenant. The `ai.retrieve_source` rule is the shared question |
| Multi-region and data residency as configuration | Open | Named in `docs/PLATFORM_REQUIREMENTS.md`; single region, not configurable |
| Secret inventory, owner, rotation, KMS | Had | `SECRETS.md` §"the inventory", §"rotation log"; Gitleaks in CI |
| Analytics separation (operational, product, institutional, research, marketing) | Had as policy | `ANALYTICS.md`, `docs/ANALYTICS-EVENTS.md`, `docs/PSEUDONYMITY-POLICY.md`; `RETENTION.md` for `ai_usage_month` |
| Financial boundary from academic data | Had, partial | `20260928090000_gtm_foundation.sql`, `tenant_plan`, `docs/ENTITLEMENT-RESOLUTION.md`. **Open:** payment webhooks (no processor chosen — ADR index says so) |
| Resilience patterns (timeouts, retries, circuit breakers, kill switches, canary, rollback) | Had, partial | Timeouts and body limits in the gateway; retries and dead letter in integration; kill switches; `ROLLBACK.md`; `docs/RESILIENT-STUDENT-MODE.md`. **Open:** circuit breakers and bulkheads as code |
| Architecture decision records | Had → extended | `docs/architecture/` 0001–0006; 0007–0010 landed |
| Review cadence (weekly, monthly, quarterly, pre-launch) | Open | `docs/operating-model/` names the roles; no cadence with dates |

## 8 · The modernization blueprint

The blueprint's twelve priorities are product-level and mostly map to work
already indexed elsewhere; this register does not re-plan them. Where one is
carried by this register: **8 policy-as-code** (ADR 0007), **9 high-assurance
tenant and role architecture** (§1 above), **10 academic-critical
reliability** (§2, §3, §6). The rest — AppShell, Today, decision packets,
contextual Ask, native LMS, integration control plane, source-of-truth
engine, launch method, credential wallet — are in
`docs/ADDITIVE-UNIVERSITY-OS-MIGRATION-PLAN.md`,
`docs/MASTER-LAUNCH-READINESS-REGISTER.md` and
`SEMESTER_IMPLEMENTATION_STATUS.md`, and the blueprint's decision rule ("do at
least two of…") is compatible with `DECISIONS.md` §1, which still holds.

## 9 · Delivery order, and the gates

**Stage A — authorization and audit foundation.** Landed: the vocabulary,
the evaluator, the refusal suite, the correlation id to the audit row, the
error envelope. Open: adopt `decide()` in the support read path, the
intelligence retrieval and the AGS passback (one route per change, each with
its reason code on the audit row); a break-glass workflow; the MFA step-up.

**Stage B — event and workflow foundation.** Landed: envelope, catalog,
outbox and receipts tables, drain and dedupe, four machines. Open: the
Postgres outbox store and its scheduled drain; the retention sweep
(`RETENTION.md`); the first producer (the gateway's `action.receipt` and
`action.uncertain`); screens that read `transition()`.

**Stage C — API and data-contract platform.** Open: a per-endpoint manifest;
the envelope in the edge functions; the contract registry screen;
consumer-driven contract tests; outbound webhooks with signing and replay
protection.

**Stage D — extensibility and observability at scale.** Open: extension
manifest and validator; correlation through jobs, AI and notifications;
audit-access auditing and integrity checks; the page-immediately alerts;
dashboards; data residency as configuration.

The specification's release gates apply to a sensitive capability, not to a
stage, and each is a checklist a pull request can be held to:

- **Zero-trust gate.** Server authorization via `decide()` or RLS; RLS,
  storage and search enforcement confirmed at the data layer; the decision
  written to an audit row with its reason code; revocation tested at the
  instant of expiry; a refusal test per rule.
- **Event/workflow gate.** The event type is in `EVENT_TYPES` with a version,
  classification and retention; the consumer is `processOnce`-shaped; the
  workflow's transitions are a `WorkflowDefinition` with an exhaustive test.
- **API/extensibility gate.** Scope, rate limit, audit, version, error
  envelope, deprecation path, tests. No customer code in a trusted runtime.
- **Observability/audit gate.** The correlation id reaches every audit row
  the journey writes; logs redacted; the alert names an owner and a runbook.
