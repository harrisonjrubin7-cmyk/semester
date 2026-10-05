# ADR-0017 · Retention, legal holds, rights requests, export and offboarding hang off one per-table data class

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Privacy and data-governance owner (founder until another is named) |
| Deciders / reviewers | Founder; security owner; counsel for retention, hold, rights-request clock, cross-border and erasure design (counsel required) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 gate "every table has a retention, export and erasure disposition" |
| Related | [`database/DATA_CLASSIFICATION_REGISTER.md`](../../../database/DATA_CLASSIFICATION_REGISTER.md); [`docs/DATA-RETENTION-EXPORT-DELETION.md`](../../DATA-RETENTION-EXPORT-DELETION.md); [`docs/DATA-PORTABILITY-AND-OFFBOARDING.md`](../../DATA-PORTABILITY-AND-OFFBOARDING.md); [`RETENTION.md`](../../../RETENTION.md); `docs/legal/DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md`; ADR-0015, ADR-0018, ADR-0020; legal rows Q-08, Q-02, Q-04, Q-17, P-03, P-07, P-08, P-09, P-18 |
| Supersedes / superseded by | — |

> **Counsel required.** Retention periods, legal hold and law-enforcement procedure, rights-request clocks, backup-tail position, seven-year financial records, cross-border transfer and minors' data: `LEGAL_REVIEW_QUEUE.md` Q-08, Q-04, Q-17; `docs/privacy-operations/07-COUNSEL-REVIEW-QUEUE.md` P-03, P-07, P-08, P-09, P-18. Periods below are placeholders for counsel, not commitments.

