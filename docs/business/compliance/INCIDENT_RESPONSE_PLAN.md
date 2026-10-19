# Incident Response Plan (consolidated working view)

| Control | Value |
| --- | --- |
| Status | **DRAFT - INTERIM SINGLE-FOUNDER VIEW - NOT TARGET-EXERCISED - NOT APPROVED** |
| Owner | Harrison Rubin (interim incident commander and every other seat; backup, second reviewer, customer contact and counsel unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: counsel] [REVIEW: security] [REVIEW: privacy] |
| Audience | Internal. Section 7 templates are drafts to be adapted by a human at send time; none has ever been sent |

> Operating document, not legal advice. It makes no legal conclusion about whether, when or to whom any notification is owed; every such question is routed to counsel and the applicable contract [REVIEW: counsel]. No notification deadline has been approved.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [docs/trust/INCIDENT-RESPONSE-PLAN.md](../../trust/INCIDENT-RESPONSE-PLAN.md) | Controlled plan: lifecycle, control-and-evidence map, claim ceiling (`DESIGNED / NOT TARGET-EXERCISED`) | One page that states a P0-P3 view, interim roles, escalation matrix, template set, a tabletop script, postmortem and corrective-action tracker | The trust doc is a controlled index; it carries no templates or script |
| [docs/trust/SECURITY-INCIDENT-RUNBOOK.md](../../trust/SECURITY-INCIDENT-RUNBOOK.md) | First-response steps, P0/P1 routing, evidence map | Cross-linked; steps are summarised in section 5 and not rewritten | Canonical |
| [docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md](../../trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md) | AI containment, kill switches, two-person release | Linked from escalation matrix | Canonical |
| [docs/integrated-trust/INCIDENT-RESPONSE.md](../../integrated-trust/INCIDENT-RESPONSE.md), [INCIDENT-PLAYBOOKS.md](../../integrated-trust/INCIDENT-PLAYBOOKS.md), [TABLETOP-CALENDAR.md](../../integrated-trust/TABLETOP-CALENDAR.md) | SEV1-4 scale and crosswalk, roles, first fifteen minutes, 15 scenario playbooks (IR-01..IR-15), message audiences from `incident-comms.ts`, tabletop calendar TT-01..TT-13 | This view reuses their scale (P0-P3 = SEV1-4 crosswalk) and calendar; adds the tabletop script, templates, postmortem and tracker | Generated pages; the decision on one scale (TR-06) is still open |
| [SECURITY.md](../../../SECURITY.md) | Reporting, four severities with internal remediation targets, "what counts", rotate, close the gate, evidence, telling people | Referenced for levers; its Critical-Low scale is for vulnerability reports and stays in its lane | Canonical |
| [docs/INCIDENT-RECOVERY-PLAYBOOK.md](../../INCIDENT-RECOVERY-PLAYBOOK.md) | SEV1-4 service recovery | Referenced | Canonical |
| [docs/privacy-operations/05-PRIVACY-INCIDENT-COORDINATION.md](../../privacy-operations/05-PRIVACY-INCIDENT-COORDINATION.md), [docs/legal-drafts/INCIDENT-NOTIFICATION-DECISION-WORKFLOW-DRAFT.md](../../legal-drafts/INCIDENT-NOTIFICATION-DECISION-WORKFLOW-DRAFT.md), [docs/legal-drafts/SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md](../../legal-drafts/SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md), [docs/legal-drafts/PRIVACY-BREACH-ASSESSMENT-WORKSHEET-TEMPLATE.md](../../legal-drafts/PRIVACY-BREACH-ASSESSMENT-WORKSHEET-TEMPLATE.md) | Privacy overlay (PX-0..3), notification decision workflow draft, contract exhibit draft, assessment worksheet | The customer-notification workflow in section 8 sequences them; legal content stays there | Counsel-owned |
| [docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md](../../market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md), `app/src/lib/governance/incident-comms.ts` | Earlier templates; the composer that refuses incomplete messages | Section 7 templates follow the composer's seven sections | Composer is the rule |
| [docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md](../../evidence/operations/2026-10-03-founder-readiness-tabletop.md) | The one filed rehearsal | Its gaps seed the corrective-action tracker (section 11) | Evidence file |
| [COMPLIANCE_EVIDENCE_REGISTER.md](COMPLIANCE_EVIDENCE_REGISTER.md) | CER-E01..E12 | Linked | Same folder |

