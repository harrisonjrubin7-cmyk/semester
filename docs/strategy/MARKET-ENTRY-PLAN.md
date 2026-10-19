# Market-entry plan

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

| Control | Value |
| --- | --- |
| Status | **DRAFT PROPOSAL — not a public claim, not an approved campaign, not legal advice** |
| Owner | `founder` seat; claims go through the claims register approvers |
| Evidence date | 2026-10-04, against `origin/main` at `7287ddc` |
| Governing constraints | [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md), [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md), [`DECISIONS.md`](../../DECISIONS.md) §1, [`docs/commercial/IDEAL-CUSTOMER-PROFILE.md`](../commercial/IDEAL-CUSTOMER-PROFILE.md). Where this plan and any of them conflict, the more conservative one controls |

## 1. The principle

**Full platform ambition, staged claims.** Semester is built to be a student operating system, campus super-app, institutional system, AI assistant, family portal, marketplace and lifelong platform, and none of that is removed from the requirements. What this plan disciplines is the *outward* surface: what may be said, sold and switched on, and when. The test applied to every sentence aimed at a buyer is:

> *Could we put the evidence for this sentence on the table in the same meeting?*

If not, the sentence is not used. This is slower than the bold claim and faster than the lawsuit, the lost reference, or the procurement team that finds the gap.

## 2. The claim ladder

Five levels, mapped to the four motions the go/no-go decision already defines. A level is entered only when its row's evidence exists, dated and bound to the version shown.

| Level | Motion (go/no-go) | State today | Entry evidence | May say | May not say | Approvers |
| --- | --- | --- | --- | --- | --- | --- |
| **C0** | Internal | Open | None | Anything, internally | Anything externally | |
| **C1** | Design-partner discovery, synthetic demos, evidence exchange | **GREEN** | Synthetic or approved non-production data only; claims library locked; no customer status implied | Verified repository capabilities (for example CLM-001, CLM-002 with their qualifiers); that Semester is a pilot-stage product with named limitations | Customer names, outcomes, "live", "secure", "compliant", "certified", "replaces", any price | Claims register approvers |
| **C2** | Invitation-only unpaid individual validation | **YELLOW**, conditional | G1 evidence: exact-SHA gates, counsel-approved terms and policy posture, qualified accessibility review commissioned, validation support, stop criteria | C1, plus "invitation-only validation" with the disclosed boundary | Broad availability, paid features, outcomes | + `privacy`, `accessibility` |
| **C3** | Paid institutional pilot (manual data, then connected) | **RED** | G3 evidence (see [`BOARD-MEMO.md`](BOARD-MEMO.md) §5) | "A pilot for [named scope]" on counsel-approved paper; measured results with denominators and the customer's written permission | Scale, SLA beyond the contract, system-of-record status | + `finance`, counsel, customer authority |
| **C4** | Broad institutional enterprise sale | **RED** | G4 evidence | Only what repeated deployments evidence | GA or enterprise positioning outside that evidence | Separate broad-sale decision |

## 3. Unsafe claim to safe alternative

These are the sentences that will be tempting in a sales room. Each row is a standing instruction.

