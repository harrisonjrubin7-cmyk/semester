# 06 · Incidents, on-call, status and postmortems

> Part of the [SRE pack](README.md). Status: **proposed; no on-call coverage exists.** Controlling documents: [ON-CALL-AND-ESCALATION-POLICY.md](../engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md), [INCIDENT-RECOVERY-PLAYBOOK.md](../INCIDENT-RECOVERY-PLAYBOOK.md), [CRISIS-RESPONSE-RUNBOOK.md](../CRISIS-RESPONSE-RUNBOOK.md), [INCIDENT-COMMUNICATIONS.md](../operating-model/INCIDENT-COMMUNICATIONS.md), [PRODUCTION-SUPPORT-RUNBOOK.md](../engineering-operations/PRODUCTION-SUPPORT-RUNBOOK.md), [SECURITY.md](../../SECURITY.md). Code: `app/src/lib/incident-recovery.ts`, `app/src/lib/governance/incident-comms.ts`.

No 24/7 coverage, acknowledgement time, response time or contractual commitment is authorised or implied by anything here. A one-person assignment is not resilient coverage and does not authorise a supported institutional launch.

## 1. Where this starts

The infrastructure pages say the same thing in their own words ([OPERATIONS.md](../infrastructure/OPERATIONS.md): "one owner, no rota", "no new pager"); nothing here contradicts them.

One person holds every role. The hourly probe records an outage and nobody is told; the weekly ten minutes in `MONITORING.md` is the detection system; the one alert allowed to wake somebody is the AI provider's spend alert, and it is set in the provider's dashboard, not in this repository. An alert at three in the morning to an audience of one who is asleep is not monitoring. That is the design constraint, and the honest response to it is a ladder, not a rota drawn on paper.

## 2. Severity

Internal definitions, **not promised clocks** (from the on-call policy).

| Severity | Meaning | Examples here | First move |
| --- | --- | --- | --- |
| **P0** | Active exposure, cross-tenant access, destructive integrity loss, immediate safety or rights harm | a missing policy; a leaked service key; a broken audit chain | contain first, understand after ([SECURITY.md](../../SECURITY.md)); engage counsel via the legal queue |
| **P1** | Core workflow unavailable, major accessibility barrier, serious integrity or reliability risk | saves failing; sign-in down; a failed schema deploy | urgent mitigation or rollback; scheduled updates |
| **P2** | Degraded, with a workaround | one function erroring; a queue backed up | staffed triage, same day |
| **P3** | Minor or cosmetic | a stale label | ticket |

A burn-rate *page* rule on a journey maps to P1; a *ticket* rule maps to P2. The budget never makes a P0 acceptable.

## 3. Roles in an incident

| Role | Does | Today |
| --- | --- | --- |
| Commander | decides, owns the timeline, calls severity changes and the end | the owner |
| Operations | runs the runbook, changes the system | the owner |
| Communications | status entry, customer and student messages, using approved templates | the owner |
| Scribe | writes the timeline as it happens | the owner |
| Privacy/security lead | decides what was exposed; routes legal questions | the owner, with counsel for legal conclusions |

Where one person holds all five, say so in the incident record. The rule that matters: **the person changing the system is not the person deciding it is over** the moment a second person exists.

## 4. Lifecycle

Detect → contain → communicate → recover → verify → close (`INCIDENT_LIFECYCLE`). Three constraints from `lib/incident-recovery.ts` apply to people as much as to automation: automation may disable a risky feature, quarantine a source, block a write, mark data stale or pending, and open an incident and page the owner; it must not weaken authentication, override consent or policy, retry an ambiguous official write, share private student details, use unapproved AI, restore deleted or revoked data blindly, or declare something resolved without verification.

Close-out requires a measured timeline, impact, the recovery point, stabilisation time, the communications sent, corrective actions with owner, severity and evidence, and a post-incident review.

## 5. The on-call ladder

Each step names what it needs before it is real. **A step is not reached by declaring it.**

