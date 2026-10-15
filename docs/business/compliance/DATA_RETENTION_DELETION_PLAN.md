# Data Retention and Deletion Plan

| Control | Value |
| --- | --- |
| Status | **DRAFT - CONSOLIDATED VIEW - DURATIONS NOT APPROVED BY COUNSEL - NOT A POLICY** |
| Owner | Harrison Rubin (interim privacy and operations owner; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: counsel] [REVIEW: privacy] [REVIEW: security] [REVIEW: tax] |
| Audience | Internal |

> Operating document, not legal advice. FERPA prescribes no general retention period; institutions have duties under other law, contracts and their own schedules. Every duration below is either stated as implemented in the repository ([VERIFIED] with a path) or is marked [ASSUMPTION] and [REVIEW: counsel].

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [RETENTION.md](../../../RETENTION.md) | The per-table schedule (clocks, sweeps, tombstones, backups lifecycle, holds), bidirectionally tested by `app/src/lib/retention.test.ts` | A single matrix by data category marking implemented versus planned, plus workflows (termination, requests, verification) | RETENTION.md is organised by table and **wins on any disagreement** |
| [docs/DATA-RETENTION-EXPORT-DELETION.md](../../DATA-RETENTION-EXPORT-DELETION.md) | Synthesis of the three promises, export, deletion, rights requests, audit retention, owner decisions open | Cross-reconciliation (section 9) and gap list | It is the repository synthesis; this adds the consolidated plan |
| [docs/trust/DATA-RETENTION-AND-DELETION-STANDARD.md](../../trust/DATA-RETENTION-AND-DELETION-STANDARD.md) | Standard and control map (`PARTIAL`) | Operational matrix and verification checklist | Controlled trust doc |
| [docs/legal/DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md](../../legal/DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md) and [docs/legal-drafts/DATA-RETENTION-EXPORT-AND-DELETION-EXHIBIT-DRAFT.md](../../legal-drafts/DATA-RETENTION-EXPORT-AND-DELETION-EXHIBIT-DRAFT.md) | Public-language draft (not in force, `[DECIDE]` items) and contract exhibit draft | Lists which decisions this plan depends on | Counsel-owned |
| [docs/DATA-RIGHTS-REQUEST-RUNBOOK.md](../../DATA-RIGHTS-REQUEST-RUNBOOK.md), [docs/trust/DATA-SUBJECT-REQUEST-RUNBOOK.md](../../trust/DATA-SUBJECT-REQUEST-RUNBOOK.md), [docs/privacy-operations/02-SUBJECT-RIGHTS-WORKFLOW.md](../../privacy-operations/02-SUBJECT-RIGHTS-WORKFLOW.md) | Target request procedure; intake built, operator side not | Condensed workflow with built/not-built per step | Runbook is a target procedure |
| [docs/SCHOOL-OFFBOARDING.md](../../SCHOOL-OFFBOARDING.md), [docs/DATA-PORTABILITY-AND-OFFBOARDING.md](../../DATA-PORTABILITY-AND-OFFBOARDING.md) | Eight-step school offboarding (built, never used) and portability gaps | Termination view with what is not built | Canonical |
| [RESTORE.md](../../../RESTORE.md) | Restore drill and the step that re-applies deletions after a restore | Backup-expiry interplay | Canonical |
| [DATA_INVENTORY_TEMPLATE.md](DATA_INVENTORY_TEMPLATE.md), [COMPLIANCE_EVIDENCE_REGISTER.md](COMPLIANCE_EVIDENCE_REGISTER.md) | Inventory rows; evidence rows CER-B05..B08, B14, B15 | Linked | Same folder |

## Gate (what may be done now versus held)

| Item | Status |
| --- | --- |
| Describe the retention schedule and the student export/deletion promise in discovery | NOW, using the wording in [SECURITY_QUESTIONNAIRE_LIBRARY.md](SECURITY_QUESTIONNAIRE_LIBRARY.md) |
| Offer a contractual deletion time, return-and-destroy window, certificate of destruction or backup purge time | HELD (counsel; DPA not approved) |
| Run a real deletion, restore or offboarding on live customer data | HELD (no live customer data; blocker 7 exercises on an authorized target first) |

## 1. The promise the schedule cannot break

`app/src/lib/privacy.ts` tells every student: work is kept until they delete it; no retention schedule quietly removes it; no archive is kept after account deletion; the one thing that ages out is a record about the work (the access log, 90 days). A retention clock on student work would make that false, so none exists. [VERIFIED] `app/src/lib/privacy.ts`, `app/src/lib/privacy.test.ts`, `RETENTION.md`.

