# Semester platform ecosystem

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** One API contract is published (productivity v1) and its service is off unless a deployment enables it. There is no OAuth app model, no outbound webhook delivery, no SDK, no sandbox tenant for partners, no certification programme and no marketplace. The marketplace is **Not started** and the plan below recommends not starting it yet.

Semester becomes a platform when others can safely build on it. The order matters: **integrations first, extensions second, marketplace last.** Each step needs the previous one's trust machinery.

## What exists

| Piece | Where | State |
| --- | --- | --- |
| Gateway primitives (commands, idempotency, pagination, versioning) | `packages/platform/src/gateway/` | Built; thin adoption |
| Productivity API v1 | `docs/api/productivity.v1.openapi.json`; `app/server/productivity/`; `app/api/productivity/` | Built, tested, off by default |
| Institution gateway | `app/server/institution/`; `packages/institution` | Built; sandbox adapters; services answer 503 without sandbox |
| SCIM 2.0 | `scim*.ts` | Built, off |
| LTI 1.3 | `supabase/functions/lti/` | Built; 0 registrations |
| Inbound webhooks | `integration_webhook_events` | Built |
| Event outbox | `private.domain_outbox_events`, `domain_event_receipts`; `docs/platform/EVENTS-AND-OUTBOX.md` | Built; adoption ADR-0007 |
| Scopes | `lib/oauthscopes`, capability names | Partial |
| Examples | `examples/` (gateway-client, event-consumer, scim-provisioner, sis-adapter) | Built |
| Extension governance | `docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md`, ADR-0024, D-1236 | Designed |

## Principles

1. **A third party is a tenant-approved principal, not a user.** It has its own identity, scopes and audit trail. It never inherits a human's access.
2. **Least privilege by scope and class.** A scope names a domain, a verb and a maximum data class. T3 and above need a separate tenant approval.
3. **Every call is attributable, rate-limited, idempotent and revocable.**
4. **No app reads what its tenant did not approve; no app reads another tenant.**
5. **Versioned contracts with a deprecation clock** the partner can plan around.
6. **Nothing an app does bypasses the AI policy, consent or kill switches.**

## API gateway and versioning

| Element | Rule |
| --- | --- |
| Base path | `/v1/...`; breaking changes only in a new major; additive changes in place |
| Deprecation | A deprecated version stays for at least 12 months after notice; `Sunset` and `Deprecation` headers; incident notifications to registered contacts |
| Idempotency | `Idempotency-Key` required on writes; stored for 24 hours; same key plus same body returns the stored result |
| Pagination | Cursor-based; stable ordering; `next` token opaque |
| Errors | One envelope; `Refusal` codes from `packages/institution` (`tenant_mismatch`, `action_not_declared`, and so on) |
| Rate limits | Per principal and per tenant; headers show remaining; limits recorded in the contract |
| Tenancy | `RequestContext` is built only from a trusted identity plus an untrusted request; a client-supplied tenant mismatch is refused |
| Contract tests | Each published contract is held by a test (as `openapi.test.ts` does for productivity) |

Error envelope:

```json
{
  "error": {
    "code": "refusal.action_not_declared",
    "message": "This action is not declared for the principal's scopes.",
    "request_id": "req_…",
    "docs": "https://…/errors/action_not_declared",
    "retryable": false
  }
}
```

## Identity for apps: OAuth 2.0 and OIDC

Proposed, not built. An ADR is the next step (backlog D34-1).

| Flow | Use | Notes |
| --- | --- | --- |
| Authorization code with PKCE | A user authorises an app to act on their own data (student-directed) | Scopes limited to the user's own data and T0 to T2 |
| Client credentials | A tenant-installed service principal (integration, partner) | Scopes granted by the tenant admin; T3+ needs a second approver |
| OIDC (Semester as provider) | "Sign in with Semester" for approved partner apps | Minimal claims; pairwise subject identifiers |
| Service accounts | Institution integrations (SIS, LMS) | Key rotation; IP allow-list option; no human login |
| API keys | Read-only public data (T0) only | Never for student data |

## Scope catalogue (draft)

`domain:verb` naming, matching the existing capability strings. Maximum data class in the third column.

| Scope | Meaning | Max class | Default install approval |
| --- | --- | :-: | --- |
| `tasks:read`, `tasks:write` | Student's tasks | T2 | Student |
| `calendar:read`, `calendar:write` | Student's calendar | T2 | Student |
| `courses:read` | Course shells the principal is attached to | T1 | Tenant |
| `roster:read` | Course roster (names only) | T3 | Tenant + second approver |
| `grades:read`, `grades:write` | Grades | T3 | Tenant + registrar |
| `enrollment:read` | Enrolment status | T3 | Tenant + registrar |
| `records:read` | Academic record | T3 | Tenant + registrar + steward |
| `accommodations:read` | Accommodation passport | T4 | Prohibited by default |
| `finance:read` | Balances | T3-T4 | Tenant + bursar |
| `events:subscribe` | Webhook events for granted scopes | per scope | Same as source |
| `ai:invoke` | Call the AI gateway under tenant policy | T0-T2 | Tenant |
| `audit:read` | Tenant audit export | T3 | Tenant + steward |

## Webhooks and events

Outbound webhooks ride the event outbox. Envelope and delivery rules:

