# LMS Interoperability Matrix

<!-- Rendered from app/src/lib/integration/lmsmatrix.ts by lmsmatrix.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Canvas, Blackboard Learn, Moodle and D2L Brightspace compared across LTI 1.3,
gradebook exchange, API extensibility, rate limits, pagination and events, and
what Semester’s own integration layer promises against each — from five
documents of 28 September 2026, held to what the tree already has. The
[LTI runbook](LTI-1.3-LAUNCH-RUNBOOK.md) is how a launch works today; the
[operator runbook](INTEGRATION-OPERATOR-RUNBOOK.md) is how a connection is run;
[GRADESCOPE-TURNITIN.md](../GRADESCOPE-TURNITIN.md) settled why Semester cannot
submit into Gradescope.

**Standards first, discovery second, proprietary APIs third. Launch with LTI 1.3; use NRPS and AGS only when they appear in the verified launch; use REST or Web Services only for a documented, approved need; reconcile every synchronization that matters.** Never infer a capability from a vendor name: test in the customer sandbox.

| Supplied document | What it holds |
| --- | --- |
| [EdTech stack audit: compare Canvas, Blackboard, Moodle, and D2L Brightspace across LTI 1.3 standards, AI grading, and API extensibility](expansion/EdTech-Stack-Audit-LTI-AI-Grading-and-API-Extensibility.pdf) | The five-dimension landscape table, the source-grounded work-completion chain, the source-aware grading workflow and the QTI 3 interaction library. |
| [Canvas vs Blackboard vs Moodle vs D2L: a sortable LTI 1.3, AI grading, and API extensibility matrix for enterprise EdTech stacks](expansion/LMS-Sortable-Matrix-and-AI-Grading-Comparison.pdf) | The weighted scorecard and its pass/fail gates, the API extensibility matrix, the Gradescope/Turnitin/Copyleaks comparison and the Semester API target. |
| [Sortable LMS API comparison: Canvas vs Blackboard vs Moodle vs D2L Brightspace — rate limits, OAuth scopes, and LTI 1.3 endpoints](expansion/LMS-API-Comparison-Rate-Limits-Scopes-and-LTI-Endpoints.pdf) | The rate-limit comparison with confidence, the adaptive client behaviour, the full LTI 1.3 matrix, the endpoint discovery record and the QTI 3 migration phases. |
| [Canvas vs Blackboard vs Moodle vs D2L Brightspace API limits, OAuth scopes, and LTI 1.3 endpoints compared in one interactive dashboard](expansion/LMS-Developer-Migration-Guide-and-One-System.pdf) | The full comparison, the per-tenant registration object, the Canvas LTI Advantage scopes, the secure token flow — and the one-system platform grammar, which has its own page. |
| [Sortable LTI 1.3 dashboard: Canvas vs Blackboard vs Moodle vs D2L Brightspace API limits, OAuth scopes, and AGS/NRPS endpoints compared](expansion/LMS-Migration-Runbook-Blackboard-Moodle-and-Shared-Object-Model.pdf) | The Blackboard and Moodle checklists and risk controls, the plugin risk review, the pagination rules, the discovery test — and the shared object model, which the one-system page carries. |

## The comparison

All four platforms can take an LTI 1.3 launch. Registration, the Advantage
services a tenant has enabled, administrative permissions, throttling and
event delivery differ per tenant, not per vendor, so every column below is a
claim about a vendor’s published mechanism and never about a customer’s tenant.