| Tempting claim | Why it is unsafe | Say this instead | Until |
| --- | --- | --- | --- |
| "Semester replaces your LMS, SIS and registrar" | A record-system replacement claim is a commercial and operational claim needing parallel run, rollback, counsel and customer acceptance | "Semester works alongside your systems: it reads from them where you approve, and provides a native experience where you have none. Replacing any system of record is a separate, jointly evidenced program." | The ladder in §4 allows it for a named domain |
| "Works at any university" | Prohibited by `DECISIONS.md` §1 until the Stage 4 gate | "Semester is built in depth at one university first. The self-serve features work for any student; the campus half is one institution at a time." | The decision is reopened on its conditions |
| "Enterprise-grade", "production-ready", "bank-level security" | No independent security assessment, operated recovery or staffed support exists (FR-003, FR-005, FR-006) | "Pilot-stage. Here is the evidence list, the known-limitations list, and what is still open." | The matching gate passes |
| "FERPA-compliant", "ADA-compliant", "WCAG-compliant", "SOC 2" | A compliance conclusion needs qualified counsel or an assessor; certifications must exist to be named | "Designed against WCAG 2.2 AA with automated checks on every change; the status of the qualified review is [X]." Never "compliant" without the approved statement | Counsel approves; the report exists |
| "Improves GPA / retention / outcomes" | Causal outcome claims need controlled evidence and permission | "We measure cohort-level planning actions against your own baseline and report with denominators. We make no causal claim." | Closeout data plus claim-specific permission |
| "AI that knows your courses and advises you" | Overstates a system that must show sources, say when it does not know, and route consequential actions to a human | "AI that answers from sources it shows you, says when it does not know, and never takes a consequential action without your confirmation." | Always |
| "Early warning", "at-risk prediction", "student risk scores" | The product does not score individuals; such framing would also contradict the privacy model | "Cohort-level readiness and workload signals; no individual risk scoring." | Never, as stated |
| "Used by [institution]" or any logo | Customer status needs the customer's claim-specific written permission | Nothing | Written permission for that exact claim |
| "Live integration with Brightspace / Canvas" | The institutional integration needs a signed agreement and an operated adapter; the Canvas path is a student-side token sync | "A student can bring their own Canvas courses with a token they control. An institutional Brightspace integration is planned with an agreement, and is not live." | The agreement and adapter exist |
| "Best", "only", "first", "most", "free forever", "unlimited" | Superlatives need dated, equivalent-scope comparative evidence | Describe the workflow and its boundary | A dated method exists (A-17) |
| "Family members can see how you're doing" | Guardian visibility without consent contradicts the model | "Students decide what a family member can see, and can change it at any time." | The family module is activated with its consent controls |

## 3a. Package labels are claims

The pricing architecture ([`PRICING-UNIT-ECONOMICS-ARCHITECTURE.md`](../commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md) §3.2) proposes three institutional packages, **Start**, **Operate** and **Replace**, mirroring the operating modes, and says the Replace package may be quoted before replacement is earned while its claims are not. A buyer reads the label as the claim. So:

| Rule | Why |
| --- | --- |
| Internal names and SKUs (`native_lms`, `university_os`, `semester_access`) may stay as they are | They are identifiers, not statements |
| **A buyer-facing label, quote line or proposal heading may not say "Replace" or "replacement", or name a record system as replaced,** until the replacement ladder's R4 evidence exists for that named domain at that institution | The label is the claim; the claims register governs it |
| Before R4, the same scope is described by what it does at its rung, for example "native modules for named domains, alongside your system of record" (R1 to R3) | Keeps the quote honest and the thesis intact |
| Mapping: Start to R1 and R2 in Coexistence; Operate to R0 plus R2 in Connected mode; Replace to R4 only | So a package name can be checked against a rung |

This is part of FD-2026-011. It changes no price and no SKU.

## 4. The replacement ladder

How the thesis ("replace fragmented systems") is reached without ever claiming ahead of the evidence. A rung is a property of **one named domain at one named institution**, never of the product in general.

| Rung | What Semester is | Example | Evidence to enter | Allowed words | Approvers |
| --- | --- | --- | --- | --- | --- |
| **R0** | A reader and presenter beside the authoritative system | Showing LMS deadlines with source and freshness | Connector health, provenance labels, degraded-mode UX | "connects to", "shows alongside" | `product`, `privacy` |
| **R1** | The native home for personal, non-record work | Planner, notes, documents, study, calendar | Core-live criteria: ownership, authorization, audit, persistence, accessibility, recovery | "native workspace" | `product`, `privacy` |
| **R2** | A native system of engagement | Announcements, directory, events, help desk intake | Moderation operations, retention, SLOs, accessibility review | "can serve as [named channel]" with the institution's approval | + `accessibility`, `trust` |
| **R3** | A native workflow with record-of-intent, the authoritative system unchanged | Registration planning, advisor notes, approval queues that show pending and confirmed | Idempotent commands, reconciliation reports, no false confirmation, rollback | "prepares and tracks; the official record changes only when your system confirms" | + `data`, `engineering`, the customer's registrar |
| **R4** | The system of record for one named domain | A single workflow cut over from a legacy tool | Parallel run, data verification, operational acceptance, rollback drill, contractual approval, security and legal review, the customer's governance sign-off | "replaces [named domain]" for that scope only | Launch council, counsel, customer governance |
| **R5** | Whole-stack replacement | | R4 in every domain | Not used | Not planned inside the horizon |

