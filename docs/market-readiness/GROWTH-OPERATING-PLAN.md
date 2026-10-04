# Growth operating plan

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PLAN — PREPARATION AND REHEARSAL; NO BROAD, PAID OR INSTITUTIONAL-ACTIVATION CAMPAIGN IS AUTHORIZED** |
| Owner | Harrison Rubin — growth, claim and campaign owner. Privacy reviewer, accessibility reviewer, analyst, backup operator, support owner and counsel are **unassigned** (see [PUBLIC-CLAIMS-APPROVAL-REGISTER](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md)) |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Extends | [GROWTH-FUNNEL-SPEC](../commercial/GROWTH-FUNNEL-SPEC.md), [LAUNCH-CAMPAIGN-PLAN](../commercial/LAUNCH-CAMPAIGN-PLAN.md), [INDIVIDUAL-GROWTH-STRATEGY](INDIVIDUAL-GROWTH-STRATEGY.md), [EMAIL-LIFECYCLE](EMAIL-LIFECYCLE.md), [GROWTH-EXPERIMENT-BACKLOG](GROWTH-EXPERIMENT-BACKLOG.md), [EXPERIMENTATION-PROTOCOL](EXPERIMENTATION-PROTOCOL.md), [CONTENT-AND-CHANNEL-PLAN](CONTENT-AND-CHANNEL-PLAN.md), [STUDENT-AMBASSADOR-PLAYBOOK](STUDENT-AMBASSADOR-PLAYBOOK.md), [REFERRAL-AND-SHARING-SAFETY](REFERRAL-AND-SHARING-SAFETY.md), [FIRST-1,000-STUDENTS-ADOPTION-PLAN](FIRST-1,000-STUDENTS-ADOPTION-PLAN.md), [FIRST-10-INSTITUTIONS-TARGETING-PLAN](FIRST-10-INSTITUTIONS-TARGETING-PLAN.md), [METRIC-DICTIONARY](METRIC-DICTIONARY.md), [EVENT-TAXONOMY](EVENT-TAXONOMY.md), [product analytics ethics](../PRODUCT-ANALYTICS-DATA-ETHICS.md) |

## How to read this document

The principles are already decided and are not re-argued here: no dark patterns, no unsupported claims, minimum data, small cells suppressed, claims tied to evidence. What those documents leave open is the **operating layer** — who is reached, what counts as a win for each of them, what is sent and how often, what is posted, what is tested, what is measured and who looks at it. This document is that layer. It adds no capability, no claim and no data collection; it says how the existing ones are used.

Every statement carries one label so a reviewer can tell evidence from intent:

| Label | Meaning |
| --- | --- |
| **[FACT]** | Verified in the repository at the revision above (file named). Not a statement that the thing is deployed, measured or approved. |
| **[DECISION]** | A proposed design or policy choice. Binding only once the owner approves it in the pull request that carries it. |
| **[HYPOTHESIS]** | Something to be tested. No number in this document is a result. |
| **[COUNSEL]** | Requires qualified human counsel review. Nothing here is a legal conclusion. |

### Launch gates (every element below is tagged with the earliest gate it may run under)

These restate the phases in [LAUNCH-CAMPAIGN-PLAN](../commercial/LAUNCH-CAMPAIGN-PLAN.md); they do not loosen them.

| Gate | Permits | Requires |
| --- | --- | --- |
| **G0** | Internal preparation, closed rehearsal on synthetic data, evidence-bounded discovery with qualified institutions, synthetic demos, educational content with no activation implication | Nothing further. **This is the only gate open today.** |
| **G1** | Invitation-only individual beta (CLM-003) | Individual-beta GO; named audience, terms, support, privacy, accessibility and UAT approval |
| **G2** | Named design-partner campaign | Customer permission and named-tenant launch GO |
| **G3** | Broader or paid launch | A separate final GO. **Not currently authorized.** |

The strongest capability status in [CAPABILITY-STATUS-REGISTRY.json](CAPABILITY-STATUS-REGISTRY.json) is `DESIGN_PARTNER` **[FACT]**; its `claimRule` says nothing above that is valid without named-tenant or production evidence outside the repository. **No asset may name a capability whose registry status does not permit the channel.** A growth asset that outruns the registry is withdrawn, not defended.

---

## 1. Full-funnel growth model

### 1.1 Who is being grown, and what they are actually deciding

Six audiences, three of which never share a funnel. Mixing them is the commonest way a measurement becomes meaningless — [GROWTH-FUNNEL-SPEC](../commercial/GROWTH-FUNNEL-SPEC.md) already requires that anonymous visits, local-only starts, signed-in accounts and institution-sponsored participants are not combined without explicit rules **[FACT]**.

| Audience | Decision they are making | Who pays / who consents | Entry gate | Funnel |
| --- | --- | --- | --- | --- |
| **Self-directed student** | "Will this make my week more manageable without costing me privacy?" | Student, free tier first | G1 | Individual |
| **Institution-sponsored student** | "Is this thing my school gave me safe and worth my time?" | Institution contracts; student still consents to notice and controls | G2 | Institutional cohort |
| **Supporter / family** | "Can I help without watching?" | Student grants scoped, revocable access; supporter never recruited through student data | Capability-gated; none live | Consent-led, student-initiated only |
| **Faculty / advisor champion** | "Does this reduce repeat questions and prepare students for meetings?" | None directly; advocates to a buyer | G0 (discovery) | Champion path inside Institutional |
| **Administrator / operator** (registrar, student success, advising lead, IT) | "Can I run a bounded cohort without a new risk?" | Institution | G0 (discovery) → G2 | Institutional |
| **Institutional buying committee** (sponsor, CIO, security/privacy, accessibility, procurement, finance) | "Is this safe, supportable, reversible and worth a decision date?" | Institution | G0 (discovery) | Institutional |

**[DECISION]** Families are not an acquisition channel. Semester does not message a supporter on the strength of anything learned about a student, and does not ask a student for a supporter's contact details to market to them. Family-facing content describes only capabilities whose registry status permits it, and is hold-listed until one does (brief B7).

### 1.2 The individual funnel

States and definitions come from [METRIC-DICTIONARY](METRIC-DICTIONARY.md) and [EVENT-TAXONOMY](EVENT-TAXONOMY.md) **[FACT]**; this table adds the owner, the lever and the stop signal for each transition.

| # | State | Canonical definition (or source) | Lever | Owner | Stop / diagnose when |
| --- | --- | --- | --- | --- | --- |
| I0 | Eligible visit | Visit by an eligible person to a use-case page; no identifier stored | Use-case pages, ambassador QR, advisor referral | Growth | — (diagnostic only; never a success metric) |
| I1 | Intentional start | Student chose to begin; consent/notice shown | Honest CTA ("request an invitation" at G1, "start" afterwards) | Growth | Start rate drops while support contacts about confusion rise |
| I2 | **Setup-activated** | Consent/notice completed plus minimum required setup (`student_activated`) | Manual-first start; one source, not five | Product | Setup abandonment concentrated in one step or one device class |
| I3 | **First win** | Setup-activated student reaches Today, understands one relevant prioritized reversible action and its source/limitations, knows the help route, and intentionally completes, schedules, snoozes or defers it (`student_first_win`) | "Plan my week" manual start | Product | First win reached with no comprehension signal (a click is not understanding) |
| I4 | Day 1 / 7 / 30 meaningful return | Meaningful engagement per dictionary — planning, prioritizing, checklist progress, support discovery. Not a login | Weekly review (opt-in), calendar feed | Product + Growth | Return driven by reminders only, with no meaningful engagement behind it |
| I5 | Weekly prepared action | Weekly engaged student per dictionary | Weekly rhythm | Product | — |
| I6 | Advocacy or upgrade interest | Student-initiated share, referral link use, or upgrade view; never prompted by a countdown | Share an intentional object; ambassador link | Growth | Complaint, "unwanted invite" report or opt-out spike |
| I7 | Respectful exit | Export, delete, or quiet disengagement; each honored promptly | Always-available controls | Privacy/Support | **An exit that is slow or hard is a defect, not a retention opportunity** |

Rule **[DECISION]**: `student_activated` is setup-only and `student_first_win` is the later intentional-action decision. They are never inferred from one another, and a full first-week plan is not an extra first-win gate (this restates EVENT-TAXONOMY). Funnel reports show I2 and I3 as separate columns, always.

### 1.3 The institutional funnel

The stages are the sixteen `SALES_STAGES` in `app/src/lib/gtm/stages.ts` **[FACT]**; the mapping to account status and each stage's exit gate live there, and `salesMoveProblems` refuses a move that skips a gated stage. Growth owns demand **up to and including `qualified`**; Sales and Customer Success own the rest. The handoffs below are growth's obligations.

| Stage group | Stages | Growth's job | Exit evidence growth must hand over |
| --- | --- | --- | --- |
| Create demand | `target_account` | Select accounts (§9.1); research brief | Named account, trigger, committee hypothesis, warm path (or "none — do not fabricate one") |
| Earn the conversation | `discovery` | Relevant, claim-safe outreach and content | Two-way reply, stated problem in the contact's own words |
| Qualify | `qualified` | Qualification scorecard | `SALES_EXIT.qualified`: named champion, stated problem, budget cycle, decision process |
| Support the evaluation | `multi_stakeholder_demo` → `security_privacy_accessibility_review` | Evidence room, role-specific one-pagers, RFP library answers (never from memory) | Committee mapped incl. IT, privacy, accessibility, academic sponsor |
| Hand off | `proposal` → `contracted` | Stop selling; enable | A pilot plan with no readiness problems |
| Prove and renew | `implementation` → `renewal` / `expansion` | Outcome evidence, with customer permission | Signed final pilot verdict with measured outcomes |

### 1.4 What limits growth: capacity, not demand

The existing adoption plan states the binding constraint — support and reliability must be proven per 100–250 students before the next block is opened, and the channel that fails its gate is paused even if sign-ups grow **[FACT: FIRST-1,000-STUDENTS-ADOPTION-PLAN]**. That makes the model a **throughput-limited** one. The worksheet below makes it explicit so a channel decision is arithmetic, not mood. All cells are inputs to be measured; **none is a forecast** and none may be quoted.

```text
Activated(c, t)   = Reached(c, t) × StartRate(c) × SetupCompletion(c)
FirstWin(c, t)    = Activated(c, t) × FirstWinRate(c)
Retained4(c, t)   = FirstWin(c, t) × Week4Return(c)

SupportLoad(t)    = Σc Activated(c, t) × ContactsPerActivated(c)      # tickets per period
Admit(c, t)       = min( Demand(c, t),  (SupportCapacity − SupportLoad(t − 1)) / ContactsPerActivated(c) )

Block opens when: Retained4 ≥ threshold_a  AND  SupportLoad ≤ capacity  AND  no open P0/P1
                  AND  privacy/opt-out/deletion/accessibility guardrails ≤ their thresholds
```

`threshold_a`, `ContactsPerActivated` and capacity are **[HYPOTHESIS]** until the first measured cohort; they are set from that baseline and recorded in the decision log, never chosen to make a plan look achievable. Planned cohort structure is the existing one: 3–5 cohorts of 50–200, never a single campus-wide blast, never above 200 before repeatability is shown, never below 10 where aggregates are reported **[FACT: ICP]**.

### 1.5 Channel portfolio and what each is *for*

