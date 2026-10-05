# Semester migration factory

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** The factory is a procedure plus tooling that exists in the repository. **It has never run against a real institution's data.** The only rehearsals are synthetic: `docs/evidence/offboarding/2026-09-30-hosted-preview-rehearsal.md` (rolled-back transaction, run by the author) and the CI restore rehearsal. No migration has been reconciled, approved by an institution, or cut over. A migration claim must cite a run record produced by this procedure.

The doctrine: **replace only with proof**. A migration is the proof step between "connected" and "authoritative". It is a repeatable factory, not a project: the same eight stations for every domain and every institution, with the domain playbooks differing only in what they read and what they compare.

## What exists

| Piece | Where | State |
| --- | --- | --- |
| Migration tables (projects, runs, field maps, approvals) | `migration_*` in `supabase/migrations/` | Built |
| Migration Center (staff UI) | `app/src/components/institutional/MigrationCenter.tsx`; `app/src/lib/migration/` (36 files, 15 tests) | Built; flag `migrationCenter` preview only |
| Roster pipeline | `private.roster_*` (5 tables); `app/server/integration/` | Built; no real roster |
| Integration control plane, lineage, freshness | `app/src/lib/integration/` (49 files) | Built |
| Sync simulation sandbox | `docs/SYNC-SIMULATION-SANDBOX.md`, `private.integration_simulation_runs` | Built |
| Reconciliation tables and quality rules | `integration_reconciliation`; `docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md` | Built |
| Offboarding and portability | `school_offboarding(_undo)`; `docs/SCHOOL-OFFBOARDING.md`, `docs/DATA-PORTABILITY-AND-OFFBOARDING.md` | Rehearsed synthetically |
| Plans | `docs/DATA-MIGRATION-PLAN.md`, `docs/ADDITIVE-UNIVERSITY-OS-MIGRATION-PLAN.md`, `docs/platform/MIGRATION.md` | Documents |

Not found: a connector to any real SIS or LMS; a transcript or credential exchange standard; a checksum-based reconciliation report generated from real data; a signed change record template in use.

## The eight stations

```
M0 Intake → M1 Inventory → M2 Map → M3 Rehearse → M4 Reconcile → M5 Dual-run → M6 Cut over → M7 Hold → M8 Retire/Exit
```

