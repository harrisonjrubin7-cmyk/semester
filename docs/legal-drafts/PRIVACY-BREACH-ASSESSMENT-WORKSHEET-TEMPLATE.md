> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Privacy incident assessment and notification worksheet — template

- **Owner/backup:** `[TBD role]` coordinates; security incident commander and counsel are separate seats
- **Version/effective date:** 0.1, not in effect
- **Approval authority:** qualified counsel plus the authorized company decision-maker
- **Builds on:** `SECURITY.md` ("When data has got out"), `docs/trust/INCIDENT-RESPONSE-PLAN.md`, `docs/trust/SECURITY-INCIDENT-RUNBOOK.md`, `docs/legal-drafts/SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md`.

## Plain-language summary

Security contains and investigates. Privacy assesses *whose personal data* was involved, *what could happen to them*, and *who must or should be told*. Counsel decides whether a legal notification duty exists. Privacy never waits for certainty to start preserving evidence, and never tells anyone "no duty" on its own authority.

`SECURITY.md` commits to emailing affected accounts within 72 hours. That is an operational commitment already made. `SECURITY.md` also says statutory regimes (for example Tenn. Code § 47-18-2107, GDPR) were not checked. **COUNSEL-REQUIRED:** whether 72 hours is appropriate and whether any shorter statutory or contractual clock applies.

## Roles during a privacy incident

| Role | Does | Does not |
| --- | --- | --- |
| Incident commander (security) | Contain, investigate, preserve logs | Decide notification |
| Privacy lead | Run this worksheet, track clocks, draft notices | Give legal conclusions |
| Counsel | Decide duties, approve notices, manage regulator/institution contact | |
| Executive decision-maker | Approve spend, public statements | Override counsel on duty questions |
| Support lead | Handle inbound questions with approved holding text | Speculate on cause or scope |

Name actual holders in the incident record; this template names none.

## Step 0 — Start the clocks (first hour)

Record in the breach log: discovered-at (when anyone at Semester or a vendor first knew), reported-at, reporter, system, and who is incident commander. Discovery time starts every clock; do not back-date. Open a privileged-communications channel at counsel's direction.

## Step 1 — Is personal data involved? (answer within the first day)

| Question | Answer / evidence |
| --- | --- |
| Was personal data accessed, disclosed, altered, lost or made unavailable? (confidentiality / integrity / availability) | |
| Which data sets (use `docs/DATA-INVENTORY-AND-LINEAGE.md`, classification tiers T0–T6)? | |
| How many people, by tenant/institution? Range and confidence | |
| Whose: adults, students, **minors** (under 18 / under 13), guardians, staff, leads/prospects | |
| Education records or institution-controlled data involved? | |
| Student-private productivity content, grades, billing, accommodation, health-adjacent or safety data? | |
| Credentials, tokens or keys exposed? (rotate first, assess after) | |
| Was the data encrypted or otherwise unintelligible to the recipient? | |
| Did a vendor/subprocessor cause or hold the data? (`docs/SUBPROCESSORS.md`) | |
| Was the exposure internal only (employee error) and reversed? | |

## Step 2 — Risk-of-harm scoring

Score each 0–3 and keep the reasoning; counsel reviews. The score informs, never decides, notification.

| Factor | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| Sensitivity | Public/low | Contact data | Academic, financial, behavioral | Credentials, safety, minors' data, accommodation |
| Identifiability | Aggregated | Pseudonymous | Directly identifiable | Identifiable plus linkable (ID, DOB, address) |
| Recipient | Contained, known trusted | Unknown, unlikely misuse | Plausible misuse | Hostile/public |
| Volume | 1–9 | 10–99 | 100–9,999 | 10,000+ |
| Vulnerable people | None | Few | Many | Mostly minors |
| Reversibility | Fully reversed, confirmed | Mostly | Partly | None |

## Step 3 — Notification decision table (counsel fills the "duty" column)

