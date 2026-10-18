# 04 · Support operating model, service levels and staffing

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — NO STAFFED HOURS, NO TESTED CHANNEL, NO MEASURED PERFORMANCE** |
| Owner seat | `operations` (held by the Founder, acting); backup unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Builds on | [`SUPPORT-OPERATIONS`](../../commercial/SUPPORT-OPERATIONS.md), [`ON-CALL-AND-ESCALATION-POLICY`](../../engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md), [`PRODUCTION-SUPPORT-RUNBOOK`](../../engineering-operations/PRODUCTION-SUPPORT-RUNBOOK.md), [`PILOT-SUPPORT-RUNBOOK`](../../market-readiness/PILOT-SUPPORT-RUNBOOK.md), [`SUPPORT-POLICY-DRAFT`](../../legal/SUPPORT-POLICY-DRAFT.md) |
| Claim ceiling | Semester may describe this as its proposed support model. It may not claim staffed support, 24×7 coverage, response or resolution times, dedicated success management or SLA performance. Every target below is SL0 ([ladder](README.md#2-the-service-level-ladder)). |

## Principles

1. **Support is part of the product.** A confused student at 11:55 PM before a deadline needs a clear state, a receipt, a recovery path and an escalation, not a generic error. The product's no-dead-end rule and the support model are one design.
2. **Self-service first, human always reachable.** Help is reachable from the same place on every screen (do-not-build rule 6). A person is one step away from every failure state.
3. **Privacy before convenience.** Support never receives blanket visibility into student data. Access is purpose-scoped, time-limited, logged and revocable ([existing rules](../../engineering-operations/PRODUCTION-SUPPORT-RUNBOOK.md)). Convenience never overrides privacy, authorization or evidence integrity.
4. **Support never gives authoritative academic, legal, medical or financial advice.** It explains the official source and the process.
5. **Classify by harm, not by volume or by who is loudest.**
6. **Every case teaches.** A case that repeats becomes a problem record, a knowledge article or a product change; it is never closed and forgotten.

## The model

```
Tier 0  Self-service      help centre, in-app help, status page, known issues
Tier 1  Support           intake, identity check, triage, first answer, routing
Tier 2  Specialists       implementation, integration/data, accessibility, privacy, billing
Tier 3  Engineering,      defects, security, trust and safety — owners of the root cause
        security, T&S
Command Incident          commander and the incident roles in 05
```

Two tracks share the tiers and differ in who is served and how fast.

| Track | Who | Channel | Default clock |
| --- | --- | --- | --- |
| **Individual** | Students, alumni, guardians, faculty acting for themselves | In-app help; email once approved | Business-day clocks |
| **Institution** | Tenant admins, registrar, IT, support desk, champion | Admin case form; named contact; email; phone only at Stage 2 and above | Staffed-hour clocks; named customer contacts |

Institution users can ask for help on behalf of a student only with the consent and authorization the policy requires.

## Channels

| Channel | Purpose | Earliest stage | Condition to open |
| --- | --- | --- | --- |
| In-app help and case form | Primary channel; arrives with context (screen, tenant, correlation ID, consented diagnostics) | 0 | Case queue exists and a person reads it daily |
| Institution case form | Admin and staff issues; routes by category | 1 | Customer contacts named; routing tested |
| Email to a verified support address | Fallback and escalation | 1 | Address verified; auto-acknowledgement tested; monitored |
| Status page | Incidents and maintenance | 0 | Updated by the incident process |
| Security reports route | Vulnerability and suspected-breach reports | 0 | Published route; monitored; the reporter is not asked for secrets |
| Phone, tenant-admin SEV1 | A voice for a total outage | 2 | Staffed rota; tested |
| Office hours and webinars | Training and Q&A | 1 | Scheduled; recorded; accessible |

A channel is **open** only after a test message has been sent through it, read by a person, answered, and the exercise recorded. Do not list a channel to a customer until then.

## Intake and identity

Before discussing any account or customer information:

1. **Verify the channel and identity.** In-app requests carry an authenticated session. Email requests from a person claiming to be an admin are verified through the tenant's known contact, never through the message itself.
2. **Verify tenant and authority.** An institution request is acted on only by a person the tenant has named for that scope.
3. **Capture only what is needed:** the blocked task, time, route, device and browser, correlation or error identifier, impact and cohort size, consented diagnostics.
4. **Never ask for** passwords, MFA codes, recovery codes, full payment-card numbers, private notes or documents, or sensitive categories over any channel. Never accept screenshots of education records.
5. **Say what happens next** and when the next update is due, within the approved hours.

## Case taxonomy

Every case has one **category**, one **subcategory**, one **type** (*question*, *request*, *defect*, *incident*, *feedback*), a **priority** and tags. The category fixes routing and the default priority; the agent may raise a priority with a reason and may lower it only with the approving seat's agreement.

| Code | Category | Subcategories (examples) | Default priority | First route | Escalate to | Must capture | Never |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **ACC** | Account and access | Sign-in, passkey or MFA, recovery, session or device, SSO failure | P2 | Tier 1 | Security if suspicious; engineering if broad | Account ID, tenant, session or device metadata, time | Reset an account without verifying the owner |
| **WRK** | Workspace | Today, calendar, tasks, notes, documents, sync, offline conflicts | P2 | Tier 1 | Engineering on data loss | Correlation ID, device, sync status | Edit the person's content |
| **LRN** | Learning and coursework | Course access, assignment, submission receipt, study tools | P2; P1 if a deadline is within 24 h | Tier 1 | Learning engineer; SRE if receipt mismatch | Course and assignment IDs, timestamp | Promise an extension (the instructor decides) |
| **ACD** | Academic record and registration | Catalog, registration, degree audit, holds, records | P2; P1 in a registration window | Tier 2 | Registrar workflow at the school | Record IDs, hold type | Alter a record; advise on eligibility |
| **FIN** | Billing and money | Plus subscription, student-account display, receipt, refund request | P2 | Tier 2 finance | Finance; counsel for disputes | Invoice or payment IDs, redacted | Handle card numbers; move money |
| **AIX** | AI assistant | Wrong or unsafe answer, data-scope concern, citation problem | P2; P1 if unsafe | Tier 2 AI governance | AI governance board; kill switch | Prompt and response IDs, route, policy decision | Replay with another person's data |
| **INT** | Integrations and data freshness | Connector failure, stale source, mismatch, mapping | P2; P1 if write path | Tier 2 data | Integration engineering; customer IT | Connection ID, job ID, mapping version, last sync | Silently overwrite either side |
| **FAM** | Family and consent | Guardian link, share scope, revocation | P2; P1 if disclosure suspected | Tier 2 privacy | Privacy | Relationship record ID | Widen a share without consent |
| **CMP** | Campus and community | Events, directory, groups, content reports | P3; reports follow SAF or T&S | Tier 1 | T&S | Content ID, report metadata | Open private content outside policy |
| **MKT** | Marketplace and partners | Listing, order, fulfilment, dispute, provider | P2 | Tier 2 marketplace | T&S; finance | Order ID, provider ID | Promise a refund the process has not decided |
| **PRV** | Privacy and data rights | Export, deletion, correction, consent, minors | P1 clock-bound | Privacy workflow | Counsel | Identity proof, request type, tenant | Promise an outcome; verify identity by weak means |
| **SEC** | Security | Suspected breach, vulnerability, phishing, impersonation | **P0** | Security case | Incident commander | Reporter contact, evidence, service | Ask for secrets; discuss details publicly |
| **ACX** | Accessibility barrier | Keyboard, screen reader, contrast, cognitive load, captions | P1 on a critical journey; else P2 | Accessibility lead | Product, engineering | Task, assistive technology, browser or device, impact | Dismiss as user error |
| **SAF** | Safety and crisis | Self-harm, harassment, threat | **P0** | [Crisis runbook](../../CRISIS-RESPONSE-RUNBOOK.md) | T&S; emergency services via the school's route | Case ID, risk assessment | Act as a crisis service; promise confidentiality beyond policy |
| **ADM** | Institution administration | Tenant config, roles, SCIM, policy | P2 | Tier 2 implementation | Engineering | Tenant, change requested, requester authority | Change without the named authority |
| **COM** | Commercial | Quotes, invoices, contracts, renewals | P3 | Revenue | Finance; counsel | Account, document | Quote outside the deal-desk policy |
| **FBK** | Feedback and ideas | Feature requests, praise, complaints | P3 | Tier 1 | Product | The job the person was trying to do | Promise roadmap |
| **HOW** | How-to and questions | Usage, settings, concepts | P3 | Tier 0 then Tier 1 | Knowledge owner | The task | Teach a workaround that bypasses a control |

**Types and linkage.** A *defect* becomes an engineering ticket linked to the case. An *incident* is a platform event with its own record ([05](05-incident-and-continuity.md)); many cases may link to one incident, and each case keeps its own communication. A repeat of a cause three times becomes a **problem** record.

## Priority

### Derivation

Priority combines **impact** and **urgency**, then the overrides.

| | Deadline-critical (within 24 h, or a registration, payment or submission window) | Time-sensitive | Routine |
| --- | --- | --- | --- |
| **Safety, security, privacy or cross-tenant** | P0 | P0 | P0 |
| **Tenant-wide or multi-tenant** | P0 if core journey blocked; else P1 | P1 | P2 |
| **Cohort or one course (at least 10 users)** | P1 | P2 | P3 |
| **One individual** | P1 if the core journey is blocked; else P2 | P2 | P3 |

**Overrides.** A blocker on a critical journey for a person using assistive technology is P1 whatever the table says. Any case that mentions legal action, a complaint to a regulator, media or a subpoena is routed to counsel the same business day and treated at least P1. An agent who is unsure raises, not lowers.

### Priority and incident severity

Priority belongs to a *case* and severity to an *incident*. The crosswalk is in [05](05-incident-and-continuity.md#severity-crosswalk). A P0 or P1 case either links to an incident or records in writing why none is needed. A SEV1 or SEV2 incident opens linked cases for every affected tenant.

## Case lifecycle and clocks

| State | Meaning | Clock |
| --- | --- | --- |
| New | Received, not read | Acknowledgement clock runs |
| Triaged | Classified, identity checked, routed | Update clock runs |
| In progress | A named owner is working it | Update and resolution clocks run |
| Waiting on customer | A specific question has been asked | **Paused**; resumes on reply; auto-reminder after 3 business days; auto-resolve after 7 |
| Waiting on third party | A vendor or the school's system | **Runs**; Semester still owns the customer relationship and updates |
| Resolved | A fix or answer is given | Customer has 5 business days to reopen |
| Closed | No reply, or confirmed | Stops; the case is retained under policy |
| Reopened | Customer says it is not fixed | Resolution clock restarts with a flag |

**Closing** requires: the resolution; the affected scope; the communication sent; access revoked; confirmation from the customer where proportionate; a link to the known issue or root cause; and a follow-up owner and date where one exists. A case cannot close with a support-access grant still open.

## Service level catalog

Every row is **SL0** today. "Earliest stage" is the first stage at which the target is meaningful; a target set before then would be a promise the staffing cannot back. Staffed hours are *to be approved* ([assumption](README.md#assumptions-labelled-replace-with-measurement-as-it-arrives): Monday–Friday 08:00–18:00 America/Chicago).

### Support

| ID | Measure | Target | Earliest stage | Source |
| --- | --- | --- | --- | --- |
| SL-SUP-01 | Acknowledge a P0 | 15 min inside staffed hours; automated receipt always | 1 | Case system |
| SL-SUP-02 | Acknowledge a P1 | 1 hour inside staffed hours | 1 | Case system |
| SL-SUP-03 | Acknowledge a P2 | Institution: 4 staffed hours. Individual: 1 business day | 1 | Case system |
| SL-SUP-04 | Acknowledge a P3 | Institution: 1 business day. Individual: 2 business days | 1 | Case system |
| SL-SUP-05 | Update cadence while open | P0 60 min; P1 4 staffed hours; P2 2 business days; P3 on change | 1 | Case system |
| SL-SUP-06 | Mitigation or workaround | P0 4 hours; P1 1 business day | 2 | Case system |
| SL-SUP-07 | Resolution | P2 3 business days (institution) or 5 (individual); P3 10 business days | 2 | Case system |
| SL-SUP-08 | First-contact resolution (individual, excluding P0 and P1) | at least 60% | 2 | Case system |
| SL-SUP-09 | Reopen rate | at most 8% | 2 | Case system |
| SL-SUP-10 | Satisfaction (cohorts of 10 or more responses only) | at least 85% satisfied | 2 | Post-case survey |

### Incidents, security, privacy, accessibility

| ID | Measure | Target | Earliest stage | Source |
| --- | --- | --- | --- | --- |
| SL-INC-01 | Declare and assign a commander | SEV1 15 min; SEV2 30 min; SEV3 same business day, from detection | 1 | Incident record |
| SL-INC-02 | First notice to affected customers | SEV1 30 min and SEV2 60 min after declaration, then at the audience cadence in [`INCIDENT-COMMUNICATIONS`](../../operating-model/INCIDENT-COMMUNICATIONS.md) | 1 | Notice record |
| SL-INC-03 | Written post-incident review | SEV1 and SEV2 within 5 business days of stabilization (the playbook's rule) | 0 | Review record |
| SL-INC-04 | Corrective actions closed | SEV1 within 30 days; SEV2 within 60 days | 1 | Action tracker |
| SL-SEC-01 | Security report: acknowledge, then triage | 1 business day, then 3 business days | 0 | Security case |
| SL-SEC-02 | Remediate an exploitable vulnerability in Semester-owned code | Critical 7 days; high 30 days; medium 90 days | 1 | Vulnerability tracker |
| SL-PRV-01 | Data-rights request | Acknowledge 2 business days; internal completion 15 business days. **Legal deadlines are set by counsel per jurisdiction and control.** | 1 | Request record |
| SL-ACX-01 | Accessibility barrier | Acknowledge 1 business day; alternate route or workaround offered in 2 business days; a blocker on a critical journey mitigated in 5 business days; others in 30 days | 1 | Barrier record |

### Delivery, success, trust and partners

| ID | Measure | Target | Earliest stage | Source |
| --- | --- | --- | --- | --- |
| SL-IMP-01 | Gate evidence reviewed | 2 business days from submission | 1 | Rollout history |
| SL-IMP-02 | UAT defects | P1 fixed or mitigated in 5 business days; P2 in 10 | 1 | Defect list |
| SL-IMP-03 | Weekly status delivered during implementation | 100% of weeks | 1 | Status record |
| SL-IMP-04 | Hypercare review cadence | Daily for 7 days, then every other day to exit | 1 | Hypercare log |
| SL-CS-01 | Customer health review; EBR | Monthly per tenant; quarterly per tenant | 1 | Health record |
| SL-TS-01 | Safety report: crisis referral shown in product at once; human triage | Imminent harm: referral immediate, triage within 1 hour; serious (harassment, minors): 4 staffed hours | 2 | T&S case |
| SL-TS-02 | Policy report action; appeal decision | Action within 2 business days; appeal decided in 5 business days by a different reviewer | 2 | T&S case |
| SL-MKT-01 | Provider application decision | 10 business days from a complete application | 2 | Provider record |
| SL-MKT-02 | Dispute acknowledge; resolve | 1 business day; 10 business days from complete evidence | 2 | Dispute record |
| SL-PAR-01 | Partner technical escalation acknowledgement | 1 business day | 2 | Partner record |
| SL-CHG-01 | Customer notice before change | Scheduled maintenance 24 hours; configuration change 5 business days; material change 14 days | 1 | Change record |
| SL-DOC-01 | Known issue published; top recurring cause documented | 1 business day from confirmation; 5 business days | 1 | Knowledge base |

Platform availability and latency objectives live with their own pages ([`SLO-SLI-DRAFT`](../../engineering-operations/SLO-SLI-DRAFT.md), [`SLOS-AND-ERROR-BUDGETS`](../../operating-model/SLOS-AND-ERROR-BUDGETS.md)) and are not repeated or promised here.

### Rules for service levels

- A service level moves up the ladder one rung at a time, with evidence, and is recorded in the monthly review.
- A target that has been measured and missed for four consecutive weeks triggers a staffing, process or scope decision, not a quiet change to the number.
- Customer-facing text names the rung: *measured*, *targeted*, or *committed*. "Targeted" never appears beside a number that has not been measured.
- Contract language for SL3 is drafted by counsel. The hours, the credit regime and the exclusions are counsel and finance decisions.

## Escalation policy

### Levels

| Level | Who | When |
| --- | --- | --- |
| **L1** | Support agent | Every case starts here unless the category routes directly |
| **L2** | Domain specialist | Needs domain knowledge or authority: implementation, integration, accessibility, privacy, billing |
| **L3** | Engineering on-call, security lead, T&S lead | A defect, an exposure, a safety matter |
| **L4** | Incident commander plus the `founder` and relevant seat | SEV1 or SEV2; any P0; a customer executive escalation |

### Triggers

| Trigger | Action |
| --- | --- |
| Case reaches 75% of an acknowledgement, update or resolution target | Warn the owner and L2 |
| Case reaches 100% of a target | Escalate one level; log the miss |
| P0, or P1 on a critical journey | L3 now; incident record opened or a written reason it is not needed |
| Third contact about the same issue | Open a problem record; L2 owns the customer |
| Security, privacy, safety or accessibility keywords | Route to the domain owner immediately |
| Legal, regulator, media or subpoena language | Counsel the same business day; do not respond substantively |
| Customer executive or sponsor expresses dissatisfaction | `success` owns the call within one business day; `founder` informed |
| Workaround is unsafe, data may be lost, or monitoring has a blind spot | Treat as an incident |

### The escalation package

An escalation is a handoff ([H-09](handoffs.md#h-09-support-to-engineering)). It carries the case summary, the steps already taken, the evidence and identifiers, the customer impact and cohort, what has been told to the customer, and the specific ask. The receiver acknowledges within the target for the level; a missed acknowledgement escalates again. **No silent handoffs:** the sender keeps the customer relationship until the receiver accepts.

### Outside staffed hours

The hours statement is a template with a placeholder: **"Support is staffed [HOURS, TO BE APPROVED]. Outside those hours, [WHAT HAPPENS, TO BE APPROVED]."** At Stage 0 there is no after-hours coverage and the statement says so. At Stage 1 a tested SEV1 path to primary and backup exists. At Stage 3 SEV1 and SEV2 have continuous coverage ([staffing](#staffing-model)).

## Support access

Support agents may not browse records out of curiosity; use a global "impersonate" function; view student-private notes or documents unless necessary, authorized, time-bound and logged; modify grades, official records, role assignments, billing amounts or consent relationships outside the governed workflow; or ask users to send secrets over unapproved channels. A support grant names the purpose, scope and expiry, is approved by `security` or its acting holder ([S-03](03-raci-and-decision-rights.md#security-vendors-and-money)), is audited, and is revoked at closure. Reports are aggregate and suppress cells under ten.

## Staffing model

### The arithmetic

All inputs are planning assumptions until measured. Replace each with its measured value as dashboards ([09](09-dashboards-and-indicators.md#d4-support-and-quality)) accumulate.

```
Contacts per month   C = active users × contact rate (per active user per month)
Workload hours       W = C × average handling time (hours)
Effective hours/FTE  H = 160 × (1 − shrinkage) × occupancy
Support FTE needed   N = W ÷ H
```

| Input | Planning assumption | Why it will be wrong, and how it will be measured |
| --- | --- | --- |
| Contact rate | 0.02 contacts per active user per month (2 per 100) | Product maturity, tenant size and onboarding quality all move it; measured as tickets per 100 active users |
| Average handling time | 20 minutes | Depends on mix of categories; measured from case timestamps |
| Shrinkage | 30% (leave, training, meetings) | Measured from the schedule |
| Occupancy | 70% | A policy choice that leaves room for escalations and learning |
| Peak-week multiplier | 4× (add/drop, finals, billing, grade release) | Measured against the academic overlay |

**Worked example (assumed inputs only).** A tenant with 10,000 active users: `C = 200` contacts, `W = 66.7` hours, `H = 160 × 0.7 × 0.7 = 78.4` hours, `N = 0.85` FTE. In a peak week at 4×, the same tenant needs about 3.4 FTE-equivalents for that week. The answer is not to hire for the peak. It is to **deflect** (help content, in-app diagnostics, status page), **flatten** (peak plan, proactive notices, macros), **cross-train** (implementation and success staff handle a queue slice), and **widen the clock** (the peak acknowledgement target is announced in advance for institution cases and relaxed for P3).

**What the arithmetic shows.** At pilot scale support volume is small. The binding constraints are **coverage** (a backup who can act when the primary cannot), **after-hours incident response**, **privileged access control** and **implementation capacity**, not ticket handling. Staff to those first.

### Implementation capacity

```
Concurrent implementations per lead = (lead hours per week × allocation) ÷ (hours per implementation per week)
```

With assumed 220 Semester hours across an eight-week standard pilot (27.5 hours a week), a lead at 60% of a 40-hour week (24 hours) supports about **one** implementation at a time; the planning figure is *one per lead until measured*. The first measured implementation replaces the assumption. Any plan with more than one concurrent implementation per lead names the person who covers the difference.

### On-call arithmetic

A sustainable on-call rotation takes no more than one week in four per person and gives rest after a night call. That makes **four** the minimum for a single-tier rota; a primary and a secondary tier makes it **six** or more. Continuous 24×7 SEV1 and SEV2 coverage therefore needs at least that many trained responders, which is why continuous coverage waits for Stage 3 and is never promised earlier. Compensation for on-call is a finance and counsel decision under applicable employment law.

### Staffing by stage

Planning shapes, not budgets. Every row is replaced by the measured model as evidence arrives. "Fractional" means a qualified external person for part of the time.

| Stage | Support and success | Implementation and delivery | Reliability and security | Trust and others |
| --- | --- | --- | --- | --- |
| **0** | Founder (all); outside counsel; an advisor reads | Founder | Founder; managed-service alerts | None; T&S not offered beyond report-and-refer |
| **1** | One operations and support generalist as a trained backup; business-hours support | Generalist doubles as implementation backup; contractor engineer for integrations | Fractional security lead; contract engineer shares the SEV1 path with the Founder; independent accessibility evaluator on engagement | Report-and-refer for safety; counsel on call for incidents |
| **2** | Support lead, one or two specialists; one customer success manager | Implementation lead and one implementation engineer | Reliability engineer or two; security lead part-time; incident rota of four or more | Part-time T&S lead; technical writer; fractional finance operations; partner manager when marketplace phase 1 opens |
| **3** | Tiered support of four to eight; three to five customer success | Team of three to five | Reliability team of four to six with a 24×7 rota; security of two to three | T&S of two to four plus trained moderators; partner and marketplace operations of two; enablement of two; revenue operations of two |

Hiring is triggered by evidence, not by calendar ([11](11-founder-to-team-transition.md#hiring-triggers)).

### Skills and cross-training

| Skill | Stage 1 minimum | Verified by |
| --- | --- | --- |
| Case triage and the taxonomy | Two people | Calibrated QA sample |
| Incident commander | Two people | Tabletop run as commander |
| Implementation phases 1–7 | Two people | Fresh-hands run of a sandbox tenant |
| Data-rights request | Two people | Rehearsal ([`DATA-RIGHTS-REQUEST-RUNBOOK`](../../DATA-RIGHTS-REQUEST-RUNBOOK.md)) |
| Support-access grant and revoke | Two people | Access drill |

### Outsourcing guardrails

Outsourced or contracted support never gets student-record access without a data-processing agreement, a subprocessor entry ([`SUBPROCESSORS`](../../SUBPROCESSORS.md)), role-based training, least privilege, and audit. A vendor's staff are never the only people able to run a critical process.

## Quality assurance

| Criterion | Weight | Fails the case outright if… |
| --- | --- | --- |
| Identity and authorization handled correctly | gate | Information given to an unverified requester |
| Privacy and safety routing | gate | Sensitive data requested or exposed; a safety or privacy signal not routed |
| Accuracy | 25 | A wrong answer given as fact |
| Completeness and next step | 20 | No resolution and no clear next step |
| Plain language and tone | 15 | — |
| Accessibility awareness | 10 | — |
| Documentation: category, tags, notes | 15 | — |
| Timeliness against clocks | 15 | — |

**Sampling.** Stage 0: every case is read weekly by the Founder and five are read by an advisor. Stage 1 and above: five cases per agent per week, every P0 and P1, every privacy, safety and accessibility case. **Calibration** monthly: two people score the same ten cases and reconcile differences. A gate failure is reviewed with the person and the process, never as blame. QA scores are aggregate in reports.

## Knowledge and macros

A macro is a short answer plus a link to the authoritative article. Macros for sensitive categories (privacy, security, safety, accessibility, billing) are approved by the owning seat and reviewed every 90 days. See [07](07-knowledge-training-enablement.md#the-knowledge-base).

## Peak plan

Before each peak in the [academic overlay](01-operating-cadence.md#the-academic-calendar-overlay): publish the freeze and the staffed hours to every tenant; pre-write the proactive notice; load macros; confirm the on-call and backup rota; raise the health sweep to twice daily; agree the peak acknowledgement targets with the tenant's desk; and set the post-peak review date.

## Related

[05 Incident and continuity](05-incident-and-continuity.md) · [Handoffs H-09 to H-11](handoffs.md) · [Service blueprint: a support case](service-blueprints.md#blueprint-2-a-support-case) · [Templates TPL-11](templates.md#tpl-11-support-case-record-and-escalation-note)