| Dimension | Canvas | Blackboard Learn | Moodle | D2L Brightspace | Semester standard |
| --- | --- | --- | --- | --- | --- |
| **Primary integration baseline** | LTI 1.3/LTI Advantage plus REST APIs; Developer Keys and LTI registration, JSON or hosted-JSON config | LTI 1.3/LTI Advantage plus REST APIs; availability documented for supported Learn SaaS and eligible hosted versions | LTI 1.3, Web Services, plugins, custom APIs; strongly version- and admin-dependent | LTI 1.3/LTI Advantage Complete (Core, AGS v2, Deep Linking v2, NRPS v2) plus the Brightspace Developer Platform | LTI 1.3/LTI Advantage first; proprietary APIs only when a customer-approved need requires them. |
| **LTI registration** | Admin-managed Developer Key and deployment; static or hosted JSON supported | Admin registers the tool, approves it, configures user fields and grade access | Site-admin configuration; behaviour depends on version and plugins | Tenant-admin registration and permitted services | A secure per-tenant registration record and an onboarding checklist; never reuse a deployment across tenants. |
| **OIDC login initiation and JWT launch** | Tool configuration provides login-initiation and target-link setup; platform JWKS and claims validation | Tenant/admin configuration required; platform JWKS and claims validation | OAuth 2.0 / OpenID Connect security model; platform JWKS and claims validation | Tenant/admin configuration required; platform JWKS and claims validation | Validate state, nonce, issuer, audience, expiry, deployment id and redirect URI on every launch, from the signed claims and never from an expected URL shape. |
| **Deployment isolation** | Deployment ids distinguish installations of a developer key | Deployment id captured after registration | Deployment and configuration vary by instance | Deployment and configuration vary by tenant | Bind every launch, access token, roster and grade operation to tenant + deployment + course context. |
| **JWKS and key model** | Tool public JWK statically configured or served at a URL Canvas can fetch | Platform/tool JWKS configuration varies by deployment | Instance/tool configuration varies | Tenant/tool configuration varies | Support rotation; pin issuer and domain; log the kid; cache JWKS by issuer and kid; dual-key overlap, expiry alerts and a rotation runbook. |
| **NRPS roster service** | Supported with the explicit contextmembership.readonly scope | Availability depends on admin setup and Learn deployment | Version/configuration dependent | NRPS v2 in LTI Advantage Complete | Optional. Request the minimum roster and role fields; read the endpoint from the verified launch claim; support a no-roster fallback. |
| **AGS line items, scores and results** | Supported with enabled Developer-Key scopes for line items, scores and results | Requires explicit grade-service access configuration by the admin | Version/configuration dependent | AGS v2 in LTI Advantage Complete; service availability must be tested per tenant | Required if Semester writes back grades. Every grade write is explicit, previewable, idempotent, audited and reconciled; the line-items endpoint comes from the claim. |
| **Deep Linking** | Supported through configured tool capability and placements | Admin and tool placement dependent | Version/configuration dependent | Deep Linking v2 in LTI Advantage Complete | Optional but preferred; feature-detect it and always offer a manual content workflow. |
| **REST/API authentication** | Developer Key plus OAuth/API token model; scoped keys | OAuth 2.0 application registration; API enabled per Learn instance | Admin-enabled Web Services and tokens; OAuth 2 configuration for external systems; plugin/hosting model varies | Application/API credentials and REST-like APIs | OAuth 2/OIDC, scoped credentials, secret rotation, tenant isolation. |
| **API documentation and customization model** | Mature developer documentation; hosted SaaS with supported API/LTI extensions | Validate current developer documentation by deployment; enterprise configuration and integration | Extensive community documentation; highest code-level flexibility but highest governance and upgrade burden | REST-like API reference and developer platform; enterprise API and partner ecosystem | Public OpenAPI contracts, SDKs, change log, rate limits, webhook docs, a synthetic sandbox; composable tenant-configurable modules without customer code execution. |
| **Rate limits** | Dynamic throttling: each request has a cost against a replenishing quota; throttled calls return HTTP 429 | No consistently disclosed production limit; an older 10,000-requests-per-day figure was a technical-preview setting and is not a benchmark | No universal quota; instance, host, reverse proxy, plugins and custom controls decide | Token-bucket credits with variable per-call cost; a published 50,000-credit-per-minute bucket; headers give remaining budget, cost, reset and Retry-After | Adaptive per-tenant queue with backoff and jitter, circuit breaking and durable reconciliation; never hardcode a vendor-wide requests-per-minute. |
| **Pagination and incremental sync** | Endpoint-specific Link headers and per-page parameters; API/event strategy varies by resource | Endpoint/version-specific paging parameters; validate modified-since support per endpoint | Web-service-function-specific limitfrom/limitnum or custom patterns; often needs a timestamp or report approach | Endpoint-specific page/bookmark/query model; validate filters and change feeds | A connector-specific paginator with checkpointing; a stored watermark plus an overlap window; resumable jobs with idempotent item processing. |
| **Events and webhooks** | Validate the platform event model per tenant | Validate event/subscription capability per Learn deployment | Plugins and custom hosting decide; native behaviour varies | Validate event/subscription mechanisms per tenant | An at-least-once internal event model, signed outbound webhooks with delivery logs, retries, replay protection and versions; downstream events are hints and reconciliation is mandatory. |
| **AI-assisted grading posture** | Institution, licence and tool dependent | Institution, licence and tool dependent | Plugin/provider dependent; institution selects governance | Institution, licence and tool dependent | AI suggests evidence, rubric alignment and feedback drafts; an authorized human owns every consequential grade. |
| **Assessment portability** | Imports and integrations vary | Standards and vendor import tools vary | Strong community formats and plugins; portability depends on content type | Enterprise content and integration tooling | QTI 3 import/export, assessment versioning, item-bank provenance, accessibility metadata, results portability. |
| **Biggest integration risk** | Incorrect Developer Key scopes and differing tenant permissions | Hosting, version and admin configuration variance | Plugin, version, hosting and security-governance variance | Tenant entitlement, configuration and variable request cost | Never infer capability from a vendor name; test in the customer sandbox and keep a capability-discovery checklist per integration. |
| **Best Semester approach** | LTI first; the Canvas API only for a documented, customer-approved gap | Capability discovery first, then LTI or API as approved; treat each tenant as a separate discovery | Favour LTI and standard Web Services; avoid dependence on custom plugins | LTI first; Developer Platform APIs for explicit approved flows | Publish supported capability tiers and per-LMS integration test results. |

