# Growth, lifecycle and demand operating plan

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PLAN — NON-ACTIVATION PREPARATION ONLY; NO BROAD, PAID OR PUBLIC CAMPAIGN AUTHORIZED** |
| Owner | Harrison Rubin — growth, lifecycle, content and claims owner; privacy, accessibility and claims reviewers, analyst, moderator and backup experiment owner **all named as Harrison Rubin on 2026-10-04 ([matrix](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md)); no independent second person or backup is assigned** |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Governs | Adoption, activation, retention, referral, institutional demand and brand trust. Never governs a claim: [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) does |
| Reads with | [`EXECUTION-PLAN.md`](EXECUTION-PLAN.md) (the GTM code), [`GROWTH-FUNNEL-SPEC.md`](../commercial/GROWTH-FUNNEL-SPEC.md), [`ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md`](../ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md), [`PRODUCT-ANALYTICS-DATA-ETHICS.md`](../PRODUCT-ANALYTICS-DATA-ETHICS.md), [`LAUNCH-CAMPAIGN-PLAN.md`](../commercial/LAUNCH-CAMPAIGN-PLAN.md) |

Everything below is a proposal until its gate (§2) passes. A number that is not in §14's held-to-code table is a hypothesis, not a target anyone has agreed to.

## 1. What already exists, and what this plan adds

Main already holds most of the *rules* and some of the *code*. Much of the *operating material* is a stub of 5–13 lines. This plan does not restate the rules; it links them and writes the missing operating layer.

| Ask | Already on main | What this plan adds |
| --- | --- | --- |
| 1 Funnel model | `GROWTH-FUNNEL-SPEC.md` (individual, institutional and customer funnels), `ANALYTICS-PLAN.md` | Persona × stage model with a proof need, entry route and owner per cell (§3) |
| 2 Activation milestones | `STUDENT-ONBOARDING-PLAYBOOK.md` (`student_activated` vs `student_first_win`), `ANALYTICS-EVENTS.md` | Milestones per persona and per product domain, each marked measurable today or not (§4) |
| 3 Lifecycle map | `EMAIL-LIFECYCLE.md` (7 lines), `notify.ts` | Eight stages × six audiences, with trigger, channel, cap and suppression (§5) |
| 4 Notification policy | `ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md`, `gtm/messaging.ts`, `notify.ts` | One policy: channels, consent purposes, caps, accessibility, controls, stop rules (§6) |
| 5 Content, social, ambassadors, community, briefs | `CONTENT-AND-CHANNEL-PLAN.md` (11 lines), `CONTENT-AND-COMMUNITY-PLAN.md`, `gtm/social.ts` pillars, `referral.ts`, AMB rows in the connect register | Editorial calendar, social operating rules, ambassador program design, seven campaign briefs (§7) |
| 6 Product-led loops | `SEMESTER-WRAPPED.md`, `referral.ts`, ICS feed | Seven loops, each with the value it must create and the kill rule (§8) |
| 7 Experimentation | `EXPERIMENTATION-PROTOCOL.md` (7 lines), `GROWTH-EXPERIMENT-BACKLOG.md` (5 rows) | Power reality for 50–200-person cohorts, template, veto guardrails, numeric stop conditions, ten more hypotheses (§9) |
| 8 Attribution and privacy | `ANALYTICS.md` (three marks), `utm.ts`, CSP test, `ANALYTICS-EVENTS.md` | Three attribution tiers that respect the three-mark limit, data-minimisation table, the gaps (§10) |
| 9 Institutional demand and ABM | `INSTITUTIONAL-GTM-PLAYBOOK.md`, `FIRST-10-INSTITUTIONS-TARGETING-PLAN.md` (5 lines), `gtm/stages.ts`, `rfp.ts` | Committee-based ABM plays, programs, a demand-signal rule (§11) |
| 10 Dashboards and cadence | `gtm/kpi.ts`, `REVENUE-OPERATIONS-DASHBOARD-SPEC.md` | Six dashboards, owners, labelled attribution, operating rhythm (§12) |

### Overlap with the brand and marketing strategy

[`BRAND-AND-MARKETING-STRATEGY.md`](BRAND-AND-MARKETING-STRATEGY.md) merged on 2026-10-04, written in parallel and without reference to this plan. Where the two overlap, use it for brand, messaging, page briefs, the consent form text, the dated twelve-week calendar from 2026-10-05, its twelve-moment lifecycle table and the copy-level claims register it adopts. Use this plan for the notification caps and policy, activation milestones, product-led loops, experimentation, attribution tiers, institutional ABM, dashboards and the gates. The two agree on the default cap of one marketing email a week. They disagree on one point, recorded as decision 9 in §13.

## 2. Ground truth that bounds every tactic

| Fact | Source | Consequence |
| --- | --- | --- |
| Launch council verdict is `NO-GO` for broad launch; broad and paid acquisition are not authorized | `EXECUTIVE-GO-NO-GO.md`, `LAUNCH-CAMPAIGN-PLAN.md` | Everything public waits on a gate; internal preparation does not |
| `INDIVIDUAL_PAID_ACQUISITION_ENABLED = false` although Plus checkout passed live acceptance on 2026-10-03 | `app/src/lib/plans.ts`, `docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md` | **No paid media.** Plus is described only as available from the Account screen; no ad, email or post sells it |
| Price, discount, savings and scarcity claims are `PROHIBITED` until re-approved (CLM-015) | Claims register | No price in any campaign asset until CLM-015 is re-approved for the exact channel |
| Three server marks only: `opened`, `course`, `studied`; no third-party analytics; a test fails on a new vendor host | `ANALYTICS.md`, `phase5docs.test.ts` | Growth measurement is first-party, aggregate and coarse; any new event is its own reviewed PR |
| Email and SMS sending are `off`; they need a sender, a cost decision and a consent record | `ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md` | Lifecycle ships in-app and service-message first; marketing email waits for G2 |
| No streaks, leaderboards, shame or fear urgency, enforced by a structural test | `community/engagement.test.ts`, `FORBIDDEN_MECHANICS` | Rules out the usual retention playbook, by construction |
| Never measured: `risk_score`, `reading_time`, `mouse`, `attention`, `ai_usage`, `integrity_flag`, `wellbeing_score`, `location` | `FORBIDDEN` in `institution-ops.ts` | "At-risk student" outreach does not exist; lifecycle "risk" means cohort and account risk only |
| Customer, partner, logo, outcome, ROI and uptime claims are `PROHIBITED TODAY` (CLM-013, 014, 016) | Claims register | No testimonials, "trusted by", "improves GPA", or named institutions |
| Individual motion is conditional, invitation-only, unpaid validation (CLM-003) | Claims register | The student funnel is an invitation beta first |
| Ambassador kit is `NOT_STARTED`; disclosure text and stipend are unwritten (ETH-003) | `SEMESTER-CONNECT-REGISTER.md` | The program in §7.4 is a design for counsel, not a launch |
| No time-based purge of contacts or sends exists | `RETENTION.md` | No marketing list may go live before a retention sweep (G2) |

