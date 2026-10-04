# 12 · Data governance operating model

**A proposal for the owner to adopt, not a charter.** `docs/DECISION-RIGHTS.md` is explicit that a governance
charter is a document the owner adopts, names people in, and has counsel read. This one names **seats**, not
people, and nothing here is in force until a person signs it. What *is* in force is what the database already
refuses (two-person rules, holds, append-only evidence), which this model leans on rather than restates.

## 12.1 The constraint it is designed around

The accountability matrix assigns **every company-side seat to one named person, with no backup** and every
customer-side seat as "NOT IDENTIFIED". A governance model that needs a committee will not run. So this one is
built on three rules:

1. **Make the machine do the nagging.** Every recurring check is a view or a test that prints a number
   (`private.governance_kpis`, proposal 12). A weekly review reads one row; it does not assemble evidence.
2. **A human decides only what code cannot.** Classification of a new table, a retention clock, a purpose for an AI,
   an exception: these are decisions. Everything else (is the table registered, is the sweep hold-aware, did the
   restore run) is a check.
3. **Two people for risk, enforced where it can be.** When one person holds every seat, the two-person rules in the
   database are the only independent control. Where a seat is single-holder, the model names the **external**
   second signature (customer data owner, counsel, an independent reviewer) instead of pretending the seat is
   two people.

## 12.2 Seats

Existing roles in [`DATA-STEWARDSHIP.md`](../../operating-model/DATA-STEWARDSHIP.md) (data owner, data steward,
system owner, integration owner, privacy owner, security owner, metric owner, content owner) are kept as they are.
This adds the Semester-side seats those roles need to answer to.

| Seat | Accountable for | Today (per `OWNER-AND-ACCOUNTABILITY-MATRIX.md`) |
| --- | --- | --- |
| **Data architect** | The registry, the conventions, the proposals in this directory, the physical-design triggers | Founder (unassigned backup) |
| **Platform data steward** | Registry rows for platform-wide tables; DQ rules for them; the nightly job health; exemptions on the platform side | Founder |
| **Domain stewards** (one per domain, 15) | Classification, retention, authority and quality for their domain's tables | Founder until delegated; **customer-side stewards for institution-owned domains** |
| **Privacy / data governance owner** | Floors (cohort, forbidden metrics), retention clocks, rights requests, holds, DPIA | Founder (named primary; backup unassigned) |
| **Security owner** | Access review, key custody (`ledger_chain_key`, analytics salt), incident command | Founder |
| **Integration owner** | Mapping versions, drift response, source SLAs | Founder |
| **Metric owner** | A metric's definition and tie-out | Founder |
| **AI governance board** | AI purposes and ceilings, model/provider approval, evaluation | exists as a document (`operating-model/AI-GOVERNANCE-BOARD.md`) |
| **Counsel** | Every legal conclusion, every **counsel**-marked item in this directory | **UNASSIGNED**: nothing marked counsel can close without this seat |
| **Customer data owner / privacy / IT / security** | Their institution's data map, retention choices, directory policy, connector contracts, holds | **NOT IDENTIFIED** for every pilot |

**The go-live rule that already exists applies unchanged:** a connection is not ready until a **named person** (not
a department inbox) holds the data owner, data steward, integration owner and privacy owner roles for that
contract (`readiness()` reports every missing role). This model extends it by one clause: a **table** is not
`steward_confirmed` until a named person confirmed it.

## 12.3 Who decides what

R = responsible (does it) · A = accountable (decides, one only) · C = consulted · I = informed · **2P** = a second,
different person is required and is enforced where noted. "Counsel" means a qualified human; it is never a model.