| Channel | Funnel stage it serves | Gate | Measured by | Retired when |
| --- | --- | --- | --- | --- |
| Advisor / faculty referral and workshops | I0 → I2 (highest trust) | G1 | Activation and week-4 return of that cohort | Advisor reports pressure or confusion |
| Ambassador and orientation kit | I0 → I3 | G1 | Activated, week-1/4 retention, support rate, opt-out/deletion | Misrepresentation or privacy harm (suspend, review) |
| Use-case and search pages | I0 → I1 | G0 (no CTA beyond invitation/discovery) | Activated starts, **not** traffic | Page claims outrun registry |
| Short-form video | I0 | G0 educational / G1 with CTA | Safe saves/shares, then activation | A post that needs a claim the register forbids |
| Long-form / webinar | Institutional evaluation | G0 | Qualified demos | Evidence expires |
| Lifecycle email and in-app | I2 → I5 | G1 | Meaningful return; unsubscribe and complaint rates | Opt-out alert (§4.6) |
| LinkedIn / direct institutional outreach | `target_account` → `qualified` | G0 | Qualified next step | Contact says stop; any unsupported claim |
| Paid media | — | **G3 (not authorized)** | — | — |

---

## 2. Activation milestones

### 2.1 By persona

"Today" in the last column is what can honestly be measured now **[FACT]**: the server collects exactly three marks — `opened`, `course`, `studied` — one row per account per day per mark, enforced by a check constraint; every other event in EVENT-TAXONOMY is a *proposed* definition under D-005 and enters production only through its own pull request (ANALYTICS.md, migration, `lib/activity.ts`, owner review). Where the honest answer is "device-only" or "not measurable", the table says so; a milestone that cannot be measured is still defined so the instrument can be built to it.

| Persona | M1 Start | M2 Activated | M3 First win | M4 Habit | M5 Advocacy / renewal | Measurable today |
| --- | --- | --- | --- | --- | --- | --- |
| **Self-directed student** | Chooses to begin; sees plain-language data notice | Consent + minimum setup: one course source (manual is fine) | Understands and acts on one recommended, reversible, sourced action; knows where help is | Weekly engaged student over 4 consecutive weeks | Shares an intentional object or uses an ambassador link; or exports/deletes cleanly | M2 approximated by `opened` + `course`; M3–M5 **not** server-measurable; M4 approximated by `opened` frequency |
| **Institution-sponsored student** | Invited by cohort owner; sees which features are institution-visible and which are private | As above, plus acknowledges what the institution can and cannot see | As above | Weekly engaged within cohort | Cohort activation reported only at n ≥ 10 | Same marks; cohort aggregates suppressed below 10 (`MIN_COHORT`) |
| **Supporter / family** (capability-gated) | Student initiates a share; supporter accepts scoped terms | Supporter sees only the scope the student set | Supporter acts on something the student chose to share, with no extra data requested | — (no habit target; "more visibility" is not a goal) | Student renews or narrows the grant at their discretion | Not measurable; **no growth target set for this persona** |
| **Faculty / advisor champion** | Sees a synthetic demo | Completes an advisor-prep workflow with a real cohort (if capability live) or agrees a pilot role | Reports fewer repeat questions or better-prepared meetings — **self-reported, labelled as such** | Uses it in the weekly rhythm agreed in the pilot charter | Introduces a second stakeholder (IT/privacy) unprompted | Qualitative (interview/survey); not instrumented |
| **Operator / administrator** | Attends discovery; names scope | Tenant configured; roles and policy set; owners named | First cohort live with weekly review held | Weekly review held 4 of 4 weeks; open items closed | Requests the midpoint/final review themselves; renewal conversation opened by them | Pilot scorecard (`lib/gtm/pilot.ts`); human-entered |
| **Buying committee** | Sponsor, champion and one technical reviewer on a call | Security, privacy, accessibility review started from the evidence room | Signed charter with decision date and 3–5 leading indicators | Weekly review attended by sponsor at least once | Final verdict signed; conversion or clean offboarding chosen | Pipeline stage + signed verdict |

**[DECISION]** Two rules keep these honest. (1) A milestone is credited only on a deliberate act — an invitation opened, a login, a pageview or a scan is never M1+. (2) For the supporter persona there is deliberately **no growth target**; visibility-seeking is the failure mode for that audience.

### 2.2 By product domain

The domains follow the audit's information architecture (Today, Plan, Learn, Create, Campus, Path, Money, Support, Assistant, Account). "Counts as value" is what a domain milestone credits; "never counts" is what it must not be gamed with. **Capability gate** means the registry status the domain must hold before any growth asset names it.

| Domain | First-value moment | Counts as value | Never counts | Measurement route today | Capability gate |
| --- | --- | --- | --- | --- | --- |
| **Today** | Opens Today and acts on one sourced next action | Action completed, scheduled, snoozed or deferred | Time on screen; scroll depth | Device-only; `opened` server mark | `daily-planning` registry row |
| **Plan** (calendar, tasks, goals, time) | A realistic week exists that the student recognizes as theirs | Student confirms/edits the week; calendar feed subscribed | Number of tasks created | Device-only | `manual-setup` |
| **Learn** (courses, degree, records) | Courses present and deadlines visible | `course` mark; student reconciles one discrepancy | Counting synthetic/sample data | `course` server mark | Per registry; official records stay authoritative in their source |
| **Study** | One study session with a source the student can see | `studied` mark; student rates the session useful | Streaks, minutes, cards "completed" as pressure | `studied` server mark | Per registry; AI features only within tier/provenance rules |
| **Create** (docs, sheets, decks, notes) | A document is saved, exported or restored | Export or version restore works for the student | Document word count; content inspection (never) | Device-only | Per registry |
| **Campus** | A relevant event, place or service is found | Student saves or acts on one item | Location history (never collected) | Not measured | Per registry; content freshness SLO |
| **Path** (career, portfolio) | One portfolio or opportunity artifact exists | Student-created artifact; student-initiated application step | Employer-side scoring of students | Not measured | Per registry; no discriminatory targeting |
| **Money** | A bill or aid item is visible with source and freshness | Student confirms understanding; payment completed in the processor's flow | Payment prompts timed to stress; storing card data | Processor/ledger authoritative | Per registry; counsel/tax items open |
| **Support** | A question reaches a human with the right context | Ticket resolved; student reports resolved | Deflection rate used to hide demand | Tickets (read by people, not aggregated) | Staffed support must exist before any support-adjacent claim |
| **Assistant** | An answer with visible sources the student can check | Student verifies or corrects a source; handoff to a human works | Usage volume per student (never tracked individually) | None by design | Conditional (CLM-011); tier ≤ 1 for any growth demo |
| **Account / privacy** | Student finds and uses a control | Export, delete, quiet-hours or sharing change completed | Friction here is never "retention" | Account lifecycle events | Core controls are never paywalled |

---

## 3. Lifecycle communication map

### 3.1 Principles for the map

1. **Class first.** Every message is exactly one of: **Critical service**, **Service**, **Lifecycle education**, **Marketing**. Class decides consent, cap and quiet-hours behaviour (§4). In the code, `Purpose` is `transactional | marketing` and transactional is **email only** — SMS has no transactional exemption **[FACT: `lib/gtm/messaging.ts`]**.
2. **Default to in-app, then email, then nothing.** A reminder a student created is a service. A tip about a feature is lifecycle education and is treated as marketing for consent **until counsel says otherwise [COUNSEL]**.
3. **When in doubt, send less.** Ignored or dismissed messages reduce frequency; they never escalate it (LC-13).
4. **No subject line, preview text, push body or segment may carry** grades, task or course titles, health/disability information, private conversations or sensitive support context **[FACT: EMAIL-LIFECYCLE]**.
5. **Every send is auditable**: template version, campaign ID, consent version and a `communication.send_decision` event **[FACT: `decideSend`]**.

### 3.2 The map

`Gate` is the earliest gate the message may run under. `Cap` references the policy in §4.3. "Exit" is what stops the stream for that person.

| ID | Stage | Message | Trigger | Channel | Class | Gate | Cap | Must not contain | Exit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LC-01 | Onboarding | Verification / recovery | Student requests | Email | Critical service | G1 | One per request; rate-limited | Anything promotional | Verified or expired |
| LC-02 | Onboarding | Welcome + manual-first start | Account verified | Email + in-app | Service | G1 | Once | Upsell, feature tour beyond "how to start" | Sent once |
| LC-03 | Onboarding | Setup saved | Student saved setup | In-app (email only if asked) | Service | G1 | Per event | Anything beyond confirmation | — |
| LC-04 | Onboarding | Incomplete-setup help | 24–48 h with setup incomplete | In-app card; email **only** if opted in to tips | Lifecycle education | G1 | 1 | Guilt language, counts of "missed" things | Setup completes or dismissed |
| LC-05 | Activation | First-week planning prompt | Setup-activated | In-app (Today card) | Lifecycle education | G1 | 1 per week | Urgency, scarcity | Acted on, snoozed or dismissed |
| LC-06 | Activation | First-win acknowledgement | `student_first_win` | In-app only | Service | G1 | Once | Streaks, scores, comparison | — |
| LC-07 | Engagement | Weekly review | Weekly, student opted in | Email or in-app | Lifecycle education (opt-in) | G1 | 1 per week | Content from the student's own data in subject/preview | Opt-out or 3 consecutive unopened *and* unclicked (then ask once, §3.3) |
| LC-08 | Engagement | Reminders the student created | Student's own rule | Push / in-app / SMS if verified opt-in | Critical service / Service | G1 | Existing tiers (§4.3) | — | Student edits or mutes |
| LC-09 | Engagement | Product news digest | Monthly | Email | Marketing (topic opt-in) | G1 | ≤ 2 / month | Unapproved claims; price | Unsubscribe; sunset (LC-16) |
| LC-10 | Engagement | In-context feature discovery | Student is at the relevant screen | In-app, dismissible | Lifecycle education | G1 | ≤ 1 / session; none for 30 days after dismissal | Anything that blocks the task | Dismissed |
| LC-11 | Risk (stall) | Source disconnected or stale | Connector failure | In-app + email | Service | G1 | Once per incident; resolved notice | Blame; urgency | Reconnected or removed |
| LC-12 | Risk (lifecycle) | Inactivity notice **before** any retention action on the account | Per retention schedule | Email | Service | G1 | Per policy | Pressure to return; threats | Student acts or schedule proceeds |
| LC-13 | Risk (fatigue) | "Want fewer of these?" | Repeated dismissal/ignore of reminders | In-app | Service | G1 | Once per 60 days | A nudge to *increase* notifications | Student chooses |
| LC-14 | Risk (support) | Follow-up on a resolved ticket | Ticket closed | Email | Service | G1 | Once | Survey that gates help | — |
| LC-15 | Win-back | One "what's changed" note | 45 days inactive **and** opted in to product news | Email | Marketing | G1 | 1 | Shame, missed-item counts, fake scarcity | Any engagement or unsubscribe |
| LC-16 | Win-back | Final note + sunset | 90 days inactive | Email | Marketing | G1 | 1, then stop | "We miss you" guilt | **Sunset: all non-service sends stop; account untouched** |
| LC-17 | Win-back | Return experience | Student reopens | In-app | Service | G1 | — | "You've been away N days"; backlog-shame | — |
| LC-18 | Referral | Invite preview and confirmation | Student creates a share | In-app | Service | G1 | Per share | Pre-selected recipients; contact import | Sent, expired or revoked |
| LC-19 | Referral | The invite itself | Sent by the **student**, through the student's own channel | Student-chosen | n/a — not a Semester send | G1 | n/a | Semester does not mail a person who has not asked to hear from it | — |
| LC-20 | Referral | Ambassador summary | Monthly | In-app / email to the ambassador | Service | G1 | 1 / month | Invitee identity or content (counts only) | Ambassador steps down |
| LC-21 | Renewal (individual) | Plus renewal, cancellation and failed-payment notices | Billing event | Email | Critical service | G1 + billing GO | Per event | Retention tricks; hidden cancel route | Resolved |
| LC-22 | Renewal (institutional) | Midpoint and final outcome review; renewal conversation | Pilot calendar | Human-led | Service | G2 | Per charter | Unmeasured outcome claims | Signed verdict |
| LC-23 | Alumni | Graduation and transition notice: export, keep-personal-workspace, delete; what institution-sponsored features end and when | Eligibility change per tenant policy | Email | Service | G2 | Once + reminder at the stated end date | Record-retention conclusions **[COUNSEL]** | Student chooses |
| LC-24 | Alumni | Single invitation to keep a personal workspace/portfolio | After LC-23 | Email | Marketing (opt-in to continue) | G2 | 1 | Anything implying the institution endorses it | Silence = nothing further |
| LC-25 | Alumni | Mentoring / community | Alumnus opts in | In-app / email | Marketing (opt-in) | Capability-gated | Per topic | Employer-side targeting of alumni | Opt-out |
| LC-26 | Offboarding | Export / deletion confirmations | Request completed | Email | Critical service | G1 | Per event | Anything promotional | — |

