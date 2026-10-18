# Cutover checklist, rollback plan and go-live checklist

| Control | Value |
| --- | --- |
| Status | **TEMPLATE — NO CUTOVER HAS BEEN RUN; ROLLBACK HAS NOT BEEN REHEARSED ON A TENANT** |
| Owner | Implementation lead seat; the abort decision is held by a named person per cutover |
| Evidence date | 2026-10-04 at `origin/main` `7287ddc` |
| Used in | [phases 6, 7 and 8](METHODOLOGY.md#phase-6--pilot) |
| Sits on | Company-level gate [`../market-readiness/GO_LIVE_CHECKLIST.md`](../market-readiness/GO_LIVE_CHECKLIST.md) (status `IN_PROGRESS` at the evidence date), [`../../ROLLBACK.md`](../../ROLLBACK.md), [`../../RESTORE.md`](../../RESTORE.md), [`../engineering-operations/MIGRATION-AND-ROLLBACK-RUNBOOK.md`](../engineering-operations/MIGRATION-AND-ROLLBACK-RUNBOOK.md) |
| Copy to | `docs/evidence/implementation/<tenant-id>/cutover-<date>.md` |

Two levels, never confused. The **company-level** checklist says the platform is
fit to host an institution; this document's checklists say **this tenant** is fit
to go live. The tenant checklist inherits the company one: a tenant cannot be
signed GO while a company-level blocking item is open, unless the executive
sponsor **and counsel** record a written waiver naming the item, the risk and its
expiry. A waiver is a decision-register row, not a conversation.

## 1. Go / no-go criteria

Held at T-72h and again at T-2h. Every line is a link, not an opinion. Any `No`
is a no-go until closed or waived as above.

| # | Criterion | Evidence | Go? |
| --- | --- | --- | --- |
| 1 | Phase 7 exit: required parallel-run periods passed, discrepancies dispositioned | Migration Center `parallel_run` evidence | |
| 2 | Migration cutover approvals present from every required area; opener ≠ approvers | `migration_approvals` | |
| 3 | Configuration baseline unchanged since signature (diff empty) | tenant workbook I1 | |
| 4 | Every in-scope integration `healthy`, or deliberately off with the student path verified | integration workbook | |
| 5 | No open P0 or P1 on the tenant or the platform | incident register | |
| 6 | Support rota covers every shift with a named backup | [`HYPERCARE-AND-HANDOFF.md`](HYPERCARE-AND-HANDOFF.md) | |
| 7 | Training gate met; communications approved | [`TRAINING-PLAN-AND-ACADEMY.md`](TRAINING-PLAN-AND-ACADEMY.md) | |
| 8 | Accessibility acceptance of the critical paths | accessibility lead record | |
| 9 | Restore from backup tested and **timed**; the tenant's data is inside that test | restore evidence | |
| 10 | Rollback rehearsed on the sandbox by the backup operator, within the agreed window | rehearsal record | |
| 11 | Kill switches rehearsed; the person who may engage them is reachable | rehearsal record | |
| 12 | Monitoring and alerts route to a named person | alert test | |
| 13 | No change freeze violation; no academic critical-period conflict (registration, grading, finals) | calendar check | |
| 14 | Legal paper in force (order, data terms) and counsel's gates cleared | contracts | |
| 15 | Customer sponsor and Semester executive sponsor have each signed GO | signature records | |

## 2. Cutover checklist

Timeline. T0 is the moment authority transfers for the scoped domain. The
numbers are the starting plan; the cutover plan for a tenant fixes real times.

| When | Step | Owner (R) | Verify (how, expected result) | Done |
| --- | --- | --- | --- | --- |
| T-14d | Scope and configuration freeze; change records only | IL | freeze notice sent | |
| T-14d | Cutover date, rollback plan and abort holder written into the migration record | ML | record exists | |
| T-7d | **Dress rehearsal** on the sandbox: full sequence, timed | IL, ML, IE | timings recorded; every step doable from the page by the backup | |
| T-72h | Go/no-go review (section 1) | IL | all Go | |
| T-48h | Student and staff communications sent (school's own channel) | customer comms | sent record | |
| T-24h | Final snapshot of the tenant and its configuration; restore path confirmed | SE | export + backup id | |
| T-24h | Final source export; digest recorded; second person re-runs the digest | ML | counts equal | |
| T-2h | Second go/no-go; abort holder confirms availability | IL | all Go | |
| T0 | Incumbent set read-only or marked non-authoritative by the system owner | customer system owner | confirmation | |
| T0 | Final load per the approved load path (only if one exists — see migration workbook §6) | ML | reconciliation after load = 0 differences | |
| T0 | Operator moves rollout to `production_limited` (needs the T-72h evidence: `workflow_reliability`, `cutover_checklist_complete`, `sponsor_go_live`); feature policy set for the cutover scope | IL (operator records) | rollout row and policy rows read back | |
| T0 | Smoke test: golden path for each role, a student on a phone, a screen reader pass, cross-tenant spot check | SE, AL | all pass | |
| T0+1h | Integration syncs run once; freshness labels correct | IE | healthy | |
| T0+2h | Decision: continue or roll back (section 3 triggers) | abort holder | recorded | |
| T0+24h | Verification review: first-day measures, support queue, incident log | IL, SL | no trigger met | |
| T+7d | Monitoring record in the Migration Center (stage `monitoring`) | ML | row recorded | |

Where a step names a load and no load path exists, the cutover is **not** a data
cutover: it is a go-live of Semester-native objects with the incumbent still
authoritative for that data, and the design must say so.

## 3. Rollback plan

### 3.1 Who decides, and on what

A named abort holder (customer sponsor and Semester executive sponsor each name
one; either may call it) decides. Rollback is called without debate when any
**trigger** below is met; between triggers it is a judgment recorded with its
reason.

| Trigger | Threshold (agree and write in the cutover plan) |
| --- | --- |
| Tenant isolation, privacy or rights failure | any |
| Active P0 | any |
| P1 (core workflow unavailable, major accessibility barrier, serious integrity risk) | not mitigated within the agreed window |
| Reconciliation mismatch after load | any unexplained difference, or > the agreed count |
| Sign-in failure for the cohort | > the agreed percentage for > the agreed minutes |
| Data loss or corruption | any |
| Sponsor withdraws | any |

Thresholds are written as numbers before cutover and signed. Blanks are not
allowed to be filled in during an incident.

### 3.2 The levels, least invasive first

Choose the lowest level that stops the harm. Each level names what it does *not*
undo.

| Level | Action | Undone by | Does **not** undo | Needs |
| --- | --- | --- | --- | --- |
| L0 | Engage the feature or school kill switch for the affected capability | disengage after verified fix | anything already written | holder of `killswitch:engage` |
| L1 | Roll configuration back: a **new draft copied from the last good version, published like any other** | roll forward again | applied records | a drafter and a **different** publisher available |
| L2 | Pause or disconnect an integration (operator pause; `disconnect` clears the credential pointer) | resume / replay after fix | data already synced; the secret still needs rotating at the provider if compromised | IE; runbook §5–6, §9 |
| L3 | Move rollout state to `paused` (remembers `resume_state`) or `suspended` (for isolation or rights failure) | resume to the remembered state with evidence | any capability exposure not tied to the record; see below | IL; rollout records are not a switch |
| L4 | Roll back the last roster promotion (`roster_rollback`) | re-stage and promote | earlier promotions (only the most recent is reversible) | migration capability |
| L5 | Restore from backup per [`../../RESTORE.md`](../../RESTORE.md) | — | everything after the restore point; plan for the data written since | executive sponsor; counsel informed when personal data is affected |
| L6 | Return authority to the incumbent system | decision to cut over again | — | system owner |

Because `tenant_rollout.state` is a record and not yet read by `feature_state`,
**L3 alone does not stop a capability.** Pair it with L0 or the feature policy.

### 3.3 Point of no return

State it in the cutover plan before T0. Typical: the moment the incumbent is
archived or decommissioned, the moment students' own work is created only in
Semester, or the moment an official write goes out. Until that moment, L6 is
available and each earlier level is a smaller step. After it, L5 (restore) is
the only way back, with its data-loss window. The go-live checklist's last item
is that the customer knew this and agreed in writing.

### 3.4 Rollback rehearsal (a gate)

The backup operator, with the primary silent, rolls back each level in use on
the sandbox, in the agreed window, and files the result. A rollback that has
never been rehearsed is not a rollback plan; it is a hope.

### 3.5 After a rollback

Stand-up continues; incident record opened and linked; customer and students
told in plain words what happened and what authority is where now
([`../market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md`](../market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md));
root cause and a corrected plan before a new date; a new GO, not the old one.

## 4. Go-live checklist (per tenant)

Sign-off table at the bottom. Every row needs evidence; unchecked is a gate.

**Platform inheritance**

- [ ] Every blocking item in `GO_LIVE_CHECKLIST.md` is ticked with evidence or carries a written waiver (executive sponsor + counsel) with expiry

**Authority and paper**

- [ ] Order, data-processing and any SLA signed; scope and exclusions agree with the configured tenant
- [ ] Counsel's gates cleared: data terms, retention length, legal-hold contact
- [ ] Decision dates and renewal notice days recorded

**Product and data**

- [ ] Tenant workbook baseline signed; readback diff empty
- [ ] Integrations in scope `healthy` or off by design; every scope approved by someone other than its owner
- [ ] Migration gates passed for each domain going live; or the design states the incumbent remains authoritative
- [ ] Cross-tenant checks pass; the privacy floor is on; AI features off unless their review passed

**People**

- [ ] Every customer-side seat in the stakeholder map has a primary and a backup
- [ ] Every Semester seat has a primary, a backup and a shadow-test record
- [ ] Training gate met; announcement texts approved by the school

**Safety**

- [ ] Kill switches and rollback rehearsed within the last 14 days
- [ ] Monitoring routes to a named person; incident contacts exchanged and tested
- [ ] Support rota set for hypercare with named backup per shift
- [ ] Accessibility acceptance of the critical paths on file

**Reversibility**

- [ ] Point of no return stated; customer signed that they understand it
- [ ] Rollback thresholds written as numbers and signed

| Who | Confirms | Signed |
| --- | --- | --- |
| Implementation lead | Checklist complete, evidence attached | |
| Security and privacy | Data flow, minimum data, rights path | |
| Accessibility lead | Critical paths accepted | |
| Support lead | Ready to receive, rota covered | |
| Semester executive sponsor | Go, with any waivers listed | |
| Customer executive sponsor | Go; scope, criteria and the point of no return agreed in writing | |
| Counsel | Legal gates cleared (name the conclusions; Semester states none) | |

## Evidence state

**Repository evidence.** Kill switches, feature policy, configuration versioning,
roster rollback, integration pause/disconnect, restore documentation and the
company go-live list exist.

**Operational evidence.** None at tenant level. The company-level checklist
itself reports restore, rollback on the production path and several other
blocking items as not yet ticked.

**Missing test/proof.** A timed restore including a tenant; a rehearsed rollback
on a sandbox by someone other than the author; one dress rehearsal.

## Claim ceiling

Semester may present these as its cutover, rollback and go-live gates.

## Prohibited claims

Do not claim any rollback is tested, any recovery time is achieved, or any
tenant is cut over or live.
