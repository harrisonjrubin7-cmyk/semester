# 05 · Privacy incident coordination

**Status `DESIGNED / NOT TARGET-EXERCISED`. 4 October 2026. Owner: incident commander, Harrison Rubin; backup `UNASSIGNED`.**

> Not legal advice. **Whether an event is a notifiable breach, who must be told, by when, and in what words are [COUNSEL REQUIRED] every time.** This file sequences the work so counsel gets the facts early; it never decides notification. The technical response lives in [`trust/SECURITY-INCIDENT-RUNBOOK.md`](../trust/SECURITY-INCIDENT-RUNBOOK.md) and [`trust/INCIDENT-RESPONSE-PLAN.md`](../trust/INCIDENT-RESPONSE-PLAN.md); customer wording in [`operating-model/INCIDENT-COMMUNICATIONS.md`](../operating-model/INCIDENT-COMMUNICATIONS.md) and `app/src/lib/governance/incident-comms.ts` (`compose()` refuses missing sections and placeholders).

## 0. What this adds

Security plans cover intrusion and outage. A **privacy incident** can happen with no attacker: a misrouted export, a wrong-tenant answer, a restore that resurrects deleted data, a staff query that over-reads, a vendor that reports its own breach. Those cases currently have one sentence in the rights runbook ("misrouted, cross-tenant, or unauthorized access: open the incident workflow"). This file is that workflow.

## 1. Scope: what counts

Any event where personal data was, or may have been, **accessed, disclosed, altered, lost, retained past its rule, or processed outside its purpose** by a person, system or vendor not meant to. Includes: cross-tenant exposure; a guardian or supporter reading beyond scope; a support or break-glass read outside its reason; an export containing another person's data (see 8-C4); an AI response containing another user's data; a vendor-reported incident; a deletion that did not delete (8-C5); a message to the wrong audience; a site-form leak. **When unsure, open it.** An opened event that proves benign costs a log row.

## 2. Roles

| Role | Holder today | Does |
| --- | --- | --- |
| Incident commander (IC) | Harrison Rubin; backup unassigned | Owns the clock and the record; one decision-maker |
| Security lead | same person; vacant seat | Containment, forensics, evidence preservation |
| Privacy lead | vacant seat | Scope of data and people, harm assessment, drafts the counsel brief and the decision log |
| Counsel | **unassigned** (privacy seat is outside counsel per `launchreadiness.ts`; no one has signed) | Decides legal characterisation, notification duties, privilege, regulator and law-enforcement contact **[CR]** |
| Communications | company-side | Sends only what counsel and the IC have approved |
| Institution contact | per tenant, from the agreement | Receives institution notices only after counsel's approval |

**Gap that blocks everything:** with no named counsel and no backup, step 5 below cannot happen. Naming counsel is the single most useful action.

## 3. Sequence

```
 detect → triage (≤ same business day, internal target) → contain → preserve
        → scope + harm assessment → COUNSEL BRIEF → notification decision log
        → notify (only as decided) → remediate → rights-request cross-check → review
```

| Step | Privacy action | Security action |
| --- | --- | --- |
| 1 Detect | Anyone opens a case in the incident register; log source, time, who | Same |
| 2 Triage | Assign severity (§4); decide whether personal data may be involved | Assess ongoing exposure |
| 3 Contain | Stop the disclosure path (revoke grant, pause sweep, disable feature flag, kill-switch AI) | Execute; do not destroy evidence |
| 4 Preserve | **Check legal holds** (`account_is_held()`); suspend any sweep or erasure that would destroy evidence; keep the audit rows (3-year sweep must not purge them) | Snapshot logs |
| 5 Scope | Which people, how many, which tenants, which data classes (T0–T6), minors among them, which vendor; was it **read** or only **exposed**; the audit store that can tell (`audit_event`, `support_access_event`, `family_access_events`, `gateway_audit`, `console_audit_event`) | Forensics |
| 6 Harm | Harm assessment form (§6) | n/a |
| 7 Brief counsel | Send the **facts-only brief**: what, when, who, how many, classes, minors, tenants, vendors, contracts (DPA/pilot terms that set a clock), what is contained | Technical annex |
| 8 Decide | Counsel decides; the IC logs the decision in §7 *including a decision not to notify*, with reasons and the name of who decided | n/a |
| 9 Notify | Only to the audiences counsel approved, using `compose()`; every notice recorded in `governance_incident_notices` (the table exists, but no client code writes to it today) | n/a |
| 10 Remediate | Fix; test; add a regression test; update the register row, retention row or PIA | Fix |
| 11 Rights cross-check | Open requests of affected people are not closed on a stale answer; their export may now be wrong | n/a |
| 12 Review | Blameless review within a period counsel and the IC set; update this file | Same |

## 4. Severity: one scale, mapped

