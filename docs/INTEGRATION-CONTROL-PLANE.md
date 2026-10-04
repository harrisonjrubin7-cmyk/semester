# Integration control plane

How Semester connects to a school's systems without depending on them. This is the framework guide: the rule
every connector is held to, the patterns it follows, what is built, what is not, and how to add one.

Read it beside [`INTEGRATION-DATA-PIPELINE-AUDIT.md`](INTEGRATION-DATA-PIPELINE-AUDIT.md) (what each provider
domain would map to), [`INTEGRATION-QUALITY-AND-RECONCILIATION.md`](INTEGRATION-QUALITY-AND-RECONCILIATION.md)
(drift, reconciliation, mapping versions), [`INTEGRATION-OPERATOR-RUNBOOK.md`](INTEGRATION-OPERATOR-RUNBOOK.md)
(running one) and [`INTEGRATION-THREAT-MODEL.md`](INTEGRATION-THREAT-MODEL.md).

## The rule

**A connector augments something Semester already does. It is never the only way a capability works.**

Turn any connector off — a school pauses it, a kill switch trips, a grant is revoked, a vendor goes down — and the
student is left on a native screen that still does the job. Whatever the connector had already brought in stays,
labelled by when it was last current, and is never called the school's official record once it is not live or
recent.

This is enforced, not asserted:

| Where | What fails when the rule is broken |
| --- | --- |
| `lib/integration/fallback.ts` | `NATIVE_FALLBACK` is exhaustive over `ProviderDomain`: a domain added to the catalog without a native capability and route does not typecheck. `fallback.test.ts` checks every route against the real `SCREENS` table and that each domain sits in exactly one connector family |
| `lib/integration/health.ts` | `degradedExperience` always returns the native route and `coreJourneyAvailable: true`; `health.test.ts` walks every domain in every state |
| `lib/integration/contract-harness.ts` | The `disable_safe` check: with the kill switch on, an adapter's domain must still have its native route, a sentence for the student, and no claim of being official |

## What was already here, and what this adds

Most of the control plane existed before this change. It is listed so nobody builds it twice.

| Ask | Already on main | Added |
| --- | --- | --- |
| Connector framework | `AdapterDeclaration` + `validateDeclaration` (`adapter.ts`), the registry and its preflight (`app/server/integration/registry*.ts`) | `fallback.ts` (what each connector augments), `contract-harness.ts` (the conformance suite) |
| Credential vaulting | Declaration holds a pointer, never a secret (`validateDeclaration`) | `vault.ts`: tenant-bound, audited, short-lived, unprintable leases |
| Scopes | `integration_scopes`, `integration_approve_scope`, scope check in `ingest` | — |
| OAuth / OIDC | Declaration names the pattern | `oauth.ts`: PKCE, signed state, token lifecycle, ID-token claim checks |
| SAML / SCIM / LTI | `institution_identity_provider`, SCIM gateway (`server/institution/scim*.ts`), `functions/lti` | — (see the table below) |
| Webhooks | `integration_webhook_events` with a unique `(connection_id, idempotency_key)` | `webhook-ingress.ts`: signature, replay window, rotation, dedupe |
| Polling | `server/integration/tick.ts` on the 15-minute tick | — |
| Replay | `integration_request_replay`, dead-letter replay in the worker | — |
| Rate controls | `RateLimiter` token bucket and `afterFailure` back-off (`retry.ts`) | `rate-control.ts`: penalty box for Retry-After, concurrency cap, circuit breaker |
| Mapping versions, drift, lineage, reconciliation | `mapping-versions.ts`, `drift.ts`, `lineage.ts`, `reconcile.ts`, `duplicates.ts` | — |
| Sync cursors, retries, dead letters | `ProviderBatch.cursorBefore/After`, `integration_dead_letter_events`, `retry.ts` | — |
| Health states | `ConnectionStatus`, `integration_health()`, `freshness.ts` | `health.ts`: one precedence, a reason for every state, operator next steps |
| Degraded UX | Today's *From your school* section, `STATUS_TEXT` | `degradedExperience`: student sentence, native route, official-or-not |
| Contract and sandbox tests | `pipeline.test.ts`, mock adapters, `simulate.ts` | `contract-harness.ts` |
| Tenant-specific activation | Worker gates: approval, approved scopes, feature flag, kill switch, pause; capability maturity in `lib/governance/` | — |
| Parallel run / migration | `ADDITIVE-UNIVERSITY-OS-MIGRATION-PLAN.md`, `DATA-MIGRATION-PLAN.md` | `parallel-run.ts`: the comparison, the verdict, the cutover and rollback gates |

