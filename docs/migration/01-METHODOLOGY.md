# 01 Methodology

## 1. Principles

1. **Prove correctness, not arrival.** Seven evidence classes
   ([README](README.md#the-one-rule)); a domain needs all seven.
2. **The institution signs for its own data.** Semester cannot attest that the
   bursar's ledger is right; the bursar can. Every gate names the institution
   approver for the domain ([06 §2](06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).
3. **Nothing is dropped silently.** A source field is mapped, or declared
   dropped with a reason. A failure is queued, not discarded. A record out of
   scope is descoped by a named approver.
4. **The past comes with the record.** Original timestamps, actors and ordering
   survive; a "created by migration" stamp on a grade change is a failure.
5. **Rehearse the real thing.** Full-scale, timed against the real window,
   with rollback actually performed.
6. **Know the point of no return.** Before students write new data into
   Semester, rollback is full. After, it is only as good as the verified
   replay, and otherwise the plan is to roll forward.
7. **No student data in the evidence.** Evidence holds digests, opaque
   references and counts. A reviewer can audit it without being able to read a
   student ([06 §4](06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).
8. **Additive.** Semester's existing rule applies: nothing is renamed or
   deleted, the previous build must still read what the new one wrote
   ([`DATA-MIGRATION-PLAN.md`](../DATA-MIGRATION-PLAN.md),
   [`ROLLBACK.md`](../../ROLLBACK.md)).

## 2. Stages

The stages are the Migration Center's twelve, unchanged; this pack adds what
each must produce. `center.ts` `STAGES` is the source for the names.

| # | Center stage | This pack adds | Doc |
| --- | --- | --- | --- |
| 1 | inventory | Source inventory sheet, extraction method per entity, cutoff, owner | [02](02-SOURCE-INVENTORY-AND-EXTRACTION.md) |
| 2 | classification | Sensitivity per entity, retention owner, counsel flags | [02 §4](02-SOURCE-INVENTORY-AND-EXTRACTION.md) |
| 3 | mapping | Mapping spec with code tables, declared drops, lineage | [03](03-MAPPING-CLEANSING-TRANSFORMATION.md) |
| 4 | cleaning | Cleansing rules, duplicate rule, data-quality baseline | [03 §3](03-MAPPING-CLEANSING-TRANSFORMATION.md) |
| 5 | preview | Preview on a sample, issues reviewed with the data steward | [03 §5](03-MAPPING-CLEANSING-TRANSFORMATION.md) |
| 6 | sample_import | Import of a full sample; first semantic run | [04](04-VALIDATION-AND-RECONCILIATION.md) |
| 7 | validation | Semantic gate on every evidence class; exceptions queued | [04](04-VALIDATION-AND-RECONCILIATION.md) |
| 8 | reconciliation | Same gate against the live target, plus outcomes recomputed | [04](04-VALIDATION-AND-RECONCILIATION.md) |
| — | *(rehearsal)* | Not a Center stage today; evidence in the ledger | [05 §1](05-REHEARSAL-PARALLEL-RUN-CUTOVER-ROLLBACK.md) |
| 9 | parallel_run | Daily outcome comparison with named calendar events | [05 §2](05-REHEARSAL-PARALLEL-RUN-CUTOVER-ROLLBACK.md) |
| 10 | cutover | Go/no-go, rollback plan with triggers and point of no return | [05 §3](05-REHEARSAL-PARALLEL-RUN-CUTOVER-ROLLBACK.md) |
| 11 | archive | Legacy archive and export, retention and holds carried | [06 §5](06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md) |
| 12 | monitoring | Post-cutover checks, hypercare, acceptance | [06 §3](06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md) |

The Center's database already refuses a stage move without its evidence, and
its screen locks field-map edits after the cleaning stage (`mapsEditable`). This pack does not duplicate those
gates; it makes the evidence they accept meaningful (`bridge.ts`).

## 3. Roles

| Role | Held by | Does | Cannot |
| --- | --- | --- | --- |
| Migration lead | Semester | Prepares evidence, runs rehearsals, chairs the daily exception stand-up | Sign off evidence they prepared |
| Independent reviewer (`semester_reviewer`) | Semester, not on the migration team | Reviews the evidence and signs the Semester side of each gate | Be a preparer |
| Semester security (`semester_security`) | Semester | Signs rehearsal and cutover on access, secrets, logging | — |
| Data steward | Institution | Owns exceptions in the queue for their domain, resolves source defects | Verify their own fix |
| Domain approver | Institution: `it`, `registrar`, `finance`, `faculty`, `data_owner` (the Center's `ApprovalArea`s) | Signs mapping, validation, parallel-run exit, cutover and acceptance for their data | — |
| Executive sponsor | Institution | Signs go/no-go and acceptance | — |
| Qualified counsel | Institution and Semester, separately | Decides legal questions the gates flag | Be replaced by this pack |
| Records manager | Institution | Retention, legal hold, archive | — |

Domain → approver is `DOMAIN_OWNER` in `signoff.ts` and appears on each
workbook page.

## 4. Gates

Seven gates, in `signoff.ts` `GATES`. A gate is open when its evidence passes
the data-quality gate **and** every required role has a current, distinct,
non-preparer approval bound to that evidence.

`mapping_approved` → `validation_passed` → `rehearsal_passed` →
`parallel_run_exit` → `cutover_go` → `post_cutover_acceptance` →
`archive_complete`.

## 5. Cadence

- **Daily during validation, rehearsal and parallel run:** exception
  stand-up, ordered by severity and overdue (`exceptions.ts` `overdue`).
  Criticals owe an owner in 4 hours and a fix in 24.
- **Per rehearsal:** the gate is re-run in full. A rehearsal that was not
  passed is not "nearly ready"; it resets the consecutive count.
- **Weekly:** steering with the executive sponsor; status is the gate state,
  not a percentage.

## 6. What stops the line

Any of: an open critical exception; access widened beyond the source; a
ledger variance; a failing sign-off that has gone stale; evidence ledger that
no longer verifies; a rehearsal older than the staleness limit; no
observation for a rollback trigger during cutover.
