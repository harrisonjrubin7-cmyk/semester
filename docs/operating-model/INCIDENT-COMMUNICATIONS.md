# Incident communications, by audience

[INCIDENT_COMMUNICATION_TEMPLATES.md](../market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md) covers the **phases**
of an incident: initial notice, update, resolution and handoff. This document covers the **audiences**. A student
during an outage needs different words from a CISO during a privacy incident, and each audience has its own approvers
and update cadence.

Source: [`app/src/lib/governance/incident-comms.ts`](../../app/src/lib/governance/incident-comms.ts). `compose()`
refuses to produce a message in any of these cases: a section is missing, a `[BRACKETED]` placeholder is left in,
speculation or legalese appears, or one of the audience's required fields is empty or outside its allowed answers.
Every notice sent is recorded in `governance_incident_notices`, which enforces the same rules again. It also refuses a
next-update time beyond the audience's cadence, and a notice that doesn't name every approver its audience requires
(the Approvers column below), because a notice can be recorded by something other than `compose()`. A notice sent to
every school is readable by every school's auditor.

## Every message says these seven things

1. **What happened**
2. **Who is affected**
3. **What data or workflow is affected**
4. **What you should do now**
5. **What Semester is doing**
6. **Next update**: a time, even if nothing will have changed by then
7. **Where to get help**

Avoid legalese, and don't speculate during an active incident. A calm but incomplete notice is worse than a late one,
because readers fill the gap with the worst interpretation.

## Audiences

| Audience | Approvers | Update at least every | Required fields |
| --- | --- | --- | --- |
| Student-facing outage | Incident commander | 1 h | If a deadline was affected, contact (never promise an extension) |
| Institution admin outage | Incident commander | 1 h | — |
| Integration data delay | Integration owner | 4 h | Source system · Last successful sync (stale labels stay visible) |
| Security incident | Security owner, Legal | 1 h | Data exposure: Not indicated / Suspected / Confirmed / Unknown |
| Privacy incident | Privacy owner, Legal | 1 h | Data classes involved · Data exposure (as above); FERPA notice decided with the institution |
| Accessibility incident | Accessibility lead | 4 h | Accessible alternative route |
| AI quality incident | AI platform lead, AI governance chair | 4 h | Outputs to distrust · AI feature paused: Yes / No |
| Marketplace/sponsor safety incident | Trust & Safety lead, Legal | 4 h | — |
| Community safety incident | Trust & Safety lead | 1 h | Campus crisis contact (verified by the institution) |
| Scheduled maintenance | Operations lead | 24 h | — |
| Feature rollback | Product owner | 24 h | What you will see instead · Is your work affected: Yes / No |
| Launch delay | Founder | 7 days | Check not yet complete · Has any account or data changed: Yes / No |
| Change notice | Product owner, Privacy owner, Legal | 30 days | Takes effect · Is your work affected: Yes / No |

A launch delay and a change notice are not incidents. A delay is told as a check not yet complete, never as a promise of a
later date, and its cadence is the weekly steering meeting. A change notice carries every approver every time, so a change
that needs neither privacy nor counsel is a feature rollback or scheduled maintenance instead; its 30 days is the longest
notice period, and a contract that asks for more is a change to that number in `incident-comms.ts` and the migration.

Every audience except scheduled maintenance also notifies the institution's named incident contact.

## Operations-console boundary

The **Release & incidents** workspace shows operational metadata only: affected tenant and workflows, customer-impact wording, owner, lifecycle state, notice cadence and rollback status. It never returns a notice body, recipient, personal detail or security-investigation narrative. Demo incidents are excluded in Production and require explicit inclusion elsewhere.

The workspace can request a release or rollback approval through the `release` duty. A request is not approval, execution or verification. Deployment and rollback happen through the owned external runbook; the operator then records evidence for the exact commit and verifies affected customer workflows before describing recovery. See [`RELEASE-INCIDENT-OPERATOR-RUNBOOK.md`](../RELEASE-INCIDENT-OPERATOR-RUNBOOK.md).

## Student-facing outage (example)

```text
Subject: Semester — Student-facing outage

What happened
Semester could not load Today between 09:10 and 09:40 CT.

Who is affected
Students at the pilot school using the web app.

What data or workflow is affected
Today and Plan did not load. No data was lost or exposed.

What you should do now
Check deadlines in Brightspace until the next update.

What Semester is doing
We rolled back the 09:05 release and are watching error rates.

Next update
By 10:30 CT.

Where to get help
help@semester.example or the campus help desk.

If a deadline was affected, contact
Your instructor. Semester can't grant extensions.
```