## 2. Retention and deletion matrix

"Implemented" = the repository enforces it by migration, function or schedule (the repository is not the database; RETENTION.md notes some migrations were unapplied on earlier dates, so confirm against the target before any customer statement). All other durations are proposals.

| Data | Rule | Implemented? | Mechanism | Label |
| --- | --- | --- | --- | --- |
| Student work (notes, tasks, courses, appointments, sittings, state) | Until the student deletes it or the account | Yes | Self-service delete; `erase_account`; `supabase/deletion.check.sql` | [VERIFIED] `RETENTION.md` |
| Soft-deleted rows (tombstones) | 90 days after deletion | Yes | `public.sweep_tombstones`, weekly `pg_cron` job in `supabase/scheduler.sql` | [VERIFIED] `supabase/scheduler.sql` |
| Unconfirmed sign-ups | 30 days after creation if never confirmed or signed in | Yes | `private.sweep_abandoned_signups()` | [VERIFIED] `supabase/migrations/20260929030000_retention_sweeps.sql` |
| Unaccepted invitations (invites, beta) | 90 days after sending; 90 days after revocation | Yes | `private.sweep_stale_invites()` | [VERIFIED] same migration |
| Access log (who read your rows) | 90 days | Yes | On write, `note_access()` | [VERIFIED] `supabase/migrations/20260921143653_access_log.sql` |
| Activity | 400 days | Yes | On write, `note_activity()` | [VERIFIED] `supabase/migrations/20260921151000_activity.sql` |
| Audit events (common envelope, role grant, moderation, provisioning) | 3 years | Yes | `private.sweep_audit_retention()`, daily `audit-retention` job | [VERIFIED] `RETENTION.md` |
| Support-access events | As long as the student's records (FERPA 99.32 per the repo) | Yes (not swept) | n/a | [VERIFIED] `docs/DATA-RETENTION-EXPORT-DELETION.md` |
| Gateway audit and intelligence audit | 180 days | Yes (gateway not deployed) | `private.gateway_purge_journal()` hourly | [VERIFIED] `RETENTION.md` |
| Gateway reviews / intelligence actions | 1 day after expiry (unconfirmed); 90 days (completed/claimed); unresolved until reconciliation | Yes (not deployed) | same | [VERIFIED] `RETENTION.md` |
| Integration runs/errors; webhook events; dead letters | 180 days; 30 days after processing; 90 days after resolution | Yes, skipped under legal hold | integration retention sweep | [VERIFIED] `RETENTION.md` |
| LTI nonces and link tickets | An hour past expiry | Yes | hourly `pg_cron` | [VERIFIED] `RETENTION.md` |
| Rate-limit counters | 1 day | Yes | on write / hourly | [VERIFIED] `RETENTION.md` |
| Financial records (billing, invoices, contracts) | 7 years after the end of the year made | Yes | `purge_financial_records()`; `supabase/financial-retention.check.sql` | [VERIFIED] `supabase/financial-retention.check.sql` [REVIEW: tax] |
| Data-request completion record | Kept after the requester's deletion with identity cleared | Yes | `data_requests` | [VERIFIED] `RETENTION.md` |
| Legal hold record | Kept until the school is removed; never deleted | Yes | `legal_holds` | [VERIFIED] `supabase/legal-holds.check.sql` |
| `site_leads` (company-site forms) | **No time-based purge yet**; period must be set before forms go live | No | none | [ASSUMPTION] propose 12 months from enquiry [REVIEW: counsel] [REVIEW: privacy] |
| Closed support tickets | With the account today; no closed-ticket period | Partly | `forget_my_support_tickets()` on account deletion only | [ASSUMPTION] propose 12 months after closure [REVIEW: counsel] (TR-37) |
| Domain outbox events and receipts | **No sweep yet**; owed before the first producer writes in production (ADR 0008) | No | none | [VERIFIED] `RETENTION.md` states the gap |
| Generated exports | Not stated in the repository as stored server-side; produced per request by `export_my_data()` | Unknown | `app/src/lib/export.ts` | [ASSUMPTION] treat as not retained by Semester after delivery; confirm with a code read before any statement |
| Provider and platform logs | About a month at providers | Provider-controlled | none in repo | [ASSUMPTION] `docs/integrated-trust/INCIDENT-RESPONSE.md` |
| Incident evidence (custody copy) | No evidence store exists | No | none | [ASSUMPTION] propose alignment with audit retention [REVIEW: counsel] (TR-43) |
| Backups | Each daily backup expires 7 days after it is taken per plan-tier documentation; **not read off the dashboard on a date**; PITR unconfirmed | Provider-run; unverified | Supabase | [ASSUMPTION] `RETENTION.md` |
| Customer-institution records after termination | Archive at least 30 days (default 90) after access disabled; purge authorization records a decision and **deletes nothing**; purge logic not built | Partly | `archive_school`, `authorize_school_purge` in `supabase/migrations/20260930200000_school_offboarding.sql` | [VERIFIED] `docs/SCHOOL-OFFBOARDING.md`; windows [REVIEW: counsel] |
| Institutional source data (grades, rosters) | None flows in production | n/a | no adapters registered | [VERIFIED] `docs/DATA-RETENTION-EXPORT-DELETION.md` |