## The scorecard

Score a platform, or Semester, with evidence rather than vendor claims. The
gates come first: any one failing stops the comparison before a total.

- LTI 1.3/OIDC validation works.
- Roles and tenant/course context are correct.
- Grade writes are previewable and auditable.
- Student data does not cross tenants.
- The critical accessibility workflow passes.
- AI-assisted grading retains authorized human accountability.

| Dimension | What to test | Evidence required | Weight |
| --- | --- | --- | ---: |
| LTI 1.3 / Advantage | OIDC launch, JWKS rotation, Deep Linking, NRPS roster access, AGS line items and results, deployment isolation | Sandbox test, scopes list, launch logs, grade-write reconciliation | 20% |
| API breadth | Courses, enrollments, users, content, assignments, submissions, grades, analytics, files, calendar, roles | OpenAPI/reference docs, rate limits, pagination, version and deprecation policy | 15% |
| API quality | OAuth/OIDC, scoped permissions, webhooks, idempotency, retries, sandbox, auditability | Security docs, developer portal, test tenant | 15% |
| Assessment portability | QTI import/export, item banks, outcomes, rubrics, test settings, results | Round-trip QTI test and item behaviour validation | 10% |
| Grade integration | Create and update line items, post results, read released grades, retry and reconcile writes | AGS test, error queue, audit record | 15% |
| AI grading governance | Human review, rubric evidence, source and citation trace, bias and accessibility testing, appeal process | Product workflow demo and policy artifacts | 15% |
| Security and operations | Tenant isolation, MFA, audit logs, DPA, retention, uptime, support, incident response | Security package, contract terms, architecture review | 10% |

| Score | Meaning |
| ---: | --- |
| 0 | Missing, unsupported, or the vendor will not evidence it |
| 1 | Exists only through custom workarounds or limited plugin support |
| 2 | Available but difficult to configure, poorly documented, or weakly governed |
| 3 | Supported, documented, configurable, and tested in your tenant |
| 4 | Mature, scoped, observable, versioned, sandboxed, and independently evidenced |

Weighted total = Σ (score × weight) ÷ (4 × Σ weight), as a percentage;
`weightedScore` in the module calculates it and refuses a missing or
out-of-range score.

## Rate limits

A fixed, comparable requests-per-minute number is not publicly established
across the four platforms. Canvas and Brightspace publish a mechanism;
Blackboard and Moodle are deployment- and configuration-dependent, so their
limits are confirmed in the customer’s tenant and contract.

| LMS | Auth model | Published behaviour | Design implication | Confidence |
| --- | --- | --- | --- | --- |
| Canvas | Developer Keys and scoped API/LTI configuration; OAuth-based API access | Dynamic throttling: calls have a cost against a replenishing quota; throttled calls return HTTP 429 | Read quota and throttling headers, constrain concurrent calls, jittered exponential backoff, persisted idempotency keys, reconcile state | high: High for the mechanism; the actual capacity varies by tenant |
| Blackboard Learn | OAuth 2.0 key/secret and application registration; API enabled per Learn instance | No consistently disclosed production limit; the older 10,000-requests-per-24-hours figure was explicitly a technical-preview setting | Confirm deployment, version, endpoint access, quota, token behaviour and event options during tenant discovery; generic 429 and circuit-breaker handling | medium: Medium to low until the customer confirms |
| Moodle | Admin-enabled Web Services and tokens; OAuth 2 for external systems; plugin and hosting model varies | No universal quota across deployments; institution, host, reverse proxy, plugins and custom controls decide | Treat each instance as unique; negotiate and load-test approved quotas; incremental sync, pagination, checkpointing, reconciliation | low: Low as a universal number; high that the variance is real |
| D2L Brightspace | Brightspace Developer Platform, REST-like API and application credentials | Token-bucket credits; a published 50,000-credits-per-minute bucket with variable, dynamically adjustable call cost; headers carry remaining budget, cost, reset and Retry-After | Adapt worker concurrency to the headers; cache reads; batch where supported; honour Retry-After; idempotent grade writes | high: High for the mechanism; the per-tenant operational policy still needs verifying |

### The client, whichever platform