## Connector families

The brief names eight families. The pipeline's unit is the provider domain; a family is a grouping for people,
defined in `fallback.ts` (`CONNECTOR_FAMILIES`).

| Family | Domains | Reach | Augments (native route) | Auth patterns | Notes |
| --- | --- | --- | --- | --- | --- |
| Identity | identity | tenant pipeline | Account sign-in (`account`) | SAML, OIDC, SCIM | Upstream of tenancy; provisioning state, not records |
| Student information | sis, degree_audit, catalog, admissions_crm | tenant pipeline | Course planning (`registrar`, `degree`, `registration`) | OAuth 2, API key, SFTP, mTLS | Read-only; no grades, rosters or hold reasons |
| LMS | lms | tenant pipeline | Courses and deadlines (`courses`) | LTI 1.3, OAuth 2 | Score passback is gated separately (D-1) |
| Calendar | calendar | tenant pipeline | The student's own calendar (`calendar`) | OAuth 2 | Institutional calendar; a student's own feed is separate |
| Payment | erp, bursar, financial_aid | tenant pipeline | Costs and deadlines (`costs`) | OAuth 2, SFTP | **Links and due dates only. An amount is never mapped.** Semester's own subscription billing is a different system |
| Campus services | library, tutoring, events, organizations, alerts, transit, advising | tenant pipeline | Study, activities, community, notifications, maps | OAuth 2, API key, webhook, GTFS | Mostly T0/T1 |
| Career | career, research, study_abroad, alumni | tenant pipeline | Career and opportunities (`career`, `opportunities`, `pathway`) | OAuth 2, API key | |
| Email | none | **student credential** | Mail (`mail`) | OAuth 2 (the student's grant) | A student's mailbox is read with their own grant and they can revoke it; it is not a school connection. A school mail connector would need a domain and a data class |
| Reporting | none | **not yet modelled** | The student's own export (`export`) | — | Outbound institutional reporting needs a catalog domain, an `approved_write` adapter behind a `writeback.*` flag, and a data-sharing agreement. None exists |

No live adapter is registered. `ADAPTERS` in `app/server/integration/registry.ts` is empty on purpose and this
change does not touch it.

## Authentication and identity patterns

| Pattern | Where it lives | Rule |
| --- | --- | --- |
| OAuth 2.0 authorization code + PKCE | `oauth.ts` (`createPkce`, `authorizationUrl`, `signState`, `verifyState`) | https only. `state` is signed, expires, and is bound to one tenant and one connection, so a callback cannot be replayed into another |
| OAuth token lifecycle | `oauth.ts` (`TokenManager`) | Refreshes once however many callers ask. Survives two workers racing a rotating refresh token (compare-and-swap on the stored token). **A dead grant (`invalid_grant`, `invalid_client`, `unauthorized_client`, `invalid_scope`) is never retried** — it marks the connection `needs reauthorization` and stops |
| OIDC | `oauth.ts` (`idTokenProblems`) | Checks issuer, audience (exactly one), expiry, issued-at, nonce. **Verifying the signature against the provider's keys is the caller's step and comes first** |
| SAML | `institution_identity_provider`, `docs/SAML-OIDC-SCIM-COMPARISON.md` | The school's IdP; not a pull adapter |
| SCIM 2.0 | `server/institution/scim.ts`, `postgres-scim.ts`, `scim_gateway_*` | Provisioning and deprovisioning into membership |
| LTI 1.3 | `functions/lti`, `docs/LTI-1.3-LAUNCH-RUNBOOK.md` | Launch, linking, deep linking, gated passback |
| Webhooks | `webhook-ingress.ts` | See below |
| API key, SFTP, mTLS | `vault.ts` | Credential is a pointer in the declaration, a lease at call time |

### Credential vaulting

`credentialsReference` in a declaration is a pointer (`vault:`, `env:`, `secret-manager:`). `LeaseBroker` turns it
into a secret for one call.

1. **Tenant-bound.** The path must be under `tenants/<this tenant>/` or `platform/`. Anything else, and any path
   containing `..` or `//`, is refused before the backend is asked. `sandbox/` is allowed only when the broker is
   told it is a sandbox.
2. **Audited first.** The audit record is written before the lease is issued. If the audit sink fails there is no
   lease, and the refusal says `audit_unavailable`.
3. **Short-lived.** Default five minutes, at most fifteen. `reveal()` after expiry throws.
4. **Unprintable.** A lease serialises, stringifies and inspects as a reference and an expiry. The value is
   reachable only through `reveal()`. Audit events carry the reference, never the value.
5. **`env:` pointers are refused** unless the environment allows them (development and tests).

`rotationStatus(rotatedAt, maxAgeDays, now)` returns `ok`, `due` (last tenth of its life) or `overdue`. Where each
secret physically lives, and how it is revoked, is [`../SECRETS.md`](../SECRETS.md) and [`../SECURITY.md`](../SECURITY.md).

### Webhooks

`verifyWebhook` / `acceptWebhook`. The scheme is `v1=<hex>`, HMAC-SHA256 over `<timestamp>.<raw body>`; a provider
that signs differently gets its own verifier beside this one, not a flag.

- The **raw** body is signed, so hand over the bytes received, not a re-serialised parse.
- A signature from **any** configured secret passes, so a provider can rotate with both live; a secret past its
  `notAfter` does not.
- A timestamp more than five minutes away in **either** direction is refused.
- The same delivery id is accepted once per connection; the second is `duplicate` and has no side effect.
  The table's unique constraint is the backstop.
- A sender who cannot sign never touches the ledger.
- Every rejection is the same `401` (`413` for size). Which check failed goes to the operator's log, not back to a
  sender who may be probing.
- The row it returns is shaped for `integration_webhook_events`: a hash and a type, never the payload.

## Rate controls and the circuit breaker

`ConnectionGuard`, keyed by tenant **and** connection so one school's backlog or outage cannot spend another's quota
or open another's breaker.

| Control | Behaviour |
| --- | --- |
| Token bucket | `rateLimitPerMinute` from the declaration. A refusal says when to retry and does not spend a token |
| Penalty box | The provider's `Retry-After` is honoured and only ever extended |
| Concurrency | At most four in flight by default; `release()` is idempotent |
| Circuit breaker | Opens after five **consecutive retryable** failures; one probe after 60 seconds; a probe's success closes it, its failure reopens it for a full period |

Only a retryable failure (provider down, slow, throttling past its allowance) counts against the breaker. A
permanent failure — bad mapping, refused scope, dead grant — is a fault in *our* configuration. Opening the
breaker for it would hide it behind "provider unavailable". Those go to dead letters and to
`reauthorization_required`.

## Health states and what the screens say

`connectionHealth` decides status and reason from explicit inputs. The first rule that applies wins.

| # | Condition | Status | Reason |
| --- | --- | --- | --- |
| 1 | Not approved | configuring | `not_approved` |
| 2 | Kill switch engaged | paused | `kill_switch` |
| 3 | Paused by an operator | paused | `paused_by_operator` |
| 4 | Provider rejected the grant | error | `reauthorization_required` |
| 5 | Breaker open | error | `circuit_open` |
| 6 | No run and no success yet | configuring | `never_synced` |
| 7 | Last run failed | degraded if data is still within target, else error | `provider_unavailable` |
| 8 | Inside a Retry-After | degraded | `rate_limited` |
| 9 | A breaking schema change is held | degraded | `schema_drift` |
| 10 | Last run was partial | degraded | `partial_failure` |
| 11 | Dead letters waiting | degraded | `dead_letters_waiting` |
| 12 | Nothing new inside the target | degraded | `stale` |
| 13 | None of the above | healthy | `ok` |

The order is deliberate: an operator's pause outranks a fault, a dead grant outranks an open breaker (retrying
cannot fix it), and an unapproved connection is only ever "waiting for approval".

