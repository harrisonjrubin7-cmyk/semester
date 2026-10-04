# Support and Trust-and-Safety operating model

| Control | Value |
| --- | --- |
| Status | **CONTROLLED DESIGN — PROPOSED OPERATING MODEL; NOT AN OPERATING SERVICE** |
| Owner | Harrison Rubin — company-side support, trust-and-safety and incident primary; backup operator, independent reviewer, privacy owner and counsel unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` (the tip of main) |
| Supersedes | Nothing. It consolidates and extends the documents in [§12 Source map](#12-source-map) and, where it disagrees with one, says so |
| Legal state | **Draft for qualified review.** Nothing here is legal advice. Every statement about what a law, a school's obligations, or a regulator requires is a question for counsel, and is marked **[COUNSEL]** |

## 0. How to read this document

### 0.1 Purpose

Semester's thesis is that every part of a student's educational life works in it from
day one — natively when necessary, connected when available, governed everywhere, and
supported operationally. "Supported operationally" is the clause this document makes
concrete. Support and Trust-and-Safety (T&S) are the two functions that touch a
student at the worst moment: something is broken, or someone has been hurt. Both
function by reading and acting on private data. So the design question is never
"how do we answer fast" but "how do we answer fast **without** anyone seeing,
changing or keeping more than the case needs, and without the record of what we did
becoming unreliable."

### 0.2 The precedence rule

When two goals conflict, the order is fixed and no queue pressure, SLA clock or
escalation changes it:

1. **Privacy and authorization** — nobody sees or does anything they have not been
   authorized, by the person or the institution, to see or do.
2. **Evidence integrity** — what happened is recorded, tamper-evident and
   preserved before anyone acts on it.
3. **Safety of people** — except that a real, imminent risk to life can justify the
   narrowest disclosure that counsel has pre-approved (§5.3). That is an
   exception with its own controls, not a license.
4. **Resolution quality** — the right answer.
5. **Resolution speed** — and only then, how quickly.

A missed target is reported as a miss. A privacy or integrity shortcut is an incident.

### 0.3 Status vocabulary

Every control below carries one of these, so a reader can tell what exists from what is
asked for. The repository's convention is that a design is not a capability.

| Tag | Meaning |
| --- | --- |
| **BUILT** | The rule is enforced by code, a migration or a check in this repository today. The file is named. It still has no *operational* evidence unless one is cited |
| **SPECIFIED** | This document defines it; nothing enforces it yet. Building it is a named item in [§11](#11-gap-register-and-release-gates) |
| **DECISION** | A choice only the owner (or counsel) can make. This document recommends, and does not decide |
| **[COUNSEL]** | Needs qualified legal review before it is published, relied on or operated |

### 0.4 What this document does not claim

This is the claim ceiling, kept in the same form as the repository's other controlled documents.

**Permitted.** Semester may describe this as its proposed support and T&S operating
model, identify Harrison Rubin as the current accountable company-side primary, and
cite the BUILT controls as repository evidence at the named revision.

**Prohibited until operated evidence exists.** Do not claim staffed support, 24/7
coverage, response or resolution guarantees, an uptime or support SLA, dedicated
success management, an operating moderation workforce, accommodation operation,
customer-approved escalation contacts, completed training or certification,
compliance with any specific law, or that any campus crisis route is monitored.
The proposed objectives in §1.5 are internal targets. They are not promised clocks
([`ON-CALL-AND-ESCALATION-POLICY.md`](engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md)
says the same about severities), and contract language belongs to counsel.

### 0.5 The operating reality this design has to survive

Today one person is the support primary, T&S primary, incident commander and legal
coordinator, and every backup is unassigned
([`SUPPORT-OPERATIONS.md`](commercial/SUPPORT-OPERATIONS.md)). A design that
needs ten people is not a design for this company. Two consequences are built into
what follows:

- **Hats may combine; duties may not.** One person can hold several roles. Nobody can
  hold two sides of the same control (§1.6, *incompatible duties*).
- **Controls that require two different people are off until two exist.** The
  existing break-glass duty needs two distinct approvers. With one staff member
  it cannot be satisfied, and the correct state is *disabled*, not "the founder
  approves their own request." Section 11 makes the second person a release gate.

---

## 1. Support taxonomy, intake, routing, severity, service levels, staffing, escalation

### 1.1 Doors: where a person can ask for help

Semester has several different questions, and mixing the doors is how a harassment
report ends up in a how-to queue. The repository already separates three. This model
adds the rest and makes the rule explicit: **a door never accepts what belongs behind
another.**

| Door | Asks | Who answers | Staff sees identity? | Status |
| --- | --- | --- | --- | --- |
| **Support ticket** | "The app is not working / I need help with Semester" | Semester support (`support_agent`) | **No.** The queue and thread return no account id, name or address | **BUILT** — `supabase/migrations/20260928210000_support_tickets.sql`, `app/src/lib/supporttickets.ts`, `app/src/components/console/SupportQueue.tsx`; off by default (`VITE_SUPPORT_TICKETS`) |
| **Campus help request** | "I need a campus office (financial aid, advising, …)" | A campus office, only where the school set `accepts_requests`; sensitive offices never | Per the school | **BUILT** — `20260927230000_help_requests.sql` |
| **Community report** | "Someone or something in Community is harmful" | T&S professionals; volunteers only for P3 and clear P2 | Reporter never visible to reviewers; identity behind an alias needs a second reviewer | **BUILT** — `app/src/community/moderation.ts`, `20260928032000_community.sql` |
| **Privacy / data-rights request** | "Export, erase, correct or restrict my data" | Privacy owner | Needed to act; verified | **BUILT (record)** — `data_subject_request`, 30-day due date; process in [`DATA-RIGHTS-REQUEST-RUNBOOK.md`](DATA-RIGHTS-REQUEST-RUNBOOK.md) |
| **Safety / crisis** | "I or someone is in danger" | Not a Semester service; the in-product notice routes to emergency and campus services; reports of crisis-adjacent content go to professional T&S | Per case, restricted | **BUILT (notice, routing)** — `app/src/community/crisis.ts`; verbatim notice in [`CRISIS-RESPONSE-RUNBOOK.md`](CRISIS-RESPONSE-RUNBOOK.md) |
| **Security report** | "I found a vulnerability / my account was taken" | Security owner | Needed for account takeover | Process in [`trust/SECURITY-INCIDENT-RUNBOOK.md`](trust/SECURITY-INCIDENT-RUNBOOK.md); intake channel **SPECIFIED** |
| **Institution operator support** | "Our tenant, integration or roster is wrong" | Customer-success / implementation owner | Operator identity and tenant, not student records | Process in [`INSTITUTIONAL-SUPPORT-AND-ESCALATION.md`](institutional-readiness/INSTITUTIONAL-SUPPORT-AND-ESCALATION.md); channel **SPECIFIED** |
| **Marketplace dispute** | "An order or provider went wrong" | Marketplace operations / T&S | Needed to refund or pay out | **SPECIFIED — nothing exists.** No marketplace transaction tables are in `supabase/migrations` at this revision (names searched: market, listing, order, payout, dispute) |
| **Legal / law-enforcement** | A subpoena, preservation request, or regulator contact | Counsel only | n/a | **SPECIFIED** (§10.4) |

**Door rules.**

1. **A ticket is not a report.** If a ticket's text indicates harm to a person (the
   ticket composer shows the crisis notice and a "Report this instead" action before
   sending — **SPECIFIED**), the agent's first reply is the notice and the correct door,
   never a diagnosis and never a promise to "look into the other person."
2. **An emergency is not a ticket.** No queue clock applies to danger. The product says
   so, in words that do not imply monitoring.
3. **Support never decides academic, legal, medical or financial questions**
   (existing rule, `PRODUCTION-SUPPORT-RUNBOOK.md`). It routes them to the institution
   or the named owner.
4. **One case, many doors is allowed; one case, many owners is not.** A report that is
   also a privacy matter gets a *linked* privacy case. The higher severity governs, and
   the primary owner is named at triage (§1.4).

### 1.2 Taxonomy

Two levels. Level 1 decides the owner and the severity floor. Level 2 is a tag that
feeds the knowledge base and product review. The ticket table as built holds a coarse
Level 1 (`account`, `sync`, `bug`, `accessibility`, `privacy`, `how_to`, `other`,
`CATEGORIES` in `supporttickets.ts`); the full set below is **SPECIFIED**. Tickets in
the built categories map up; the remaining Level 1 values arrive through their own
doors, not by widening the ticket form.

| Level 1 | Typical Level 2 tags | Owner | Severity floor |
| --- | --- | --- | --- |
| **Account & access** | sign-in, MFA/passkey recovery, SSO/SCIM mismatch, merged or duplicate account, locked account | Support T1 → Security | P2 (takeover suspected → P0) |
| **Sync & data** | not synced, offline conflict, missing or stale imported data, wrong source label | Support T1 → Engineering | P2 (data loss or wrong data shown → P1) |
| **Product defect** | wrong behavior, crash, performance, regression | Support T1 → Engineering | P3 (core workflow down → P1) |
| **Accessibility** | blocked task for an assistive-technology user, missing alternative, accommodation workflow | Accessibility lead | **P1 floor** when a core task is blocked |
| **Privacy & data rights** | export, erase, correct, restrict, "someone saw my data", consent question | Privacy owner | P2 (exposure → P0) |
| **Billing & payments** | charge, refund, plan, failed payment, dunning | Finance owner | P2 (double charge, fraud → P1) |
| **Institution / operator** | roster, integration, role, tenant configuration, offboarding | Customer-success owner | P2 (cross-tenant risk → P0) |
| **Academic integrity** | answer-key posting, AI-use policy, disputed integrity flag | T&S + institution | P2 (§5.1) |
| **Harassment & abuse** | harassment, stalking, hate, threats, nonconsensual media | T&S professional | P1–P0 (§5.2) |
| **Safety & wellbeing** | self-harm concern, threat to others, welfare check request | T&S professional + institution route | P1–P0 (§5.3) |
| **Fraud & scam** | account takeover, payment fraud, phishing, fake listings | T&S + Security + Finance | P2–P1 (§5.4) |
| **Marketplace** | order dispute, provider conduct, listing violation, payout | Marketplace ops + T&S | P2 (safety → P1) (§5.5) |
| **Impersonation** | of a student, an office, an official, Semester staff | T&S | P2 (serious → P1) (§5.6) |
| **Legal & law-enforcement** | subpoena, preservation, DMCA, regulator, press | Counsel | Set by counsel |
| **How-to / feedback** | usage question, feature request, content correction | Support T1 / KB | P3 |

### 1.3 Intake flows

Every flow follows the same four rules before it adds anything of its own:

- **Minimum necessary.** Ask for the least that lets someone act. Never ask for a
  password, token, code, screenshot of a record, or a sensitive attribute
  (existing rule, `PRODUCTION-SUPPORT-RUNBOOK.md`).
- **Nothing pre-ticked.** Any app context is opt-in and previewed. As built, the ticket
  panel offers six keys (version, device class, screen name, signed-in, sync state,
  offline), all unticked, each shown with its value before sending
  (`private.support_context_ok`, a check constraint — **BUILT**).
- **A receipt the person can read.** Every intake ends with what happens next, who
  owns it, and when the next update is expected — in words, in text, in an accessible
  form.
- **An accessible alternative.** Every channel has a non-visual, non-timed route and
  a human-readable alternative; no flow depends on a CAPTCHA, a hover or a time limit.

**Flow A — Support ticket (BUILT).**

```
Help → "Contact Semester support"
  → pick category (7) → write subject/body
  → composer shows crisis notice + "Report this instead" if harm language          [SPECIFIED]
  → optional: tick app-context keys, each previewed with its value
  → submit: ≤ 5 per account per day; priority computed in SQL from category;
            first_response_due = now() + 24h (accessibility, privacy) or 72h (others)
  → receipt: ticket id, owner role, due time, "you close it, we cannot"          [receipt contents SPECIFIED]
  → staff see identity-free queue; reply; student gets a generic email hint
    (no body, no address returned to the browser; support-reply-notify)
  → only the student can set status = closed