**Operating rule:** the pending, confirmed, failed, degraded and reconciled states are visible at every rung. A confirmation is shown only when the authoritative system or Semester's own committed write has confirmed it.

## 5. Entry sequence

The first institution is Vanderbilt, by standing decision. The sequence orders the dependencies the repository itself identifies.

| Step | Action | Owner seat | Date | Evidence | Why this order |
| --- | --- | --- | --- | --- | --- |
| V0 | Follow up on the ownership-determination request if no written reply has arrived | `founder` | 2026-10-18 | Written reply on file | `IP.md`: a determination first, university money second |
| V1 | Record the standing rule: no university-administered prize, stipend, grant or program participation agreement is accepted before the determination, and any pending award is disclosed to the technology-transfer office first | `founder` | 2026-10-11 | Decision record (FD-2026-003) | The one exposure that can still be made worse |
| V2 | Ask the university and counsel, in writing, how conflict-of-interest and vendor rules apply to a student founder selling to the institution where they are enrolled | `founder`, `privacy` | 2026-11-30 | Written answer. **COUNSEL** | A conflict handled late can void a deal and damage a reference |
| V3 | Map stakeholders named in the standing decision: the entrepreneurship center, central IT, technology transfer, the academic-integrity office, the registrar, plus the sponsors of candidate units (first-year, transfer, honors/learning community, advising) | `founder` | 2026-12-31 | Stakeholder map with decision roles | Names the champion and sponsor seats the council needs |
| V4 | Evidence exchange on synthetic data: HECVAT-style answers, security, privacy and accessibility packages, known-limitations list | `security`, `privacy` | 2027-02-28 | Packages delivered and logged | Shortens the first review and begins the cycle-time reading |
| V5 | Written scoping of the data-agreement conversation with central IT and legal | `founder` | **2027-03-31 (tripwire)** | Written scope or a written no | If missing for two consecutive terms, the standing decision reopens |
| V6 | Student-side validation (G1): invitation-only, unpaid, the self-serve features only | `product` | From 2027-03-31 | Cohort onboarded; retention readings | Generates B1 evidence without needing anyone's permission for the student-side path |
| V7 | Design-partner charter with one unit: 26 weeks, 50 to 200 students, manual or read-only data, 3 to 5 measures each with a baseline, a stop option, a decision date | `founder`, `champion` | 2027-06-30 | Executed charter | The smallest unit that can say yes and test every risk |
| V8 | Activation after the launch council verdict (G2) | `founder` | 2027-07-31 | Computed verdict | |
| V9 | Brightspace read adapter through the two-phase confirm and audit-journal path, only after an agreement | `data` | After V5 and G2 | Agreement, adapter, reconciliation | `DECISIONS.md` §1: Brightspace is the first adapter, not a second one |

**Tripwires on the entry sequence.** V5 unmet by 2027-03-31 triggers the reopening review on 2027-05-31, which weighs: a written no, silence across two terms, an invitation from a second institution, or self-serve demand for the campus half. The review produces a decision record, not an argument.

## 6. Discovery and qualification

Discovery is the cheapest evidence in the plan and the first dated deliverable.