- Read response headers on every API call.
- Track quota or credits by tenant, credential, endpoint family and worker.
- Use bounded concurrency rather than a fixed global parallelism level.
- Retry only transient failures: 429, 408, selected 5xx and network errors.
- Honour Retry-After where present.
- Use exponential backoff with jitter.
- Use idempotency keys for writes where supported; otherwise a local write ledger.
- Pause or circuit-break on sustained failures.
- Use durable queues and a dead-letter queue.
- Run scheduled reconciliation, because API and webhook delivery can be incomplete or delayed.
- Expose sync lag, failed records, retry state and repair actions in the Operations Console.

### The delivery contract

Do not design grade or roster sync around an assumption that an external LMS
webhook is exactly-once or ordered. Internally, the integration assumes:

- At-least-once delivery.
- Events may be duplicated.
- Events may arrive out of order.
- Events may be delayed.
- Some events may be absent.
- Destination state may change outside the integration.

### Pagination

A connector never depends on page count alone.

1. Request the maximum documented safe page size only after tenant testing.
2. Persist the cursor, bookmark, Link-header URL, offset or page token.
3. Store a checkpoint after every successful page.
4. Deduplicate records by stable external id plus source version or updated time.
5. Use an overlap window for modified-since queries to catch clock skew and delayed indexing.
6. Use idempotent upserts rather than inserts.
7. Stop on 429, apply Retry-After or backoff, and resume from the checkpoint.
8. Place malformed or unreadable records in an exception queue; do not kill the full sync.
9. Run periodic full or scoped reconciliation.
10. Track count, lag, error rate, throughput, throttle events and the last good checkpoint.

## LTI 1.3: endpoints, scopes and the registration record

LTI 1.3 uses the same kinds of endpoint on every platform, but the URLs, the
enabled services, the claims released, the registration process and the
permissions differ per tenant. Launches are validated from the signed claims,
never from an expected URL shape, and no vendor endpoint pattern is hardcoded.

### The Canvas LTI Advantage scopes

Canvas has two authorization concepts that are not mixed: REST API scopes tied
to a Developer Key, and LTI Advantage service scopes used through a
JWT-authenticated client-credentials token for the endpoints released in the
launch. The key module (`supabase/functions/_shared/ltikey.ts`) defines the
four AGS scopes and deliberately excludes the roster scope; the test holds this
table to it.

| Semester use case | Canvas LTI scope | Use only when |
| --- | --- | --- |
| Read course roster and roles | `https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly` | Only if roster or role synchronization is necessary |
| Create, read, update and delete gradebook line items | `https://purl.imsglobal.org/spec/lti-ags/scope/lineitem` | Only for assessments that need Semester-managed grade columns |
| Read a specific line item | `https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly` | Prefer this where write access is not needed |
| Post scores | `https://purl.imsglobal.org/spec/lti-ags/scope/score` | Only if an authorized human or institution workflow writes grades |
| Read results | `https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly` | Only if Semester must reconcile released grades or results |
| Read Canvas page content through postMessage | `https://canvas.instructure.com/lti/page_content/show` | Only for the explicit page-content feature |

Administrators, not instructors, hold `manage_lti_add`, `manage_developer_keys`, `manage_grades`; Semester never assumes an instructor can install or authorize an enterprise integration.

### The token flow

1. Semester receives the LTI 1.3 launch.
2. Validates the JWT signature and the core claims.
3. Identifies the tenant and the deployment.
4. Reads the allowed service endpoints and scopes from the verified claims.
5. Signs a client-credentials token request with the tenant-specific RSA private key.
6. Requests only the required scopes.
7. Receives a short-lived access token.
8. Calls only the released endpoints for that course or resource context.
9. Writes an audit event.
10. Caches the token only until expiry, encrypted and tenant-scoped, and retries safely under rate-limit controls.

### The registration record, against `lti_platform`

The documents ask for a separate encrypted registration object per customer with twenty-four fields. 8 have a column on `public.lti_platform`; the test reads the migrations and holds each one to a column that exists. The AGS and Deep Linking endpoints arrive in the launch claim and are never stored on the platform row, which is the documents’ own rule, so their absence is a design and not a gap. The rest is the gap.