| Decision | Arch | Domain steward | Privacy | Security | Integr. | Customer data owner | Counsel | 2P, and where enforced |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Register a new table (domain, class) | A/R | C | I | I | | | | CI: `unregistered` fails the build |
| **Confirm** classification, authority, retention, steward | C | A/R | C | | | C | C (T3) | **2P:** steward ≠ author of the migration (review) |
| **Lower** a classification | C | R | A | C | | C | **C required for T3** | **2P:** `refuse_looser_classification` blocks tenants; platform lowering needs a decision record |
| Change a retention clock | C | R | A | | | C (institution records) | C | decision record; hold check |
| Approve an exemption (convention, hold) | R | C | A | | | | | **dated by `CHECK`**; a known gap ≤ 120 days |
| Approve a data contract / a mapping version | C | R | C | | A | C | | **2P enforced:** approver ≠ proposer, recorded passing simulation |
| Change source precedence (a tenant row) | R | C | C | | A | **C required** | | proposed: wholesale per (entity, field group) |
| Define / approve a metric | C | C | **A** (floor, forbidden list) | | | | | `reviewed_at` required; floor by `CHECK` |
| Approve an AI purpose or raise its ceiling | R | C | C | C | | C | C | AI governance board **A**; ceiling ≤ T2 by `CHECK`; T3 by attachment only |
| Place a legal hold | I | I | R | | | | **A** | **2P enforced:** releaser ≠ placer |
| Answer a data-subject request | I | C | **A** | R | | C | C | due date stored; **no answerer is named today** (open) |
| Approve a schema migration to production | R | C | C | C | | | | the merge is the production change; owner approval |
| Offboard a tenant / authorise a purge | C | | A | C | | **A (their side)** | C | **2P enforced:** proposer and approver from opposite sides; export verified by a second operator; purge by a third |
| Run and sign a restore drill | R | | I | **A** | | | | evidence file + `restore_event` |
| Respond to a data incident | I | R | R | **A** | R | I | C | incident runbook (`CRISIS-RESPONSE-RUNBOOK.md`) |
| Set the directory-information policy | C | C | R | | | **A** | **C required** | counsel gate |

Three of these are on `DECISION-RIGHTS.md`'s "not enforced, none made" list (data exception, who answers a
data-subject request, policy exception). The model proposes owners for them; **making the decision is the owner's.**

## 12.4 Cadence

| Rhythm | Forum | Reads | Output |
| --- | --- | --- | --- |
| **Weekly, 30 min** | Data review (owner + any steward) | `select * from private.governance_kpis` | A list of three: the KPI that moved the wrong way, the oldest open exemption, the failing `block` rule. Nothing else. |
| **Monthly, per domain in rotation** | Steward session | The domain's rows still `proposed`; its DQ rules; its discrepancy queue | Rows confirmed; rules added or retired; a decision record for any threshold chosen |
| **Quarterly** | Governance review | Retention clocks vs practice; unused indexes (appendix query 3); hold coverage; access review of `private` and `analytics` roles; AI purposes and the leakage corpus; the exemption list | Renew-or-fix on every exemption; purpose and ceiling review |
| **Annually** | Assurance | DPIA refresh (`operating-model/PRIVACY-IMPACT-ASSESSMENT.md`); a **restore drill**; an **erasure end-to-end drill** (storage and Edge Function included); an **offboarding rehearsal** with two real people; sub-processor review (`SUBPROCESSORS.md`) | Evidence files with dates; the next date |
| **On event** | Change gate | A new table (CI); a new connector or mapping; a new tenant; a new AI purpose; a new metric; a hold; a rights request; an incident | The decision record for each, `D-<PR number>` |

The weekly review exists because the repository's own history says people stop opening reports that are long
(`ANALYTICS.md`: "a report whose last line is always a week stale is a report people stop opening"). One row, three items.

## 12.5 Lifecycles

Each is a state machine with an owner; the transitions that matter are enforced by a constraint or a test.

**A table**
`proposed` (CI created a registry row from the catalog) → `steward_confirmed` (complete row, named steward) → under
CI strictness for its domain. Time-box: **30 days** from creation; an unconfirmed row older than that appears in the
weekly review. A table with no registry row fails the build.

**An exemption** (convention or hold)
requested with a reason ≥ 10 characters and a review date → live → **expires** (the guard stops silencing it) →
renewed with a new reason, or fixed. A *known gap* may not be parked beyond 120 days (`CHECK`).

**A data contract**
draft → four named people (data owner, steward, integration owner, privacy owner) → mapping `proposed` → simulation
passes → `approved` by someone other than the proposer → `live` → reviewed each term (the integration-quality
review) → `retired`. A correction is always "the source corrects; Semester never edits the fact."

**A metric**
question written in `ANALYTICS.md` → `metric_definition` (draft) → source eligible and view built → tie-out →
`approved` with `reviewed_at` → reviewed annually → `retired`. A forbidden metric cannot be defined.

**An AI purpose**
proposal (ceiling, audiences, minors, course) → AI governance board → `approved` → quarterly leakage-corpus run →
`retired`. A draft purpose serves nothing.

**A classification change**
raising is a steward action; lowering needs the privacy owner and, for T3, counsel; a tenant can only be stricter.

**A legal hold**
placed (matter reference, reason) → every sweep, erasure and partition detach consults it → released by a different
person → the guard (`sweeps_without_hold_awareness`) keeps the "every sweep consults it" claim honest.

## 12.6 Measures

