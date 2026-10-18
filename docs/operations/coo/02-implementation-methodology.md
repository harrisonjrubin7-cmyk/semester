# 02 · Customer implementation methodology

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — NO NAMED IMPLEMENTATION HAS RUN** |
| Owner seat | `success` (implementation lead role, held by the Founder, acting) |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Builds on | [`PILOT-TO-PRODUCTION`](../../operating-model/PILOT-TO-PRODUCTION.md) (the state machine), [`INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK`](../../commercial/INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md) (the stage values), [`CUSTOMER-ONBOARDING-TIMELINE`](../../market-readiness/CUSTOMER-ONBOARDING-TIMELINE.md), [`PAID-PILOT-FRAMEWORK`](../../PAID-PILOT-FRAMEWORK.md), [`PILOT-TO-ANNUAL-CONVERSION`](../../PILOT-TO-ANNUAL-CONVERSION.md) |
| Claim ceiling | Semester may describe this as its conditional implementation method for evidence-gated sandbox and pilot work. It may not say any institution is implemented, integrated, migrated, live or supported. |

## The rule over all of it

**Never configure a customer to depend on something that is not available, and never move a tenant forward without evidence recorded since it entered its current state.** The database already refuses the rest ([`tenant_rollout`](../../operating-model/PILOT-TO-PRODUCTION.md#what-the-database-refuses)). This page is how people work inside that refusal.

Four modes, from the audit and the platform's own design, decide which phases a customer needs:

| Mode | Customer situation | Phases that apply |
| --- | --- | --- |
| **Native** | No external system, or the customer wants Semester as primary | All; integration phase is optional |
| **Connected** | Existing authoritative system stays | All; integration phase has source-precedence and reconciliation work |
| **Coexistence** | Department-by-department or module-by-module adoption | All, repeated per department |
| **Replacement** | Customer cuts over from a legacy platform | All, plus parallel run and a separate cutover decision; **not offered at Stage 0 or Stage 1** |

Replacement is a status earned after a parallel run, data verification, operational acceptance, contractual approval and counsel review. It is never a sales position.

## The lifecycle

Ten phases, from first conversation to expansion. Phases 1–7 and 9–10 use the stage values the implementation record already stores (`discover`, `configure`, `integrate`, `validate`, `train`, `launch`, `hypercare`, `measure`, `expand`). Qualification, decision and offboarding are recorded as milestones and linked decision records, not as new stage values, because the stored sequence is fixed.

```
0 Qualify → 1 Discover → 2 Design* → 3 Configure → 4 Integrate → 5 Validate
→ 6 Train → 7 Launch gate → 8 Hypercare → 9 Measure and adopt → 10 Decide, renew, expand
                                                      * milestone inside `discover` / `configure`
At any point: pause, suspend, or offboard
```

### Phase map

| # | Phase | Stored stage | Rollout state it works toward | Customer seat | Semester seat |
| --- | --- | --- | --- | --- | --- |
| 0 | Qualify | — (pipeline) | `directory` → `requested` | Executive sponsor | `founder` |
| 1 | Discover | `discover` | `claimed` | Sponsor, champion | `success` |
| 2 | Design | `discover` / `configure` milestone | `claimed` → `security_review` | Champion, IT, privacy | `success`, `engineering` |
| 3 | Configure | `configure` | `security_review` → `sandbox_uat` | IT/identity | `engineering` |
| 4 | Integrate | `integrate` | `sandbox_uat` | IT/identity, data owner | `data` (vacant) / `engineering` |
| 5 | Validate | `validate` | `sandbox_uat` → `pilot_read_only` | Champion, accessibility, security | `operations`, `accessibility` |
| 6 | Train | `train` | `pilot_read_only` | Champion, support desk | `success` |
| 7 | Launch gate | `launch` | `pilot_read_only` (or `pilot_write_enabled`) | Sponsor | Council (`decide()`) |
| 8 | Hypercare | `hypercare` | `pilot_read_only` / `pilot_write_enabled` | Champion, support desk | `operations`, `success` |
| 9 | Measure and adopt | `measure` | `pilot_write_enabled` → `production_limited` | Sponsor, data owner | `success` |
| 10 | Decide, renew, expand | `expand` | `production_active` → `expansion`, or `offboarding` | Sponsor, procurement | `founder`, `finance` |

The rollout state machine is authoritative. If this table and the database disagree, the database is right and this page is wrong.

## Phase detail

Each phase lists **entry** (what must already be true), **work**, **artifacts**, **exit gate** (evidence the gate holder checks) and **handoffs** ([handoffs](handoffs.md)). Exit gates are the exit gates in `tenant_rollout_evidence`; they are named here in backticks.

### Phase 0 — Qualify

| | |
| --- | --- |
| Entry | A named buyer with a bounded student or institutional job to be done |
| Work | Fit test against the [ideal customer profile](../../commercial/IDEAL-CUSTOMER-PROFILE.md); buying-committee map; one workflow, one cohort of 10–200, one measurable outcome; the no-fit list below; deal-desk review; data classes named and forbidden classes confirmed absent |
| Artifacts | Qualification record; pilot hypothesis; deal-desk decision ([`COMMERCIAL-GOVERNANCE`](../../operating-model/COMMERCIAL-GOVERNANCE.md)) |
| Exit gate | Sponsor qualified (`sponsor_qualified`); authority to proceed in writing |
| Handoff | [H-01](handoffs.md#h-01-revenue-to-implementation) |

**No-fit list.** Stop and say no if: the buyer wants full system replacement; no named sponsor or champion exists or can be identified; the cohort would exceed what can be supported by hand (above 200); the success measure is about individual students (risk scores, early alerts); the buyer needs a commitment Semester cannot yet operate (24×7 support, an uptime figure, a certification); or the data scope includes a forbidden class from the [paid-pilot framework](../../PAID-PILOT-FRAMEWORK.md).

### Phase 1 — Discover

| | |
| --- | --- |
| Entry | Authority to proceed; sponsor and champion named |
| Work | Stakeholder map (sponsor, champion, IT/identity, privacy, security, accessibility, procurement, counsel); current-process and system inventory; data authority (who owns each record, what wins when systems disagree); constraints; calendar and freeze windows; success measures with baselines; risks and exclusions |
| Artifacts | Implementation charter ([TPL-05](templates.md#tpl-05-implementation-charter)); customer RACI; tenant risk register opened ([10](10-tenant-launch-risk-and-readiness.md)) |
| Exit gate | Signed charter and RACI; baselines agreed; decision date for convert, extend or stop written down |
| Handoff | None; the charter is the package for phase 2 |

### Phase 2 — Design

| | |
| --- | --- |
| Entry | Signed charter |
| Work | Role and permission design from the [role matrix](../../ROLE-PERMISSION-MATRIX.md); data-flow map with minimum necessary data; source-precedence rules per object; configuration plan inside the [configuration tiers](../../operating-model/CONFIGURATION-TIERS.md) (no bespoke code); integration choice among sandbox, read-only and write; manual or read-only fallback for every dependency; acceptance tests written *before* build; support routing design |
| Artifacts | Solution design; data-flow map; acceptance-test list; fallback list |
| Exit gate | `security_kickoff`; security and privacy review package ready ([H-02](handoffs.md#h-02-implementation-to-securityprivacy-review)); the customer's privacy and security owners have the package |

### Phase 3 — Configure

| | |
| --- | --- |
| Entry | Approved design; data authority paper executed (DPA route confirmed with counsel) |
| Work | Provision tenant in sandbox data mode; roles, feature flags, branding, policies; least-privilege access for named people; configuration export and read-back; rollback path recorded |
| Artifacts | Configuration record; export; access list |
| Exit gate | `security_privacy_approval`, `dpa_executed`; configuration validated by read-back |
| Handoff | [H-03](handoffs.md#h-03-implementation-to-engineering-work-order) when engineering work is needed |

Sandbox data mode holds until production data is approved. Synthetic or minimum data only.

### Phase 4 — Integrate

| | |
| --- | --- |
| Entry | Approved connector and scope; credentials issued under least privilege |
| Work | Identity (SSO) mapping; roster and course sources; calendar; LMS (LTI) where in scope; mapping versions; sync cursors; idempotency, retry and dead-letter behaviour; reconciliation report; degraded-mode behaviour proved by switching the connector off |
| Artifacts | Mapping record; reconciliation report; degraded-mode test result |
| Exit gate | `sso_login_verified`, `source_reconciliation_passed`; the product still works with the connector disabled |
| Handoff | [H-04](handoffs.md#h-04-engineering-to-implementation-integration-accepted) |

A repository connector is not a configured target; a sandbox success is not production activation; a commercial entitlement is not authorization. Each is stated in the customer record.

### Phase 5 — Validate

| | |
| --- | --- |
| Entry | Configured and integrated sandbox |
| Work | User acceptance by role (student, faculty, advisor, admin, support); cross-tenant isolation test; critical-journey run from the [catalog](../../DEFINITION-OF-DONE.md#the-core-journeys); accessibility pass with assistive technology on the in-scope journeys; privacy and rights drill (export, deletion, correction); monitoring and alert test; incident, rollback and restore rehearsal; capacity check for the cohort and its peak |
| Artifacts | UAT record; defect list by severity; rehearsal records; test results filed as evidence |
| Exit gate | `uat_signoff`, `rls_isolation_passed`, `accessibility_review_passed`; no open P0 or P1 defect |
| Handoff | [H-05](handoffs.md#h-05-implementation-to-the-launch-council) assembles the council package |

### Phase 6 — Train

| | |
| --- | --- |
| Entry | UAT signed |
| Work | Admin and support-desk training; faculty and advisor quick starts; student onboarding content; role-based rehearsal; backup coverage confirmed on both sides; communications drafted for approval |
| Artifacts | Training records ([TPL-24](templates.md#tpl-24-training-module-and-sign-off)); approved communications; support readiness checklist |
| Exit gate | Named, trained customer support desk and backup; training sign-off; support routing live and tested |
| Handoff | [H-06](handoffs.md#h-06-implementation-to-support-hypercare-entry) |

### Phase 7 — Launch gate

| | |
| --- | --- |
| Entry | Training done; baseline measured and frozen; support routing live |
| Work | Tenant readiness review against [10](10-tenant-launch-risk-and-readiness.md); council decision: a fresh `decide()` result attached to the decision record; customer sign-off |
| Artifacts | Go-live readiness record ([TPL-07](templates.md#tpl-07-go-live-readiness-review-and-decision-record)); stop controls confirmed |
| Exit gate | `sponsor_go_live` and a signed GO or GO WITH CONDITIONS. NO-GO means a dated remediation plan, not a debate. |

An open P0 or P1 blocker is NO-GO and no acceptance can waive it. A GO WITH CONDITIONS lists each accepted blocker with owner, reason, disclosure to users and expiry.

### Phase 8 — Hypercare

| | |
| --- | --- |
| Entry | Signed GO |
| Work | Staffed observation of the cohort; daily review for the first week, then every other day; incident and problem handling; rollback readiness; weekly sponsor call; accessibility and support signals reviewed daily |
| Length | At least two weeks, per the pilot lifecycle; longer if the exit test is not met |
| Exit test | Fourteen days with no open P0 or P1; reconciliation passing for seven days; support contact rate and queue age inside thresholds ([09](09-dashboards-and-indicators.md#d4-support-and-quality)); the customer desk resolves its first-line issues without Semester help for seven days; sponsor agrees in writing |
| Handoff | [H-07](handoffs.md#h-07-hypercare-to-steady-state) |

### Phase 9 — Measure and adopt

| | |
| --- | --- |
| Work | Weekly aggregate scorecard against baseline (n ≥ 10 suppression); guardrail review; change, incident and problem management; access review; adoption actions ([below](#adoption)); midpoint and final outcome reports |
| Artifacts | Weekly scorecard; midpoint report; final report; EBR ([TPL-09](templates.md#tpl-09-executive-business-review)) |
| Exit gate | `workflow_reliability`, `cutover_checklist_complete` for any write-enabled step; sponsor decision |

### Phase 10 — Decide, renew, expand

See [renewal](#renewal) and [expansion](#expansion). Offboarding is its own path ([offboarding](#offboarding)).

## The 26-week plan

A pilot runs exactly 26 weeks (D-134). The existing onboarding timeline fixes launch at days 46–60. **Assumption to confirm with finance and counsel:** the term starts at kickoff, so the pre-launch period consumes the first eight to nine weeks. If a contract starts the term at launch, every row below shifts and the term is longer in calendar terms. Integration-heavy pilots (SSO plus LMS plus roster) take longer to reach launch; they move the dates, not the gates.

| Weeks | Phase | Milestone | Gate evidence |
| --- | --- | --- | --- |
| 0–1 | Discover | Kickoff; owners named | Signed charter |
| 1–3 | Discover, design | Data map; baselines; calendar and freezes | `security_kickoff` |
| 2–4 | Design, configure | Sandbox tenant; roles; branding; security and privacy review package out | `security_privacy_approval`, `dpa_executed` |
| 3–6 | Configure, integrate | SSO and sources in sandbox | `sso_login_verified` |
| 5–7 | Validate | UAT by role; isolation, accessibility, rights, incident and restore rehearsals | `uat_signoff`, `rls_isolation_passed`, `accessibility_review_passed` |
| 6–8 | Train | Admin, support, faculty, student content | Training sign-off |
| 8–9 | Launch gate | Council decision; approved communications after signed GO | `sponsor_go_live` |
| 9–11 | Hypercare | Daily review; two weeks minimum | Exit test passed |
| 11–24 | Measure and adopt | Weekly scorecard; midpoint report at week 18; adoption actions | `data_quality_adoption`, `workflow_reliability` |
| 22–26 | Decide | Final report; decision meeting; convert, extend, expand, pause or stop | Signed verdict ([`PILOT-TO-ANNUAL-CONVERSION`](../../PILOT-TO-ANNUAL-CONVERSION.md)) |

Where a freeze window from [01](01-operating-cadence.md#the-academic-calendar-overlay) falls on a row, the row moves; the gate does not.

## Adoption

Adoption is measured, not assumed. A user is **activated** when they complete the tenant's defined first-value action; a cohort is **adopted** when the recurring core workflow is used without Semester's help.

| Stage | Meaning | Measure | Actions when behind |
| --- | --- | --- | --- |
| Invited | Cohort has the invitation | Delivery rate | Fix channel and timing |
| Activated | Completed first value | Activation rate and median time to first value ([09](09-dashboards-and-indicators.md#d3-implementation-and-adoption)) | Shorten onboarding; contextual help; champion nudge |
| Habitual | Core workflow weekly for four of six weeks | Weekly active in cohort | Faculty enablement; workflow review with champion |
| Self-sufficient | Customer desk resolves first-line issues | Share of cases closed by the customer's desk | More training; macros; knowledge-base gaps |
| Advocating | Customer cites outcomes unprompted | Reference permission (written; see claims rules) | Only then the [reference program](../../commercial/CUSTOMER-REFERENCE-PROGRAM-DRAFT.md) |

Adoption actions respect the [ethical engagement policy](../../ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md): no dark patterns, frequency caps, a way out of every notification.

## Renewal

The renewal clock starts at kickoff, not at the end of term. Dates below count back from the term end or the decision meeting.

| When | Action | Owner seat | Output |
| --- | --- | --- | --- |
| T-180 days | Health review; confirm sponsor and champion are still in role; update success plan | `success` | Renewal risk view ([TPL-10](templates.md#tpl-10-renewal-risk-review)) |
| T-120 | First EBR with outcomes against baseline | `success`, `founder` | EBR; list of unmet expectations |
| T-90 | Decision-criteria conversation with the sponsor and procurement; map the buying path; flag counsel items | `founder`, `finance` | Dated procurement steps |
| T-60 | Proposal drafted from the deal policy; conversion paperwork routed to counsel | `finance` | Proposal; counsel queue entry |
| T-30 | Final report delivered; decision meeting held | `founder` | Signed verdict: convert, extend, expand, pause or stop |
| T-0 | New order effective, or offboarding begins | `finance`, `success` | Order, or the [offboarding](#offboarding) record |
| T+30 | Post-decision review: what was learned | `success` | Lessons logged |

A **stop** is a successful outcome of an honest pilot, not a failed one. It must be a possible decision in writing from the first charter.

## Expansion

Expansion is a new authorized scope, never a default consequence of a good pilot. Triggers and gates:

| Expansion | Trigger | Gate before proceeding |
| --- | --- | --- |
| More users in the same module | Adoption at or above target; reliability green for eight weeks | Capacity check; support staffing check ([04](04-support-operating-model.md#staffing-model)) |
| Another module | Customer request tied to a baseline-measured job | New order; PIA row for the module ([`PRIVACY-IMPACT-ASSESSMENT`](../../operating-model/PRIVACY-IMPACT-ASSESSMENT.md)); the module's own readiness gates |
| Write-enabled integration | Read-only reconciliation passing; customer asks | Separate approval; `cutover_checklist_complete`; rollback rehearsed |
| Another department or campus | Sponsor sponsors it; a second champion named | Repeat phases 1–7 for the new scope; the [multi-campus](../../operating-model/MULTI-CAMPUS.md) hierarchy |
| Replacement of a legacy system | Customer asks; parallel run planned | Counsel, security, privacy, accessibility, finance and customer acceptance; a separate decision |

## Offboarding

An offboarding is planned from the first charter. [`SCHOOL-OFFBOARDING`](../../SCHOOL-OFFBOARDING.md) and [`DATA-PORTABILITY-AND-OFFBOARDING`](../../DATA-PORTABILITY-AND-OFFBOARDING.md) own the mechanics. This method adds the project steps:

1. Written notice and effective date; counsel confirms obligations.
2. Freeze new configuration; set the tenant to `offboarding`.
3. Export to the customer in the agreed format; checksum the export; customer confirms receipt in writing.
4. Retention, legal-hold and deletion decisions applied by the privacy seat; student-owned data handled by student choice where the design allows it.
5. Deletion evidence; the `completion_certificate` evidence row; state `archived`.
6. A closeout review: what the customer would change, what Semester would change.

## Roles and the RACI by phase

R = does the work, A = accountable, C = consulted, I = informed. Customer seats are the seats of [`OWNER-AND-ACCOUNTABILITY-MATRIX`](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md). A seat unfilled at Semester means the Founder is acting; that is disclosed in the charter and never counts as independent assurance.

| Phase | `founder` | `success` | `engineering` | `security` | `privacy` | `accessibility` | `operations` | Sponsor | Champion | Customer IT |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 Qualify | A | R | C | I | C | I | I | A (their side) | C | I |
| 1 Discover | I | A/R | C | C | C | C | I | A | R | C |
| 2 Design | I | A | R | C | C | C | C | C | R | R |
| 3 Configure | I | C | A/R | C | C | I | C | I | C | R |
| 4 Integrate | I | C | A/R | C | C | I | C | I | C | A/R |
| 5 Validate | I | R | R | A | A | A | R | C | A/R | R |
| 6 Train | I | A/R | C | I | I | C | R | I | A/R | C |
| 7 Launch gate | A | R | R | R | R | R | R | A (their side) | R | C |
| 8 Hypercare | I | A | R | C | C | C | R | I | R | C |
| 9 Measure | I | A/R | C | I | C | C | C | A (their side) | R | I |
| 10 Decide | A | R | C | C | C | C | I | A (their side) | R | I |

Two accountabilities in one cell (security, privacy, accessibility at validate) mean each holds a stop right over its own domain; they are not shared judgment.

## Scope and change control

Scope is the signed charter. A change that adds a connector, data class, cohort size, module or promise is a change order with its own risk entry, price and gate; it is never absorbed to be helpful. A request that would need bespoke code is declined or routed to the [portfolio review](../../operating-model/PORTFOLIO-GOVERNANCE.md): *if a university request cannot be configured, audited, tested, supported, rolled back and reused, it does not become permanent core product code.*

## Quality of the method itself

| Measure | Target (SL0) | Source |
| --- | --- | --- |
| Gate adherence: phases exited with all evidence present | 100% | Rollout evidence table |
| Rework: phases re-entered after a failed gate | at most 1 per tenant in the first five tenants; fall after | Phase log |
| Time to launch gate from kickoff | 60 days for standard scope; recorded, not forced | Rollout history |
| Charter changes after signature | recorded and priced | Change orders |
| Closeout review held within 30 days of a decision | 100% | Closeout record |

## Related

[Handoffs H-01 to H-08, H-18](handoffs.md) · [Service blueprint: implementation](service-blueprints.md#blueprint-1-implementation-from-qualification-to-launch) · [Tenant launch readiness](10-tenant-launch-risk-and-readiness.md) · [Templates TPL-05 to TPL-10](templates.md)