| Field | Column | Note |
| --- | --- | --- |
| `tenant_id` | `tenant_id` | The Semester school the deployment belongs to; removing the school sets it null rather than deleting the registration. |
| `lms_provider` | — | Indirect: the connection row (`connection_id`) names the provider; nothing on the platform row does. |
| `lms_version` | — | Not recorded. |
| `environment (sandbox / production)` | — | Only the tenant feature state — off, preview, sandbox, production — in ltientitlement.ts; not per registration. |
| `issuer` | `issuer` | Part of the primary key; exact-match, never brand-level. |
| `client_id` | `client_id` | Part of the primary key. |
| `deployment_id` | `deployment_id` | Part of the primary key; a deployment is never reused across tenants because the key is (issuer, client, deployment). |
| `oidc_login_initiation_url` | `auth_login_url` | Where the OIDC authentication request goes; `https` by check constraint. |
| `authorization_url` | `auth_login_url` | The same column: the platform’s authorization endpoint is where the login initiation redirects. |
| `jwks_url` | `jwks_url` | `https` by check constraint; the function verifies every launch against it. |
| `access_token_url` | `token_url` | Nullable; `https` by check; needed only to call back for AGS. |
| `redirect_uris` | — | The launch target is checked against the tool’s own origin (`foreign-target`), not an allowlist per registration. |
| `deep_linking_endpoint` | — | By design, per launch: read from the Deep Linking settings claim (`ltideeplink.ts` readSettings). |
| `nrps_context_memberships_url` | — | NRPS is not requested (`ltikey.ts` excludes contextmembership on purpose); nothing to store. |
| `ags_lineitems_url` | — | By design, per launch and per user: `lti_line_item.lineitems_url`, read from the AGS claim. |
| `ags_results_url` | — | Results are never read back (`SCOPE.result` is defined and unused); nothing to store. |
| `ags_scores_url` | — | Derived from `lti_line_item.lineitem_url` by `scoresUrl()` at post time. |
| `enabled_scopes` | — | Per user in `lti_line_item.scopes`, as the claim released them; not per registration. |
| `enabled_message_types` | — | Resource-link and Deep Linking requests are both accepted; nothing records which a tenant enabled. |
| `claims_released` | — | The minimum claims are in the runbook; the platform row does not record what a tenant releases. |
| `key_rotation_method` | — | The tool serves one key with an hour’s cache; no rotation, overlap or expiry alert. |
| `admin_owner` | — | Indirect: `integration_connections.owner_account_id` and `approved_by` on the connection. |
| `last_validated_at` | — | The connection has `last_successful_sync_at`; no launch validation date. |
| `fallback_mode` | — | Not recorded; the runbook’s answers (`unbound`, `no-registration` …) are the fallback behaviour. |

## Where Semester stands

Each step at what the tree has. A status is a claim about the best piece of a
step: `tested` cites a test that runs on every change, `building` code,
`designed` a document, `not-started` at most a document naming the gap. Two
facts frame the processor: there is no inbound webhook endpoint, so sync is
pull-based on a fifteen-minute tick; and the adapter registry is empty, so
nothing syncs yet. What exists is the pipeline the tick would run.

### The event processor

The eleven steps the documents ask of every integration processor.

| ID | Step | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| P01 | Verify the webhook signature and timestamp when available. | designed | `docs/ZERO-TRUST-EVENT-API-OBSERVABILITY-ROADMAP.md`: inbound webhooks, their signature and replay verification are open items<br>`app/src/lib/blueprint.ts`: INT-013: no inbound webhook endpoint, so no signature, timestamp or replay verification | No inbound endpoint. Signatures are verified only on LTI id_tokens and SCIM bearer credentials. |
| P02 | Store the raw event metadata and a correlation id. | building | `supabase/migrations/20260927170000_integration_control_plane.sql`: `integration_webhook_events` keeps a payload hash and an optional payload reference, never the payload<br>`app/server/integration/worker.ts`: stores the hash of what it received | No correlation id on the events table; correlation ids exist on the gateway and the domain outbox only. |
| P03 | Deduplicate with the event id or an idempotency key. | tested | `supabase/migrations/20260927170000_integration_control_plane.sql`: a unique index on (connection_id, idempotency_key) plus provider_event_id<br>`app/src/lib/integration/pipeline.ts`: claimIdempotencyKey before processing<br>`app/server/integration/worker.test.ts`: a duplicate insert is treated as a duplicate, not an error | None for the pipeline; nothing feeds it yet. |
| P04 | Place the event on a durable queue. | building | `supabase/scheduler.sql`: the fifteen-minute `integration-sync` cron calls integration-tick<br>`packages/institution/src/events.ts`: the domain outbox and drainOutbox exist, with a unique idempotency index<br>`docs/architecture/0008-event-envelope-and-outbox.md`: the at-least-once envelope | No inbound queue: sync is pull-based; the outbox drainer has no caller. |
| P05 | Process with tenant, deployment and course context. | tested | `app/server/integration/worker.ts`: tenant_id comes from the connection row, never from the provider<br>`app/server/integration/worker.test.ts`: the worker refuses a record whose tenant is not the connection’s | Tenant only: no deployment or course context on an event. |
| P06 | Use optimistic concurrency or version checks where supported. | tested | `app/src/lib/integration/pipeline.ts`: a record older than the stored copy is refused as timestamp_regression<br>`app/src/lib/integration/pipeline.test.ts`: the regression check<br>`app/src/lib/integration/reconcile.ts`: compares a version or etag when the provider gives one<br>`app/server/institution/gateway.ts`: commit re-checks the record version | No If-Match or ETag on writes. |
| P07 | Retry transient failures with exponential backoff and jitter. | tested | `app/src/lib/integration/retry.ts`: backoffMs with full jitter; five attempts, two-second base, fifteen-minute cap<br>`app/src/lib/integration/pipeline.test.ts`: the backoff schedule | None. |
| P08 | Respect 429 and Retry-After. | building | `app/src/lib/integration/retry.ts`: afterFailure takes the longer of the backoff and a Retry-After<br>`app/src/lib/integration/pipeline.test.ts`: Retry-After wins when longer<br>`app/server/integration/worker.ts`: calls afterFailure without a Retry-After | Nothing parses the header from a provider response; the worker never passes one. |
| P09 | Put permanent failures in an operator-visible dead-letter queue. | tested | `supabase/migrations/20260927170000_integration_control_plane.sql`: `integration_dead_letter_events`<br>`app/server/integration/worker.ts`: inserts a dead letter after the last attempt<br>`app/server/integration/tick.ts`: runs operator-requested replays and holds a connection with an open dead letter<br>`app/server/integration/tick.test.ts`: a held connection is not synced | None. |
| P10 | Reconcile source-of-truth state on a schedule. | building | `app/src/lib/integration/reconcile.ts`: reconcilePlan and reconcile, with discrepancies typed<br>`supabase/migrations/20260928040000_integration_quality.sql`: `integration_reconciliation_runs` and `_discrepancies`<br>`docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md`: the reconciliation rule | No scheduler or caller invokes it; the tick does not. |
| P11 | Show a customer-visible health dashboard: last success, lag, failed records, retry state, repair actions. | tested | `app/src/components/institutional/IntegrationDashboard.tsx`: last successful sync, freshness, open errors, sync history with retry counts, dead letters, conflicts, pause and replay<br>`app/src/components/institutional/IntegrationDashboard.test.tsx`: every domain with status and health; pausing needs a reason<br>`docs/INTEGRATION-OPERATOR-RUNBOOK.md`: watch, pause, resume, replay | No numeric lag metric and no per-record repair; freshness stands in for lag. |
| **total** | | not-started 0, designed 1, building 4, tested 6 | | |