**Institutional lifecycle messages are human conversations** with a logged owner, not automated streams: discovery follow-up (within 1 business day of a call, restating the stated problem and the limits), evidence-exchange cover note (names exactly which documents and their dates), pilot kickoff, weekly review notes, midpoint, final verdict, offboarding. Template language, if used, passes the claims register like any asset.

### 3.3 Three rules that need stating twice

- **"Risk" means the lifecycle, never the academic record.** Nothing in §3 ranks a student's *performance*, predicts failure, or targets a message at someone because their grades, health, finances or schedule suggest distress. The notification ranking is never "engagement-maximising" **[FACT: `FORBIDDEN_MECHANICS`, `community/governance.ts`]**.
- **Sunset beats persistence.** After LC-16 nothing marketing-class is sent until the student re-opts in. A shrinking list is a healthy list.
- **Three-strikes quietness.** After three consecutive weekly sends neither opened nor clicked, ask once whether the student wants to keep receiving them (LC-13 pattern); the default on no answer is to stop.

---

## 4. Ethical notification and messaging policy

This is the policy the lifecycle map runs under. It builds on the discipline already in code and states what is **enforced today** versus **proposed**, so no one assumes a guard exists that does not.

### 4.1 Message classes

| Class | Definition | Consent needed | Examples |
| --- | --- | --- | --- |
| **Critical service** | Money, registration, security or account integrity is at stake and the date is the institution's or the system's, not the student's | None for email (transactional); **verified opt-in for SMS** | Verification, recovery, failed payment, registrar deadline reminder the student enabled |
| **Service** | The student asked for it, or it confirms/updates something they did or that affects their data | None for transactional email; opt-in for push/SMS | Setup saved, requested reminder, export done, support reply |
| **Lifecycle education** | Helps the student use something they already started | **Treated as marketing for consent [COUNSEL]**; in-app is preferred | LC-04, LC-05, LC-07, LC-10 |
| **Marketing** | Anything that promotes, announces or invites beyond the student's current task | Separate, specific, unticked, versioned opt-in per channel and topic | LC-09, LC-15, LC-16, LC-24 |

### 4.2 Consent

- **[FACT]** Consent is per channel and optionally per topic; the latest record wins and is read at send time, never cached on a campaign; withdrawal applies immediately; the SMS keywords `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`, `OPTOUT`, `REVOKE` withdraw at once, `HELP` changes nothing, and only `START`/`UNSTOP` re-subscribe — never "yes" (`lib/gtm/messaging.ts`).
- **[FACT]** The consent control starts unchecked; nothing is pre-ticked (`ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md`).
- **[DECISION]** Marketing consent is never a condition of using the product, never bundled with terms acceptance, and never inferred from a purchase, a share or an ambassador link.
- **[DECISION]** One-click unsubscribe is in every non-critical email; the preference center is reachable from every message, from account settings, and without signing in via a signed link scoped to that address only.
- **[DECISION]** No marketing to a person flagged or self-identified as a minor, and none to anyone whose age is unknown in a jurisdiction where that matters. **[COUNSEL]**: age thresholds, parental-consent rules, and whether education-record rules affect any list built from an institution's roster. Until answered, **institution rosters are never a marketing list** — institutions invite their own students; Semester does not copy a roster into a marketing system.
- **[COUNSEL]** Applicability of commercial-email, telephone-consumer, privacy and state auto-renewal rules to each class above; whether lifecycle education is marketing; required wording of consent and renewal disclosures. This document does not answer those.

### 4.3 Frequency caps

Caps are per person, per channel. Where a cap is **enforced in code today** it cites the constant; otherwise it is **proposed** and each proposal names the test that would hold it (§4.8). Caps count Semester-originated sends only — a reminder the student scheduled is theirs, not Semester's.

| Channel · class | Cap | Quiet hours | Status |
| --- | --- | --- | --- |
| In-app / push · critical reminders | Not counted, never dropped | Student-set quiet window respected | **Enforced** (`TIER.critical`, `notify.ts`) |
| In-app / push · important reminders | **5 per day** | Student-set quiet window | **Enforced** (`IMPORTANT_CAP = 5`) |
| In-app / push · helpful nudges | **1 per day**, separate budget so helpful can never cost an important its place | Student-set quiet window | **Enforced** (`HELPFUL_CAP = 1`) |
| Push · marketing | **None — not used** | — | **Proposed** (decision) |
| SMS · service/critical reminders | Student-set; verified opt-in required; proposed ceiling **3 per week** beyond verification | Default **21:00–08:00 recipient local** (`DEFAULT_QUIET_HOURS`) | Consent, quiet hours and cap check **enforced** in `decideSend`; the 3/week ceiling is **proposed** |
| SMS · marketing | **None — not used** | — | **Proposed** (decision); email/SMS sending is off for students today |
| Email · critical/transactional | Per triggering event; never bundled with marketing in one message | Not applied | **Enforced** exemption from consent only; suppression still applies |
| Email · lifecycle education (opted in) | **1 per 7 days** | Not applied (email does not interrupt) | **Proposed**; expressible as `FrequencyCap {max: 1, windowDays: 7}` |
| Email · marketing (topic opt-in) | **≤ 2 per month**, and ≤ 1 per 7 days combined with lifecycle education | Not applied | **Proposed** |
| Email · win-back | 1 at day 45 + 1 at day 90, then sunset | Not applied | **Proposed** |
| Institutional outreach · named contact | ≤ 4 touches per 30 days across all channels; **zero** after a "no" or a bounce; one follow-up per unanswered message | Business hours in the contact's time zone | **Proposed** |
| Institution-sponsored students · marketing from Semester | **None** unless the tenant agreement expressly allows a defined message | — | **Proposed** (decision) |

**[DECISION] Stress-window suppression.** During a tenant's published exam period (or, where there is no tenant calendar, the two weeks conventionally treated as finals), *no* lifecycle-education or marketing message of any channel is sent, and no upgrade surface is shown in-app. Service and critical messages continue. The reason is stated plainly: persuasion that lands hardest when a student is most overloaded is exactly the exploitation this plan refuses. A promotional message is never timed to a student's own deadline, because the system does not use deadlines for marketing — they are product data, not growth data.

### 4.4 What is prohibited

Extends `FORBIDDEN_MECHANICS` (daily streaks; leaderboards of attendance or messages; randomized reward loops; hidden ranking; punitive missed-event notifications; pay-to-win club promotion; rewards tied to disclosures) **[FACT]**.

- Fake or resetting countdowns, manufactured scarcity, "only N left", "others like you…" social proof that is not a measured, current, approved fact.
- Confirm-shaming ("No thanks, I don't care about my grades"), guilt, loss-framing about a student's academic standing, fear of failure.
- Pre-checked boxes; a primary button that consents and a greyed-out one that declines; consent buried in terms; "Not now" with no "never".
- Hidden, delayed, or multi-step unsubscribe; unsubscribe that requires login; "reply STOP in capitals".
- A reply-to that is unmonitored; a sender name that implies the institution sent a Semester marketing message.
- Disguising marketing as service ("Your plan is waiting!" when nothing is).
- Notifications whose purpose is to increase session count rather than to serve a reminder the student asked for.
- Any message targeted by, or whose copy reflects, grades, health, disability, accommodation, finances, immigration, conduct, counseling or location.
- Using contact import, address-book upload, or scraping to find recipients.
- Reward, discount or recognition conditional on disclosing information, posting publicly, or recruiting classmates.

### 4.5 Accessibility of messages

Applies to every channel, and to the preference center itself. Target is WCAG 2.2 AA behaviour for the surfaces Semester controls; **no conformance claim is made** (CLM-008) **[FACT]**.

- **Text first.** Every email has a complete plain-text part; nothing essential lives only in an image; images have meaningful alt text; the message works with images off.
- **Plain language and layout.** Short sentences, one primary action, a real heading structure, left-aligned text, sentence case (no all-caps blocks), generous line spacing, a font size that does not require zoom, and a reading-level target set and checked at review **[DECISION]** — the specific target number is for the accessibility reviewer to set.
- **Links and buttons.** Descriptive link text (never "click here"), sufficient contrast in light and dark, visible focus in web destinations, touch targets sized for mobile.
- **No flashing, auto-play audio or motion in messages; honour reduced-motion** in any in-app version.
- **Push and SMS** are legible to a screen reader as a single sentence of meaning, with no reliance on emoji or symbols for meaning; SMS states who is writing and how to stop.
- **Time and language.** Local time zone, date formats and locale respected; no abbreviations that only a native speaker or a "campus insider" would know.
- **Video** has captions (file, not only burned-in), a transcript, and audio description of any on-screen-only action; **audio** has a transcript.
- **The preference center** is keyboard-operable, labelled for assistive technology, works at 200% zoom, announces saves, and never loses a change on a timeout.
- **Help route.** Every message names a human help route; an accessibility barrier report takes the support route for `Accessibility barrier` and is never answered with a sales message.

### 4.6 User controls

A single preference center, shared with My Data (`ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md` plans one preferences object) **[FACT]**, offering:

| Control | Behaviour |
| --- | --- |
| Per channel (email / push / SMS) on-off | Takes effect before the next send decision; not cached |
| Per topic (tips, weekly review, product news, community, events) | Independent; defaults off for marketing and lifecycle education |
| Quiet hours and mute | One setting, reused (`notify.ts` `Quiet`; `contact_channels.quiet_hours`); applies to push and SMS, and to in-app interruptions |
| Reminder volume | "Fewer reminders" lowers the in-app caps; never raises above the defaults |
| Pause all non-service messages for 7 / 30 / 90 days | Resumes only if the student leaves it set to resume |
| Export and delete | Always one tap from preferences; honored promptly; never paywalled |
| "Why did I get this?" | Every message links to the rule, the consent version and the trigger |
| Plain-language log | Last 30 days of Semester-originated messages, visible to the student |

