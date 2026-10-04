# Templates

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — TEMPLATES ARE UNUSED UNTIL A DATED RECORD EXISTS** |
| Owner seat | `operations` |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Claim ceiling | A template is a form, not evidence. Semester may not claim a process operates because its template exists. |

## How to use these

- **Copy the block, fill every field, and file the record where its page says.** A blank field is written *none* or *not applicable* with a reason; it is never left empty.
- **Customer-specific records, names, contacts, contracts and personal data go in the private operations system.** This repository holds the forms and aggregate, de-identified records only.
- **Never put** passwords, tokens, MFA or recovery codes, full payment-card numbers, private notes or documents, or sensitive categories in any record.
- **A record names seats, not usernames,** and says *acting* where the Founder holds a seat that is not independently staffed ([03](03-raci-and-decision-rights.md#principles)).
- **Legal items** are marked *requires qualified human counsel review* and added to the [legal review queue](../../../LEGAL-REVIEW-QUEUE.md). Nothing here is a legal conclusion.
- Plain text is deliberate: every template reads in a screen reader and survives copy and paste.

| ID | Template | Used by | Page |
| --- | --- | --- | --- |
| TPL-01 | Weekly operating review notes | Cadence | [01](01-operating-cadence.md) |
| TPL-02 | Monthly business review pack | Cadence | [01](01-operating-cadence.md) |
| TPL-03 | Quarterly review and objectives | Cadence | [01](01-operating-cadence.md) |
| TPL-04 | Decision record | Decisions | [03](03-raci-and-decision-rights.md) |
| TPL-05 | Implementation charter | Implementation | [02](02-implementation-methodology.md) |
| TPL-06 | Phase gate record | Implementation | [02](02-implementation-methodology.md) |
| TPL-07 | Go-live readiness review and decision record | Launch | [10](10-tenant-launch-risk-and-readiness.md) |
| TPL-08 | Hypercare log and exit handoff | Implementation | [02](02-implementation-methodology.md) |
| TPL-09 | Executive business review | Success | [02](02-implementation-methodology.md) |
| TPL-10 | Renewal risk review | Success | [02](02-implementation-methodology.md) |
| TPL-11 | Support case record and escalation note | Support | [04](04-support-operating-model.md) |
| TPL-12 | Incident record and status update | Incidents | [05](05-incident-and-continuity.md) |
| TPL-13 | Post-incident review | Incidents | [05](05-incident-and-continuity.md) |
| TPL-14 | Change request | Change | [06](06-vendor-quality-change.md) |
| TPL-15 | Vendor review record | Vendors | [06](06-vendor-quality-change.md) |
| TPL-16 | Provider application and listing review | Marketplace | [08](08-marketplace-partner-trust-fulfillment.md) |
| TPL-17 | Dispute case record | Marketplace | [08](08-marketplace-partner-trust-fulfillment.md) |
| TPL-18 | Trust and safety case record | T&S | [08](08-marketplace-partner-trust-fulfillment.md) |
| TPL-19 | Partner scorecard | Partners | [08](08-marketplace-partner-trust-fulfillment.md) |
| TPL-20 | Tenant risk register entry | Launch | [10](10-tenant-launch-risk-and-readiness.md) |
| TPL-21 | Delegation of authority record | People | [03](03-raci-and-decision-rights.md), [11](11-founder-to-team-transition.md) |
| TPL-22 | Handoff record | Handoffs | [handoffs](handoffs.md) |
| TPL-23 | SOP and runbook skeleton | Knowledge | [07](07-knowledge-training-enablement.md) |
| TPL-24 | Training module and sign-off | Knowledge | [07](07-knowledge-training-enablement.md) |
| TPL-25 | Knowledge article | Knowledge | [07](07-knowledge-training-enablement.md) |
| TPL-26 | Corrective and preventive action | Quality | [06](06-vendor-quality-change.md) |

## TPL-01 Weekly operating review notes

Record in the private ops log; aggregate summary only in the repository.

```text
WEEKLY OPERATING REVIEW — week of [DATE]
Chair: [seat]   Present: [seats]   Scribe: [seat]
Advisor read (at least monthly): [who or role] on [date] — response: [text]

1. SAFETY AND TRUST (5 min)
   Open SEV1 or SEV2: [incident ID — owner seat — next update time]
   Open security, privacy, safety, accessibility cases: [case ID — owner seat]
   Unowned items assigned in the room: [item -> owner seat]

2. SCORECARD MOVES (10 min)
   [metric ID — was -> now — cause, or "no data" — owner seat]

3. CUSTOMERS (10 min)
   [tenant — phase — health colour and word — next gate date — escalation]

4. RELEASE AND CHANGE (10 min)
   [candidate — intention: GO | NO-GO — freeze conflicts resolved]

5. RISKS AND CLAIMS (10 min)
   Acceptances within 14 days of expiry: [ID — renew | fix | lapse]
   Claims requested: [claim ID — approve | withhold — reason]

6. DECISIONS (10 min)
   [decision ID — class — decision — owner seat — date]
   Deferred: [ID — to DATE — because REASON]

7. TOP FIVE FOR THE WEEK
   1. [action — owner seat — date]   2. ...   3. ...   4. ...   5. ...

Self-approved decisions this week (for independent read): [IDs]
Forums held on time: [yes | no]   Skipped since last review: [list]
```

## TPL-02 Monthly business review pack

```text
MONTHLY BUSINESS REVIEW — [MONTH YEAR]   Stage: [0|1|2|3]   Chair: [seat]

1. CUSTOMERS AND PIPELINE   Tenants by phase and health; pipeline by stage with next dated step; no-data metrics listed
2. DELIVERY                 Time to launch gate; gate adherence; rework; open P1 UAT defects (D3)
3. RELIABILITY AND SUPPORT  SLO attainment where measured; incidents and recurrence; contact rate; QA (D4, D5)
4. TRUST                    Privacy and data-rights queue ages; safety; accessibility defects; AI incidents; vendor reviews due (D6, D7)
5. MONEY                    Budget against actual; runway in months; collections; cost per active user including AI (D8)
6. PEOPLE AND CAPACITY      Triggers fired and unmet; founder operations hours; bus factor (D9)
7. DECISIONS NEEDED         [decision — options — recommendation — criteria — needed by]

Forced onto the agenda this month: [red metric two weeks | acceptance within 14 days | vendor review overdue | process with fewer than two able people]
Last month's actions: [action — owner — done | not done — why]
```

## TPL-03 Quarterly review and objectives

```text
QUARTERLY REVIEW — [QUARTER YEAR]
RESULT AGAINST OBJECTIVES
  Objective [n]: [text]
    KR1 [metric ID] baseline [x] target [y] result [z] colour [word]  What would have to be true to change it: [text]
    KR2 ...   KR3 ...
CUSTOMER OUTCOMES   Pilot scorecards vs baseline; conversions, extensions, stops (decision record links)
STAGE CHECK         Current stage [n]; criteria met [list]; criteria unmet [list]; decision: PROMOTE | HOLD | DEMOTE — reason
PORTFOLIO           Build | partner | integrate | defer | decline | sunset — per item with reason
PRICING / PACKAGE   Changes requested; deal-desk record; finance sign-off
CAPACITY / HIRING   Triggers fired [list]; opened | deferred — reason and next review date
NEXT QUARTER        At most five objectives, each at most three key results from the metric dictionary
```

## TPL-04 Decision record

For a repository change, this is `docs/decisions/D-<pull request number>.md` ([README](../../decisions/README.md)). For a customer, person or contract decision, file privately and note only its existence here.

```text
## D-[PR number] · [the decision, as a sentence]
Decided [date] by [seat; "acting" if not independently staffed]   Class: [1 | 2 | 3 | E]
Context:            [why now]
Options considered: [at least two, including doing nothing]
Criteria:           [what decides between them]
Decision:           [what was decided]
Consulted:          [seats, dates]   Dissent recorded: [seat — summary | none]
Not decided here:   [what is left open]
Reversal condition and review date: [text — date]
Evidence:           [links]
Requires qualified human counsel review: [item | none]
Self-approved (sole producer and approver): [yes | no]
```

## TPL-05 Implementation charter

Private record. Signed by the customer sponsor and Semester's `success` seat.

```text
IMPLEMENTATION CHARTER — [TENANT]   Version [n]   Date [date]
1 Purpose and the job to be done: [one workflow, one cohort]
2 Cohort: [population, roles, count 10–200]   Term: [26 weeks from kickoff | other, with reason]
3 Success measures and frozen baselines: [measure — baseline — target — source]   (cohort aggregates only; none about an individual student)
4 Scope in: [modules, connectors, roles]   Scope out: [explicit]   Mode: [native | connected | coexistence]
5 Data: [classes in scope; forbidden classes confirmed absent; authority; source precedence]
6 Roles and RACI: [Semester seats; customer sponsor, champion, IT, privacy, security, accessibility, procurement]
7 Calendar: [term dates, freeze windows, launch target; assumption stated]
8 Support and hours: [as approved; what happens outside them; escalation contacts held privately]
9 Risks opened: [register link]   Open counsel items: [list]
10 Possible decisions at the end: CONVERT | EXTEND | EXPAND | PAUSE | STOP — each stated as available
11 Stop and exit: [stop controls; export format; deletion evidence]
12 Change control: [anything outside scope is a change order]
Signed: [sponsor — date]   [Semester seat — date]   Counsel review: [reference]
```

## TPL-06 Phase gate record

```text
PHASE GATE — [TENANT] — [phase] -> [next phase]   Date [date]
Gate evidence required (from the rollout state machine): [list]
  [evidence name — present | absent — link — label I | E | C — recorded since entering this state? yes | no]
Open P0 or P1: [none | list]   Score (if used): [n]
Decision: PASS | FAIL | PASS WITH CONDITIONS   Conditions: [text — owner — expiry]
Receiver restatement: [what is being asked, by when, what done looks like]
Signed: [gate holder seat — date]
```

## TPL-07 Go-live readiness review and decision record

```text
GO-LIVE DECISION — [TENANT] — tier [L2 | L3 | L4 | L5 | L6]   Decision date [date]
Fresh decide() result attached: [yes — date and time]   Verdict: [GO | GO WITH CONDITIONS | NO-GO]
HARD GATES   [H-nn — met | not met — evidence link — label I | E | C]  (every gate for the tier)
SCORECARD    Dimension scores and total [n]; any dimension below its floor [list]; minimum for tier [n]
OPEN RISKS   By class P0 / P1 / P2 / P3 — [ID — owner — status]
ACCEPTANCES  [blocker — owner seat — reason — what users are told — expiry]   (P2 and P3 only; founder seat)
SUPPORT ROSTER FOR THE FIRST 14 DAYS   [roles — seats — both sides]   Hours the customer has been told: [text]
COMMUNICATIONS  Approved launch notice [link]; status page armed [yes | no]
STOP CONTROLS   Per-tenant flag [tested date]; read-only [tested date]; pause [tested date]
SIGNATURES (valid only for this decision)
  founder | product | engineering | security | privacy | accessibility | success | operations | champion:
  [signed | signed with conditions | not signed — reason — date]
CUSTOMER APPROVAL   [name and role — date — their own record reference]
If NO-GO: dated remediation plan [text]   Next review [date]
```

## TPL-08 Hypercare log and exit handoff

```text
HYPERCARE LOG — [TENANT] — day [n] of [planned]   Date [date]
Sign-in success [n of N]   Activation [n of N]   Errors and denials vs baseline [text]
Reconciliation [pass | fail — consecutive passing days n]   Connector health [state per connector]
Cases: new [n]  open [n]  oldest [age]  P0/P1 [list]   Incidents: [IDs]
Accessibility reports [list]   Sponsor/champion feedback [text]
Issues and owners: [item — owner — date]   Tomorrow's focus: [text]

EXIT TEST (all required)
  14 days with no open P0 or P1 [yes | no]   Reconciliation passing 7 days [yes | no]
  Support metrics inside thresholds [yes | no]   Customer desk resolved first-line cases without help for 7 days [yes | no]
  Sponsor agreement in writing [yes | no]
Handoff to steady state (H-07): [receiver seats — restated open items — date accepted]
```

## TPL-09 Executive business review

```text
EXECUTIVE BUSINESS REVIEW — [TENANT] — [date]   Attendees: [sponsor, champion, Semester seats]
1 What we set out to do (charter job and measures)
2 Outcomes against frozen baselines (cohort aggregates, n at least 10): [measure — baseline — now — note]
3 Adoption: invited | activated | habitual | self-sufficient — numbers and trend
4 Reliability and support: incidents, service levels measured with their rung, satisfaction
5 What went wrong and what we changed (honest)
6 Risks and what we need from you
7 Options ahead: CONVERT | EXTEND | EXPAND | PAUSE | STOP — what each would require
8 Decisions and actions: [item — owner — date]
No claim in this document exceeds the claims register.
```

## TPL-10 Renewal risk review

```text
RENEWAL RISK REVIEW — [TENANT] — term ends [date]   Clock: T-[180 | 120 | 90 | 60 | 30]
Health score [colour and word — reason]   Readiness tier [n]   Outcomes vs baseline [text]
Sponsor in role [yes | no — name privately]   Champion in role [yes | no]   Executive engagement [text]
Unmet expectations: [list]   Competitive or internal alternatives: [list]
Procurement path and dates: [steps]   Budget status: [text]   Counsel items open: [list]
Risks: [ID — class — owner]   Actions: [item — owner seat — date]
Recommendation: [renew | renegotiate | extend | stop honestly]   Decision owner: founder
```

## TPL-11 Support case record and escalation note

```text
CASE [ID]   Track: [individual | institution]   Tenant: [id]   Received [date time]
Category [ACC | WRK | LRN | ACD | FIN | AIX | INT | FAM | CMP | MKT | PRV | SEC | ACX | SAF | ADM | COM | FBK | HOW]
Type [question | request | defect | incident | feedback]   Priority [P0–P3] — derivation: [impact x urgency; overrides]
Identity and authority verified: [how — yes | no]
What the person was trying to do: [text]   Impact and cohort size: [text]
Identifiers (redacted): [correlation ID, course/assignment IDs, connection/job IDs]   Consented diagnostics: [yes | no]
Steps taken: [list]   Told to the person: [text]   Next update due: [date time]
Clocks: ack [met | missed]  update [met | missed]  resolution [met | missed | paused — reason]
Support access: [none | grant ID — purpose — scope — expiry — revoked at close]

ESCALATION NOTE (if any)
  To: [level and seat]   Why now: [trigger]   Ask: [specific]
  Summary: [text]   Tried: [list]   Evidence: [links]   Customer told: [text]
  Receiver restatement: [hypothesis, next step, next update time]

CLOSE: resolution [text]  scope [text]  communication sent [yes]  access revoked [yes | n/a]
       confirmation [yes | no reply — auto-resolve date]  link to known issue or problem [id]  follow-up owner/date [text]
```

## TPL-12 Incident record and status update

```text
INCIDENT [ID]   Declared [date time]   Severity [SEV1–SEV4]   Flags [EXPOSURE | RECORD | SAFETY | AI | A11Y | none]
Commander [seat]   Technical [seat]   Security [seat]   Comms [seat]   Customer [seat]   Scribe [seat]   Compensating controls [text]
Detection: source [text]  first known [date time]  detected [date time]
Affected: services [list]  tenants [list]  data classes suspected [list]  student-visible effect [text]
Containment: [action — time]   Deploys frozen [yes | no]   Evidence preserved [yes — where]
Counsel engaged [yes | no | n/a — time]
TIMELINE (append only): [time — event — decision — by whom]

STATUS UPDATE (use the audience template; seven elements)
  Audience [student outage | institution admin | integration delay | security | privacy | accessibility | AI quality | marketplace safety | community safety | maintenance | rollback]
  1 What happened   2 Who is affected   3 What data or workflow is affected   4 What you should do now
  5 What Semester is doing   6 Next update: [date time, even if nothing will have changed]   7 Where to get help
  Required fields for this audience: [e.g. data exposure: not indicated | suspected | confirmed | unknown]
  Approvers: [seats]   Sent: [time]   Next update due: [time]

RECOVERY AND VERIFICATION: [steps]  verified: [security | privacy | integrity | accessibility | source | reconciliation] — [evidence]
CLOSE: resolution notice sent [time]  access revoked [yes]  review due [date, within 5 business days]
```

## TPL-13 Post-incident review

```text
POST-INCIDENT REVIEW — INCIDENT [ID]   Held [date]   Participants [seats]   Blameless: yes
Summary and impact (measured): [duration, tenants, users, data classes, records]
Timeline (from the record, not memory): [key times — detect, declare, contain, notice, recover, verify, close]
Detection: how found; what should have found it sooner
Response: what worked; what did not; compensating controls that were used
Root causes (ask why until a control is named): [cause 1 — control that failed or was missing]
Communications: timeliness against targets; audience feedback
Corrective actions: [action — class prevent | detect | mitigate — owner seat — due date]
   SEV1 actions close in 30 days; SEV2 in 60
Regression test: [test name — failed against a revert of the fix, then restored: yes | no]
Runbook, article and macro changes: [list]   Problem record: [id | none]
Reviewed by an independent reader: [name or role — date]
```

## TPL-14 Change request

```text
CHANGE [ID]   Kind [release | tenant configuration | infrastructure or vendor | policy or process | customer organizational]
Class [Standard | Normal | Major | Emergency]   Requested by [seat]   Date [date]
What changes and why: [text]   Tenants affected: [list]   Journeys affected: [list]
Freeze check: [no tenant freeze or term event in the window | approved exception — by whom]
Change advisory (answer before merge for anything above the lowest tier)
  Design: [what a student or staff member sees differently, or nothing visible]
  Privacy: [what it holds about a person that it did not, or nothing new]
  Accessibility: [how it was checked with keyboard only, or renders nothing]
  Data owner: [who owns the data it touches; informed on date]
  Rollback: [the exact step; whether the schema can go back]
Evidence: gates passed [list]   Test results [links]   Rehearsal [yes | no | n/a]
Customer notice: [lead time required — sent on date]   Support and articles updated [yes | no]
Approver [seat — date]   Implemented [date time]   Result [success | rolled back — reason]
Post-implementation review: [needed for Major and Emergency — date]
```

## TPL-15 Vendor review record

```text
VENDOR REVIEW — [VENDOR]   Tier [V1 | V2 | V3]   Review type [intake | annual | renewal | incident | change]   Date [date]
Business purpose and owner seat: [text]   Journeys and continuity tier depended on: [list]
Data classes and systems accessed: [list]   Region: [text]   Subprocessors: [list]   AI or model use: [yes — details | no]
Assurance: [report type — date — exceptions]   Questionnaire: [date — findings]
Privacy terms: [DPA reference — retention — deletion — training prohibition — incident notice terms]
Accessibility (user-facing parts): [status]   Insurance: [text]   Financial viability: [text]
Service record: [status incidents — SLA record — cost vs forecast]
Findings: [ID — severity — owner — due]   Risk acceptance (P2 or P3 only): [reason — disclosure — expiry]
Exit plan: [alternative — export path — time to switch — last tested date]
Contract: [start — term — renewal date — notice date in the calendar — counsel review reference]
Decision: [approve | approve with conditions | renew | renegotiate | replace | exit]   Decider [seat — date]
Subprocessor list updated [yes | no | n/a]   Register updated [yes]
```

## TPL-16 Provider application and listing review

Dormant until marketplace phase 0 is opened.

```text
PROVIDER [ID]   Risk tier [M1 | M2 | M3]   Applied [date]   Complete on [date]
Entity and owners: [legal name, jurisdiction, beneficial owners — held privately]
Offering: [what is sold, to whom]   Price and all fees: [text]   Fulfilment model [A | B | C]
Claims made: [claim — evidence — verified by — date]   (any unsubstantiated claim is removed)
Verification: identity and business [done | date]  sanctions and adverse-media [done | date | by whom]  background checks (M3, as counsel permits) [done | n/a]
Policy fit: [text]   Privacy and data needs: [data requested — purpose — consent design]   Security posture (if data flows): [text]
Accessibility of the offering: [text]   Insurance: [text]   Conflicts or relationships with Semester or the school: [disclosed text]
Reviewers: trust [date]  privacy [date]  accessibility [date]  security [date]   Counsel items: [list]
Decision (within 10 business days of complete): [approve | approve with conditions | decline]   Conditions and review date: [text]
Listing: published [date]   Disclosure labels [yes]   Re-verification due [date: M1 12 months; M2 and M3 6 months]
```

## TPL-17 Dispute case record

Dormant until marketplace phase 1 is opened.

```text
DISPUTE [ID]   Opened [date]   Order [ID]   Provider [ID]   Type [not delivered | not as described | quality | accessibility | privacy | other]
Safety or conduct involved: [no | yes — T&S case ID; dispute paused]
Acknowledged [date]   Evidence requested from student [date — due in 3 business days]   from provider [date — due]
Evidence (minimal, redacted): [list]   Consent for any screenshots [yes | no]
Assessment against guideline [version]: [text]   Reason code: [text]
Decision (within 10 business days of complete evidence): [full refund | partial refund | replacement or redo | no action | provider sanction]
Executed by: [provider and payment provider]   Completion verified [date]   Notified [date]
Appeal: [filed | not filed]   Reviewer (different from the first): [seat]   Decided [date within 5 business days]
Provider consequence: [none | warn | restrict | suspend | remove]   Fraud signals noted: [list]
```

## TPL-18 Trust and safety case record

```text
T&S CASE [ID]   Opened [date time]   Source [in-product report | automated signal | support | partner]   Category [from the moderation SOP list]
Provisional priority [P0–P3] — reason: [text]   Minor involved [yes | no]   Imminent harm [yes — crisis route used | no]
Minimum reversible protection applied: [action — time]
Content references (not copies) and evidence hashes: [list]
Reviewer [qualified human — recusal checked: yes]   Decision [reason code — action — time]
Notice to the person: [sent — time]
Appeal: [filed | not filed]   Reviewed by a different professional [seat — date]   Outcome [text]
Retention date set: [90 days after a no-action close | one year after enforcement or appeal]
Escalation to emergency or the school's crisis contact: [none | route — time]   Counsel involved: [none | item]
```

## TPL-19 Partner scorecard

```text
PARTNER SCORECARD — [PARTNER]   Type [integration | consultant | channel | content | ambassador | association]   Period [dates]
Maturity or tier: [from the provider registry]   Pilot expiry [date]
Delivery [green | amber | red — evidence]   Customer outcome [green | amber | red]   Compliance [green | amber | red]
Claims discipline [green | amber | red — any unapproved claim?]   Responsiveness [green | amber | red — SL-PAR-01]
Security posture [green | amber | red — assurance date]   Commercial [green | amber | red]
Share green: [n of 7]   Any red on compliance or claims discipline: [yes | no] — if yes, restrict now
Incidents and support escalations: [list]   Customer feedback: [text]
Decision: [expand | hold | exit]   Reason and conditions: [text]   Decider [seat — date]   Next review [date]
```

## TPL-20 Tenant risk register entry

```text
TENANT RISK [ID]   Tenant [id]   Opened [date]   Standard risk [TR-nn | custom]
Description: [cause — event — consequence]
Probability [1–5]  Impact [1–5]  Exposure [P x I]  Velocity [slow | medium | fast]   Class [P0 | P1 | P2 | P3]
Trigger (what we will see first): [text]   Owner seat: [seat]
Mitigation (reduces the chance): [text]   Contingency (if it happens): [text]
Residual exposure: [n]   Review: [weekly | monthly]   Status [open | mitigating | accepted | closed]
Acceptance (P2 or P3 only; founder seat): reason [text]  what users are told [text]  expiry [date]
```

## TPL-21 Delegation of authority record

```text
DELEGATION — [authority]   Date [date]
Delegated by [seat]   Delegated to [person and seat, with acting status]   Second person trained [name or role]
What is delegated: [decision or action]   Limit: [amount, scope, tenants, risk class]   Excluded: [what stays with the delegator]
Starts [date]   Ends [date or review date]   Revocation condition: [text]
Exceptions are read by: [independent reader]   Frequency [text]
Record location for decisions made under this delegation: [system]
Counsel review needed: [none | item]
Acknowledged by delegate [date]
```

## TPL-22 Handoff record

Use when no system record exists. Match the fields to the [handoff contract](handoffs.md#the-handoff-contract).

```text
HANDOFF [H-nn]   Date [date time]   Case, tenant, incident or process: [reference]
From [seat or person]   To [seat or person]   Trigger: [text]
Package attached: [checklist from the handoff definition — each item present | missing]
Sent [time]   Acknowledged [time]   Accepted or rejected [time]   Rejection reason (if any): [text]
Receiver restatement (acceptance test): [what is asked, by when, what done looks like]
Ownership in transit: [sender] until [time]
Customer told who the next contact is: [yes | n/a]   Customer asked for anything already held: [no | yes — what]
For a founder transfer (H-17): ladder level reached [L0–L5]   Fresh-hands result [pass | fail — notes]   Access list [least privilege]
Clock status: [met | missed — escalated to]
```

## TPL-23 SOP and runbook skeleton

```text
TITLE: [action or situation]   ID/path: [path]   Owner seat: [seat]   Backup: [seat or person]   Version [n]   Status [draft | exercised]
Last exercised: [date — by whom — fresh-hands result — time taken]   Review due: [date]
TRIGGER: [when to use this]   SEVERITY / CLASS if any: [text]
PREREQUISITES AND ACCESS: [least privilege; how access is obtained; two-person rule if any]
STEPS (numbered; each with expected result)
  1. [do — expect]
  2. ...
VERIFICATION: [how to know it worked; what to check]
IF IT FAILS: [recovery; who to call; escalation]
ROLLBACK: [the exact step]
EVIDENCE TO KEEP: [what, where, how long]
COMMUNICATION: [who is told, when, with which template]
RELATED: [runbooks, articles, registers]   Changed by: [decision or pull request]
```

## TPL-24 Training module and sign-off

```text
MODULE: [title]   Role(s): [list]   Owner seat: [seat]   Version [n]   Duration [time]   Accessibility: captions [yes] transcript [yes] keyboard operable [yes] plain language [yes]
Learning outcomes (observable): [list]
Content and sources: [pages, runbooks, articles]   Practice: [exercise or sandbox task]
Assessment: [questions or practical]   Pass standard: [text]   Assessor (not the trainee): [seat]
TRAINING RECORD
  Trainee [person]   Role [text]   Module [id]   Completed [date]   Practical sign-off [pass | fail — notes]
  Certification: granted [date]   Expires [date]   Access this enables: [list]   Recertify [date]
  Assessor [seat]   Reviewed by security or privacy where relevant [yes | n/a]
```

## TPL-25 Knowledge article

```text
ID/slug: [id]   Title: [task or outcome in plain words]   Audience [role]   Home [public | signed-in | customer or operator | internal]
Owner seat [seat]   Backup [seat]   Approver [seat; domain approval for identity, data rights, security, billing, incidents, configuration, official systems]
Product, environment, version: [text]   Authority boundary: [what Semester can and cannot do; link to the official source for official actions]
Prerequisites: [list]
Steps (numbered, real text; each with a result): [list]
Expected result: [text]   If it fails: [recovery and who to contact]
Alternatives and accessibility: [alternate path]   Privacy warning: [text]   Never ask for secrets in examples: [confirmed]
Dependencies (flag, connector, policy): [list — change triggers a review]
Related: [articles]   Created [date]   Reviewed [date]   Expires [date, 90 days]   Status [draft | current | withdrawn]
```

## TPL-26 Corrective and preventive action

```text
CAPA [ID]   Opened [date]   Source [S1 or S2 escape | incident review | internal audit | customer finding | repeated support problem]
Problem: [what happened — evidence]   Impact: [text]
Containment (now): [action — owner — date]
Root cause (why until a control is named): [text]
Correction (fix this instance): [action — owner — due]
Prevention (stop it recurring: a test, gate, checklist line or monitor): [action — owner — due]
Regression test: [name — failed against a revert, then restored: yes | no]
Effectiveness checks by someone who did not fix it: 30 days [date — result]   90 days [date — result]
Closed [date]   Closed by [seat]   A CAPA is not closed without both checks.
```

## Related

[Handoffs](handoffs.md) · [Service blueprints](service-blueprints.md) · [README](README.md)