### The adaptive client

The behaviours every connector has, whichever platform it talks to.

| ID | Step | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| C01 | Read rate-limit headers on every API call. | not-started | `docs/ZERO-TRUST-EVENT-API-OBSERVABILITY-ROADMAP.md`: rate-limit handling is an open item | No code reads an X-Rate-Limit-*, RateLimit-* or Retry-After header, including the Canvas token proxy. |
| C02 | Track quota by tenant, credential, endpoint family and worker. | building | `app/src/lib/integration/retry.ts`: a RateLimiter token bucket keyed by tenant and connection | Defined and unused; nothing calls it. |
| C03 | Bounded concurrency rather than a fixed global parallelism. | designed | `docs/operating-model/AI-ASSURANCE.md`: MR-28: rate limits and concurrency caps are tested for the gateway’s own callers, not for outbound calls<br>`app/src/lib/governance/ai-assurance.ts`: records that there is no concurrency cap | No concurrency control on any outbound call. |
| C04 | Retry only transient failures: 429, 408, selected 5xx, network errors. | tested | `app/src/lib/integration/retry.ts`: the retry policy<br>`app/src/lib/integration/pipeline.test.ts`: retries stop at the cap | The worker classifies every failure as provider_unavailable; it does not distinguish a 4xx it should not retry. |
| C05 | Idempotency keys for writes, or a local write ledger. | building | `app/server/institution/journal.ts`: the gateway action journal<br>`packages/institution/src/events.ts`: outbox idempotency keys<br>`supabase/functions/_shared/escalation.ts`: a delivery id per outbound webhook | None of it covers an LMS write; the AGS score post has no key and no ledger. |
| C06 | Pause or circuit-break on sustained failures. | designed | `docs/STRATEGIC-EXPANSION-REGISTER.md`: VND-009: circuit breakers, named as a mitigation and not built<br>`app/src/lib/governance/rollout.ts`: the breaker named as a mitigation | Manual pause and the kill switches only. |
| C07 | Durable queues and a dead-letter queue. | tested | `supabase/migrations/20260927170000_integration_control_plane.sql`: `integration_dead_letter_events`<br>`app/server/integration/worker.test.ts`: the last attempt dead-letters | No inbound queue, as P04. |
| C08 | Scheduled reconciliation. | building | `app/src/lib/integration/reconcile.ts`: built and typed | Never scheduled, as P10. |
| C09 | Sync lag, failed records, retry state and repair actions in the Operations Console. | building | `app/src/lib/integration/dashboard.ts`: the school-staff dashboard model<br>`app/src/lib/ops/console.ts`: the console’s integration control is approvals only | The staff dashboard has it; the operations console has no health view. |
| **total** | | not-started 1, designed 2, building 4, tested 2 | | |