## 3. Account deletion

[VERIFIED] flow from `docs/DATA-RETENTION-EXPORT-DELETION.md` and `RETENTION.md`:

1. The student confirms deletion in the app; the `delete-account` Edge Function verifies the caller's token itself.
2. It calls `erase_account(uuid)` (service role only), refused up front when a legal hold covers the account.
3. In one transaction it runs every `forget_my_*` function and then the mapped rows (`private.account_data_map()`, derived from foreign keys to `auth.users`), writes a non-identifying `data_requests` row, then deletes the auth user.
4. Kept on purpose: messages other people still read (gaps, not unidentifiable authors); financial records (7 years); `support_access_event`; `data_requests` completion record.
5. Known limitation: four history tables refuse UPDATE, so a staff account that ever wrote to them cannot be erased; `erase_account` fails closed rather than half-deleting.

Not covered: files held only on the device (IndexedDB attachments); provider-side copies (AI provider, email provider) - no propagation evidence (TR-22); backups (expiry only).

## 4. Customer termination and offboarding

- Student accounts at a departing school are not touched by disabling access; students keep accounts and can export (`docs/SCHOOL-OFFBOARDING.md`).
- School offboarding is eight steps with two-sided approval (propose, preflight inventory, approve by the other side, record student notice, disable access, record and verify export by two operators, archive at least 30 days, authorize purge). **Built, never used on production; rehearsed once on synthetic data on a hosted preview** ([VERIFIED] `docs/evidence/offboarding/2026-09-30-hosted-preview-rehearsal.md`).
- Open: the purge itself is not built; the export file is generated elsewhere; the retention window is counsel's decision; provider secrets must be rotated by a person.
- Contract language: the return-and-destroy terms live in the DPA and the exhibit draft, which counsel has not approved. HELD.

## 5. Backup expiry and deletion tail

A deleted row outlives its deletion by at most the backup retention (7 days if the plan-tier figure is confirmed) and then by nothing, except after a restore from a backup that predates the deletion: `RESTORE.md` therefore carries a step to re-apply deletions made after the backup point. A student's own deletion leaves a row-count record with no account, so a self-deletion inside the window cannot be replayed from anything in the tree; the step says to tell every account that existed in the window. A durable deletion record kept outside the database was considered and not built (D-124). Holds do not reach provider backups (TR-23). [VERIFIED] `RETENTION.md` Backups section; value [ASSUMPTION] until read from the dashboard.

## 6. Support tickets, exports, logs

- Support tickets: behind a feature flag that is off (TR-37); identity-free queue; context keys start unticked; per-ticket email notices off by default and carry no reply text. Closed-ticket period unset (TR-37).
- Exports: `export_my_data()` walks the same catalogue-derived map as erasure and writes an `audit_event`; device-held files are outside it; a single full-account file does not exist (TR-45).
- Logs: see the matrix; there is no protected incident evidence store (TR-43).

## 7. Data-subject and access request workflow

Status per [VERIFIED] `docs/DATA-RIGHTS-REQUEST-RUNBOOK.md`: intake built, answering not built, no one named to answer, no response time agreed.

| Step | Built? | Notes |
| --- | --- | --- |
| 1 Intake by the signed-in subject only; subject and tenant derived server-side; starts `received`; due-date column defaults to 30 days (an internal default, not a response time) | Yes | `supabase/audit-and-subject-requests.check.sql`; `app/src/lib/data-rights.ts` |
| 2 Daily queue check by the privacy owner ordered by `due_at` | No | No operator surface |
| 3 Verify identity and authority (no password or government id requested) | No | Procedure in `docs/privacy-operations/02-SUBJECT-RIGHTS-WORKFLOW.md` |
| 4 Check legal holds before export, restriction, erasure | Partly | Holds exist in the database; operator step not built |
| 5 Perform the bounded action (export/correct/restrict/erase) | Partly | Self-service export and erase exist; assisted paths do not |
| 6 Record completed/refused with reason and appeal route | No | No transition writes an audit event today |
| 7 Confirm requester can see the outcome in the app | No | |
| Escalation at 7 days and 2 business days | No | Runbook text only |

