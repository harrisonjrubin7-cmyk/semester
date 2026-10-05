# Evidence register

<!-- Rendered from app/src/lib/ops/evidence.ts by evidence.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Every dated artifact the repository holds today: the date its file states,
how long it is good for, and the public claims and register rows resting on
it. A record carries a date and a validity rather than the word “current”,
because a word beside a document is a claim nothing re-checks; the state is
computed for the day it is asked on, by the console’s Evidence view and by
[`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts), which refuses an “available” claim
resting on a record that has expired.

`docs/evidence/` holds dated AI, advisor, restore, and milestone-verification
artifacts, and every file there is a record below. The
[master register](MASTER-LAUNCH-READINESS-REGISTER.md) lets a
row past `tested` only by citing one, and the [proof calendar](PROOF-CALENDAR.md)
still schedules the artifacts that would move the rest. This page is what
does exist, with when it runs out.

## The records

| Artifact | Produced | Valid for | Expires | Owner | Claims resting on it | Rows | Stated in |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Production Semester Plus lifecycle acceptance: live checkout, paid invoice, entitlement, customer portal and end-of-period cancellation**<br>One owner-account acceptance run. It does not cover an annual charge, refund, failed renewal, dispute, registered-jurisdiction tax collection, Pro, institution access or general availability, and it does not authorize enabling the governed acquisition hold. | 2026-10-03 | 365 days | 2027-10-03 | `founder` | — | `COM-001` (building) | [`docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md`](evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md) |
| **AI kill-switch drill against production: kill.ai_generation engaged, the deployed claude function refusing, released, each step timed**<br>Held, 3 of 3: answered 200 before, refused 503 with the runtime’s own sentence while engaged, answered 200 after release. The institution gateway is not deployed and was not observed; aikillswitch.test.ts holds it to the same switch. Renewed by the quarterly DR exercise. | 2026-09-29 | 91 days | 2026-12-29 | `engineering` | — | `AI-012` (evidenced) | [`docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json`](evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json) |
| **Prompt-injection red-team against the real model: three canaries in the material of seven prompt builders, 21 cases, through the shared key’s proxy**<br>Held, 21 of 21 on claude-opus-5: no reply carried a canary. One model, one run; a model or prompt-builder change is a reason to run it again (REDTEAM=write, app/src/ai/injection.live.test.ts). | 2026-09-29 | 91 days | 2026-12-29 | `engineering` | — | `AI-010` (tested) | [`docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json`](evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json) |
| **Production security and performance advisor read before the reconciliation: 49 policy-less tables, 180 signed-in-callable definer functions, four unindexed foreign keys, two tables without a primary key**<br>The before column of docs/ADVISOR-RECONCILIATION-2026-09-30.md, read-only. The after reading on production is not taken until the migration is applied, which needs separate authorization. Renewed by re-running supabase/advisor-probe.sql. | 2026-09-30 | 30 days | 2026-10-30 | `engineering` | — | `IAM-008` (tested) | [`docs/evidence/advisors/2026-09-30-before.json`](evidence/advisors/2026-09-30-before.json) |
| **Backup restore rehearsal: a logical dump restored locally, schema and row counts compared**<br>The go/no-go checklist records the pass date; RESTORE.md and supabase/restore.sh hold the procedure and state no date. Production has never been restored, which is why the claim stays in preparation. Renewed by the quarterly disaster-recovery exercise. | 2026-09-21 | 91 days | 2026-12-21 | `engineering` | `restore-drill` (In preparation) | `SRE-004` (designed), `SRE-005` (building) | [`docs/GO-NO-GO-CHECKLIST.md`](GO-NO-GO-CHECKLIST.md) |
| **Backup restore rehearsal after the school-offboarding migration: a logical dump restored locally, 308 tables, schema and row counts compared, timed**<br>A rehearsal in a throwaway database with one account, not a restore of the live project. Production has never been restored; release gate G5 stays unmet until it is, on a non-production project, by someone other than the author. | 2026-09-30 | 91 days | 2026-12-30 | `engineering` | — | `SRE-004` (designed), `SRE-005` (building) | [`docs/evidence/restore/2026-09-30-logical-rehearsal.md`](evidence/restore/2026-09-30-logical-rehearsal.md) |
| **M1/M2 automated verification: 21 focused workflow files, 355 tests, Master Plan controls, TypeScript, lint and a production build**<br>Repository-only evidence. It does not prove deployment, live tenant isolation, human accessibility, production restore, or a student pilot. Renew on a material M1/M2 change or monthly. | 2026-09-30 | 30 days | 2026-10-30 | `engineering` | — | `SRE-008` (building) | [`docs/evidence/m1-m2/2026-09-30-automated-verification.md`](evidence/m1-m2/2026-09-30-automated-verification.md) |
| **Production npm dependency graph audited at the high threshold with no reported vulnerabilities, bound to the candidate commit and lockfile hash**<br>Point-in-time npm advisory evidence for production dependencies only. It is not DAST, SAST, a penetration test, provider assurance, or evidence about an unknown vulnerability. Renew on every lockfile change and at least monthly. | 2026-10-02 | 30 days | 2026-11-01 | `security` | — | `SEC-004` (building) | [`docs/evidence/security/2026-10-02-production-dependency-audit.md`](evidence/security/2026-10-02-production-dependency-audit.md) |
| **Checksum-verified Gitleaks scan of the complete working tree with no leaks found**<br>Point-in-time repository evidence using the version and configuration pinned by CI. It does not inspect provider-side secret stores, prove credential rotation, or replace continuous scanning. Renew for every release candidate and after credential-handling changes. | 2026-10-02 | 30 days | 2026-11-01 | `security` | — | `SEC-004` (building) | [`docs/evidence/security/2026-10-02-working-tree-secret-scan.md`](evidence/security/2026-10-02-working-tree-secret-scan.md) |
| **Market-readiness repository verification: full regression, build, browser journeys, budgets, clean install, dependency and secret scans**<br>Repository-controlled verification only. Independent assurance, legal approval, named-tenant acceptance, staffed production operation and customer outcomes remain separate gates. | 2026-10-02 | 30 days | 2026-11-01 | `engineering` | — | `SRE-008` (building) | [`docs/evidence/market-readiness/2026-10-02-repository-verification.md`](evidence/market-readiness/2026-10-02-repository-verification.md) |
| **Founder-led incident and recovery tabletop covering a suspected cross-tenant AI disclosure and provider or model change**<br>Document and repository walkthrough only. Target alerting, staffed escalation, customer communication, provider recovery and two-person release approval remain open. | 2026-10-03 | 91 days | 2027-01-02 | `founder` | — | `AI-014` (building), `SEC-007` (building), `SRE-006` (designed) | [`docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md`](evidence/operations/2026-10-03-founder-readiness-tabletop.md) |
| **Point-in-time public production smoke covering the frontend, deployed assets and the committed Supabase public API configuration**<br>One reachability observation, not availability history, institutional gateway monitoring, alert delivery, authenticated UAT, SLA evidence or named-tenant acceptance. | 2026-10-03 | 30 days | 2026-11-02 | `engineering` | — | `SRE-002` (building) | [`docs/evidence/operations/2026-10-03-public-production-smoke.md`](evidence/operations/2026-10-03-public-production-smoke.md) |
| **Diagnosis of the block of red CI runs on main on 4 October 2026, read from the Actions run history and two failing jobs' logs**<br>Two of 26 failing runs were read; no ruleset, required status or workflow was changed. Branch protection and merge gating remain unapplied. | 2026-10-04 | 30 days | 2026-11-03 | `engineering` | — | `SEC-003` (building) | [`docs/evidence/operations/2026-10-04-main-ci-red-diagnosis.md`](evidence/operations/2026-10-04-main-ci-red-diagnosis.md) |
| **Founder-operated repository assurance run across AI containment, prompt-injection, institutional policy, authentication and membership suites**<br>Repository-scoped automated evidence. It is not target DAST, an independent penetration test, provider validation, deployment proof or named-tenant acceptance. | 2026-10-03 | 30 days | 2026-11-02 | `security` | — | `SEC-003` (building) | [`docs/evidence/security/2026-10-03-founder-assurance-run.md`](evidence/security/2026-10-03-founder-assurance-run.md) |
| **School offboarding walked end to end on a hosted Supabase preview database with synthetic schools and accounts, inside a rolled-back transaction**<br>Run by the author on an empty disposable preview, not by a second person and not on production; the compact script omits some of the 98 local checks. The purge is not built and the export file is generated elsewhere. | 2026-09-30 | 91 days | 2026-12-30 | `engineering` | — | `LEG-004` (building) | [`docs/evidence/offboarding/2026-09-30-hosted-preview-rehearsal.md`](evidence/offboarding/2026-09-30-hosted-preview-rehearsal.md) |
| **HECVAT draft response, not sent**<br>A draft written from the repository; the claim stays planned until one is sent. A HECVAT is re-issued yearly. | 2026-09-28 | 365 days | 2027-09-28 | `security` | `hecvat` (Planned) | `SEC-001` (designed), `SEC-011` (designed) | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) |
| **Owner attestations: company ownership, and multi-factor sign-in on the GitHub, Google and Supabase accounts**<br>Attested, not independently checked; the file says to keep a screenshot of each account’s security page. Renewed at the quarterly access review. | 2026-09-28 | 91 days | 2026-12-28 | `security` | — | `IAM-005` (designed) | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) |
| **Security whitepaper, version 0.1, draft**<br>Its own control table says: next review before the first institutional security review, and at least every six months. | 2026-09-28 | 182 days | 2027-03-29 | `security` | — | `SEC-013` (building) | [`docs/trust/SECURITY-WHITEPAPER.md`](trust/SECURITY-WHITEPAPER.md) |
| **Master launch readiness register re-read, row by row, against origin/main at fd8fc0b**<br>Every public claim rests on rows of this register, so the re-read is the evidence that their floors were checked. Reviewed monthly, per SEMESTER-OPERATING-SYSTEM.md. | 2026-09-28 | 30 days | 2026-10-28 | `founder` | — | `PRG-002` (tested) | [`docs/MASTER-LAUNCH-READINESS-REGISTER.md`](MASTER-LAUNCH-READINESS-REGISTER.md) |
| **Operating-system register review: every authoritative document read and standing**<br>The registers that change with every merge are reviewed monthly, the rest quarterly; the earlier of the two is the register’s own validity. | 2026-09-28 | 30 days | 2026-10-28 | `founder` | — | `PRG-002` (tested) | [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md) |
| **Regression checklist: the full suite, typecheck, lint and build re-taken and recorded**<br>A measured run with its figures, not the suite itself; CI runs the suite on every change, and this record is the last time somebody wrote the figures down. | 2026-09-21 | 30 days | 2026-10-21 | `engineering` | — | `SRE-008` (building) | [`REGRESSION-CHECKLIST.md`](../REGRESSION-CHECKLIST.md) |

## What the state means

| State | Meaning |
| --- | --- |
| **current** | More than thirty days to expiry; nothing is due |
| **expiring** | Thirty days or fewer; the escalation step for the days left applies |
| **expired** | Past its validity: superseded, out of the procurement pack, and every claim resting on it flagged |

The steps are the escalation ladder in
[`ops/operations-console/README.md`](../ops/operations-console/README.md): at thirty days the owning seat is
notified; at seven the security and privacy seats are, and the item is on the
weekly operations review; at expiry the artifact is superseded, leaves the
procurement pack, and every claim resting on it is flagged. The state is not
printed here on purpose: a page that said “current” would be the word this
register replaces.

## How a record counts

1. The artifact exists in the tree and states its own date. A record names
   the file that states it, and the test reads the file.
2. Its validity is the cadence that renews it: monthly for the registers,
   quarterly for the reviews the operating rhythm schedules, six months for
   the whitepaper by its own control table, yearly for a HECVAT.
3. The claims it names are ids of the claims register; the rows are ids of
   the master register. A record that supports nothing is refused.
4. When an artifact under `docs/evidence/` is filed, it joins this page with
   its date, and the master register rows it moves cite it.

## How this page is held

[`app/src/lib/ops/evidence.test.ts`](../app/src/lib/ops/evidence.test.ts) fails when a record cites a file
that does not exist or does not state the record’s date, when its owner is
not a seat, when a claim or row it names is not registered, when the state
is wrong on either side of a step, when — on the day the test runs — an
expired record sits under an “available” claim that `problems()` does not
name, or when this page is stale.