### 4.7 Stop signals and alerts

- **[FACT]** `optOutAlert` raises a review when the opt-out rate exceeds **0.1%** of at least 1,000 delivered messages; a review means frequency, relevance and consent, not "send fewer subject-line tests" (`lib/gtm/kpi.ts`). Below 1,000 delivered, one opt-out is noise and is read, not rated.
- **[DECISION]** Also pause the stream and review when: any complaint or abuse report arrives from a student about being messaged without consent; the sending provider's published complaint or bounce thresholds are approached (read the current provider values at the time — not restated here); an accessibility blocker is reported in a template; a message is found to contain a prohibited field; or support contacts about *messaging* exceed the review threshold set at baseline.
- **[FACT]** `DIRECTIONAL_BENCHMARKS` are references **beside** a tenant's own baseline, never targets, and open-rate is not optimized because mail-privacy features inflate it.

### 4.8 What is enforced, what is not, and how it will be held

| Rule | Enforced today? | Where / what would hold it |
| --- | --- | --- |
| Consent per channel and topic; latest wins; suppression refuses even transactional | **Yes** | `lib/gtm/messaging.ts`, `messaging.test.ts` |
| Quiet hours (SMS/push); a cap check | **Yes** — one `FrequencyCap` per decision | same |
| Audit event on every decision | **Yes** | `communication.send_decision` |
| Daily in-app caps by tier | **Yes** | `notify.ts` (`IMPORTANT_CAP`, `HELPFUL_CAP`) |
| No streak/leaderboard/shame language in rendered strings | **Yes** | `community/engagement.test.ts` |
| Opt-out alert | **Yes** | `kpi.ts` |
| Proposed per-class email caps and the SMS ceiling | **No** | A table of caps per class in the sender config, with a test that reads this document's §4.3 and fails on drift |
| Stress-window suppression | **No** | A tenant-calendar input to `decideSend`, plus a test that a marketing send inside a window is refused |
| Sunset after LC-16 | **No** | A suppression reason `sunset`, plus a test |
| Win-back count limit | **No** | Same send-history check |

Nothing in the "No" rows may be described as a safeguard in any external material until it is built and shown to fail when removed.

---

## 5. Content, social, creators and community

### 5.1 Content strategy

**Positioning in one line (Messaging house, unchanged):** a student-owned view that turns scattered academic information into a realistic plan and a next action — an experience and planning layer beside the systems of record, never a replacement for them **[FACT: MESSAGING-HOUSE, CLM-006]**.

The ten content pillars already exist as data in `lib/gtm/social.ts` (`PILLARS`) and each platform's role in `PLATFORMS` **[FACT]**. This plan does not re-list them; it **weights** them by funnel job and gate, so the calendar is not a ten-way even split.

| Pillar (id) | Funnel job | Weight at G0 | Weight at G1 | Notes |
| --- | --- | --- | --- | --- |
| Student clarity (`clarity`) | Awareness, empathy | 20% | 15% | Real friction; no invented statistics |
| Planning (`planning`) | Immediate practical value | 25% | 25% | The anchor pillar; teaches the method independent of the product |
| Study (`study`) | Learning support | 10% | 15% | Methods first; AI only with visible sources and limits |
| Campus connection (`campus`) | Belonging | 5% | 10% | Only with partner permission and fresh data |
| Career momentum (`career`) | Future relevance | 5% | 10% | No promises about outcomes |
| Student stories (`stories`) | Trust | 0% | 5% | **Only with separate written permission**; none at G0 |
| Product building (`building`) | Early adopters, hires, partners | 10% | 5% | Honest "what we shipped / what it doesn't do" |
| Institutional insight (`institutional`) | Buyer education | 15% | 5% | Fragmentation, accessibility, privacy, implementation |
| Community spotlights (`spotlights`) | Reasons to share | 0% | 5% | Permission-based |
| Responsible technology (`responsible`) | Credibility | 10% | 5% | Privacy, provenance, student control, AI boundaries |

Weights are a **[DECISION]** for allocating scarce effort, not a forecast; revisit at the first measured cohort. The rule from `social.ts` stands: a post that leads nowhere useful is not on the list, and a post's path to action must land on a page or screen that exists (`FUNNELS` in `lib/gtm/social.ts`, held by `social.test.ts` **[FACT]**).

**Content types and what each must contain.** Every asset records audience, channel, jurisdiction, objective, CTA, exact claim and its register ID, evidence and expiry, owner, approvers, consent basis, accessibility (alt text, captions, transcript, contrast, keyboard), UTM, schedule, monitoring and takedown path **[FACT: LAUNCH-CAMPAIGN-PLAN]**. Additionally **[DECISION]**:

- **Show, don't claim.** A demo uses synthetic data, labelled as such on screen; a screenshot of a real student's schedule is never used.
- **State the limit in the asset**, not on a page three clicks away ("Semester doesn't replace your registrar; it helps you plan around it").
- **Evergreen over reactive.** No content that rides a news event involving a school, a tragedy, or a named person.
- **CTA ladder by gate.** G0: "read the evidence", "request a discovery call", "request an invitation". G1: "start". Never "Join thousands of students" — there are no thousands, and the plan forbids unmeasured traction claims **[FACT: GROWTH-FUNNEL-SPEC]**.

### 5.2 Editorial calendar

**Weekly rhythm** (owner is one person today; this is the minimum viable cadence and is deliberately smaller than the cadences in CONTENT-AND-CHANNEL-PLAN's upper bounds):

| Day | Work |
| --- | --- |
| Mon | Plan the week; claim-check next week's assets against the register; clear the approval queue |
| Tue–Thu | Publish (1–2 short-form assets during campaigns; 1 long-form or page every 2 weeks; LinkedIn weekly) |
| Thu | Respond to comments/messages inside published hours; log anything needing escalation |
| Fri | Read the weekly growth review inputs (§10.3); record what to stop |

**Rolling 12-week calendar — now through the end of the fall term** (dates are week-start Mondays; academic-calendar notes are generic and **must be replaced by each tenant's published calendar** when one exists — the dates below are not any institution's).

| Week of | Academic context (generic) | Theme | Primary pillar(s) | Asset examples | Gate | CTA |
| --- | --- | --- | --- | --- | --- | --- |
| Oct 5 | Mid-semester | "Where is my week going?" | planning, clarity | Short explainer + planning method one-pager | G0 | Read the method |
| Oct 12 | Midterm season | Study methods that survive a heavy week | study | Active-recall walkthrough (captions + transcript) | G0 | Read the method |
| Oct 19 | Midterm season | Responsible tech: how Semester uses AI | responsible | "AI, in plain language" explainer (CLM-011 conditional) | G0 | Read the evidence |
| Oct 26 | Spring planning starts | Registration readiness | planning, institutional | Registration-readiness checklist; synthetic demo | G0 | Request a discovery call |
| Nov 2 | Advising weeks | "Come to advising prepared" | planning | Advisor-meeting prep guide (method, no product dependency) | G0 | Read the method |
| Nov 9 | Spring registration | Registration, without 20 tabs | clarity, planning | Short-form demo on synthetic data | G0 (G1 adds invitation CTA) | Request an invitation (G1) |
| Nov 16 | Registration | Institutions: a bounded pilot beside your SIS | institutional | Webinar with Q&A; evidence-room walkthrough (CLM-004 conditional) | G0 | Request a discovery call |
| Nov 23 | Thanksgiving week | **Quiet week** — no promotion | — | Evergreen only; support coverage notice | G0 | — |
| Nov 30 | Pre-finals | Plan the last three weeks | planning | Method content only; **no upgrade surface, no marketing sends** | G0 | Read the method |
| Dec 7 | **Finals — stress window** | Silence on promotion | — | Service messages only; accessibility and support reminders | — | — |
| Dec 14 | **Finals — stress window** | Silence on promotion | — | Only service; a "what we built this term" post is held until the window ends | — | — |
| Dec 21 | Break | "What we learned this term" | building, responsible | Honest retrospective: what shipped, what didn't, what we measured (and what we couldn't) | G0 | Read the evidence |

**Annual arc (generic; replace with tenant calendars).**

| Window | Student moment | Institutional moment | Emphasis |
| --- | --- | --- | --- |
| Aug–Sep | Orientation, first week | Cohort onboarding, pilot kickoff | "Plan your first week"; ambassador tables |
| Oct | Midterms | Midpoint review | Study methods; trust content |
| Nov | Registration, advising | Budget and planning cycle begins | Registration readiness; discovery outreach |
| Dec | Finals | Year-end review | **Silence, then retrospective** |
| Jan–Feb | New term; internship season | Renewal planning, pilot proposals | Fresh-start planning; career pillar |
| Mar–Apr | Registration, advising; summer | Procurement windows | Registration readiness; conversion conversations |
| May–Jun | Finals, commencement | Final outcome reviews; renewals | **Silence, then** alumni transition (LC-23/24) |
| Jul | Summer | Implementation work | Product-building and institutional insight |

### 5.3 Social operations

**Approval lanes** (one reviewer is not assigned today; until one is, **Lane B and C cannot run** and assets wait):

| Lane | Content | Reviewer | Turnaround target |
| --- | --- | --- | --- |
| A — evergreen method | Study and planning methods; no product claim beyond register-approved text | Growth owner against a checklist | Same day |
| B — product/claims | Any product behaviour, AI, data, security or accessibility statement | Claim owner + privacy reviewer | 2 business days |
| C — institution-facing | Pricing, integration, partnership, outcome, procurement language | Counsel queue per `LEGAL-REVIEW-QUEUE` **[COUNSEL]** | Per queue |
| D — incident/crisis | Anything arising from an incident, safety event or reputational problem | Incident commander + counsel | Immediate |

**Operating rules**

- **Response.** Public replies and messages answered within published hours — one business day target — with **no 24/7 promise** (CLM-016). A DM that begins to carry private information is moved to the support form; staff never ask for passwords, codes, grades or documents in a DM.
- **Safety.** A post or comment that suggests self-harm, abuse or a crisis is not answered with product content: reply with official campus and crisis resources, escalate to the named owner, and log it. Academic or crisis questions are referred to official services; the account does not advise beyond training **[FACT: STUDENT-AMBASSADOR-PLAYBOOK]**.
- **Errors.** A wrong or expired claim is removed everywhere and logged; a material falsehood enters the escalation path; a correction says what was wrong, plainly, without defensiveness **[FACT: PUBLIC-CLAIMS withdrawal rule]**.
- **Comments and moderation on Semester's own channels.** Remove spam, harassment and doxxing; never delete criticism for being critical; publish the moderation rules (§5.5).
- **UGC and tagging.** Reposting a student's post or image needs their separate written permission each time; permission covers named wording, channel and term.
- **Accessibility.** Alt text on every image, captions on every video, camel-case multi-word hashtags, no emoji as the only carrier of meaning, descriptions of any on-screen-only action.
- **Metrics.** Saves, shares and activation. Followers, impressions and scans are diagnostic only **[FACT]**.
- **Platform terms and minimum ages are respected**; Semester does not target ads (none are run at G0–G2) and never uses student data for targeting **[FACT: NEVER_IN_MARKETING, ADVERTISING-AND-MONETIZATION-POLICY]**.

