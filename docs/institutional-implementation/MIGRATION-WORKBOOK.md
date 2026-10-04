# Migration workbook

| Control | Value |
| --- | --- |
| Status | **TEMPLATE — EVIDENCE PATH EXISTS; NO PRODUCTION LOAD PATH EXISTS FOR ANY DOMAIN** |
| Owner | Migration lead seat; approver is a different person in each required area |
| Evidence date | 2026-10-04 at `origin/main` `7287ddc` |
| Used in | [phase 5 (migrate)](METHODOLOGY.md#phase-5--migrate) and [phase 7 (parallel run)](METHODOLOGY.md#phase-7--parallel-run) |
| Built on | Migration Center ([D-144](../DECISION-LOG.md); `supabase/migrations/20260929200000_migration_center.sql`, `app/src/lib/migration/center.ts`), roster staging ([D-160](../DECISION-LOG.md); `20260930220000_roster_import_staging.sql`) |
| Copy to | `docs/evidence/implementation/<tenant-id>/migration-<domain>.md` |

## Read this first: what is and is not built

Two different things are called migration
([`../market-readiness/MIGRATION_PLAYBOOK.md`](../market-readiness/MIGRATION_PLAYBOOK.md)
separates *ours* from *theirs*). That playbook's Part B once said nothing supports
customer data migration. **That was out of date** — it was written before the
Migration Center and roster staging landed — and has been corrected
(see [the finding](#finding-the-playbook-was-stale-corrected)). The precise
state is:

| Capability | State on `main` |
| --- | --- |
| Migration record, twelve gated stages, field maps, runs, approvals, per-stage gate | **Built**, behind the `migrationCenter` flag (off by default) |
| Evidence is counts and the sample's SHA-256; the sample is read in the browser and goes no further | **Built** |
| Dry-run: preview and sample import mapped in the browser with no write | **Built** |
| Roster staging, manifest validation, delta hold, last-known-good rollback | **Built, server-only foundation.** No OneRoster client, no network call, no SIS read; **nothing reads `roster_current`** |
| Load of any domain's records into live Semester objects | **Not built** |
| Per-field provenance on imported values | **Not built** ([`../market-readiness/DATA_READINESS.md`](../market-readiness/DATA_READINESS.md)) |
| Migration of a domain other than rosters | **Not built** |

Consequences, which are rules of this workbook:

1. The Migration Center proves **a mapping works and a file reconciles**. It does
   not move data. "Migrated" is never claimed from its stages.
2. **No production load until a load path exists** for that domain *and* every
   row of [section 6](#6-requirements-for-a-load-path) is met. Until then the
   workbook is used for design, rehearsal and parallel-run comparison only.
3. The counts are the recorder's attributed claim about a file they hold; the
   database cannot re-run them. That is why approvers are other people and why
   the SHA-256 is kept — so a second person can re-run the same file.

## 1. Scope decision (phase 2)

| Item | Decision | Owner |
| --- | --- | --- |
| Domain (`lms`, `registration`, `degree_audit`, `advising`, `student_accounts`, `housing`, `career`, `campus_events`, `communications`, `catalog`, `other`) | | |
| Source system, version | | |
| Direction and what happens to the source afterward (archive, retire, keep authoritative) | | |
| Historical cutoff (history before it is archived, not loaded) | | |
| Who owns the data (a person, not a team) | | |
| Why native Semester objects, not a mirror of the old schema | | |

Principle: students own and understand their data; imported academic facts are
**claims with a source**, not silent overwrites. Where the design says the
institution's record is authoritative, Semester displays it with provenance and
never edits it.

## 2. The twelve stages and what each needs

The database refuses a stage move whose evidence is missing
(`private.migration_gate_failures`); `center.test.ts` holds the screen's
copy of every gate equal to it. A migration moves forward one stage at a time,
may go back until cutover, and going back restarts the evidence of every stage
it re-enters.

| # | Stage | Gate (code) | What the migration lead fills | Evidence link |
| --- | --- | --- | --- | --- |
| 1 | `inventory` | `source_platform`, `source_version`, `data_owner` | | |
| 2 | `classification` | `classifications`, `retention`, `historical_cutoff` — classes: public, internal, confidential, restricted | | |
| 3 | `mapping` | `field_map`, `key_field` — every source field → target field, with at least one marked as the key | | |
| 4 | `cleaning` | `duplicate_rule` — `reject`, `keep_first` or `keep_last`; each field's transform is its cleaning rule (`none`, `trim`, `collapse_spaces`, `lowercase`, `uppercase`, `email`, `date_iso`, `integer`, `decimal`) | | |
| 5 | `preview` | `preview_run` — a mapped sample, looked at by a person | | |
| 6 | `sample_import` | `sample_import_run` — a full export mapped, counts recorded | | |
| 7 | `validation` | `validation_passed` — full export, `rows_failed = 0` and `rows_in > 0` | | |
| 8 | `reconciliation` | `reconciliation_passed` — `rows_missing + rows_extra + rows_differing = 0` | | |
| 9 | `parallel_run` | `parallel_runs` — `parallel_runs_required` (default 2, 1–52) **distinct** periods passed, latest passed | | |
| 10 | `cutover` | `cutover_date`, `rollback_plan`, `approvals`, `rejected` — latest decision in every required area is `approved`; ≥ 2 areas | | |
| 11 | `archive` | `archive_location` | | |
| 12 | `monitoring` | terminal — each post-cutover check recorded | | |

Approval areas: `data_owner`, `registrar`, `it`, `academic_leadership`,
`faculty`, `finance` (default `data_owner` + `it`). Capabilities:
`migration:manage` (open and move), `migration:approve` (cutover approvals, by
someone who did not open the migration), `migration:view`. Choose
`parallel_runs_required` in design from the real periods the domain has — a
registration window, a billing cycle, a grading period — not from a number.

## 3. Field map (copy per domain)

| Source field | Target field (`a-z`, `_`) | Transform | Required | Key | Classification | Cleaning note | Provenance label shown to the user |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

Rules: no field is mapped that the data owner has not named; no free-text
field is mapped without the privacy reviewer's decision; a target field that
would put a refused category (see the integration workbook) into an integration
scope is not mapped.

## 4. Runs (append-only; one row per run)

`passed` is computed by the database; nobody records "passed".

| When | Kind | Period label | Rows in | OK | Failed | Missing | Extra | Differing | SHA-256 of the file | Recorded by | Re-run by (second person) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | | | |

A second person re-runs the **same file** (same digest) and records the same
counts. Different counts are an incident in the evidence, not a rounding issue.

## 5. Roster staging (when the domain is rosters)

Server-only. Four entities with closed key lists: `orgs`, `users`, `classes`,
`enrollments`. No grade, email, date of birth or free text is stored.

| # | Step | Function | Refused unless | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Configure source | `roster_import_config` — `source_kind` `csv` or `rest`; REST needs a credential **reference** | tenant matches | |
| 2 | Stage | `roster_stage` | batch identified by (tenant, manifest digest); staging the same manifest again stages nothing | |
| 3 | Validate | `roster_validate` | manifest, counts and cross-references agree; enrollments point at staged users and classes | |
| 4 | Reconcile | `roster_reconcile` | a report of what would change — **the dry run** | |
| 5 | Promote | `roster_promote` | nothing held; a batch that would remove more than `max_removal_pct` (default 10) of the current roster is **held** and needs an approver who is not the stager | |
| 6 | Roll back | `roster_rollback` | the most recent promotion only; refused if a later one exists | |

Dry-run is non-negotiable: an import that cannot be previewed gets run once,
wrongly, against real records. Steps 3–4 are the preview, and step 5 is the only
place live rows change.

## 6. Requirements for a load path

A domain's production load may be proposed only when **all** of these exist and
have been demonstrated on a sandbox with synthetic data, and then on the
customer's sandbox export. Each is a row in the project record with evidence.

| # | Requirement | Why |
| --- | --- | --- |
| 1 | A defined import format and a manifest (files, row counts, digest) | reproducibility |
| 2 | Dry-run that reports every create, change and removal **before** any write | prevents the one wrong run |
| 3 | A single promotion step; nothing else writes live rows | auditability |
| 4 | Per-field provenance (source system, source id, load time, batch) on every imported value | claims, not overwrites |
| 5 | Idempotence: the same batch twice changes nothing | safe retry |
| 6 | Hold threshold for large removals, with a different approver | blast-radius control |
| 7 | Rollback of the last promotion, rehearsed | a way back |
| 8 | Reconciliation report the data owner can read and sign | acceptance |
| 9 | Per-tenant isolation proven by a cross-tenant test | trust |
| 10 | The app reads the loaded data (today nothing reads `roster_current`) | otherwise it is a staging area, not a migration |

## 7. Cutover record (stage `cutover`)

| Item | Value |
| --- | --- |
| Cutover date | |
| Rollback plan (text, ≤ 4000 characters; reference [`CUTOVER-ROLLBACK-GO-LIVE.md`](CUTOVER-ROLLBACK-GO-LIVE.md)) | |
| Approvals — area, approver, decision, date | |
| Opener (must differ from every approver) | |
| Legacy system disposition after cutover | |

## 8. Archive and exit (stage `archive`, `monitoring`)

Archive location (≤ 1000 characters) names where the legacy export lives, who
holds it and for how long; the retention length is counsel's and the data
owner's decision, not this workbook's. Monitoring rows record each check after
cutover: what was compared, when, by whom, and the result.

## Finding: the playbook was stale (corrected)

`docs/market-readiness/MIGRATION_PLAYBOOK.md` Part B stated that import format,
validation and dry-run, provenance, rollback and a reconciliation report all had
state "None", and that nothing supported customer data migration. That predated
the Migration Center and roster staging. Part B has since been rewritten from the
**what is and is not built** table above, and `marketreadiness.test.ts` now fails
if it again says nothing supports migration while those migrations are in the
tree. Four of the five needs exist in some form — a manifest, validation with a
dry-run report, rollback and reconciliation — for rosters in the database and as
browser-side evidence in the Migration Center. Per-field provenance and a
production load path do not exist, and nothing but rosters has even the
foundation.

## Acceptance criteria for phases 5 and 7

1. Stages 1–8 passed with evidence; validation has zero failed rows; reconciliation matches every record.
2. A second person re-ran the final file by digest with identical counts.
3. A rollback was rehearsed on the sandbox and its result filed.
4. The required number of distinct parallel-run periods passed and each discrepancy has the data owner's disposition.
5. The cutover approvals exist from every required area; the opener is none of them.
6. No row of section 6 is open **for any domain that goes to production**.

## Evidence state

**Repository evidence.** Migration Center, roster staging and their check suites
(`migration-center.check.sql`, the roster staging checks) exist on `main`.

**Operational evidence.** None. No migration has been recorded for a real
institution; no load path exists; no parallel run has taken place.

**Missing test/proof.** Build and prove section 6 for one domain; one rehearsed
migration on a customer sandbox export with a second-person re-run.

## Claim ceiling

Semester may describe a gated, evidence-recording migration path and a staged
roster-import foundation.

## Prohibited claims

Do not claim any institution's data is migrated, loaded, reconciled or retired
from a Migration Center record; do not claim OneRoster, SIS or provenance
support.
