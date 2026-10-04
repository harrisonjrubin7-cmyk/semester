# 11 · Test plan

The repository argues from measurement, and CLAUDE.md sets the standard this plan follows:

- **A guard that has never failed is not known to be a guard.** Every proposed test is paired with a mutation that
  must turn it red ([`sql/mutation_check.py`](sql/mutation_check.py)).
- **Include a control.** A probe that finds six problems in six suspects is also what a broken probe looks like.
  Each guard is shown to be silent on a clean case, and to fire on a planted one.
- **A clean reading is a claim about the probe too.** When a result clears a suspect, find out which of the probe
  and the measurement is lying.
- **A structural check beats a runtime probe** where one exists (`rootunmount.test.ts`'s shape): it cannot be
  fooled by a race that did not fire.

## 11.1 Layers

| Layer | What it answers | Mechanism | Runs |
| --- | --- | --- | --- |
| **L1 Structural** | Does the schema satisfy its own rules? | `data_registry_gaps`, `convention_violations`, `sweeps_without_hold_awareness`, `analytics.*` guards, a migration-SQL linter | every PR, in the disposable database |
| **L2 Behavioural (DB)** | Do the policies and functions do what they claim, for a second account? | `*.check.sql`-style suites: real roles, two tenants, `begin … rollback` | every PR |
| **L3 Mutation** | Can each L1/L2 test fail? | `mutation_check.py`: one faithful bug per row, test must go red | on a change to a proposal or its test |
| **L4 Contract** | Do producers and consumers agree? | event registry ↔ `EVENT_TYPES` parity; connector fixtures; consumer parks an unknown version | every PR |
| **L5 Data quality** | Is the data in the state its owner says it should be? | `dq_rule` runs; `dq_blocking_failed` empty | PR (branch DB), nightly, import gate |
| **L6 End-to-end** | Does the whole path work, including what a DB test cannot see? | erasure incl. storage and the Edge Function; export with manifest; offboarding purge to a zero-row manifest | pre-release, on a staging project |
| **L7 Performance** | Is it fast enough at volume? | search, retrieval, RLS-helper policies, partition pruning at size | before each volume step, on a replica |
| **L8 Leakage / adversarial** | Can anything see what it should not? | canary corpus across tenants, students, tiers, tombstones, blocks, minors; RLS matrix | every PR (DB half), pre-release (gateway half) |
| **L9 Operational drills** | Can people do the thing under pressure? | PITR restore, hold placement and release, rights-request handling, kill-switch drill | scheduled, with written evidence |

## 11.2 What is written and what it shows

All thirteen are applied to a database built from the 171 migrations (PostgreSQL 16; the project is on 17, which
`check.sh` pins and this sandbox lacked). Mutation counts are from the harness; the control (all thirteen green
unmutated) is checked first. **53 mutations in total.**

| Test | Proposal | Proves | Mutations (all red) |
| --- | --- | --- | --- |
| `01_registry` | registry, conformance | gaps both directions; violations by class; exemptions expire; a confirmed row is complete; T3 cannot be analytics-eligible | 1 |
| `02_provenance` | provenance, lineage, precedence, enrolment, vocabulary crosswalk | connected rows need a source ref; lineage is tenant-fenced and cycle-safe; a tenant override replaces the floor wholesale; **the four enrolment situations**; the crosswalk covers every live `source_label`/`source_type` value and a planted new one is reported | 7 |
| `03_outbox_sweep` | event registry, sweep | seven rows, every branch, tenant hold, platform hold | 3 |
| `04_lifecycle` | tenant manifest, restore | manifest counts match the catalog and fence tenants; the restore window; a production restore cannot close before its sweeps | 2 |
| `05_analytics` | analytics boundary | floor of ten for institutions only; two reader roles; forbidden metrics refused; pseudonym rotates; three guards with controls | 9 |
| `06_search` | search index | tenant, audience, enrolment, capability, block (both ways), minor, tombstone, T3 refused, ranking tiers, literal wildcards, **revocation is immediate** | 5 |
| `07_ai_retrieval` | AI retrieval | tenant policy, kill switch (engage and release), age, ceiling, eligibility, runs-as-caller, log is service-only | 7 |
| `08_partitioning` | partitions | ahead-creation is idempotent; **pruning read from `EXPLAIN`**; held tenant blocks detach | 2 |
| `09_data_quality` | rule engine | every kind, pass and fail; blocking view; wrong column fails loudly; repaired data turns green | 2 |
| `10_row_conventions` | stamp, guard | forged `created_at`/`row_version` overwritten; tenant immutable; legacy rows keep NULL; append-only scopes | 5 |
| `11_hold_coverage` | hold guard | silent on the real schema; **finds exactly the 3 real gaps** when exemptions are removed; new blind sweep flagged; expired exemption ignored | 4 |
| `12_dq_cross_tenant_rules` | generated rules | 35 rules match the catalog, all execute and pass on empty; **one fires on a real cross-tenant pair**; stale rules fail on an empty job table | 2 |
| `13_governance_kpis` | KPI view | plant one of each thing (an orphan registry row, live and expired exemptions, a known gap, a failing block rule, a hold, an overdue rights request, a restore with a 1-hour RPO, a pending and a parked event) and require each column to move by exactly that amount; nothing unplanted moves | 4 |

### What the mutation harness found in the tests themselves

Reported because it is the argument for running one:

1. `06a` survived. The "minor" assertion ran after the student's enrolment had been deleted, so the person was
   already invisible for a different reason; the age rule was never exercised. Fixed with a control (the classmate
   *can* see an adult first) and a re-enrolment.
2. `07b` survived. The T2 documents in the fixture were also excluded by audience, so the classification
   ceiling was never exercised alone. Fixed with a T2 document in the `tenant` audience.
3. `07c`, `07g` survived singly: each rule has **two independent barriers**, so removing one changes nothing. The
   mutation now removes both. (This is defence in depth working as intended, and the harness now models it.)
4. `02` found a real defect in the *proposal*: `enrollment_reconciled.conflict` was `NULL`, not `false`, for a
   student with no registrar record (three-valued logic), which would drop the row from any `where not conflict`.
5. `09` found another: results from two runs in one transaction tied on `now()`, so "latest result" was wrong.
   `clock_timestamp()` fixed it.
6. `05` was **wrong against the repository's own rule**: it allowed a cohort floor of 5, and its example view
   suppressed the pilot's own figures, which `ANALYTICS.md` says are read at 5–10 people. Fixed by an audience on
   each metric.

## 11.3 Tests still to write

| # | Test | Layer | Where | Blocks |
| --- | --- | --- | --- | --- |
| T1 | `EVENT_TYPES` ↔ `event_type_registry` parity (type, version, floor, retention) | L4 | extend `events.test.ts` | enabling the first outbox producer |
| T2 | `FORBIDDEN` (`institution-ops.ts`) ↔ `metric_definition` CHECK list parity; `MIN_COHORT` ↔ every SQL floor (exists for floors) | L4 | with `cohortfloor.test.ts` | any new metric |
| T3 | Freshness SLA: `freshnessSlaHours` ↔ `freshness_target_minutes` derive from one number | L4 | `data-contracts` test | trusting "up to date" |
| T4 | **Gateway leakage contract**: assemble context for each purpose and user archetype; a seeded canary in an unseen document never appears | L8 | `app/server/institution` | retiring whole-source loading |
| T5 | Path A policy parity: the shared-key function refuses a user whose tenant has policy `off` or the kill switch engaged | L2/L4 | Edge function test | any claim that tenant AI policy is enforced |
| T6 | Client cache rules: T1–T2 results about *other people* are not persisted and are cleared on sign-out and tenant change | L2 (web) | `erase.test.ts` neighbour | server search going live |
| T7 | Anti-enumeration (F9): `person` queries need ≥ 3 characters, are rate-limited, capped | L2 | `06` extension | the `person` kind |
| T8 | **Erasure end to end**: the `delete-account` Edge Function and storage objects, on a staging project, ending with zero rows and zero objects | L6 | drill + script | any "we delete your data" claim beyond the DB |
| T9 | Export: a `manifest.json` whose counts equal `account_data_map` rows; device files included or explicitly listed as device-only | L6 | extend `export_my_data` | portability claim |
| T10 | Offboarding rehearsal with two real people; `tenant_data_manifest` is the verification; purge to zero | L6/L9 | `docs/evidence/offboarding/` | the first school's exit |
| T11 | **Restore drill** on a branch of the real project, writing a `restore_event` with a measured RPO | L9 | `supabase/restore-drill.sh` + evidence | any RPO/RTO statement |
| T12 | Hold-coverage guard wired as a failing check (after the 3 gaps are fixed) | L1 | `check.sh` | merging the guard |
| T13 | `NOT VALID` linter: a `not valid` with no later `validate`; `create index` without `concurrently`; `add column … not null` without a default | L1 | CI script over new migrations | first populated-table migration |
| T14 | Load tests: search at 100 k documents per tenant, retrieval at 1 M chunks, RLS-helper policies at pilot size, partition pruning at 100 M rows | L7 | replica | each volume step |
| T15 | Relevance golden set: queries with expected top results, shared between client `find.ts` and server `search.query` so the two rankers cannot drift | L2 | both | merging results |
| T16 | Documentation checks: tables have consistent columns; Mermaid diagrams parse; relative links resolve | L1 | script | docs merge (run on this directory: see below) |

## 11.4 Acceptance gates by program increment

The audit's increments (0 Foundation … 6 Scale) each get a data gate. A gate is a command that exits non-zero, not a
statement.

| Increment | Data gate |
| --- | --- |
| **0 · Foundation** | Registry seeded and **every table registered** (`unregistered` = 0, `orphan_registry` = 0); `convention_violations` empty or each row exempted with a reason and date; hold-coverage guard silent; the 35 cross-tenant rules run nightly; outbox sweep scheduled; restore drill **executed once** with a recorded RPO |
| **1 · Student OS** | Blob bytes-per-student percentiles measured; `stamp_row` on the 21 client-writable tables; search `owner` documents only by opt-in; AI retrieval behind the purpose gate with the leakage corpus green; Path A policy decision made |
| **2 · Academic core** | `enrollment_reconciled` is the only reader of "official" enrolment; composite tenant FKs on grade, registration and ledger tables; parallel-run reconciliation clean for the agreed periods; 3 missing data contracts written |
| **3 · Campus and family** | Block checks on profile visibility; guardian consent/projection model replaces direct reads; directory-information policy decided (**counsel**); search anti-enumeration |
| **4 · Commerce and career** | Marketplace and application entities carry the conventions at birth; financial hold-awareness; dispute and reconciliation reports R4 |
| **5 · Institutional replacement** | Executable migration rollback via `origin_batch_id`; tenant manifest is the export and purge verification; offboarding rehearsed with two real people; evidence archive restore rehearsed |
| **6 · Scale** | Partitioning triggers from measured data; replica for analytics; tenant-isolation audit with the canary corpus across tenants at volume |

## 11.5 Wiring

Not wired by this work (no workflow file was changed). Adoption path, each step small:

1. Merge the proposals as migrations **only with the owner's approval** (the merge is the production change). Names
   follow the timestamp convention; the SQL is already idempotent.
2. Move each `tests/NN_*.test.sql` to `supabase/<name>.check.sql`. They already use the `begin … rollback` shape
   `check.sh` runs; `check.sh` refuses a suite name that matches no file, and pins the Postgres major from
   `config.toml`.
3. Add `mutation_check.py` as a job that runs when a proposal or its test changes (about two minutes on this machine).
4. Run `appendix/measure.py` in CI against the migrated schema so the conformance numbers in these documents are
   regenerated, not remembered.
5. Run the documentation checks (T16) on this directory.

## 11.6 Documentation checks that were run

The documents are part of the deliverable and are checked like code: **every Markdown table has the same number of
columns in every row** (this caught three malformed rows in the first draft, a `|` inside backticks, which Markdown
treats as a column break; the checker is shown to flag a deliberately broken table), **every Mermaid diagram parses**
with the Mermaid library (and a deliberately broken one is rejected), and **every relative link resolves**.