### 5.4 Creator and ambassador program

Extends [STUDENT-AMBASSADOR-PLAYBOOK](STUDENT-AMBASSADOR-PLAYBOOK.md) and the referral design in `lib/referral.ts` — whose only two outputs are *how many people came in* and *how many are still here*, and which deliberately defers any paid referral until two or three real ambassadors have been tracked by hand **[FACT]**.

| Track | Who | Pay | Gate | Limit |
| --- | --- | --- | --- | --- |
| **Student ambassador** (campus) | A student who runs workshops and tables | Stipend for hours worked — **never per sign-up, per activation or per referral** | G1 | Number of active ambassadors is capped by support capacity, not by ambition |
| **Student creator** | A student who produces content under a brief | Flat fee per deliverable | G1 | Every paid post carries a clear disclosure of the relationship **[COUNSEL]**; content passes Lane B before publish |
| **Faculty / advisor friend** | Advisors and faculty who try it and say so | None | G0 | May speak only as individuals, never as their institution; no institutional endorsement without CLM-013 permission |
| **Organization partner** | A student org or campus group | None / event support | G1 | Written partnership terms **[COUNSEL]** |

**Program rules** (additions to the playbook):

1. **Selection for reach, not status.** Recruit across commuter, first-generation, transfer, adult, disabled and international students; publish how to apply; no rolling invitations to the already-popular.
2. **Training before activity.** Product limits, the claims card, privacy (never request grades, schedules, health, immigration, conduct or private messages), accessibility, referral safety, escalation, crisis referral. A short check, recorded, before any public activity.
3. **Independence disclosure.** An ambassador says plainly they are a student ambassador, not a university official, and that Semester pays them when it does.
4. **Claims card.** Only register-approved wording for the audience and channel; "I don't know" is an acceptable and encouraged answer.
5. **No pressure mechanics.** No quotas, no ranks, no leaderboards among ambassadors, no tiers that rise with sign-ups, no prizes for recruiting.
6. **Kill switch.** Any ambassador can be suspended pending review for misrepresentation, coercion or privacy harm; materials are removed the same day.
7. **Offboarding.** Access, codes and materials are retired; the ambassador's personal data follows the retention schedule.
8. **Minors.** No under-18 ambassadors or creators until counsel answers the age and consent questions **[COUNSEL]**.
9. **Measures.** Activated users, week-1/week-4 retention, workshop completion, support rate, opt-out/deletion rate, accessibility issues, and **reported pressure or confusion** (a first-class metric). Never by the ambassador's individual sign-up count in anything an ambassador sees as a ranking.

### 5.5 Community guidelines (user-facing draft)

For Semester's in-app community and its public channels. Moderation practice is the existing `docs/CAMPUS-MODERATION-SOP.md` and `docs/COMMUNITIES-REGISTER.md`; the text below is the plain-language public version. **[COUNSEL]** must review before publication, including how it relates to terms of service and to each institution's own conduct rules.

> **How we keep this a good place to be**
>
> 1. **Be kind and be specific.** Disagree with ideas, not people. No harassment, threats, slurs or pile-ons.
> 2. **Keep other people's information theirs.** Don't post anyone's schedule, grades, location, photos, messages or personal details without their say-so.
> 3. **Do your own work.** Don't buy, sell or trade assignments, exam answers or exam content. Study together; submit your own.
> 4. **No pressure, no scams, no spam.** No selling, recruiting or promotion without disclosure. Anyone paid by Semester or anyone else says so.
> 5. **Be honest about what you know.** Don't present guesses about policy, grades or deadlines as fact. Your school's official sources win.
> 6. **Say what AI helped with.** If an AI wrote or summarized it, say so; check it before you rely on it.
> 7. **If someone might be in danger, get help.** If you or someone you know is in crisis, contact local emergency services or your campus crisis resources. We will point you to them; we are not a crisis service.
> 8. **Make it accessible.** Describe images, caption videos, avoid walls of emoji.
> 9. **Reports are taken seriously.** You can report any post or person. A person reads it. We tell you what happened to your report where safety allows.
> 10. **You can appeal.** If a post is removed or an account limited, you can ask for a second look, and a different person reviews it.
>
> **What happens next:** first, a removal and a note on why; repeat or serious breaches limit posting; the most serious (threats, exploitation, doxxing) end access and may be referred to the institution or authorities where required **[COUNSEL]**. We never punish someone for reporting in good faith.

**Enforcement ladder** (internal): note and remove → time-limited restriction → account limitation → account removal; every step logged with the rule cited, the reviewer, and the appeal path; severe cases skip steps. **Moderator wellbeing** and a documented escalation to counsel for legal requests are required before any community surface goes beyond invitation-only.

### 5.6 Campaign briefs

Eight briefs. Each names the claim IDs from [PUBLIC-CLAIMS-APPROVAL-REGISTER](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) it may use; any claim not listed is not available. **No brief runs without owner sign-off in the pull request that activates it.**

| Field | B1 · Plan your first week |
| --- | --- |
| Gate | G1 (individual beta) |
| Objective | Get an invited student to a first win in their first session |
| Audience | Invited students; orientation and ambassador workshops |
| Message | "See your week, then do one thing." Manual-first; your data stays yours |
| Claims | CLM-001, CLM-002 (qualified), CLM-003 |
| CTA | Start (invitation holders) |
| Assets | Workshop script; QR card with `loc` code; captioned 60-second demo on synthetic data |
| Consent | Service messages only until opt-in |
| Success | `student_activated` → `student_first_win` rate; week-4 return |
| Guardrails | Opt-out/deletion rate, support contacts per activated student, accessibility blockers, reported pressure |
| Stop | Any guardrail breach; any unsupported claim; support capacity exceeded |

| Field | B2 · Registration readiness |
| --- | --- |
| Gate | G0 (discovery with institutions) → G1 (students) |
| Objective | Institutions: qualified discovery. Students: a saved plan before the registration window |
| Message | "A realistic schedule plan beside your registrar — it doesn't register you or replace it" |
| Claims | CLM-001, CLM-004 (conditional, with prominent conditions); **not** CLM-005/006 |
| CTA | G0: request a discovery call; G1: start |
| Assets | Checklist, synthetic demo, buyer one-pager, evidence-room index |
| Success | Qualified next steps; `plan` saved (when the mark exists); first win |
| Stop | Any hint that Semester registers students, is authoritative, or integrates with a named SIS |

| Field | B3 · Study week, calmly |
| --- | --- |
| Gate | G0 (educational, **no upsell**) |
| Objective | Be useful during a heavy period without exploiting it |
| Message | Study methods; how to plan the last three weeks; where to find campus support |
| Claims | None about the product beyond one register-approved line |
| CTA | None, or "read the method" |
| Rules | **No marketing sends and no upgrade surface during the stress window** (§4.3) |
| Success | Saves and shares; no complaints |
| Stop | Any complaint of feeling targeted |

| Field | B4 · Advisor and faculty champion kit |
| --- | --- |
| Gate | G0 |
| Objective | A faculty/advisor who tries a synthetic demo and names the problem in their own words |
| Message | "Students arrive prepared; you answer fewer repeat questions" as a **hypothesis to test**, not a result |
| Claims | CLM-001, CLM-004, CLM-009 (qualified) |
| Assets | Demo, known-limitations sheet, escalation path, one-page buyer note |
| Success | Discovery conversations that reach `qualified` |
| Stop | Any suggestion of surveillance, risk scoring or replacing advising |

| Field | B5 · Institutional discovery — a bounded pilot beside your systems |
| --- | --- |
| Gate | G0 |
| Objective | Qualified next step with a committee including IT, privacy and accessibility |
| Message | One cohort, one milestone, manual/read-only first, signed decision date, clean exit |
| Claims | CLM-004 (conditional), CLM-009 (qualified), CLM-007 (technical scope only) |
| Assets | ICP-matched outreach; evidence room; RFP library; discovery playbook |
| Success | Stage progress by `SALES_STAGES`; committee coverage |
| Stop | Request for certification, guarantees, 24/7 response or enterprise-wide launch as entry scope (ICP disqualifiers) |

| Field | B6 · AI, privacy and control — in plain language |
| --- | --- |
| Gate | G0 |
| Objective | Earn trust by explaining what Semester does *not* do |
| Message | What data is collected, what is never measured, who can see what, how to export or delete, how AI is bounded |
| Claims | CLM-009 (qualified), CLM-011 (conditional; exact feature, provider, data path, limits) |
| Assets | A readable page; a short captioned video; the never-measured list from `institution-ops.ts` |
| Success | Qualified discovery conversations citing it; no inaccurate-claim reports |
| Stop | Any absolute ("always accurate", "private", "zero-retention") — CLM-012 prohibited |

| Field | B7 · Supporters and family (**held**) |
| --- | --- |
| Gate | Held until a family/supporter capability reaches an eligible registry status |
| Message | When released: "You decide what a supporter sees" — the student leads |
| Never | Targeting parents with student data; fear-based messaging about outcomes |

| Field | B8 · Alumni and lifelong (**held**) |
| --- | --- |
| Gate | G2 and a capability reaching an eligible status |
| Objective | Honest transition: export, keep a personal workspace, or delete |
| Claims | None beyond what exists |
| Notes | LC-23/LC-24 only; no monetization of personal learner data **[FACT: audit pricing note and ADVERTISING policy]** |

---

## 6. Product-led growth loops

A loop is allowed only if **the person who acts gets value first, the person who receives gets value without an obligation, and a student can see exactly what was shared**. Each loop below states those, its privacy shape and its kill criterion. No loop depends on a message Semester sends to someone who has not asked to hear from it.

| # | Loop | Input → action → output | Value to the actor | Value to the recipient | Privacy shape | Earliest gate | Kill criterion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | **Intentional share** — a student shares one chosen object (a schedule snapshot, a study set) with a classmate | Creates a share → previews exactly what and with whom, with expiry → recipient views, optionally starts | Study partner is coordinated | Immediate usefulness without an account | Minimum object, private audience, preview and confirm, expiry, immediate revoke, no education-record content in URLs or previews **[FACT: REFERRAL-AND-SHARING-SAFETY]** | G1 | Any share that reveals more than the preview showed; any "unwanted share" report |
| L2 | **Ambassador link** | Link posted → arrives → makes an account (claimed on session) → counted; ambassador sees *joined* and *still here* only | Recognition, not rewards | A friend's pointer | Code is not a secret; removed from the address bar on read; no invitee identity or content to the ambassador **[FACT: `lib/referral.ts`]** | G1 | Any pressure report; pay or ranking appears; coupling to recruiting quotas |
| L3 | **Calendar feed — not a growth loop** | A student subscribes their *own* calendar app to their feed | Deadlines move on their own lock screen | — | The feed is the student's whole calendar behind a bearer-credential URL; sharing the URL shares everything in it, and it is only as fresh as the last signed-in sync **[FACT: `subscribe.ts`]**. Growth therefore **never prompts a student to share it**. A scoped, revocable share feed would be a separate capability with its own review | n/a | Any growth surface that suggests sharing the feed URL |
| L4 | **Advisor-prep export** — a student takes a prepared agenda to an advising meeting | Student exports → advisor sees a clear agenda | A better meeting | An advisor who sees the value firsthand (the champion path) | Student-authored; nothing about other students; advisor is not asked for data | G0 content / G1 product (capability-dependent) | Advisor reports it adds burden; any advisor access beyond what was shared |
| L5 | **Course-demand contribution** → institutional insight | Student opts in to contribute interest in a course → aggregate at n ≥ 10 → institution sees demand | Helps a course open | Institution learns demand without surveillance | Aggregate only, small cells suppressed, no identity **[FACT: `DemandContribution`, `course-demand.ts`, `MIN_COHORT`]** | Institutional | Cell below floor appears; contribution without clear notice |
| L6 | **Public method pages** | Honest, useful guide → search/share → reader tries the method without Semester | Reader gets help | — | No tracking beyond first-party aggregate; no email gate | G0 | Page claims outrun registry; reader harmed by bad advice |
| L7 | **Cohort proof loop** | Pilot → measured, privacy-safe outcomes → permissioned reference → peer institution | Institution gets a decision | Peer gets evidence | Customer permission per exact wording, aggregates only | **G2 only** — CLM-013 prohibited today | Permission missing, expired or exceeded |