```

**Flow B — Community report (BUILT).** From any post, profile or message: choose
category (the community guidelines offer Block, Mute and Leave alongside Report) → optional details → the
verbatim emergency notice is shown on the form → `openCase` writes a frozen audit
event → triage sets provisional severity and the minimum reversible protection → a
qualified human queue. The reporter is never shown to reviewers and cannot see
whether a report was set aside as brigading ([`CAMPUS-MODERATION-SOP.md`](CAMPUS-MODERATION-SOP.md)).

**Flow C — Data-rights request (BUILT record; process in the runbook).** Raised by
the person about themselves only; recorded before the file is produced, so the export
contains the record of its own making; due date thirty days; the person cannot answer,
verify, extend or delete it.

**Flow D — Security / account-takeover report (SPECIFIED).** A form reachable
signed-out. It asks for the contact route, what was seen and when. It never asks for
the old password. It starts the identity ladder in §3.6 and, if takeover is plausible,
opens a P0 and puts a hold on the account's outbound messages and payments.

**Flow E — Institution operator ticket (SPECIFIED).** Authenticated through the
tenant's SSO. Records tenant, role, integration or roster, impact and cohort size. It
sees tenant configuration, never student records, unless the tenant's own approval
route (not Semester support) grants it.

**Flow F — Marketplace dispute (SPECIFIED).** Raised by either party from the order.
Records order, claim type, evidence, desired remedy; starts the clock in §5.5; opens a
linked safety report if a safety category is selected. Held payout or refund is a
Finance action, never a support action.

**Flow G — Law-enforcement and legal intake (SPECIFIED).** One monitored address. No
staff member responds substantively; the first response is a fixed acknowledgement
and the matter enters the counsel queue (§10.4). Frontline staff are trained to
refuse to confirm that an account exists.

### 1.4 Routing

Routing is decided by data, so it can be audited and so two agents route the same
case the same way. Rules apply top-down; the first that matches wins, and the highest
severity always wins over a lower-severity rule.

| # | Condition | Route | Notes |
| --- | --- | --- | --- |
| 1 | Report mentions danger to life, or a detector marks imminent harm | T&S professional on duty → §5.3, crisis notice | Never volunteers, never support T1 |
| 2 | Any minor involved, nonconsensual media, doxxing, stalking | T&S professional, urgent; temporary hold applied | Existing P0 triggers ([`CAMPUS-MODERATION-SOP.md`](CAMPUS-MODERATION-SOP.md)) |
| 3 | Cross-tenant data visible, credential exposure, takeover | Incident commander + Security | Incident process |
| 4 | Accessibility category, or any ticket that says an AT user is blocked | Accessibility lead; support does **not** close without their sign-off | 24h first-response (built) |
| 5 | Privacy category, "someone saw my data", staff-access complaint | Privacy owner | A complaint about support access is investigated by someone who is **not** the accused agent's manager |
| 6 | Legal, law-enforcement, press, regulator | Counsel queue | |
| 7 | Billing / payment fraud | Finance owner; Security if takeover | |
| 8 | Marketplace | Marketplace operations; T&S if safety tag | |
| 9 | Academic deadline or official-record ambiguity | Support replies with the institution's route; no academic advice | |
| 10 | Everything else | Support T1 queue, ordered `priority desc, first_response_due` | As built |

**Auto-routing signals** are suggestions to a human, never a verdict: a detector hit is
a `possible_concern`, "never treated as a diagnosis or an enforcement reason"
(`CRISIS-RESPONSE-RUNBOOK.md`). **Repeat-handling:** a case reopened or a matching issue
fingerprint within seven days routes one tier up for review (§7.4).

### 1.5 Severity matrix

The severities are the repository's canonical ones — one scale for support, T&S and
incidents, so a ticket and an incident do not argue about whether something is a P1.
They are **internal classifications by harm**, not promised clocks.

| Sev | Definition (canonical) | Examples across the doors | Declares incident? |
| --- | --- | --- | --- |
| **P0** | Active exposure, cross-tenant access, destructive integrity loss, or immediate safety or rights harm | Doxxing; nonconsensual media; imminent-harm report; cross-tenant record shown; support-access abuse in progress; account takeover with funds or messages leaving | **Yes** |
| **P1** | Core workflow unavailable, major accessibility barrier, or serious integrity or reliability risk — even if a workaround exists | Threat; stalking or severe harassment; hate; credible scam; sign-in down for a cohort; AT user blocked from a core task; wrong grades or deadlines shown | Yes, if cohort-wide or unsafe workaround |
| **P2** | Other material impairment | Harassment (non-severe); impersonation (non-serious); academic-integrity report; sync gaps; billing error | No, unless repeated |
| **P3** | Question or minor issue | How-to; cosmetic; feedback; low-risk spam | No |

**Harm modifiers** raise the floor by one level, and are never used to lower it:
a minor is involved; the subject is a staff member of the institution; a deadline
within 24 hours is affected; accessibility is affected; the case concerns data in the
`restricted` classification; more than one student reports the same thing.

**Proposed internal objectives.** These are the targets the staffing model in §1.6 is
sized against. They are measured from the moment a case is *opened*, within the
staffed or on-call hours that will be published, and are **DECISION**-gated before any
external statement. The two numbers already built are marked.

| Sev | Acknowledge | First substantive action | Updates while open | Contain / mitigate | Close or hand off |
| --- | --- | --- | --- | --- | --- |
| P0 | 15 min | Containment started ≤ 1 h; automated hold is immediate at detector confidence ≥ 0.9 (**BUILT**) | Every 1 h (matches incident comms) | ≤ 4 h | ≤ 5 business days, with root cause linked |
| P1 | 1 h | ≤ 4 h | Every 4 h or at least daily | ≤ 1 business day | ≤ 10 business days |
| P2 | 1 business day | **24 h for accessibility and privacy tickets; 72 h for others (BUILT)** | On change, and weekly | ≤ 5 business days | ≤ 15 business days |
| P3 | 2 business days | ≤ 5 business days | On change | n/a | ≤ 20 business days |

Four rules keep these honest:

1. **State the clock.** As built, `first_response_due` is wall-clock
   (`now() + make_interval(hours => …)`), so a ticket opened Friday evening is overdue by
   Sunday regardless of staffed hours. Publishing "24 hours" while staffing five days a
   week would be an unmet promise. **DECISION:** either keep wall-clock (and staff to
   it) or add a staffed-hours calendar to the due-time function.
2. **Pause only for the person.** A timer pauses only in *waiting on student/institution*,
   never for internal handoffs, and resumes on any reply.
3. **Out-of-hours behavior is specified, not implied.** Outside staffed hours, P0/P1
   intake shows the emergency notice, the institution's verified crisis contact, and an
   honest statement of when a human will next look. It never says "we are monitoring."
4. **SLO-5 is currently `UNPROBED`** ([`SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md`](SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md)):
   the `overdue` flag exists and nothing reads it. It becomes `PROBED` when an owner
   reads it weekly, and `MEASURED` only when the history is filed under `docs/evidence/`.

### 1.6 Staffing model

**Functions, not people.** Each function has a named primary and a named backup who
is a different human. A function with no backup is **at risk** and is shown on the
readiness board; it is not "covered."

| Function | Scope | Tier | Today |
| --- | --- | --- | --- |
| Self-service / KB | Articles, in-product help, status page | T0 | Specified (§2) |
| Support agent | Ticket queue, macros, consented context | T1 | Harrison Rubin, no backup |
| Support specialist | Complex account, sync, billing; grant-based views (§3) | T2 | Unassigned |
| Accessibility lead | Accessibility tickets, accommodations route | Domain | Unassigned |
| Privacy owner | Data rights, staff-access complaints, privacy incidents | Domain | Unassigned |
| Security owner | Takeover, vulnerability reports, access reviews | Domain | Unassigned |
| T&S professional | Reports, evidence, decisions, notices | Professional | Unassigned (support primary cannot be the only reviewer of their own decisions) |
| Senior T&S reviewer | P0 restrictions, appeals oversight, escalations, volunteer program | Senior | Unassigned |
| Volunteer reviewer | P3 and clear P2 only, blind, calibrated | Volunteer | Off; flag refuses `production` |
| Incident commander | Declares and runs incidents; owns status page | Command | Harrison Rubin, no backup |
| QA reviewer | Samples cases independent of the handler | Assurance | Unassigned |
| Counsel | Legal queue, holds, law-enforcement | External | Unassigned |

**Incompatible duties.** The same person must not hold both sides of any pair below
for the same case or grant. These are enforced by the permission model (§6) where a
table can enforce them, and by the QA reviewer where it cannot.

| Pair | Why |
| --- | --- |
| Requester ↔ approver of an access grant | Self-approval defeats the control; refused server-side today (`decide_approval`) |
| Support agent who used access ↔ reviewer of that access | Review exists to catch the user |
| Decider ↔ appeal decider on a case | Built: "a reviewer who decided the case may not decide its appeal" |
| Reporter or subject ↔ reviewer of the case | Recusal; built for volunteers (own reports, communities they lead, block relationships); extended to staff |
| Handler ↔ QA scorer of the same case | Independence |
| Staff member ↔ lookup of own, family, friend or ex account | Conflict of interest; declare and reassign |
| Evidence collector ↔ sole custodian of the evidence | Chain of custody needs a second reader |

**Capacity, as a method.** The staffing plan is computed, not guessed. The inputs below
are measured from the first cohort and replace every illustrative figure:

```
Required FTE  =  Σ over categories ( contacts per month  ×  mean handle minutes )
                 ───────────────────────────────────────────────────────────────
                 productive minutes per FTE per month  ×  target occupancy
```

- **Contacts per month** = active students × contact rate. The contact rate is unknown
  until a cohort exists; the pilot's first job is to measure it by category.
- **Handle minutes** differ by an order of magnitude: a how-to is minutes; a T&S P1 with
  evidence review is hours. Never use a blended mean.
- **Occupancy** target is **≤ 70 %** for T1 (queues degrade fast above it) and **≤ 40 %**
  for T&S professionals, whose work includes review time, recusal, appeals, calibration
  and recovery from exposure. Floor the staffing at **two named people per function** regardless of what the formula says.
- **Surge.** A semester has predictable peaks (registration, add/drop, first and final
  weeks). Plan the peak month, not the mean, and publish the surge plan: macros, KB
  banners, a status notice, and borrowed capacity.

**Phases.** Each phase has an exit gate; phases are ordered by what must be true, not by date.

| Phase | Shape | Minimum named people | Exit gate |
| --- | --- | --- | --- |
| **A — Founder pilot** | One institution or individual cohort; tickets off or limited | Support primary + backup; T&S professional distinct from support; counsel on retainer; one independent reviewer | Backup completed a supervised week; one tabletop in §8; privacy owner assigned |
| **B — First institution** | Staffed hours published; institution contacts verified | + Accessibility lead, privacy owner, senior reviewer, incident commander backup | Alert-to-ticket-to-incident exercise; first QA cycle; access review done once |
| **C — Multi-institution** | Regional hours, named on-call | + Rotation of ≥ 3 for P0/P1; QA reviewer separate from the team | Measured SLO history filed; counsel-approved law-enforcement handling |
| **D — 24/7 for safety only** | Safety triage covered round the clock, directly or through a counsel-approved partner | + Safety rota or vendor with a signed boundary | Drill passed; the partner never receives more than the escalation payload allows |

Not all of this needs employees. A vendor or partner may supply capacity for T1
or after-hours safety triage **only if** the access, redaction and prohibited-action rules in §3 bind the vendor's staff identically, the
vendor is a listed subprocessor, and contract terms are counsel-approved **[COUNSEL]**.

### 1.7 Escalation paths

```
                       student / reporter / operator
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
             Support T1 (queue)             T&S report intake
                    │                             │
        ┌───────────┤ out of scope                ├── volunteers: P3 / clear P2 only,
        │           ▼                             │   two agree to remove, else ↑
        │     Support T2 specialist               ▼
        │           │                      T&S professional ──► Senior reviewer
        │           │                             │                  │ (P0 restriction,
        │           ▼                             │                  │  appeal oversight)
        │   Domain owner: Accessibility /         │                  ▼
        │   Privacy / Security / Finance /        │         Institution escalation
        │   Customer success                      │         (two different professionals,
        │           │                             │          agreement on file, minimum
        │           ▼                             │          payload, default OFF)
        └──► Incident commander ◄─────────────────┘
                    │
        ┌───────────┼───────────────────┐
        ▼           ▼                   ▼
     Counsel    Institution contact   Status page / comms
     (legal     (verified, per        (approvers per audience,
      queue,     agreement)            §8)
      holds,
      law enforcement,
      regulators)