### Gates

| Gate | Unlocks | Exit evidence |
| --- | --- | --- |
| **G0** now | Internal preparation: assets, claims, calendars, rehearsal on synthetic data | Owner sign-off; nothing sent to a real person |
| **G1** invitation beta | In-app and service messages to invited members; invite-only content | Individual-beta GO; `PRIVATE-BETA-PROGRAM.md` programme live; support route staffed |
| **G2** consented email | Lifecycle and product-update email | Sender chosen and added to [`SUBPROCESSORS.md`](../SUBPROCESSORS.md); preference center; one-click unsubscribe tested; suppression tested; retention sweep for `gtm_*` contacts; counsel review of email consent |
| **G3** first cohorts | Institution-sponsored student comms; faculty/advisor comms | Executed scope; tenant approval; named-tenant GO |
| **G4** ambassadors | Ambassador pilot | Counsel-approved disclosure and compensation; training document; two or three ambassadors tracked by hand on the two referral numbers |
| **G5** public content | Public social and search content in §7 | Claims approved per asset; accessibility pass; moderation rota staffed |
| **G6** paid media | **Not planned.** Would need its own decision, a reversed `INDIVIDUAL_PAID_ACQUISITION_ENABLED`, and CLM-015 | — |

## 3. Full-funnel growth model

Stages: **Aware → Understand → Trust-check → Start → Activate → First win → Habit → Advocate.** The funnel is a map of where a person needs a different kind of help, not a pipe to push people down. A missing source means *unavailable*, never zero (`GROWTH-FUNNEL-SPEC.md`).

| Persona | Job they hire Semester for | Proof they need before starting | Entry routes | Advocacy that is real |
| --- | --- | --- | --- | --- |
| **P1 Student, individual** | Turn a messy term into a plan I can follow | What it stores, where, how to leave; works without my school | Use-case guide, orientation QR, advisor or peer referral | Shares a plan template or invite they chose |
| **P2 Student, institution-sponsored** | Same, with my school's calendar and rules | Which data my school sees (aggregate, n ≥ 10) and which it does not | School announcement, advisor, orientation | Tells a classmate; faculty mention |
| **P3 Family or guardian** | Support without surveillance | The student controls what is shared; revocable | **Only** an invite initiated by the student (or school under policy) | None marketed; no guardian acquisition funnel |
| **P4 Faculty or advisor champion** | Less setup friction for my students; better advising prep | Syllabus-based course setup works; no grading authority changes | Peer introduction, workshop, quick-start | Brings a cohort; speaks at a department meeting |
| **P5 Administrator (student success, registrar, accessibility, IT)** | One coherent student experience without a rip-and-replace | Pilot sits *beside* existing systems (CLM-004); trust packet; limits stated | Discovery, outcome workshop, trust room | Internal sponsor; reference **with permission** |
| **P6 Institutional buyer (provost, CIO, CISO, procurement, finance)** | Defensible purchase | Security, privacy, accessibility evidence with dates; price book; exit and offboarding | ABM, RFP, committee referral | Signs; renews |
| **P7 Ambassador or creator** | Credible, bounded campus role | Clear conduct, hours and disclosure; no peer data access | Application | Stories they wrote and chose to publish |

### Stage definitions and measures

| Stage | Student (P1/P2) exit signal | Measure and denominator | Measurable today? |
| --- | --- | --- | --- |
| Aware / Understand | Reads a use-case page or attends a workshop | Qualified visits ÷ eligible reach | No first-party site counter yet (§10, Tier 1) |
| Trust-check | Opens limits, privacy or export page | Trust-page views ÷ landing visits | No |
| Start | Intentional account or local start | Starts ÷ qualified visits | Accounts yes; visits no |
| **Activate** (`student_activated`, setup-only) | Minimum setup: one approved course, source or calendar item | Activated ÷ registered, per cohort | `opened` + `course` marks exist |
| **First win** (`student_first_win`) | Reaches Today, understands one reversible next action and its source, knows the help route, acts or defers on purpose | First wins ÷ activated | Not yet: needs the `action_completed` mark (§4) |
| Habit | Meaningful return on Day 7 and 30, then a weekly planning action | Retained ÷ activated by window | `opened` and `studied` give WAU and 30-day retention |
| Advocate | A deliberate share or referral that produces an activated person | Referred-and-still-here ÷ referred | Yes: `referral.ts` two numbers |

Institutional stages are the implemented `SALES_STAGES` in `app/src/lib/gtm/stages.ts`: `target_account → discovery → qualified → multi_stakeholder_demo → outcome_workshop → technical_review → security_privacy_accessibility_review → proposal → pilot_or_implementation_SOW → procurement_legal → contracted → implementation → live → renewal → expansion | closed_lost`. Signed scope is not launch; product activity is not an institutional outcome.

### Volume arithmetic

The 1,000-student plan is 3–5 cohorts of 50–200 plus referrals and orientation workshops. No single campus-wide blast. Each 100–250 students passes the stage gate in `FIRST-1,000-STUDENTS-ADOPTION-PLAN.md` before the next opens. No conversion rate is assumed anywhere in this plan: none has been measured (`GROWTH-FUNNEL-SPEC.md` evidence state).

## 4. Activation milestones

### By persona

| Persona | Activated when | First win when | Not counted |
| --- | --- | --- | --- |
| P1 / P2 student | Minimum setup done once (course, source or calendar item) | Acts or defers one source-labelled reversible action, knowing the help route | Logins, time in app, number of screens, a full first-week plan as an extra gate |
| P3 guardian | Accepts a student's invite and sees only what the student shared | Student confirms the shared scope is what they intended | Guardian opens, guardian message volume |
| P4 faculty or advisor | Completes the quick-start for their role | One course or advising cohort set up with students able to start from it | Student-level activity reported to faculty beyond what policy allows |
| P5 administrator | Tenant configured; owner and backup named | Staff console used for a real operational task in the cohort | Seats provisioned |
| P6 buyer account | Security, privacy and accessibility packet delivered, questions logged | Pilot decision recorded with a dated outcome review | Meetings held |
| P7 ambassador | Training signed, conduct agreed | First approved piece published, or first workshop run | Referral volume as a target |

### By product domain

"Value event" is what a person gained; "signal" is the coarsest fact that can show it without content. Rows marked *needs PR* are in [`ANALYTICS-EVENTS.md`](../ANALYTICS-EVENTS.md) as definitions only: each moves into `ANALYTICS.md` only through its own reviewed PR with a migration to the `activity.mark` constraint.