All come from `private.governance_kpis` (proposal 12, tested by planting one of each thing and requiring each column
to move by exactly that amount) unless marked.

| Measure | Reads as | Healthy |
| --- | --- | --- |
| `registry_confirmed / registry_rows` | How much of the schema a human has classified | rising to 100 % before Increment 2 |
| `tables_unregistered`, `registry_orphans` | Schema and registry out of step | **0** (CI) |
| `convention_violations` | Tables breaking their class's rules, after exemptions | **0** or each exempted |
| `exemptions_expired`, `exemptions_expiring_30d` | Parked problems coming due | expired = 0 |
| `hold_blind_sweeps`, `hold_known_gaps` | Deleting sweeps that ignore a hold | 0 and 0 (today 3 gaps, parked ≤ 90 days) |
| `dq_blocking_failed`, `dq_rules_never_run` | Data in a state its owner said it must not be; rules that have never been exercised | 0 and 0 |
| `rights_requests_overdue` | Requests past their due date | **0**; today no answerer is named |
| `last_production_restore`, `last_measured_rpo` | Whether recovery is a fact or a belief | a date within 180 days and a number |
| `outbox_pending`, `outbox_parked` | Delivery backlog and poison events | pending stable, parked investigated |
| *(external)* mutation survivors | A test that cannot fail | **0** (`mutation_check.py`) |
| *(external)* canary leakage in the AI path | Context a model should not have | **0** |
| *(external)* search index lag p95 | Freshness of shared results | set from the first measurement |

## 12.7 Customer-side operating model

What an institution is asked to hold, taken from the existing contracts and made explicit as an onboarding pack.
Each item is a decision the **customer** makes and signs; Semester supplies the evidence.

1. **Four named people per data contract** (data owner, steward, integration owner, privacy owner). Not an inbox.
2. **Data map and classification review:** the institution confirms the tier of each domain it connects, and that nothing above T3 is sent.
3. **Source authority per module** (Core or Connect) and the **precedence** for each entity, using [02](02-source-of-truth-matrix.md) as the default.
4. **Retention choices** for the institution-owned classes the schema leaves open (e.g. `grade_entries`), with counsel.
5. **Directory-information policy** (which fields, who sets the opt-out): gates people search beyond classmates.
6. **AI purposes allowed** and course-level rules; whether T3-by-attachment is permitted.
7. **Hold contacts** and the process by which a hold reaches Semester.
8. **Offboarding terms:** archive period (the 90-day default is a placeholder pending counsel), export format, who verifies.
9. **Evidence pack Semester provides:** the tenant manifest, the latest DQ results, the freshness and reconciliation reports, the restore drill record, the access-review record.

## 12.8 The first 90 days

Ordered by what unblocks something, each item with its evidence. Dates are for the owner to set.

| By | Item | Evidence |
| --- | --- | --- |
| **Day 30** | Fix the three hold-blind sweeps and make the guard fail the build | `hold_blind_sweeps = 0` without exemptions |
| | Decide Path A (retire, gate, or limit) | decision record |
| | Schedule `sweep_outbox` and confirm its windows | job exists; `outbox_*` KPIs |
| | Confirm registry rows for **identity, governance, academic** (the three domains the rest depend on) | `registry_confirmed` for those domains |
| | Name an answerer and a target for data-subject requests | `rights_requests_overdue` is meaningful |
| | Measure bytes per student in the pilot | appendix query 2 |
| **Day 60** | Composite tenant FKs on the ledger and grade tables; generated rules retire as they land | `dq` results |
| | `stamp_row` on the 21 client-writable tables with an unmaintained `updated_at` | `convention_violations` |
| | Counsel engaged on every **counsel** item (directory information, retention minimums, T4 conflicts) | decision records |
| | Wire the reconciliation and drift libraries to the worker; prove with the `stale` rules | `ops.*` rules green |
| **Day 90** | **First restore drill** on a branch of the real project; a `restore_event` with a measured RPO | `last_measured_rpo` |
| | Erasure end-to-end drill including storage and the Edge Function | evidence file |
| | `ai.retrieve` behind the purpose gate in the gateway, with the leakage corpus green | T4 test |
| | Offboarding rehearsal with two real people; `tenant_data_manifest` as the verification | evidence file |

## 12.9 What this model does not do

It does not appoint anyone, adopt any policy, decide any **counsel** item, or change what the database enforces.
It does not claim compliance with any statute. It does not make the single-holder seats safe; it makes their
decisions visible and dated so a second person (an advisor, counsel, a customer's data owner) can check them.