`degradedExperience` turns that into screens. The student sentence says what still works and names no error:
*"<Source> isn't updating right now. <Native capability> still works here, and anything we imported keeps the date
it was last updated."* The staff line is the operator's next step for that reason. State is carried by a word and a
glyph, never colour alone. `officialCurrent` is true only when the connection is healthy **and** the data is live
or recent.

## Contract tests and the sandbox

`runContract(adapter, { live })` is the conformance suite. It tests the framework's promises, not the provider's
behaviour — that is what a sandbox tenant is for.

| Check | Promise |
| --- | --- |
| `declaration` | Passes `validateDeclaration` |
| `native_fallback` | A native screen still does the job |
| `live_not_mock` | A live adapter is not a fixture |
| `cursor_chain` | The second pull starts where the first stopped, and repeats nothing |
| `idempotent_replay` | The same batch twice writes once |
| `declared_entities_only` | It returns only entities its mapping declares |
| `ingest_clean` | Its own batch goes through the pipeline without error |
| `never_ingest_dropped` | A forbidden field (`grade`) is refused **and** not stored |
| `no_secret_in_output` | Nothing token-shaped, and not the credential pointer, comes out of a pull |
| `disable_safe` | Kill switch → paused, with the native route intact |

`contract-harness.test.ts` runs it against a well-behaved adapter and against adapters broken in exactly one way
each, asserting that the *one* check fails. The `ingest` function is injectable, so the `never_ingest_dropped`
check is also proven against a pipeline that has regressed in three different ways.

