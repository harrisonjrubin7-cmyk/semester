# Institutional data migration: methodology

How an institution's history moves into Semester without anything being lost,
changed, exposed or unprovable. This is the method; the tooling that enforces
it is `app/src/lib/migration-assurance/` and `app/scripts/institution-migration.ts`; the
per-domain workbooks an institution signs are generated into
[WORKBOOKS.md](WORKBOOKS.md).

**Relationship to the Migration Center.** The Center (`app/src/lib/migration/`,
`20260929200000_migration_center.sql`, the Migration tab on University) is the
*project*: one record per migration, twelve stages, approvals, and a database
trigger that refuses a stage move whose evidence is missing. What it records as
evidence is counts about a sample file and the file's hash, claimed by the
migration lead; its validation gate asks that every row mapped and its
reconciliation gate that every record matched. This method is what stands
behind those claims: it checks, on the real data, that relationships, history,
permissions, outcomes and content survived, proves its own checks work, and
keeps tamper-evident evidence. It does not replace the Center's project,
approvals or gates, and writes nothing to its tables. §4 maps the two.

Read with [`DATA-PORTABILITY-AND-OFFBOARDING.md`](../DATA-PORTABILITY-AND-OFFBOARDING.md)
(the way out), [`INTEGRATION-QUALITY-AND-RECONCILIATION.md`](../INTEGRATION-QUALITY-AND-RECONCILIATION.md)
(ongoing feeds, which this does not replace), [`ROLLBACK.md`](../../ROLLBACK.md)
(the platform's own rollback, which this builds on) and
[`target-architecture/09-CONVERSION-PLAN.md`](../target-architecture/09-CONVERSION-PLAN.md).

## 1. What "migrated" means

> The hard part is not importing rows; it is data quality, mapping semantics,
> historical integrity, documents, relationships, exceptions, and reconciliation.

So **row-count equality is a precondition and is never evidence of success.**
It is checked, because unequal counts are always a defect, but the tooling will
not pass a domain on it: two students' grades swapped, a balance rebuilt from a
rounded float, a revoked guardian consent loaded as active and a module tree
with its children shuffled all leave the counts equal.

A domain is migrated when, on the data that will actually load:

1. **Identity is preserved.** No two people were combined; every row maps to
   exactly one target; nothing appeared from nowhere.
2. **Relationships are preserved.** Every foreign key still points at the *same*
   parent (not merely a parent that exists), and nothing is orphaned that was not
   orphaned before.
3. **History is preserved.** Every grade change, in order, with the same values;
   the current value is the last one.
4. **Outcomes are preserved.** Balances, GPA, credits earned, seats and credit
   load, recomputed from rows on both sides, agree to the tolerance.
5. **Permissions are preserved.** Nobody gains access they did not have; every
   guardian grant has an active consent; access lost is reported.
6. **Content is preserved.** A document is the same bytes by hash and belongs to
   the same person under the same hold.
7. **The business behaves the same.** A parallel run of the real workflows —
   registration, grade posting, billing, transcripts — produces the same
   outcomes as the incumbent.
8. **It can be undone, and it can be proven.** Rollback was rehearsed; every
   decision is on a ledger nobody can quietly edit.

## 2. Principles

| Principle | What enforces it |
| --- | --- |
| **The ledger is the only memory.** A stage is entered only if its gate passes against evidence on the ledger. | `lifecycle.replay` re-checks every transition as of the moment it happened; a hand-written stage entry is reported as a violation |
| **A check that has never failed is not known to be a check.** | `proveProbes` injects a defect of each check's own kind into a copy of the real data and requires the check to notice; a check that examined no rows is `vacuous`, never clean |
| **Introduced is not inherited.** A defect the source already had is the institution's, not a migration failure; one we introduced is ours and cannot be waived. | every finding carries `origin`; `exceptions.decide` allows only `fix_mapping` for the migration's own |
| **A fix is proven by the next run.** | `exceptions.ingest` reopens an exception the re-run still finds and closes one it no longer does |
| **Separation of duties.** | sign-offs must cover the *current* evidence, come from the right side, not from the person who produced it, and no person may hold two roles at one gate |
| **Nothing moves that the platform refuses.** T4 and above (accommodations, health, conduct, government IDs) go nowhere; grades, GPA, submissions, aid and balances need a named scope approval. | `scope.ts`, reusing `integration/classification.ts` and `catalog.ts` |
| **Reversible until the window closes, then forward only.** | rollback gate; archive waits for the window |
| **No personal data in evidence.** | the ledger refuses strings that look personal; reports carry salted references and field names, never values |
| **The tool decides nothing a person or counsel must.** | retention periods, consent age rules and whether a record is an education record are inputs, recorded and enforced, never defaulted |

## 3. The ten domains

Each has a workbook in [WORKBOOKS.md](WORKBOOKS.md) generated from its
declaration: `identity`, `academic_records`, `courses`, `learning_content`,
`enrollments`, `finance`, `family`, `campus_services`, `career`, `documents`.
They load in dependency order (a domain after every domain whose entities it
references), so a link is never checked against a parent that has not moved.

## 4. How this fits the Migration Center

| | Migration Center (exists) | This method |
| --- | --- | --- |
| Holds | the project, approvals, field maps, run counts, cutover plan | the semantic checks, the exception queue, the evidence ledger, rehearsal and parallel-run rules |
| Evidence is | counts about a sample file and its hash, claimed by the lead | recomputed from rows on both sides, with the checks proven against injected defects |
| Enforced by | a database trigger, per stage | `lifecycle.gateProblems`, re-checked on replay of a hash-chained ledger |
| Validation passes when | every row mapped | no migration-introduced critical defect, every check examined rows and was proven, counts reconcile |
| Reconciliation passes when | no record is missing, extra or differing | the above, plus relationships, history, permissions and outcomes agree |
| Covers | 11 domains (LMS, registration, degree audit, advising, accounts, housing, career, events, communications, catalog, other) | 10 domains; adds identity, family and documents, which the Center has no project type for |
| Not modeled | rollback rehearsal and window, delta capture, separation of duties by evidence, semantic checks | the project record, the screen, approval areas |

`migration-assurance/center-bridge.ts` is the seam. It maps the stages and
domains exhaustively (typed against the Center's own, so a stage or domain added
there fails the build until it is placed here) and turns a semantic verdict into
the counts the Center's `recordRun` takes — **refusing to do so for an
inconclusive verdict**, because a run with no findings only because a check
examined nothing satisfies the Center's pass rule. The Center is stricter than
this method's thresholds in one way: it fails a run with *any*
migration-introduced finding, where a standard domain tolerates minor ones
within a rate. That is the safe direction and is left alone.

## 5. Roles

| Role | Side | Signs | Cannot be |
| --- | --- | --- | --- |
| **Data owner** (per domain: registrar, bursar, FERPA officer, records manager, career center …) | Institution | inventory, scope, mapping, cleansing, each domain's validation or parallel run, archive | the person who produced the evidence |
| **Executive sponsor** | Institution | cutover plan, go decision, archive | any other role at the same gate |
| **Migration lead** | Semester | mapping, cutover plan | the data owner or privacy lead |
| **Privacy and security lead** | Semester | scope, cutover plan, archive | the migration lead |
| **Migration engineer** | Semester | nothing: produces evidence | a signer of what they produced |
| **Counsel** | Institution | reviews retention, consent policy, held records; **their conclusion is an input the ledger records, never something this tooling produces** | — |

| Activity | Data owner | Sponsor | Lead | Privacy | Engineer |
| --- | --- | --- | --- | --- | --- |
| Inventory and extract | A | I | C | C | R |
| Scope and classification | A | I | C | A | R |
| Mapping and cleansing | A | I | A | C | R |
| Transform and validate | C | I | A | I | R |
| Exception decisions | A | I | C | C | R |
| Rehearsal | C | I | A | C | R |
| Parallel run | A | I | A | C | R |
| Cutover go / no-go | A | A | A | A | R |
| Rollback decision | C | A | R | C | R |
| Archive | A | A | C | A | R |

## 6. The stages

The stages run in this order; each gate is code in `lifecycle.gateProblems`.
They correspond to the implementation model's *Migrate → Pilot → Parallel run →
Go live → Optimize* phases.

| Stage | What happens | Gate to enter the *next* stage |
| --- | --- | --- |
| `inventory` | Charter: tenant, wave, domains. List every source system, table, file, owner, volume and extraction method. | `source_inventory` per domain, signed by that domain's data owner |
| `extract` | Take the source from a frozen, consistent snapshot; hash every file at extraction from the bytes on disk. | `extract_manifest` (`independentRead`, `sourceFrozen`) and `scope_approval` (nothing unapproved, nothing blocked) per domain; signed by data owner and privacy lead |
| `map` | Field-by-field mapping with a class per field; lookup tables for vocabularies; exclusions recorded. | `mapping_spec` approved per domain; signed by data owner and migration lead |
| `cleanse` | Run approved cleansing rules on a copy; record rows changed per rule; list inherited defects. | `cleansing_report` with no unmapped values; signed by data owner |
| `transform` | Load a target (rehearsal copy), write the crosswalk. | `transform_run` per domain with a crosswalk hash |
| `validate` | Run every invariant on both sides through the crosswalk; prove the probes; queue exceptions. | `validation_report` that **passes**, newer than the last transform, read independently; `probe_proof` with nothing unproven; an exception snapshot with no critical, major or overdue items |
| `rehearse` | Full-volume rehearsals, timed, then a rollback rehearsal. | Two clean rehearsals in a row on the approved mappings, each finishing in under ⅔ of the cutover window; a rollback rehearsal against *this* plan that fits the plan's rollback time; a `cutover_plan` with no problems; signed by lead and privacy lead |
| `parallel_run` | Incumbent and Semester do the real work side by side; compare outcomes. | An accepted `parallel_run_report` for every high-stakes domain; a fresh exception snapshot; signatures from the sponsor, lead, privacy lead and each data owner; then a **go** decision that comes *after* every signature |
| `cutover` | Freeze, final extract, load, reconcile, switch. | `cutover_report` with reconciliation passed and the rollback window recorded |
| `stabilize` | Hypercare; the incumbent stays read-only and available. | Rollback window closed; clean final reconciliation; sealed archive manifest; retention confirmed with counsel review; no legal hold open |
| `archive` | Seal source extracts, crosswalks and the evidence bundle under the retention policy. | — (end) |

`rolled_back` is the other way out, from `cutover` or `stabilize` only, while
the rollback window is open (§16).

## 7. Source inventory and extraction

**Inventory** — one row per entity in `inventory.csv`: source system, table or
file, owner, row count, extraction method, the time the extract was frozen.
Nothing is extracted that is not inventoried. Entities the platform will not
take (§8) are inventoried too, with their count, so their absence is a decision.

**Extraction** rules, because most migrations are lost here:

- From a **frozen consistent snapshot**, not a live table. Record the freeze time.
- **Independently of the transform.** Validation must read the source by a path
  that does not share the transform's code or its assumptions; otherwise it
  inherits the transform's mistakes and finds nothing. `validate` refuses to run
  without `--independent-source-read`, and the attestation is on the ledger with
  the actor's name.
- **Hash files at extraction**, from the bytes on disk, with a tool other than
  the one that loads them. Documents and learning content are validated against
  that hash.
- Money in whole minor units. A fractional minor unit is rejected at extraction.
- Dates with their zone. A due date without one is an inherited defect, listed.

## 8. Scope, classification and what stays behind

Every field has a data class (T0–T6, `integration/classification.ts`).

- **T4 and above are never migrated:** accommodations, health and counseling,
  conduct, government identifiers, immigration status, card and bank data,
  authentication secrets. The platform floor sends them to no destination, and a
  migration is not a way round it. Each is listed per domain with *what happens
  instead* (the owning office keeps it; a hold migrates as a code and dates with
  no reason).
- **Fields the platform never ingests by default** — grades, GPA, submissions,
  gradebook, aid, balances, instructor notes — need a **named scope approval**
  per domain and entity (`scope.migration.<domain>.<entity>`) from the records
  owner and the privacy lead, on file before the mapping can be approved.
- A school may be stricter than the floor, never looser.

Whether something is an education record, and whether a field may be moved at
all for a given institution, is for the institution and counsel. This program
records the answer and enforces it.

## 9. Cleansing: inherited, not introduced

Cleansing runs on a **copy**, with approved rules, each recording how many rows
it changed and a maximum expected; a rule that changes more stops the run.

The distinction that matters: a defect the **source already had** (a stated GPA
that disagrees with the student's own results; a guardian grant with no consent;
an orphan enrollment) is **inherited**. It is never silently corrected — the
migration carries it faithfully, reports it, and sends it to the exception queue
for the institution to fix at source, exclude, or waive with a name and an end
date. Correcting it in flight would make the target disagree with the source
without anyone having decided that.

Normalization that is *meant* to change data (lower-casing email, mapping a
vocabulary) is a cleansing rule, evidenced before and after, and validation runs
against the cleansed source, so an intended change is not reported as a defect.

## 10. Transformation and the crosswalk

The transform assigns target keys and writes a **crosswalk** (source key → target
key) per entity. Validation never writes it. The crosswalk is how every check
compares source to target when the keys differ, and it is what lets two merged
people be detected: more than one source mapping to one target is a defect
unless that target key appears in the institution's approved-merge list.

Transforms carry values; they derive nothing. A balance is recomputed in the
target from entries and compared; it is never loaded as a bare number.

## 11. Validation

Ten kinds of check, declared per domain (`domains.ts`) and run by `engine.ts`:

| Kind | Asks | Example of what row counts miss |
| --- | --- | --- |
| `crosswalk` | Every source row maps to exactly one target; none merge; none appear from nowhere | Two students collapsed into one; the count is off by one *and* correct elsewhere |
| `unique` | No duplicate natural keys | A duplicate sign-in subject bound to two people |
| `reference` | Every foreign key resolves, and none that resolved before are orphaned | An enrollment whose section vanished |
| `preserved` | Field values mean the same; **links still point at the same parent** through the crosswalk | A grade moved to another student with a perfectly valid key |
| `derived` | A sum or weighted mean recomputed from rows agrees on both sides and with the stated figure | A balance rebuilt through a float; a stale GPA |
| `history` | Every event, in order, same values; current equals last | A grade change dropped from the middle |
| `permission` | Nobody gains access; every grant has an active consent; lost access reported | A revoked consent loaded as active |
| `order` | Sibling order preserved | A course outline with children shuffled; a waitlist re-ranked |
| `bounded` | Members per group within capacity and equal to the source | A section over its seats |
| `temporal` | Start not after end | A consent that ends before it begins |

**Coverage.** A check that examined no rows proves nothing, so the verdict is
`hold` unless the institution attests, in writing, that the population is
legitimately empty (no waitlists this term).

**Proving the probes.** On the real data, for each check, `proveProbes` injects
one known defect of that check's kind into a copy and requires the check to find
strictly more than before. `missed` means a defect of its own kind walked past
it. Verdict `hold` until every check is proven or attested.

**Thresholds** (`quality.ts`; a school may tighten, never loosen):

| | High stakes (identity, academic records, enrollments, finance, family, documents) | Standard |
| --- | --- | --- |
| Critical defect introduced by the migration | **0** | **0** |
| Major, per check, as a fraction examined | **0** | 0.1% |
| Minor | 0.5% | 1% |
| Row counts | reconcile exactly | reconcile exactly |
| Inherited defects | never fail the migration; every critical or major must be dispositioned | same |

Severity is chosen by what a wrong record does to a person: a grade, a balance,
a consent and a role grant are critical.

## 12. Exceptions and sign-off

Every finding is an exception with a due time: **24 hours (critical), 72 hours
(major), 10 days (minor)**. One way out each:

| Disposition | For | Rule |
| --- | --- | --- |
| `fix_mapping` | defects the migration introduced | the only option for them; cannot be waived, excluded or passed to the source |
| `fix_source` | inherited defects | the institution corrects the source; proven by the next run |
| `exclude` | inherited defects | a scope change: reason of substance, an approver who is not the proposer, an end date |
| `waive` | inherited defects | as `exclude`; at most 90 days; in a high-stakes domain above minor, a third person on the Semester side countersigns; an expired waiver blocks again |

Cutover is blocked by any open or unproven-fix critical or major exception, and
by any overdue one. Minor exceptions never block; they are reported.

**Sign-off.** A signature covers a specific piece of evidence by hash. New
evidence of that kind voids it. It must come from the right side, from someone
who did not produce the evidence, and no person may sign as two roles at one
gate.

## 13. Rehearsal

At least two full-volume rehearsals, **consecutive and clean**, on the currently
approved mappings (each rehearsal records the hashes of the mappings it ran on;
a rehearsal on stale mappings does not count). Each is timed; **1.5× the
duration must fit the cutover window**, or the window is a hope. Then a
**rollback rehearsal** against the same plan, restoring the incumbent within the
plan's rollback time.

A rehearsal must include everything cutover will: final extract, load, validate,
reconcile, a smoke of the top journeys (sign-in, schedule, transcript, balance),
and the communications and support runbook with real people.

## 14. Parallel run

Validation says the data moved; a parallel run says the *outcomes* agree when
real work is done on it. Workflows per domain are in WORKBOOKS.md §8; each names
the **real event it must include** (registration window, grade submission,
billing cycle, add/drop, document request …), because a month of matching
Tuesday traffic proves nothing about registration day.

- Ends on **3 clean cycles in a row (high stakes) or 2 (standard)**, at least one
  exercising the real event.
- **Exact tolerance** in high-stakes domains: a cent is a cent.
- A difference may be **explained** — by a named person, with a reason — but
  never silently; an unexplained difference in the latest cycle fails.
- No open Sev-1 or Sev-2 incidents on the parallel environment.
- `earliestExit` computes the soonest honest end date from the institution's
  calendar, and says *no date* when the calendar has no such event, rather than
  a date that quietly skips it. **Plan the cutover around the academic calendar,
  not the other way round**; a registration comparison cannot happen outside a
  registration period.

## 15. Cutover

A go decision is a signed, recorded act made *after* every signature. Suggested
sequence (times are the plan's):

| When | Step | Evidence |
| --- | --- | --- |
| T−7 d | Plan re-confirmed, communications sent, support rota staffed, incumbent read-only date set | `cutover_plan` (checked by `cutoverPlanProblems`) |
| T−48 h | Last rehearsal clean; exception queue snapshotted; sign-offs complete | `exceptions` snapshot; signatures |
| T−1 h | **Go / no-go.** Any critical exception, any unsigned role or any stale evidence is no-go | `decision` |
| T | Freeze source writes; take the snapshot named in the plan; final extract; hash | `extract_manifest` |
| T+ | Load; run the full validation; reconcile control totals (people, enrollments, ledger total, documents by hash) | `validation_report` |
| T+ | Switch; incumbent read-only and **kept available** | — |
| T+ | Smoke the top journeys with staff | `cutover_report` |

The plan is refused unless: a pre-cutover snapshot is named; something captures
what is written in Semester after cutover (**delta capture**), so a rollback does
not lose it; at least three explicit rollback triggers exist; someone owns the
decision; the incumbent stays available for the whole rollback window.

## 16. Rollback

Triggers are written down in the plan before cutover (for example: sign-in
failure rate over a threshold; any critical reconciliation difference;
registration unavailable beyond a set time), so the decision under pressure is
"did a trigger fire", not "how bad does this feel".

Procedure: decision (recorded) → stop writes → restore the incumbent from the
named snapshot → **replay or reconcile the delta** written in Semester since
cutover → reconcile → `rollback_report` with `restored` and `deltaReconciled`
→ `rolled_back`. The rollback window is **at least 72 hours** and the incumbent
is read-only-but-available for all of it. **After the window closes, the only
direction left is forward** — rollback is refused, and only then may the
incumbent be retired.

A rolled-back wave is closed. Trying again is a new run with a new ledger.

## 17. Stabilize and archive

Hypercare while the window is open: daily reconciliation, exception queue
reviewed, incident log, a single contact. Archive waits for the window to close.

Archiving **seals** the source extracts, crosswalks, reports and ledger into a
manifest with a hash. It is refused unless: the chain verifies; the retention
policy is **complete and counsel-reviewed**; no legal hold is open or unchecked.
The program never deletes from the incumbent; decommissioning is the
institution's act, after sealing, under its own records schedule.

## 18. Evidence and auditability

The ledger (`ledger.jsonl`) is append-only and hash-chained: each entry carries
the previous entry's hash, so editing, removing or reordering any entry breaks
every hash after it. `verify` says where. Because the run is *replayed* from the
ledger, there is no second record to disagree with it.

| Kept | Never kept |
| --- | --- |
| counts, verdicts, durations, hashes, invariant names, salted references, who and when | any value from a student record, names, emails, long digit runs, free text, secrets |

Entries are classed `permanent_record` (decisions, sign-offs, stage changes),
`program_record` (reports, mappings, the archive manifest) or `working`. **No
retention period is defaulted.** The institution sets them, counsel reviews
them, and sealing is refused until both are recorded.

## 19. Reconciliation reports

Each validation writes a redacted `validation-report.json` per domain: verdict
and reasons; migration-introduced and inherited counts by severity; per check,
the rows examined and every finding as a salted reference + origin + severity +
a sentence naming fields; count parity per entity (source − excluded − merged =
expected); coverage (vacuous and attested checks); probe proof status.

A drill into one student's record is a separate, capability-checked, audited
read that is **not part of this tooling**.

## 20. Program-level acceptance criteria

The institution accepts the migration when, in writing:

1. Every domain's workbook acceptance criteria (WORKBOOKS.md §10) are signed by
   its data owner, each backed by passing checks and, for high-stakes domains, an
   accepted parallel run including the real event.
2. Zero critical or major exceptions are open; every inherited one is fixed,
   excluded or under an unexpired waiver, each with a name.
3. Control totals agree between incumbent and Semester: people, enrollments, ledger
   total, documents by hash, active holds, active guardian consents.
4. No person can do or see anything they could not before; nobody who could has
   lost access without a signed exception.
5. Rollback was rehearsed inside its time and remained available for the full
   window.
6. The evidence bundle verifies, is sealed, and carries a counsel-reviewed
   retention policy.
7. Support, communications and a named hypercare contact were in place.
8. Nothing T4 or above is in Semester, and every field the platform never ingests
   by default moved only under its recorded scope approval.

## 21. Commands

```bash
cd app
node scripts/institution-migration.ts init <dir> --tenant T --wave W --domains identity,academic_records --actor NAME
node scripts/institution-migration.ts scope <dir> <domain> --actor NAME --approvals k1,k2
node scripts/institution-migration.ts validate <dir> <domain> --actor NAME --independent-source-read
node scripts/institution-migration.ts file <dir> <kind> --actor NAME [--domain D] [--body '{…}']
node scripts/institution-migration.ts sign <dir> <role> <kind> --actor NAME [--domain D]
node scripts/institution-migration.ts decide <dir> go|no_go|rollback --actor NAME
node scripts/institution-migration.ts exception <dir> <id> <disposition> --actor NAME …
node scripts/institution-migration.ts advance <dir> <stage> --actor NAME
node scripts/institution-migration.ts status <dir>
node scripts/institution-migration.ts verify <dir>
node scripts/institution-migration.ts seal <dir> --retention retention.json --actor NAME
```

`<dir>/<domain>/` holds `source.json`, `target.json`, `crosswalk.json`
(`{entity: rows}` / `{entity: {sourceKey: targetKey}}`), and optionally
`excluded.json`, `merges.json`, `attest.json`. Evidence kinds: `source_inventory`,
`extract_manifest`, `scope_approval`, `mapping_spec`, `cleansing_report`,
`transform_run`, `validation_report`, `probe_proof`, `rehearsal_report`,
`rollback_rehearsal`, `cutover_plan`, `parallel_run_report`, `cutover_report`,
`final_reconciliation`, `archive_manifest`, `rollback_report`. Roles:
`data_owner`, `executive_sponsor`, `migration_lead`, `privacy_security`.

## 22. What this does not do, and what needs people

- **It never connects to a source system or writes to production.** An institution
  extracts to files; the one-time load is a reviewed, owner-approved act and is
  not automated here.
- **The evidence ledger and exception queue are files, not rows.** The Center
  persists the project in Postgres; this method's ledger does not. Persisting it
  means extending the Center's tables (the repository's rule is to extend, not
  to add a second store for one fact), with RLS, a check suite and `RETENTION.md`
  entries, and applying that to production needs the owner's approval. Until
  then the sealed bundle, filed with the institution, is the record.
- **The loader is the institution's or a connector's.** The checks compare any
  source to any target; nothing here assumes a particular SIS or LMS.
- **Legal conclusions are not made here.** Whether a record is an education
  record, who may consent at what age, how long anything is kept and whether
  held records may move are for the institution and qualified counsel. The
  program refuses to proceed without them being recorded; it does not decide
  them.
- **Synthetic fixtures prove the checks and the gates, not any institution's
  data.** Every institution's real extract is run through the probe proof for
  itself.
