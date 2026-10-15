# ADR-0019 · Official records, grades, registration and money each have one system of record, with append-only history and an audit reference on every sensitive write

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Records and data-architecture owner (founder until another is named) |
| Deciders / reviewers | Founder; institution registrar/customer (per tenant); security owner; counsel for student-record role, guardian access and any held-funds ledger (counsel required) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 gate "no write-enabled pilot without audit on sensitive mutations"; Phase 2 for passback |
| Related | [`docs/architecture/data-architecture/02-source-of-truth-matrix.md`](../../architecture/data-architecture/02-source-of-truth-matrix.md); [`docs/architecture/native-baseline-and-connected-mode.md`](../../architecture/native-baseline-and-connected-mode.md); `docs/LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md`; ADR 0008 (outbox); ADR-0015, ADR-0017; legal rows Q-04, Q-13, Q-14, P-14, P-21 |
| Supersedes / superseded by | — |

> **Counsel required.** Whether Semester is a school official or vendor for the records, the right to inspect records, guardian access, and any student-account/held-funds ledger: `LEGAL_REVIEW_QUEUE.md` Q-04, Q-13, Q-14; `docs/privacy-operations/07-COUNSEL-REVIEW-QUEUE.md` P-14, P-21.

## Context
- Precedence is a label, not a rule: `SOURCE_OF_TRUTH: Record<ProviderDomain, string>` (`app/src/lib/integration/catalog.ts:125-132`, 21 domains) is display text; "No code ranks two competing values"; the only automatic conflict rule is `timestamp_regression` (`pipeline.ts:248`) (`02-source-of-truth-matrix.md` §2.1).
- Native baseline: the student's grades are "a personal tracker labeled student-owned/unofficial"; no verified SIS/LMS grade feed; "exclude raw grades from default offline storage" (`native-baseline-and-connected-mode.md`).
- Academic ledger exists: `supabase/migrations/20260929210000_academic_record_ledger.sql` (D-145; `academic_record_changes` proposed by one person and approved by another, trigger writes `academic_record_entries`), hash chaining `20260930110000_ledger_chains.sql`, seals `20260930150000_ledger_chain_seals.sql`; checks `supabase/ledger-chains.check.sql`, `ledger-seals.check.sql`.
- Registration: `20260929300000_registration_transaction.sql` (registrar sets calendar and sections; enrol, waitlist, drop, withdraw, overrides); pure model in `app/src/lib/enrollment/` written to agree with it; `supabase/registration_transaction.check.sql`.
- Gradebook: `20260929310000_gradebook.sql` (weighted categories, append-only scores, moderation, release, regrade, registrar export, LMS passback queue); `app/src/lib/gradebook/`; `supabase/gradebook.check.sql`. The migration has 0 matches for `record_audit|audit_event|ledger_append|gateway_write_audit|_audit` including `gradebook_export` (findings-database #9, `tenant-boundary-map.md` §5).
- Outbox: one producer, `20261004123000_productivity_commands.sql:351`; registration, gradebook passback, billing and dining publish nothing (findings-database #10; ADR 0008, `docs/platform/EVENTS-AND-OUTBOX.md`).
- Money: financial records kept seven years (`20260929130000_financial_retention.sql`, `supabase/financial-retention.check.sql`); institution billing `DOCUMENTED-UNIMPLEMENTED`; a student-account ledger, payment plan or swipe pool is a counsel question (`docs/MONEY-MODULES-SWITCH-ON.md`, Q-13).
- Integration adapters register mocks only (`app/server/integration/registry.ts`); no verified tenant feed.

## Problem
For each record domain (identity, course/section, enrolment, grade, financial), which system is authoritative per tenant, what happens on conflict, and what must every authoritative write record so a correction never deletes history?

## Decision drivers
1. Semester never claims an official record it does not hold or has not read back (`docs/operating-model/PILOT-TO-PRODUCTION.md` rule).
2. History is append-only; correction is a new row with a reason.
3. Every sensitive mutation has a tenant-queryable audit reference.
4. Conflicts between Semester and a connected provider are explicit, not last-writer-wins.
5. Exports and passbacks are receipts, not assumptions.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Semester is system of record for all domains | Simplest | Contradicts institutions' SIS authority; no verified feed to compare | Not chosen |
| B. Provider (SIS/LMS) always wins; Semester mirrors | Matches "official records remain authoritative" | Gradebook and registration tables become mirrors; their authority code is dead | Not chosen as sole rule |
| C. Per-tenant, per-domain authority record (`semester` / `provider` / `shared-with-approval`), default `provider` for registration and grades until a gate says otherwise; append-only history and audit on every write | Honest and reversible; uses existing ledger | Needs a tenant authority table and conflict handling | **Recommended** |
| D. Event-sourced everything | Strong audit | Large rewrite; not needed for pilot | Not chosen |

## Decision
**Recommended, unratified.** (1) Add a per-tenant, per-domain authority setting (domains from `catalog.ts`), default `provider` for enrolment and grades; only a tenant at `pilot write-enabled` or higher (ADR-0015) may select `semester`. (2) A change to an authoritative record is a proposed row approved by a second person (the ledger rule, extended to grade release and registrar export). (3) Each sensitive mutation (grade enter/release/export, registration override, record change, role change, erase, data export) calls one audit writer with actor, tenant, subject, before/after reference and correlation id; a sweep check requires it. (4) Each such mutation also writes a domain outbox event in the same transaction (ADR 0008); registration and gradebook passback first. (5) Provider-side writeback is accepted as done only when the authoritative readback matches (receipt); otherwise state is `unverified`. (6) A held-funds ledger is not built until counsel answers Q-13 and ADR-0024's processor principle holds. Not ratified.

## Consequences
Positive: no ambiguous "which grade is real". Negative: default-`provider` authority limits what a pilot can do on day one; outbox work for two domains. Harder: letting an instructor edit a released grade without a second person.

## Impact
- **Data / tenancy:** new authority table keyed by tenant and domain; audit and outbox rows carry `tenant_id`.
- **Security:** second-person approval is a definer-enforced rule; forged-id tests for admin categories (findings-database #13).
- **Privacy:** education records; access, correction and guardian rules are counsel's (P-14, Q-14).
- **Accessibility:** gradebook and registration UI need accessibility evidence; none claimed.
- **Operations (SLO, alert, runbook, support):** reconciliation reports for passback failures; incident reconstruction uses the audit (ADR-0018).
- **Cost / commercial:** gradebook/registration entitlements keyed in the price book (ADR-0016).

## Implementation
1. Migration: `tenant_record_authority`. 2. One `private.record_audit`-based writer applied to gradebook, erase, export (forward-only migrations; do not edit shipped ones). 3. Outbox rows for registration and passback. 4. Conflict reporting in `pipeline.ts` for authority-disagreeing values. 5. Update `02-source-of-truth-matrix.md` from code.

## Tests and verification
- `supabase/audit-sensitive-mutations.check.sql` (proposed): enter, release, export a grade; each leaves an audit row for the tenant; fails against today's `20260929310000_gradebook.sql`. Control: a read-only call leaves none.
- Authority test: a `provider`-authority tenant cannot release a Semester grade as official.
- Second-person test: proposer approving own change is refused (exists for the ledger; extend to release).
- Outbox test: passback enqueue and event row are in the same transaction (roll back one, both vanish).

## Fitness functions
- `audit-outbox` (#8): fails if any sensitive definer lacks an audit reference; `scripts/architecture/audit-outbox.sh`.
- `definer` (#4): forged-id test for the new definers.
- `integration-contracts` (#10): passback reconciliation evidence required before authority `semester`.
- `tenant-boundaries` (#5): authority and audit rows pass the negative suite.

## Rollback / reversal
Authority can be switched back to `provider` while history is retained. Rows written while `semester` was authoritative cannot be unwritten; this is why write-enable is gated.

## Open questions
Which registrar/SIS connector a pilot uses; whether any production tenant uses gradebook (not inspected); official vs unofficial labelling in student view; whether outbox consumers exist.

## Addenda
None.
