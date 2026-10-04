# Incident response plan

Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

**Status: designed, exercised once on paper, never run live.** This plan sits over the existing trust documents (`docs/trust/INCIDENT-RESPONSE-PLAN.md`, `SECURITY-INCIDENT-RUNBOOK.md`, `docs/INCIDENT-RECOVERY-PLAYBOOK.md`, `SECURITY.md`) and the typed pieces in the tree (`incident-recovery.ts`, `incident-comms.ts`, the kill switches, the status feed). It does three things they do not: it picks one severity scale, it gives each scenario a playbook that names the controls it relies on and what is true of them today, and it ties every playbook to a rehearsal. The [scenario playbooks](INCIDENT-PLAYBOOKS.md) and the [exercise calendar](TABLETOP-CALENDAR.md) are generated from data and held by tests.

**What this plan cannot yet do.** One person, the founder, holds every role, with no rota and no backup. The backup operator, the second reviewer of the AI switch, customer contacts and counsel are unassigned. No alert reaches anyone but the founder, except AI spend. No incident has been closed through the process. Provider logs are kept about a month. Until [TR-12](REMEDIATION-SEQUENCE.md) staffs the seats and [TR-07](REMEDIATION-SEQUENCE.md) routes alerts, this is a plan for what a second person would do, and the founder should read it as the list of what to ask for help with.

## 1. Scale