## Context
- Classification is by tenancy shape, not by sensitivity: 354 objects in 8 classes (tenant-scoped 155, service-only 77, relationship-scoped 55, person-private 46, ...); 335 of 354 were not read by a person; "retention, export, deletion and legal-hold behaviour per table ... are not recorded here" (`database/DATA_CLASSIFICATION_REGISTER.md`; guard `app/src/lib/tableclassification.test.ts` compares names only).
- Retention is a per-table schedule `RETENTION.md` held by `app/src/lib/retention.test.ts`; audit tables 3 years via `private.sweep_audit_retention()`, `access_log` 90 days, financial 7 years (`purge_financial_records`, D-132) (`docs/DATA-RETENTION-EXPORT-DELETION.md`; `20260929030000_retention_sweeps.sql`, `20260929130000_financial_retention.sql`).
- Legal holds exist: `20260930100000_legal_holds.sql` (`legal_holds` on account, tenant or platform; reason and matter required; `hold:place` capability), `20260930130000_hold_gated_sweeps.sql`, `20260930170000_hold_aware_sweeps.sql`, `20261004150000_holds_reach_the_last_three_sweeps.sql`, `20260930140000_erase_respects_holds.sql`; checks `supabase/legal-holds.check.sql`, `hold-aware-sweeps.check.sql`, `hold-blind-sweeps.check.sql`, `hold-gated-sweeps.check.sql`. Law-enforcement procedure is draft only (Q-17).
- Export: `public.export_my_data()` walks `private.account_data_map()` (every FK to `auth.users`), `20260929010000_account_erasure_and_export.sql`; guardian-restriction withholding `20261004160000_export_withholds_guardian_restrictions.sql`. No single archive including device-held files (gaps G-01/G-05, `docs/DATA-PORTABILITY-AND-OFFBOARDING.md`).
- Erasure: `erase_account(uuid)` via `delete-account` function; four history tables refuse UPDATE so a staff account that wrote to them cannot be erased (fails closed) (`docs/DATA-RETENTION-EXPORT-DELETION.md`). Neither `erase_account` nor the export definers reference an audit event in their defining migrations (findings-database #9).
- Rights requests: `data_subject_request` table, 30-day due date, "no screen ... no one is named to answer" (`docs/DATA-RETENTION-EXPORT-DELETION.md`; `supabase/audit-and-subject-requests.check.sql`).
- School offboarding: `20260930200000_school_offboarding.sql` with `supabase/school-offboarding.check.sql`; 125 tenant tables referenced `schools` with `on delete cascade` before it (migration header).
- Public copy: "no archive kept after you delete your account" (`app/src/lib/privacy.ts:231`; claim C-13) vs a backup tail (`RETENTION.md`); restore never exercised on the live project (findings-platform #1).

## Problem
How does one record per table (class, owner of the data, retention, hold behaviour, export inclusion, erasure disposition, offboarding disposition) become the single source that sweeps, export, erasure and offboarding read and that tests hold in both directions?

## Decision drivers
1. No table without a disposition (a new table must fail a build).
2. A hold stops every deleter, including erase and offboarding (hold-blind sweeps are a measured failure class).
3. The student-promise set stays true: work never aged out; export and deletion free; delete removes what the account owns.
4. Evidence of each rights action in a tenant-queryable audit.
5. Periods are counsel's; the mechanism must make them parameters.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Keep `RETENTION.md` prose plus separate registers | Exists; tested | Registers cover different table subsets; export/erase lists derived from FKs, retention from prose | Not chosen: drift |
| B. Add sensitivity classes to the existing JSON register and extend it with disposition columns | One file; guard already exists | Rule-derived classes need human review per table | **Recommended** (reviewed in tranches) |
| C. Column-level tagging in the catalog (comments) | Close to the data | Harder to review; needs migration per column | Later, for personal-data columns only |
| D. Buy a data-governance product | Features | Cost; repository is the source of truth | Not chosen |

## Decision
**Recommended, unratified.** (1) Extend `database/schema/table-classification.json` with required fields per table: `sensitivity` (public, internal, personal, education-record, financial, safety), `data_owner` (person, school, platform), `retention` (parameter name in `RETENTION.md`), `hold_behaviour`, `export` (in/withheld/with reason), `erase` (delete/keep/anonymise with reason), `offboard` (export/delete/retain). `tableclassification.test.ts` fails on a table missing any field. (2) Sweeps, `erase_account`, school offboarding and `account_data_map()` must all consult `legal_holds` (one function) and a check enumerates every deleter. (3) Every rights action (export, erase, correct, restrict, school offboard step, hold place/release) writes a tenant-queryable audit event through one writer. (4) Rights-request answerer, clock and screen are named by the owner and counsel before any promise is shown (P-03). (5) Backup tail, "no archive" wording and regional placement are counsel decisions recorded before the copy is changed. Not ratified.

## Consequences
Positive: one answer to "what happens to this table". Negative: 335 tables need review in tranches; periods block on counsel. Harder: adding a table casually.

## Impact
- **Data / tenancy:** adds disposition per class; school-owned records outlive a student's account (kept, with reason).
- **Security:** hold and erase paths are service-only definers; audits go to the tenant.
- **Privacy:** purpose-limiting sensitivity labels; minors (Q-04, P-06) and cross-border (P-18) are counsel items.
- **Accessibility:** rights-request screen, when built, follows existing a11y contracts; not assessed.
- **Operations (SLO, alert, runbook, support):** answerer and 30-day clock need an owner; runbook `docs/trust/DATA-SUBJECT-REQUEST-RUNBOOK.md` exists.
- **Cost / commercial:** storage entitlement and offboarding export are commercial promises (ADR-0016).

## Implementation
1. Add fields to the JSON and `tableclassification.test.ts`; classify the 19 hand-read and `person-private` tables first. 2. Generate the per-table section of `RETENTION.md` from the register. 3. One `private.record_rights_audit` writer; call from `erase_account`, `export_my_data`, offboarding, hold place/release (migration, forward-only). 4. Add deleter-enumeration check. 5. Name answerer.

## Tests and verification
- `app/src/lib/tableclassification.test.ts`: add a table without disposition; must fail (shown by adding one).
- `supabase/rights-audit.check.sql` (proposed): erase an account; a tenant-queryable audit row exists; fails against today's migration (no audit reference). Control: same account on hold is not erased and the refusal is audited.
- `supabase/hold-all-deleters.check.sql` (proposed): place a tenant hold, run every sweep, erase and offboard; zero rows deleted.
- Export parity: every non-withheld FK table appears in the export (`erasure.test.ts` extension).

## Fitness functions
- `rls-coverage` (#3): new table cannot pass without class and disposition; `scripts/architecture/table-disposition.mjs`.
- `audit-outbox` (#8): fails when a rights action lacks an audit row.
- `check-adr-links` (#1): this ADR's links resolve.
- `restore-drill-freshness` (#17): backup-tail claims depend on a restore drill.

## Rollback / reversal
Fields are additive. Erasure and purge are irreversible after the sweep; holds are releasable. Offboarding is restorable until `archived`.

## Open questions
Backup tail duration; seven-year period applicability; who answers rights requests; per-table sensitivity for 335 unread tables; whether `public.audit_event` should be tenant-queryable by schools.

## Addenda
None.