| Item | Specification |
| --- | --- |
| Target | 25 qualified conversations and 8 scored qualification scorecards by 2027-03-31; 50 and 15 by 2027-09-30 (scorecard I1, I2) |
| Composition | At least 10 inside Vanderbilt (unit sponsors, advisors, faculty, central IT, the registrar's office, disability services). The remainder are **practitioner interviews** (advisors, registrars, student-success and IT leads at other institutions, reached through associations and warm introductions). They are learning conversations, not sales calls, and they carry no engineering commitment, consistent with the depth-first decision |
| What a qualified conversation is | A structured interview with someone who holds or influences a relevant decision, logged with the fields below |
| Log fields | Date; role and institution type; problem named in their words; current tools; decision path; data and integration constraints; accessibility and privacy contacts; timing against their budget and term calendar; objections; evidence they asked for; whether the conversation changed any hypothesis |
| Qualification criteria (0 to 2 each) | Problem urgency; empowered sponsor; operational champion; bounded cohort of 50 to 200; tolerance for manual or read-only scope; named IT, privacy and accessibility contacts; decision date; appetite for evidence-building over certification |
| Disqualifiers | From the ideal-customer profile: immediate SIS/LMS replacement, official writeback, authoritative degree audit, institution-wide first launch, unsupported certifications or SLAs, 24/7 support, causal outcome guarantees, individual risk scoring, or health, disability, conduct, counseling, immigration, aid or discipline data |
| Learning output | Monthly one-page read-out: which hypotheses moved (B1 to B5), what evidence buyers asked for, objections by frequency. Win/loss discipline starts with the first lost opportunity |

## 7. Research the strategy still needs

The repository has no approved market size and no dated competitor matrix. Both are commissioned rather than asserted.

**Market-sizing protocol (due 2027-01-31, `finance` advisor with `founder`).**
1. Define the serviceable segment in writing: four-year private and regional institutions of stated size bands, in the United States.
2. Count institutions and enrollments from the national postsecondary data system and the institutional associations, citing source and extraction date for every figure.
3. Estimate addressable units per institution bottom-up (first-year, transfer, honors, advising, college offices) from the discovery log, not from assumption.
4. Multiply by illustrative contract values from willingness-to-pay discovery (§9), never from the placeholders in A-08.
5. Cross-check top-down; record the gap between the two and the reason.
6. Output: a dated workbook with every input cited. **Until it exists, no market-size statement is made, internally or externally.**

**Competitor research protocol (due 2027-01-31, `product` with the higher-education administration advisor).** Primary sources only, dated and cited; comparisons of workflow and boundary, never feature counts; legal review before any external comparative statement (A-17). Categories to cover, with the structural questions that matter (all **HYPOTHESES** until researched):

| Category | Natural strength | Possible structural limit | Stance |
| --- | --- | --- | --- |
| Learning-management vendors | Own the course experience and faculty workflow | Not neutral across rival systems; student-side planning is secondary | Complement; connect (R0) |
| Student-information and ERP vendors | Own the record | Slow-moving student experience; configuration-heavy | Complement; never claim replacement ahead of the ladder |
| Student-success and advising platforms | Own advisor workflows and risk analytics | Institution-facing; individual risk-scoring posture differs from ours | Complement or compete at the advising edge, on governance |
| Campus-experience and app platforms | Own the campus front door | Typically thin on learning and planning depth | Compete selectively; partner where useful |
| General AI assistants and institution-licensed AI | Model quality and distribution | No native institutional context, consent graph or audit unless added | **The main threat to the planning wedge** (SR-003); compete on governed context and action, not model quality |
| Student productivity and notes tools | Student habit and polish | No institutional governance, sources or accessibility commitments | Compete on source-attributed planning |
| Career platforms | Employer networks | Separate identity and journey | Interoperate; later |

## 8. Pilot design and the calendar that decides revenue

Higher education buys on a fiscal and academic calendar (A-04, A-05). A pilot that misses the budget window slips revenue by a year.

| Phase | Weeks | Fall 2027 cohort, as an example (dates subject to the institution's calendar) |
| --- | --- | --- |
| Baseline measurement | -4 to 0 | 2027-08-16 to 2027-09-13 |
| Go-live and hypercare | 1 to 2 | Week of 2027-09-13 |
| Midpoint report | About 13 | About 2027-12-13 (ahead of winter break and finals) |
| Annual proposal | About 17 | 2028-01-15 |
| Closeout and signed verdict | 26 | About 2028-03-13; decision by 2028-03-31 |
| Budget decision window | | Spring 2028 |
| Annual agreement effective | | 2028-07-01 (fiscal-year start) |

The pilot rules are fixed by decisions already on `main`: 26 weeks (D-134), 50 to 200 students, minimum cell size 10, sandbox data until production data is approved, no final verdict until signed, no conversion while a high-severity issue is open, and "stop" is always an available decision ([`PAID-PILOT-FRAMEWORK.md`](../PAID-PILOT-FRAMEWORK.md)).

## 9. Pricing and packaging posture

No price book exists and none is proposed here. The plan sets **how the price will be found** and **what may be quoted when**.

| Question | Method | Due | Decision |
| --- | --- | --- | --- |
| What would a sponsor pay, and for what unit? | At least 10 structured willingness-to-pay conversations, recorded against cohort, term, support and offboarding scope | 2027-04-30 | FD-2026-007 |
| Cohort 1 fee posture | Options: design-partner activation without a fee; scoping or implementation fee; full paid pilot. A paid pilot is RED until G3, so the recommended default is a **no-fee design-partner activation** with a signed conversion intent, if finance and counsel agree | 2027-06-30 | FD-2026-007 |
| When may a number be quoted | Only from an approved price book, with floors, discount authority, tax and payment controls, refund and renewal terms | Before G3, 2028-03-31 | Deal desk |

Pricing is a lever for the value Semester can evidence, never a substitute for it. No savings, ROI or affordability claim is made without evidence and authority ([`PRICING-AND-PACKAGING.md`](../commercial/PRICING-AND-PACKAGING.md)).

## 10. What the buyer receives, by gate

The trust room is built once and shown in stages, so the buyer sees what exists and what does not.

| By | Contents | Source in the repository |
| --- | --- | --- |
| G1 (2027-03-31) | Architecture overview; security, privacy and accessibility packages; HECVAT-style response draft; subprocessor list; known-limitations list; data-flow map | [`docs/institutional-readiness/`](../institutional-readiness/), [`docs/market-readiness/`](../market-readiness/), [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md) |
| G2 (2027-07-31) | Independent penetration-test summary; accessibility report and approved statement; restore and incident drill records; data-processing terms approved by counsel; support model and escalation path; implementation plan; offboarding and portability plan | Operated artifacts, indexed in [`EVIDENCE-REGISTER.md`](../../EVIDENCE-REGISTER.md) |
| G3 (2028-03-31) | First closeout report with denominators; price book; paper approved by counsel; insurance certificate; customer-permissioned references | |
| G4 (2029-06-30) | Independent assurance report; capacity and recovery evidence across deployments; implementation method v2 | |

**Rule:** the room contains only artifacts that exist and are in date. An expired artifact is removed, not left in place.

## 11. Channels and partners

Sequenced by evidence, not enthusiasm. None is activated before its entry condition. [`docs/commercial/PARTNER-AND-CHANNEL-STRATEGY.md`](../commercial/PARTNER-AND-CHANNEL-STRATEGY.md) already governs this area (*no approved partner, reseller or channel operation*; a conversation, listing, referral, event or logo is not a partnership); where it is stricter than the table below, it controls.

| Channel | Role | Entry condition | Earliest |
| --- | --- | --- | --- |
| Direct (founder-led) | The only channel for the first three agreements | G0 | Now |
| Practitioner associations and conferences | Learning and warm introductions, not lead generation | G0 | 2027 |
| Interoperability standards bodies and certification programs (for example LTI and OneRoster conformance) | Credibility with IT; reduces integration friction | The matching adapter exists | 2028 |
| Consortia and group purchasing | Procurement shortcut for peers | Three live deployments and a reference | 2029 |
| Implementation or consulting partners | Capacity for rollouts | Playbook v2 proves repeatable | 2029 |
| Reseller or marketplace channels | | Not planned inside the horizon | |

Campaign tooling and sponsorship stay behind their flags (`module.campaign_manager`, `module.sponsorship`); no student contact, SMS, email campaign or advertising runs outside the consent, targeting and review rules in [`docs/gtm/EXECUTION-PLAN.md`](../gtm/EXECUTION-PLAN.md).

## 12. Entry risks

| Risk | Entry tripwire | Response | Register |
| --- | --- | --- | --- |
| Vanderbilt says no or is silent | V5 unmet at 2027-03-31 | Reopening review 2027-05-31 | SR-032 |
| An overclaim reaches a buyer | A claim outside the register | Withdraw within 24 hours; log; root cause | SR-017, SR-027 |
| Conflict-of-interest handled late | V2 unanswered at 2026-11-30 | Pause procurement-adjacent conversations until answered | SR-007 |
| The IP determination is adverse or conditional | Reply received | Branch plan with counsel before any further engagement | SR-013, SR-016 |
| The wedge is not valued | S4 or S3 under line | B1 falsifier review | SR-002 |
| Pilot fails for lack of baseline or participation | Baseline not agreed by week -4 | Do not activate; reschedule to the next term | SR-029, SR-015 |