## Gate (what may be done now versus held)

| Item | Status |
| --- | --- |
| Use this plan for internal preparation and design-partner discussion of the incident approach | NOW |
| Promise a customer response time, update interval, notification deadline or 24/7 coverage | HELD (no clock is authorized; one person holds every seat) |
| Send any template in section 7 to a real recipient other than as a drill | HELD until contacts, authority and counsel review exist |
| Run a drill on live customer data | HELD (no live customer data) |

## 1. Honest state

- One person holds every role; no rota; no backup; no second reviewer of the AI switch; customer contacts and counsel unassigned. [VERIFIED] `docs/integrated-trust/INCIDENT-RESPONSE.md`.
- No incident has been closed through the process; nothing sends messages; no alert reaches a person except AI spend (TR-07, TR-39). [VERIFIED] same file.
- **Tabletop:** one founder-only document tabletop was held on 2026-10-03 on a cross-tenant AI scenario (`docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md`, status `COMPLETED - DOCUMENT/REPOSITORY TABLETOP; TARGET EXERCISE STILL OPEN`). **No target tabletop, no tabletop with a second participant, no customer contact on a call and no live drill has been evidenced.** Do not describe incident response as "tested" or "exercised".
- Provider logs are kept about a month and the access log 90 days; there is no protected evidence store (TR-43).

## 2. Severity model (P0 to P3)

This is a consolidated view of the scale the code tests (`app/src/lib/incident-recovery.ts`, SEV1-SEV4), using the crosswalk in `docs/integrated-trust/INCIDENT-PLAYBOOKS.md`. Choosing the one scale is the founder's decision (TR-06); until recorded, this table is a [DRAFT] view and the other scales stay in their lanes.

| This view | Code scale | Trust runbook | SECURITY.md word (reports) | Meaning | First look (internal target, not a promise) |
| --- | --- | --- | --- | --- | --- |
| **P0** | SEV1 | P0 | Critical | Suspected or confirmed cross-tenant exposure; confirmed breach; official record or grade changed without authority; broad outage of sign-in, submissions or registration; high-impact secret compromise; active exploitation | Same hour while a person is reachable |
| **P1** | SEV2 | P1 | High | A core workflow broken for many users; one major tenant or integration down; a privacy or safety event with limited scope | Same business day |
| **P2** | SEV3 | (not defined there) | Medium | A limited function broken with a workaround; degraded integration; accessibility regression on a non-critical path | Next business day |
| **P3** | SEV4 | (not defined there) | Low | Cosmetic or low-impact defect; a question | Planned triage |

Rules: any suspected read of another account's rows is **P0 until disproven**; P0/P1 pauses launch or an active pilot until the accountable owners approve safe recovery; the five questions (cross-tenant exposure, official record or grade altered, payment wrong, minor affected, safety risk) - a yes to any is P0 until shown otherwise. Privacy incidents also carry the PX-0..PX-3 overlay (`docs/privacy-operations/05-PRIVACY-INCIDENT-COORDINATION.md` section 4), which implies no notice duty. Note: the runbook defines P0 and P1 explicitly; P2 and P3 here come from the playbook crosswalk.

## 3. Roles (single-founder reality: interim)

| Role | Does | Interim holder | Gap |
| --- | --- | --- | --- |
| Incident commander | Declares, sets severity, owns timeline and decisions, ends the incident | Harrison Rubin | Backup unassigned |
| Technical lead | Contains and recovers | Harrison Rubin (acting) | Same person as commander (rule: commander does not also fix; unmet) |
| Security lead | Threat analysis, forensics, evidence | Vacant per trust register; Harrison Rubin acting per owner matrix | Disagreement D-1 in the register |
| Communications lead | Drafts and sends; keeps update cadence | Harrison Rubin (acting) | Trust seat vacant |
| Customer liaison | Institution contact | Vacant | No customers exist |
| Privacy and counsel | Notification duties, contract terms, what may be said | Counsel unassigned [REVIEW: counsel] | Engage counsel |
| Recorder | Keeps the timeline | Harrison Rubin | Named in the first minute even if same person |