```json
{
  "id": "evt_…",
  "type": "enrollment.changed",
  "version": "1",
  "tenant": "<schools.id>",
  "occurred_at": "2026-10-05T14:00:00Z",
  "subject": {"kind": "enrollment", "id": "…"},
  "data": {"…": "only fields within the subscriber's granted scopes"},
  "authority": {"source": "institution|semester", "freshness": "2026-10-05T13:59:00Z"}
}
```

| Rule | Value |
| --- | --- |
| Signing | HMAC-SHA256 over the raw body with a per-endpoint secret; timestamp in the signature; 5-minute tolerance |
| Delivery | At-least-once; exponential backoff; dead-letter after the retry budget; replay by the subscriber's admin |
| Ordering | Per-subject ordering by sequence; no global ordering |
| Payload | Minimal; a subscriber without a scope never receives the field |
| Verification | The inbound side (`lib/integration/webhook-ingress`) is the reference implementation of signature checking |

## SDKs and developer portal

| Item | Plan |
| --- | --- |
| Languages | TypeScript first (the contract already is TypeScript), then Python, then Java (SIS vendors) |
| Generation | From the OpenAPI contracts; hand-written auth and retry layer |
| Docs | `docs/developers/` (governed pages with cards) rendered to a portal; every endpoint has a runnable example held by `examples/*.test` |
| Support | A developer channel with a named owner; response-time target set only after a staffed rota exists |
| Status | A public status page that is true (waits for D37) |

## Sandbox tenants

A partner builds against a tenant that cannot hurt anyone. The sandbox adapters in `app/server/institution/sandbox.ts` and `SEMESTER_SANDBOX_INSTITUTION=1` are the seed.

| Property | Requirement |
| --- | --- |
| Data | Synthetic only, labelled `SampleMark`; no real person ever |
| Isolation | Separate tenant id prefix; separate keys; cannot be promoted to production |
| Reset | One call restores the seed |
| Fidelity | Same contracts, same refusals, same rate limits |
| Fault injection | Stale source, 503, slow, duplicate event, partial failure |
| Expiry | Sandbox tenants expire; keys revoked on expiry |

## Integration certification

Levels, from lowest to highest. Nothing is certified today.

| Level | Meaning | Evidence |
| --- | --- | --- |
| Registered | A partner exists with a publisher identity | Identity verification; contact; incident contact |
| Sandbox-tested | Passes the contract suite in a sandbox tenant | Suite run record |
| Reviewed | Security and privacy review complete for its scopes | Review record; data-flow map; subprocessors disclosed |
| Certified | Passes load, failure and revocation tests; named support owner; offboarding and export documented | Certification record; renewal date |
| Preferred | Reference customers with consent | Customer attestation |

## Extension framework

Extensions run **outside** the Semester process, behind the API, with the principal model above. In-process or in-browser extensions are not offered: `docs/DO-NOT-BUILD.md` forbids custom UI primitives and an untrusted browser extension would break F-02. UI surfaces for apps are launched (LTI-like) in a sandboxed frame with a restricted CSP and a postMessage contract. **Not built.**

Tenant install controls: an admin sees the permission request in plain language, approves per scope, per audience (cohorts, roles), and can revoke with immediate effect; a revoked app's tokens fail and its webhooks stop.

## Marketplace (deferred)

Categories in the brief: learning tools, accessibility tools, tutoring, career, library and research, campus services, advising, financial wellness, scheduling, organisations, institutional analytics, AI models/providers, publisher/courseware, identity/integration tools, developer extensions.

**Recommendation: do not build.** ADR-0024 and D-1236 gate it with four conditions (G-OWN, G-DATA, G-TERMS, G-QUEUE), the take rate conflicts (12% vs 15%), and the product has no certified integration. A marketplace needs, at minimum: publisher identity, security review, privacy review, data scopes, tenant install approval, permission request, version history, support owner, pricing model, incident contact and an offboarding and export process. Build order: certified integrations (three), then a **curated directory** with no payments, then payments and revenue share, then self-serve publishing.

| Stage | Condition to start |
| --- | --- |
| Directory | Three certified integrations; counsel-approved partner terms |
| Payments and revenue share | Directory live; finance owner; tax review; take-rate decision |
| Self-serve publishing | A staffed review queue with a measured turnaround |

## Billing metering for the platform

Per-tenant meters already exist for AI (`private.ai_usage_*`). Platform metering adds: API calls by principal and scope, webhook deliveries, storage, and sandbox usage. Entitlements come from `plan_entitlements` and `subscription_entitlements`; enforcement uses `ALWAYS_ENTITLED` for the free path. **Pricing for platform use is undecided.**

## Programme and risk

| Item | Plan |
| --- | --- |
| First three partners | Integrations that a design partner already needs (SIS roster, LMS, identity), not marketplace apps |
| Incident notification | A contact per partner; the platform incident plan covers partner outages and partner-caused incidents |
| Deprecation | 12-month minimum; change log; partner contact list |
| Abuse | Rate limits, anomaly alerts, revocation by tenant admin and by Semester operators |
| Legal | Partner terms and a data-processing addendum (counsel); no revenue share until D-1236 gates close |

See the backlog (D34 and X-15) and the 12-month plan (months 7 to 12) for sequencing.