Loops L1, L4 and L5 depend on the matching product capability reaching an eligible registry status; this table does not assert that any of them is live.

### 6.1 Loops that are explicitly rejected

Address-book or contact import; "invite 3 friends to unlock"; auto-posting on a student's behalf; invitations that spoof a person ("Sam invited you"); shared plans public by default; any reward, discount, prize or status tied to invites or disclosures; "friends who are active now" pressure; leaderboards among classmates; making a classmate's non-use visible to anyone.

### 6.2 Loop health (measured, never optimized for volume)

| Metric | Why |
| --- | --- |
| Invitee activation and week-4 return, **vs the organic baseline** | A loop that brings people who leave is not a loop |
| Share revoked or expired before first view | Shows students are using the controls |
| "Unwanted share/invite" reports per 1,000 shares | **The guardrail.** Any confirmed non-consensual share stops the loop pending review |
| Support contacts per activated invitee | Capacity |
| Opt-out/deletion within 30 days of joining | Whether the invite was welcome |

A loop is a hypothesis; its viral coefficient is never reported as a headline, because small, intentional sharing is the design and not a deficiency.

---

## 7. Experimentation framework

[EXPERIMENTATION-PROTOCOL](EXPERIMENTATION-PROTOCOL.md) fixes the rules and [GROWTH-EXPERIMENT-BACKLOG](GROWTH-EXPERIMENT-BACKLOG.md) lists five hypotheses **[FACT]**. This section makes them operable.

### 7.1 Sequencing: measurement before experimentation

No quantitative experiment starts until: the event dictionary and privacy basis are approved; the relevant events are implemented and validated; denominators reconcile; suppression, deletion and withdrawal are tested; a baseline window is established; and a reviewer exists **[FACT: GROWTH-FUNNEL-SPEC "Missing test/proof"]**. **Until then, "experiments" are qualitative** — moderated usability sessions, comprehension checks, and concept tests with consent — and are reported as such.

### 7.2 Risk classes

| Class | Examples | Rule |
| --- | --- | --- |
| **E0** — public-page copy/layout | Headline, page order, example | Allowed at G0; no collection beyond first-party aggregates |
| **E1** — onboarding flow | Manual-first start, setup order | Needs G1; guardrails on comprehension and accessibility |
| **E2** — lifecycle messaging | Timing, copy, channel | Needs G1 and a working suppression; never changes consent defaults |
| **E3** — pricing/packaging | Anything about price or plans | **[COUNSEL]** and Finance; price copy is prohibited until CLM-015 approves it |
| **E4 — never** | Consent clarity, privacy/security defaults, accessibility access, adverse academic decisions, financial aid, discipline, disability/accommodation, crisis/support routing, manipulative notification intensity | **Not experimented on, ever** **[FACT: EXPERIMENTATION-PROTOCOL]** |

### 7.3 Pre-registration (one page, before launch)

Owner · hypothesis · user benefit (what the *student* gains if it works) · eligible population and exclusions · randomization unit and method · primary metric · guardrails · data fields and retention · **minimum practical effect** · sample or duration rationale · stop and rollback rules · review authority · consent and notice required · accessibility check of every variant · decision it will inform. An experiment whose result would not change a decision is not run.

### 7.4 Design rules

- **Randomize by cohort where students interact.** Classmates share information, so individual-level randomization within a cohort contaminates the comparison; compare cohorts or use staggered starts.
- **Small cohorts need estimation, not tests.** Report effect size with an interval and qualitative triangulation; "not significant" is not "no effect" **[FACT: protocol]**. A cohort of 50–200 cannot detect small effects; say so before running.
- **Pre-specify; don't peek.** One primary metric, a fixed horizon, an interim look only for harm.
- **Check the plumbing.** Sample-ratio mismatch, assignment logging, and event-loss checks precede any reading of an outcome.
- **Novelty and carry-over.** Allow a washout; avoid reading the first-session spike as a result.
- **Subgroups.** Examine adverse patterns across groups only where lawful, ethical, adequately powered and in aggregate above the small-cell floor; absence of a subgroup readout is stated, not hidden.
- **Holdouts.** Every lifecycle program keeps a defined control (a randomly held-back cohort or a staggered start) so its effect is estimable; a holdout never withholds a **service** message.
- **Archive everything,** including null and negative results, with limitations and the decision taken.

### 7.5 Stop conditions (any one halts the experiment)

P0/P1 incident; data-integrity failure; credible harm on any guardrail; an inaccessible variant; inability to honor withdrawal or deletion for a participant; unexpected sensitive collection; opt-out rate over the alert (`optOutAlert`, 0.1% of ≥ 1,000 delivered); a confirmed non-consensual share (loops); support load above capacity; a claim found to be unsupported; or the owner's judgment that the variant is manipulative.

### 7.6 Backlog (extends the existing five; IDs `H1–H5` are the existing ones)

| ID | Class | Hypothesis **[HYPOTHESIS]** | Primary metric | Guardrails | Prerequisites | Status |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | E1 | A manual "plan my week" start improves first-win completion | `student_first_win` rate | Support burden, abandonment, trust | Events live; G1 | proposed (existing) |
| H2 | E1 | Institution-specific milestone language improves cohort activation | `student_activated` rate | Comprehension, opt-out, accessibility | G2 | proposed (existing) |
| H3 | E1 | Contextual support discovery improves successful next actions | Meaningful completion | Sensitive-data minimization | Events live | proposed (existing) |
| H4 | E1 | A midpoint operator review reduces unresolved setup failures | Recovery/support | Staff burden | G2 | proposed (existing) |
| H5 | E0 | A clear pilot-limitations page improves buyer qualification | Qualified discovery | Conversion quality, no claim inflation | G0 | proposed (existing) |
| H6 | E1 | One source (not several) at setup raises setup completion without lowering first-win quality | Setup completion; first-win rate | Comprehension of source limits | Events live | proposed |
| H7 | E1 | Showing "why this action, from what source" on the first recommendation raises comprehension and acting | Comprehension check; action taken | Over-reliance; accessibility | Events live | proposed |
| H8 | E2 | Delivering the first-week prompt in-app rather than by email yields equal first-win with fewer opt-outs | First-win; opt-out rate | Missed service reminders | G1; suppression working | proposed |
| H9 | E2 | Weekly review at the student-chosen day beats a fixed day | Meaningful return | Opt-out; fatigue prompts (LC-13) | G1 | proposed |
| H10 | E2 | Sunset at 90 days (vs. continued monthly) does not lower later re-engagement | Re-opt-in/return after sunset | Complaint rate | G1; 90 days of data | proposed |
| H11 | E0 | Pages that teach a method without product mention earn more qualified starts than product-led pages | Activated starts from the page | Claim accuracy | G0 | proposed |
| H12 | Qual | Ambassador workshops raise week-4 retention more than QR-only tables | Week-4 retention, **cohort-level** | Pressure reports; support rate | G1 | proposed |
| H13 | E1 | A visible "export/delete" control during onboarding raises trust without lowering activation | Trust comprehension; activation | None (a control is never removed) | G1 | proposed |
| H14 | E0 | Naming limits in the first screen of an institutional one-pager raises qualified conversations | Qualified next step | Claim inflation | G0 | proposed |

---

## 8. Attribution, analytics, privacy and data minimization

### 8.1 Principles

1. **First-party only, no third-party analytics.** The Content-Security-Policy in `app/index.html` lists every host the app can reach; none is an analytics or session-replay vendor, and `phase5docs.test.ts` fails if one is added **[FACT]**. Growth tools are not exempt. Any email, ad or social platform that supplies conversion pixels is **not** used inside the app, and none is placed on the public site without privacy review.
2. **Three server marks exist** — `opened`, `course`, `studied` — one row per account per day per mark. A fourth requires its own pull request **[FACT: ANALYTICS.md, D-005]**.
3. **A missing source is "unavailable", never zero.** Reports render `—`, not `0%` **[FACT: `kpi.ts` returns `null` for an empty denominator]**.
4. **Counts and rates together**, with window, cohort and population; no combination of anonymous visits, local-only starts, accounts and sponsored participants without explicit rules **[FACT]**.
5. **No person-level join between marketing data and product usage.** Growth analysts see aggregates at or above `MIN_COHORT = 10`; the floor is held in TypeScript and SQL by `cohortfloor.test.ts` **[FACT]**.

### 8.2 Attribution model

| Question | Method | What it can and cannot say |
| --- | --- | --- |
| Which channel produced a visit to the public site | Standard campaign link: `utm_campaign = {tenant}_{cycle}_{audience}_{objective}`, plus `utm_source`, `utm_medium`, optional `utm_content`/`utm_term`, and a `loc` placement code. `campaignUrl` refuses any other parameter, so **nothing identifying a person rides in a link** **[FACT: `lib/gtm/utm.ts`]** | Aggregate arrival counts by channel; correlational |
| Which ambassador/link produced an account | `lib/referral.ts` — code claimed on session, counted per link; *joined* and *still here* only | A count per link; no invitee identity or content |
| "How did you hear about us?" | **One optional, skippable, single-choice question** at setup, stored as a category **[DECISION]** | Self-reported; use as a cross-check, not a source of truth |
| Institutional opportunity source | Entered by a human on the opportunity (account-level, not person-level) | First-touch and last-touch recorded; multi-touch only on accounts with ≥ N touches |
| Did a program *cause* the lift | Holdout or staggered cohorts (§7) | Anything else is correlational; the methodology export says so (`methodology()` stamps `causal_claim: none — correlational unless a holdout or experiment is named`) |

**[DECISION]** The default attribution model for channel decisions is **last-touch** for the public site and **first- and last-touch together** for institutional accounts; neither is presented as incrementality. A channel is judged on activated and retained students, never on clicks.

### 8.3 Growth data inventory

Retention and access are **proposals** until the privacy reviewer (unassigned) approves them.

