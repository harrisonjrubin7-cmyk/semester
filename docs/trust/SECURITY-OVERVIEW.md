# Security overview

> **Type:** explanation · **Audience:** security-reviewers, buyers · **Owner:** `security` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/trust-docs.test.ts`

This page explains how Semester's security model works as built, one statement at a time, with the evidence behind each and its status; stop reading if you need a claim you can sign, because nothing here is one.

**Status:** PARTIAL. Most controls below are built and tested in the repository. Several are not deployed, and none has been independently assessed.

## What has not been done

Read this before the rest. Each line is stated by a register, not by this page.

- **No penetration test has been performed.** The claims register row `pen-test` is `planned`: no firm engaged, no test environment built ([`PENETRATION-TEST-PLAN.md`](PENETRATION-TEST-PLAN.md)).
- **No SOC 2 report exists and no auditor is engaged.** Claims row `soc2` is `planned` ([`SOC2-READINESS.md`](SOC2-READINESS.md)). Semester is not ISO/IEC 27001 certified ([ISO-27001-READINESS-ASSESSMENT.md](../compliance/ISO-27001-READINESS-ASSESSMENT.md)).
- **No HECVAT has been completed or sent.** Claims row `hecvat` is `planned`; the draft response is marked "not sent" ([HECVAT_DRAFT_RESPONSE.md](../market-readiness/HECVAT_DRAFT_RESPONSE.md), [`HECVAT-READINESS-MATRIX.md`](HECVAT-READINESS-MATRIX.md)).
- **No independent accessibility audit and no formal ACR or VPAT.** Claims row `vpat` is `planned`; row `a11y-human` is `in-preparation` ([VPAT-ACR-SELF-ASSESSMENT.md](../compliance/VPAT-ACR-SELF-ASSESSMENT.md)).
- **No data processing agreement is signed.** Claims row `dpa` is `planned`; the checklist is `NOT_STARTED` as an agreement ([`DPA-CHECKLIST.md`](DPA-CHECKLIST.md)). No insurance and no contracting legal entity are recorded ([`README.md`](README.md)).
- **No uptime commitment.** The SLA framework is drafted and `NOT_STARTED` as a commitment ([`SLA.md`](SLA.md)).
- **Production has never been restored.** Only local logical-dump rehearsals exist ([`BACKUP-RESTORE-AND-ROLLBACK-RUNBOOK.md`](BACKUP-RESTORE-AND-ROLLBACK-RUNBOOK.md)).
- **No alert reaches a person** and the security-lead seat is vacant, per [FEATURE-TRUTH-TABLE.md](../FEATURE-TRUTH-TABLE.md) and [`EVIDENCE-REGISTER.md`](EVIDENCE-REGISTER.md).
- **The institution gateway has no production adapters.** Every real service behind it answers 503 ([FEATURE-TRUTH-TABLE.md](../FEATURE-TRUTH-TABLE.md)).
- **Counsel has not reviewed** the subprocessor classification, the notice-law paragraph in [SECURITY.md](../../SECURITY.md) or any legal draft.

What does exist as dated evidence is listed in [docs/EVIDENCE-REGISTER.md](../EVIDENCE-REGISTER.md): for example a kill-switch drill, a prompt-injection red-team on one model, a dependency audit, a working-tree secret scan and two local restore rehearsals. [`EVIDENCE-REGISTER.md`](EVIDENCE-REGISTER.md) in this directory says the evidence it asks for per control has not been produced; the two pages answer different questions and the second has not caught up with the first. Both are linked so you can read both.

## How to read the table

Each row is one statement about the system as built. **Evidence** is the file that holds it: a test, a `*.check.sql` suite, a migration or a dated record. **Status** is a word from [FEATURE-TRUTH-TABLE.md](../FEATURE-TRUTH-TABLE.md): `LIVE`, `IMPLEMENTED_NOT_RELEASED`, `PARTIAL`, `MOCK_DEMO`, `PLANNED` or `BLOCKED`. The last column says what the evidence does not show. Counts come from [`CONTROL-FACTS.md`](CONTROL-FACTS.md), which the test regenerates from the code.

## Storage and authorization

| ID | Statement | Evidence | Status | What is not shown |
| --- | --- | --- | --- | --- |
| S01 | The working copy of a student's data is on the device. The app is usable signed out. Signing in adds a copy in Postgres. Attached files stay in IndexedDB and are not synced. | `docs/architecture/0001-local-first-with-supabase.md` | LIVE | The ADR is marked "under review". Its no-sync statement about files is the ADR's; no test is cited here. Provider tokens for Google and Microsoft calendar sit in `localStorage` (truth table). |
| S02 | Authorization lives in Postgres row-level security. The client holds a publishable key and is treated as hostile. | `docs/architecture/0002-rls-is-the-authorization-boundary.md`, `supabase/access.check.sql` | LIVE | Claims row `rls` is `in-preparation`; it notes there is no exported policy listing for reviewers yet. The ADR's "15 suites, 334 checks" is out of date (see CONTROL-FACTS for the current count). |
| S03 | Every suite under `supabase/` is applied to a throwaway Postgres built from all migrations, in CI, on every change. Suites walk two synthetic accounts. | `supabase/check.sh`, `.github/workflows/ci.yml` | LIVE | The suites run on a disposable database, not on a customer environment. CI history, not this page, shows they pass. |
| S04 | Every table created in a migration enables row-level security, and an event trigger enables it on any new `public` table. | `supabase/migrations/20260901000100_schema.sql`, `docs/trust/CONTROL-FACTS.md` | LIVE | The count is a static parse of migration text. It cannot see tables made in dynamic SQL, and it does not say which migrations are applied to which project. |
| S05 | Tables with row-level security and no policy hold no privilege for `anon` or `authenticated`. The production reading of 2026-09-30 found 49. | `docs/DEFINER-RLS-REGISTER.md`, `supabase/advisor-reconciliation.check.sql`, `docs/evidence/advisors/2026-09-30-before.json` | LIVE | One dated, read-only reading. The "after" reading on production is not taken until a pending migration is applied. |
| S06 | Every `security definer` function a signed-in account can call has a register row with its gates. A new one without a row fails a test. | `app/src/lib/definerregister.test.ts`, `supabase/grants.check.sql`, `supabase/definer-sweep.check.sql` | LIVE | The register records one body that names neither `auth.uid()` nor a private gate by design (`kill_switch_engaged`). Gates are literal text checks, not a proof of correct behaviour. |

## The institution gateway

| ID | Statement | Evidence | Status | What is not shown |
| --- | --- | --- | --- | --- |
| S07 | The gateway validates a bearer token by asking the auth service each time, and takes institutional roles from current membership records, not from user metadata. | `app/server/institution/auth.ts`, `app/server/institution/auth.test.ts`, `app/server/institution/membership.ts` | MOCK_DEMO | Sandbox adapters only. SAML sign-in is `IMPLEMENTED_NOT_RELEASED` and `BLOCKED` on a university identity provider; OIDC is `PLANNED`. |
| S08 | A request is limited per institution and user: 60 requests per 60 seconds by default. A shared Postgres limiter exists for serverless hosting. | `app/server/institution/rate-limit.ts`, `app/server/institution/gateway.test.ts` | MOCK_DEMO | The default is a code constant, not a measured capacity. Rate limits on the edge functions are not covered here. |
| S09 | No action happens in one request. `prepare` changes nothing; `commit` needs the review id and an explicit confirmation, and refuses if the record or review has moved. | `app/server/institution/gateway.ts`, `app/server/institution/gateway.test.ts` | MOCK_DEMO | No production adapter has executed an action. |
| S10 | A failed `execute` is never retried. The journal marks it uncertain and only `reconcile`, which asks what happened, can resolve it. Journal fields are encrypted with AES-256-GCM before storage. | `app/server/institution/journal-crypto.ts`, `app/server/institution/postgres-journal.test.ts`, `supabase/gateway-journal.check.sql` | MOCK_DEMO | Key custody and rotation are not covered by these files. The truth table notes the gateway journal has no backup. |
| S11 | With `SEMESTER_READ_ONLY=on`, every gateway write except `reconcile` is refused with a 503 `read_only` while reads continue. | `app/server/institution/gateway.test.ts`, `docs/FEATURE-FLAG-REGISTRY.md` | MOCK_DEMO | The app has a separate build-time switch (`app/src/lib/readonly.ts`); a build flag changes only on a deploy. |
| S12 | Seven kill switches exist in code, including `kill.ai_generation`. That one was engaged against the deployed `claude` function on 2026-09-29: refused 503 while engaged, answered 200 after release. | `app/src/lib/flags.ts`, `app/src/lib/aikillswitch.test.ts`, `docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json` | IMPLEMENTED_NOT_RELEASED | One drill, one switch, run by the author. The evidence register says the gateway was not observed. |

## AI

| ID | Statement | Evidence | Status | What is not shown |
| --- | --- | --- | --- | --- |
| S13 | The `claude` edge function checks the caller's token, holds the provider key as a function secret and meters usage per account with an atomic monthly cap. | `supabase/functions/claude/index.ts`, `supabase/migrations/20260921142822_usage_atomic.sql`, `app/src/lib/allowance.test.ts` | BLOCKED | Semester's shared key is off until five owner acts are recorded, and the function refuses every caller until then. Provider terms are not accepted in Semester's name ([`SHARED-PROVIDER-ACTIVATION.md`](SHARED-PROVIDER-ACTIVATION.md)). |
| S14 | A student may use their own key. It goes from the browser to the provider under the student's own agreement and is not Semester's key. | `docs/SUBPROCESSORS.md`, `app/src/lib/trust/subprocessors.test.ts` | LIVE | The truth table says LIVE only where a key or proxy is configured. |
| S15 | A live prompt-injection run through seven prompt builders produced no canary in 21 of 21 replies on one model. | `app/src/ai/injection.live.test.ts`, `docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json` | PARTIAL | One model, one run, one date. A model or prompt change is a reason to run it again. |
| S16 | ADR 0004 describes the gateway as "written, tested, and not deployed". | `docs/architecture/0004-ai-through-a-metered-gateway.md` | PARTIAL | The ADR is older than the 2026-09-29 drill against the deployed function (S12). Read the ADR as history and the evidence register as current. |

## Secrets, supply chain and headers

| ID | Statement | Evidence | Status | What is not shown |
| --- | --- | --- | --- | --- |
| S17 | Every secret has one named store. No service-role key is in anything a browser loads. Every change is scanned for leaked credentials. | `SECRETS.md`, `app/src/lib/secrets.test.ts`, `app/src/lib/ops/boundaries.test.ts`, `.gitleaks.toml` | LIVE | Claims row `secrets` is `planned`. A scan of the working tree on 2026-10-02 found no leaks; it does not inspect provider-side stores or prove rotation. |
| S18 | Lockfiles install exactly, every package comes from the npm registry with an integrity hash, licences are approved, third-party Actions are pinned to a commit, and each deploy produces a CycloneDX SBOM. | `docs/SUPPLY-CHAIN.md`, `app/src/lib/supplychain.test.ts`, `.github/workflows/pages.yml` | LIVE | No signed build provenance and no supplier-compromise playbook. The advisory audit step does not block a merge. The truth table notes no SAST. |
| S19 | The Content-Security-Policy is a meta tag in the page, and the same policy is written as a header for hosts that read `app/public/_headers` or `app/vercel.json`. | `app/index.html`, `app/public/_headers`, `app/vercel.json`, `app/src/lib/csp.test.ts`, `app/src/lib/hostheaders.test.ts` | PARTIAL | `app/src/lib/hostheaders.test.ts` says the header files do nothing on GitHub Pages, where the app is served today. The header list is in [`CONTROL-FACTS.md`](CONTROL-FACTS.md). |

## Audit, retention and deletion

| ID | Statement | Evidence | Status | What is not shown |
| --- | --- | --- | --- | --- |
| S20 | A table of audit events with a correlation id exists, with two producers: a data-subject request raised, and an account export. | `supabase/audit-and-subject-requests.check.sql`, `supabase/migrations/20260930000000_audit_and_subject_requests.sql` | PARTIAL | The truth table says the migration is unapplied to any project and the other audit tables are not moved onto it. |
| S21 | The academic-record and student-account ledgers are hash-chained, and a verifier catches the tampering the suite attempts. | `supabase/ledger-chains.check.sql`, `supabase/ledger-seals.check.sql`, `supabase/migrations/20260930110000_ledger_chains.sql` | IMPLEMENTED_NOT_RELEASED | The modules these ledgers serve are built and off. Whether the migration is applied to production is not stated by these files. |
| S22 | Retention is a schedule held to the schema by a test: a table with no retention answer fails. Student work is kept until the student deletes it; only records about it age out. | `RETENTION.md`, `app/src/lib/retention.test.ts` | LIVE | The truth table says production cron state is unverified. Retention class names are in [`CONTROL-FACTS.md`](CONTROL-FACTS.md); durations are policy, not code. |
| S23 | "Delete my account" calls an edge function that erases every row naming the student in one transaction, then deletes the sign-in. It refuses under a legal hold. | `supabase/functions/delete-account/index.ts`, `supabase/deletion.check.sql`, `supabase/legal-holds.check.sql` | LIVE | Erasure fails closed for staff who wrote to four immutable history tables. There is no full-account file export that includes IndexedDB files. |
| S24 | School offboarding is an audited case, reversible until a purge. | `supabase/school-offboarding.check.sql`, `docs/SCHOOL-OFFBOARDING.md` | IMPLEMENTED_NOT_RELEASED | The purge is not built and the export file is generated elsewhere. One rehearsal on a disposable preview, by the author. |
| S25 | Backups are rehearsed as logical dumps restored into a throwaway database, with schema and row counts compared. | `RESTORE.md`, `docs/evidence/restore/2026-09-30-logical-rehearsal.md` | PARTIAL | Production has never been restored. No recovery time or point is stated. |

## Third parties and disclosure

| ID | Statement | Evidence | Status | What is not shown |
| --- | --- | --- | --- | --- |
| S26 | Every third party data can reach is listed with its kind and what it receives. A test fails if the CSP or an edge function names a party the list lacks. | `docs/SUBPROCESSORS.md`, `app/src/lib/trust/subprocessors.test.ts` | PARTIAL | Counsel has not reviewed the classification. Each party's terms and data-processing addendum are not on file, and hosting regions are not stated. No vendor has been risk-assessed ([`VENDOR-RISK-REGISTER.md`](VENDOR-RISK-REGISTER.md)). |
| S27 | A reporting address and a four-level severity table with fix targets are published. | `SECURITY.md`, `app/public/.well-known/security.txt`, `app/src/lib/security.test.ts` | PARTIAL | The fix times are internal targets, accepted by the founder, and nobody has held a finding against them. No safe-harbour wording is written. The origin-root discovery path is not served. |

## Where to go next

- The questions reviewers ask, and the page that answers each: [`REVIEWER-QUESTION-MAP.md`](REVIEWER-QUESTION-MAP.md).
- Counts and lists read from the code: [`CONTROL-FACTS.md`](CONTROL-FACTS.md).
- Every document in this area, by what a reviewer wants: [`DOCUMENT-MAP.md`](DOCUMENT-MAP.md).
- The long-form whitepaper, version 0.1 and a draft: [`SECURITY-WHITEPAPER.md`](SECURITY-WHITEPAPER.md).
- The public-claims wording that may be used: [PUBLIC-CLAIMS-APPROVAL-REGISTER.md](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md).