The response clock and refusal grounds are counsel decisions (P-03) [REVIEW: counsel]. Do not state a response time externally.

## 8. Verification of deletion and evidence

Proposed verification checklist [DRAFT]; none of it has been run end to end on an authorized target.

| Check | How | Evidence to file under `docs/evidence/` | Status |
| --- | --- | --- | --- |
| Repository proof of erase coverage | `supabase/deletion.check.sql` runs in CI against throwaway PostgreSQL | CI run link on a frozen candidate | Verified-repository; hosted run per candidate |
| Real-function run with a synthetic account | Create synthetic account with data in every owned table, call `delete-account`, then query | Dated record with row counts before/after; includes a held account and an account with community content (TR-08) | Not evidenced |
| Export completeness | Compare `export_my_data()` to `account_data_map()` for the synthetic account | Dated record | Not evidenced |
| Backup tail | Read the dashboard backup window; record date and owner in `RESTORE.md` table | Dated reading | Not evidenced |
| Restore plus replay | Restore into the second project; re-apply deletions step; confirm deleted rows absent | `docs/evidence/restore/` record (TR-10) | Not evidenced |
| Provider propagation | For each subprocessor with data: confirm deletion behaviour in terms; test where possible | Vendor review file | Not evidenced (TR-22) |
| Offboarding | Run steps on a synthetic school on an authorized target with two humans | Record naming witnesses (blocker 7) | Not evidenced (preview rehearsal by one author only) |

## 9. Reconciliation with existing documents

| # | Observation | Treatment |
| --- | --- | --- |
| R-1 | The trust register's retention table says billing records "None exist; billing stays out (D-009)", while `RETENTION.md` and `supabase/financial-retention.check.sql` define a seven-year financial class (commercial core exists, payments inactive until keys are set) | This plan follows RETENTION.md; flagged for TR-04 |
| R-2 | The trust register describes legal hold as owed; `supabase/legal-holds.check.sql` and `legal_holds` exist (TR-04 records the contradiction) | This plan treats holds as Partially evidenced (CER-B14) |
| R-3 | The trust register says no process reads backups and nothing is customer-configurable | Agrees with RETENTION.md |
| R-4 | `docs/legal/DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md` is not in force and carries `[DECIDE]`/`[VERIFY]` items; RETENTION.md wins on disagreement | No public retention wording until counsel signs off |
| R-5 | The RFP library says retention is "Available now" (PF-2); this plan agrees only for the repository schedule | Wording in [SECURITY_QUESTIONNAIRE_LIBRARY.md](SECURITY_QUESTIONNAIRE_LIBRARY.md) SQ-D01 |
| R-6 | `site_leads` has no purge; the company site's forms could go live before a period is set | Gap; decide period first |

## 10. Decisions needed from counsel and the founder

1. Response clock for rights requests (P-03) and refusal grounds [REVIEW: counsel].
2. Closed-ticket, site-lead and incident-evidence periods (proposals above) [REVIEW: counsel].
3. Post-termination archive and purge windows and the contract language [REVIEW: counsel].
4. Whether to reopen D-124 (no deletion ledger) [REVIEW: counsel].
5. Backup-hold procedure (TR-23).
6. Who answers requests and the backup (TR-12, TR-20).

## Evidence state

Retention clocks cite migrations, functions and schedules at `5eba494`. No deletion, restore or offboarding has been run against a production or customer target. The focused database suites could not run on the P02 validation host (no PostgreSQL 17), per `docs/DATA-RETENTION-EXPORT-DELETION.md`.

## Claim ceiling

Permitted: "Repository schedules and automated tests cover defined database retention and deletion paths." Not permitted: complete deletion, verified backup expiry, universal retention legality, provider propagation, whole-tenant offboarding, any contractual deletion time.

## Prohibited claims

FERPA/COPPA/GDPR compliance, "all data deleted within N days", certificate of destruction, guaranteed backup purge, data residency, "we never keep your data".

## Professional review required

Counsel [REVIEW: counsel] for every period and the request clock; privacy lead [REVIEW: privacy] for purposes; tax adviser [REVIEW: tax] for the financial class; security reviewer [REVIEW: security] for log and evidence handling. None named in the repository.