Rule from the canonical plan: a decision that needs counsel waits for counsel and says so in the timeline; no one closes an incident they declared without a second person's read of the closing summary (until a second person exists, the summary waits a day).

## 4. Escalation matrix [DRAFT]

Update intervals are those the composer enforces (`app/src/lib/governance/incident-comms.ts`); they are not promises to a customer. Where a role is unfilled the founder holds the approval and records that in the timeline.

| Trigger | Severity | Commander | Approver of outward message | Counsel | Executive / founder | Customer notice | Lever (examples) | Runbook |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Suspected cross-tenant read or exposure | P0 | Founder | Security owner and Legal (60-min interval) | Yes, immediately | Yes | Decide with counsel | Kill switch (global or per school); close the gate (`select public.set_invite_only(true)`); roll back the page first if a deploy caused it | IR-01 in INCIDENT-PLAYBOOKS; SECURITY.md |
| Service-role or signing key out | P0 | Founder | Security owner and Legal | Yes | Yes | Decide with counsel | Rotate first, investigate after (SECURITY.md Rotate table) | IR-14 |
| AI data leak or unsafe AI output | P0/P1 | Founder | AI platform lead and AI governance chair (240-min) | Yes if data exposed | Yes | Decide with counsel | AI kill switch (second reviewer for release does not exist) | `docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md` |
| Broad outage or failed deploy | P0/P1 | Founder | Incident commander (60-min) | No unless data affected | Yes if P0 | Status post | Page rollback (`ROLLBACK.md`); read-only mode (never engaged in production) | IR-06 |
| Data loss | P0 | Founder | Incident commander | If personal data lost | Yes | Decide with counsel | Provider restore (never performed) with deletion replay | IR-07; `RESTORE.md` |
| Compromised account / credential stuffing | P1 | Founder | Security owner | If data accessed | Yes | Decide with counsel | Sign out other devices; invite-only door | IR-02 |
| Staff or support access misuse | P0/P1 | Founder | Security owner | Yes | Yes | Decide with counsel | Revoke grant; review `support_access_event` | IR-08 |
| Integration failure | P1/P2 | Founder | Integration owner (240-min) | No | If P1 | Institution admin message | Disable connection / kill switch | IR-05 |
| Accessibility barrier on a critical journey | P1/P2 | Founder | Accessibility lead (240-min) | If a request cites law | No | Accessible alternative | Fix or alternate route | IR-11 |
| Privacy request failure or over-deletion | P1 | Founder | Privacy owner and Legal | Yes | Yes | Decide with counsel | Stop processing; preserve trail | IR-12 |
| Payment error | P1/P2 | Founder | Per playbook | If funds wrong | Yes | Affected payers | Stop webhook processing; correct via ledger | IR-10 |
| Vulnerability report (outside) | per SECURITY.md | Founder | n/a | Safe-harbour questions | No | Reporter reply | Clock starts at confirmation | `SECURITY.md` |

Escalation path above the commander is in [CLOUD_SECURITY_PLAN.md](CLOUD_SECURITY_PLAN.md) section 5.

## 5. Response lifecycle (summary; canonical steps live in the runbook)

1. Detect and open a record (ID, time first known, source, provisional severity). 2. Name commander, technical lead, recorder (and counsel if data may be involved). 3. Freeze non-essential deploys. 4. Preserve before changing: export audit and function logs for the window. 5. Ask the five questions. 6. Contain with the narrowest lever and write down what it stopped and what it cost. 7. Draft the message from section 7 and set the next-update time. 8. Engage counsel when law, contract or a regulator may be involved. 9. Recover, validate tenant isolation, audit continuity and core journeys. 10. Close with a second read, residual-risk decision, notices recorded, corrective actions with owners and dates. [VERIFIED] `docs/integrated-trust/INCIDENT-RESPONSE.md` sections 3 and 5; `docs/trust/SECURITY-INCIDENT-RUNBOOK.md`.