```

**Triggers that must escalate** (each is a table row in the on-call policy, restated here so support agents have them in one place):

| Trigger | Escalate to | Within |
| --- | --- | --- |
| P0 at any door | Incident commander and the domain owner | Immediately; acknowledge ≤ 15 min |
| P1 with repeated cohort impact, unsafe workaround, data loss, or a monitoring blind spot | Incident commander | ≤ 1 h |
| A missed update or an unowned case | Domain owner, then incident commander | At the missed time |
| Any claim that staff misused access | Privacy owner (**not** the accused's manager) | Same business day; access suspended pending review |
| A request from law enforcement, a regulator or press | Counsel | Same business day; no substantive reply by staff |
| Possible reportable event to an institution, regulator or authority | Counsel decides, never staff | Immediately on suspicion |
| Reviewer exposure to severe content | Wellbeing route (§9.5) | Same shift |

**Handoff standard.** A handoff is a written case note: what is known, what is not, what was
promised to the person, what was *not* done and why, what evidence exists and where,
the next update time and owner. A case with no next-update time is not handed off.
Escalation never removes the first handler's duty to tell the person who owns the case now.

---

## 2. Knowledge base: structure and article templates

The strategy already exists ([`KNOWLEDGE-BASE-STRATEGY.md`](commercial/KNOWLEDGE-BASE-STRATEGY.md)): content model, lifecycle,
launch set. This section adds the part it leaves open — the collection structure,
the templates, the review cadence by risk, and the rules that stop the knowledge
base from becoming an unsupported claim.

### 2.1 Collections and access

| Collection | Audience | Access | Examples |
| --- | --- | --- | --- |
| **Public help** | Anyone | Open, indexed | First win, account and sync, offline and recovery, accessibility, privacy controls, export and delete, known limitations |
| **Signed-in contextual help** | Students, faculty, family | Signed-in; surfaced from the screen the person is on | "Why am I seeing this?", source and freshness labels, notification controls |
| **Safety and rights** | Anyone | Open, never gated, never behind a login or a wait | How to report, Block/Mute/Leave, what happens after a report, appeals, the emergency notice, campus resources |
| **Operator and implementer** | Institution operators | Tenant SSO | Roster and integration setup, role matrix, offboarding, escalation contacts |
| **Internal playbooks** | Staff | Capability-gated; version-controlled | Macros, routing, the six playbooks in §5, JIT access procedure |
| **Internal restricted** | Named roles only | Named grant; reads logged | Detector rule rationale (reviewers only — publishing patterns publishes the way round them), law-enforcement procedure, evidence handling for restricted classes |
| **Known-issues and status** | Anyone | Open | Current incidents, workarounds that are *verified safe*, resolved history |

**Never in the public collections:** detector patterns and thresholds, reviewer names,
individual case outcomes, anything that tells an attacker which of two paths a
report takes, and any workaround that has not been verified safe for data.

### 2.2 Article templates

All templates extend the content model already in the strategy. Common header
(every article): stable ID and slug; title; audience and role; task or outcome;
owner **and backup**; product, environment and version; source and evidence links;
data and authority boundary; created, reviewed and **expiry** date; approver; status
(`draft`, `in review`, `published`, `withdrawn`, `expired`); accessibility note;
related content.

**Template 1 — How-to**

```
Title:        <Verb + object, as the person would say it>
Before you start:   prerequisites, role, supported version; "this is not available if…"
Steps:        numbered; one action per step; real text, no image-only steps
You should see:     the expected result, described in words
If it did not work: the 2–3 known failure causes, each with a recovery step
Still stuck:        the correct door (§1.1) — ticket, campus office, report, institution
Privacy note:       what not to paste or screenshot
Alternative path:   keyboard-only / screen-reader / non-visual route
```

**Template 2 — Troubleshooting (symptom-first)**

```
Symptom:      what the person sees, in their words, plus the visible error text
Scope check:  who is affected (one person / one device / one tenant / everyone)
Safe checks:  self-service steps that cannot lose data
Do not:       actions that can lose or expose data, stated explicitly
What to send support:  only the six consented context keys; never credentials
Escalate if:  conditions that make it P1 or P0
Fingerprint:  article id used to tag the ticket (feeds repeat-contact metric §7.4)
```

**Template 3 — Policy explainer (rights, rules, enforcement)**

```
What the rule is, in two sentences
Why it exists
What it does not mean            (limits and non-claims)
What the person can do           (report, appeal, export, delete, ask an institution)
What Semester will and will not do
Who decides                      (Semester professional / institution / counsel)
Evidence and review              how a decision is reviewed and appealed
Source of authority              policy version and effective date
```

**Template 4 — Safety and crisis resource page** (written with the institution; counsel reviews)

```
Immediate danger:   the verbatim emergency notice (not paraphrased)
Campus crisis contact:   verified by the institution, with the verification date
Other resources:         only those the institution or a clinical advisor approved   [COUNSEL]
What Semester is not:    not an emergency service; not monitored for emergencies
If you are worried about someone else:   how to report, and what happens
What you will not be asked: nothing here asks for a diagnosis or a record
Tone rules:         plain, calm, no minimizing, no promises of outcomes
```

**Template 5 — Known issue / status entry**

```
Issue:        symptom, first seen, who is affected
Workaround:   only if verified safe; the verification and verifier recorded
Status:       investigating | identified | mitigating | resolved
Next update:  a time, always (§8)
Linked:       incident, problem record, release note
Withdrawal:   how and when this article is retired
```

**Template 6 — Internal playbook / macro**

```
When to use / when NOT to use
Required identity or consent steps before acting
The text, with [BRACKETS] that block sending until filled   (same guard as incident-comms compose())
Forbidden phrases: promises, diagnoses, legal conclusions, "we are monitoring"
Evidence to attach to the case
Escalation condition
Owner, backup, last review, expiry
```

### 2.3 Review cadence by risk

| Risk tier | Content | Reviewed by | Cadence |
| --- | --- | --- | --- |
| **High** | Safety and crisis pages, privacy and data-rights, security, billing and refunds, integrity policy, law-enforcement procedure, any macro that promises something | Domain owner + counsel where **[COUNSEL]** + accessibility lead | Before publish; every 90 days; on any policy change |
| **Medium** | Account, sync, integration, accessibility how-tos, known issues | Domain owner | Every 180 days; on any release that touches the feature |
| **Low** | Cosmetic how-to, feature tour | Editor | Every 365 days |

**Withdrawal.** Unsafe or incorrect guidance is withdrawn first and explained second:
the article is replaced by a visible "withdrawn" notice (not silently deleted), support
is told, any person who followed it is contacted through the right door, and the
withdrawal is reviewed as an incident if data or safety was affected.

### 2.4 Rules that keep the knowledge base honest

1. **Coverage is validated tasks and failure states, not article count.** A launch article is
   counted only after a representative person completed the task from it, including one
   who uses assistive technology.
2. **Capability labels are exact:** *available now*, *configured by your school*,
   *proposed*, *unavailable*. An article may not describe a proposed capability as available
   (the public-claims register governs).
3. **Never deflect the three protected categories.** Accessibility, privacy and safety
   requests always offer a human route, always on the first screen, regardless of any
   deflection target.
4. **Failed searches are data.** A search with no click and no ticket is a content gap;
   a search followed by a ticket tagged with the same article is a defective article.
5. **No coercive helpfulness prompts.** "Was this helpful?" is optional, anonymous and
   never shown on safety articles.
6. **Translations are separate documents** with their own owner and expiry; an unreviewed
   translation of a High-risk article is not published.


---

## 3. Support-access policy

This is the policy that decides whether a support agent can ever see a student's
data. It exists because convenience is the usual way privacy is lost: the agent who
"just looks" to save the student a message. **The default is that support cannot look.**
The design makes looking an exception that the *student* (or, for restricted
data, two other people) has to open, that expires on its own, that shows on the
student's screen while it is open, and that leaves a record nobody on the support
team can edit.

### 3.1 Principles

1. **Most support needs no student data.** The built ticket queue returns no account
   id, name or address. Design new tooling to keep it that way before adding any read path.
2. **Consent is per grant, specific and revocable.** Acceptance of the terms of service
   is not consent to a staff member viewing a record.
3. **Containment does not require reading.** Suspend, sign out, revoke sessions, hold
   payments, hide a post: all are actions on an account or an object, taken without
   opening content. Prefer them.
4. **Time-boxed by construction.** A grant cannot be created without an expiry, and the
   table refuses a long one. Nothing renews itself.
5. **Least scope, read-only first.** The smallest field set that answers the question;
   write access is a separate, rarer grant.
6. **Purpose-bound.** A support grant is for support. It is not evidence for moderation,
   a performance review, or a favor to an institution. Using it for another purpose is a
   prohibited action (§3.9) even if the data is already on screen.
7. **No one approves their own access, and no one reviews their own use of it.**
8. **The record is written first.** If the audit event cannot be written, the access does
   not happen (fail-closed). A caught audit failure is an unaudited access.

### 3.2 Access tiers

The data classes and their `support` control already exist in
`app/src/lib/ops/console.ts` (`CONTROLS`): `public` and `internal` — open;
`student-private` and `education-record` — the student's **grant**; `restricted` — a
**named grant**; `credential` — **never**. The tiers below add the operating procedure that sits on top of those controls.

| Tier | What it allows | Who opens it | Max duration | Status |
| --- | --- | --- | --- | --- |
| **A0 — Open** | Knowledge base, status, aggregate dashboards (cells under the threshold suppressed; proposal 10) | Nobody; role capability | Standing | Knowledge base and status **BUILT**; aggregate dashboards and the suppression rule **SPECIFIED** (the 10-cell threshold is a proposal in `SUPPORT-OPERATIONS.md`) |
| **A1 — Ticket-scoped** | The identity-free ticket, its thread, and up to six context keys the student ticked | The student, by sending the ticket | Life of the ticket | **BUILT** — `support_ticket_queue`, `private.support_context_ok` |
| **A2 — Student-granted view** | A read-only, field-limited view of the student's own records for one ticket, shown with a banner to the student while open | The student, per grant, from the ticket | Default 30 min; max 4 h; no extension — a new grant is a new consent | The duty `support-access` is **registered** (`console.ts`, "The student's grant is the approval, and it expires"). The `support_access_grant` table as built serves only a *verified supporter* (tutor, mentor, family) and one aggregate scope, `learning-progress`, capped at 7 days. A *staff* session table is **SPECIFIED** |
| **A3 — Restricted named grant** | `restricted` class (accommodations, safety material, audit records): a named, minimal, logged read | Two approvers who are not the requester; privacy owner notified | ≤ 4 h; no extension | Break-glass is **BUILT** (below); a per-record restricted read is **SPECIFIED** |
| **A4 — Credential** | Nothing. Keys, tokens, passwords and codes are never displayed, only rotated | — | — | **BUILT** as a classification |

**Break-glass as built** (`20260929110000_console_approvals_and_break_glass.sql`). Opened
only by `console_act` on the two-person `break-glass` duty; the request must carry
evidence and a ticket reference; self-approval is refused server-side and two *distinct*
approvers are required; the grant expires within four hours; it is closed by its subject
and reviewed by someone else; and **an unreviewed overdue grant blocks the next one.**
It "widens who, never what": the scope is exactly what the approvers approved.
Every break-glass grant also writes a row to `human_overrides`.

**Stand-down.** With one staff member, A3 cannot operate and is therefore off (§0.5).

**Separate from staff access:** a student's own grant to a tutor, mentor or family
member is the student's choice and is governed by the supporter model
([`SUPPORTER-FAMILY-PRIVACY-MODEL.md`](SUPPORTER-FAMILY-PRIVACY-MODEL.md)). Do not merge the two in tooling or in the audit.

### 3.3 What a valid grant is

A grant is valid only if all of the following are true at the moment of every read. The check is made on each read, not once at creation.

| Element | Requirement |
| --- | --- |
| **Who** | The requester is shown to the student by role and a stable pseudonymous staff id — not a name that can be socially engineered, not nothing |
| **What** | The exact scope from the catalog (§3.5), listed in plain words, with what it does *not* include |
| **Why** | A ticket id and a reason in the student's own ticket; the grant is bound to that ticket |
| **How long** | The expiry is shown as a time, and a countdown banner remains visible to the student |
| **Control** | The student can revoke at any time, and revocation is effective on the next read |
| **No bundling** | The consent request is a single screen with one decision; it is not combined with a feature, a terms update or a survey |
| **Capacity** | The student is signed in and able to decide. A person in apparent distress is not asked to approve anything; use the safety door |
| **Institutional layer** | For `education-record` data the institution's authority may also be required, depending on how it designated Semester. Whether and when a student's grant alone suffices is a **[COUNSEL]** determination, set per tenant, and the tenant can turn staff access off entirely |
| **Minors** | Age-aware policy applies; a guardian's role, where it exists, is set by the family model and counsel, not by the agent **[COUNSEL]** |

### 3.4 Just-in-time elevation protocol

```
  Ticket open (A1)  ──►  Agent decides a read is necessary
                              │  (and writes why, in the ticket)
                              ▼
                1. ELIGIBILITY  (automatic, refuses if any fails)
                   • certification current for this tier (§9)
                   • on duty (seat/role), not suspended
                   • not the subject; no declared conflict
                   • fresh MFA / passkey ≤ 15 min old
                   • no unreviewed overdue grant of their own
                              ▼
                2. CONSENT  (A2: the student · A3: two approvers ≠ requester)
                   student sees: who · what · why · how long · [Approve] [Decline]
                              ▼
                3. ISSUE  — time-boxed, bound to ticket+tenant+scope+session+device
                   audit event written FIRST (fail-closed)
                              ▼
                4. USE  — read-only, masked by default, banner shown to student,
                   every reveal and read is an event; export/copy/screenshot disabled
                              ▼
                5. END  — expiry, student revoke, or agent "done" (whichever first)
                   student gets a plain-language summary of what was read
                              ▼
                6. REVIEW  — a person who was not the user, ≤ 2 business days
                   (proposal); overdue-unreviewed blocks the next grant
                              ▼
                7. RETAIN  — event record kept per §10; content never copied
```

Parameters that are **DECISION**-gated before first use:

| Parameter | Proposal | Reason |
| --- | --- | --- |
| A2 default / max | 30 min / 4 h | Long enough for one diagnosis, short enough that "forgot to close it" is bounded |
| Fresh-MFA window | 15 min | Matches the step-up pattern already in the console control plane |
| Review deadline | 2 business days | The built break-glass rule already blocks the next grant when a review is overdue |
| Reveal-on-demand | One reason per reveal, per field class | Makes casual curiosity cost something |
| Concurrent grants per agent | 1 | Stops one session becoming a browsing habit |
| Per-agent daily grant cap | Set from the pilot's measured median plus margin | An outlier is an anomaly alert (§3.8), not a hard stop |

### 3.5 Scope catalog

A scope is the unit of consent. New scopes are added only by a reviewed change that
names what the scope reads and what it never reads. Every scope also states its data class.

| Scope id | Shows | Never shows | Class | Status |
| --- | --- | --- | --- | --- |
| `account-state` | Account status, sign-in methods enrolled (not secrets), sync status, app version, device class | Passwords, tokens, recovery codes, contents | student-private | **SPECIFIED** |
| `sync-diagnostics` | Last sync times, error codes, conflict counts, a row-count per table | Row contents | student-private | **SPECIFIED** |
| `learning-progress` | Aggregate evidence count, average score, mistake count, last observed — per course | Raw notes, excerpts, recordings, mistake detail | education-record | **BUILT** for supporters (`read_support_signals`); not for staff |
| `billing-state` | Plan, last charge, dunning state | Card numbers (never held), full payment details | student-private | **SPECIFIED** |
| `integration-state` | Connection health, last receipt, sanitized error | Payloads, external ids in the clear | internal | **BUILT** logs store hashes and references |
| `case-context` | For T&S: case id, category, severity, evidence references | Reporter identity, other votes, reviewer identities | restricted | Reviewer tooling **BUILT** (blind view) |
| **Not grantable** | AI prompts and outputs, documents, messages, grades, accommodation details, location, health or safety content, anything credential-class | — | — | The prohibition is the design |

### 3.6 Identity verification: the ladder

Social engineering is the most likely attack on support. Verification is therefore
a ladder with a fixed number of rungs per request type, and the agent is not allowed to
skip a rung because the caller is persuasive, upset or senior.

| Request | Required proof | Not acceptable |
| --- | --- | --- |
| Reply to a ticket | Nothing beyond the signed-in ticket thread | — |
| Account recovery | The self-service recovery flow only; staff cannot "set a new password" or "add an email" | A call, a DM, a description of the account |
| Staff action on an account (A2/A3) | The student's signed-in consent (A2), or the two-person duty (A3) | An email from the "student", a parent, a professor or an administrator |
| Request "from the institution" | A request through the tenant's verified operator route; callback to the contact on file, not to the number supplied | A forwarded message, a letterhead, urgency |
| Request "from a parent or guardian" | Policy-defined relationship verification in the family model; otherwise refuse and explain the route **[COUNSEL]** | A statement of relationship |
| "I am from Semester" (outbound) | Support never asks for credentials, codes or payment; the verified-contact page says so | — |
| Law enforcement | Counsel's procedure only (§10.4) | Any direct disclosure by staff |

### 3.7 Redaction

Redaction is layered so one failure does not expose a record. Each layer states its status.

| Layer | Rule | Status |
| --- | --- | --- |
| **R0 — No identity** | The ticket queue and thread carry no account id, name or address; the check reads the function result types and fails on any identity-shaped column | **BUILT** |
| **R1 — Field allowlist** | A grant reads only the scope's fields; an unlisted field is not returned, not hidden in the UI | **SPECIFIED** (A2) / BUILT for supporter scope |
| **R2 — Mask by default** | Identifiers, addresses, phone numbers and similar are masked in the view and in any log line | **SPECIFIED** |
| **R3 — Free-text scrub** | Free text shown to staff is passed through the same PII detectors as Community posts; matches are masked until revealed | **SPECIFIED** (detector rules **BUILT**, `app/src/community/detectors.ts`) |
| **R4 — Reveal is an event** | A reveal needs a reason and writes an audit event | **SPECIFIED** |
| **R5 — No export** | Copy, print, download and screenshot are disabled in the staff view; the audit notes attempts | **SPECIFIED** |
| **R6 — Logs hold references** | Operational logs store counts, categories, sanitized messages and payload hashes — never payloads | **BUILT** (`integration_*` tables) |
| **R7 — Attachments** | Metadata stripped on upload (`metadata.ts`); unscanned attachments never render inline; no staff downloads | Metadata strip **BUILT**; scan-and-quarantine for tickets **SPECIFIED** |
| **R8 — Reporter and reviewer privacy** | Reporter id is granted to nobody through the API; volunteers see category, severity and status in blind view | **BUILT** |

### 3.8 Audit, review and anomaly detection

**The record.** Every grant lifecycle step and every read is an event with: tenant, grant,
scope, requester (pseudonymous), ticket, action, time, expiry, and result. Events are
hash-chained in an append-only table written by a separate role
(`private.console_audit_event`, `semester_audit_writer` — **BUILT**), and a write failure
fails the action. For supporter grants the lifecycle record is kept with the student's own
records, because a record of disclosure belongs with what was disclosed (§10).

**What the student sees.** A plain-language history of who looked, at what, and when
(**SPECIFIED** for staff; the supporter event log is **BUILT**).

**Review.** Every A2 and A3 grant is reviewed by someone other than the user, on a fixed
deadline. A reviewer answers three questions: was a read necessary, did the use stay in
scope, and did the ticket receive the outcome the access was for.

**Anomaly alerts** go to the privacy owner and the independent reviewer, **not only to the
agent's own manager**. Proposed rules, all **SPECIFIED**:

- A grant with no linked ticket, or a ticket opened and granted by the same person within
  seconds.
- An agent whose grants in a day exceed their own trailing median by a set margin.
- Access outside the agent's declared shift.
- The same subject opened by multiple agents without a handoff.
- Repeated reveals of the same field class.
- A subject who shares a surname, handle or address with the agent (declared-conflict check).
- A subject who is a public figure, a staff member or a person in the news.
- Any read-attempt on a field outside the scope (an allowlist miss).

A confirmed misuse is a **privacy incident** (§8), handled under the privacy and security
runbooks, and may be a matter for counsel **[COUNSEL]**; it is never closed as a
"training issue" without the privacy owner's decision.

### 3.9 Prohibited actions

Each item is a rule the permission model enforces where it can, and QA samples where it cannot. Breach is grounds for suspension of access pending review.

1. Viewing any student, family or operator data without a valid grant or a ticket-scoped context.
2. Using another person's session, token, device or approval.
3. Acting **as** a student: sending messages, submitting work, changing a grade or a deadline, paying, accepting an agreement, granting consent, or changing sign-in methods.
4. Reading, requesting or recording credentials, codes or recovery material.
5. Opening AI prompts or outputs, documents, messages or accommodation, safety or health content outside an A3 grant.
6. Exporting, copying, photographing or pasting grant-visible data into any external tool, personal device or AI service.
7. Looking up a person who is not the subject of a ticket, including colleagues, friends, family, ex-partners, public figures, or "just to check".
8. Accessing an account of someone they know, without declaring the conflict and handing it off.
9. Contacting a student or reporter outside Semester's channels, or discussing a case in chat, email or a personal app.
10. Extending or re-issuing their own grant; approving, or reviewing the use of, their own access.
11. Using support access as evidence for moderation, an investigation, a performance matter, or any purpose other than the ticket's **without a new, separately authorized request**.
12. Disclosing a reporter's identity, a reviewer's identity, or the existence of a case, to anyone not entitled to it.
13. Passing information to an institution, a parent, an employer or a third party except through the documented, counsel-approved route.
14. Inferring or recording protected traits, health status or emotion from data seen.
15. Promising an outcome: an extension, a grade change, a refund, an enforcement decision or "we will take care of it".
16. Giving academic, legal, medical or financial advice.
17. Overriding an automated safety hold, deleting or altering audit or evidence records, or disabling a control to "get unblocked".
18. Acting on an unverified request that claims authority (the institution, a parent, an executive, "Semester security").

### 3.10 Controls and what enforces each

| Rule | Enforced by | Status |
| --- | --- | --- |
| Support never learns who asked | Function return types; the check fails on identity-shaped columns | **BUILT** |
| App context limited to six named keys, all ticked by the student | `private.support_context_ok` check constraint | **BUILT** |
| Only the student closes a ticket | `support_reply` refuses `closed` | **BUILT** |
| Five tickets per account per day | `open_support_ticket` | **BUILT** |
| Supporter grants: one aggregate scope, ≤ 7 days, recheck on every read | `support_access_grant` constraints, `read_support_signals` | **BUILT** |
| Break-glass: two distinct approvers, ≤ 4 h, reviewed by someone else, overdue review blocks the next | `console_act`, `approval_request`/`approval_decision`, `break_glass_grant` | **BUILT** |
| Audit written before the effect, in the same call, never caught | `private.console_audit_write` | **BUILT** |
| Self-approval refused | `decide_approval` | **BUILT** |
| Legal hold stops sweeps and refuses deletion of a held account | `legal_holds`, hold-gated sweeps | **BUILT** |
| Staff A2 session bound to ticket, scope and session; banner; no export | A staff-session table and viewer | **SPECIFIED** |
| Student-visible access history for staff reads | Reader over the event table | **SPECIFIED** |
| Anomaly alerts routed to privacy owner | Detector and queue | **SPECIFIED** |
| Certification gates the capability | Capability granted only with a valid record (§9) | **SPECIFIED** |

### 3.11 Emergency exception and institutional controls

- **Tenant control.** A tenant can disable staff access entirely and can require its own approval for
  `education-record` scopes. The setting is a tenant policy, versioned and audited.
- **Emergency exception (DECISION, COUNSEL).** Where there is a credible, imminent risk to
  life, the narrowest disclosure — not a record view — can go to emergency services or the
  institution's verified emergency contact. Whether and how this overrides the two-professional
  escalation rule is §5.3's open decision; **until decided, the existing rule stands.**
- **No standing exception.** There is no "on-call can read anything" role. P0 incident
  response uses containment (§3.1.3) and break-glass, both of which are reviewed.

---

## 4. Trust-and-Safety: reporting, triage, evidence, investigation, moderation, appeal, enforcement

### 4.1 Principles

1. **Proportionate and reversible first.** The first action is the smallest one that protects
   someone: a temporary hold, reduced distribution, evidence preserved. Removal and restriction
   are later steps taken by a person.
2. **A human decides.** Automation may `protect` (reduce distribution, rate limit, preserve
   evidence). It never removes content, restricts an account or escalates
   (`CAMPUS-MODERATION-SOP.md`).
3. **Evidence before action; action before explanation.** Preserve first. A decision made on
   evidence that was not preserved cannot be defended or appealed.
4. **No scores.** No reputation number, no hidden risk score, no profile of a person. A
   decision cites a policy reason code. `studentNotice` "never shows a number or score, and never
   names the reporter."
5. **Due process.** The person affected is told the policy basis and the appeal route, and a
   different professional decides the appeal.
6. **Protect the reporter.** The reporter's identity is not shown to reviewers, the subject or
   the institution beyond the agreed payload.
7. **Semester is not the campus adjudicator.** Student-conduct, Title IX, academic-misconduct
   and criminal matters belong to the institution and to law enforcement. Semester enforces its
   own community rules and passes on the minimum necessary **[COUNSEL]**.
8. **Consistency is audited.** Similar cases get similar decisions, checked by precedent review and a gold set.

### 4.2 Lifecycle

```
  Report / signal ─► INTAKE ─► TRIAGE ─► PROTECT ─► EVIDENCE ─► REVIEW ─► DECIDE ─► NOTICE
   (any door,        openCase   severity    minimum     preserve,    human,      reason     plain
    detectors,       frozen     + route     reversible  hash, seal   recused     code +     sentence
    institution)     audit                  hold                     if needed   action     + appeal route
                                                                                              │
                      ┌───────────────────────────────────────────────────────────────────────┘
                      ▼
                   APPEAL ─► different professional ─► CLOSE ─► RETAIN / SWEEP (or HOLD)
                   (one)       decides                  with reason   per §10; open and appealed never swept
