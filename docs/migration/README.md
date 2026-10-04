# Institutional migration pack

How an institution's existing systems move into Semester without losing,
changing or exposing anything, and how anyone can later prove that. Written
2026-10-04 against `origin/main` `dac31c9`.

**Status: method and tooling, never yet run against a real institution.**
There is no production tenant today (see
[target architecture 09](../target-architecture/09-CONVERSION-PLAN.md)). Every
threshold, window and duration here is a default to be argued with the first
institution, and no rehearsal described here has been executed. Legal
conclusions (what may be migrated, retained, shared or destroyed) belong to
qualified counsel and the institution's records office; this pack marks the
places where that decision is needed and does not make it.

## The one rule

**Row-count equality is not migration success.** A count says a record arrived.
It does not say the record arrived as the same person's, in the same order,
with the same people allowed to read it, producing the same balance or standing
the registrar already certifies. A target can have exactly the right counts and
have swapped two students' transcripts, restamped every grade change with the
migration date, let a guardian read what they could not, and drifted a ledger
by a cent. `checks.test.ts` builds exactly that target and shows the count check
passing while four others fail.

So every check declares what it *proves* — `count`, `key`, `semantic`,
`relationship`, `history`, `permission`, `outcome` — and a domain passes only
when every class has a check that examined something. Counts are necessary and
at most `low` severity; they are never sufficient.

## What already exists, and what this adds

This pack extends two things already on `main`; it does not replace them.

| Already there | Where | What it does | What it cannot do |
| --- | --- | --- | --- |
| **Migration Center** | `app/src/lib/migration/center.ts`, `components/institutional/MigrationCenter.tsx`, `supabase/migrations/20260929200000_migration_center.sql` | Twelve stages (inventory → monitoring), per-tenant projects, field maps, append-only runs, approvals, and a database trigger that refuses a stage move without evidence | Its evidence is counts of one sample file; its `passed` is *generated from counts*. No relationship, history, permission or business-outcome evidence. No exception queue, rehearsal, rollback exercise or evidence integrity |
| **Integration reconciliation** | `app/src/lib/integration/` (`reconcile`, `drift`, `duplicates`, `lineage`, `redact`) | Ongoing provider-to-Semester reconciliation with redacted references | It reconciles a live feed, not a one-time bulk load with a cutover |

| Added here | Where |
| --- | --- |
| Methodology, ten workbooks, acceptance criteria | this directory |
| Check primitives that prove each evidence class | `app/src/lib/migration/checks.ts` |
| The data-quality gate: refuses counts-only, empty probes, critical failures; thresholds tighten only | `gate.ts` |
| Exception queue with owners, SLAs, non-waivable criticals, expiring waivers | `exceptions.ts` |
| Mapping with code tables (no defaults), declared drops, explicit date order, minor units, lineage | `mapping.ts` |
| Tamper-evident evidence ledger | `evidence.ts` |
| Sign-off bound to the evidence, with separation of duties and expiry | `signoff.ts` |
| Rehearsal readiness, rollback mode and decision, parallel-run exit | `rehearsal.ts` |
| The seam: record a semantic run in the Center so its generated `passed` agrees | `bridge.ts` |
| Ten workbooks as data, rendered to Markdown and CSV | `workbooks.ts` → [`workbooks/`](workbooks/README.md) |

## Reading order

1. [01 Methodology](01-METHODOLOGY.md): lifecycle, stages, roles, entry and exit gates
2. [02 Source inventory and extraction](02-SOURCE-INVENTORY-AND-EXTRACTION.md)
3. [03 Mapping, cleansing and transformation](03-MAPPING-CLEANSING-TRANSFORMATION.md)
4. [04 Validation and reconciliation](04-VALIDATION-AND-RECONCILIATION.md): checks, thresholds, exception queue
5. [05 Rehearsal, parallel run, cutover and rollback](05-REHEARSAL-PARALLEL-RUN-CUTOVER-ROLLBACK.md)
6. [06 Acceptance, sign-off, evidence and archival](06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)
7. [Workbooks](workbooks/README.md): identity, academic records, courses, learning content, enrollments, finance, family, campus services, career, documents

## Findings while building this

- **The Center's date cleaning reads `03/04/2025` as March 4, silently.**
  `isoDate` in `center.ts` treats any `a/b/yyyy` as month-first with no setting.
  A source that writes day-first produces valid, wrong dates that pass
  validation. `mapping.ts` refuses a slash date unless the spec says which
  order. The Center is not changed here (its tests and the screen pin the
  current behaviour); a follow-up should add the same setting there.
- **The Center has no stage for a rehearsal.** Its stages go from
  reconciliation to parallel run. Rehearsal evidence lives in the ledger
  (`evidence.ts`, kind `rehearsal`) until the owner approves a migration that
  adds one; production schema changes need that approval.
- **The Center's pass rule differs by kind of run.** `passes()` gates a
  `validation` run on `rows_failed` and a `reconciliation`, `parallel_run` or
  `monitoring` run only on missing/extra/differing. A structural failure of the
  semantic gate (a class nobody checked) must land where *that kind* looks, so
  `bridge.ts` `toRunCounts(kind, …)` writes it to `rows_failed` for validation
  and to `rows_differing` for the rest. `bridge.test.ts` holds all four kinds.

## Verifying the tooling

From `app/`:

```bash
npx vitest run src/lib/migration            # 114 tests
MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts   # regenerate workbooks/
```

Each guard was reverted in turn and its test watched go red (15 mutations, all
red; one deliberate no-op control stayed green). See
[04 §7](04-VALIDATION-AND-RECONCILIATION.md#7-how-the-tooling-itself-was-proved).
