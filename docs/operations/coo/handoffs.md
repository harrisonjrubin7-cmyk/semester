# Handoff definitions

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — NO HANDOFF HAS BEEN EXERCISED BETWEEN TWO PEOPLE** |
| Owner seat | `operations` |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Claim ceiling | Semester may say it defines handoffs. It may not say a handoff operates until dated handoff records exist. |

Most operational failures happen at the seam between two owners: a case that no one picked up, a charter that omitted what sales promised, a release that support heard about from a customer. A handoff is a **contract** with a package, an acceptance test, a clock and a record.

## The handoff contract

Every handoff in this page obeys these rules.

1. **The sender stays accountable until the receiver accepts.** A handoff in transit has an owner: the sender. "Thrown over the wall" is not a state.
2. **The package is complete or it is rejected.** The receiver accepts or rejects inside the clock. A rejection names what is missing; it is never silent.
3. **The acceptance test is a restatement.** The receiver states back, in the record, what is being asked, by when, and what done looks like. If they cannot, the package is incomplete.
4. **No re-asking.** The customer or user is never asked again for something the sender already holds. This is the redundant-entry rule applied between teams.
5. **One voice to the customer.** During the handoff the customer hears from one named person, and is told who the next person is.
6. **Clocks:** unless a row says otherwise, the receiver *acknowledges* inside 4 staffed hours and *accepts or rejects* inside 1 business day. **Urgent handoffs** (P0, P1, SEV1, SEV2) acknowledge inside 15 minutes and accept inside 1 hour, within staffed hours at the current stage; outside them the stage's after-hours path applies ([05](05-incident-and-continuity.md#on-call-by-stage)).
7. **A missed clock escalates** one level ([escalation policy](04-support-operating-model.md#escalation-policy)); the miss is logged and is a metric.
8. **The record lives where the work lives:** the case, the incident, the tenant record, the change record or the pull request. Customer-specific records are in the private operations system, not this repository. Use [TPL-22](templates.md#tpl-22-handoff-record) when no system record exists.
9. **Stage 0:** where one person holds both sides, the handoff is still written, as a note to a future owner. The discipline is what makes the later transfer possible.

Handoffs are measured as **rejection rate**, **missed-clock rate** and **customer re-ask count** ([09](09-dashboards-and-indicators.md)).

## Customer lifecycle handoffs

### H-01 Revenue to implementation

| Field | Definition |
| --- | --- |
| Trigger | Signed order or authority to proceed, after the deal desk |
| From → To | `founder` / revenue → `success` (implementation lead) |
| Package | Qualification record; the pilot hypothesis, cohort and measure; signed order and its exact scope; every promise made in the sales process, written verbatim; the buying-committee map; known risks; price and credits as approved; counsel items still open; the no-fit review result; the claims used with this customer |
| Acceptance test | The implementation lead restates scope, cohort, measure, dates and every promise, and lists any promise outside the charter's permitted scope; those become change orders or are withdrawn in writing |
| Targets | Acknowledge in 4 staffed hours; accept in 2 business days; charter draft within 5 business days of acceptance |
| In transit | Revenue owns the customer relationship until acceptance |
| Record | Tenant record; qualification record |

### H-02 Implementation to security/privacy review

| Field | Definition |
| --- | --- |
| Trigger | Design approved; the `security_kickoff` evidence recorded |
| From → To | `success` → `security`, `privacy` (counsel), and the customer's security and privacy owners |
| Package | Data-flow map with minimum necessary data; role and permission design; integration list with scopes; hosting and subprocessor list; the security overview and privacy overview from the trust centre; accessibility statement of status; incident and support contacts; exit path |
| Acceptance test | Each reviewer confirms they can review from the package alone; open questions are listed with owners and dates |
| Targets | Acknowledge in 1 business day; review plan within 3 business days; review for a standard scope within 15 business days |
| In transit | Implementation owns the schedule; reviewers own their findings |
| Record | Review record; `security_privacy_approval` and `dpa_executed` evidence when satisfied |

### H-03 Implementation to engineering work order

| Field | Definition |
| --- | --- |
| Trigger | A configuration or integration need beyond the configuration tiers, or a defect found in a tenant's UAT |
| From → To | `success` → `engineering` |
| Package | The tenant, tier and phase; the exact need and why configuration cannot meet it; acceptance criteria written before work; data classes touched; the deadline and the gate it blocks; whether it is bespoke (and if so, the portfolio question) |
| Acceptance test | Engineering restates the acceptance criteria and states whether it fits the configuration tiers, requires a product change, or is declined; a decline names the reason |
| Targets | Acknowledge in 4 staffed hours; accept or decline in 2 business days; UAT P1 defect per [SL-IMP-02](04-support-operating-model.md#delivery-success-trust-and-partners) |
| In transit | Implementation owns the customer message |
| Record | Change record or defect; linked to the tenant record |

### H-04 Engineering to implementation, integration accepted

| Field | Definition |
| --- | --- |
| Trigger | A connector or mapping is complete in the sandbox |
| From → To | `engineering` / `data` → `success` |
| Package | Mapping version; sandbox contract-test results; reconciliation report; error, retry and dead-letter behaviour; the degraded-mode test result (connector disabled, product still works); known limits; monitoring and alert in place; the runbook entry |
| Acceptance test | Implementation reproduces the reconciliation and the degraded-mode test from the package alone |
| Targets | Acknowledge in 4 staffed hours; accept or reject in 2 business days |
| In transit | Engineering owns the defects until accepted |
| Record | Integration catalog; `source_reconciliation_passed` and `sso_login_verified` evidence |

### H-05 Implementation to the launch council

| Field | Definition |
| --- | --- |
| Trigger | UAT exited; training done; baseline frozen |
| From → To | `success` → the council seats (`founder`, `product`, `engineering`, `security`, `privacy`, `accessibility`, `success`, `operations`, and the customer's champion) |
| Package | The [go-live record](templates.md#tpl-07-go-live-readiness-review-and-decision-record): tier; a fresh `decide()` result; every hard gate with its evidence link and label; the [scorecard](10-tenant-launch-risk-and-readiness.md#the-readiness-scorecard); open risks by class; acceptances with disclosure and expiry; the 14-day support roster; approved communications; stop controls |
| Acceptance test | Each seat records *signed*, *signed with conditions* or *not signed* with reasons, for this decision |
| Targets | Pre-read at T-7; decision at T-3 |
| In transit | Implementation owns the package; no seat decides on a stale verdict |
| Record | Council decision record; the customer's own record of its approval |

### H-06 Implementation to support, hypercare entry

| Field | Definition |
| --- | --- |
| Trigger | Signed GO |
| From → To | `success` → `operations` (support) and the customer's support desk |
| Package | Tenant summary; roles and cohorts; known issues and limits; the macros loaded; contacts for both sides; escalation paths; the hours and what happens outside them; the risk register; the rollback and stop controls; what was promised in the charter about support |
| Acceptance test | A tabletop case routed end to end: a test case arrives, is classified, routed, answered and closed by the receiving people |
| Targets | Package at T-3; acceptance by T-1 |
| In transit | Implementation covers the first 48 hours on call for questions |
| Record | Hypercare log |

### H-07 Hypercare to steady state

| Field | Definition |
| --- | --- |
| Trigger | The [hypercare exit test](02-implementation-methodology.md#phase-8--hypercare) passes |
| From → To | `operations` (hypercare) → steady-state support and `success` |
| Package | Hypercare log; incident and problem list; defect list; reconciliation record; support metrics against clocks; customer desk's self-sufficiency measure; known-issue list; updated runbook; the sponsor's written agreement |
| Acceptance test | The receiving owners restate open items and the customer desk resolves a sample of first-line cases without help |
| Targets | Exit review within 2 business days of the test |
| In transit | Hypercare owner keeps the on-call until accepted |
| Record | Exit record; rollout evidence |

### H-08 Customer success to revenue, renewal and expansion

| Field | Definition |
| --- | --- |
| Trigger | A health review finds a renewal inside 180 days, or an expansion trigger fires |
| From → To | `success` → `founder` and `finance` |
| Package | Health score and reason; outcomes against baseline; sponsor and champion state; unmet expectations; risks; the expansion or renewal ask with its scope; procurement path and dates; counsel items |
| Acceptance test | Revenue restates the ask, the buying path and the next dated step |
| Targets | Acknowledge in 1 business day; first action in 5 |
| In transit | Success owns the customer relationship until accepted |
| Record | Renewal risk review ([TPL-10](templates.md#tpl-10-renewal-risk-review)) |

## Support and incident handoffs

### H-09 Support to engineering

| Field | Definition |
| --- | --- |
| Trigger | A case needs a code, configuration or platform fix, or breaches an escalation trigger |
| From → To | Support → `engineering` on-call, or the engineering queue by priority |
| Package | The [escalation note](templates.md#tpl-11-support-case-record-and-escalation-note): summary; steps already tried; identifiers (correlation ID, tenant, job, record IDs, redacted); impact and cohort; what the customer has been told; the specific ask; priority and clock status |
| Acceptance test | Engineering states a hypothesis, the next step and the next update time |
| Targets | P0: acknowledge 15 minutes. P1: 1 hour. P2: 1 business day. P3: weekly triage |
| In transit | Support keeps the customer; the next update to the customer is not delayed by the handoff |
| Record | Defect linked to the case |

### H-10 Support to trust and safety

| Field | Definition |
| --- | --- |
| Trigger | A report of harm, harassment, a safety concern, a marketplace complaint or content issue |
| From → To | Support → `trust` (or the crisis route) |
| Package | Case ID; report metadata; content references (not copies); risk assessment; what the reporter was told; minors involved or not |
| Acceptance test | The receiver states the provisional priority and the first protection applied |
| Targets | Imminent harm: crisis notice already shown; human triage within 1 hour. Others per [SL-TS-01](04-support-operating-model.md#delivery-success-trust-and-partners) |
| In transit | Support does not promise confidentiality beyond policy or an outcome |
| Record | T&S case |

### H-11 Support to privacy, data-rights request

| Field | Definition |
| --- | --- |
| Trigger | A request to access, export, correct or delete personal data, or withdraw consent |
| From → To | Support → `privacy` (counsel and privacy operations) |
| Package | Identity-verification result; request type and date received; tenant; the institution's role; the scope requested; any hold or retention flags |
| Acceptance test | The receiver restates the regulatory clock as set by counsel and the internal target |
| Targets | Acknowledge 2 business days; per [SL-PRV-01](04-support-operating-model.md#incidents-security-privacy-accessibility) |
| In transit | Support promises no outcome |
| Record | Request record; [data-rights runbook](../../DATA-RIGHTS-REQUEST-RUNBOOK.md) |

### H-12 Alert to incident commander

| Field | Definition |
| --- | --- |
| Trigger | An alert, a report or a probe failure that may meet incident criteria |
| From → To | Alert source or the person who noticed → the commander on duty |
| Package | The signal and its source; the time first seen; affected service and tenants; suspected data classification; current user-visible effect; what has been done |
| Acceptance test | The commander declares an incident with severity and flags, or records in writing why not |
| Targets | SEV1 declare within 15 minutes; SEV2 within 30 ([SL-INC-01](04-support-operating-model.md#incidents-security-privacy-accessibility)) |
| In transit | The person who noticed stays on until the commander accepts |
| Record | Incident record |

### H-13 Incident to problem management

| Field | Definition |
| --- | --- |
| Trigger | An incident closes, or a root cause recurs |
| From → To | Incident commander → `engineering` (problem owner) |
| Package | The review; root causes; corrective actions with owners and dates; the regression test; the support workaround and known-error entry; customer communications sent |
| Acceptance test | The problem owner accepts each action and its date, or amends it with a reason |
| Targets | Review within 5 business days of stabilization; actions assigned at the review |
| In transit | The commander owns open actions until accepted |
| Record | Review record; problem record; action tracker |

### H-14 On-call shift handoff

| Field | Definition |
| --- | --- |
| Trigger | Rotation of the on-call responsibility |
| From → To | Outgoing responder → incoming responder |
| Package | Open incidents and their state; open P0 and P1 cases; pending and scheduled changes and maintenance; known fragile points; alerts in the last shift and their causes; customer commitments due this shift; anything that would surprise the next person |
| Acceptance test | The incoming responder acknowledges and reads back the open items |
| Targets | Handoff at the scheduled time; outgoing reachable for one hour after |
| In transit | The outgoing responder is accountable until the read-back |
| Record | Shift note |

### H-15 Engineering to support and success, release readiness

| Field | Definition |
| --- | --- |
| Trigger | A release candidate is promoted, or a feature flag changes for a tenant |
| From → To | `engineering` / `product` → support and `success` |
| Package | Role-filtered release note; behaviour changes and known limits; the support macro and article if a question is likely; the rollback step; the tenants affected and notice sent; the freeze check; the monitoring added |
| Acceptance test | Support can answer the three most likely questions from the package |
| Targets | Package 1 business day before release; notice per [SL-CHG-01](04-support-operating-model.md#delivery-success-trust-and-partners) |
| In transit | Engineering owns the release until support accepts |
| Record | Release record |

## Marketplace, partner and organizational handoffs

### H-16 Marketplace order to provider, dispute and finance

| Field | Definition |
| --- | --- |
| Trigger | An order intent in phase 1 or later; a dispute opened |
| From → To | Student order → provider (fulfilment); dispute → `finance` or `trust` |
| Package | Order ID; listing and price as shown; promised window; entitlement state; for a dispute, the type, evidence from both sides, and the reason code |
| Acceptance test | The provider confirms or declines inside the listed window; for a dispute, the assessor restates the decision criteria |
| Targets | Provider acknowledges per listing; dispute per [SL-MKT-02](04-support-operating-model.md#delivery-success-trust-and-partners) |
| In transit | Semester records state and mediates; money moves only through the provider's payment provider in phases 0 and 1 |
| Record | Order record; dispute record |

### H-17 Founder to delegate, process transfer

| Field | Definition |
| --- | --- |
| Trigger | A process moves up the [transfer ladder](11-founder-to-team-transition.md#the-transfer-ladder) |
| From → To | `founder` → the delegate, with a second person named |
| Package | The runbook page; the recorded walkthrough and transcript; the access list (least privilege, time-limited); the decision limits in a delegation record; the last ten runs and their issues; known fragile points; who to ask after the transfer |
| Acceptance test | The delegate passes the [fresh-hands test](07-knowledge-training-enablement.md#the-fresh-hands-test) |
| Targets | Per the ladder; the founder-removal test monthly |
| In transit | The founder stays accountable until L4 |
| Record | Transfer record ([TPL-22](templates.md#tpl-22-handoff-record)); delegation record ([TPL-21](templates.md#tpl-21-delegation-of-authority-record)) |

### H-18 Customer success to privacy and engineering, offboarding

| Field | Definition |
| --- | --- |
| Trigger | A decision to stop, or a term ending without renewal |
| From → To | `success` → `privacy` (retention and deletion) and `engineering` (export and deletion execution) |
| Package | Notice and effective date; the agreed export format; retention, legal-hold and deletion rules from counsel; student-owned data handling; the customer's confirmation steps; the closeout review date |
| Acceptance test | Privacy and engineering restate each step and the evidence each produces |
| Targets | Plan accepted within 5 business days; steps per [`SCHOOL-OFFBOARDING`](../../SCHOOL-OFFBOARDING.md) |
| In transit | Success owns the customer relationship |
| Record | `completion_certificate` evidence; archived state |

## Handoff metrics

| Measure | Definition | Target (SL0) |
| --- | --- | --- |
| Rejection rate | Packages rejected ÷ handoffs | Falling; a high rate means templates need work |
| Missed-clock rate | Acknowledgements or acceptances late ÷ handoffs | At most 5% |
| Customer re-asks | Times a customer was asked for information already held | 0 |
| Handoffs without a record | Count | 0 |
| Stalled in transit | Handoffs open beyond twice their acceptance clock | 0 |

## Related

[Service blueprints](service-blueprints.md) · [Templates](templates.md) · [03 RACI](03-raci-and-decision-rights.md) · [09 Dashboards](09-dashboards-and-indicators.md)