Four taxonomies coexist (`SECURITY.md` Critical–Low with fix-by days of 2/14/60/180; `INCIDENT-RECOVERY-PLAYBOOK` SEV1–4; `trust` runbook P0/P1; the Community runbook's P0/P1). **Proposed single privacy overlay** (the others stay for their purposes):

| Privacy level | Meaning | Example | Maps to |
| --- | --- | --- | --- |
| PX-0 | Confirmed exposure of T3+ data or any minor's data outside its audience, or cross-tenant | Cross-tenant read; export with restriction note | SEV1 / P0 / Critical |
| PX-1 | Likely exposure, or exposure of T2 data to a small, known audience | Wrong-grant support read | SEV2 / P1 / High |
| PX-2 | Control failure, no exposure shown | Deletion that left rows; missed retention sweep | SEV3 / Medium |
| PX-3 | Near miss | Test caught it | SEV4 / Low |

No notification duty is implied by any level; that is counsel's call.

## 5. Notification clock: **blocked, [COUNSEL REQUIRED]**

| Source | What it says |
| --- | --- |
| `SECURITY.md`, `docs/legal/INCIDENT-RESPONSE-SUMMARY-DRAFT.md` | 72 hours, described as a commitment |
| `trust/INCIDENT-RESPONSE-PLAN.md`, `SECURITY-INCIDENT-RUNBOOK.md`, `legal-drafts/SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md`, the DPA draft | No deadline approved; "guaranteed notification clock" is a prohibited claim |
| `trust/PROVIDER-TERMS.md` | Anthropic's published 48 h applies only if its terms are accepted (not signed) |
| Privacy-policy draft §9 | `[DECIDE]` |
| `SECURITY.md` | Names a state statute and the GDPR 72-hour duty "so the question is not forgotten, not because they were checked" |

Until counsel decides: **do not repeat 72 hours (or any number) to anyone outside the company**, and have `SECURITY.md` and the incident-summary draft reconciled (queue P-02). Any clock in an institution contract starts a *contractual* timer that the IC must read at step 7.

## 6. Harm assessment (facts only; counsel interprets)

```
case id:                   assessed by / date:
data elements and class:   (name, email, grades, accommodations, health, financial, location, credentials, minors' data, court-order flags…)
people: count; adults / minors / not-cleared; tenants; institution-held records among them
exposure: accessed by whom (known / unknown / public); duration; read confirmed or possible
data usability: encrypted? pseudonymised? (note: audit pseudonyms are unsalted SHA-256 of a UUID)
containment: done / pending; evidence of deletion by recipient
foreseeable harm to people: identity, safety (e.g. a protective-order record), discrimination, distress, financial, academic
vendors involved:          contract clocks:
```

## 7. Notification decision log (never skip, even for "no")

```
case id / decision date / decided by (name, role; counsel named)
question: is notice required to → individuals / institutions / regulators / vendors' customers / none
basis stated by counsel (reference only; no legal text pasted here):
audience list and the approved wording id (incident-comms compose() output):
time notice sent / by whom / recorded in governance_incident_notices: y/n
decision not to notify: reasons, review date
```

## 8. Special cases

| Case | Handling |
| --- | --- |
| **Vendor-reported incident** | Intake from the vendor's notice channel to the IC the same day; treat as case; ask the vendor for scope, classes, region and timeline; match to the register row (03); your downstream duty runs from the *institution contract*, not the vendor's, **[CR]** |
| **DSR mishandled** (wrong subject, wrong tenant, an export carrying another person's data, a missed clock) | Open a case; stop the request; preserve the audit trail; see 02 §5 |
| **Backup restore resurrects deleted data** | Case PX-2 at minimum; run the `RESTORE.md` replay; if a self-deletion falls in the window it cannot be replayed, and the documented response is to tell every account that existed in the window **[CR]** wording |
| **Law-enforcement or court request** | Not an incident. Route to counsel the same day using [`legal-drafts/LAW-ENFORCEMENT-REQUEST-PROCEDURE-DRAFT.md`](../legal-drafts/LAW-ENFORCEMENT-REQUEST-PROCEDURE-DRAFT.md) and the legal-hold procedure **[CR]** |
| **Safety emergency in Community** | Follow `CRISIS-RESPONSE-RUNBOOK.md`; privacy rules do not delay it; log afterwards |
| **Minor involved** | Always PX-0 or PX-1 for triage; the school contact and counsel are told first **[CR]** |

## 9. Rehearsal

A founder tabletop was held on 3 October 2026 (`docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md`). **No joint security, privacy and counsel exercise has run**, and no counsel exists to join one. Run one when counsel is named, using three scenarios: cross-tenant export, vendor breach notice, and a restore that resurrects a deleted account. File the result under `docs/evidence/` with its register entry.