| Station | Purpose | Inputs | Outputs (all in `docs/evidence/` or the tenant's record) | Exit gate |
| --- | --- | --- | --- | --- |
| M0 Intake | Agree what moves and why | Signed pilot agreement; named owners both sides | Scope statement; domain list; units (course, term, cohort); success criteria | Institution sponsor and Semester owner sign; counsel has approved the data scope |
| M1 Inventory | Know the source | System export or API access; data dictionary | Source inventory with data classes; volume; quality profile | Every field has an owner and a class; unknown is treated as T3 |
| M2 Map | Decide how fields land | Inventory; Semester model | Field map with transforms; lineage; excluded fields and why | Reviewer who is not the author signs the map |
| M3 Rehearse | Prove the mechanism without effect | Map; a de-identified or synthetic extract | Sandbox run record; error catalogue; timing | Zero unexplained errors on the rehearsal set; a rollback of the rehearsal works |
| M4 Reconcile | Prove the data agrees | A real extract in a staging tenant | Reconciliation report: counts, checksums, field-level differences, exceptions with owner and disposition | Exception queue empty or each item accepted in writing |
| M5 Dual-run | Prove outcomes agree | A live unit with the source still authoritative | Daily comparison of outcomes (see domain table); incident log | Agreed number of consecutive clean units (default: one full term for records, one registration window for registration) |
| M6 Cut over | Move authority | Signed change record; two-person approval | Effective-dated authority change; source set read-only; announcement | Rollback rehearsed within 90 days; support staffed; named steward |
| M7 Hold | Keep the way back open | Source read-only | Rollback window (default: one term); nightly reconciliation continues | No unexplained difference for the window |
| M8 Retire / Exit | Retire the source, or leave | Institution decision | Retirement record, or an export and offboarding certificate | Export verified by the institution; retention applied; legal holds honoured |

## Run record (the evidence artifact)

Every run at every station produces one file, so a claim can cite it. Stored under `docs/evidence/migration/<tenant>/<domain>/<station>-<date>.md` (tenant folder only for synthetic or consented data; a real customer's record lives in the customer-controlled evidence store, referenced by hash).

```yaml
run_id: mig-<tenant>-<domain>-<station>-<yyyymmdd>-<n>
tenant: <schools.id>
domain: <D-id from the domain catalog>
station: M0..M8
operator: <person>            # who ran it
reviewer: <person>            # must differ from operator
source: {system, version, extract_at, extract_hash}
target: {environment, schema_version, migration_id}
scope: {units: [...], row_counts: {...}}
result: {rows_in, rows_out, rows_rejected, exceptions_open, exceptions_accepted}
checks: [{name, expected, actual, pass}]
rollback_tested: true|false   # and when
data_classes_touched: [T3, ...]
approvals: [{role, person, at}]
claim_ceiling: "<what this run does and does not prove>"
```

## Reconciliation report (schema)

```json
{
  "run_id": "…",
  "level": "count | checksum | field | outcome",
  "entities": [
    {
      "entity": "enrollment",
      "source_count": 0, "target_count": 0, "delta": 0,
      "checksum_source": "…", "checksum_target": "…",
      "differences": [{"key": "…", "field": "…", "source": "…", "target": "…", "class": "format | stale | rule | defect | unknown", "owner": "…", "disposition": "fix | accept | defer", "accepted_by": "…"}]
    }
  ],
  "unknown_count": 0,
  "verdict": "clean | clean-with-accepted | blocked"
}
```

A report with any `unknown` is `blocked`. An accepted difference needs a named person and a reason, and the Master Register will not count the station as passed without both.

## Change record (signed at M6)

```yaml
change_id: CC-<pr or sequence>
tenant: …
domain: …
authority_from: <source system>
authority_to: Semester
effective: <timestamp, timezone>
policy_versions: {…}
approvers: [<institution officer>, <Semester owner>, <second Semester person>]
evidence: [<run ids M3..M5>]
rollback: {procedure: …, tested_at: …, trigger: …, decision_owner: …}
communications: {students: …, staff: …, support: …}
```

`infra/changes/CC-<pr>.md` already holds the repository's infrastructure change records; this is the same discipline for data authority.

## Domain playbooks

What each station reads and compares. Where "outcome" is named, that is the dual-run comparison.

| Domain | Source | M4 compares | M5 outcome compare | Special risk | Rollback shape |
| --- | --- | --- | --- | --- | --- |
| D26 Identity | IdP directory | Accounts, status, groups | Sign-in success, deprovision timing | Orphaned access; wrong tenant | Re-enable email-domain sign-in |
| D27 Integrations | Source API | Sync counts, freshness | Source vs Semester view for sampled users | Drift | Pause connector |
| D04 Courses | LMS course export (QTI 3, cartridge) | Items, rubrics, files, links | Student sees the same assignments; due dates match | Silent loss of formatting or accessibility | Relaunch the LMS course |
| D05 Gradebook | LMS gradebook | Every grade, weights, drops, extensions | Final course grade equality | A single wrong grade | Source stays authoritative until zero unexplained differences |
| D10/D11 Registrar and records | SIS | Terms, sections, programs, student record entries | Record agreement after a term; transcript totals | Effective dating; corrections | Source remains system of record for rollback window |
| D12 Registration | SIS registration | Seat counts, waitlists, holds | One registration window: seats and outcomes equal | Over-enrolment; load at open | Close native submit; re-point to SIS |
| D03 Degree planning | Degree-audit system | Remaining credits per student | Audit agreement rate by program | Rule misinterpretation | Label returns to institution audit |
| D13 Student accounts | Bursar/ERP | Balances, charges, payments | Daily ledger tie-out | Money; PCI scope | Disable new charges |
| D09 Advising | CRM | Appointments, notes (optional) | Appointment completion | Notes sensitivity | Stop writes; export |
| D23 Career | Career platform | Opportunities, profiles | Opportunity count and links | Consent for employer view | Hide employer surface |
| D15–D18 Campus | Office systems | Listings, hours | Spot checks | Staleness | Show source link only |

## Capacity and cost model (per migration)

Estimated from the repository's own structure; **all figures are hypotheses to be replaced by measured values from the first run**.

| Factor | Driver | First estimate |
| --- | --- | --- |
| M1–M2 (inventory and map) | Fields and systems | Days per system for a flat-file source; weeks if API discovery is needed |
| M3 | Error catalogue size | Short if the mapping is small |
| M4 | Reviewer availability on the institution side | The long pole; set by the institution's registrar or data steward |
| M5 | Calendar | A term or a registration window; cannot be compressed |
| M6–M7 | Rollback window | One term |

The factory therefore cannot shorten the calendar for records or registration. The 12-month plan treats the first full migration as a **reading** (M0 to M4 on one read-only domain), not a cutover.

## Control points that stop a run

A station is blocked by any of: an `unknown` in a reconciliation; a reviewer equal to the operator; a missing owner on either side; a data class above the approved scope; a failed rollback test; a legal hold on the data; an open High security finding touching the target tables; a claim in the draft paper stronger than the evidence.

## First three runs

| Run | Domain | Goal | Where |
| --- | --- | --- | --- |
| R1 | D27 roster | M0–M3 for a OneRoster CSV in the sandbox; record a run file | Local and staging; synthetic data |
| R2 | D04 course | M3 round-trip of one QTI 3 bank exported from a sandbox LMS | Sandbox LMS |
| R3 | D26 identity | M3 SSO and SCIM dry-run against a test IdP | Test IdP |

None is a customer migration. They produce the first three real run records, which is the evidence the register currently lacks.
