# Onboarding Workflow (sales handoff to pilot results)

| Control | Value |
| --- | --- |
| Status | **DRAFT - PREPARED WORKFLOW, NOT APPROVED, NOT EXECUTED FOR ANY CUSTOMER** |
| Owner | Harrison Rubin (interim, single point of failure; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [DECISION OPEN] [REVIEW: privacy] [REVIEW: security] [REVIEW: accessibility] [REVIEW: counsel] |
| Audience | Internal. Customer-facing extracts must be rebuilt from approved wording and use `[PLACEHOLDER]` for dates and price. |

> This is an operating document, not legal, tax, accounting, insurance, privacy, security or accessibility advice. Every date below is a planning hypothesis, not a service level or delivery commitment.

**Label legend.** [VERIFIED] = proven by a repository path or evidence id. [ASSUMPTION] = planning number or timing. [DRAFT] = new, needs review. [INTERNAL] = not for customers as-is. [DECISION OPEN] = the founder must decide and record it as `D-<pull request number>`. Count of [APPROVED] items in this document: **zero**.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [`../../commercial/CUSTOMER-ONBOARDING-PLAYBOOK.md`](../../commercial/CUSTOMER-ONBOARDING-PLAYBOOK.md) | Entry criteria, days 0-5 / 6-15 / 16-30 / 31-45 / 46-60 sequence, "an unmet gate moves the date" | The user's eight-phase lifecycle as one table with owner, trigger, inputs, steps, outputs, system of record, KPI, risks, approvals, acceptance; side-by-side timing for the 26-week and 8-12-week readings | The controlled playbook is a 46-line sequence; it has no per-phase control columns and must not be re-timed silently |
| [`../../commercial/STAGE-COLLATERAL-AND-HANDOFF.md`](../../commercial/STAGE-COLLATERAL-AND-HANDOFF.md) | The 12-item sales-to-implementation handoff and its acceptance rule | Customer-side items and a Semester-side CS checklist layered on it (section 6) | Linked, not re-written |
| [`../../commercial/INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md`](../../commercial/INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md), [`../../institutional-implementation/METHODOLOGY.md`](../../institutional-implementation/METHODOLOGY.md) | Ten-phase delivery method, stored stage names, rollout exit gates | Mapping of the eight customer-visible phases onto it and onto `SALES_STAGES` | Different audience: this is the customer-success view |
| [`../../commercial/IMPLEMENTATION-PLAN-TEMPLATE.md`](../../commercial/IMPLEMENTATION-PLAN-TEMPLATE.md), [`../../market-readiness/PILOT-IMPLEMENTATION-PLAYBOOK.md`](../../market-readiness/PILOT-IMPLEMENTATION-PLAYBOOK.md) | Pilot identity, work plan, 12-row stage table, RACI by work item | A reusable customer RACI by named role (section 5) | Existing RACI is by Semester function, not by customer role |
| [`../../institutional-implementation/`](../../institutional-implementation/README.md) (INTEGRATION, TENANT-CONFIGURATION, TRAINING, HYPERCARE, SUCCESS-SYSTEM workbooks) | Workbook-level detail per workstream | Pointers only | Do not duplicate |
| [`../../market-readiness/PILOT-LAUNCH-CHECKLIST.md`](../../market-readiness/PILOT-LAUNCH-CHECKLIST.md), [`../../market-readiness/PILOT-ADMIN-RUNBOOK.md`](../../market-readiness/PILOT-ADMIN-RUNBOOK.md), [`../../market-readiness/ADMIN-ONBOARDING-GUIDE.md`](../../market-readiness/ADMIN-ONBOARDING-GUIDE.md) | Launch checklist, admin operations, admin training steps | Linked from the Training and Launch phases | Already complete for their scope |
| [`../../market-readiness/CAMPUS-LAUNCH-KIT.md`](../../market-readiness/CAMPUS-LAUNCH-KIT.md), [`../../commercial/STUDENT-ONBOARDING-PLAYBOOK.md`](../../commercial/STUDENT-ONBOARDING-PLAYBOOK.md), [`../../pilot/FIRST-DAY-CHECKLIST.md`](../../pilot/FIRST-DAY-CHECKLIST.md) | Launch-kit contents, student first win, first-day checklist | Pointer (section 8) | Already complete |
| [`../../commercial/SUPPORT-OPERATIONS.md`](../../commercial/SUPPORT-OPERATIONS.md), [`../../SUPPORT-AND-TRUST-SAFETY-OPERATING-MODEL.md`](../../SUPPORT-AND-TRUST-SAFETY-OPERATING-MODEL.md) | Service boundary, 7-step operating loop, P0-P3 severity matrix | One-page pilot support workflow that links them (section 9) | Do not restate severities |
| [`../../PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md), `app/src/lib/gtm/pilot.ts` | `pilotReadiness`, `pilotVerdict`, `PILOT_WEEKS = 26`, the lifecycle `discovery > configure > train > launch > hypercare > learn > decide` | Phase mapping and the open timing decision | Code remains the authority |

## Gate (what is allowed now versus held)

Source: [`../../../GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md) (2026-10-03). [VERIFIED]

| Motion | Verdict today | What this workflow permits NOW | HELD until the gate flips |
| --- | --- | --- | --- |
| Design-partner institutional pilot | GO / GREEN for **non-activation engagement only** | Discovery; synthetic-data demos; evidence exchange; conditional, non-binding scoping; a **tabletop dry run** of this workflow against synthetic data; completing templates (RACI, plan, success plan) with `[PLACEHOLDER]` values | Tenant activation; live customer data; student invitations; any customer, logo or pilot claim; every phase below as an operated phase |
| Paid institutional pilot | **NO-GO / RED** | Nothing operational | Accepting payment; committing to a launch date; order form; invoice |
| Broad enterprise sale | NO-GO / RED | Nothing | Everything |

Phases 1-8 are therefore a **prepared workflow**. No phase has been run for any customer. [VERIFIED: no customer or pilot exists, `../../../GO-NO-GO-DECISION.md`, `../../../EVIDENCE-REGISTER.md`]

## 1. Stage mapping and the timing conflict

### 1.1 Mapping to the sales stages [VERIFIED: `app/src/lib/gtm/stages.ts`]

| Phase (user's spec) | `SALES_STAGES` identifier | Account status (`ACCOUNT_STATUS_OF`) | Gate to enter (`SALES_EXIT`) |
| --- | --- | --- | --- |
| 1 Sales handoff | `contracted` | `pilot` | "Procurement and legal have signed; the deal desk review has no refusals." |
| 2 Welcome + kickoff | `implementation` | `pilot` | Implementation lead accepts the handoff checklist in writing ([`STAGE-COLLATERAL-AND-HANDOFF.md`](../../commercial/STAGE-COLLATERAL-AND-HANDOFF.md)) |
| 3 Configuration / data | `implementation` | `pilot` | (same) |
| 4 Training | `implementation` | `pilot` | (same) |
| 5 Launch | `live` | `customer` | "The launch council returned go for the first cohort." |
| 6 Adoption | `live` | `customer` | (same) |
| 7 Midpoint review | `live` | `customer` | (same) |
| 8 Results + conversion | `renewal` | `customer` | "The pilot has a signed, final verdict (`pilotVerdict` in #817) with outcomes measured." |

Observation [DRAFT]: `stages.ts` maps `live` to account status `customer`, so a pilot in its measurement period reads as a `customer` account although no paid customer exists and a paid pilot is NO-GO. Reporting must not count `live`-stage design-partner pilots as customers or revenue. Raise with the lead before any funnel report uses `ACCOUNT_STATUS_OF`.

### 1.2 Timing: the user's 8-12 weeks versus the code's 26 weeks [DECISION OPEN]

| Source | Rule |
| --- | --- |
| `PILOT_WEEKS = 26`, `PILOT_DAYS = 182` in `app/src/lib/gtm/pilot.ts`; D-134 (`../../DECISION-LOG.md`); [`../../PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md) | `pilotReadiness` returns `duration` unless end minus start is exactly 182 days. A 12-week plan **fails** the check. [VERIFIED: `app/src/lib/gtm/pilot.test.ts` "runs every pilot for exactly 26 weeks"] |
| Deal desk `maxPilotMonths = 6` (`app/src/lib/governance/deal-desk.ts`) | Outer limit; both readings fit inside it. [VERIFIED] |
| Existing onboarding docs | 30-60 day implementation window **inside** a 26-week pilot ([`../../commercial/PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md)). [VERIFIED] |
| User's planning assumption | One academic term or 8-12 weeks. [ASSUMPTION] |

Side-by-side, in relative phases. Both columns are [ASSUMPTION]; neither is chosen here.

| Phase | Reading A: user's planning assumption (8-12 week pilot) | Reading B: code rule (26-week pilot, onboarding inside it) |
| --- | --- | --- |
| 1 Sales handoff | Immediately after signature | Immediately after signature |
| 2 Welcome + kickoff | Days 0-5 | Days 0-5 |
| 3 Configuration / data | Weeks 1-2 | Weeks 1-3 (days 6-21; existing playbook: days 6-15 paper/data, 16-30 configuration) |
| 4 Training | Weeks 2-3 | Weeks 3-5 |
| 5 Launch | Weeks 3-4 | Weeks 6-8 (existing playbook: launch-council evidence days 46-60, then signed GO) |
| 6 Adoption | Weeks 4-8 (or to week 10 in a 12-week term) | Weeks 8-~24, including at least two weeks of hypercare before "learn" |
| 7 Midpoint review | About week 5-6 (half of 8-12) | Week 13 (half of 26); `pilotReadiness` requires a `midpointReviewDate` |
| 8 Results + conversion | Final 2 weeks (weeks 7-8 to 11-12) | Final 2 weeks (weeks 25-26); conversion date between end minus 14 days and end plus 30 days (`conversion_outside_window` rule) |

**Why this matters.** Reading A cannot be entered into the readiness check as written, and "annual price agreed" (`annualPriceAgreed`) is also a readiness requirement, which conflicts with the HELD price quote. Options for the founder, to be recorded as `D-<pull request number>` by the lead: (1) keep 26 weeks, treat 8-12 weeks as an onboarding-plus-first-value sprint inside it; (2) change `PILOT_WEEKS` by a dated decision and update `pilot.test.ts`, the framework and the finance model together; (3) allow a shorter "design-partner sprint" outside `pilotReadiness`, labelled as such. Until decided, every template here shows relative phases, not dates.

## 2. Phase table (the lifecycle)

Phase | Target timing | Semester output | Customer outcome. Timing is relative to signature (Reading A / Reading B in 1.2).

| # | Phase | Target timing [ASSUMPTION] | Semester output | Customer outcome |
| --- | --- | --- | --- | --- |
| 1 | Sales handoff | Immediately after signature | Account plan, scope, risks, success criteria (accepted handoff packet) | Customer knows who owns what and what was and was not promised |
| 2 | Welcome + kickoff | Days 0-5 | Welcome message, kickoff agenda, RACI, implementation plan | Named sponsor, champion and reviewers; agreed plan and dates |
| 3 | Configuration / data | A: weeks 1-2; B: weeks 1-3 | Tenant setup (sandbox), data and integration validation | Approved data scope; verified readback of configuration |
| 4 | Training | A: weeks 2-3; B: weeks 3-5 | Admin and champion training, guides, office hours | Trained admins and champions who can recover a flow unaided |
| 5 | Launch | A: weeks 3-4; B: weeks 6-8 | Communications kit, onboarding, help center, monitoring | Cohort invited after a signed launch go |
| 6 | Adoption | A: weeks 4-8; B: weeks 8-24 | Usage dashboard (aggregate), nudges, support triage | Weekly evidence of first win and workflow completion |
| 7 | Midpoint review | A: ~week 5-6; B: week 13 | KPI report, risk plan, executive update | Sponsor decision: continue, correct, pause or stop |
| 8 | Results + conversion | Final 2 weeks | Value report, annual proposal (HELD), roadmap | Signed decision: convert, expand, pause or stop |

## 3. Per-phase detail

Common to every phase: **system of record** is the `gtm_*` tables (single CRM, D-1154 item 6) for stage, pilot, metrics and decision log, plus `docs/evidence/implementation/<tenant-id>/` for workbooks ([`../../institutional-implementation/INTEGRATION-WORKBOOK.md`](../../institutional-implementation/INTEGRATION-WORKBOOK.md)). Support access follows the operating loop in [`../../commercial/SUPPORT-OPERATIONS.md`](../../commercial/SUPPORT-OPERATIONS.md). Owner for every Semester-side step: Harrison Rubin (interim; backup unassigned) unless a customer role is named.

### Phase 1 - Sales handoff [DRAFT]

| Attribute | Content |
| --- | --- |
| Owner | Seller hands to implementation lead (both Harrison Rubin today: **no independent acceptance exists**) |
| Trigger | Opportunity reaches `contracted`; signed paper (HELD today) |
| Inputs | The 12 handoff items in [`STAGE-COLLATERAL-AND-HANDOFF.md`](../../commercial/STAGE-COLLATERAL-AND-HANDOFF.md); deal-desk review; `pilotReadiness` result; claims-register mapping of every sale promise |
| Steps | (1) Seller completes the sales-to-CS checklist (section 6). (2) Implementation lead reviews; refuses on any blank item, any promise outside the claims register, or any `pilotReadiness` problem. (3) Account plan opened. (4) Tenant set to sandbox data mode. |
| Outputs | Accepted handoff packet; account plan; risk register v1; success criteria carried into [`PILOT_SUCCESS_PLAN.md`](PILOT_SUCCESS_PLAN.md) |
| System of record | `gtm_*` opportunity and pilot rows; handoff packet in the evidence folder |
| KPI | Handoff completeness (items filled / 12); promises outside registry (target 0) |
| Risks | Unsupported promise carried over; self-acceptance by one person; scope growth |
| Approvals | Deal-desk `review()` with no refusals; counsel-approved paper [REVIEW: counsel]; implementation lead acceptance |
| Acceptance criteria | Every item filled; `pilotReadiness(plan)` returns an empty array; refused handoff returns to seller and stage stays `contracted` |
| Detail doc | [`STAGE-COLLATERAL-AND-HANDOFF.md`](../../commercial/STAGE-COLLATERAL-AND-HANDOFF.md) |

### Phase 2 - Welcome + kickoff [DRAFT]

| Attribute | Content |
| --- | --- |
| Owner | Implementation lead; customer champion co-owns |
| Trigger | Accepted handoff |
| Inputs | Handoff packet; RACI template (section 5); [`IMPLEMENTATION-PLAN-TEMPLATE.md`](../../commercial/IMPLEMENTATION-PLAN-TEMPLATE.md) |
| Steps | Welcome message (`[PLACEHOLDER]` dates, non-binding) within the window; circulate agenda two working days ahead; kickoff meeting: scope and exclusions, RACI with named backups, no-fit and stop rules, issue/risk/decision/change logs, communication channels; publish shared plan |
| Outputs | Agenda and minutes; signed-off RACI; implementation plan; open decision log (`DecisionLogEntry`) |
| System of record | `gtm_*` decision log; plan in evidence folder |
| KPI | Roles named with backup (of 10 `COMMITTEE_ROLES`); days from signature to kickoff |
| Risks | Unmapped review function (privacy, IT, accessibility); sponsor not present |
| Approvals | Sponsor acceptance of plan; changes to scope/date/data via change log |
| Acceptance criteria | `unmappedRoles()` returns empty or each gap has an owner and date; plan has dependencies and stop rules |
| Detail doc | [`../../commercial/CUSTOMER-ONBOARDING-PLAYBOOK.md`](../../commercial/CUSTOMER-ONBOARDING-PLAYBOOK.md) |

### Phase 3 - Configuration / data [DRAFT] [REVIEW: privacy] [REVIEW: security]

| Attribute | Content |
| --- | --- |
| Owner | Implementation lead; customer technical contact |
| Trigger | Approved data scope and executed data terms |
| Inputs | Data/integration readiness checklist (section 7); [`TENANT-CONFIGURATION-WORKBOOK.md`](../../institutional-implementation/TENANT-CONFIGURATION-WORKBOOK.md); [`INTEGRATION-WORKBOOK.md`](../../institutional-implementation/INTEGRATION-WORKBOOK.md) |
| Steps | Create sandbox tenant; configure roles, expiry, features (disabled by default); load synthetic or approved minimum data only; validate each source (manual or read-only first); freeze baseline; read back configuration from the target |
| Outputs | Configuration export and acceptance; integration workbook rows; frozen baseline |
| System of record | Evidence folder; `pilotDataMode` = `sandbox` until production approval |
| KPI | Checklist items passed; defects open; baseline frozen (yes/no) |
| Risks | Wrong tenant or data; integration not real; forbidden data classes requested |
| Approvals | Customer privacy and security reviewers; data owner; production-data approval (separate, `productionDataApproved`) |
| Acceptance criteria | Section 7 checklist complete with readback evidence; no forbidden class in scope |
| Detail doc | [`../../institutional-implementation/METHODOLOGY.md`](../../institutional-implementation/METHODOLOGY.md) |

### Phase 4 - Training [DRAFT] [REVIEW: accessibility]

| Attribute | Content |
| --- | --- |
| Owner | Enablement (Harrison Rubin interim); champion |
| Trigger | Configuration accepted |
| Inputs | Training workflow (section 8); [`TRAINING-PLAN-AND-ACADEMY.md`](../../institutional-implementation/TRAINING-PLAN-AND-ACADEMY.md) |
| Steps | Admin and champion sessions on synthetic data; scenario completion; operator acceptance record; publish guides; schedule office hours |
| Outputs | Attendance and scenario record; signed operator acceptance; guides |
| System of record | Evidence folder; decision log |
| KPI | Admins/champions completing scenarios / admins/champions named |
| Risks | Operator cannot recover a flow; no trained backup; inaccessible materials |
| Approvals | Operator acceptance by the customer admin |
| Acceptance criteria | Every admin completes the recovery scenarios; materials pass accessibility review |
| Detail doc | [`../../market-readiness/ADMIN-ONBOARDING-GUIDE.md`](../../market-readiness/ADMIN-ONBOARDING-GUIDE.md) |

### Phase 5 - Launch [DRAFT]

| Attribute | Content |
| --- | --- |
| Owner | Implementation lead; sponsor signs |
| Trigger | Training done, support routing live, baseline frozen, UAT passed |
| Inputs | [`PILOT-LAUNCH-CHECKLIST.md`](../../market-readiness/PILOT-LAUNCH-CHECKLIST.md); campus launch kit (section 8); rehearsal records |
| Steps | Launch council review; signed GO or documented delay; only then send approved communications and invitations; monitor daily in launch week |
| Outputs | Signed launch decision; invitations sent; monitoring in place |
| System of record | `gtm_*` stage moves to `live`; evidence folder |
| KPI | Eligible cohort activation (invited is not activated) |
| Risks | P0/P1 open; unstaffed support; unsigned seat; premature invitations |
| Approvals | Launch council GO (`live` gate); sponsor; privacy, accessibility |
| Acceptance criteria | Signed GO exists before any invitation; stop rule rehearsed |
| Detail doc | [`../../PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md) |

### Phase 6 - Adoption [DRAFT]

| Attribute | Content |
| --- | --- |
| Owner | CS (Harrison Rubin interim); champion |
| Trigger | Launch |
| Inputs | Weekly aggregate scorecard; support queue; health review ([`CUSTOMER_HEALTH_SCORE.md`](CUSTOMER_HEALTH_SCORE.md)) |
| Steps | Weekly aggregate report; opt-in, respectful nudges through approved channels only; triage support by severity; log decisions and changes |
| Outputs | Weekly report; action log |
| System of record | `gtm_pilot_metrics`; support system (not yet staffed) |
| KPI | First meaningful action, workflow completion, weekly active use (definitions in [`PILOT_SUCCESS_PLAN.md`](PILOT_SUCCESS_PLAN.md)) |
| Risks | Vanity metrics mistaken for proof; cells under 10 exposed; nudges becoming surveillance |
| Approvals | Privacy threshold approved (proposal: at least 10) |
| Acceptance criteria | Every weekly report has denominators, data-quality note and one named action per amber/red item |
| Detail doc | [`../../institutional-implementation/SUCCESS-SYSTEM.md`](../../institutional-implementation/SUCCESS-SYSTEM.md) |

### Phase 7 - Midpoint review [DRAFT]

| Attribute | Content |
| --- | --- |
| Owner | CS; executive sponsor decides |
| Trigger | `midpointReviewDate` (required by `pilotReadiness`) |
| Inputs | KPI report vs frozen baseline; risk register; support and incident summary |
| Steps | Present observed trajectory with caveats; review risks; sponsor chooses continue, correct, pause or stop; executive update written |
| Outputs | KPI report, risk plan, executive update, signed midpoint record |
| System of record | `gtm_*` decision log |
| KPI | Midpoint metrics vs target (labelled observed or estimated) |
| Risks | Weak evidence mistaken for success; no expansion claim allowed |
| Approvals | Sponsor signature |
| Acceptance criteria | A recorded decision from the four options |
| Detail doc | [`../../institutional-implementation/EXECUTIVE-BUSINESS-REVIEW.md`](../../institutional-implementation/EXECUTIVE-BUSINESS-REVIEW.md) |

### Phase 8 - Results + conversion [DRAFT] [REVIEW: counsel]

| Attribute | Content |
| --- | --- |
| Owner | Founder; sponsor signs |
| Trigger | Final two weeks of the pilot |
| Inputs | Outcome measurement; support/accessibility summary; cost to serve; limitations |
| Steps | Value report; decision meeting; `pilotVerdict` signed; annual proposal **prepared but HELD** until the paid-pilot gate flips; roadmap review; or offboarding |
| Outputs | Value report, annual proposal draft, roadmap, signed decision |
| System of record | `gtm_pilot_outcomes`; stage `renewal` only after a final verdict |
| KPI | Pilot-complete rule satisfied (see [`PILOT_SUCCESS_PLAN.md`](PILOT_SUCCESS_PLAN.md)) |
| Risks | Unsigned verdict; open high-severity issue blocks convert/expand |
| Approvals | Deal desk `review()`; counsel; sponsor |
| Acceptance criteria | `pilotVerdict(...).final === true` |
| Detail doc | [`../../PILOT-TO-ANNUAL-CONVERSION.md`](../../PILOT-TO-ANNUAL-CONVERSION.md); [`RENEWAL_AND_EXPANSION_PLAYBOOK.md`](RENEWAL_AND_EXPANSION_PLAYBOOK.md) |

## 4. Weekly rhythm [DRAFT]

Weekly aggregate review (CS and champion, 30 minutes); monthly working session; midpoint executive review; final value review. Cadence detail: [`PILOT_SUCCESS_PLAN.md`](PILOT_SUCCESS_PLAN.md) and [`../../institutional-implementation/SUCCESS-SYSTEM.md`](../../institutional-implementation/SUCCESS-SYSTEM.md).

## 5. Customer RACI template [DRAFT]

R = does the work, A = accountable (one per row), C = consulted, I = informed. Roles from `COMMITTEE_ROLES` [VERIFIED: `app/src/lib/gtm/pilot.ts`]. Semester names: Harrison Rubin (interim) holds every Semester seat; security owner, privacy owner, counsel unassigned. Customer names are `[PLACEHOLDER]`.

| Work item | Exec sponsor | Operational owner / champion | CIO / IT | CISO / privacy | Accessibility | Registrar / data governance | Procurement / legal | Semester implementation lead | Semester CS | Semester support |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Scope, exclusions, change control | A | R | C | C | I | C | C | R | C | I |
| Data scope and consent | I | C | C | A | I | R | C | R | I | I |
| Tenant, roles, SSO or manual roster | I | C | A | C | I | C | I | R | I | I |
| Integration validation (read-only first) | I | I | A | C | I | R | I | R | I | I |
| Accessibility UAT | I | C | C | I | A | I | I | R | C | I |
| Training delivery | I | A | C | I | C | I | I | R | R | C |
| Launch decision | A | R | C | C | C | C | I | R | R | C |
| Student communications | C | A | I | C | C | I | I | C | R | I |
| Support routing and escalation | I | C | C | C | C | I | I | C | C | A |
| Weekly metrics and review | I | A | I | C | I | C | I | C | R | C |
| Midpoint and final decision | A | R | C | C | C | C | C | C | R | I |
| Offboarding and data disposition | A | R | R | A | I | R | C | R | R | C |

Row rule: where two A's appear (data and offboarding), they mean joint acceptance by customer and vendor, as in the existing RACI ([`../../market-readiness/PILOT-IMPLEMENTATION-PLAYBOOK.md`](../../market-readiness/PILOT-IMPLEMENTATION-PLAYBOOK.md)). Each named person needs a named backup; "unassigned" is a launch blocker for A rows.

## 6. Sales-to-CS handoff checklist [DRAFT]

The 12 items in [`../../commercial/STAGE-COLLATERAL-AND-HANDOFF.md`](../../commercial/STAGE-COLLATERAL-AND-HANDOFF.md) are the controlling list. This adds CS-specific confirmation (delta only):

| # | Item | Done |
| --- | --- | --- |
| 1 | All 12 existing handoff items filled; none blank | [ ] |
| 2 | Account plan: objectives in the champion's words, success criteria (3-5 measures), owner per measure | [ ] |
| 3 | Risk register v1: top five risks, each with owner, trigger, response | [ ] |
| 4 | Gate statement copied into the plan: what is live now, what is HELD | [ ] |
| 5 | List of promises made in the sale, each mapped to a CLM id or flagged outside the register | [ ] |
| 6 | Support route and hours the customer was told; reconciled with the staffed-support position (section 9) | [ ] |
| 7 | Customer contacts for the 10 committee roles, each with backup | [ ] |
| 8 | Reference and publicity status: none unless a signed permission exists (CLM-013) | [ ] |
| 9 | Pricing status: price agreed in the signed order only; no price in any customer message until approved (CLM-015) | [ ] |
| 10 | Decision dates: midpoint, conversion, offboarding (all inside `pilotReadiness` bounds) | [ ] |

## 7. Data and integration readiness checklist (manual / read-only first) [DRAFT] [REVIEW: privacy] [REVIEW: security]

Principle from the repository: manual or read-only unless an adapter is installed; sandbox data until production approval (`pilotDataMode`). No institutional provider (SIS, LMS, SSO, SCIM, LTI) is evidenced as live. [VERIFIED: `../../institutional-implementation/INTEGRATION-WORKBOOK.md` status line; `../../../GO-NO-GO-DECISION.md`]

| # | Check | Evidence required | Pass |
| --- | --- | --- | --- |
| 1 | Data plan flags: minimum necessary, read-only first, source labelled (the three `dataPlan` booleans) | Signed data plan | [ ] |
| 2 | No forbidden class in scope: grades, GPA, rosters, enrollments, financial aid, health, disability, counseling, conduct, immigration, private messages, submissions, accommodations, location | Reviewer sign-off | [ ] |
| 3 | Start path chosen: manual entry or file upload by the student or admin, before any connector | Plan row | [ ] |
| 4 | Each source named with owner, refresh method, "official record is the institution's" label | Integration workbook | [ ] |
| 5 | Sandbox tenant created; tenant identity read back from the target | Screenshot or export | [ ] |
| 6 | Roles, capabilities and expiry set; features default off; disabled features listed | Config export | [ ] |
| 7 | Synthetic data run: invite, aggregate review, audit lookup, degraded mode | Run record | [ ] |
| 8 | Read-only integration (if any) validated against a sample; mismatches logged | Sample QA | [ ] |
| 9 | Rights path tested: export, deletion, revocation, offboarding rehearsal | Dated record | [ ] |
| 10 | Restore or rollback exercise on the authorized target (GO-NO-GO priority 7: not yet done) | Dated record | [ ] |
| 11 | Production data approved in writing, separately from the plan | Approval | [ ] |
| 12 | Cohort size within 10-200 and reporting threshold agreed (proposal: at least 10) | Plan | [ ] |

## 8. Training, launch kit and student onboarding [DRAFT]

**Admin and user training workflow.**

| Step | Audience | Content | Evidence of completion |
| --- | --- | --- | --- |
| 1 | Customer admins | Role, privacy, security, accessibility, support, incident training ([`ADMIN-ONBOARDING-GUIDE.md`](../../market-readiness/ADMIN-ONBOARDING-GUIDE.md)) | Attendance |
| 2 | Admins | Practise invitation, aggregate review, audit lookup, escalation, read-only mode, rollback request, export/deletion, offboarding on synthetic data ([`PILOT-ADMIN-RUNBOOK.md`](../../market-readiness/PILOT-ADMIN-RUNBOOK.md)) | Scenario record |
| 3 | Admins | Sign operator acceptance record; no production access before it | Signed record |
| 4 | Champions | Cohort communications, office-hours host guide | Attendance |
| 5 | Students | 10-minute "plan your first week" session, manual setup ([`../../pilot/FIRST-DAY-CHECKLIST.md`](../../pilot/FIRST-DAY-CHECKLIST.md), [`../../pilot/QUICK-START.md`](../../pilot/QUICK-START.md)) | First-win event (sampled) |
| 6 | Faculty / advisers | Referral copy and known limits ([`../../FACULTY-ENABLEMENT.md`](../../FACULTY-ENABLEMENT.md)) | Distribution record |

**Campus launch kit pointer.** [`../../market-readiness/CAMPUS-LAUNCH-KIT.md`](../../market-readiness/CAMPUS-LAUNCH-KIT.md) lists the kit (approved description, synthetic screenshots, QR with campaign source, quick-start, accessibility and privacy summary, official-record disclaimer, support contacts, known limitations, withdrawal/export/delete paths). Staff never ask students to display grades, schedules or sensitive information. Student first win: [`../../commercial/STUDENT-ONBOARDING-PLAYBOOK.md`](../../commercial/STUDENT-ONBOARDING-PLAYBOOK.md). Change management and enablement: [`../../INSTITUTIONAL-CHANGE-MANAGEMENT.md`](../../INSTITUTIONAL-CHANGE-MANAGEMENT.md). Kit wording that makes a claim needs a register row first.

## 9. Support workflow and severity model [DRAFT]

**Staffed support is NOT evidenced.** GO-NO-GO priority 6 ("staffed support, monitoring and incident coverage": queues, hours, routing, rota, acknowledgement and escalation drills) is open; no channel, hours, trained backup or measured response exists. [VERIFIED: `../../../GO-NO-GO-DECISION.md` priority 6; `../../commercial/SUPPORT-OPERATIONS.md` Evidence state] This document invents no staffing, hours or response times.

Workflow: follow the 7-step operating loop in [`../../commercial/SUPPORT-OPERATIONS.md`](../../commercial/SUPPORT-OPERATIONS.md). Severity: the canonical P0-P3 matrix and harm modifiers in section 1.5 of [`../../SUPPORT-AND-TRUST-SAFETY-OPERATING-MODEL.md`](../../SUPPORT-AND-TRUST-SAFETY-OPERATING-MODEL.md); these are internal classifications, not promised clocks. Hypercare: [`../../institutional-implementation/HYPERCARE-AND-HANDOFF.md`](../../institutional-implementation/HYPERCARE-AND-HANDOFF.md). Incident path: [`../../trust/INCIDENT-RESPONSE-PLAN.md`](../../trust/INCIDENT-RESPONSE-PLAN.md). Pilot runbook: [`../../market-readiness/PILOT-SUPPORT-RUNBOOK.md`](../../market-readiness/PILOT-SUPPORT-RUNBOOK.md).

Pilot overlay (delta): a P0 or P1 pauses the affected scope and blocks convert/expand (`pilotVerdict`); weekly support report is aggregate with cells under 10 suppressed; any support promise made to a customer must match published, tested hours or be removed from the plan.

## Evidence state

**Repository evidence.** [VERIFIED] `pilot.ts`, `stages.ts`, handoff checklist, onboarding and implementation playbooks and workbooks exist as documents and code.
**Operational evidence.** None: no customer, pilot, kickoff, configuration, training session, launch or support case has occurred; no onboarding duration baseline exists.
**Missing proof.** A tabletop dry run on synthetic data; a staffed support route; restore/rollback and offboarding exercises; a founder decision on pilot length.

## Claim ceiling

Semester may describe a proposed onboarding sequence and plan dates jointly with a prospect, subject to gates and dependencies.

## Prohibited claims

Do not promise a launch date, a 4-week, 8-week or 60-day onboarding, completed integrations, staffed or 24/7 support, customer readiness or repeatable timing. No customers, pilots, logos or measured outcomes exist.

## Professional review required

[REVIEW: counsel] paper and data terms; [REVIEW: privacy] data scope, thresholds, consent; [REVIEW: security] tenant isolation and rollback; [REVIEW: accessibility] training and launch materials; [REVIEW: procurement] customer purchasing path.