## 6. What there is no lever for

Signing every session out has never been exercised (SECURITY.md); try it once on a spare account before any pilot (TT-04). Read-only mode and most switches have never been engaged in production (TR-29).

## 7. Communication templates [DRAFT]

The composer `app/src/lib/governance/incident-comms.ts` requires seven sections in this order and refuses a message that has a missing section, a bracketed placeholder, a hedge phrase or a missing required detail. Fill every `[bracket]` with a verified fact before use. State only verified facts; do not give a root cause, a clock or a promise that has not been approved. Nothing here has ever been sent.

### 7.1 Internal incident declaration

> **Incident [ID] - [P0/P1/P2/P3] - declared [date time zone]**
> **What happened:** [verified facts and source of detection].
> **Who is affected:** [tenants, accounts, data classes - or "not yet known"].
> **What is impacted:** [systems, workflows, integrity/confidentiality/availability].
> **What to do now:** [actions for each named role].
> **What Semester is doing:** [containment lever used and what it cost].
> **Next update:** [time].
> **Where to get help:** [commander, recorder, counsel contact].
> Commander: [name]. Recorder: [name]. Counsel engaged: [yes/no/time]. Evidence location: [protected path, no secrets].

### 7.2 Customer notification (institution administrator) - non-binding draft

> **Subject: Semester [security/privacy/availability] incident [ID] affecting [Institution]**
> **What happened:** On [date] we [identified/confirmed] [verified description]. [Whether data was accessed: Not indicated / Suspected / Confirmed / Unknown - state which records were checked and how far back they go.]
> **Who is affected:** [accounts/cohort] at [Institution].
> **What is impacted:** [data classes involved; workflows affected; what still works].
> **What to do now:** [specific actions, e.g. rotate a credential, review a report, tell students]. [Contact: named route.]
> **What Semester is doing:** [containment, investigation, recovery steps taken].
> **Next update:** [time].
> **Where to get help:** [named contact].
> This notice is a factual update. Notification obligations under the agreement or law are handled between the parties' authorized contacts. [Counsel-approved agreement reference: PLACEHOLDER].

### 7.3 Student-facing notice (outage or data event)

> **What happened:** Since [time, timezone] [feature] has not worked. / On [date] [verified event].
> **Who is affected:** [everyone / students at Institution / users of feature].
> **What is impacted:** [what they cannot do; whether saved work is affected].
> **What to do now:** [action or "nothing"]. If a deadline is affected, contact [named route] and we will confirm to your instructor.
> **What Semester is doing:** [action and next step].
> **Next update:** [time].
> **Where to get help:** [route].

### 7.4 Regulator / counsel hand-off (internal packet to counsel; not a notice)

> **To:** [counsel]. **Incident:** [ID]. **Prepared by:** [name], [date time].
> 1. Facts verified so far, with source and confidence for each. 2. Timeline (first known, containment, current). 3. Systems, tenants, data classes, number of accounts if known, minors involved yes/no. 4. Contracts and agreements in force with affected institutions: [list or "none"]. 5. Providers involved and their notices. 6. Evidence preserved and where. 7. Questions for counsel: which notification duties apply, to whom, and by when; what may be said publicly. 8. Decisions needed from you by [time].
> No conclusion about notification duty, deadline or applicable law is stated in this packet. [REVIEW: counsel]

### 7.5 Status-page entry

The status source is `app/public/status-incidents.json`, validated by `app/src/lib/statuspage.test.ts`; posting means editing the file, merging and deploying (about three minutes). Entry content follows 7.3 with the same required fields. No subscriber notification exists (TR-39).

## 8. Customer notification workflow [DRAFT]

Sequence only; every legal question goes to counsel and every contract question to the agreement. No clock is asserted here.