The sandbox institution and mock adapters (`mock-*.ts`, `simulate.ts`) are unchanged. A mock can never be
registered as live: `live_not_mock` and the registry preflight both refuse it.

## Tenant activation

A connector runs for a tenant only when **all** of these hold. The worker enforces the first six; the last two are
the gate for adding an adapter at all.

1. The connection is approved, by a university admin who is not its owner.
2. The scopes it asks for are approved.
3. The connector's feature flag is on for that tenant.
4. No kill switch (global or the tenant's) is engaged.
5. The connection is not paused.
6. A registered adapter claims exactly that connection (two claims run neither).
7. `runContract` passes with `live: true` and `declaration.contractTests` names the file that runs it.
8. The security review below is signed.

## Security review for a new connector

Before an adapter is added to the registry. Each line is a yes or no with the evidence beside it.

- [ ] Data classes: `classificationCeiling` is at or under `DOMAIN_CEILING` for the domain; nothing on the
      never-ingest or never-display lists is mapped, under any external name.
- [ ] Direction is `read`. Anything else sits behind a `writeback.*` flag and has its own review.
- [ ] Every scope is `scope.<domain>.<name>` and the narrowest the feature needs.
- [ ] Credentials are a pointer under `tenants/<id>/`; the secret is rotatable without a deploy; `rotationStatus`
      is on the dashboard.
- [ ] The grant can be revoked from Semester (`TokenManager.revoke`) or `declaration.disconnect` says where.
- [ ] Inbound traffic is signature-verified with a rotating secret and a replay window.
- [ ] Outbound calls go through a `ConnectionGuard`; the provider's published limit is in `rateLimitPerMinute`.
- [ ] A person-level record names a subject and requires consent (`consentRequired`).
- [ ] `retentionDays` is set and the retention sweep covers its tables.
- [ ] Errors reaching the dashboard pass `sanitizeMessage`; no payload, token or student identifier is logged.
- [ ] The native fallback is true: the screen named in `NATIVE_FALLBACK[domain]` works with this connector off.
- [ ] `runContract` is green with `live: true`.
- [ ] A sandbox tenant, not production, has exercised it end to end.

## Monitoring

What to watch, per connection. `connectionHealth` and `freshness.ts` produce the state; the alert on a change is
`alertFor` in `lineage.ts`, which fires once per change and not once per tick.

| Signal | From | Page when |
| --- | --- | --- |
| Status and reason | `connectionHealth` | `error` for any reason; `degraded` for more than one freshness target |
| Freshness against target | `freshnessFromAge`, `breachLevel` | Breach, once per change |
| Breaker state | `ConnectionGuard.breaker` | `open` |
| Credential rotation | `rotationStatus` | `due` (ticket), `overdue` (page) |
| Dead letters waiting | `integration_dead_letter_events` | Any older than a day |
| Webhook rejections | `acceptWebhook` outcomes | A sustained rate of `bad_signature` (probing, or a rotated secret nobody told us about) |
| Reauthorization required | `TokenManager` | Any |
| Parallel-run agreement | `assessParallelRun` | Under the floor, before or after cutover |

## Parallel run and migration

A connector fills the same records the school's current process does, side by side, before anyone trusts it.
`assessParallelRun` compares what the student sees today (`authoritative`) with what the connector produced
(`connector`) field by field, in canonical values after the pipeline's own transforms, so a disagreement is a
disagreement in meaning and not in formatting.

| Verdict | Meaning |
| --- | --- |
| `insufficient_data` | Fewer than `minSamples` comparisons per entity, or fewer than `minDays` days. Defaults: 200 and 14 |
| `diverging` | Under 99% agreement, more than 1% of school records missing from the connector, or more than 2% extra |
| `shadow_ok` | Enough data, agreeing |

`cutoverDecision` then answers whether a cutover may be **requested**: a `shadow_ok` run, two sign-offs from two
different people in two different roles, neither the proposer, one from the school. It never performs the cutover.
After it, `shouldRollBack` runs the same comparison against a stricter floor (99.5%) and offers the way back.

Reports carry redacted record references and field names, never values.

## Adding a connector

1. Write the declaration (`AdapterDeclaration`). It must pass `validateDeclaration`.
2. Write `pull(request)`: fetch and parse only. Mapping, classification, consent, idempotency and provenance are the
   pipeline's.
3. Add a contract test that calls `runContract` with `live: true`, and list its path in `contractTests`.
4. Run it against a sandbox tenant and record the evidence.
5. Complete the security review above.
6. Add the adapter to `registry.ts` in its own reviewed change. `registry.test.ts` holds every entry to the rules.
7. Run a parallel run (`assessParallelRun`) before anything the student relies on is sourced from it.

## What this does not do

- **No live adapter exists.** The registry is empty. No provider endpoint has been exercised, and no school has
  supplied credentials, a contract or a sandbox.
- **The new libraries are not yet wired into the worker.** `server/integration/worker.ts` still uses only
  `afterFailure` from `retry.ts`. Calling `ConnectionGuard`, `LeaseBroker` and `TokenManager` from `runSync`, and
  feeding `connectionHealth` from the stored rows, is the first follow-up. Until then they are tested building
  blocks, not behaviour a school can observe.
- **There is no webhook HTTP route.** `acceptWebhook` is the verifier; the route that calls it, and the writer for
  `integration_webhook_events`, do not exist yet.
- **Email and reporting are not tenant connectors**, for the reasons in the family table. Making them one is a
  catalog-domain migration (the SQL check constraints and `catalog.test.ts` pin the domain list) plus a data-class
  decision, which this change does not make.
- **No migration, no change to the database vocabulary.** `needs reauthorization` is a *reason* under `error`, not a
  new status.
- **Legal and contractual conclusions are not made here.** Data-sharing agreements, FERPA school-official
  designations and vendor terms need qualified counsel.