| Domain | Value event | Signal | Status |
| --- | --- | --- | --- |
| Courses and syllabus intake | A course exists with its deadlines | `course` mark | Exists |
| Study | A study session finished | `studied` mark | Exists |
| Today / Action Center | A chosen next step completed, scheduled or deferred | `acted` | *Needs PR* |
| Registration and degree path | Saved a potential schedule; picked a backup | `plan`, `backup`, `path` | *Needs PR* |
| Advisor meeting prep | Prepared an agenda | `agenda` | *Needs PR*, with Advisor Meeting Mode (confirm shipped) |
| Calendar | Subscribed or exported a feed | Device-side only | Not collected; not planned |
| Career | Portfolio item recorded | Device-side only | Not collected; not planned |
| Family | Student created a share; guardian accepted | `share_created` (taxonomy) | Proposed |
| Ask / AI | Used a cited answer | **Never measured** at individual level (`ai_usage` forbidden) | Excluded by design |
| Clarity check | "Did this help you know what to do next?" | Aggregate-only table, n ≥ 10, never tied to an account | Open design (`ANALYTICS-EVENTS.md`) |

## 5. Lifecycle communication map

Channel state today: **in-app** and **device push (opt-in)** exist in code; **service email** (account, recovery, export, deletion) is transactional; **lifecycle email and SMS are off** (G2 and later). Until G2 every row marked *email* is drafted and rehearsed, not sent. A row is *service* (transactional) or *marketing*; a service message never carries a promotion, and the two are kept separate in `gtm/messaging.ts`.

Audiences: **S** individual student · **SS** sponsored student · **F** faculty/advisor · **A** administrator/champion · **B** buyer account · **G** guardian.

| ID | Stage | Aud. | Trigger | Channel | Class | Cap (§6) | Purpose and content rule | Suppress when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LC-01 | Onboarding | S, SS | Account created | In-app | Service | Once | What Semester stores, where, how to leave; where help is | — |
| LC-02 | Onboarding | S, SS | Setup left unfinished 24–48 h | In-app on next open; email only if opted in | Service | Once | Resume link, one sentence of help. No guilt | Already activated; opted out; quiet hours |
| LC-03 | Activation | S, SS | `student_activated` | In-app | Service | Once | Offers the first plan; shows source and limits | — |
| LC-04 | Activation | S, SS | First win recorded | In-app | Service | Once | Confirms what they did; shows how to undo | — |
| LC-05 | Engagement | S, SS | Student-set reminders and rules | In-app, push | Service | `notify.ts` tiers | The reminders the student asked for | Quiet hours; mutes |
| LC-06 | Engagement | S | Week 1 | Email | Marketing | ≤ 1/week | One planning tip with a source; opt-in only | Opt-out; any complaint |
| LC-07 | Engagement | S | Opted-in weekly review | In-app, email | Service | Weekly | Student's own week, from their data, on device | Opt-out |
| LC-08 | Engagement | S, SS | Week 2 | In-app | Service | Once | "Did this help?" clarity check, answers optional | Declined once |
| LC-09 | Engagement | F | Role quick-start unfinished | Email | Service | Once | Link to quick-start | Opt-out |
| LC-10 | Risk | S, SS | **None.** No individual risk trigger exists | — | — | — | Individual risk scoring is forbidden (`risk_score`, `attention`, `wellbeing_score`) | Always |
| LC-11 | Risk | A, B | Cohort activation below the gate threshold at the midpoint review | Human, not automated | Service | Per review | Operator call about setup failures; evidence in the review | — |
| LC-12 | Risk | A | Integration degraded (`integration_degraded`) | In-app console, email to named owner | Service | Per incident | What failed, what still works, next update time | — |
| LC-13 | Win-back | S | 21 days with no `opened` mark, **and** opted in to product updates | Email | Marketing | **One**, then none for the term | Says what changed; offers export and delete; never mentions deadlines, grades or exams | Opt-out; finals or crisis window; minors or unknown age |
| LC-14 | Win-back | B | Pilot paused or stalled | Human | Service | Per owner review | Offboarding or restart plan, honest about status | — |
| LC-15 | Referral | S | Student opens Share | In-app | Service | On demand | Explains exactly what the link shares (a code, nothing else) | — |
| LC-16 | Referral | S | A referred person activates | In-app, optional | Service | Weekly digest at most | Shows the two numbers: came in, still here | Opt-out |
| LC-17 | Referral | A | Cohort milestone reached | In-app console | Service | Per milestone | Aggregate only, n ≥ 10, with its method | Cell below 10 |
| LC-18 | Renewal | B | T-180, T-120, T-60 days before the decision date | Human, then written summary | Service | Three touches | Outcome review packet with **validated** measures only; open limits stated | Open high-severity issue (cannot convert) |
| LC-19 | Renewal | A | Midpoint (week 13 of the 26-week pilot) | Human | Service | Once | Review of setup failures and staff burden | — |
| LC-20 | Renewal | S (individual Plus) | Renewal date approaches | In-app, billing email | Service | As billing requires | Plain statement of date and amount; cancel is as easy as start | — |
| LC-21 | Alumni | S, SS | Graduation or leave | In-app | Service | Once, before access ends | **Take it with you:** export, what happens to data, option to keep an individual account | — |
| LC-22 | Alumni | S | After export | None | — | — | No alumni marketing without a fresh, separate opt-in | Always |
| LC-23 | Guardian | G | Student shares or revokes | Email or in-app | Service | Per event | Says what changed in scope | — |

Rules that cross every row: no grades, task titles, health, disability, accommodation, aid, conduct or counselling detail in any subject line, preview text or segment; no message uses an exam, deadline or GPA as pressure to prompt a return. The one exception is the opt-in exam-period marketing email allowed by decision D-PR: generic dates only, no school-specific claims, and none of the patterns in §6.6. The student's own reminders remain the only school-specific deadline messages.

## 6. Ethical notification and messaging policy

### 6.1 Principles

1. A message exists because the recipient asked for it, needs it, or agreed to it. "We want them back" is not a reason.
2. Interruption is rationed by the *recipient's* tolerance, not our campaign calendar.
3. Leaving is as easy as joining: one tap to stop, a visible way to change, no penalty.
4. A message never uses the recipient's stress, grades, money worries or fear of falling behind as the lever.
5. Nothing is sent that a screen reader or a person with a poor connection cannot use.

### 6.2 Consent purposes

Separate, unticked by default, per channel, each recorded in `consent_record` (students) or `gtm_consent` (prospects), versioned, and withdrawable.

| Purpose | Default | Basis |
| --- | --- | --- |
| Account and security (verification, recovery, export, deletion) | On; cannot be disabled | Service necessity |
| Reminders the student sets | On when the student creates one | The student's own request |
| Product updates | **Off** | Explicit opt-in |
| Tips and weekly review | **Off** | Explicit opt-in |
| Institution messages through Semester | Governed by the institution's agreement; the student's marketing opt-out still wins | Contract and policy |
| Research and feedback invitations | **Off** | Explicit opt-in |

Email marketing uses confirmed opt-in. SMS is never used for marketing in the first year; SMS reminders need their own explicit opt-in, with no transactional exemption (`messaging.ts`). Counsel reviews every consent text, the age position, and CAN-SPAM, TCPA, ePrivacy, GDPR and FERPA/COPPA applicability before G2. This plan makes no legal conclusion.

### 6.3 Frequency, timing and caps

