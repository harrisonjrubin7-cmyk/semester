# Integration workbook

| Control | Value |
| --- | --- |
| Status | **TEMPLATE — COPY PER TENANT; NO INSTITUTIONAL PROVIDER IS LIVE** |
| Owner | Integration engineer seat; approver is the school's university administrator, never the connection's owner |
| Evidence date | 2026-10-04 at `origin/main` `7287ddc` |
| Used in | [phase 4 (integrate)](METHODOLOGY.md#phase-4--integrate) |
| Operator steps | [`../INTEGRATION-OPERATOR-RUNBOOK.md`](../INTEGRATION-OPERATOR-RUNBOOK.md) — this workbook records, the runbook does |
| Copy to | `docs/evidence/implementation/<tenant-id>/integrations.md` |

Principle, from the product thesis: **native first, connected when available.**
A connection enriches, synchronizes or co-exists. It is never the only way a
capability works, and the student loses nothing when it fails. A row that
cannot say what the student sees when the connection is down is not ready.

## 1. Inventory (one row per system, decided in design)

| # | System | Vendor / product / version | Owner (customer) | Backup | Role in the design | Direction | Sandbox available | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | SIS | | | | read / enrich | in | | connect / defer / exclude |
| 2 | LMS (LTI 1.3) | | | | launch, roster context | in | | |
| 3 | Identity (SAML/OIDC + SCIM) | | | | sign-in, lifecycle | in | | |
| 4 | Calendar / email | | | | schedule import | in | | |
| 5 | Payments / student accounts | | | | status display | in | | |
| 6 | Library / dining / housing / campus card | | | | campus services | in | | |
| 7 | Other | | | | | | | |

Rules: a system with no sandbox is `defer`. A system the product has no
approved adapter for is `exclude` and is named in the order as an exclusion.
Official **writes** to an authoritative system (SIS, grade passback) are `off`
unless the adapter, scope and customer approval all exist; the playbook's stop
condition for an unsupported official write applies.

## 2. Connection record (copy this block per connection)

**Connection:** ______  **Provider:** ______  **Domain:** ______  **Public id:** ______

| Field | Value | Evidence |
| --- | --- | --- |
| Credential **reference** only (`vault:`, `env:` or `secret-manager:`). The secret stays in the customer's or Semester's secret manager | | |
| Source of truth per object (who wins in a conflict) | | |
| Direction and write scopes (default none) | | |
| Owner and backup (customer); owner and backup (Semester) | | |
| Environment: sandbox → production, with the date each was approved | | |

### 2a. Scopes (one row each; minimum data)

The database refuses by name integration scopes that would carry grades,
rosters, submissions, accommodations, health, counseling, conduct or aid. If the
design needs one of those, it is a design defect to resolve in phase 2, not a
workaround here.

| Scope | Purpose (one sentence) | Fields | Proposed by | Approved by (≠ owner) | Approved on |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

### 2b. Consent and student agency

| Question | Answer | Evidence |
| --- | --- | --- |
| Does the connection read any student's personal records? If yes, consent is required (`consent_record`, capability `integration:<public id>`); until given, records are refused with `consent_block` | | |
| Can a student see what is connected, why, and turn it off? | | |
| What does a student see before and after consenting? | | |

### 2c. Quality targets (agree before building, so failure has a definition)

| Measure | Target | How measured | Where shown | Owner |
| --- | --- | --- | --- | --- |
| Freshness (max age of data) | | last successful sync | Integration Dashboard | |
| Sync success rate over a window | | worker records | | |
| Reconciliation tolerance (mismatch count/percent) | | [`../INTEGRATION-QUALITY-AND-RECONCILIATION.md`](../INTEGRATION-QUALITY-AND-RECONCILIATION.md) | | |
| Rate-limit and retry behavior | | | | |
| Idempotency (a replay changes nothing twice) | | | | |

These are proposals for agreement. Do not publish them to the customer as
service levels unless counsel and the SLA say so.

### 2d. Identity mapping (when the system carries people)

| Question | Answer |
| --- | --- |
| Join key between the external id and the Semester account | |
| What happens on no match, multiple match, deprovisioning | |
| Who resolves unmatched records and by when | |

### 2e. Failure and exit design

| Situation | Student sees | Operator does | Rehearsed on |
| --- | --- | --- | --- |
| Source down | native view with a freshness label | pause, notify | |
| Bad data arrives | held, not shown | replay after fix | |
| Credential revoked | connection `degraded`, no data loss | rotate at provider | |
| Disconnect | native objects remain; connection data labeled | `disconnect`; clear credential pointer | |
| Stop everything | all connectors off | `killswitch` per runbook §6 | |

Disconnecting clears the credential *pointer*; **rotating the secret at the
provider is a person's job** and is a row in the offboarding checklist.

## 3. Sandbox acceptance (per connection)

| # | Test | Pass condition | Evidence |
| --- | --- | --- | --- |
| 1 | Contract test against the sandbox | all documented calls and error shapes handled ([`../INTEGRATION-TEST-PLAN.md`](../INTEGRATION-TEST-PLAN.md)) | |
| 2 | First sync | connection reaches `healthy` | |
| 3 | Authoritative readback | a sample of records compared to the source, zero unexplained differences | |
| 4 | Idempotency | replaying the same window changes nothing | |
| 5 | Degraded behavior | with the connection off, every student path still works | |
| 6 | Rate limit / error injection | backoff, no data loss, operator alert | |
| 7 | Cross-tenant | another tenant's token cannot read or write this one's data | |
| 8 | Consent | an unconsented record is refused | |
| 9 | Disconnect and kill switch | works, audited | |
| 10 | Operator rehearsal by the **backup** | steps in the runbook done from the page | |

LTI registrations add: the grade-passback ordering rule from the runbook
(§2 — set the passback flags to `production` and approve the score-publish
scope **before** binding, or passback stops at binding) and the checks in
[`../LTI-1.3-LAUNCH-RUNBOOK.md`](../LTI-1.3-LAUNCH-RUNBOOK.md). SCIM and SAML
rows are in the tenant workbook, section C.

## 4. Production activation (a separate decision from sandbox success)

| # | Step | Who | Evidence |
| --- | --- | --- | --- |
| 1 | University administrator approves the connection and each scope | customer | `integration_approve_connection`, `integration_approve_scope` rows |
| 2 | Connector flag and scope flags set to `production` in tenant feature policy | university administrator | policy rows |
| 3 | First production sync run by the operator | IE | run record |
| 4 | Monitoring and alert routed to a named person | SL | alert test |
| 5 | Schedule set; freshness label visible | IE | schedule |

Provider maturity matters: do not call a provider "supported" before it has been
certified through [`../PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md`](../PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md).
OneRoster is **not** supported yet: roster staging is a foundation with no
OneRoster client (`EDT-6` in [`../FERPA-COPPA-1EDTECH-READINESS.md`](../FERPA-COPPA-1EDTECH-READINESS.md)
is NOT_STARTED); no page may say otherwise until a real import has run against a
real sandbox.

## Acceptance criteria for phase 4

1. Every inventory row has a decision; every `connect` row has a completed block.
2. Every scope is approved by someone other than the owner.
3. Sandbox tests 1–10 pass with evidence for every connection.
4. With every connection off, the golden path still works.
5. Disconnect and kill switch were rehearsed by the backup operator.
6. Production activation is recorded separately for each connection.

## Evidence state

**Repository evidence.** The connection, scope, consent, flag and kill-switch
mechanics and their runbook exist on `main`.

**Operational evidence.** No institutional provider is connected, certified or
live; no sandbox contract test has run against a customer system.

**Missing test/proof.** One adapter certified against a real sandbox; the backup
operator's rehearsal; a recorded production activation.

## Claim ceiling

Semester may present this as its integration intake and acceptance method.

## Prohibited claims

Do not claim any integration is supported, certified, live or reconciled; do not
claim OneRoster, SIS or grade-passback support.
