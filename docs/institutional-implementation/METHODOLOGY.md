# Implementation methodology

| Control | Value |
| --- | --- |
| Status | **CONTROLLED METHOD — NO NAMED IMPLEMENTATION HAS BEEN RUN WITH IT** |
| Owner | The implementation lead seat (today held by Harrison Rubin; backup unassigned — see [seats](#seats-not-people)) |
| Evidence date | 2026-10-04 at `origin/main` `7287ddc` |
| Extends | [`../commercial/INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md`](../commercial/INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md), which owns the delivery rules and the stored stage names |
| Index | [`README.md`](README.md) |

One repeatable path moves an institution from a signed evaluation to steady
operation. It has ten phases, because the work has ten different jobs. It is
stored in nine, because that is what `implementation_projects.stage` accepts —
and the method does not invent a stage value the database would refuse.

## Crosswalk

This table is machine-read. `app/src/lib/ops/implementation-system.test.ts`
holds every backticked value in it to the migration that defines it, and holds
the stored column to covering all nine stages.

| # | Phase | Stored stage | Rollout state |
| --- | --- | --- | --- |
| 1 | Discover | `discover` | `requested`, `claimed` |
| 2 | Design | `discover` | `claimed` |
| 3 | Configure | `configure` | `security_review`, `sandbox_uat` |
| 4 | Integrate | `integrate` | `sandbox_uat` |
| 5 | Migrate | `validate` | `sandbox_uat` |
| — | Train (a workstream; it gates phase 6) | `train` | `sandbox_uat` |
| 6 | Pilot | `launch` | `pilot_read_only`, `pilot_write_enabled` |
| 7 | Parallel run | `launch` | `pilot_write_enabled` |
| 8 | Go-live | `launch` | `production_limited` |
| 9 | Hypercare | `hypercare` | `production_limited`, `production_active` |
| 10 | Optimize | `measure`, `expand` | `production_active`, `expansion` |

How to read it:

- **A phase is finer than a stage.** Design is a signed milestone inside
  `discover`; pilot, parallel run and go-live are milestones inside `launch`.
  The project's `stage` moves only when the stored stage changes; the phase is
  recorded as a row in `implementation_milestones` (`name`, `owner_role`,
  `due_at`, `done_at`). The playbook already says this: design, operation,
  conversion and offboarding stay milestones or linked decisions.
- **Rollout state is a record, not a switch — and a strict one.**
  `tenant_rollout.state` is written only by an operator (the service role); the
  school's administrators and auditors can read it but not move it, so a school
  cannot promote itself. The database refuses a forward move of more than one
  step, refuses a forward move whose exit gates have no evidence **recorded
  since the school entered its current state**, and needs no evidence to move
  down, hold or begin offboarding (reducing authority is always allowed). It is
  not yet read by `feature_state` (the migration says so in its header): moving
  it documents where the school stands and refuses illegal moves, but does not by
  itself turn a capability on or off. Capability exposure is a separate act
  (`tenant_feature_policy`, kill switches) and each phase below names it.
- **Training is not an eleventh phase.** It is built from phase 2 onward and its
  exit gate must be met before the first cohort in phase 6, so it is the
  stored stage `train` between `validate` and `launch`.
- **Hold states.** `paused` and `suspended` are rollout states any phase may be
  moved into; the state a school returns to is remembered (`resume_state`).
  `offboarding` and `archived` belong to [`OFFBOARDING-AND-EXPORT.md`](OFFBOARDING-AND-EXPORT.md).
- **Project status** (`on_track`, `at_risk`, `blocked`, `done`) is the
  traffic light. A seat with no named backup (below) is `at_risk` by rule.

## Rollout exit gates the database enforces

Leaving each rollout state needs evidence rows for these gates
(`private.rollout_exit_gates`; `tenant_rollout_evidence` holds, per gate, *what
was shown* (a link, a document reference, a CI run, ≤ 2000 characters) and
*who accepted it* (a name and role, not an account, ≤ 200 characters)). The
method's phase exits produce exactly this evidence; the guard test holds this
table equal to the migration.

| Leaving state | Gates | Produced by |
| --- | --- | --- |
| `requested` | `sponsor_qualified` | phase 1: charter and authorized-sponsor record |
| `claimed` | `security_kickoff` | phase 2: security kickoff record |
| `security_review` | `security_privacy_approval`, `dpa_executed` | phase 3: security review closed; executed data-processing paper (counsel's) |
| `sandbox_uat` | `uat_signoff`, `rls_isolation_passed`, `sso_login_verified` | phases 4–5 and the training gate: UAT sign-off; cross-tenant test evidence; SSO sign-in verified on the test accounts |
| `pilot_read_only` | `source_reconciliation_passed`, `accessibility_review_passed`, `data_quality_adoption` | phase 6: reconciliation evidence; accessibility acceptance; data-quality and adoption review |
| `pilot_write_enabled` | `workflow_reliability`, `cutover_checklist_complete`, `sponsor_go_live` | phase 7 parallel-run reliability; the per-tenant go-live checklist; both sponsors' signed GO |
| `production_limited` | `expansion_decision` | phase 9: the recorded decision to widen to full production |
| `production_active` | `module_campus_approval` | phase 10: approval to add a module or campus ([expansion gate](SUCCESS-SYSTEM.md#7-expansion-triggers)) |

Hold states: leaving `paused` or `suspended` needs `remediation` evidence and
returns only to the remembered state; `offboarding` ends in `archived` only with
a `completion_certificate`.

## Seats, not people

A seat is a job with a card. A card lets someone who has never held the seat
do it from the page alone. Every tenant's project record names, per seat, a
primary and a backup. **A seat without a backup is `at_risk`; a stage cannot
exit with a launch-critical seat that has no backup.** That one rule is the
whole mechanism for not depending on a founder — everything else in this
method exists to make it satisfiable.

| Seat | Decides | Card lives in |
| --- | --- | --- |
| Implementation lead (IL) | Phase exit, scope, `status`, stop | this document |
| Solutions engineer (SE) | Design, configuration content | [`TENANT-CONFIGURATION-WORKBOOK.md`](TENANT-CONFIGURATION-WORKBOOK.md) |
| Integration engineer (IE) | Connections, scopes, sync, rollback of an integration | [`INTEGRATION-WORKBOOK.md`](INTEGRATION-WORKBOOK.md) |
| Migration lead (ML) | Mapping, runs, reconciliation evidence | [`MIGRATION-WORKBOOK.md`](MIGRATION-WORKBOOK.md) |
| Security and privacy reviewer (SPR) | Data flow, minimum data, rights, holds | [`../trust/README.md`](../trust/README.md) |
| Accessibility lead (AL) | Critical-path accessibility acceptance | [`../market-readiness/ACCESSIBILITY-PROGRAM.md`](../market-readiness/ACCESSIBILITY-PROGRAM.md) |
| Enablement lead (EL) | Training content and rehearsal | [`TRAINING-PLAN-AND-ACADEMY.md`](TRAINING-PLAN-AND-ACADEMY.md) |
| Support lead (SL) | Hypercare staffing, severity, handoff | [`HYPERCARE-AND-HANDOFF.md`](HYPERCARE-AND-HANDOFF.md) |
| Customer success manager (CSM) | Success plan, cadence, EBR, renewal | [`SUCCESS-SYSTEM.md`](SUCCESS-SYSTEM.md) |
| Commercial and finance (CF) | Order, billing, price | [`../commercial/ORDERING-AND-BILLING-OPERATIONS.md`](../commercial/ORDERING-AND-BILLING-OPERATIONS.md) |
| Counsel (external) | Every legal conclusion and contract | no card — a gate, never a seat Semester fills itself |
| Executive sponsor (Semester) | Escalation, no-fit, exceptions | this document |

Customer-side seats are named in the [stakeholder map](SUCCESS-SYSTEM.md#4-stakeholder-map):
executive sponsor, champion, registrar/SIS owner, identity/IT owner, LMS owner,
security and privacy officer, accessibility/disability services, faculty lead,
student representative, help-desk lead, finance/procurement.

**Doubling up.** One person may hold several seats only when it is written in
the project record, access stays least-privilege, and no maker-checker pair
collapses into one person. Those pairs are in force in the product and the
method alike: configuration drafted by one person is published by another
(database-enforced); a migration is opened by one and approved at cutover by
another (`migration:approve`); a staged roster that would remove more than the
threshold promotes only with a different approver; offboarding export is
recorded by one operator and verified by another. Where there is no second
person, the step waits or the school's own person is the checker — it is not
done by the one who made it.

**Present state, stated plainly.** The existing playbooks name Harrison Rubin
as the only company-side holder and every backup as unassigned. Nothing in
this method changes that; it makes it measurable. The seat-coverage table in
the project record (`status` per seat: primary named, backup named, backup has
shadowed a step) is the honest read of founder dependence, and the first goal
of the first implementation is to turn it from empty to full.

## The seven rules that make a delivery repeatable and auditable

1. **Copy the workbook; never improvise.** Every tenant starts from the same
   templates. A field a template lacks is added to the template through a
   decision record, not to one tenant.
2. **A gate is passed by a link.** Same rule as
   [`../market-readiness/GO_LIVE_CHECKLIST.md`](../market-readiness/GO_LIVE_CHECKLIST.md):
   a checkbox is ticked by a passing test, a measured figure, a dated export or
   a signed record — not by anyone's recollection.
3. **Decisions go in the register, not the chat.** Every scope, exception and
   stop is a row: decision, owner, date, evidence, expiry. An exception with no
   expiry is rejected.
4. **A second person has done each step once.** Before any production phase,
   the backup performs a named step from the workbook with the primary silent
   (the *shadow test*). A step only the primary can do is a defect in the
   workbook.
5. **No custom code per customer.** Variation goes through the Configuration
   Studio, the tenant contract, feature policy and the integration catalog. A
   request none of them can express is a product escalation
   ([`FEEDBACK-AND-ESCALATION.md`](FEEDBACK-AND-ESCALATION.md)), never a
   one-off.
6. **Never configure a customer to depend on a capability that is not live.**
   Roadmap items are listed as excluded in the order and the design, not
   simulated. A repository feature is not a configured target; sandbox success
   is not production activation; entitlement is not authorization.
7. **Legal and policy conclusions belong to counsel and the institution.** The
   method names where counsel's approval is a gate (data processing terms,
   retention length, legal-hold clearance, offboarding disposition). It never
   states one.

## Meeting cadence, all phases

| Meeting | When | Who | Output |
| --- | --- | --- | --- |
| Kickoff | once, phase 1 | IL, CSM, customer sponsor, champion | charter, RACI, decision dates |
| Weekly working session | weekly | IL, SE/IE/ML as needed, champion | milestone status, blockers, register changes |
| Gate review | at each stage exit | IL, SPR, AL, customer sponsor (and counsel where listed) | signed exit evidence or a recorded failure |
| Steering | every 2 weeks (weekly from phase 6) | executive sponsors | decisions on scope, exceptions, stop |
| Daily stand-up | phases 6–9 only | IL, SL, IE, champion | open incidents and changes, 15 minutes |
| Hypercare review | per [hypercare](HYPERCARE-AND-HANDOFF.md) | SL, CSM, customer help desk | exit or extend |
| EBR | quarterly from first full quarter | CSM, both sponsors | [EBR](EXECUTIVE-BUSINESS-REVIEW.md) |

Cadence is a starting proposal and is agreed in the charter; the customer may
ask for less, never for no decision record.

## The ten phases

Every phase uses the same ten lines. Roles are R (does) / A (answers for the
outcome); customer-side roles are in *italics*.

### Phase 1 — Discover

| | |
| --- | --- |
| **Purpose** | Decide whether this institution, cohort and workflow are a fit, on evidence, before anyone configures anything. |
| **Entry** | Qualified opportunity ([`../commercial/SALES-PIPELINE-DEFINITIONS.md`](../commercial/SALES-PIPELINE-DEFINITIONS.md)); `schools` row exists or is requested. |
| **Work** | Problem and authority; stakeholder map; systems inventory (SIS, LMS, identity, calendar, payments); data and risk screen; success measures and guardrails; budget path; **no-fit screen**; exclusions. |
| **Roles** | R: CSM, SE. A: IL. Consulted: SPR, counsel. *Sponsor, champion, registrar/SIS owner, identity/IT owner.* |
| **Cadence** | Discovery sessions as needed; one gate review. |
| **Artifacts** | Discovery record; stakeholder map v0; systems inventory; fit and no-fit memo; draft charter and RACI. |
| **Acceptance** | A named *authorized* customer sponsor; a cohort and a workflow in plain words; every system that will touch the project named with an owner; measures defined per [`../commercial/PILOT-SUCCESS-PLAN.md`](../commercial/PILOT-SUCCESS-PLAN.md) (baseline, denominator, source, threshold); no unresolved no-fit criterion. |
| **Risk controls** | Single-threaded sponsor (map needs ≥ 3 people in ≥ 3 roles); scope that needs an unbuilt capability is written as an exclusion; commercial pressure cannot waive a no-fit. |
| **Stop** | No authorized sponsor; scope depends on an unavailable capability or an official write the product does not support; customer withdraws. |
| **Exit evidence** | Signed charter and RACI; no-fit memo filed. Rollout state `requested` → `claimed` (school claimed by its administrator). |

### Phase 2 — Design

| | |
| --- | --- |
| **Purpose** | Turn the charter into a design the workbooks can be filled from, so configuration is transcription, not invention. |
| **Entry** | Phase 1 exit. Order form and data-processing paper in progress with counsel. |
| **Work** | Target role and grant model; minimum data flow; source-of-truth per object; offline and degraded behavior; integration plan; migration scope and cutoff; support and escalation design; acceptance design (UAT scripts); training needs analysis; rollback design. |
| **Roles** | R: SE, SPR, IE, ML. A: IL. *Registrar, IT, security officer, accessibility services.* |
| **Cadence** | Weekly; one design review with customer approvers. |
| **Artifacts** | Design baseline (the three workbooks, filled to *intent*); data-flow diagram; UAT plan; rollback design; risk register. |
| **Acceptance** | Every workbook row has an owner and a source of truth; minimum-data review passed by SPR; the design names which items are **live**, **sandbox only**, or **excluded**; customer approvers sign the baseline. |
| **Risk controls** | Design changes after baseline go through a change record; conflicting sources of truth are resolved in the design, not at cutover. |
| **Stop** | Required approver unavailable past the decision date; design needs a capability on the exclusion list. |
| **Exit evidence** | Signed design baseline (milestone `design baseline signed`). Stored stage stays `discover` until phase 3 begins. |

### Phase 3 — Configure

| | |
| --- | --- |
| **Purpose** | Make the tenant match the design, in the product, with a trail. |
| **Entry** | Signed design baseline; order effective; counsel-approved data terms where the design moves personal data. |
| **Work** | Fill and apply the [tenant configuration workbook](TENANT-CONFIGURATION-WORKBOOK.md): identity, roles and grants, Configuration Studio domains, feature policy and kill switches, tenant contract, support routes. Security review against the evidence in [`../trust/`](../trust/README.md). |
| **Roles** | R: SE (draft), a different person (publish). A: IL. *Customer administrator, registrar (publishes), IT.* |
| **Cadence** | Weekly; config freeze on workbook approval. |
| **Artifacts** | Configuration export and **readback**; audit-event extract; feature-policy table; security review record. |
| **Acceptance** | Every value in the workbook read back from the tenant and equal to the approved value; draft and publish by different people; no value approved that nothing enforces unless the workbook marks it *record only*; security review closed with no open P0/P1. |
| **Risk controls** | Least privilege; no shared credentials; every change audited (`tenant_policy_audit_event`); rollback is a new published version, never an edit. |
| **Stop** | Cross-tenant or isolation finding; a required control cannot be configured. |
| **Exit evidence** | Readback diff empty; review closed. Rollout `security_review` → `sandbox_uat`. |

### Phase 4 — Integrate

| | |
| --- | --- |
| **Purpose** | Connect only approved systems, only approved scopes, proven in a sandbox. |
| **Entry** | Phase 3 exit; a sandbox from the customer; credentials in the customer's secret manager. |
| **Work** | The [integration workbook](INTEGRATION-WORKBOOK.md): one block per connection — scopes, consent, identity mapping, freshness, reconciliation, degraded behavior, disconnect. |
| **Roles** | R: IE. A: IL. *System owners, university administrator (approves).* |
| **Cadence** | Twice weekly while a connection is in test. |
| **Artifacts** | Connection record; sandbox contract-test results; reconciliation report; runbook entry. |
| **Acceptance** | Per connection: approval by someone other than the owner; first sync healthy; reconciliation clean to the agreed tolerance; degraded and disconnect paths exercised; the product still works with the connection off. |
| **Risk controls** | Native-first: the student never loses a capability because a connection fails; replay and kill switch tested; secrets are pointers only. |
| **Stop** | A scope requires data the product refuses by name; an official write the product does not support; unreconciled external action. |
| **Exit evidence** | Per-connection acceptance rows linked; connection state `healthy` or deliberately `disconnected`. |

### Phase 5 — Migrate

| | |
| --- | --- |
| **Purpose** | Bring in the data the design says to bring, provably, with a way back. |
| **Entry** | Phase 4 exit for the connections the migration depends on; data owner and registrar named. |
| **Work** | The [migration workbook](MIGRATION-WORKBOOK.md): the Migration Center path from inventory to reconciliation, and staged roster import with dry-run, hold threshold and rollback. Runs are rehearsed on a sandbox first. |
| **Roles** | R: ML. A: IL. *Data owner, registrar, IT.* |
| **Cadence** | Per run; weekly review of evidence. |
| **Artifacts** | Migration record; field maps; run evidence (counts and SHA-256); reconciliation report; rollback plan. |
| **Acceptance** | Validation passes with zero failed rows; reconciliation matches every record; a rollback has been rehearsed; the loader and the approver are different people. |
| **Risk controls** | Nothing writes live rows except the single promotion step; large deletions are held; evidence holds counts and fingerprints, never a record. |
| **Stop** | Any reconciliation mismatch not explained and signed by the data owner; a cleaning rule that would destroy a record without the owner's approval. |
| **Exit evidence** | Reconciliation passed on the final export. Stored stage `validate` also carries the UAT below. |

Phase 5 shares the stored stage `validate` with **acceptance testing**: role and
cross-tenant checks, critical-flow, accessibility and device checks, privacy and
rights flows, monitoring and alert checks, incident, restore and rollback
rehearsal, and support UAT. Both must pass before the stage exits.

### Training workstream gate (stored stage `train`)

Training exits when the enablement lead has the rehearsal evidence in
[`TRAINING-PLAN-AND-ACADEMY.md`](TRAINING-PLAN-AND-ACADEMY.md): each operator and
support seat has performed its critical tasks on the sandbox, backups included;
help routes work; communications are approved. Not a headcount of completions.

### Phase 6 — Pilot

| | |
| --- | --- |
| **Purpose** | Run the real workflow with a small, consented cohort, with the incumbent still authoritative. |
| **Entry** | Stage `train` exit; rollout `sandbox_uat` exit gates evidenced (`uat_signoff`, `rls_isolation_passed`, `sso_login_verified`); a signed *pilot* GO for the pilot cohort only, using the go/no-go criteria in [`CUTOVER-ROLLBACK-GO-LIVE.md`](CUTOVER-ROLLBACK-GO-LIVE.md) that apply to a limited, incumbent-authoritative cohort; no open P0/P1; staffed support. |
| **Work** | Cohort onboarding; daily stand-up; measure weekly against the frozen baseline; capture issues; rollout `pilot_read_only` first, `pilot_write_enabled` only after the read-only exit. |
| **Roles** | R: IL, SL, CSM, IE. A: IL. *Champion, cohort lead, help desk.* |
| **Cadence** | Daily stand-up; weekly steering. |
| **Artifacts** | Pilot scorecard; issue and change log; weekly evidence pack. |
| **Acceptance** | Entry measures defined and sourced; guardrails not breached; no tenant-isolation, rights or accessibility failure; cohort feedback collected voluntarily. |
| **Risk controls** | Cohort cap; kill switch rehearsed; midpoint continue/correct/pause/stop decision recorded. |
| **Stop** | Any P0; guardrail breach; sponsor withdraws. |
| **Exit evidence** | Midpoint and final decision records signed by both sponsors; for leaving `pilot_read_only`: `source_reconciliation_passed`, `accessibility_review_passed`, `data_quality_adoption`. |

### Phase 7 — Parallel run

| | |
| --- | --- |
| **Purpose** | Prove Semester agrees with the incumbent over enough real periods to be trusted to take over. |
| **Entry** | Phase 6 exit; the migration record's `parallel_runs_required` set. |
| **Work** | Run both; compare per period; log every discrepancy with a disposition. Rollout stays `pilot_write_enabled`; Semester writes only to its own native objects while the incumbent stays official. |
| **Roles** | R: ML, IE, IL. A: IL. *Data owner, registrar.* |
| **Cadence** | Per period (term milestone, billing cycle, grading window — whichever the design chose); weekly review. |
| **Artifacts** | `parallel_run` evidence rows per period; discrepancy log; incumbent-authority statement. |
| **Acceptance** | The required number of distinct periods passed, the latest passed; every discrepancy dispositioned by the data owner. |
| **Risk controls** | Incumbent remains official until cutover; students are told which system is authoritative in plain words. |
| **Stop** | A discrepancy class that cannot be explained; a period fails. |
| **Exit evidence** | Parallel-run gate passed in the Migration Center; sign-off from each approval area; rollout evidence `workflow_reliability` (the per-period comparison record). |

### Phase 8 — Go-live

| | |
| --- | --- |
| **Purpose** | Transfer authority for the agreed scope, safely and reversibly. |
| **Entry** | Phase 7 exit; per-tenant go-live checklist complete (this is the `cutover_checklist_complete` evidence); **and** the company-level blocking items in `GO_LIVE_CHECKLIST.md` closed or explicitly waived by the executive sponsor *and* counsel in writing. |
| **Work** | Cutover per [`CUTOVER-ROLLBACK-GO-LIVE.md`](CUTOVER-ROLLBACK-GO-LIVE.md): final snapshot, ordered steps, verification, communication. |
| **Roles** | R: IL, IE, ML, SL. A: executive sponsor (Semester) and customer sponsor jointly. |
| **Cadence** | Go/no-go at T-72h and T-2h; stand-up twice daily on the day. |
| **Artifacts** | Signed GO (the `sponsor_go_live` evidence, signed by both sponsors); cutover log; verification record; communications sent. |
| **Acceptance** | Every verification in the cutover checklist passes within its window; rollback path confirmed live. |
| **Risk controls** | Rollback trigger table with pre-agreed numbers; a named person holds the abort decision. |
| **Stop** | Any rollback trigger. |
| **Exit evidence** | Signed go-live record; rollout `production_limited` — the database allows the move only with `workflow_reliability`, `cutover_checklist_complete` and `sponsor_go_live` evidence recorded since the school entered `pilot_write_enabled`. |

### Phase 9 — Hypercare

| | |
| --- | --- |
| **Purpose** | Staff the first weeks as if something will break, then hand over to steady-state support. |
| **Entry** | Go-live record; rollout `production_limited`. |
| **Work** | [`HYPERCARE-AND-HANDOFF.md`](HYPERCARE-AND-HANDOFF.md). |
| **Roles** | R: SL, IL, CSM, IE. A: SL. |
| **Cadence** | Daily stand-up, then three times weekly, then weekly. |
| **Artifacts** | Hypercare log; known-issues list; handoff packet. |
| **Acceptance** | Exit criteria in the hypercare document, met on evidence, not elapsed days. |
| **Risk controls** | Change freeze except fixes; a rota with a backup on every shift. |
| **Stop** | Repeated P0/P1 → return to the last stable rollout state. |
| **Exit evidence** | Signed handoff; `expansion_decision` evidence recorded and rollout moved to `production_active`; stored stage → `measure`. |

### Phase 10 — Optimize

| | |
| --- | --- |
| **Purpose** | Keep the account healthy, prove value, and expand only where evidence and capacity allow. |
| **Entry** | Handoff signed. |
| **Work** | [`SUCCESS-SYSTEM.md`](SUCCESS-SYSTEM.md): health review, adoption review, success plan, EBR, renewal and expansion triggers; feedback loop; change management. Expansion re-enters the method at the phase its scope requires (new integration → phase 4; new cohort → phase 6). |
| **Roles** | R: CSM, SL. A: CSM. |
| **Cadence** | Weekly health review; monthly working session; quarterly EBR; renewal cadence at 120/90/60/30 days. |
| **Artifacts** | Health reviews; EBR records; renewal opportunity; expansion proposals. |
| **Acceptance** | Per the success system. |
| **Risk controls** | Human-reviewed risk, never a score that triggers outreach on its own. |
| **Stop** | P0/P1 on the tenant overrides every commercial motion. |
| **Exit evidence** | Renewal outcome recorded, or offboarding begins. Adding a module or campus needs `module_campus_approval` evidence to leave `production_active` for `expansion`. |

## What each stage exit leaves behind (the handoff packet)

At every stage exit the departing owner files the same packet so the next owner,
or a backup, can continue with no conversation: the signed gate evidence; the
decision-register rows since the last exit; open risks with owners; the exact
workbook state; what was learned that belongs in a template. A stage that
exits without the packet has not exited.

## Evidence state

**Repository evidence.** The stored stages, rollout states, Configuration
Studio, Migration Center, roster staging, integration control plane, offboarding
functions and the commercial tables this method uses all exist on `main` and are
cited by name.

**Operational evidence.** None. No institution has been taken through the ten
phases, no backup seat is filled, and no shadow test has been run.

**Missing test/proof.** One bounded implementation run end to end with a second
person shadowing each phase; seat-coverage table filled; a template fix made
from what that run found.

## Claim ceiling

Semester may describe this as its intended implementation method and use it for
conditional planning and sandbox work.

## Prohibited claims

Do not claim any institution is implemented, integrated, migrated, live,
accepted or supported, that implementation is repeatable beyond one operator, or
that any timeline is achieved, from this document.