### The grade write

Preview → confirmation → idempotent delivery → acknowledgment → reconciliation → exception queue → audit, at what the AGS score post has today.

| ID | Step | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| W01 | Preview: what will be written, where, under whose authority. | designed | `docs/LTI-1.3-LAUNCH-RUNBOOK.md`: the passback section: the score is sent when a quiz ends<br>`app/server/institution/gateway.ts`: the prepare → commit pattern exists for institutional actions, not for AGS | The Drill screen posts the score as the quiz ends; nothing is previewed. |
| W02 | Human or institution confirmation. | tested | `supabase/migrations/20260927180000_lti_integration_binding.sql`: `lti_passback_decision`: kill switches, the writeback flag, an approved write connection and the score_publish scope<br>`app/src/lib/ltigate.test.ts`: every refusal reason of the gate<br>`supabase/lti-integration.check.sql`: the gate walked in SQL | Institutional, once, per connection; no per-write confirmation. |
| W03 | Idempotent delivery. | not-started | `docs/LTI-1.3-LAUNCH-RUNBOOK.md`: one POST, no retry | No idempotency key, no write ledger, no retry. |
| W04 | Destination acknowledgment. | building | `app/src/lib/ltiscore.ts`: the synchronous reply and the line the Drill screen shows | A synchronous `reported: true` only; nothing durable. |
| W05 | Reconciliation against released results. | not-started | `docs/LTI-1.3-LAUNCH-RUNBOOK.md`: results are never read back | `SCOPE.result` is defined and never requested. |
| W06 | An exception queue for failed writes. | not-started | `docs/LTI-1.3-LAUNCH-RUNBOOK.md`: the gaps section: refusals are logged, not persisted | Refusals go to the function log only. |
| W07 | An immutable audit event. | building | `packages/institution/src/policy.ts`: the action grade.passback.submit with audit event grade.passback_requested<br>`packages/institution/src/events.ts`: grade.passback_requested and grade.passback_reconciled in EVENT_TYPES | Declared; no producer emits either event. |
| **total** | | not-started 3, designed 1, building 2, tested 1 | | |

### The sandbox test before any production connector

**Authentication.**
- Obtain and refresh a token.
- Test token expiry and key rotation.
- Remove a permission and verify the failure is clear.

**Pagination.**
- Pull several pages of courses, enrollments and content.
- Restart midway and resume from the stored checkpoint.
- Verify no skipped or duplicated records after concurrent source changes.

**Throttle.**
- Run a bounded controlled burst.
- Record 429/503 behaviour, rate-limit headers, Retry-After, the error body and recovery.
- Set a safe concurrency and a sustained-call budget.

**Write.**
- Create a non-production artifact or grade line item if permitted.
- Repeat the same request with the idempotency record.
- Verify no duplicate write.
- Test revoke, rollback and reconciliation behaviour.

**Reconciliation.**
- Introduce an intentional source-side change without an event.
- Confirm scheduled reconciliation catches and repairs the difference.

Success means:

- No duplicate grade posted.
- No missed final state after reconciliation.
- No cross-tenant record access.
- No unbounded retry storm.
- Every failed grade sync has a visible exception and an operator action.

## Blackboard and Moodle: the cautious two

Both can support LTI 1.3, but their API behaviour, enabled services, identity
configuration, paging, quotas and hosting vary more than Canvas or Brightspace.
Each is onboarded as a capability-discovery integration:

Register → Validate the LTI launch → Discover released services and scopes → Test pagination and rate behaviour → Enable only needed data flows → Establish reconciliation → Monitor health → Revalidate after a vendor, version or hosting change

### Blackboard Learn

- Confirm the Learn deployment type: SaaS, managed hosting or self-hosted.
- Confirm the exact Learn release and version.
- Register Semester as an LTI 1.3 tool.
- Obtain and store the issuer, client id, deployment id, OIDC initiation endpoint, authorization endpoint, JWKS endpoint, OAuth access-token endpoint and the redirect URI allowlist.
- Confirm which Advantage services are enabled: Deep Linking, NRPS, AGS.
- Confirm the identity fields released in the launch: subject, name, email, roles, institution and person identifiers, custom claims.
- Confirm grade-service permissions: create line item, read line item, post score, read results, view grade status in the student view.
- Confirm role mapping: instructor, teaching assistant, student, observer, administrator, custom institutional roles.
- Confirm data-retention and logging expectations.

Use the REST APIs only when LTI does not cover the need.

