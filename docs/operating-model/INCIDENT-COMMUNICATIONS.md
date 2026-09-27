# Incident communications, by audience

[INCIDENT_COMMUNICATION_TEMPLATES.md](../market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md) covers the **phases**
of an incident: initial notice, update, resolution and handoff. This document covers the **audiences**. A student
during an outage needs different words from a CISO during a privacy incident, and each audience has its own approvers
and update cadence.

Source: [`app/src/lib/governance/incident-comms.ts`](../../app/src/lib/governance/incident-comms.ts). `compose()`
refuses to produce a message in any of these cases: a section is missing, a `[BRACKETED]` placeholder is left in,
speculation or legalese appears, or the audience's required line is absent.

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

| Audience | Approvers | Update at least every | Must also say |
| --- | --- | --- | --- |
| Student-facing outage | Incident commander | 1 h | Whom to contact about an affected deadline; never promise an extension |
| Institution admin outage | Incident commander | 1 h | — |
| Integration data delay | Integration owner | 4 h | Source system and last successful sync; stale labels stay visible |
| Security incident | Security owner, Legal | 1 h | Data exposure: not indicated / suspected / confirmed / unknown |
| Privacy incident | Privacy owner, Legal | 1 h | Data classes involved; FERPA notice decided with the institution |
| Accessibility incident | Accessibility lead | 4 h | An accessible alternative route to finish the task now |
| AI quality incident | AI platform lead, AI governance chair | 4 h | Which outputs to distrust; whether the feature is paused |
| Marketplace/sponsor safety incident | Trust & Safety lead, Legal | 4 h | — |
| Community safety incident | Trust & Safety lead | 1 h | The campus crisis contact the institution verified |
| Scheduled maintenance | Operations lead | 24 h | — |
| Feature rollback | Product owner | 24 h | What students see instead; whether their work is affected |

Every audience except scheduled maintenance also notifies the institution's named incident contact.

## Student-facing outage (example)

```text
Subject: Semester — Student-facing outage

What happened
Semester could not load Today between 09:10 and 09:40 CT.

Who is affected
Students at [school] using the web app.

What data or workflow is affected
Today and Plan did not load. No data was lost or exposed.

What you should do now
Check deadlines in Brightspace until the next update.

What Semester is doing
We rolled back the 09:05 release and are watching error rates.

Next update
By 10:30 CT.

Where to get help
help@[domain] or the campus help desk.

If a deadline was affected, contact your instructor. Semester can't grant extensions.
```