| Audience | Possible trigger | Duty? | Deadline | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Affected individuals | Operational commitment in `SECURITY.md`; `[DECIDE]` any statutory duty | `[DECIDE]` | 72 h operational / `[DECIDE]` | Privacy lead + counsel | Plain language; what to do next |
| Institution customer(s) | Contract/DPA, student-data addendum, FERPA-related duties | `[DECIDE]` | `[DECIDE]` per contract | Counsel + account owner | Use institution's required contact |
| Guardians of minors | Minors' data affected | `[DECIDE]` | `[DECIDE]` | Counsel | Through verified guardian links only |
| Regulators/authorities | `[DECIDE]` state law, federal, EU/UK if offered | `[DECIDE]` | `[DECIDE]` | Counsel | Never contact a regulator without counsel |
| Payment processor / card networks | Payment data involved | `[DECIDE]` | `[DECIDE]` | Finance + counsel | Semester stores no card data by design; verify |
| Vendors/subprocessors | Their data or ours | `[DECIDE]` | per DPA | Security | |
| Insurers | Policy conditions | `[DECIDE]` | per policy | Executive | No policy verified yet |
| Law enforcement | Crime suspected | `[DECIDE]` | | Counsel | `LAW-ENFORCEMENT-REQUEST-PROCEDURE-DRAFT.md` |
| Media/public | Only if counsel and executive approve | `[DECIDE]` | | Executive + counsel | Use status-page policy |

Decision record fields: decision, decider (role), date/time, basis cited by counsel, dissent. Keep in the restricted privacy records store (never the repo); quote only ids and counts elsewhere.

## Step 4 — Notice skeletons (counsel approves before sending)

**Individual notice:** what happened (facts known, no speculation); what data; when; what we did; what you can do (password reset, watch for phishing, how to freeze credit if financial data — only if relevant); what we will do next; how to reach `[contact]`; whether the institution has been told. Avoid: "no evidence of misuse" unless supported; minimizing language; marketing content.

**Institution notice:** the above plus: affected users by tenant, record types, timeline, containment, forensic status, cooperation offered, next update time.

**Holding statement (support):** "We're investigating a possible security issue affecting some accounts. We'll email affected people directly. Please don't share personal details in reply."

## Step 5 — Contain privacy exposure while security works

Suspend the specific export/integration/vendor path; revoke tokens; pause marketing sends and analytics export if implicated; consider kill switch for AI (`docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`); apply a legal hold to relevant logs (`LEGAL-HOLD-PROCEDURE-DRAFT.md`) so deletion sweeps do not destroy evidence; **pause DSR deletions touching affected data** until counsel confirms.

## Step 6 — Linkage with the DSR workflow

| Event | Action |
| --- | --- |
| DSR deadline missed or response sent to the wrong person | Log as a privacy incident candidate; run Step 1 |
| Export or erasure acted on an unverified requester | Treat as unauthorized disclosure; run this worksheet |
| Incident affects people with open DSRs | Tell requesters in the same notice; do not let the DSR and breach messages contradict |
| Notification triggers a wave of requests | Staff the queue; keep the log |

## Step 7 — Close and learn

Root cause; control gap; user remediation; counsel sign-off that notification decisions are recorded; update the inventory/PIA/vendor record; add a defect; retention of the incident file `[DECIDE]`; post-incident review within `[N]` days; tabletop quarterly using this sheet.

## Breach log (one row per incident, even if "no duty")

| Field | Value |
| --- | --- |
| Incident id / discovered-at / contained-at / closed-at | |
| Description and root cause | |
| Data sets, tiers, counts, tenants, minors flag | |
| Risk score and reasoning | |
| Notification decisions per audience, decider, date | |
| Notices sent (date, channel, count) | |
| Vendor involvement | |
| Counsel contact and privilege flag | |
| Follow-ups and owners | |

## Activation blockers

Counsel review of the decision table; named incident roles; at least one tabletop filed and registered as evidence (see the pack's Evidence handling); resolution of the 72-hour commitment question.