| Dataset | Fields | Identity level | Basis | Proposed retention | Access | On deletion/withdrawal |
| --- | --- | --- | --- | --- | --- | --- |
| Public-site aggregate counts | Page, campaign, medium, source, `loc`, day | None | First-party aggregate | Aggregate: 24 months | Growth | N/A |
| Server marks (`activity`) | account, day, mark | Pseudonymous account | Product operation | Per `RETENTION.md` | Analytics, aggregate only | Removed with the account |
| Consent and preference records | channel, topic, version, timestamp, source | Account | Consent evidence | Life of account + proposed evidentiary period **[COUNSEL]** | Messaging system | Withdrawal recorded; **suppression entry kept** so the person is not re-contacted **[COUNSEL]** |
| Send audit (`communication.send_decision`) | ids, versions, channel, outcome | Account or address | Audit | Proposed 24 months | Growth ops, privacy | Pseudonymized on deletion |
| Referral link claims | code, joined, still-here | Account | Product feature | Life of the link | Ambassador sees counts only | Link claim removed |
| Institutional contacts | Business name, role, work contact, interactions | Person (business context) | Legitimate-interest B2B outreach **[COUNSEL]** | Proposed 24 months from last interaction | Sales/growth | Removed on request; "do not contact" retained as suppression |
| Experiment registry | Hypothesis, assignment (cohort-level), result | Cohort | Operations | Indefinite (no personal data) | Growth, privacy | N/A |
| Survey/feedback | Category answers; free text only if separately consented | Pseudonymous | Consent | Proposed 12 months | Product | Deleted on request |

**Never collected for growth:** course or task content, grades, health or disability information, conduct, aid, immigration status, messages, exact location, sensitive support detail, per-student AI usage, or any item in `FORBIDDEN` (`risk_score`, `reading_time`, `mouse`, `attention`, `ai_usage`, `integrity_flag`, `wellbeing_score`, `location`) **[FACT: `institution-ops.ts`]**.

### 8.4 Proposed event additions (each needs its own pull request)

Events already listed in EVENT-TAXONOMY cover the individual funnel; only growth-specific gaps are named here, each as a **proposal** that moves into ANALYTICS.md only through its own PR under D-005.

| Proposed | Question it answers | Shape |
| --- | --- | --- |
| `preference_changed` | Are controls findable and used? | category + channel only; no content |
| `unsubscribe` | Which lifecycle message class drives opt-out? | message class + template id; no recipient detail in aggregates |
| `share_created` / `share_revoked` (exists in taxonomy) + `share_viewed` | Are shares viewed and revoked? | object type only |
| `invite_claimed` | Referral funnel | via the existing referral claim |
| `survey_answered` | Comprehension and trust checks | **Not a mark** — answers are content; aggregate-only table with n ≥ 10, as the clarity answer is treated in `ANALYTICS-EVENTS.md` **[FACT]** |

### 8.5 Privacy review triggers

Privacy review is a required step for any new analytics, tracking, community, marketplace, AI, email/SMS sending or referral work **[FACT: audit "Privacy by design"; preamble]**. For growth that means: a new event; a new data field; a new vendor; a new list source; a new segment definition; a new automation; a new use of an existing field. **[COUNSEL]** reviews: lawful basis per audience and jurisdiction, cross-border transfer, consent wording, retention, sub-processors, and any claim about compliance.

---

## 9. Institution-focused demand programs and account-based marketing

### 9.1 Account selection and tiering

Selection follows [IDEAL-CUSTOMER-PROFILE](IDEAL-CUSTOMER-PROFILE.md) and [FIRST-10-INSTITUTIONS-TARGETING-PLAN](FIRST-10-INSTITUTIONS-TARGETING-PLAN.md): a real warm path or an *observed* need; never a fabricated relationship; ten accounts scored 0–2 across ten dimensions, top three worked first **[FACT]**. ICP disqualifiers stand: "replace the SIS/LMS now", mandatory writeback, authoritative degree audit, institution-wide launch as entry scope, required use of sensitive categories, demand for certification or guarantees, no champion, no baseline, cohort below 10 or above 200 **[FACT]**.

| Tier | Accounts | Treatment | Cost of effort |
| --- | --- | --- | --- |
| **T1 — one-to-one** | Top 3 of the ten | Researched brief; multi-threaded; bespoke evidence pack; named owner | Highest; capped by capacity |
| **T2 — one-to-few** | Remaining 7 grouped by milestone (first-year/transfer, advising/programs, registration/enrollment, honors/learning communities, regional/private) | Segment webinars; shared evidence room; common sequences | Medium |
| **T3 — one-to-many** | Qualified but unscored institutions that find the content | Public method pages, evidence index, a limitations page | Low; no outbound |

### 9.2 Buying-committee coverage

Roles from [BUYER-PERSONAS](BUYER-PERSONAS.md). **Coverage** is the share of the seven roles with at least one *two-way* interaction — not opens, not impressions.

| Role | What they need first | The asset | The honest limit stated in it |
| --- | --- | --- | --- |
| Executive sponsor | A bounded decision with a date | One-pager: scope, scorecard, decision date | No proven causal retention outcome |
| Student success/advising lead | A workflow they can run | Journey demo; operator training sheet | Not authoritative advising; no risk scoring |
| CIO / IT | Architecture and exit | Data-flow diagram; integration matrix | No live institutional integration assumed (CLM-005) |
| Security/privacy | Controls and evidence | Control matrix; subprocessor list; deletion evidence | No certification or blanket legal-compliance claim (CLM-010) |
| Procurement/legal | Paper | Pilot agreement drafts; DPA issue list | Drafts only; counsel-approved terms required |
| Accessibility | Evidence | Accessibility overview and conformance plan | No WCAG conformance, VPAT or ACR claim (CLM-008) |
| Faculty/staff champion | Fit and training | Demo; limitations sheet; escalation path | Broad faculty workflow replacement excluded from pilot |

### 9.3 Plays by stage

| Stage | Play | Owner | Asset | Exit evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| `target_account` | Trigger research: public events only — new leadership, a published registration or advising initiative, an accreditation or LMS-review cycle disclosed publicly | Growth | One-page account brief | Named trigger and committee hypothesis | G0 |
| `discovery` | Short, specific outreach that mirrors their stated priority and names the limits; one follow-up; stop on "no" | Growth | Outreach template (Lane C if claims beyond register) | Reply | G0 |
| `qualified` | Scorecard conversation | Sales | `SALES-QUALIFICATION-SCORECARD.md` | Named champion, stated problem, budget cycle, decision process | G0 |
| `multi_stakeholder_demo` | Synthetic-data demo with role-specific variants | Sales + Product | Demo script; one-pagers | Committee mapped | G0 |
| `technical_review` / `security_privacy_accessibility_review` | Open the evidence room; answer from the RFP library only | Sales + security/privacy | Trust Center pack; HECVAT draft evidence | Review started; open items logged | G0 |
| `proposal` → `procurement_legal` | **Stop marketing; enable.** Provide what procurement asked for, on their timeline | Sales + counsel | Pilot proposal, SOW template | Pilot plan with no readiness problems | G0 → G2 |
| `live` → `renewal` | Outcome review with permission; clean-offboarding option stated up front | Customer Success | Pilot scorecard; final verdict | Signed verdict | G2 |

### 9.4 Demand programs

| Program | Format | Purpose | Cadence | Measure |
| --- | --- | --- | --- | --- |
| **Registration readiness without replacing your SIS** | Webinar + office hours | Qualified registrar/advising interest | Quarterly, ahead of registration windows | Qualified next steps |
| **Evidence walkthrough for IT, security, privacy and accessibility** | Live review of the evidence room, with the limits stated | Move committee members from curious to reviewing | Monthly during the pilot-sales window | Reviews started |
| **Peer roundtable** (practitioners, no pitch) | Small, off-record conversation among student-success leaders | Learn; build trust; surface real problems | Quarterly | Problems captured; follow-ups agreed |
| **Method library** for advisors | Public guides (L6) | Earn attention without asking for it | Continuous | Qualified discovery citing it |
| **Sector events** | Attend, listen, run a small session if invited | Meet the committee in context | Calendar to be confirmed | Qualified conversations |

**Rules.** No named customers, logos, quotes or reference calls until CLM-013 permission exists for the exact wording and term; **no institution is named as an approved partner or customer** — least of all the institution the founder attends; any such use is a CLM-013 matter. No claim of integration with a named SIS/LMS until that connector is live and accepted (CLM-005). No price on any asset until CLM-015 approves it. No outbound to a contact who has said no, and no outreach list scraped or bought **[COUNSEL]** on lawful basis for business contacts.

### 9.5 Account metrics

| Metric | Definition | Status |
| --- | --- | --- |
| Committee coverage | Roles with a two-way interaction ÷ roles in the buyer map | To instrument |
| Stage velocity | Median days per `SALES_STAGES` transition, with the censored count | To instrument |
| Qualified next step rate | `qualified` ÷ accounts worked in the window | `qualified_inquiry_rate` in `kpi.ts` |
| Pilot conversion | Pilots converted to an executable annual scope ÷ completed pilots | `pilot_conversion_rate`; commercial system required |
| Cost per qualified account, CAC, payback | Per `kpi.ts` definitions | Needs a spend record; no figure exists |
| Disqualification reasons | Counted by ICP disqualifier | To instrument — **often more informative than wins** |

---

## 10. Growth dashboards and operating cadence

### 10.1 Dashboards

Every tile shows **period, denominator, sample size, suppression threshold, source, freshness, missing-data treatment, version, owner and caveat** **[FACT: METRIC-DICTIONARY]**. A tile whose source does not exist shows `—` and the reason, never a number. "Status" is honest as of this document.

| # | Dashboard | Tiles | Source | Status |
| --- | --- | --- | --- | --- |
| D1 | **Executive growth scorecard** | Activated students; first-win rate; week-4 return; pipeline by stage; pilot conversion; guardrail summary | Marks + pilot tables + human entries | Marks exist (3); rest not instrumented |
| D2 | **Student funnel and activation** | I0–I7 with I2 and I3 separate; time to first value with censored count; by cohort and by source | `activity` + proposed events | Partial |
| D3 | **Lifecycle and deliverability** | Sends by class vs cap; opt-out rate vs 0.1% alert; suppression and sunset counts; bounce/complaint vs provider thresholds; fatigue prompts | `communication.send_decision`, provider | Decision audit exists in code; sending is off |
| D4 | **Content and social** | Assets by pillar and gate; saves/shares; activated starts per asset (UTM); claim expiry calendar; corrections | UTM aggregates; claims register | Not instrumented |
| D5 | **Referral and ambassador** | Joined, still here, per link; ambassador load; pressure reports | `referral.ts` | Counts exist; program not run |
| D6 | **Institutional pipeline and ABM** | Accounts by stage; coverage; velocity; disqualification reasons; qualified rate | Opportunity records | Not instrumented |
| D7 | **Experiment registry** | Active, planned, concluded; guardrail breaches; decisions | The registry | To create |
| D8 | **Trust and guardrails** | Opt-out/deletion; privacy complaints; accessibility blockers; support burden; notification disablement; P0/P1; source/authority errors; adverse subgroup patterns where lawful and powered | Support, incidents, preferences | Partial |
| D9 | **Claims and compliance** | Claims in use by ID/approval/expiry; withdrawals; open counsel items | `PUBLIC-CLAIMS-APPROVAL-REGISTER`, `LEGAL-REVIEW-QUEUE` | Documents exist; no live dashboard |

**Design rules for the dashboards themselves** (so they do not mislead): counts beside every rate; small cells suppressed under 10 and never revealed by subtraction; no leaderboard of students, ambassadors or advisors; no comparison across cohorts or institutions without an approved design; accessible (labelled axes, non-color encodings, a data table alternative); the status of an unreliable source is shown on the tile.

### 10.2 Operating cadence