| Step | Shape | Needs before it counts |
| --- | --- | --- |
| **0 · Today** | One person; weekly check; probe results read, not delivered | — |
| **1 · A phone that rings** | One person, but the two page-routes (`probe:public-failed`, `ai:spend-half-cap`) reach a device that makes noise, and a named person has agreed what "quiet hours" means | a paging route; **a delivery test of both alerts** (`delivery_tested`); an agreed, written coverage window — and the plain statement that nothing outside it is covered |
| **2 · A second person** | Two people, business-hours primary and secondary, alternate weeks | the second person trained on RB-01 to RB-05 and on each role's access; least-privilege access issued and reviewed; a handoff note; a tabletop exercise both attended |
| **3 · A rota** | Primary and secondary, one-week rotation, weekend cover agreed | at least three people able to be primary; the page budget (no more than two pages per person per week) met for a month; compensation and rest agreed |
| **4 · Follow the sun** | Only when headcount allows | four or more, in more than one time zone |

Until step 1, the pack's value is in *what is written down and checked* — runbooks, the catalog, tested policies — not in a response promise. Step 2 is the one that retires the largest risk, and it is a hiring and access decision, not an engineering one ([09](09-SCORECARD-AND-ROADMAP.md)).

**Handoff** is a written note: open incidents, silenced alerts with end dates, risky changes in flight, freeze windows ahead, anything weird. **Substitution** has a process: nobody is on call who has not acknowledged the last handoff.

## 6. Alert tests

An alert that has never reached a person is a guess about an alert. Three kinds of test, in rising order of cost:

1. **Policy tests** (exist): `burn-alerts.test.ts` runs each story through `decide()` and checks the route; deliberately breaking the policy turns the right tests red.
2. **Condition tests** (to build): for each `wired` or `manual` alert, a scripted way to make the condition true on staging — fail a probe, fill a queue, stop a job, dead-letter a row — and the check that the alert evaluates true. Experiments CX-08, CX-09 and CX-10 are these.
3. **Delivery tests** (to run): a deliberate, labelled, safe trigger of the real route, acknowledged by a named person, with the time to acknowledge recorded. Monthly for every page rule; quarterly for ticket rules. Only a passing delivery test moves an alert to `delivery_tested`, and the test file that guards the register refuses the state without an evidence file that exists.

## 7. Status communication

The public status page (`app/public/status.html`) probes the app, sign-in and the database API from the visitor's browser with `no-store`, because a page answered from the app's own cache reported the app up while it returned 503. Incidents are written by hand into `app/public/status-incidents.json`; it sends no notifications. Rules:

- Name the **component and the effect**, never hosts, stack traces or vendors under investigation.
- An optional feature that is degraded never gets alarm styling.
- Updates on a schedule the commander states, even if the update is "no change".
- Audience templates (students, institution admins, executives, regulators, press) are in `incident-comms.ts`; legal-bearing wording goes through counsel first.
- A student who is told to use the institution's own channel for an emergency is told so plainly ([RB-11](runbooks/RB-11-emergency-notification.md)).

## 8. Postmortems

Blameless, within five business days of any P0 or P1, or any incident that burned more than 10% of a journey's monthly budget. [The template](POSTMORTEM-TEMPLATE.md) forces four things a casual write-up skips: a timeline from the *measured* record, how it was detected and what would have made that faster, the quiet contributing factors (no backup responder, an alert in state `defined`, an unverified limit, a change inside a freeze), and the **register edits** the incident produced. An action without an owner and a way to show it is done is a wish; actions go to the technical-debt register.

Findings are read against the registers: an incident detected by a student is a finding about the alert register; a runbook that was wrong is edited in the same pull request as the action items.

## 9. Support interface

Support tickets are help requests that route to a person; this pack only asks that an incident be able to be linked to the requests it generated and that a student-facing banner use the status entry's words. Context bundles attach only after the student has seen them and can strike any line; they never contain note text, messages, grades or content. See [SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md](../SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md).