```

Case states as built: `open → in_review → decided → appealed → closed`
(`CaseStatus`, `app/src/community/moderation.ts`). Each transition writes a frozen audit event.

### 4.3 Reporting

- **Surfaces.** Post, profile, message, listing, ticket-detected harm (via "Report this instead"),
  institution-originated, and detector signals. Every report form shows the verbatim emergency
  notice. Block, Mute and Leave are offered alongside Report.
- **Categories** (as built): private information or doxxing; nonconsensual media; threat or
  safety concern; hate or discrimination; harassment or bullying; impersonation; spam, scam or
  phishing; academic integrity; other.
- **Third-party reports** are accepted: you do not have to be the target.
- **Bad faith and brigading.** A report is set aside only by the two documented rules
  (new-joiner cluster; unfounded repeats). A set-aside report is kept, never counted toward
  reducing distribution, and never hides a high-risk hold. Someone reporting repeated abuse
  counts normally however often they report.
- **Accessibility.** The report route works with a screen reader and without a timed or
  visual-only step; free-text is optional.
- **A receipt.** The reporter is told the report was received and how outcomes are
  communicated; they are not promised a result.

### 4.4 Triage

The provisional severity and the minimum protection are those in
[`CAMPUS-MODERATION-SOP.md`](CAMPUS-MODERATION-SOP.md): the category defaults, the
thresholds (one signal queues; two in 30 minutes monitor; one high-risk report holds; three
reporters in 60 minutes reduce distribution; PII confidence ≥ 0.9 holds as P0), and the
account-level *recommendations*, which never restrict anyone on their own. This model adds
five triage duties that are **SPECIFIED**:

1. **Conflict check** before a reviewer opens a case: own reports, communities led, block
   relationships, personal relationship to a party. Recuse and reassign.
2. **Language and accessibility check:** a report in another language is translated by an
   approved route, and the translation is itself reviewed for high-severity cases.
3. **Second-source rule for removal of non-high-risk content:** the decision rests on content
   and context, not on report count alone.
4. **Pattern linking:** link cases about the same person, post or campaign, so a P2 that is
   actually the fourth report of stalking is seen as one.
5. **Queue ordering** is severity first, then time-since-open, never "easiest first."

### 4.5 Evidence handling

**Evidence classes.** The class sets who can touch it, where it lives and how long it is kept.

| Class | What | Handling | Who reads |
| --- | --- | --- | --- |
| **E0 — Ordinary** | A public post, a ticket, an ordinary log | Case store; standard retention | Assigned reviewer |
| **E1 — Case evidence** | Post snapshot at report time, signals, decisions, thread context, case events | Restricted case store; frozen; hashed; retention per §10 | Assigned professional; senior reviewer; independent reviewer on appeal |
| **E2 — Restricted material** | Nonconsensual media, any content that depicts a minor, any suspected exploitation material, security-sensitive disclosure | Stop-view rule: view once if necessary to classify, never copy; the system preserves with hash and perceptual hash; **no sweep or account deletion removes a known-abuse match**; counsel decides what, if anything, is reported or disclosed **[COUNSEL]** | Named professionals only; every view logged |
| **E3 — Held** | Anything under a legal hold | Retention suspended; deletion refused; release is explicit and resumes the approved schedule | Counsel; named custodian |

**Capture.** Preserve at the earliest of report, detector hit or protective action:
the content as it was at that time, its metadata, the signals that fired and their rule
versions, the thread context needed to read it, and — for media — the scan facts. Capture is by the
system, not by a screenshot: a screenshot has no provenance.

**Chain of custody.** Each item carries: case id, evidence id, what it is, when and by what
process captured, a SHA-256 of the captured bytes, who accessed it and when, and every
transfer. Case events carry hashes, never account ids. A second person can verify the
hash at any time. **Evidence is never edited in place;** a redacted working copy is a
separate, marked derivative.

**Rules.**

- Never move evidence into chat, email, a ticket, a personal drive or an AI service.
- A reviewer who needs context requests a *view* in the case store; there is no download.
- Identity behind an alias is a separate, second-reviewer, four-hour grant, and each look is
  a case event (`community_identity_grants` — **BUILT**).
- Preservation applies to the subject's and the reporter's material equally.
- Evidence that cannot be preserved (a provider outage, a missing capture) is recorded as a
  gap in the case, not silently omitted.
- Disclosure of evidence outside the case — to the institution, to law enforcement, to a
  party — goes through the counsel queue and the escalation allowlist, never ad hoc **[COUNSEL]**.

### 4.6 Investigation

An investigation here is a **documented review of platform-rule compliance**, not a conduct
or criminal investigation. Its standard of proof and what findings may be disclosed are
**[COUNSEL]** questions, recommended below and not decided here.

**Steps.**

1. Confirm the case is in scope for T&S and not for the institution; if conduct, Title IX or
   criminal, refer and preserve, and do not investigate in parallel.
2. Read the evidence in the case store; record what was and was not reviewed.
3. Decide whether the subject must be heard first. Default: yes, a short statement of the
   policy basis and a chance to respond. **Exceptions:** a risk to a person's safety, a
   risk of retaliation, an active takeover, or imminent evidence loss — then protect first and
   explain after.
4. Identify the policy reason code and the narrowest sufficient action.
5. A second professional reviews any P0/P1 restriction (senior for P0).
6. Record the rationale in two sentences a stranger could follow.

**Recommended standard (DECISION, COUNSEL):** a documented, reasonable basis, reviewed by a human,
sufficient for the *platform* action taken. It is not a finding of misconduct and must never be
described to a third party as one.

**Investigation record fields:** case id; category and severity; evidence ids; policy version;
parties' roles (pseudonymous); conflicts checked; steps taken; statements received; decision
and reason code; reviewer(s); time spent; appeal-eligible flag.

### 4.7 Moderation: actions and the enforcement ladder

**Actions** (as built): allow; label; reduce distribution; remove; lock thread; limit replies;
rate limit; community restriction; account restriction; preserve evidence; escalate; close
with no action. Every decision carries a reason code.

**Ladder.** Choose the lowest rung that protects, then re-assess.

| Rung | Action | Who may decide | Reversible | Notice |
| --- | --- | --- | --- | --- |
| 0 | Preserve evidence, no visible action | Automation or professional | Yes | None |
| 1 | Reduce distribution, rate limit (temporary hold pending review) | Automation `protect` or professional | Yes | None until decided |
| 2 | Label; limit replies; lock thread | Professional (P3 and clear P2: volunteers only by removal consensus) | Yes | Yes |
| 3 | Remove content | Professional; or two independent volunteers who agree on P3/clear P2 | Restorable on appeal | Yes, with appeal route |
| 4 | Community restriction | Professional | Yes | Yes |
| 5 | Account restriction | **Professional; senior for P0** | Yes, on appeal | Yes |
| 6 | Escalate to institution | **Two different professionals**; agreement on file; flag on; minimum payload | n/a | Per the agreement **[COUNSEL]** |

**Automation limits.** Detectors run on every post and edit server-side; each hit records rule,
confidence, version and route. A crisis hit "never holds or silences"; a threat hit "never
holds"; both route to a professional. Two or more detectors on one post place its case under
monitoring. A detector that is overruled repeatedly is reviewed — the decision is recorded
against each signal, so the overrule rate is visible. Rule changes are stamped with a hash of who made them.

**Consistency.** A precedent library of anonymized decisions (reason code, rung, rationale)
and a **gold set** of cases with known right answers are used in onboarding, calibration
and QA (§7.6). Volunteers already get blind control items that look identical to real cases.

### 4.8 Appeals

As built: only a decided case can be appealed; only one appeal; a decision of `allow` or
`close_no_action` is not appealable; an appeal is always professional; a reviewer who took
part in the decision may not decide the appeal (`moderation.ts`). Granted appeals reverse
the safety state; they do not delete it.

Gaps (**DECISION**; the code has no clock):

| Missing | Proposal |
| --- | --- |
| A filing window | 30 days from the notice |
| A decision deadline | 10 business days, with the person told if it will be exceeded and why |
| Notice of new evidence | The appellant may add a statement and evidence; both go to the case |
| Independent senior path | An appeal of a P0 account restriction is decided by a senior reviewer who took no part |
| Outcome notice | The same plain-sentence form as the original, including what changes |
| Appeals by the reported **and** the reporter | Reporter may ask for a review of a no-action close on a P0/P1 case; the outcome is told in general terms only |
| Volunteer decisions | Any volunteer-based removal is appealable to a professional, as today |

### 4.9 Enforcement and repeat conduct

- **No automatic penalties.** `accountReview` only *recommends*: three confirmed P2 in 30 days
  recommends a restriction review; one confirmed P1 recommends a temporary restriction and senior
  review; one confirmed P0 recommends an immediate hold and urgent review. A person decides.
- **Restriction forms:** time-limited community restriction; time-limited account restriction;
  feature restriction (posting, messaging). Each has a stated duration, a stated reason code, the
  appeal route and a review date. A permanent action is a senior decision with a second reviewer.
- **Safety state** is a private record per professional decision (kept one year; reversed
  when an appeal is granted) and is not shown to other users or exposed by API.
- **Evasion.** Do not publish how evasion is detected. Review a returning account as a new
  case with the earlier case linked.
- **Reinstatement** is an explicit decision with conditions, not the passage of time.
- **Institution-level.** Where an institution's own conduct process has made a finding, Semester
  may act on a **verified, institution-supplied** notice under the agreement, never on a rumor,
  and records that the source was the institution.

### 4.10 Oversight and transparency

- **Override patterns.** Every time a person overrides an automated decision, a row goes to
  `human_overrides`; a reviewer reads patterns, not individuals (**BUILT**; moderation is a path
  with no producer yet, so wiring it is a gap).
- **Quarterly review** of decisions by rung, reason code, appeal outcome and detector overrule rate.
- **Aggregate transparency report**, small cells suppressed, with enforcement counts by
  category. Never individual cases.
- **Independent review of the T&S team's own use of identity reveal and escalation:**
  sampled by someone outside the team.

---

## 5. Playbooks

Every playbook is the same shape so a person under pressure finds the same thing in the same
place. "Authority" names who may decide; "Never" is a prohibited action specific to the case.
A report may sit in more than one playbook; the highest severity governs and each
owner is told (§1.1 rule 4).

### 5.1 Academic integrity

Semester is a platform, not the institution's integrity office. The institution and the
instructor own findings, penalties and due process. **No AI or detector output is, by itself, a misconduct finding**; the repository's rule is that
AI "cannot release a final grade or a misconduct finding" and the student can see the policy
basis, respond and appeal ([`AI-GRADING-AND-INTEGRITY.md`](operating-model/AI-GRADING-AND-INTEGRITY.md)).

| Field | Content |
| --- | --- |
| **Triggers** | (a) a Community post sharing answer keys or "do my exam" (detector rule, P2 queue); (b) misuse of an AI feature against a course policy; (c) an instructor or office requests records about a student's work; (d) a student says an integrity tool wrongly flagged them |
| **Default severity** | P2; P1 if a wide leak of live exam content or a coordinated service |
| **Owner / authority** | T&S professional for platform action; institution for any academic finding |
| **First 15 minutes** | Preserve the post and signals; apply reduced distribution if live exam content; show the author the course policy; do not contact the instructor yet |
| **Do** | Remove prohibited assessment content under platform rules and tell the author which rule; for (b) apply the course-policy caps already configured (source lockers, policy caps); for (c) route the request to the counsel queue and the institution's authorized channel; for (d) give the student their **own** export of AI-assist trace and point to the institution's process |
| **Never** | Tell anyone "the AI says this student cheated"; accept a detector percentage as proof; give an instructor student data outside an authorized, agreed route; decide a grade or a penalty; speculate in a ticket |
| **Evidence** | Post snapshot, detector rule and version, course policy version shown, AI-assist trace where in scope, timestamps |
| **Notices** | Author: plain sentence, rule, appeal route. Instructor: only via the agreed route and minimum payload |
| **Escalate** | Live exam leak, commercial cheating service, targeting of a specific student, a minor → P1 and counsel/institution |
| **Close** | Content restored or removed with reason; student told their rights; institution told only what the agreement allows |
| **Counsel trigger** | Disclosure of student work or AI logs to an instructor or office **[COUNSEL]**; copyright claim on the posted material |
| **Status** | Detector and course-policy display **BUILT**; instructor-records routing and the student-export path for disputes **SPECIFIED** |

### 5.2 Harassment

| Field | Content |
| --- | --- |
| **Triggers** | Harassment or bullying report; stalking; repeated unwanted contact; targeted pile-on; sexual harassment; hate or discrimination |
| **Default severity** | P2; **P1** for stalking, severe or sexual harassment, hate; **P0** if a minor, doxxing, imminent threat or nonconsensual media |
| **Owner / authority** | T&S professional; senior reviewer for any restriction at P0 |
| **First 15 minutes** | Confirm the person's immediate safety; show Block/Mute/Leave; preserve; apply reduced distribution or temporary hold at the thresholds; assign a professional (never a volunteer for contextual harassment) |
| **Do** | Read the context, not only the single post; link prior cases; hold a high-risk post until reviewed (the hold protects the person it concerns); give the target a plain description of what happens next; decide on the lowest effective rung |
| **Never** | Ask the target to confront or mediate; reveal the reporter; tell the subject who reported; treat a lack of prior reports as evidence of no harm; reach out to the subject off-platform |
| **Evidence** | Case snapshot, thread, related cases, detector signals; E2 handling if media |
| **Notices** | Target and subject each get a plain notice; the subject is told the policy basis and the appeal route unless safety precludes (§4.6) |
| **Escalate** | To the institution via the escalation process for P0/P1 in a covered category, with two professionals and a written agreement. Whether sexual harassment triggers duties for the institution is **[COUNSEL]** and the institution's Title IX office |
| **Close** | Action recorded with reason; check-in with the target after a fixed interval; a repeat report from the same target is opened as a new linked case |
| **Counsel trigger** | Allegation about staff of the institution or of Semester; request by a party for records; threat of litigation |
| **Status** | Detection, triage, case, appeal and escalation **BUILT**; the post-close check-in and no-contact tooling **SPECIFIED** |

### 5.3 Self-harm and safety

Semester is not an emergency-response or clinical service and does not monitor for emergencies. Everything below is built to make sure a person is pointed to people who are.

| Field | Content |
| --- | --- |
| **Triggers** | A report or detector hit about self-harm; a threat to others; a welfare concern raised by a third party; crisis language in a ticket |
| **Default severity** | P1; **P0** if imminent, or a minor is involved |
| **Owner / authority** | T&S **professional only**. Volunteers never see these. Support T1 never handles them beyond the first, fixed reply |
| **First 15 minutes** | Apply the minimal reversible intervention (a temporary hold) and preserve evidence; show the person the emergency notice and the institution's verified campus crisis contact; route to a professional |
| **Do** | Treat a detector hit as `possible_concern`; offer support resources to the *author*; never silence, hide or penalize someone for expressing distress; keep the language of the first reply fixed and reviewed by a clinical advisor **[COUNSEL]** |
| **Never** | Diagnose; judge risk from keywords; promise confidentiality or monitoring; promise that someone will come; ask the person to prove they are in distress; use the matter in an unrelated enforcement decision; discuss it outside the restricted case store |
| **Evidence** | Restricted case store with a retention date; E1, treat E2 for any media |
| **Notices** | The person: resources. The institution: only through the escalation process |
| **Escalate** | Imminent risk, or a third party reporting a specific plan, to the senior professional on duty at once. Escalation to the institution follows [`CAMPUS-ESCALATION-POLICY.md`](CAMPUS-ESCALATION-POLICY.md): flag on, agreement on file, P0/P1 in a covered category, two **different** professionals with written reasons, the 500-character allowlist payload |
| **Close** | Follow-up through the same door; wellbeing check for the reviewer (§9.5) |
| **Counsel trigger** | Any disclosure beyond the allowlist; any request from family, an employer or police; whether duty-of-care or reporting duties attach **[COUNSEL]** |
| **Open decision — imminent harm** | **DECISION, COUNSEL.** The built rule requires two professionals to approve an escalation, which may be too slow for a credible, imminent threat to life. Options: (1) keep as is; (2) a pre-approved imminent-harm exception: the senior professional on duty may send the minimum payload to emergency services or the institution's verified emergency contact, with a documented reason, **post-hoc review within 24 h by a second professional and counsel notice**. Recommended: option 2, only after counsel approves the wording and the situations it covers. **Until decided, the existing rule stands** |
| **Status** | Notice, routing, professional-only queue, hold, escalation **BUILT**; welfare-check procedure and the exception **SPECIFIED** |

### 5.4 Fraud

| Field | Content |
| --- | --- |
| **Triggers** | Account takeover; payment fraud or chargeback; scam, phishing or upfront-payment post (detector); fake listing or provider; fake financial-aid or job offers |
| **Default severity** | P2; **P1** for a credible scam or confirmed takeover; **P0** if funds or messages are leaving a hijacked account, or credentials were exposed |
| **Owner / authority** | T&S for content; Security for takeover; Finance for money movement; incident commander for cohort-wide fraud |
| **First 15 minutes** | **Contain without reading:** revoke sessions, force sign-out, lock payments and outbound messages, hide the offending post (`protect`). Preserve evidence |
| **Do** | Walk the owner through self-service recovery (§3.6); issue a verified-contact warning when Semester is being impersonated; tell Finance to review chargebacks with evidence; report a pattern to the institution's security contact under the agreement; rate-limit rather than ban on a first pass |
| **Never** | Set a password, add an email or recovery method for the account; ask for the old password; refund or reverse a payment from the support queue; blame the victim; describe how detection works |
| **Evidence** | Sign-in and session events (references and hashes), post snapshots, payment processor references, the report |
| **Notices** | The victim: what was done and what to do; the community: a warning only if safe and necessary |
| **Escalate** | Cross-tenant or multi-account fraud, credential exposure, a card-network or processor notice, a request to involve police |
| **Close** | Account restored through self-service; payments reconciled; patterns fed back to rate limits and detector rules through review |
| **Counsel trigger** | Breach-notification questions; processor, card-network or regulator contact; law-enforcement request **[COUNSEL]** |
| **Status** | Sign-up, AI-spend, gateway and write rate limits and the scam detector **BUILT**; direct-RPC call rate remains the largest open item on the abuse inventory ([`SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md`](SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md)); takeover and payment-fraud workflow **SPECIFIED** |

### 5.5 Marketplace dispute

**Nothing exists.** There are no marketplace transaction tables at this revision. Under
the repository's own rule — a screen, a mock action or a fixture is not a live capability — no
marketplace transaction may be offered to a user until this workflow is built, staffed and exercised.
The preamble's "Controlled automation" level applies: provider approval, sanctions/tax/vendor
review as applicable, and safety moderation come before launch, not after.

| Field | Content |
| --- | --- |
| **Triggers** | Order not delivered or not as described; provider conduct; a safety problem in a service; a listing that breaks the rules; a payout or refund dispute |
| **Default severity** | P2; **P1** for a safety category, a minor, or suspected fraud; **P0** for an injury or an active threat |
| **Owner / authority** | Marketplace operations for the dispute; T&S for safety or conduct; Finance for money; counsel for the platform's legal role |
| **States** | `opened → evidence window → provider response → mediation → decision → remedy → closed`, with `appealed` once |
| **Proposed clocks (DECISION)** | Evidence window 5 business days; provider response 3 business days; decision within 10 business days of the evidence close; the payout on the disputed order is held while open |
| **Do** | Hold payout on open disputes; record both sides' statements and attachments in the case store; decide on the published listing terms; log refund or payout *as a Finance action* with a second approver above a threshold set by the owner; remove or suspend a listing or provider on a safety finding; keep disputes and safety separate: an order dispute does not become a reason to reveal a person's identity |
| **Never** | Release or reverse money from the support queue; decide a dispute where the agent knows a party; disclose one party's personal data to the other beyond what the order needs; retaliate against a person for disputing; decide the platform's legal role (merchant of record, agent, marketplace facilitator) without counsel |
| **Evidence** | Order record, listing version at purchase time, messages, delivery proof, payments references |
| **Notices** | Both parties: a plain decision, reason, remedy, appeal route |
| **Escalate** | Safety, a minor, repeated provider complaints, a card or processor dispute, a regulator or sponsor inquiry |
| **Close** | Remedy executed and reconciled; patterns reviewed monthly |
| **Counsel trigger** | The platform's legal role; consumer-protection, tax, sanctions or sponsor-disclosure questions; any personal-injury claim **[COUNSEL]** |
| **Status** | **SPECIFIED.** Incident communications already include a Marketplace/sponsor safety audience (Trust & Safety lead + Legal approve, update every 4 h) |

### 5.6 Impersonation

| Field | Content |
| --- | --- |
| **Triggers** | An account claiming to be a student, instructor, office, official or Semester staff; a lookalike handle; a verified-institution claim by an unverified account (detector) |
| **Default severity** | P2; **P1** if serious (a fake office soliciting money or data; an account posing as an official during an emergency) |
| **Owner / authority** | T&S professional |
| **First 15 minutes** | Preserve; label the account as unverified or apply reduced distribution if it claims an office or official role; do not remove on a single unverified report of a personal impersonation |
| **Do** | Verify through institution-supplied attributes (SSO/SCIM, verified claims) or the institution's operator route — not by looking at the account's own profile; give both parties the chance to respond; remove or restrict a confirmed impersonator; publish a verified-contact page for Semester's own staff |
| **Never** | Decide identity from a photo, writing style, or an outsider's statement; reveal the real account behind an alias except through the two-reviewer, four-hour grant; accept "I am the real person" as proof in a message |
| **Evidence** | Profile snapshots, handles, claims, verification results |
| **Notices** | Both accounts, in plain sentences |
| **Escalate** | A fake office or official soliciting money, data or action (P1 + the institution's contact) |
| **Close** | Action recorded; lookalike handles reserved if appropriate |
| **Counsel trigger** | Trademark, defamation or a public figure **[COUNSEL]** |
| **Status** | Office-impersonation detector, alias-reveal grant and cases **BUILT**; the verified-contact page and non-office personal-impersonation procedure **SPECIFIED** |

### 5.7 Privacy report

Four distinct matters get four different handlers; the first job is to classify.

| Matter | Handler | Steps |
| --- | --- | --- |
| **Data-rights request** (export, erase, correct, restrict) | Privacy owner | Record the request (self only); verify; produce or perform; the file contains the record of its own making; thirty-day due date; deletion fails closed, stays visible, escalates, and respects legal holds. Process: [`DATA-RIGHTS-REQUEST-RUNBOOK.md`](DATA-RIGHTS-REQUEST-RUNBOOK.md) |
| **"Someone exposed my data"** (doxxing, a leaked document) | T&S professional | **P0.** Hold the post, preserve, remove on review, identify the scope, tell the person, escalate to the institution under the policy. Detector confidence ≥ 0.9 already holds the post |
| **"A Semester staff member looked at my data"** | Privacy owner, **not** the accused's manager | Suspend the accused's access pending review; pull the grant and audit chain; answer the person from the record; confirmed misuse is a privacy incident (§8) and may be **[COUNSEL]** |
| **Institution or third-party request for records** | Counsel queue | Never answered by support. Log, route, respond only as counsel directs |

| Field | Content |
| --- | --- |
| **Do** | Answer a data-rights request from the system's record, not memory; give a dated receipt; tell the person which data classes are held lawfully under a hold and why, as counsel permits |
| **Never** | Confirm or deny an account's existence to a third party; "just send" an export to an email address that is not verified; delete data under a hold; discuss a request outside the case |
| **Counsel trigger** | A complex or contested request, a hold, a minor, a cross-border question, a complaint to a regulator **[COUNSEL]** |
| **Status** | Export, erasure, request record, holds **BUILT**; the staff-access-complaint procedure and the independent-owner rule **SPECIFIED** |

### 5.8 How the playbooks interact

| A case that is… | Is also… | Primary owner | Linked owner |
| --- | --- | --- | --- |
| Harassment with doxxing | Privacy report | T&S | Privacy owner |
| Scam post impersonating an office | Fraud + impersonation | T&S | Security, Finance |
| Self-harm language in a harassment thread | Safety | T&S professional (safety governs) | — |
| Marketplace fraud by a provider | Fraud + marketplace | Marketplace ops | T&S, Finance |
| Integrity report with a privacy complaint | Academic integrity + privacy | T&S | Privacy owner |
| Staff misuse of access | Privacy incident | Privacy owner | Security, counsel |

The primary owner is named at triage and recorded in the case. The other owners get a
linked case, not a copy of the data.


---

## 6. Agent tooling requirements and permission model

### 6.1 Tool requirements

The existing staff surfaces are the Operations Console's support queue
(`app/src/components/console/SupportQueue.tsx`), the moderation and volunteer
consoles, the console control plane (capabilities, seats, duties, approvals, fail-closed
audit) and the incident-communications composer
(`app/src/lib/governance/incident-comms.ts`). Everything else below is a requirement on
what must exist before the matching tier of work is staffed.

| # | Capability | The tool MUST | Status |
| --- | --- | --- | --- |
| T1 | **Identity-free queue** | Return no account id, name or address in the queue or thread; sort by `priority desc, first_response_due`; show SLA state | **BUILT** |
| T2 | **Case model** | One case per matter with a named primary owner, linked cases for other owners, severity, category, door, state, next-update time; a case with no next-update time cannot be handed off | Partly **BUILT** (tickets, moderation cases separately); unified model **SPECIFIED** |
| T3 | **SLA timers** | Show clock state and the clock's *basis* (wall-clock or staffed hours); pause only in *waiting on person* | `overdue` **BUILT**; basis and pause **SPECIFIED** |
| T4 | **Composer safeguards** | Block send on `[BRACKET]` placeholders; warn on promises, diagnoses, legal conclusions and "we are monitoring"; block pasting card numbers, tokens, codes and long digit strings; mask detected PII in quoted text | Placeholder guard **BUILT** in `compose()` for incident notices; ticket composer **SPECIFIED** |
| T5 | **Macro library** | Versioned macros with owner, backup, expiry and risk tier; a High-risk macro needs domain-owner approval; usage is sampled by QA | **SPECIFIED** |
| T6 | **KB link** | Suggest articles from the issue fingerprint; tag a case with the article it used; record "article defective" | **SPECIFIED** |
| T7 | **JIT access console** | Implement §3.4: eligibility, consent, issue, masked read-only view, banner, end, review | **SPECIFIED** (break-glass **BUILT**) |
| T8 | **Redaction engine** | Layers R0–R8 of §3.7 applied in one place, not per screen | R0, R6, R8 **BUILT**; remainder **SPECIFIED** |
| T9 | **Evidence vault** | Classes E0–E3; capture by the system; SHA-256; custody log; **no download**; view-only with reason; hold-aware | Case store and hashes **BUILT**; E2 stop-view and custody log fields **SPECIFIED** |
| T10 | **Moderation console** | Blind views, recusal, reason codes, ladder enforcement, two-person escalation, gold-set cases, appeals by a different professional | **BUILT** (`app/src/community/*`, volunteer console, safety read) |
| T11 | **Appeals module** | Filing window, deadline, new evidence, notice of outcome | One appeal and independence **BUILT**; clocks **SPECIFIED** |
| T12 | **Counsel queue** | Items held by reference, privilege marking, decision recorded in the system, linked case, SLA | Template **BUILT** (docs); tool **SPECIFIED** |
| T13 | **Audit viewer** | Search the hash-chained events by case, grant, requester, subject; verify the chain; export to counsel by request | Chain, manifests, nightly verification **BUILT**; viewer for support grants **SPECIFIED** |
| T14 | **Student-visible access history** | Show a person who looked at their data, what, when, and why | Supporter event log **BUILT**; staff **SPECIFIED** |
| T15 | **Anomaly detection** | §3.8 rules routed to privacy owner and independent reviewer | **SPECIFIED** |
| T16 | **QA module** | Sampling, scorecards, calibration sessions, auto-fail items, trend | **SPECIFIED** |
| T17 | **Metrics** | Aggregate only; small-cell suppression; unavailable data shown as unavailable, never zero | Rule stated in `SUPPORT-OPERATIONS.md`; pipeline **SPECIFIED** |
| T18 | **Comms composer** | Seven-part message, audience-specific approvers and cadence, enforced again in the database | **BUILT** (`governance_incident_notices`) |
| T19 | **Agent AI assistance** | **Draft-only**; a human sends; no student or case data to a model unless the case's scope allows and the tenant approved; prompts versioned and evaluated; a kill switch; every use logged; never used for a decision, a severity, or an enforcement recommendation about a person | **SPECIFIED**; governed by the AI governance program and [`trust/AI-HUMAN-OVERSIGHT-STANDARD.md`](trust/AI-HUMAN-OVERSIGHT-STANDARD.md) |
| T20 | **Environment** | Managed device; passkey or hardware MFA; no local storage of case data; DLP on paste to external tools; separate staff identity — never a student account; session timeout | **SPECIFIED**; see [`trust/PASSWORD-SESSION-AND-MFA-STANDARD.md`](trust/PASSWORD-SESSION-AND-MFA-STANDARD.md) |
| T21 | **Joiner / mover / leaver** | Access granted by an approved request with a ticket; changed on role change; revoked within one hour of departure; a departing person with an open review or hold is placed on hold before the account is touched | Request evidence **BUILT**; the one-hour revoke and hold step **SPECIFIED** |
| T22 | **Demo separation** | Console readers leave demo rows out unless explicitly asked | **BUILT** (`include_demo`) |

### 6.2 Permission model

**Rules.**

1. **Deny by default.** A capability is an explicit grant, not an inherited right. The built
   capability for ticket work is `support:ticket`, held by the platform-scope `support_agent`
   role; nothing else in this document is implied by it.
2. **Capabilities, not role names, in code.** A role is a bundle of capabilities; a check asks
   about the capability.
3. **Seats are time-bound and certified.** A seat is valid only while its certification (§9) is current.
4. **Two-person duties** are enforced by the server: requester ≠ approver, two distinct approvers
   where the duty says so, and each approver must hold one of the duty's approver parties.
5. **No privileged read is a standing permission.** Reads happen through a grant.
6. **A role grant with no request is a finding** at the quarterly access review (already the rule for role grants).
7. **Staff accounts are separate from any student account**, and a staff identity never acts as a student.
8. **The permission model itself is a high-risk change** and goes through the two-person duty
   with an evidence reference.

**Capability matrix.** `✓` = holds directly · `R` = may request, someone else approves ·
`2P` = needs two distinct approvers · `own` = only for matters they hold · `—` = cannot. A blank
role cell in the *Today* column means no such role exists yet.

| Role | Ticket queue (A1) | A2 view | A3 restricted | Decide T&S case | Restrict account | Alias reveal | Escalate to institution | Evidence view | Audit read | Publish status | Place / release hold |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Support agent T1** | ✓ | R | — | — | — | — | — | — | own | — | — |
| **Support specialist T2** | ✓ | R | R | — | — | — | — | — | own | — | — |
| **T&S professional** | — | — | — | ✓ (≤ P1, with second review at P1 restriction) | R | R (2nd reviewer, 4 h) | R (two professionals) | own | own | — | R |
| **Senior T&S reviewer** | — | — | — | ✓ (incl. P0) | ✓ | ✓ as second reviewer | ✓ as second professional | ✓ | ✓ | — | R |
| **Volunteer reviewer** | — | — | — | Blind P3 / clear P2 only | — | — | — | Blind view | — | — | — |
| **Privacy owner** | — | — | 2P approver | — | — | — | — | — | ✓ | Approver (privacy incidents) | R |
| **Security owner** | — | — | 2P approver | — | — | — | — | — | ✓ | Approver (security incidents) | R |
| **Incident commander** | — | — | R | — | — | — | — | — | ✓ | ✓ | R |
| **QA reviewer** | — | — | — | — | — | — | — | Sampled, view-only | ✓ | — | — |
| **Counsel** | — | — | — | — | — | — | Approver | Via queue | ✓ | Approver | ✓ place; ✓ release |
| **Institution operator** | Own tenant tickets | — | Own tenant policy | — | — | — | — | — | Own tenant | — | — |
| **Platform admin** | Config only | — | — | — | — | — | — | — | Config | — | R |

**Today.** One person holds the support, T&S, incident-commander and legal-coordinator
roles. The column cells that require *a second person* (2P, "second reviewer", "second
professional", "approver") cannot be satisfied; those capabilities stay **off**. The matrix is
what the second and third hires are measured against.

**Duties that require two people** (existing duties marked): break-glass; A3; institution
escalation; P0 account restriction; tenant suspension; refund or payout above the owner's
threshold; legal-hold release; an evidence disclosure outside the case; any change to this
permission model; switching a detector rule off or changing its confidence (today a senior reviewer, stamped with a hash — recommended to become two-person).

---

## 7. Quality assurance, customer satisfaction, resolution time, repeat contact and escalation metrics

### 7.1 Principles

1. **Measure the system, never rank a person on a number that rewards the wrong behavior.**
2. **A metric names its decision.** If nobody would change anything based on it, do not collect it.
3. **Aggregate, with small cells suppressed** (proposal: under 10). Individual students are never
   in a dashboard.
4. **Unavailable is not zero.** A missing queue or channel is reported as unavailable.
5. **Guardrail metrics sit beside every speed metric.** Speed without quality, and closure without
   confirmation, are worse than slow.
6. **Never reward** closing safety, harassment or privacy cases fast; enforcement volume or
   "quota"; deflection of the three protected categories; or the lowest handle time as an individual target.

### 7.2 Metric catalog

All targets below are **proposed**; set them only after two measurement cycles of baseline. Status
describes whether anything can compute the metric today.

| Metric | Definition | Denominator / exclusions | Owner | Cadence | Status |
| --- | --- | --- | --- | --- | --- |
| **First-response time** | `first_responded_at − created_at` per ticket | By category and priority; exclude spam; basis stated (§1.5) | Support lead | Weekly | Data **BUILT** (`first_responded_at`); no reader |
| **First-response attainment** | % of tickets with first response ≤ `first_response_due` | Same | Support lead | Weekly | `overdue` **BUILT**; SLO-5 `UNPROBED` |
| **Time to resolution** | `resolved_at − created_at`, excluding *waiting on person* | By category; reopened tickets measured to final resolution | Support lead | Weekly | **SPECIFIED** |
| **Time to containment (T&S)** | Report received → first protective action | P0/P1 only; automated holds count as zero-minute but reviewed | T&S lead | Weekly | Event times **BUILT** in case events |
| **Time to human review (T&S)** | Report received → first human decision | By severity | T&S lead | Weekly | **BUILT** events; no reader |
| **Appeal turnaround** | Appeal filed → appeal decided | All appeals | Senior reviewer | Monthly | Events **BUILT**; no clock |
| **Backlog age** | Open cases by age band and severity | Includes *waiting on person* separately | Support / T&S leads | Daily | **SPECIFIED** |
| **QA score** | Rubric result (§7.3) | Sampled cases | QA reviewer | Weekly | **SPECIFIED** |
| **CSAT** | % satisfied on the one-question survey (§7.4) | Responding resolved tickets; **excluded** on safety, harassment, privacy-incident cases | Support lead | Monthly | **SPECIFIED** |
| **Reopen rate** | % of resolved tickets reopened by the person within 7 days | Resolved tickets | Support lead | Weekly | **SPECIFIED** |
| **Issue recurrence** | Tickets sharing an issue fingerprint within 14 days across the cohort | By fingerprint | Product + KB owner | Weekly | **SPECIFIED** |
| **Escalation rate** | % of cases moved up a tier | By category and tier | Support lead | Weekly | **SPECIFIED** |
| **Escalation bounce-back** | % of escalations returned for missing information | By team | Support lead | Monthly | **SPECIFIED** |
| **Missed escalation** | Cases QA or an incident review finds should have escalated and did not | All sampled and reviewed cases | QA reviewer | Monthly | **SPECIFIED** |
| **Decision agreement (T&S)** | Reviewer decisions matching the gold set; volunteer control-item accuracy | Gold set, controls | Senior reviewer | Monthly | Volunteer controls **BUILT** (last 20 control tasks, 5 points each); professional gold set **SPECIFIED** |
| **Appeal overturn rate** | % of appealed decisions changed | By reason code and detector | Senior reviewer | Quarterly | **SPECIFIED** |
| **Detector overrule rate** | % of detector hits where a human closed with no action | By rule and version | T&S lead | Monthly | Data **BUILT** (decisions recorded on each signal) |
| **Access review timeliness** | % of A2/A3 grants reviewed within the deadline | All grants | Privacy owner | Weekly | **SPECIFIED**; the overdue-blocks-next rule is **BUILT** for break-glass |
| **Access anomaly closure** | Alerts closed with a finding vs. no finding, and age | All alerts | Privacy owner | Monthly | **SPECIFIED** |
| **Training currency** | % of seats with a current certification | By tier | Support / T&S leads | Monthly | **SPECIFIED** |
| **Status-page timeliness** | Incident declared → first public notice; update intervals vs. cadence | P0/P1 | Incident commander | Per incident | **SPECIFIED** |
| **Known-issue freshness** | % of open known-issue entries updated within their cadence | Open entries | KB owner | Weekly | **SPECIFIED** |

### 7.3 Quality assurance program

**What is scored.** One rubric for support cases and one for T&S cases, each with **auto-fail**
items (any one fails the case regardless of the rest).

| Dimension | Support case | T&S case |
| --- | --- | --- |
| **Auto-fail** | Credential requested or accepted; data viewed without a valid grant; prohibited action (§3.9); a promise of an outcome; legal/medical/academic advice | Reporter identity disclosed; evidence moved outside the vault; a decision with no reason code; an enforcement step skipping the ladder without recorded reason; use of an AI output as a decision |
| **Accuracy** | The answer was correct for the supported version and role | The decision matches the policy and the evidence |
| **Resolution** | The person's problem is solved or correctly routed | The least restrictive effective rung chosen; protection applied in time |
| **Process** | Correct door, severity and owner; handoff note complete | Triage, conflict check, hold, notice and appeal route all present |
| **Communication** | Plain language, accessible, empathetic, no jargon | Plain notice, correct appeal route, no scores, no reporter detail |
| **Documentation** | Case note a stranger could follow | Rationale recorded in two sentences |

**Sampling.** Proposed starting point: review at least 10 % of closed cases, with a floor of five per
person per week, plus **100 % of** P0, any case with a prohibited-action flag, every A2/A3 grant, and
every identity reveal. Sample by stratified random draw, so reviewers are not choosing. A **QA reviewer never scores their own cases** and is not the person's manager for the same sample.

**Calibration.** Monthly: the team scores the same five cases independently, then discusses
differences. Score divergence above a set margin means the rubric is ambiguous, not that a person is wrong. **QA of QA:** a second reviewer re-scores a random 5 % of QA scores quarterly.

**Use of results.** QA drives coaching, macro and KB fixes, and training needs. It is never the sole input to a
disciplinary decision, and an auto-fail on a *privacy* item goes to the privacy owner, not only to the manager.

### 7.4 Customer satisfaction, resolution and repeat contact — definitions that survive the privacy design

**CSAT.**

- One question and an optional comment, sent on resolution; accessible; no timer.
- **Not sent** on safety, harassment, marketplace-safety or privacy-incident cases. A person in those
  cases gets a human follow-up from the owner instead; a survey is the wrong instrument.
- Report CSAT with the response rate and the number of responses; suppress small cells.
- CSAT is a signal about the *experience*, and is never used to rank people or as a pay input.
  A dissatisfied response is read by a person and answered through the same door.

**Resolution time.** Report median and 90th percentile (never mean alone), by category and priority.
`Resolved` means the person's problem is solved or correctly routed and the person has been told;
`Closed` is the student's act (the built rule: only the student closes a ticket). Report
**both** and the share resolved but never closed.

**Repeat contact.** The identity-free queue means Semester **cannot count one person's repeat
contacts by account**, and should not try. Three measures stand in:

1. **Reopen rate** — a resolved ticket reopened by the person within 7 days (the thread is theirs, so this is measurable without identity).
2. **Issue recurrence** — the same issue fingerprint (category, error code, article id) across the cohort within 14 days. A rising fingerprint is a defective product or article, not a difficult student.
3. **Per-person recontact** — only inside one continuing thread, by the person's own continuation.

Report the measurement limit next to the number. Do not add a persistent identifier to the queue to get a better chart.

**Escalation metrics** (rate, bounce-back, missed escalation, time in escalation) are read together.
A low escalation rate with a high *missed-escalation* rate is the dangerous pattern, so the QA
reviewer reports them as a pair.

### 7.5 Reporting and use

| Audience | Content | Cadence |
| --- | --- | --- |
| Support and T&S leads | Backlog age, attainment, QA, reopen, recurrence, escalations | Weekly |
| Founder / executive | Attainment, P0/P1 count, missed escalations, access review timeliness, training currency | Weekly |
| Privacy owner | Access grants, anomalies, reveals, complaints | Weekly |
| Product | Issue recurrence, top fingerprints, defective articles | Weekly |
| Institution (where agreed) | Aggregate, tenant-scoped, small-cell suppressed; no individual | Per agreement |
| Public | Only what has MEASURED evidence filed under `docs/evidence/` | Never ahead of evidence |

A metric moves from `SPECIFIED` to `PROBED` when a named owner reads it on its cadence, and to `MEASURED` only
when its history is filed (the rule `SLO-5` already follows).

---

## 8. Status-page and incident communication procedures

### 8.1 What exists

| Asset | State |
| --- | --- |
| Status page `app/public/status.html` | Checks from the reader's browser; `public/sw.js` passes its requests straight to the network (#902). **BUILT** |
| Incident feed `app/public/status-incidents.json`, RSS `status-feed.xml` | Written by hand; `incidents` is empty and `updated` is `2026-09-30T00:00:00Z` at this revision. **BUILT** |
| `app/src/lib/governance/incident-comms.ts` | `compose()` refuses a missing section, a left-in `[BRACKET]`, speculation or legalese, and an empty or out-of-range required field. **BUILT** |
| `governance_incident_notices` | Records every notice as sent; enforces the rules again; refuses a next-update beyond the audience's cadence and a notice missing its approvers; a notice to every school is readable by every school's auditor; kept until the school is removed, and indefinitely if sent to all. **BUILT** |
| [`INCIDENT-COMMUNICATIONS.md`](operating-model/INCIDENT-COMMUNICATIONS.md), [`INCIDENT-RECOVERY-PLAYBOOK.md`](INCIDENT-RECOVERY-PLAYBOOK.md), [`trust/SECURITY-INCIDENT-RUNBOOK.md`](trust/SECURITY-INCIDENT-RUNBOOK.md), [`trust/INCIDENT-RESPONSE-PLAN.md`](trust/INCIDENT-RESPONSE-PLAN.md) | Phases, audiences and the technical response. **BUILT** (documents) |
| Subscriber notifications | Owed — master register `SRE-010`. **Gap** |
| Founder tabletop | `docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md`. One exercise exists; no multi-person drill |

### 8.2 Roles

| Role | Duty | Rule |
| --- | --- | --- |
| **Incident commander (IC)** | Declares, owns decisions, owns the status page | May combine hats; never approves a security or privacy statement alone |
| **Communications lead** | Drafts through `compose()`; maintains the cadence | May be the IC when there is one person; then a second person approves a security or privacy notice |
| **Domain owner** | Facts and mitigation for their area | Provides *verified* statements only |
| **Counsel** | Approves any statement about data exposure, legal duty, or regulator contact | **[COUNSEL]** — required for security and privacy audiences |
| **Scribe** | Timeline and decisions, with times | Never the IC |
| **Institution liaison** | Informs each affected institution's named incident contact | Every audience except scheduled maintenance |

### 8.3 Deciding whether and where to post

| Situation | Public status page | In-app banner | Institution notice | Individuals | Approvers |
| --- | --- | --- | --- | --- | --- |
| Core workflow down or degraded for a cohort | **Yes** | Yes | Yes | — | IC |
| Single person's problem | No | — | — | Ticket thread | — |
| Integration data delayed or stale | Component note | Stale labels stay visible | Yes | — | Integration owner |
| Accessibility barrier on a core task | Yes, with the accessible alternative | Yes | Yes | — | Accessibility lead |
| AI quality incident | Yes: which outputs to distrust; whether the feature is paused | Yes | Yes | — | AI platform lead + AI governance chair |
| **Security incident** | After approval, minimal and factual | If action is needed | Yes | As counsel determines | Security owner + Legal |
| **Privacy incident / staff-access misuse** | After approval, minimal and factual | If action is needed | Yes | **Direct notice to each affected person, as counsel determines** | Privacy owner + Legal |
| **Community safety incident** | Only if platform-wide | Yes, with the campus crisis contact | Yes | Affected individuals via their door | T&S lead |
| **Marketplace / sponsor safety incident** | When users are affected | Yes | Yes | Affected parties | T&S lead + Legal |
| **Support capacity incident** (queues beyond capacity) | A component note: "support is slower than usual", with an honest expected response | Banner on Help | Yes, if their operators are affected | — | IC |
| Individual T&S enforcement, a named person, a report's content, a staff misconduct case | **Never** | Never | Only via the escalation process | Via the case notice | — |
| Scheduled maintenance | Yes, 24 h ahead | Yes | Yes | — | Operations lead |

### 8.4 States and wording

**Incident states:** `Investigating → Identified → Monitoring → Resolved` (and `Postmortem
published`). **Component states:** `Operational`, `Degraded performance`, `Partial outage`,
`Major outage`, `Under maintenance`. Each state change is a dated entry; entries are not rewritten.

**Every message says the seven things** already required: what happened, who is affected, what
data or workflow is affected, what you should do now, what Semester is doing, the next update
(a time, even if nothing will have changed), and where to get help. Plus, for the audiences with
required fields: data exposure *Not indicated / Suspected / Confirmed / Unknown*; last successful
sync; accessible alternative route; outputs to distrust; campus crisis contact; whether the
person's work is affected.

**Rules of voice.** Plain, calm, dated with a timezone; no speculation; no legalese; no blame; no
promise of an extension or a refund (an institution decides deadlines); never "we are monitoring" for
emergencies; the message works with a screen reader and stands alone in an RSS item; an outage
message names a safe workaround only if it has been verified safe.

### 8.5 Timing

Cadence per audience is **BUILT** and enforced (table in `INCIDENT-COMMUNICATIONS.md`: 1 h for student
outage, institution outage, security, privacy and community safety; 4 h for integration, accessibility,
AI quality and marketplace safety; 24 h for maintenance and rollback). The following timings are
**SPECIFIED, proposed internal objectives** within published staffed or on-call hours:

| Moment | Objective |
| --- | --- |
| Declaration → first notice (P0/P1, user-affecting) | ≤ 30 min, sooner if known; a short true notice beats a late complete one |
| Security / privacy: first notice | When the IC, owner and counsel have approved the *minimal* statement, never later than counsel's determination **[COUNSEL]** |
| Updates | At the audience's cadence even if nothing changed |
| Resolution notice | Within 1 h of confirmed recovery |
| Post-incident summary (P0/P1) | ≤ 5 business days; full blameless review ≤ 10 business days |
| Correction of a wrong statement | Immediately, as a dated entry; never silently edited |

**Regulatory and contractual notification clocks** (for example, fixed windows in privacy or breach
laws and in customer agreements) are determined by counsel for the facts, jurisdictions and contracts
involved **[COUNSEL]**. This document states none of them, and staff do not decide whether one has started.

### 8.6 Procedure

1. **Declare.** IC records severity, scope hypothesis, time declared, and the audience(s) in the case.
2. **Contain** first; notify second for a security or privacy matter, unless counsel says otherwise.
3. **Draft** every external message through `compose()`; fill every field; resolve every `[BRACKET]`.
4. **Approve** by the audience's approvers (the database refuses a notice that names fewer).
5. **Publish** to the status page and feed; the in-app banner; the institution contacts. Record the
   notice (`governance_incident_notices`).
6. **Hold the cadence.** The scribe sets the next-update timer when each message goes out.
7. **Resolve** with the resolution message and a statement of what is *not* fixed.
8. **Review.** Blameless; timeline, root cause, what slowed detection or communication, what is
   changed, who owns it, by when; link the known-issue entry, KB article, release note and metrics.
9. **Update the knowledge base** and macros; close the support tickets with the same message.

### 8.7 Drills

A tabletop each quarter, rotating scenarios, each with named participants and recorded results, and at
least one with **no founder present**. Scenarios: sign-in outage for a cohort; stale integration data
before a deadline; AI output error; cross-tenant read; staff-access misuse report; community safety
incident with a missing campus contact; marketplace safety incident; support capacity incident during
registration week; a false or contested public statement. Each drill produces: the notices composed,
the approvals recorded, what was slow, and fixes — filed as evidence.

---

## 9. Training and certification

### 9.1 Principles

1. **Access follows certification.** A capability is granted only with a current certification record, and lapses when the record does.
2. **Practice, not attendance.** Assessment is a scenario in a sandbox tenant with seeded fake data, not a completed slide deck.
3. **The prohibited-actions test is binary.** Any miss on a privacy, consent or prohibited-action question fails the assessment regardless of the overall score.
4. **Wellbeing is part of the job.** Exposure limits and recovery are taught and enforced.
5. **Training content is a controlled document** with an owner, version, date and expiry; High-risk content is reviewed by counsel **[COUNSEL]**.

### 9.2 Tracks

All tracks are **SPECIFIED** except the volunteer calibration, which is **BUILT**
(`app/src/community/volunteer.ts`).

| Track | Core modules | Practical assessment | Pass | Recertify | Unlocks |
| --- | --- | --- | --- | --- | --- |
| **Core (everyone, volunteers included)** | Data classification and the six classes; privacy and student-records basics (content per counsel); the prohibited actions (§3.9); social-engineering resistance; accessibility and inclusive support; AI-use rules; incident basics; code of conduct and confidentiality; how to report a concern about a colleague | Written scenario set | ≥ 90 %, **100 % on privacy / prohibited-action items** | 12 months, and after a policy change | Knowledge base, no data |
| **S1 — Support agent** | Door rules (§1.1), taxonomy and routing, severity and escalation, ticket tool, macros, the identity ladder, writing for accessibility, what support never advises, handoff notes | Eight sandbox tickets incl. a phishing "from the institution," a distressed student, a request to "just look," a mis-routed report | ≥ 85 % rubric, zero auto-fail; supervised shadow period before solo | 12 months | A1 queue; request A2 |
| **S2 — Support specialist** | JIT access (§3), scope catalog, masked views, billing and sync diagnostics, redaction, review duty | Sandbox grant lifecycle, an out-of-scope read attempt, a review of a colleague's grant | ≥ 90 %, zero auto-fail | 6 months | A2 use; request A3 |
| **TS-1 — T&S professional** | Taxonomy, triage thresholds, ladder, evidence handling and custody, E2 stop-view, reason codes, notices, conflicts and recusal, reviewer wellbeing | Gold set; ten sandbox cases at P3–P2 incl. brigading and a bad-faith report | ≥ 85 % agreement with the gold set, zero auto-fail; second-review period | 12 months | P2/P3 decisions |
| **TS-2 — P1 decisions** | Safety and crisis (clinical-advisor-reviewed content), harassment and stalking, hate, escalation policy, working with an institution | Scenario simulations with a clinical advisor and counsel observer | ≥ 90 %, zero auto-fail | 6 months | P1 decisions; second reviewer |
| **TS-3 — Senior** | P0 handling, restrictions, appeals, identity reveal, escalation approval, calibration leadership, override review | Appeal reviews on gold-set appeals; an escalation-payload exercise | ≥ 90 %, zero auto-fail | 6 months | P0 restriction; appeals; second professional |
| **IC — Incident commander** | Incident process, comms with `compose()`, approvals, regulators and customers (counsel-delivered), blameless review | A drilled P0 with a security audience and a privacy audience | Observed, rubric | 12 months and each drill | Declaring; publishing status |
| **PO / SO — Privacy / Security owner** | Data rights, holds, access review, audit chain verification, takeover handling | Access review; a hold placement and release; a data-rights request with a hold | ≥ 90 % | 12 months | Domain approvals |
| **QA reviewer** | Rubrics, calibration, sampling, bias in scoring, giving feedback | Calibration against a scored set | Agreement within the margin | 12 months | QA scoring |
| **Volunteer reviewer** | Guidelines, categories, P3 and clear P2 only, blind view, recusal, confidentiality agreement | 20 onboarding tasks | **≥ 85 % (17/20)**; quality = last 20 control tasks, 5 points each; active ≥ 85, probation 75–80, paused < 75 | Continuous (controls) | Blind tasks; caps 20 an hour, 100 a day |

### 9.3 Maintenance

- **Triggers for retraining** beyond the calendar: any involvement in a privacy incident, a QA auto-fail,
  a policy or tool change that touches the track, or 90 days without handling a case in the tier.
- **Drills** (§8.7) count toward IC and T&S recertification.
- **Calibration** monthly for T&S and QA.
- **Lapse.** A lapsed certification removes the capability the same day. Re-certification is the
  assessment again, not a signature.
- **Records:** person (pseudonymous in reports), track, version, date, score, assessor, expiry, and
  the seat it unlocks. The record is evidence, retained for the person's engagement and as counsel sets **[COUNSEL]**.

### 9.4 Conduct

- **Confidentiality and acceptable-use agreements** are signed before any access; volunteers already sign one.
- **Sanction ladder** for misuse: retraining → suspension of access pending review → removal of role → referral
  (counsel decides on any external report) **[COUNSEL]**. A privacy-owner finding of intentional misuse is
  not resolved as "coaching."
- **A channel to raise a concern about the team or the founder** that does not run through the chain
  of command, for staff and volunteers.
- **Vetting** appropriate to the tier (for example, background checks for TS-3, A3 and incident roles), as law permits **[COUNSEL]**.

### 9.5 Reviewer wellbeing and exposure

- **Volunteers never see** P0/P1, hate, doxxing, minors, sexual content, stalking, contextual
  harassment, appeals or escalations (**BUILT**).
- **Default blur and text-first** for any reported media; reveal is a choice and counted.
- **Exposure limits**: a cap on severe-content minutes per shift, rotation off the highest-severity work after
  a set number of cases, and no solitary E2 viewing beyond what classification needs.
- **Debrief** after any P0, and a standing offer of support; access to professional counselling is a
  benefits and employment question **[COUNSEL]**.
- **Opt-out without penalty** from the highest-severity queue, and a return path.
- **Wellbeing is measured as aggregate** (team-level) and used to staff, never to evaluate a person.

---

## 10. Data retention, evidence and the legal / counsel review queue

> **All retention periods are candidate rules, not legal conclusions.** They need qualified
> review for the actual entities, customers, ages, data roles and jurisdictions
> ([`trust/DATA-RETENTION-AND-DELETION-STANDARD.md`](trust/DATA-RETENTION-AND-DELETION-STANDARD.md)). The built figures come from
> [`RETENTION.md`](../RETENTION.md).

### 10.1 Retention map for support and T&S records

| Record | Built rule | Gap or proposal |
| --- | --- | --- |
| `support_tickets`, `support_ticket_messages`, `support_notification_outbox` | Deleted with the account (`forget_my_support_tickets`); messages and delivery intents go with their ticket. **No time-based purge of closed tickets exists** | **DECISION, COUNSEL.** Candidate: purge ticket text 12 months after close; keep only the fingerprint, category and timing as aggregate. Privacy and accessibility tickets: retain the *record that a request was handled* as counsel advises. A retention period must be set before the flag turns on for a real cohort |
| `support_access_grant` | Unreadable on withdrawal, revocation or its 7-day expiry; removed with either account or the school. No scheduled purge | Add an expiry purge that keeps the event record |
| `support_access_event` | **Kept as long as the student's records** — deliberately not on the 3-year clock (a record of disclosure belongs with the record disclosed) | Extend the same rule to staff sessions (A2/A3) |
| `console_audit_event`, manifests, verification | **Never swept**; hash-chained; signed daily manifest; nightly verification | Confirm a counsel-approved retention for the personal data inside (actor ids) |
| `approval_request`, `approval_decision` | Kept as long as the accounts they name; **a requester's or approver's rows go with that account (cascade)** | **Gap:** a departing staff member's deletion removes the approval record that evidences their own use of privileged access. The hash-chained audit event survives. Mitigation: place the account on hold before offboarding whenever a review or complaint is open (T21); consider retaining the rows with the actor cleared |
| `break_glass_grant`, `console_action_record` | Every emergency access ever opened is kept with ticket, expiry and review; goes only with the subject's account; `console_action_record` clears only its actor column | Same cascade question as above |
| `human_overrides` | Kept until the school is removed; the person is cleared, not the override | Wire the moderation producer |
| `community_reports` | 90 days after it was made, once no case holds it | — |
| `community_cases`, decisions, events, signals | 90 days after a no-action close; **1 year** after enforcement or an appeal decision; open and appealed are never swept | — |
| `community_identity_grants`, `community_escalations`, `community_volunteer_votes` | With the case | — |
| Escalation deliveries | A delivered copy is swept after **90 days** | — |
| `community_safety_entries` | 1 year; reversed, not deleted, on a granted appeal | — |
| `community_volunteer_tasks` | 1 day if never answered; 1 year once answered | — |
| `community_media` | With its post; 1 day if never uploaded; **a known-abuse match is never deleted by any sweep or by account deletion** | Counsel's runbook decides what happens next |
| `moderation_audit_event` | **3 years**; stores pseudonyms, never complaint text | — |
| `data_subject_request` | Deleted with the account | **Gap:** the proof that a request was handled is itself deleted with the account. Candidate: keep an identity-free completion record (a `data_requests` row already holds the fact an erasure completed) **[COUNSEL]** |
| `legal_holds` | Kept until the school is removed; never deleted | — |
| `governance_incident_notices` | Until the school is removed; indefinitely if sent to every school | — |
| Training and certification records | — | Candidate: engagement plus a counsel-set period **[COUNSEL]** |
| QA scores and CSAT responses | — | Candidate: per-case QA detail 12 months; CSAT aggregate only |
| Status incident history | Public file | Keep; never remove, only correct with a dated entry |

### 10.2 Evidence integrity requirements

These restate §4.5 as retention obligations.

1. **Capture by the system** at the earliest of report, detector hit or protective action; never by screenshot.
2. **Hash on capture** (SHA-256); a perceptual hash for media; custody events carry hashes, not account ids.
3. **Append-only.** Evidence is never edited; a working copy is a marked derivative.
4. **Restricted store, view-only.** No download; each view logged; E2 follows stop-view.
5. **Preserve both sides'** material equally.
6. **Record gaps** as gaps.
7. **Hold-aware.** A legal hold stops deletion and sweeps for what it covers and refuses deletion of a held
   account; release is recorded once, and the approved schedule resumes.
8. **A deletion that fails fails closed,** stays visible and escalates; it never reports success.

**What holds reach today** (from the hold migrations): the invite, abandoned-sign-up and audit sweeps; the
AI-runtime and Community sweeps for a school or account hold; the integration retention sweep for a
connection on hold; and account deletion (refused for a held account). **Not covered, by lack of a subject:** the
escalation deliveries and the volunteer programme's own events follow only the platform-wide gate. A school hold does not keep them.
They are programme records, not records of a person; **counsel should confirm that is acceptable.**

**Preservation triggers (a hold is considered, by counsel, when):** a legal process or credible threat of
it; a regulator contact; a safety matter that may lead to proceedings; a privacy incident; a staff misuse
finding; a dispute with a customer; a request from law enforcement.

### 10.3 Legal and counsel review queue

[`LEGAL-REVIEW-QUEUE.md`](../LEGAL-REVIEW-QUEUE.md) is the company's queue, with rows L0–L2 and the intake template at
[`legal-drafts/LEGAL-REVIEW-INTAKE-TEMPLATE.md`](legal-drafts/LEGAL-REVIEW-INTAKE-TEMPLATE.md). It has a records,
retention, deletion, legal-hold and law-enforcement row (L1) and an accessibility row (L0). It has **no rows specific to the
operations designed here.** The matters below need a row and an owner; they are **proposed additions**, not edited into the
queue by this document.

| # | Matter | Why counsel | Blocks |
| --- | --- | --- | --- |
| Q1 | Support-access consent and the institution's role: when a student's grant suffices for `education-record` data; school-official status | FERPA and contract analysis; per tenant | Any A2 on education records |
| Q2 | Mandatory reporting, duty-of-care and duty-to-warn determinations | Differs by jurisdiction, role and the institution | Safety playbook go-live |
| Q3 | The imminent-harm exception (§5.3) | Overrides a two-person rule | Exception go-live |
| Q4 | Law-enforcement, subpoena, preservation and emergency-disclosure procedure | Verification, scope, notice to the user, records | Any disclosure |
| Q5 | Evidence standard, notices and appeals language | Fairness and defensibility of platform enforcement | T&S launch |
| Q6 | Handling of E2 material and any statutory reporting and preservation duty | Statutory; counsel owns | Media upload at scale |
| Q7 | Marketplace platform role (merchant of record, agent, facilitator), consumer-protection and tax | Defines the dispute remedy and liability | Any marketplace transaction |
| Q8 | Vendor or partner support staff (T1 or after-hours safety triage) | Subprocessor terms; binding §3 on their staff | Any outsourced support |
| Q9 | Reviewer wellbeing, background checks, employment and volunteer status | Employment and labor law | Staffing T&S |
| Q10 | Retention periods in §10.1 | Schedule approval | Ticket flag; production personal data |
| Q11 | Breach and incident notification determinations | Fixed external duties | Security and privacy audiences |
| Q12 | Staff-misuse sanctions and any external report | Employment and criminal-law exposure | — |

**Requirements of the queue as a tool (T12).**

- **Items are held by reference.** The queue stores the case id and a minimal description. It does not
  copy evidence, and a matter's privileged material is marked and kept in counsel's own system.
- **Intake fields** are those of the existing template: requester and backup; decision needed; the deadline's
  *legal* source (business preference is not a legal deadline); jurisdictions and ages; the facts; the evidence
  with its hash; questions; and the permitted use after review.
- **Triage** follows the template: *critical* — stop the affected action, escalate immediately; *high* —
  qualified review before commitment; *standard* — confirm version and authority.
- **Counsel service levels (proposed internal objectives):** acknowledge critical items the same day within
  published hours; first view of high items within two business days; standard items within five.
- **A decision is recorded in the system** — reviewer, scope, advice or decision, approved language, assumptions,
  required actions, prohibited actions, owner, expiry, re-review trigger — not only in chat or email.
- **Nothing closes because a draft exists;** an item closes when the right reviewer has reviewed the identified
  version and an authorized approver records the permitted use.
- **Staff never answer counsel's questions to others,** and never give legal conclusions. Neither does an AI assistant.
- **A queue report** goes to the founder weekly: open by priority, age, blocked launches.

### 10.4 Law-enforcement and legal-process procedure

1. **One intake address;** the acknowledgement is fixed; staff do not confirm that an account exists.
2. **Counsel verifies** the requester, the authority and the scope, and decides what, if anything, is disclosed **[COUNSEL]**.
3. **Preservation requests** become a hold, recorded in `legal_holds`, with scope (account, school, platform).
4. **Emergency disclosure requests** go to counsel and the senior professional on duty at once; the
   decision and the minimum disclosed are recorded.
5. **Notice to the affected person** — whether, when and how — is counsel's decision.
6. **A log** of every request, decision and disclosure is kept, and drives a counsel-approved transparency report.
7. **Disclosure uses the minimum necessary payload** and the allowlist discipline of the escalation policy.

---

## 11. Gap register and release gates

### 11.1 Register

Ordered by what blocks what. Owner is a *function*; the person is today Harrison Rubin for each and is the
risk. Exit evidence is what must be filed, in the repository's convention.

| ID | Gap | Why it matters | Owner | Exit evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| G-01 | **A second named human** for support, T&S and incident command; an independent reviewer; counsel | Every two-person control is off without one | Founder | Named roster; one supervised week by the backup | Phase A |
| G-02 | Ticket retention period | `RETENTION.md` says so in bold | Privacy owner + counsel | Approved schedule; purge sweep with a run record | Ticket flag |
| G-03 | Ticket clock basis (wall-clock vs staffed hours) | Publishing "24 h" is a promise either way | Support lead | Decision; function updated and tested | Ticket flag |
| G-04 | Named owner and published hours for the queue; SLO-5 read weekly | `SLO-5` is `UNPROBED` | Support lead | A week's attainment filed | Ticket flag |
| G-05 | Production deployment and staffed UAT of ticket notifications | Already listed as outstanding | Support lead | Live receipt, operator reply, student readback | Ticket flag |
| G-06 | Crisis notice and "Report this instead" in the ticket composer | A harm report must not wait in a how-to queue | Product | Test + screenshot | Ticket flag |
| G-07 | Staff A2 session design, table, banner, scope catalog | The only way staff read a student's record | Security + product | Migration, check, negative tests, drill | Any A2 |
| G-08 | Student-visible staff access history | The student is the control | Product | Reader + test | Any A2 |
| G-09 | Anomaly alerts to the privacy owner and independent reviewer | Prevents a team grading its own use of access | Privacy owner | Alert fires on a seeded case | Any A2 |
| G-10 | Certification gates capabilities | Access without training is the failure | Support / T&S leads | Seat refused with a lapsed record | Any A2 |
| G-11 | Cascade deletion of approval rows with a staff account | Misuse evidence could be removed by leaving | Security | Hold-before-offboard procedure and/or retained rows | A3 |
| G-12 | Attachment scan and quarantine for tickets | Metadata strip exists; scan does not | Security | Test | Attachments on |
| G-13 | Appeal filing window and decision deadline | The code has no clock | T&S lead | Decision; function; test | T&S launch |
| G-14 | Imminent-harm exception and welfare-check procedure | A two-person rule can be too slow | Counsel + T&S | Counsel memo; drill | Safety playbook |
| G-15 | Wire moderation into `human_overrides` | Override patterns have no producer in this domain | T&S lead | Producer + test | Quarterly review |
| G-16 | Professional-grade gold set and QA module | Consistency is claimed, not measured | QA reviewer | Gold set; first calibration | T&S launch |
| G-17 | Unified case model and reporting pipeline | Metrics have data but no reader | Product | Weekly report filed | Phase B |
| G-18 | Subscriber notifications for status (`SRE-010`) | Status is pull-only | Operations | Test send received | Phase B |
| G-19 | Multi-person incident drill with no founder | One tabletop exists | IC | Filed drill record | Phase B |
| G-20 | Security / takeover intake and flow | Takeover is the likeliest attack | Security | Flow D tested | Phase B |
| G-21 | Staff-access complaint procedure with an independent owner | The accused's manager must not investigate | Privacy owner | Rehearsed | Phase B |
| G-22 | Institution operator ticket channel | Operators use a different door | Customer success | Channel tested | First institution |
| G-23 | Law-enforcement intake and counsel procedure | No staff disclosure is acceptable | Counsel | Procedure and log | Phase B |
| G-24 | Reviewer wellbeing program | Harm to staff and loss of capacity | T&S lead | Written program; first debrief | T&S launch |
| G-25 | Marketplace dispute workflow, entire | Nothing exists | Marketplace ops | Tables, workflow, Finance controls, drill | Any marketplace transaction |
| G-26 | Direct-RPC call rate limit | Largest open abuse item already recorded | Security | Limit or gateway | Phase C |
| G-27 | Vendor support policy | Binds outsourced staff to §3 | Counsel + founder | Terms; subprocessor listing | Any outsourcing |
| G-28 | School hold does not keep escalation deliveries and volunteer events | Programme records, but counsel should confirm | Counsel | Written position | Phase B |

### 11.2 Release gates

| Switch | Needs (in addition to its own existing gates) |
| --- | --- |
| **`VITE_SUPPORT_TICKETS` for a real cohort** | G-01 (backup), G-02, G-03, G-04, G-05, G-06; Core + S1 certification for everyone on the queue; published hours; one end-to-end exercise (alert → ticket → incident → status → closure) |
| **Any staff A2 grant** | G-07, G-08, G-09, G-10; S2 certification; counsel position on Q1; a second person who can review |
| **Any A3 / break-glass in production** | Two named humans who are not the requester; G-11; a drill; privacy owner assigned |
| **Community moderation with professional review** | G-01 (independent professional), G-13, G-16, G-24; TS-1/TS-2 certified; Q5 |
| **Institution escalation** | Existing: flag, agreement, two professionals; plus Q2, Q4, G-14 decision, a verified campus crisis contact |
| **Volunteer moderation** | Existing flag refuses `production`; plus a senior reviewer, 20+ onboarding items per school, G-24 |
| **Any marketplace transaction** | G-25 entire, Q7, provider approval, Finance two-person control, a drill |
| **Any public claim about support** | The measured evidence is filed under `docs/evidence/`, the public-claims register is updated, counsel has approved the wording |

### 11.3 Sequence, by dependency

1. **Staff the control, not the queue.** Name the second person and the counsel; nothing two-person works before this.
2. **Make the queue honest:** retention, clock basis, hours, composer crisis notice, weekly read of `overdue`.
3. **Decide the open policy questions** in §11.4 so the build has a target.
4. **Build the staff session and its student-visible history** before any staff read of a student record.
5. **Certification gating, anomaly alerts and the review loop,** then the first A2 grant, in a sandbox tenant.
6. **T&S operating loop:** appeals clock, gold set, QA, wellbeing, the first quarterly review.
7. **Status and incident:** subscriber notifications, a drill with no founder present.
8. **Marketplace last,** and only when everything above operates, because it adds money to every other risk.

### 11.4 Decisions needed from the owner

Each has a recommendation. None is decided here.

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Clock basis for first response | Staffed-hours calendar, published, and stated on the receipt |
| D2 | Ticket retention | 12 months after close for text; aggregate only thereafter; counsel to confirm |
| D3 | A2 default and max duration | 30 min / 4 h, no extension |
| D4 | Imminent-harm exception | Adopt, after counsel approves the situations and wording |
| D5 | Appeal window and deadline | 30 days / 10 business days |
| D6 | Whether any staff may read student records before G-07 to G-10 exist | No |
| D7 | Whether to use a vendor for T1 or after-hours safety triage | Not before Phase C, and only with Q8 resolved |
| D8 | Make detector-rule changes two-person | Yes |
| D9 | Where the CSAT survey is not sent | Safety, harassment, marketplace-safety and privacy-incident cases |
| D10 | Whether small-cell threshold is 10 | Yes; revisit with counsel for any institution requiring a different figure |

---

## 12. Source map

This document relies on, and does not replace:

| Topic | Source |
| --- | --- |
| Support model, runbook, on-call | [`commercial/SUPPORT-OPERATIONS.md`](commercial/SUPPORT-OPERATIONS.md), [`engineering-operations/PRODUCTION-SUPPORT-RUNBOOK.md`](engineering-operations/PRODUCTION-SUPPORT-RUNBOOK.md), [`engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md`](engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md) |
| Tickets, service levels, abuse inventory | [`SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md`](SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md), `supabase/migrations/20260928210000_support_tickets.sql`, `app/src/lib/supporttickets.ts` |
| Knowledge base | [`commercial/KNOWLEDGE-BASE-STRATEGY.md`](commercial/KNOWLEDGE-BASE-STRATEGY.md) |
| Support access, break-glass, audit | `supabase/migrations/20260925103000_support_access.sql`, `20260929110000_console_approvals_and_break_glass.sql`, `app/src/lib/ops/console.ts` (`CONTROLS`, duty `support-access`), [`trust/ACCESS-CONTROL-POLICY.md`](trust/ACCESS-CONTROL-POLICY.md), [`SUPPORTER-FAMILY-PRIVACY-MODEL.md`](SUPPORTER-FAMILY-PRIVACY-MODEL.md) |
| Moderation, detectors, escalation, crisis | [`CAMPUS-MODERATION-SOP.md`](CAMPUS-MODERATION-SOP.md), [`CAMPUS-ESCALATION-POLICY.md`](CAMPUS-ESCALATION-POLICY.md), [`CRISIS-RESPONSE-RUNBOOK.md`](CRISIS-RESPONSE-RUNBOOK.md), [`VOLUNTEER-MODERATOR-PROGRAM.md`](VOLUNTEER-MODERATOR-PROGRAM.md), [`COMMUNITY-MEDIA-SAFETY.md`](COMMUNITY-MEDIA-SAFETY.md), `app/src/community/*` |
| Academic integrity | [`operating-model/AI-GRADING-AND-INTEGRITY.md`](operating-model/AI-GRADING-AND-INTEGRITY.md) |
| Data rights | [`DATA-RIGHTS-REQUEST-RUNBOOK.md`](DATA-RIGHTS-REQUEST-RUNBOOK.md), [`trust/DATA-SUBJECT-REQUEST-RUNBOOK.md`](trust/DATA-SUBJECT-REQUEST-RUNBOOK.md) |
| Incidents and status | [`operating-model/INCIDENT-COMMUNICATIONS.md`](operating-model/INCIDENT-COMMUNICATIONS.md), [`INCIDENT-RECOVERY-PLAYBOOK.md`](INCIDENT-RECOVERY-PLAYBOOK.md), [`trust/INCIDENT-RESPONSE-PLAN.md`](trust/INCIDENT-RESPONSE-PLAN.md), [`trust/SECURITY-INCIDENT-RUNBOOK.md`](trust/SECURITY-INCIDENT-RUNBOOK.md), `app/src/lib/governance/incident-comms.ts`, `app/public/status.html` |
| Retention, holds, legal | [`RETENTION.md`](../RETENTION.md), [`trust/DATA-RETENTION-AND-DELETION-STANDARD.md`](trust/DATA-RETENTION-AND-DELETION-STANDARD.md), [`LEGAL-REVIEW-QUEUE.md`](../LEGAL-REVIEW-QUEUE.md), [`legal-drafts/LEGAL-REVIEW-INTAKE-TEMPLATE.md`](legal-drafts/LEGAL-REVIEW-INTAKE-TEMPLATE.md), `supabase/migrations/20260930100000_legal_holds.sql`, `20260930130000_hold_gated_sweeps.sql`, `20260930170000_hold_aware_sweeps.sql` |
| Uptime (a separate matter from support response) | [`trust/SLA.md`](trust/SLA.md) — status `NOT_STARTED` as a commitment |
| Training and launch content | [`LAUNCH-CONTENT-AND-TRAINING.md`](LAUNCH-CONTENT-AND-TRAINING.md) |

**Where this document differs from a source.** It proposes (does not apply) these changes: an appeal
clock (the code has none); a staffed-hours ticket clock (the code is wall-clock); two-person detector tuning (today one
senior reviewer, stamped); and moving the support-access duty from a registered requirement to a built
staff-session mechanism. It treats the one-person staffing reality as a constraint rather than assuming a team.