| Rhythm | Forum | Inputs | Output |
| --- | --- | --- | --- |
| **Daily (10 min)** | Guardrail glance | Complaints, opt-outs, support inbox, incidents | Pause a channel if a stop condition is met; otherwise nothing |
| **Weekly (45 min)** | Growth review | D1–D3, D5, D8; content shipped; claims expiring | Decisions: continue, change, stop. **One thing to stop each week** |
| **Biweekly (30 min)** | Experiment review | D7; pre-registrations; completed readouts | Approve, hold or stop; archive results incl. nulls |
| **Monthly (60 min)** | Claims and content audit + legal queue | D9; assets in market; withdrawals; open counsel items | Re-validate or withdraw every expiring claim; clear the queue |
| **Monthly (60 min)** | Pipeline and account review | D6; ABM tiers | Re-tier accounts; disqualify honestly |
| **Quarterly (half day)** | Planning and retrospective | All dashboards; the 90-day program | Gate decisions (G0→G1…), OKRs, budget, capacity reset; **what we will not do** |
| **Each term start/end** | Launch and wrap | Tenant calendars; support readiness | Calendar updated; stress windows set; ambassador refresh |

**Weekly review agenda (fixed order, so the uncomfortable items come first):** (1) Guardrails and incidents. (2) Claims: anything expired, contradicted or unapproved. (3) Capacity: support load vs ceiling. (4) Funnel, with counts and with unavailable data shown as unavailable. (5) Experiments and loops. (6) Pipeline. (7) What to stop. (8) Decisions recorded.

### 10.3 Roles and decision rights (RACI-style)

R = does the work · A = accountable · C = consulted · I = informed. The accountable executive for growth is the owner named in the control block; **empty cells below are real vacancies, not oversights**.

| Decision | Growth | Product | Privacy | Accessibility | Counsel | Support | Founder |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Open a gate (G0→G1…) | R | C | C | C | C | C | **A** |
| Publish a claim variant | R | C | C | C | C (Lane C) | I | **A** |
| Change a notification cap or default | R | C | C | C | C | C | **A** |
| Launch or stop an experiment | R | C | C | C | I | C | **A** |
| Add an analytics event or data field | C | R | **A** | I | C | I | I |
| Name an institution or use a quote | R | I | C | I | C | I | **A** |
| Pause a channel for a guardrail breach | **A/R** | I | C | C | I | C | I |

### 10.4 One-person operating mode

Today the roles above are one person plus unassigned reviewers. A plan that assumes a team is a plan that quietly fails, so this is the explicit minimum, in priority order:

1. **Build nothing that cannot be measured safely.** Keep G0 work to content drafts, rehearsal, and bounded discovery with the existing claim library.
2. **Hold the line before adding volume.** The guardrail glance and the claims check come before any new asset.
3. **One channel per audience, run well,** until its gate evidence exists: advisor/ambassador referral for students; direct, claim-safe outreach for institutions.
4. **Do not stand up** SMS marketing, paid media, creator contracts, community beyond invitation-only, or family content until the reviewers and support exist.
5. **Assign the reviewers first.** Privacy, accessibility and counsel being unassigned blocks Lane B and C; recruiting them is the highest-leverage growth task, not a prerequisite to be postponed.

### 10.5 Phasing (aligned with the [90-day program](../90-DAY-LAUNCH-PROGRAM.md))

| Window | Focus | Done when |
| --- | --- | --- |
| Days 1–30 | Foundations at G0: approve this plan and the §4.3 caps; assign reviewers; build the claim-check step; instrument the three existing marks into D1/D2; finish the preference-center design; draft B1–B6 under the register; set up the experiment registry | Owner approves; reviewers assigned; one end-to-end rehearsal (synthetic data) exercised through consent, unsubscribe, suppression and takedown |
| Days 31–60 | Rehearse and recruit: closed rehearsal of lifecycle flows; accessibility pass on templates and preference center; ambassador training built; ICP top-three outreach under Lane C | Individual-beta gate evidence assembled for the owner's decision |
| Days 61–90 | Decide: if G1 is granted, invitation beta of one cohort of 50–200 with the support ceiling set from rehearsal; otherwise continue G0 and record why | A signed GO/NO-GO for G1 with the guardrail thresholds written down |

---

## Assumptions

1. **[HYPOTHESIS]** The first individual cohort is invitation-only, 50–200 students (ICP; adoption plan). If a different shape is chosen, §1.4 inputs and §4.3 caps are revisited.
2. **[DECISION]** One person operates growth until reviewers are assigned. Several controls below are inert until then (Lanes B/C).
3. The sending system, preference center and suppression store referenced in §4 are *planned*; email and SMS sending to students is currently off **[FACT: ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS "Capabilities and flags"]**.
4. Calendars in §5.2 are generic. Tenant calendars replace them on adoption.
5. The numeric caps in §4.3 marked **proposed** are starting values chosen to be conservative; they are set by the owner and revised from measured data, never from a competitor's example.
6. No growth outcome is assumed. Nothing in this document supports a claim about conversion, activation, retention, referral, traction or lift.

## Risks and unresolved questions

| Risk / question | Why it matters | Owner (proposed) |
| --- | --- | --- |
| Reviewers (privacy, accessibility, counsel) unassigned | Lanes B/C and several controls cannot run | Founder |
| Lifecycle education vs marketing classification | Decides consent for LC-04/05/07/10 | **[COUNSEL]** |
| Age thresholds and any minor-related rules | Decides who can be messaged, who can be an ambassador | **[COUNSEL]** |
| Whether a roster supplied by an institution can seed any list | Defaults to *no* | **[COUNSEL]** |
| Required wording of renewal and cancellation disclosures; commercial-email, telephone and state rules | Billing and messaging lawfulness | **[COUNSEL]** |
| Disclosure rules for paid creators and ambassadors | FTC-style endorsement rules apply to material connections | **[COUNSEL]** |
| Business-contact lawful basis for outbound B2B in each jurisdiction | Decides T1/T2 outreach | **[COUNSEL]** |
| Retention windows in §8.3 | Not yet approved | Privacy reviewer |
| Reading-level target and templates' accessibility | Needs an accessibility reviewer | Accessibility reviewer |
| Provider complaint/bounce thresholds | Read current published values at the time; not restated here | Growth |
| Cohort size too small to detect effects | May make most experiments qualitative | Growth |
| Whether capability statuses will reach a level that allows B7/B8 | Holds two briefs | Product |
| Support capacity ceiling | Binds every channel; unmeasured | Support owner |

## Files changed

- **Added** `docs/market-readiness/GROWTH-OPERATING-PLAN.md` (this file).
- **Added** `app/src/lib/gtm/growthplan.test.ts` (structural guard; below).
- **Edited** one-line pointers in `docs/market-readiness/EMAIL-LIFECYCLE.md` and `docs/market-readiness/GROWTH-EXPERIMENT-BACKLOG.md`.

## Tests added

`growthplan.test.ts` holds the plan to the repository so it cannot drift into folklore:

- Every file path the plan cites exists.
- Every claim ID (`CLM-nnn`) it cites exists in the public-claims register.
- The cap and window numbers it states as **enforced** equal the code (`IMPORTANT_CAP`, `HELPFUL_CAP`, `DEFAULT_QUIET_HOURS`, `MIN_COHORT`, the `optOutAlert` threshold).
- Every `SALES_STAGES` value the plan names is a real stage.
- Every `PILLARS` id it weights exists, and the weights sum to 100% per column.
- No prohibited public claim appears except inside a refusal.
- The plan's status line says *no campaign is authorized*.

## Accessibility implications

§4.5 sets the accessibility requirements for messages and the preference center; §5.3 and §5.6 for social, video and campaign assets. All are **requirements on future artifacts**; no conformance claim is made. A qualified accessibility reviewer is a prerequisite for G1 and is unassigned.

## Security and privacy implications

The plan adds no collection. It proposes growth-specific events and retention for review (§8.3–8.4), forbids person-level joins between marketing and product data, forbids rosters as lists, forbids third-party analytics, and adds a stress-window and sunset policy that reduce, not increase, contact. Each proposed item needs privacy review and, where flagged, counsel, before it is built.

## Operational and runbook implications

New recurring work: the daily guardrail glance, weekly growth review, biweekly experiment review, monthly claims audit and legal queue, and quarterly planning (§10.2). New on-call-like duties: pausing a channel on a stop condition (§4.7, §7.5) and withdrawing an expired claim everywhere (register rule). A runbook for "channel paused by guardrail" and one for "claim withdrawn" should be written before G1; neither exists today.

## Traceability matrix updates

Rows to add to the capability traceability record (none changes any capability's status):

| Capability | Requirement | Owner | Evidence | Gap |
| --- | --- | --- | --- | --- |
| Lifecycle messaging | Per-class caps, stress-window suppression, sunset | Growth + Product | `lib/gtm/messaging.ts`, `notify.ts`; this plan §4 | Per-class caps, stress window and sunset **not built** |
| Preference center | Per-channel/topic, quiet hours, pause, "why did I get this" | Product | `ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md` | One shared preferences object not yet shipped |
| Attribution | UTM convention, referral claims, no person-level link parameters | Growth | `lib/gtm/utm.ts`, `lib/referral.ts` | No accepted event stream or baseline |
| Experimentation | Pre-registration, risk classes, stop conditions, registry | Growth | EXPERIMENTATION-PROTOCOL; this plan §7 | Registry not created; no events to measure |
| Ambassador program | Selection, training, disclosure, no per-sign-up pay, kill switch | Growth | STUDENT-AMBASSADOR-PLAYBOOK; this plan §5.4 | No reviewers, no program run |
| Institutional ABM | Tiering, coverage, plays by stage | Growth + Sales | `lib/gtm/stages.ts`, ICP; this plan §9 | No opportunity instrumentation |
| Growth dashboards | D1–D9 with suppression and unavailable-not-zero | Growth + Analytics | `lib/gtm/kpi.ts`; this plan §10 | Most sources not instrumented |

## Evidence state

**Repository evidence.** The principles, claim ceilings, event definitions, consent and send-decision code, caps for in-app reminders, the UTM convention, the referral mechanism, the sales stages and the claims register are all on main and tested. This document specifies the operating layer that sits on them.

**Operational evidence.** None. No production event stream, baseline, attribution result, experiment, live consent/suppression operation, staffed response, ambassador, customer permission or campaign outcome is evidenced.

**Missing test/proof.** Approve this plan and the proposed caps; assign privacy, accessibility and counsel reviewers; build the proposed per-class caps, stress-window suppression and sunset (each held by a test that has been shown to fail without it); instrument and validate the events and denominators; rehearse consent, unsubscribe, suppression, takedown and support end to end; set the guardrail thresholds from a measured baseline; obtain the applicable GO before any gate above G0 opens.

## Claim ceiling

Semester may describe this as a controlled, privacy-preserving growth operating plan and may run the G0 work it permits: preparation, closed rehearsal, evidence-bounded discovery, synthetic demos and educational content with no activation implication.

## Prohibited claims

Do not claim conversion, activation, retention, referral, growth, traction, attribution, experiment lift, product-market fit, institutional outcome, a customer, a partner, a reference, an integration, a certification or compliance status, a price, an uptime or support-hours guarantee, or that any capability named in §2.2 is live, from this plan. A plan is intent, not evidence; the claims register decides what may be said.