The code uses SEV1 to SEV4, so this plan does. The crosswalk to the other three scales in use is in the [playbooks](INCIDENT-PLAYBOOKS.md#severity). The first-look times are internal targets: the trust documents record that no acknowledgement or update clock is authorized, and nothing in this plan promises one to a customer. Proposed for decision (TR-06): the founder adopts the crosswalk, and the documents that say otherwise are edited, including the fifteen-minute acknowledgement in `docs/vanderbilt/incident-routing.md`, which no one is staffed to meet.

## 2. Roles

One role per seat, not per person. A single person may hold several today; the plan is written so that no one person *must*.

| Role | Does | Seat | Today |
| --- | --- | --- | --- |
| Incident commander | Declares, sets severity, owns the timeline and the decisions, ends the incident | Per playbook | Founder |
| Technical lead | Contains and recovers | engineering | Founder, acting |
| Security lead | Threat analysis, forensics, evidence | security | **Vacant** |
| Communications lead | Drafts and sends, keeps the update cadence | success or trust | Founder, acting (trust vacant) |
| Customer liaison | The institution contact | champion at the institution | **Vacant** |
| Privacy and counsel | Notification duties, contract terms, what may be said | privacy (outside counsel) | Held |
| Recorder | Keeps the timeline | any | Founder |

Rules: the commander does not also fix; a recorder is named in the first minute even if the same person; a decision that needs counsel waits for counsel and says so in the timeline; no one ends an incident they declared without a second person's read of the closing summary (until a second person exists, the summary waits a day).

## 3. The first fifteen minutes

1. Open an incident record with an ID, the time first known, the source of detection, and the severity.
2. Name the commander, technical lead, recorder, and — if security or privacy may be involved — the security lead and counsel.
3. Write down what is affected: tenants, data classes, systems, and whether an official record, a payment or a minor is in scope.
4. Freeze non-essential deploys and high-risk administrative changes.
5. **Preserve before changing** (section 5): export the audit and function logs for the window; take the database state if a restore may follow.
6. Check the five questions: is there cross-tenant exposure; is an official record or grade altered; is a payment wrong; is a minor affected; is there a safety risk to a person. A yes to any is SEV1 until shown otherwise.
7. Contain with the narrowest lever that stops the damage ([playbook](INCIDENT-PLAYBOOKS.md) names it) and say in the timeline what it stopped and what it cost.
8. Open the communication draft from the right template (section 4) and set the next-update time even if nothing new is known.
9. If law, contract or a regulator may be involved, engage counsel now; do not decide notification yourself (requires qualified human counsel review).
10. Post to the status page if students are affected; the source is the validated incidents file, which needs a merge and a deploy (about three minutes; see the note on posting in section 4).

## 4. Communications

`app/src/lib/governance/incident-comms.ts` composes a message and refuses one that has a missing section, a bracketed placeholder, a hedge phrase (such as *we believe*, *probably*, *out of an abundance of caution*) or a missing required detail. It knows eleven audiences, their approvers and their update intervals. It composes text only: nothing sends it, there is no subscriber list, and no message has ever been recorded as sent (TR-39).

**The seven sections every message carries**, in this order: what happened; who is affected; what is impacted; what to do now; what Semester is doing; the next update; where to get help.

The audiences, their approvers, update intervals and required details are rendered from the composer itself in [the playbooks page](INCIDENT-PLAYBOOKS.md#message-audiences), so they cannot drift from the code.

The intervals are what the composer enforces; they are not a promise to a customer, and where a role is unfilled the interval is the target the filled role would hold. Each approver named is a seat; where the seat is vacant the message waits for the founder and says so in the timeline.

**Templates.** Each is the seven sections with the words below. Replace the bracketed phrases with facts; the composer refuses a message that still has one.

*Student outage*

> **What happened.** Since [time, timezone] [the thing] has not worked.
> **Who is affected.** [Everyone / students at (institution) / users of (feature)].
> **What is impacted.** [What they cannot do, and what still works — saved work is not affected / is affected].
> **What to do now.** [A specific action, or "nothing". If a deadline is affected: contact (named route) and we will confirm to your instructor.]
> **What Semester is doing.** [The action taken and the next step.]
> **Next update.** By [time].
> **Where to get help.** [Support route.]

*Security or privacy* (the approvers in the audiences table must read it first)

> **What happened.** On [date] we found that [plain statement of fact, no hedge]. [What it was: access, change, exposure.]
> **Who is affected.** [Count or group; "we are still determining" is allowed as a fact.]
> **What is impacted.** [Data classes involved.] **Data exposure:** [Not indicated / Suspected / Confirmed / Unknown].
> **What to do now.** [Change a password / review shares / nothing required.]
> **What Semester is doing.** [Contained at (time) by (action); investigation under way; counsel engaged.]
> **Next update.** By [time].
> **Where to get help.** [Route.]

*Integration delay*

> **What happened.** Data from [source system] has not updated since [time].
> **Who is affected.** [Tenants and groups].
> **What is impacted.** [What shows stale and how it is labelled; native features are unaffected.]
> **What to do now.** Use [the official system] for anything time-sensitive.
> **What Semester is doing.** [Cause or "investigating"; what will be reconciled.]
> **Next update.** By [time].
> **Where to get help.** [Route.]

**Not allowed in any message:** a cause not yet established; a promise of a time to resolve that is not a plan; a statement that no data was affected when the evidence is not complete; anything a lawyer has not read when the audience is security or privacy.

**Posting to the status page** means editing `app/public/status-incidents.json` (validated by `incidentProblems()`), merging and waiting for the Pages deploy. There is no subscriber notification. Until TR-39, the commander also sends the message by the institution's contact route directly and records that it did.

## 5. Evidence

Preserve before changing anything that could alter a record, and keep a chain of custody that a lawyer could follow.

1. **Time.** All times in UTC, from the same clock; note any drift.
2. **Capture, read-only.** Export `audit_event`, `console_audit_event`, `support_access_event`, `role_grant_audit_event`, `moderation_audit_event`, `access_log` and the gateway journal for the window, plus Edge Function and auth logs from the provider. Provider logs are kept about a month and `access_log` ninety days: **capture on the first day**, because older material cannot be scoped from records.
3. **Hash and record.** For each export: file name, source, time taken, who took it, SHA-256 of the file. Write the row in the incident record. Do not edit an export; work on a copy.
4. **Store.** In a location with restricted access that does not share a failure mode with the system under investigation. Today there is none: a write-once store with an access log is item TR-43. Until then, a private bucket with a short access list and the hashes in the incident record is the minimum; say in the record that it is the minimum.
5. **Custody.** Every transfer is a row: from, to, when, why. A copy given to counsel is a transfer.
6. **Hold.** An incident that may lead to a claim, a regulator or a student's complaint places a legal hold on the affected scope (`legal_holds`: reason, matter, released by someone else). The hold stops erasure and the retention sweeps. It does not stop the provider's own backup expiry (TR-23), so a hold also exports what the backups would lose.
7. **Do not** repair a record, rotate a log, or run a sweep in the affected scope until steps 2 and 3 are done, unless doing so stops ongoing harm; if it must, record that it did.
8. **Retention.** Incident evidence has no stated retention period today. Counsel sets it; until then it is kept.

## 6. What counsel decides

The commander does not decide, and the plan does not state, any of: whether an event is a reportable breach; whom to notify, when, and by what route; what a contract with an institution requires; whether a student or guardian must be told; whether to contact law enforcement; how to answer a regulator. Each is *requires qualified human counsel review*. The plan's job is to have the facts ready: the timeline, the data classes, the count, the containment time, the evidence list. `SECURITY.md` commits to emailing affected accounts within 72 hours of confirming that rows were readable by someone they do not belong to; that sentence is a commitment the founder made, and the legal clocks beneath it are unverified.

## 7. After

1. **Close.** The commander writes the closing summary in the seven-section shape, a second reader reads it, and the status page is resolved.
2. **Review within five business days** for SEV1 and SEV2, without blame: what detected it, what it took to contain, what we did not know, what the plan got wrong, what we change. Output: items in the [remediation sequence](REMEDIATION-SEQUENCE.md), each with an owner and a guard, and a change to the playbook if it was wrong.
3. **Add the guard.** A regression test, check or alert for the exact failure, named in the review. A review with no guard is reopened at the next one.
4. **Update the register.** The risk register entry, the control register state if a control proved weaker than stated, and the claims register if a public statement is now false.
5. **File.** The incident record, the review and the evidence index under `docs/evidence/operations/`, with the date.

## 8. Rehearsal

Fifteen playbooks, thirteen exercises in the first thirty weeks, each putting the playbook's commander in the room and each producing a dated file ([calendar](TABLETOP-CALENDAR.md)). The first things they will find are the ones this plan cannot do today: a second person, a customer contact, an alert, a restore, a send path. An exercise that finds nothing has probably not been run against the real contact tree and tools.