| Need | Prefer | REST API only when |
| --- | --- | --- |
| Launch Semester in a course | LTI 1.3 Core | Not applicable |
| Identify the current course context and role | LTI launch claims | Additional system context is essential |
| Read the roster | NRPS | NRPS is unavailable or insufficient and the customer approves the REST scope |
| Create a content link | Deep Linking | The customer requires a specific managed-placement workflow |
| Post an assessment score | AGS | The institution requires a Blackboard-specific official-grade workflow |
| Read course content | LTI context and approved sources | Semester needs specific customer-approved content synchronization |
| Read grades | AGS results | The institution explicitly authorizes a Blackboard gradebook integration |
| Provision and deprovision accounts | SCIM or the identity provider | The Blackboard API is a defined, customer-approved lifecycle source |

Never:

- Assume API parity across SaaS and non-SaaS deployments.
- Assume every LTI Advantage service is enabled.
- Treat Blackboard REST access as a substitute for proper LTI context.
- Use instructor credentials for server-to-server integration.
- Bulk-pull student content or grade data without purpose limitation.
- Rely on undocumented request limits or event behaviour.
- Write grades without a preview, an idempotency record, a sync status and a reconciliation process.

### Moodle

- Confirm the Moodle version and its support lifecycle.
- Confirm hosting: MoodleCloud, managed hosting, institutional self-hosting, consortium or shared service, or a customized deployment.
- Confirm whether Semester is configured as an external tool, an LTI consumer, an LTI provider, or both.
- Obtain and store the issuer, client id, deployment id, OIDC initiation endpoint, authorization endpoint, JWKS endpoint, access-token endpoint and the redirect URI allowlist.
- Confirm the LTI Advantage services enabled: NRPS, AGS, Deep Linking.
- Confirm course, user, role and identity claims.
- Confirm the allowed external web-service functions.
- Confirm the authentication model: service token, OAuth 2, plugin-managed flow, user-bound token, or another approved institutional method.
- Confirm the plugin inventory and customizations affecting roles, enrollments, gradebook, events, content, files, privacy, retention and API behaviour.
- Confirm test or staging site availability.

Web Services principles:

- Use a dedicated integration service account.
- Grant only the specific external-service functions needed.
- Restrict the service account to the smallest role and context possible.
- Separate sandbox credentials from production credentials.
- Rotate tokens and credentials.
- Disable unused services and protocols.
- Log function calls and export activity.
- Use version-compatible functions and test after Moodle and plugin upgrades.
- Avoid a custom plugin dependency unless the customer can own its lifecycle.

A plugin can become a hidden integration liability. Before depending on one,
review:

- Maintainer and update cadence
- Security advisories and CVE response
- Supported Moodle versions
- Data processing and subprocessors
- Role and capability changes
- Database schema impact
- Performance impact
- Privacy API support
- Backup and restore behaviour
- Accessibility testing
- Exit and removal plan

Prefer, in order: LTI 1.3 → standard Moodle Web Services → an approved
reporting or export path → a custom plugin only as a last resort.

## Semester’s own developer contract

To outperform integration-heavy LMS stacks, publish a precise contract.

| Area | Promise |
| --- | --- |
| Identity | OIDC, SAML, SCIM, tenant-aware roles, MFA for privileged access. |
| Standards | LTI 1.3/LTI Advantage, OneRoster, QTI 3, CASE when relevant, Open Badges and CLR later. |
| APIs | REST/OpenAPI, OAuth 2.0, scoped tokens, cursor pagination, idempotency, resource versioning and ETags, clear rate limits, predictable errors. |
| Events | Signed webhooks, event versioning, retries, a delivery log, replay protection, a customer webhook dashboard. |
| Data | Field-level permissions, source/scope/status metadata, export APIs, retention metadata, deletion and revocation events, tenant isolation. |
| Developer operations | A synthetic sandbox, test tenants, SDKs, an API explorer, a changelog, deprecation windows, an integration-health dashboard, support runbooks. |
| Grade writes | Preview → human or institution confirmation → idempotent delivery → destination acknowledgment → reconciliation → exception queue → immutable audit event. |

The decision rule: choose an LMS or assessment integration on whether the
system can prove these, never on who claims the most AI.

1. Interoperability: the standards work in the specific customer tenant.
2. Control: permissions, grade writes and data access are scoped and auditable.
3. Assessment quality: items are accessible, versioned, aligned and portable.
4. Human accountability: AI assists but does not silently decide grades or misconduct.
5. Student rights: source visibility, accessible alternatives, feedback, correction, appeal, export and privacy are built into the workflow.

## Found on the way

Three faults found on 28 September — the LTI runbook’s line on when the nonce is spent, the pipeline audit’s line that no worker existed, and the LTI function’s own comment on what the check proves — were fixed since, and the test holds all three to the corrected wording. Nothing is open.