Quiet hours are evaluated in the **recipient's** time zone. Caps are per person per channel; transactional email is excluded from the marketing cap but is itself kept to what the event requires.

| Class | Cap | Notes |
| --- | --- | --- |
| Critical (money or registration at stake, date is the school's) | Never capped, never dropped | `notify.ts` `critical` tier, student-configured |
| Important (a class, work due, an exam) | 5 a day | `notify.ts` `IMPORTANT_CAP` |
| Helpful nudges | 1 a day, own budget so it cannot starve an important one | `notify.ts` `HELPFUL_CAP` |
| Lifecycle and product-update email | **≤ 1 a week and ≤ 4 in 30 days**, all marketing email combined | Proposed default for `FrequencyCap`; needs a decision (§13) |
| Win-back | One per term | LC-13 |
| Push | Student-configured reminders only; **never marketing** | `push.ts` |
| SMS | Opted-in reminders only; ≤ 2 a week; never marketing | Off until G2+ |

Held to code in §14: the daily caps and the quiet-hour window.

### 6.4 Accessibility of messages

- Text first. Every email is complete as plain text; images carry alt text or are decorative and marked so.
- Meaning never by colour or an image alone; descriptive link text, never "click here"; one clear action.
- Left-aligned, short paragraphs, headings that are real headings, plain language. Reading level is a stated target to test, not a claim.
- Captions and transcripts on all video; no autoplay; no content that expires in a way that excludes people who check slowly.
- Respect the person's stated language and reduced-motion and text-size preferences; test with a screen reader and at 200% zoom before approval.
- Message templates pass the accessibility reviewer role in `activationGate`. That role is held by the same person as the owner, so the owner-is-not-approver rule cannot pass: **a template cannot go live until a second person holds the accessibility reviewer seat.**

### 6.5 User controls

A preference center reachable from every message and from Account: per-purpose and per-channel switches; quiet hours; **pause all marketing for 7, 30 or 90 days or the rest of the term**; one-tap unsubscribe (including the list-unsubscribe header) honoured on the next send decision; view and delete what Semester holds about me as a contact; clear separation between "Semester" messages and "my school" messages. Changes take effect on the next decision, not the next batch.

### 6.6 Prohibited patterns

Pre-ticked consent; confirmshaming ("No, I don't care about my grades"); false urgency, countdowns or scarcity; fake social proof or invented counts; streaks, XP, leaderboards, "you're falling behind"; guilt or shame copy; messages that use exam pressure as the lever (opt-in, generic-date exam-period email is allowed under D-PR, without urgency, grades or fear); hidden or delayed unsubscribe; cancelling harder than starting; contact-list import or "invite everyone" prompts; auto-posting on a person's behalf; reward tied to invite counts; dark-mode-only or low-contrast opt-out controls; push used to recover engagement; any content built from academic, health or financial inference. `FORBIDDEN_MECHANICS` is the code-held list; new patterns are added to it with a failing test first.

### 6.7 Send-time checks and stop rules

Every send decision records campaign, template and version, consent version and an audit event. A send is refused for: no current consent, a stale consent version, a withdrawn topic, suppression, quiet hours, a reached cap, an inactive campaign or no template version (`decideSend`, `gtm_communication_events`).

**Stop a channel** when any hold: complaint rate at or above the mailbox providers' published threshold (verify the current figure; plan to stay well under it), a rise in unsubscribes or notification disablement the experiment owner cannot explain within one review, any accessibility barrier found in a live message, any message that reached a suppressed person, an unresolved P0 or P1, or inability to honour a withdrawal within one send cycle.

## 7. Content, social, ambassadors, community and campaigns

### 7.1 Strategy

Lead with usefulness the reader can use without signing up: a plan for registration week, a way to read a syllabus, a study method. Semester appears as the tool that did it, with its limits stated. Student-facing voice: plain, specific, unhurried. Institutional voice: precise, evidence-dated, candid about what is not live. Ten pillars are held as data in `gtm/social.ts` (clarity, planning, study, campus, career, stories, building, institutional, spotlights, responsible technology).

| Audience | Leading pillars | Format that earns trust | Proof asset |
| --- | --- | --- | --- |
| P1 / P2 | Clarity, planning, study | Short demo of one reversible action; guide page; workshop | Claim IDs CLM-001, 002 with scope |
| P4 | Planning, study, building | Peer-written quick-start; 15-minute walkthrough | Faculty quick-start |
| P5 / P6 | Institutional, responsible technology | Long-form note, webinar, trust-center page, RFP library | Dated evidence, CLM-004, 009 qualified |
| P7 | Stories, spotlights | Ambassador-authored posts with disclosure | The ambassador's own experience |

**Differentiator that can be verified:** the never-measured list. Semester can say, and show in code, what it refuses to track. That is the most credible "responsible technology" content available and it needs no outcome claim.

### 7.2 Production workflow

Brief → draft → **claims check** (every sentence maps to a register row or is opinion, labelled) → accessibility check (§6.4 and the asset template) → privacy check (no real student data; synthetic demos labelled) → approve (owner ≠ approver; unassigned approver blocks publication) → schedule with `utm.ts` link → monitor 72 h → **expire or renew** at the claim's review date. Expired claims are pulled from every channel and logged (claims register withdrawal rule). Each asset record: audience, objective, CTA, claim IDs, evidence and expiry, owner, approver, consent basis, accessibility, UTM, rights, takedown path.

Capacity rule: with one named owner, plan **one student-facing and one institutional piece a week at most**; skip rather than publish unreviewed.

### 7.3 Editorial calendar (hypothesis, one academic year)

Dates for registration, finals and commencement vary by school: confirm each against the registrar calendar before scheduling. The dated twelve-week calendar starting 2026-10-05 is in [`BRAND-AND-MARKETING-STRATEGY.md`](BRAND-AND-MARKETING-STRATEGY.md) §5.4; this table is the year-level frame around it. The finals rule is fixed: supportive resources and export tools, never urgency.

| Window | Student theme | Institutional theme | Gate |
| --- | --- | --- | --- |
| Oct–Nov (now) | Midterms fatigue: a lighter-load week plan; spring registration prep | Why advisors need less setup time; what a 26-week pilot looks like | G0 now; public needs G5 |
| Nov | Registration day: backups and conflicts, in plain terms | Registration-day operations without custom code | G5 |
| Dec | Finals: study methods, rest, **take your work with you before break** | Year-end: pilot outcome-review template | G5 |
| Jan | New term setup: syllabus intake, first-week plan | Spring cohort launch checklist | G3 for institutional |
| Feb–Mar | Midterm planning; internships and portfolio | Procurement-season trust packet; pilot scoping for next fall | G5 |
| Mar–Apr | Fall registration, summer plans | RFP and committee season | G5 |
| Apr–May | Finals and graduation: **Take it with you**, privacy at transition | Outcome reviews; renewal conversations (LC-18) | G5 |
| Jun–Aug | Orientation QR kit, first-week plan | Fiscal-year-start purchasing (confirm per account) | G3, G5 |
| Monthly, all year | One 20–40-minute webinar or workshop | One long-form note | Capacity |

### 7.4 Social operations

| Item | Rule |
| --- | --- |
| Platforms | Instagram and TikTok for practical student content; LinkedIn for institutions, hiring and thought leadership; YouTube for walkthroughs; roles as in `gtm/social.ts` `PLATFORMS` |
| Publishing | Scheduled by a person. **No direct platform auto-publishing** in the first phase (GTM plan §15 phase 2) |
| Replies | A person replies. Anything touching privacy, safety or a claim goes to the claims or privacy owner first. Target: a human response within one business day on privacy or safety questions (hypothesis) |
| Never | Reply with details of a person's account; ask for personal data in comments or DMs; screenshot a user without written permission; argue with a complaint in public |
| Crisis | A student in distress is routed to resources, never counselled; use [`CAMPUS-ESCALATION-POLICY.md`](../CAMPUS-ESCALATION-POLICY.md), [`CRISIS-RESPONSE-RUNBOOK.md`](../CRISIS-RESPONSE-RUNBOOK.md) and [`CRISIS-COMMUNICATIONS-TEMPLATE.md`](../company/CRISIS-COMMUNICATIONS-TEMPLATE.md) |
| Listening | Weekly review of mentions for confusion, errors in our claims and safety signals. Counted by theme, never by person |
| Paid | None (G6) |

### 7.5 Creator and ambassador program (design for counsel; G4)

`referral.ts` gives an ambassador a link and **two numbers**: how many people came in, and how many are still here. Nothing more. The plan it comes from says the paying half is not built until two or three real ambassadors have been tracked by hand off exactly those numbers.

| Design point | Proposal |
| --- | --- |
| Roles | Campus ambassador (workshops, honest stories); creator (own-channel content). One program, two tracks |
| Selection | Open application; selection on fit and availability, not follower count; no pay-to-join |
| Time | ≤ 3 hours a week, stated up front; may pause at any time, especially in finals |
| Training | Claims library, what Semester stores and refuses to track, accessibility basics, community rules, how to say "I don't know" |
| Compensation | **Never per sign-up and never tied to invite counts** (AMB-002). Recognition, development and a flat stipend are candidates. **Structure and disclosure text unwritten (ETH-003); counsel decides.** Ambassadors who are also school employees may be bound by school policy |
| Disclosure | Every post by an ambassador states the relationship in plain words. FTC endorsement rules apply: counsel confirms exact wording |
| Boundaries | No access to other students' data; no contact scraping; no posting classmates' details; no claims outside the library; no pressure on peers; no recruiting minors |
| Measurement | The two referral numbers per ambassador, shown to that ambassador only; program-level aggregates at n ≥ 10 |
| Exit | An ambassador can leave at any time; their code stays valid for those already referred |
| Stop | Any complaint of pressure, any undisclosed post, any claim outside the library: pause that ambassador and review |

### 7.6 Community guidelines (brand channels and any Semester-run space)

The in-app community is governed by [`COMMUNITY-PRIVACY-MODEL.md`](../COMMUNITY-PRIVACY-MODEL.md), [`CAMPUS-MODERATION-SOP.md`](../CAMPUS-MODERATION-SOP.md), [`COMMUNITY-MEDIA-SAFETY.md`](../COMMUNITY-MEDIA-SAFETY.md) and [`VOLUNTEER-MODERATOR-PROGRAM.md`](../VOLUNTEER-MODERATOR-PROGRAM.md). For brand channels, publish before opening: be respectful; no harassment, doxxing or sharing others' academic records; no content that helps anyone cheat or misrepresent their work (Semester is a study tool, not an essay mill); no medical, legal or mental-health advice, with resources linked instead; report, block and appeal routes; moderators named, trained and backed up; hours stated. **Do not open a space without a staffed moderator and an escalation owner.** Do not optimise comparison, popularity or outrage.

### 7.7 Campaign briefs

Each brief is a `Campaign` object that must pass `activationGate`. Claim IDs are from the claims register; a brief cannot use a claim whose approval state forbids the channel.

| ID | Name | Audience | Insight | Core message | Claims | CTA | Measure | Guardrails and stop | Gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | One week, not twenty tabs | P1 | Term setup is scattered across systems | "See your whole week in one place, from sources you choose" | CLM-001, 002 | Start with one course | Activated starts per cohort | No outcome claims; stop on complaints or a11y barrier | G1 beta, G5 public |
| B2 | Registration, calmly | P1, P4 | Registration day is high-stakes and rushed | "Plan backups and conflicts before the clock starts" | CLM-001, 004 as bounded | Join the workshop | Workshop attendance → activation | Never imply registration is official or guaranteed; no countdowns | G3, G5 |
| B3 | Fifteen minutes before the meeting | P4 | Advisors lose time reconstructing context | "Arrive with the agenda ready" | CLM-001 | Try the walkthrough | Qualified walkthroughs | Confirm Advisor Meeting Mode shipped before use | G3 |
| B4 | What we will never measure | All | Students suspect analytics are surveillance | "Here is the list, and the code that enforces it" | CLM-009 qualified to named controls | Read the trust page | Trust-page reads → qualified conversations | Cite `FORBIDDEN` and its test only; no "secure" or "compliant" | G5 |
| B5 | A pilot beside your systems | P5, P6 | Rip-and-replace is a non-starter | "26 weeks, a named cohort, read-only, with an exit" | CLM-004 conditional | Request scoping | Qualified accounts; committee coverage | No customer or outcome claims; no integration availability (CLM-005) | G0 discovery |
| B6 | Take it with you | P1, P2 | Graduation breaks continuity | "Your work is yours: export it, keep it, or leave" | CLM-001, 002 | Export | Exports completed; not signups | No retention pressure on leavers | G5 |
| B7 | Beta invitations | Invited P1 | Early users want a say | "Help shape it; leave any time with your data" | CLM-003 | Accept invite | Accepted invites → first win | Invite-only; 4 statements from `PRIVATE-BETA-PROGRAM.md` are the only claims | G1 |

## 8. Product-led growth loops

A loop is allowed only if the sender gains something real, the receiver is not surprised, and removing the loop would not reduce the product's value. A viral coefficient is **not a target**; "referred and still here" is a result, reported with its denominator.

| Loop | Trigger | Value to sender | Value to receiver | What leaves the device | Measure | Kill rule |
| --- | --- | --- | --- | --- | --- | --- |
| L1 Syllabus-to-start | Faculty or advisor shares a course setup | Fewer setup questions | Starts with deadlines present | Course structure the faculty member chose; no student data | Cohort activation | Faculty reports confusion or burden |
| L2 Plan template | Student chooses to share a content-free plan structure | Shows a method they like | A working starting point | Structure only; no names, titles of private tasks or grades | Shares → activated | Any share containing personal content |
| L3 Study-time coordination | Student invites a named classmate to find shared time | Easier group scheduling | Meeting set quickly | An invitation the sender writes and sends; no contact import | Invites → accepted | Any import of contacts; any unsolicited reminder |
| L4 Referral link | Student shares a code | Helps a friend | Starts with a friend | A code in a URL; removed from the address bar on read | Came in, still here (`referral.ts`) | Pressure, rewards by count, or any identity disclosure |
| L5 Calendar feed | Student subscribes a feed or exports ICS | Their plan in their own calendar | Shared availability if they choose | A feed they control and can revoke | Subscriptions revoked or kept | Token exposure |
| L6 Wrapped export | Student confirms a private recap | Reflection | Optional audience | A text or image they previewed and approved | Exports confirmed (device-side only) | Anything not previewed; any comparison |
| L7 Cohort evidence | Pilot outcome review | Champion defends the purchase | Next department sees real data | Aggregates at n ≥ 10 with method and caveats | Referrals from champion | Small cell; outcome claims beyond the data |

Anti-spam guardrails for every loop: invitations are written and sent by a person through their own share sheet or link; no automatic reminders to non-users; at most one Semester-originated message to a non-user, and only on explicit request; sender sees how many acted, never who; a recipient can decline once and permanently.

## 9. Experimentation framework

### 9.1 The power problem

Cohorts are 50–200 students. For a two-arm test on a binary outcome with a 40% baseline, 80% power and 5% significance, the smallest detectable difference is roughly **27 percentage points at 50 per arm, 19 at 100, 14 at 200 and 9 at 500** (normal approximation). Small copy tweaks cannot be detected. Therefore:

- Test **mechanisms with large expected effects** (a manual first-week start vs none), not button colour.
- Prefer within-cohort before/after with a matched comparison group, reporting intervals not p-values. "Not significant" is not "no effect" (existing protocol).
- Triangulate with representative usability sessions and the clarity check before trusting a small difference.
- Never run tests whose only plausible winner is the manipulative variant.

### 9.2 Pre-registration template

Owner · hypothesis in one sentence · user benefit · eligible population and exclusions · comparison or randomisation · primary metric and denominator · guardrails (below) · fields collected and retention · minimum practical effect · duration and sample rationale · stop and rollback rules · review authority · consent obtained · accessibility of **every** variant checked. Results, limits and the decision are archived, including null and negative outcomes.

### 9.3 Never experimented on

Consent clarity; privacy and security defaults; accessibility access; adverse academic decisions; financial aid; discipline; accommodation; crisis and support routing; notification intensity beyond the §6 caps; anything affecting a minor or someone in a vulnerable moment for conversion.

### 9.4 Guardrails and automatic stop conditions

| Guardrail | Proposed stop condition (hypothesis; needs approval) |
| --- | --- |
| Notification disablement or unsubscribes | Variant worse than control by more than the pre-registered margin at any review |
| Complaint or privacy report | Any attributable to the variant |
| Accessibility | Any barrier in any variant |
| Support burden | Variant tickets materially above control for the same cohort |
| Opt-out or deletion | Unexplained rise |
| Source or authority error | Any variant that shows an unlabelled recommendation as official |
| Incident | Any P0 or P1 |
| Withdrawal | Inability to honour it |
| Sensitive collection | Unexpected capture of content or sensitive categories |

### 9.5 Backlog additions

Existing five hypotheses stay in [`GROWTH-EXPERIMENT-BACKLOG.md`](../market-readiness/GROWTH-EXPERIMENT-BACKLOG.md). Candidates to add, each *proposed*:

| Hypothesis | Primary | Guardrail |
| --- | --- | --- |
| Starting from a syllabus (L1) raises setup completion over manual entry | Activation | Support burden, data errors |
| A visible "how to leave and take your data" step before sign-up raises trust and does not lower activation | First win, trust-check completion | Activation |
| Naming the limits on the first screen increases comprehension | Comprehension quiz result | Abandonment |
| A registration-prep workshop produces more first wins than a guide page | First win | Capacity |
| Faculty-delivered orientation outperforms an email announcement | Cohort activation | Faculty burden |
| An in-app resume prompt beats email for unfinished setup | Resumed setup | Disablement |
| Peer-written quick-start beats staff-written | Quick-start completion | Accuracy errors |
| Showing the never-measured list on the trust page increases qualified conversations | Qualified next steps | Claim inflation |
| A midpoint operator call improves week-26 conversion decisions | Conversion decision quality | Staff burden |
| Offering export at graduation increases voluntary re-registration | Re-registration | Pressure complaints |

## 10. Attribution, analytics, privacy and data minimisation

### 10.1 What can be measured without changing the promise

`ANALYTICS.md` promises three server marks per account per day (`opened`, `course`, `studied`), no screen, title, course, count or text. The Content-Security-Policy lists every host the app may call, and a test fails if an analytics vendor is added. Growth must live inside that.

| Tier | Method | Needs a decision? | Status |
| --- | --- | --- | --- |
| **0 — no new collection** | Referral codes; invite source on `public.invites`; cohort or tenant membership; institutional pipeline fields in `gtm_*`; pilot metrics with baselines; qualitative intake; the three marks | No | Usable at G1 |
| **1 — small, aggregate, first-party** | A cookieless counter of public-site visits by UTM campaign, aggregate only, no IP or ID retained; an optional one-tap "how did you hear about us" at the end of onboarding, stored as a coarse category | **Yes.** `ANALYTICS.md` question first, then a reviewed PR; privacy owner assigned | Proposed |
| **2 — not planned** | Third-party pixels, ad-network conversion APIs, cross-site tracking, fingerprinting, session replay, contact matching, purchased data | Prohibited by policy and by test | Never |

### 10.2 Attribution model

Honest and plain. Student acquisition is attributed **at the cohort or campaign level**, not the person: activated students per cohort, split by campaign code from `utm.ts` (`{tenant}_{cycle}_{audience}_{objective}`), plus referral codes. Institutional pipeline uses stage-entry source plus a human-entered "how the committee found us". Every dashboard labels its attribution model and states that it makes no causal claim (`kpi.ts`). Cost per activated student and CAC payback are computed from spend and cohort counts, never from individual tracking. Email opens are not used: mail privacy protection inflates them; prefer clicks and completed actions.

### 10.3 Data-minimisation table

| Dataset | Fields | Purpose | Retention | Access | On deletion |
| --- | --- | --- | --- | --- | --- |
| Activity marks | account, day, one of three marks | Activation, WAU, 30-day retention | Per `RETENTION.md` | Aggregates only | Deleted with the account |
| Referral | code, claimed account, still-here flag | The two numbers | Per `RETENTION.md` | Referrer sees counts only | Unlinked on account deletion |
| Prospect contact (B2B) | name, work email, role, institution, consent version | Institutional discovery | **Gap: no purge exists.** Proposed: 12 months after last interaction, sweep before G2 | `account_executive` | Suppression entry kept, nothing else |
| Consent and suppression | contact key, purpose, channel, version, timestamp | Proof and honouring | Keep for as long as the contact could be messaged; append-only | Workers and privacy owner | Minimal suppression record retained so we do not message again |
| Send log | campaign, template version, decision, consent version | Audit | Per `RETENTION.md` | Marketing analyst, access logged | Per contact retention |
| Experiment records | hypothesis, cohort counts, results | Learning | Indefinite for aggregates; no individual rows | Growth owner | n/a |
| Campaign reports | Counts suppressed under 10 | Reporting | Indefinite | Staff via `gtm_campaign_report`, reads logged | n/a |

**Never collected for growth:** course or task content, grades, health or disability, conduct, aid or immigration, messages, exact location, AI prompts, device fingerprints. No student contact lists. No student data in the prospect CRM.

Privacy review of any new field is a precondition, not a follow-up. Subprocessors for any sender, form or scheduling tool must appear in [`SUBPROCESSORS.md`](../SUBPROCESSORS.md) before first use. Applicability of CAN-SPAM, TCPA, ePrivacy, GDPR, FERPA and COPPA, and international transfer questions, are for qualified counsel.

## 11. Institution demand programs and account-based marketing

### 11.1 Account selection

Use [`FIRST-10-INSTITUTIONS-TARGETING-PLAN.md`](../market-readiness/FIRST-10-INSTITUTIONS-TARGETING-PLAN.md): only real warm paths or observed needs; ten criteria scored 0–2; start with the top three; keep a disqualification reason and next action. Never name an institution publicly without written permission (CLM-013). Vanderbilt is a **candidate** tenant with 0 of 60 approvals recorded; this plan treats it as a design partner prospect, not a customer or an endorsement.

| Tier | Accounts | Treatment |
| --- | --- | --- |
| 1 | ≤ 3 | 1:1: researched, bespoke outcome workshop, direct committee engagement |
| 2 | ≤ 7 | 1:few: shared plays by segment (first-year success, advising, registration, honors, regional private) |
| 3 | Inbound | Programmatic: trust page, webinars, RFP library |

### 11.2 Buying committee plays

| Role | Their question | Proof asset | Never say |
| --- | --- | --- | --- |
| Student success / advising lead | Will my staff and students actually use it? | Outcome workshop; pilot scorecard; faculty and advisor quick-starts | An outcome result |
| Registrar | Does this touch official records? | Pilot-beside-existing-systems scope; read-only data plan | "Replaces the SIS" (CLM-006 prohibited) |
| CIO / CISO | What data, where, who can see it? | Trust room under NDA; data inventory; honest gaps | "Secure", "compliant", certifications (CLM-010) |
| Accessibility office | Is it usable for every student? | Accessibility conformance plan; test scope; limits | "WCAG conformant" (CLM-008) |
| Faculty / senate | Does it change my authority or add burden? | Quick-start; no grading authority change | "AI grades" |
| Procurement / finance | What does it cost, what is the exit? | Price book when approved; offboarding plan | Any price until CLM-015 is re-approved |
| Student government | Will students be surveilled? | The never-measured list and its test | "Engagement analytics" |

### 11.3 Programs

| Program | Format | Cadence | Output |
| --- | --- | --- | --- |
| Outcome workshop | 90-minute working session with a multi-stakeholder group | Per qualified account | Written scope and 3–5 baseline-ready metrics |
| Registration-readiness series | Advisor and student sessions | Per term | Workshop-to-activation data |
| Trust-center-first evidence | Public trust page; NDA room for detail | Reviewed monthly | Questions logged; expiring evidence refreshed |
| Practitioner roundtable | Candid discussion of fragmentation and privacy | Quarterly | Leads, never pitches |
| Conferences | Candidate venues: EDUCAUSE, NASPA, NACADA, AACRAO; confirm dates and fit | Chosen by capacity | Conversations, not badge scans |
| RFP response | `rfp.ts` and the library, with counsel review | On demand | Answers that cite repository evidence and open gaps |

### 11.4 Demand-signal rule

Telling an institution "N of your students use Semester" is information about students. Default **off**. It requires counsel review, plain disclosure to students, n ≥ 10, and the school's agreement. Without those, the signal an account hears comes from its own champions.

### 11.5 Pipeline metrics

Qualified accounts; committee roles engaged per account; days in each `SALES_STAGES` stage; pilot-to-annual conversion (`kpi.ts` `pilot_conversion_rate`); CAC and payback once any revenue exists. All with window and denominator.

## 12. Dashboards and operating cadence

### 12.1 Dashboards

| # | Dashboard | Core metrics | Source | Refresh |
| --- | --- | --- | --- | --- |
| D1 | Student funnel | Registered, activated, first win, Day 7/30 retained, by cohort | Activity marks; proposed marks after their PRs | Weekly |
| D2 | Lifecycle health | Sends, opt-ins and opt-outs, complaints, suppressions, refused sends by reason | `gtm_communication_events` | Weekly |
| D3 | Content and social | Qualified next steps per asset; claim expiry in 30 days; accessibility pass rate; corrections issued | Content register; UTM | Weekly |
| D4 | Institutional pipeline | Accounts by stage, committee coverage, days in stage | `gtm_accounts`, `stages.ts` | Weekly |
| D5 | Experiments | Running, stopped, decided; guardrail status | Experiment register | Biweekly |
| D6 | Trust and guardrails | Support burden, export and deletion requests, accessibility blockers, claim withdrawals, P0/P1 | Support queue, incident log | Daily glance |

Every dashboard: labels its attribution model; suppresses cells under 10; logs access (`gtm_report_access`); returns no rate for an empty cohort; shows methodology beside each number; includes **no individual risk score** and no individual-level view.

**One measure of success:** students who reached first win and were still using Semester four weeks later, with trust guardrails green. Not accounts, not impressions, not opens.

### 12.2 Cadence

| When | Who | What |
| --- | --- | --- |
| Daily, 10 minutes | Growth owner | D6 and any live channel: complaints, accessibility, claims, incidents |
| Weekly, 45 minutes | Growth owner (+ reviewers when assigned) | D1–D4; decisions on content, outreach, cohort next steps |
| Biweekly | Experiment owner | D5; start, stop, or decide |
| Monthly | Growth, claims and privacy owners | Claim expiry and evidence refresh; content audit; subprocessor and retention check |
| Per term | Growth owner | Calendar, cohort retrospective, ambassador review |
| Quarterly | Founder | Strategy, ICP, pricing status and gates; feeds [`QUARTERLY-OPERATING-REVIEW.md`](../company/QUARTERLY-OPERATING-REVIEW.md) |

**Bus-factor risk:** the owner is one named person; the privacy, accessibility and claims reviewers, the analyst, the moderator and the backup experiment owner are all that same person (recorded 2026-10-04), with no backup. Several controls in this plan (owner ≠ approver, reviewer sign-offs) cannot be satisfied until at least two more people hold those roles. Filling them is the first growth task.

### 12.3 30 / 60 / 90

| Window | Work | Exit |
| --- | --- | --- |
| 0–30 days | Assign reviewer roles; write the consent texts for counsel; build the content register; draft B1, B4, B5; rehearse on synthetic data; choose the sender and add it to subprocessors | G0 complete; G2 inputs ready |
| 31–60 days | Open G1 messaging to invited beta members (in-app and service only); retention sweep for `gtm_*`; preference center; first outcome workshop with the top-ranked account | G1 live; sweep tested |
| 61–90 days | G2 consented email to opted-in members; first hand-tracked ambassador pair under counsel's disclosure text; first two controlled experiments | G2 live; ambassador disclosure approved |

## 13. Decisions requested

Each becomes `docs/decisions/D-<pull request number>.md` when taken, per `CLAUDE.md`. None is taken here.

1. **Lifecycle email default cap** (≤ 1 a week, ≤ 4 in 30 days) and **win-back** (one per term, 21-day trigger).
2. **Analytics Tier 1**: the cookieless public-site counter and optional "how did you hear" answer (needs an `ANALYTICS.md` question and a reviewed PR).
3. **Which proposed marks** (`acted`, `plan`, `backup`, `path`, `agenda`) to move from definition to implementation, in order.
4. **Prospect retention period** (12 months after last interaction proposed).
5. **Ambassador disclosure text and compensation** (counsel).
6. **Age and minors position for marketing** (counsel).
7. **Institutional demand-signal reporting** (default off).
8. **Reviewer assignments**: privacy, accessibility, claims, analyst, moderator, backup.
9. **Exam-period marketing email: decided 2026-10-04, allowed with safeguards (D-PR).** Opt-in marketing email before midterms, registration and finals is allowed, using generic dates only, subject to every rule in §5 and §6.6 and the one-a-week cap. §5 and §6.6 are reworded to match.

## 14. Numbers held to code

A test (`app/src/lib/gtm/growthplan.test.ts`) fails if this table drifts from the code, so a reviewer can quote it.

| ID | Quantity | Value | Where in code |
| --- | --- | --- | --- |
| NUM-1 | Important notifications a day | 5 | `notify.ts` `IMPORTANT_CAP` |
| NUM-2 | Helpful notifications a day | 1 | `notify.ts` `HELPFUL_CAP` |
| NUM-3 | Quiet hours start (recipient local hour) | 21 | `gtm/messaging.ts` `DEFAULT_QUIET_HOURS` |
| NUM-4 | Quiet hours end (recipient local hour) | 8 | `gtm/messaging.ts` `DEFAULT_QUIET_HOURS` |
| NUM-5 | Smallest cell any aggregate may show | 10 | `institution-ops.ts` `MIN_COHORT` |

## 15. Evidence state, claim ceiling and prohibited claims

**Repository evidence.** Rules for targeting, consent, quiet hours, caps, UTM, KPI formulas, sponsorship and pilots are code with tests. Funnel, event, claim and campaign controls are written. This plan adds an operating layer on top.

**Operational evidence.** No live lifecycle email, consent operation, ambassador, public campaign, conversion baseline, attribution result, experiment or institutional pipeline outcome is evidenced. Reviewer roles are unfilled.

**Missing test or proof.** Everything under §2 gates G1–G5; the Tier 1 analytics decision; counsel review of consent, disclosure and age; a retention sweep; accessibility review of templates; a measured baseline.

**Claim ceiling.** Semester may describe this as a proposed, ethically bounded growth operating plan, and may state the never-measured list and the notification rules **as the code and tests enforce them**, with the register's qualifiers.

**Prohibited.** Any conversion, activation, retention, growth, referral, attribution, lift, traction, product-market-fit, institutional-outcome, customer, partner, price or capability claim drawn from this plan. Any statement that a lifecycle channel, ambassador program or public campaign is live.

## 16. Shared-preamble outputs

### Assumptions

- The launch verdict is still `NO-GO`; individual paid acquisition stays disabled.
- Calendar windows in §7.3 vary by school and are not confirmed.
- Mailbox-provider complaint thresholds, FTC and platform rules, and fiscal-year timing are stated from general knowledge and must be verified before use.
- Caps beyond those in §14 are proposals.

### Risks and unresolved questions

- One owner holds every role; reviewer-gated controls cannot pass.
- Email sender, consent texts and preference center do not exist.
- No retention purge exists for contacts or sends.
- Attribution is weak by design; some channels will be judged qualitatively.
- Small cohorts cannot detect small effects.
- Ambassador compensation and disclosure are unwritten.
- Whether Advisor Meeting Mode has shipped is unconfirmed.
- The claims register's price row (CLM-015) predates the live Plus acceptance and needs a dated re-review.

### Files changed

`docs/gtm/GROWTH-OPERATING-PLAN.md` (new), `app/src/lib/gtm/growthplan.test.ts` (new), a pointer in `docs/gtm/EXECUTION-PLAN.md`.

### Tests added

`growthplan.test.ts`: the numbers in §14 equal the code; every claim ID cited exists in the register; every repository link resolves; every `FORBIDDEN` id appears in the plan.

### Accessibility implications

§6.4 sets message accessibility; templates cannot activate without the accessibility reviewer role filled; all variants in an experiment must be checked; content assets require captions, alt text and transcripts.

### Security and privacy implications

No new data collected by this change. Any Tier 1 analytics, sender, preference center or form is a separate reviewed change with a subprocessor entry and retention rule.

### Operational and runbook implications

Adds an operating rhythm (§12.2) and stop rules (§6.7, §9.4). A message-incident runbook (a send to a suppressed person, a wrong-segment send) is **not yet written** and is required before G2; use [`CRISIS-COMMUNICATIONS-TEMPLATE.md`](../company/CRISIS-COMMUNICATIONS-TEMPLATE.md) as the base.

### Traceability

| Ask | Section | Existing evidence | Code or test |
| --- | --- | --- | --- |
| 1 Funnel | §3 | `GROWTH-FUNNEL-SPEC.md` | `gtm/stages.ts`, `gtm/kpi.ts` |
| 2 Activation | §4 | `STUDENT-ONBOARDING-PLAYBOOK.md`, `ANALYTICS-EVENTS.md` | `activity` constraint |
| 3 Lifecycle | §5 | `EMAIL-LIFECYCLE.md` | `gtm/messaging.ts` |
| 4 Policy | §6, §14 | `ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md` | `notify.ts`, `community/engagement.test.ts`, `growthplan.test.ts` |
| 5 Content and community | §7 | `CONTENT-AND-COMMUNITY-PLAN.md` | `gtm/social.ts`, `referral.ts` |
| 6 Loops | §8 | `SEMESTER-WRAPPED.md` | `referral.test.ts` |
| 7 Experiments | §9 | `EXPERIMENTATION-PROTOCOL.md` | — |
| 8 Attribution | §10 | `ANALYTICS.md`, `PRODUCT-ANALYTICS-DATA-ETHICS.md` | `gtm/utm.ts`, `phase5docs.test.ts` |
| 9 Institutions | §11 | `INSTITUTIONAL-GTM-PLAYBOOK.md` | `gtm/stages.ts`, `gtm/rfp.ts` |
| 10 Dashboards | §12 | `REVENUE-OPERATIONS-DASHBOARD-SPEC.md` | `gtm/kpi.ts` |
