# Operations workflow catalog

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** proposal; records no decision.

This is the catalog of **operations** workflows: the ones an institution operator or a Semester operator runs on the control plane. The 319 student-and-product workflow steps live in [`docs/master/SEMESTER_WORKFLOW_CATALOG.md`](../master/SEMESTER_WORKFLOW_CATALOG.md) (203 not fully built per [`SEMESTER_GAP_REGISTER.md`](../master/SEMESTER_GAP_REGISTER.md)); the support, incident and implementation procedures are in [`coo/`](coo/README.md) and [`handoffs.md`](coo/handoffs.md) (18 handoff contracts). This page does not restate them. It gives each operations workflow an identity, its approval class, its audit events and its rollback, so the workflow engine (`packages/platform/src/engines/workflow`, `workflow_versions`) and the controlled-action sheet ([`CONTROLLED_ACTION_PATTERNS.md`](CONTROLLED_ACTION_PATTERNS.md#2-contract-for-a-controlled-action)) have one list to be checked against.

**Columns.** *Approval*: none / 1 / 2P (two-person) / 2P+C (two-person plus counsel). *State*: Built / Partial / Missing. *Rollback*: R reversible, C compensable, X irreversible. Event names are proposals unless an existing table is named. Every workflow ends with a receipt and a work-item resolution (§3).

## 1. Platform and tenant

| ID | Workflow | Actors | Approval | Audit events | Rollback | State | Tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W-01 | Create tenant and assign lifecycle state | implementation, success | 1 | `tenant.created`, `tenant.lifecycle_changed` | R | Missing | P0 |
| W-02 | Activate tenant (launch gate) | implementation, institution lead | 2P; refuses with an open P0 exception | `launch_gate.decided`, `tenant.activated` | R (to observation) | Partial (`tenant_rollout`) | P0 |
| W-03 | Suspend / resume tenant | security, founder | 2P | `tenant.suspended` | R | **Built** (`tenant-suspension` executor) | P0 |
| W-04 | Enable module / change module mode | institution admin, implementation | 1 + entitlement | `module_mode.changed` (`tenant_module_mode_history`) | R | Partial (direct write, F-1) | P0 |
| W-05 | Deploy feature cohort; engage kill switch | release | 1 standard / 2P high-risk flag | `rollout.cohort_changed`, `killswitch.engaged` | R | Partial (read-only tab, direct write) | P0 |
| W-06 | Publish configuration version | institution admin | 2P | `config.version_published` | R (publish prior) | **Built** (Configuration Studio) | P0 |
| W-07 | Grant / revoke / expire role | admin, security | scope-dependent; platform 2P | `role_grant_audit_event` | R | **Built** (`role-grant`) | P0 |
| W-08 | Access review (attestation) | reviewer ≠ grantee/granter | 1 | `access_review.attested` | R | Missing (⊕`access:review`) | P1 |
| W-09 | Break-glass access | incident responder | 2P + ticket + MFA | `break_glass.opened/closed/reviewed` | R (expiry ≤ 4 h) | **Built** | P0 |
| W-10 | Offboard tenant / export / purge | institution admin, privacy | 2P+C for purge | `offboarding.*` (`school_offboarding`) | R before purge, X after | Partial (legacy admin gate, F-5) | P1 |

## 2. Integration, migration, data rights

| ID | Workflow | Actors | Approval | Audit events | Rollback | State | Tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W-11 | Register integration; approve connection and credential reference | IT, implementation | 1 (`integration-config` duty: 2P in prod) | `integration.registered`, `connection.approved` | R | Partial (direct DML, F-1) | P0 |
| W-12 | Approve field mapping (version) | institution data steward | 1 + steward sign-off | `mapping.approved` | R (versions immutable) | Partial (mapping versions exist) | P0 |
| W-13 | Handle sync exception; replay dead letter | IT, operator | 1 for replay | `sync.exception_resolved`, `deadletter.replayed` | C | Partial (integration only; domain outbox has no replay) | P0 |
| W-14 | Reconciliation and dual run | implementation | gate | `reconciliation.run`, `dualrun.started/ended` | R | Partial | P0 visibility |
| W-15 | Switch observation → authoritative sync | institution + Semester | 2P + dual-run gate | `authority.switched` | R before cutover gate | Missing | P2 |
| W-16 | Data-subject request | privacy | 1 (clock visible) | DSR lifecycle events | X (deletion) | **Built** (`answer-data-subject-requests`) | P1 |
| W-17 | Place / release legal hold | counsel, privacy | 1 / 2P to release | `hold.placed/released` | R | **Built** | P1 |
| W-18 | Change retention policy | privacy | 2P+C | `retention.policy_changed` | X if shortening | Missing | P1 |

## 3. Work, support, incident, release

| ID | Workflow | Actors | Approval | Audit events | Rollback | State | Tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W-19 | Work item lifecycle (create from event, acknowledge, assign, resolve, dismiss with reason) | any operator | none | `work_item.*` | R | Missing | P0 |
| W-20 | Support ticket and escalation | support | none; sev ≥ 2 notifies | ticket events (`support_tickets`) | n/a | **Built** (flag off) | P0 |
| W-21 | Elevated support access to a student's content | support, student | student consent | `support_access_event` | R (grant expires) | **Built** | P0 |
| W-22 | Declare / escalate / resolve incident; publish notice | incident commander | declare 1; resolve SEV1–2 2P where staffed | `incident.*`, `governance_incident_notices` | n/a | Missing (notices only) | P0 basic |
| W-23 | Promote release; rollback | release | gate evidence green | `release.promoted/rolled_back` | R | Partial (`platform_release_evidence`) | P0 |
| W-24 | Postmortem and corrective action | commander | 1 | `postmortem.published` | n/a | Missing | P1 |

## 4. Commercial and finance

| ID | Workflow | Actors | Approval | Audit events | Rollback | State | Tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W-25 | Quote → order form → contract recorded | revenue, founder | discount > floor: 1 more | `quote.issued`, `contract.recorded` | C (void) | Missing | P0 |
| W-26 | Set / change entitlement | finance | 1; downgrade with data impact: 2P | `entitlement.changed` (`tenant_plan_history`) | R | Partial (`tenant_plan` + history; entitlement resolution in shadow) | P0 |
| W-27 | Invoice and payment reconciliation | finance | none; exceptions queue | `invoice.issued`, `payment.reconciled` | C | Partial (Stripe individual path; institutional unimplemented) | P0 basic |
| W-28 | Credit / refund | finance | 2P above threshold | `refund.requested/issued` | C | Missing (no executor) | P1 |
| W-29 | Renewal and expansion | success, revenue | 1 | `renewal.opened/closed` | n/a | Missing | P1 |
| W-30 | Customer health review (QBR) | success | none | `health.reviewed` | n/a | Missing | P1 |

## 5. Institution operations (the registration-readiness pilot slice, P0)

| ID | Workflow | Actors | Approval | Audit events | Rollback | State | Tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W-31 | Review registration readiness (windows, holds, capacity, cohort gaps) | registrar | none; sensitive-read audit | `registration.readiness_viewed` | n/a | Missing operator side | P0 |
| W-32 | Registration override | registrar | reason required | `registration.override_granted` (`registration_audit_event`) | R (second override) | Partial (RPC exists) | P0 |
| W-33 | Open / close section; change capacity | registrar, dept | 1 | `section.capacity_changed` | R | Partial | P1 |
| W-34 | Advisor intervention and outreach campaign | advisor, lead | 1 + per-recipient consent/suppression check | `outreach.sent`, `referral.created` | X (sent) | Partial (`CampaignManager`) | P0 slice |
| W-35 | Change degree-requirement rule | registrar + academic affairs | 2P with preview of affected students | `requirement.version_published` | R, recompute flagged | Partial | P1 |
| W-36 | Release grades | faculty | department rule | `grade.released` | C | Missing | P1 |
| W-37 | Moderate, restrict, appeal | moderator, reviewer ≠ original | 2nd reviewer for suspension | `moderation_audit_event` | R | Partial | P1 |
| W-38 | Student account: charge, plan, hold, refund | student accounts | threshold | `account.*` | C | Partial | P1 |

## 6. Workflow definition standard

A workflow is data (`workflow_versions`), not code, once it is more than three steps. Each version records: id, trigger, steps, actor capability per step, approval class, timeouts and escalation, the controlled-action sheet it implements, the audit events it emits, the read models it invalidates, its test, and its owner seat. **A workflow with a step that has no actor capability, no timeout or no audit event does not publish** — the same two-person publish rule Configuration Studio already enforces. Timeouts escalate to the next seat, and where that seat is `UNASSIGNED` the work item is flagged "no escalation target" rather than silently ageing.

## 7. Coverage against the P0 sequence

W-01, 02, 04, 05, 06, 07, 09, 11–14, 19–23, 25–27, 31, 32, 34 are the P0 set. Of these, **built**: W-03, 06, 07, 09, 20, 21. **Partial**: W-02, 04, 05, 11–14, 23, 26, 27, 32, 34. **Missing**: W-01, 19, 22, 25, 31. The missing five are the first workflow build targets; four need the work-item and projection foundation ([`OPERATIONS_ROADMAP.md`](OPERATIONS_ROADMAP.md#first-25-implementation-actions)).
