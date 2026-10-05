> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester incident-notification decision workflow — draft

**Status:** requires qualified human counsel review before adoption. This workflow decides **who decides**, **what must be in front of them**, and **what is recorded**. It does **not** decide whether any notice is legally required, to whom, or by when. Those are counsel's determinations, made per incident from the facts and the customer contract.
**Owner:** Security/Privacy Incident Lead. Counsel and backup are unassigned.
**Related:** [`SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md`](SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md), `docs/trust/INCIDENT-RESPONSE-PLAN.md`, `docs/INCIDENT-RECOVERY-PLAYBOOK.md`, [`LEGAL-HOLD-PROCEDURE-DRAFT.md`](LEGAL-HOLD-PROCEDURE-DRAFT.md).

## Hard rules

1. **No external notification is sent on engineering judgement alone.** Every outbound notice to a customer, user, guardian, regulator, law enforcement, insurer or the public needs a recorded counsel decision (`requires qualified human counsel review`) and an authorised sender.
2. **No numeric deadline is promised or assumed.** Statutory and contractual clocks differ by jurisdiction, data type, role and contract, and some run from discovery, some from confirmation. Counsel states the clock for the incident; the commander records it with its source. Older drafts containing numeric timelines are not commitments.
3. **Containment never waits for the notification decision.** Contain, preserve evidence and recover under the incident plan in parallel.
4. **Contract review is a gate, not an afterthought.** For every affected tenant, the signed order, DPA, security addendum and any student-data addendum are read for notice recipients, content, timing, cost and cooperation before anything is drafted. If no executed paper exists (the current state: none), counsel records that and the public policy stands as the only reference.
5. **Do not copy student content into the incident file.** Use identifiers, counts and categories.
6. Suspected cross-tenant exposure is SEV1 until disproven (existing playbook).

## Roles

| Role | Holder | Does | Does not |
| --- | --- | --- | --- |
| Incident commander | `[NAMED PER INCIDENT]` | Runs containment, keeps the timeline, convenes the notification call | Decide legal duty; send external notice |
| Counsel (internal or external) | `[UNASSIGNED]` | Determines duties, clocks, content approval, privilege handling | Run technical response |
| Privacy lead | `[UNASSIGNED]` | Classifies data, ages, roles, jurisdictions | Approve notice text alone |
| Customer-contract reviewer | `[UNASSIGNED]` | Extracts contractual notice terms per tenant | Waive terms |
| Authorised sender | Founder or delegate listed in the authority matrix | Sends only text counsel approved | Edit approved text |
| Communications | `[UNASSIGNED]` | Drafts plain-language notices and status updates | Characterise cause or scope beyond approved facts |

## Workflow

```
T0 detect/report
  → T1 triage & classify (severity, suspected vs confirmed)
  → T2 PRESERVE: open legal-hold check; evidence snapshot; privilege direction from counsel
  → T3 FACT SHEET (below) completed by commander + privacy lead
  → T4 CONTRACT & LAW REVIEW (counsel + contract reviewer)   ← gate
  → T5 DECISION MEETING: counsel records one outcome per audience
  → T6 DRAFT → counsel approval → authorised sender
  → T7 SEND & LOG (who, when, channel, exact text)
  → T8 FOLLOW-UP updates; re-run T3–T5 whenever facts change
  → T9 CLOSE: post-incident review; update registers; revisit hold
```

T2 runs even if the incident later proves not to be notifiable. T5 repeats whenever scope, cause, data categories or affected population change.

## T3 fact sheet (what must be in front of counsel)

| Field | Content |
| --- | --- |
| Incident id, commander, discovery time, confirmation time | Separate timestamps; both matter to some clocks |
| Status of each fact | `confirmed` / `suspected` / `unknown`; never blended |
| Affected systems, tenants, environments | From the tenant map |
| Data categories involved | Using the T0–T5 classification in `docs/trust/DATA-CLASSIFICATION-STANDARD.md` |
| Was the data readable? | Encryption state; key exposure; whether data was only accessed vs acquired |
| Population | Counts by tenant, by age band (under 13 / 13–17 / adult), by jurisdiction of residence where known |
| Education-record involvement | Yes / no / unknown, per tenant |
| Payment-data involvement | Semester holds card data? (Expected: no — processor holds it; confirm) |
| Guardian / minor involvement | Yes / no / unknown |
| Third parties involved | Providers, sub-processors, AI providers; their own notices received |
| Cause and attacker (if known) | Stated as unknown if unknown |
| Actions taken | Containment, credential rotation, hold applied |
| Law-enforcement contact | Whether requested delay or involved |
| Insurance | Policy exists? notice conditions? (`[UNKNOWN — insurance not yet bound]`) |

## T5 decision record — one row per audience

Counsel records, for each audience, exactly one of: **Notify** / **Do not notify** / **Defer pending facts (state what and re-decision time)** / **Notify voluntarily (business decision, counsel concurring)**.

| Audience | Basis counsel relied on (statute / contract clause / policy) | Clock and its source | Content approved? | Sender | Decision, date, counsel name |
| --- | --- | --- | --- | --- | --- |
| Each affected institution | `[CONTRACT CLAUSE]` | `[COUNSEL STATES]` | | | |
| Affected individuals (students) | `[LAW]` | | | | |
| Guardians of minors | `[LAW]` | | | | |
| State and federal regulators / attorneys general | `[LAW]` | | | | |
| Education-sector regulator, where relevant | `[LAW]` | | | | |
| Payment processor / card brands (only if card data implicated) | `[CONTRACT]` | | | | |
| Law enforcement | `[BUSINESS / LAW]` | | | | |
| Insurer | `[POLICY]` | | | | |
| Sub-processors and upstream vendors (our duties to them) | `[CONTRACT]` | | | | |
| Public status page | `[POLICY]` | | | | |
| Credit-monitoring or remediation offer | `[LAW / BUSINESS]` | | | | |

A "Do not notify" outcome is a decision and is recorded with its reasoning. Silence without a record is a process failure.

## Notice content checklist (counsel to adapt per audience and law)

What happened (confirmed facts only) · when · what data categories · what Semester did · what the recipient can do · contact route · next-update time · no speculation about cause or fault · correction path if a fact changes. Plain language; accessible format; translated where counsel requires.

## Evidence retained

Fact sheet versions, decision record, contract extracts relied on, approved and sent text, delivery logs, counsel instructions (privileged material stored as counsel directs), timeline, post-incident review. Retention follows the legal-hold procedure while any hold is live.

## Exercises required before adoption

1. Tabletop with counsel present, using a synthetic cross-tenant exposure, timed from T0 to T7.
2. Tabletop with a synthetic minor-data scenario.
3. Contract-extraction drill: given a sample DPA, produce the T4 notice terms in under one working session.
4. Confirm authorised-sender list and out-of-hours reachability.

## Open questions for counsel

1. Who is Semester's decision-maker for notice when counsel is unreachable? 2. Which clocks run from discovery vs confirmation in the jurisdictions in J2? 3. Is Semester ever the party that notifies individuals directly, or does the institution? 4. How are privilege and a forensic firm's engagement structured? 5. Is a standing retainer with a breach-response firm advisable? 6. How should the public status policy and this workflow reconcile?