| Step | Action | Owner | Output |
| --- | --- | --- | --- |
| 1 | Confirm the facts that matter: what, whose data, when, still ongoing | Commander | Verified fact sheet |
| 2 | Open the privacy-breach assessment worksheet if personal data may be involved | Privacy (founder acting) | Worksheet (`docs/legal-drafts/PRIVACY-BREACH-ASSESSMENT-WORKSHEET-TEMPLATE.md`) |
| 3 | Hand off to counsel with the 7.4 packet | Commander | Counsel's written view [REVIEW: counsel] |
| 4 | Check the agreement and DPA exhibit for notice terms (none is approved today; none exists for any customer) | Founder | Contract reading |
| 5 | Decide audiences and approvers using the composer's audience table | Founder + counsel | Audience list |
| 6 | Draft from 7.2/7.3; run the composer's checks | Communications (founder) | Approved text |
| 7 | Send through the agreed channel and log time, recipient, content hash | Founder | Send log |
| 8 | Follow-up updates at the interval; close with a summary | Commander | Closing summary |

Internal target in `SECURITY.md` ("within 72 hours of confirming that rows were readable, every affected account is emailed") is a working target pending counsel, not a commitment; the public site and the HECVAT draft state it more firmly (see [TRUST_CENTER_INVENTORY.md](TRUST_CENTER_INVENTORY.md) finding T-1). [REVIEW: counsel]

## 9. Legal and counsel escalation triggers [DRAFT]

Engage counsel at once when: personal data of students may have been exposed; a minor is involved; an institution's records or education records are involved; a regulator, law enforcement or the press makes contact; a contract notice term may apply; a statement about cause or fault is being considered; a payment or financial record error affects customers; anything resembling a safety threat (route per `docs/CAMPUS-ESCALATION-POLICY.md`). Counsel is unassigned today; engaging counsel is itself a pre-pilot action (TR-21).

## 10. Tabletop exercise script and schedule

### 10.1 Schedule

The canonical schedule is `docs/integrated-trust/TABLETOP-CALENDAR.md` (TT-01..TT-13, in weeks after a programme start that is a founder decision). Illustration only [ASSUMPTION]: if the programme starts 2026-11-02, TT-01 (cross-tenant, week 2) falls 2026-11-16, TT-02 (AI switch release by a second reviewer, week 4) 2026-11-30 and TT-03 (provider-backup restore, week 6) 2026-12-14. An exercise counts as held only when its file exists under `docs/evidence/operations/` stating the day it was held, who attended and what it found. After year one: monthly one-hour tabletop, quarterly cross-functional exercise including a test-list message, yearly staffed game day with external review.

### 10.2 Script for TT-01 (suspected cross-tenant exposure) [DRAFT]

Participants required to pass: founder as commander plus **one other human** as recorder/second reviewer (the first exercise that tests whether anyone but the founder can contain). Use synthetic tenants and accounts only.

| Time (minutes) | Inject (read aloud by facilitator) | Expected action | Records |
| --- | --- | --- | --- |
| 0 | "A user at tenant A reports seeing another school's course titles." | Open incident record; classify P0 until disproven; name commander and recorder | Incident ID, time, severity |
| 5 | "Audit logs show the read came from a new route released today." | Freeze deploys; preserve audit and function logs for the window | Evidence location (no secrets) |
| 10 | "Support asks if they can message the user." | Hold outward comms; open draft from 7.1/7.2; engage counsel | Counsel contact attempt (counsel unassigned: record as a gap) |
| 15 | "Can we stop it without deploying?" | Choose the narrowest lever: per-school kill switch or page rollback; say what it costs | Lever, who executed, time |
| 25 | "Scope: tenant B says nothing changed; tenant C has no logs older than 30 days." | State what cannot be known; note provider log window | Scope statement |
| 35 | "Customer's CISO calls for an update." | Use 7.2; no cause or clock promised | Draft message passed through the composer's checks |
| 45 | "Fix is merged." | Validate isolation with a second-account check; two-person review before release | Validation record |
| 55 | Close | Closing summary read by a second person; list corrective actions | Tracker entries (section 11) |

Pass criteria (from the calendar): every step names who does it and what tool; every gap becomes a remediation item; the real contact tree and switch list were used. Finds out: whether anyone but the founder can contain a cross-tenant event. File as `docs/evidence/operations/<date>-cross-tenant-tabletop.md`.

## 11. Postmortem template and corrective-action tracker

### 11.1 Postmortem template (within 5 business days of closure [ASSUMPTION], per the TT-12 pass rule)

```text
Incident ID / severity / dates (first known, contained, recovered, closed)
Summary (3 sentences, facts only)
Impact: tenants, accounts, data classes, duration, user-visible effect
Timeline (UTC, from the incident record)
Detection: how found, how long undetected, why
Root cause and contributing causes (technical, process, people/coverage)
What worked / what did not (levers, runbooks, tooling, communications)
Notifications: audiences, approvers, send times, counsel decisions [REVIEW: counsel]
Residual risk and who accepted it
Corrective actions (table below), each with owner, due date, retest
Claims / documents to correct (register rows, questionnaire answers, public text)
Second reader's name and date
```

### 11.2 Corrective-action tracker (template and starter)

| ID | Source (incident/drill) | Action | Owner | Due | Status | Retest evidence | Register row |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CA-001 | 2026-10-03 tabletop | Recruit and train a named backup / second reviewer; test escalation and recovery approval | Harrison Rubin | Before any supported launch | Open | `docs/evidence/operations/` record of a two-person exercise | CER-A13 |
| CA-002 | 2026-10-03 tabletop | Configure target signals and routes; test delivery and acknowledgement | Harrison Rubin | Before supported production | Open | Alert drill record (TR-07) | CER-D18, E10 |
| CA-003 | 2026-10-03 tabletop | Provision authorized DAST target/runtime/credential; scan, remediate, rescan | Harrison Rubin | Before paid pilot | Open | Clean rescan | CER-D06 |
| CA-004 | 2026-10-03 tabletop | Freeze scope and engage an independent assessor | Harrison Rubin | Before paid pilot | Open | Independent report | CER-D09 |
| CA-005 | 2026-10-03 tabletop | Isolated restore of a real provider backup after explicit cost approval | Harrison Rubin | Before any RTO/RPO claim | Open | Restore record (TR-10) | CER-D20 |
| CA-006 | 2026-10-03 tabletop | Customer seats, tenant configuration and two-account/two-tenant UAT | Harrison Rubin with customer | Before institutional activation | Open | UAT record | CER-F15 |
| CA-007 | 2026-10-03 tabletop | Engage counsel, accessibility and customer approvers | Harrison Rubin | Affected broad/paid motions | Open | Dated acceptance | CER-E06, F07 |
| CA-008 | This plan | Decide the severity scale and record it (TR-06) | Harrison Rubin | Days 1-30 | Open | Dated decision | CER-E02 |
| CA-009 | This plan | Align public/HECVAT 72-hour wording with SECURITY.md after counsel decision | Harrison Rubin + counsel | Before outreach points to it | Open | Edited text and register | CER-E05 |

Tracker rules: every action has an owner and date; an action is closed only with retest evidence filed; the tracker is reviewed at the monthly tabletop.

## Evidence state

Process statements cite the canonical documents at `5eba494`. The only exercise evidence is the founder document tabletop of 2026-10-03. Nothing here demonstrates detection, containment or notification operating.

## Claim ceiling

Permitted: "Semester has a documented incident lifecycle, containment options, communication templates and supporting technical controls." (the wording in docs/trust/INCIDENT-RESPONSE-PLAN.md). Not permitted: 24/7 response, tested response times, guaranteed notification clock, institution-approved incident process, completed tabletop, proven end-to-end recovery.

## Prohibited claims

24/7 monitoring or support, response or notification times, "exercised/tested incident response", forensic completeness, uptime/RTO/RPO, SOC 2, FERPA/GDPR/HIPAA compliance.

## Professional review required

Counsel [REVIEW: counsel] for every notification, contract term, regulator contact and public statement; security reviewer [REVIEW: security] for containment and evidence handling; privacy lead [REVIEW: privacy] for the assessment worksheet. None named in the repository.
