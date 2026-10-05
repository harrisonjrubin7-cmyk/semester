# Required advisors

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

| Control | Value |
| --- | --- |
| Status | **DRAFT PROPOSAL. No advisor is engaged; no seat below is filled until the person accepts it in writing** |
| Owner | `founder` seat |
| Evidence date | 2026-10-04, against `origin/main` at `7287ddc` |
| Why now | Five of twelve launch-council seats are vacant (`security`, `trust`, `data`, `finance`, `champion`). The founder holds or acts in six of seven held seats. Outside counsel holds the `privacy` seat; no other seat is staffed by an outside professional. Most assumptions in this package (A-03, A-04, A-06 to A-10, A-17, A-18) can only be closed by someone who has done the job. See [`LAUNCH-READINESS-COUNCIL.md`](../LAUNCH-READINESS-COUNCIL.md) |
| Target | All nine named advisor roles engaged by **2026-12-31** (strategy milestone 1.3); wave 1 by 2026-11-30 |

**What an advisor is.** A person who answers specific questions, reviews specific artifacts and challenges specific assumptions. An advisor **advises**. Advisors hold no decision right that belongs to counsel, an independent assessor, the launch council's computed verdict or the founder. A non-lawyer never delivers a legal conclusion; where law is involved the work goes to qualified counsel (**COUNSEL**), through [`../../LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md) and [`../COUNSEL-BRIEF.md`](../COUNSEL-BRIEF.md).

## 1. The advisors at a glance

Budgets are ASSUMPTIONS (A-06) to be replaced by quotes; they are cash honoraria and expenses only. Equity for an advisor is a separate **COUNSEL** matter and is not assumed.

| # | Role | Gap it closes | First concrete ask | By | Wave | Form |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | **Higher-education administration** (a former CIO, provost, vice president of student affairs or dean at a private or regional institution) | Buying path, calendar and first-unit choice; validates A-03, A-04, A-05 | Validated map of who signs a first pilot and the real calendar to a signed term | 2027-01-15 | 1 | Monthly office hour; quarterly review |
| 2 | **Registrar** (an experienced registrar or associate registrar, **not** at the first design-partner institution) | Record-system boundary; the registrar acceptance test; validates replacement rungs R3 and R4 | A registrar-acceptance checklist and a review of the replacement ladder | 2027-01-31 | 2 | Office hour; two document reviews |
| 3 | **Accessibility** (a certified accessibility professional with higher-education disability-services experience, and lived-experience testers) | Test plan, scope of the qualified review, approved statement wording; seat `accessibility` is held by the founder acting | An assistive-technology test plan and the scope for the independent audit | 2027-01-31 | 2 | Monthly; plus paid tester panel |
| 4 | **Privacy** (an education-privacy specialist; paired with privacy counsel for legal conclusions) | Data scope, retention, sub-processors, data-protection terms, minors posture (SR-018, SR-019) | A privacy-scoping memo for counsel and a data-scope rule for pilots | 2027-03-31 | 2 | Monthly; works with the engaged counsel |
| 5 | **Security** (a virtual CISO with higher-education and HECVAT experience) | Seat `security` is **vacant**; threat model, assessor selection, HECVAT, assurance path | A security plan; the first review of the independent-assessment scope | 2026-12-31 | 1 | Monthly retainer; accepts the seat in writing |
| 6 | **Procurement** (a university purchasing or vendor-risk professional, or an edtech sales leader experienced in selling to universities) | What paper, insurance and security packet a procurement office requires; sole-source thresholds; pilot exceptions | A review of the trust room and the first charter against real procurement practice | 2027-02-28 | 2 | Quarterly review; ad hoc |
| 7 | **Finance** (a fractional CFO with SaaS or edtech experience) | Seat `finance` is **vacant**; price-book method, bottom-up budget, runway, fundraising readiness | A bottom-up budget replacing A-06 to A-10; a price-book method | 2027-01-15 | 1 | Fractional retainer; accepts the seat in writing |
| 8 | **AI safety** (applied AI safety and evaluation, ideally with an education setting) | Thresholds for the AI evaluations; red-team scope; tiers and human oversight; academic-integrity design (SR-025, SR-020) | The sourced-fact accuracy threshold (S9) and the first red-team plan | 2027-01-31 | 2 | Quarterly review; red-team engagement |
| 9 | **Student experience** (a student-affairs, advising or learning-design leader, plus a compensated panel of 3 to 5 students) | Whether the planning layer helps and is not manipulative; onboarding; equity; seat `trust` is **vacant** | Design of the Month 2 usability study; review of notification rules | 2027-01-31 | 2 | Monthly; student panel per study |

### Additional roles the evidence requires (not advisors in the strict sense)

| Role | Why | Engage by | Notes |
| --- | --- | --- | --- |
| **Corporate and IP counsel** | Entity, founder assignment, equity, financing (FD-2026-002, -008) | 2026-11-15 | **COUNSEL**. Licensed in the relevant jurisdiction |
| **Education and privacy counsel** | Data-protection terms, student-record posture, claims review; the `privacy` seat is held by outside counsel today | Continuing | **COUNSEL**. May be the same firm as above if competent in both |
| **Trademark counsel** | The name finding in `IP.md` §2 (FD-2026-017) | 2027-01-15 | **COUNSEL** |
| **Insurance broker** | Cyber, technology E&O, general liability; contract mismatch (SR-021) | 2027-03-31 | Coverage bound before G2 |
| **Independent assessors** (penetration test, accessibility audit, SOC 2 auditor) | Independent evidence | Quotes by 2026-12-15 | Vendors, not advisors. Independent of the builder and of the advisors who scoped their work |

## 2. Role profiles

Each profile states what the advisor must be able to answer, what they produce, and what qualifies them. Qualification examples are indicative, not a requirement of any one credential.

### 2.1 Higher-education administration

- **Why.** The plan's calendar rests on assumptions about sales cycles and fiscal years that only an insider can confirm or break (A-03, A-04, A-05). The first design-partner choice (which unit) is the highest-leverage decision in Year 1.
- **Questions to answer by 2027-01-15.** Who signs a first pilot at a private research university and at a regional private? What is a realistic span from first meeting to signed term, and to budget? Which unit makes the best first cohort (first-year, transfer, honors, advising) and why? How do faculty governance and student government affect adoption? What kills a pilot after it starts?
- **Produces.** A validated buying-path map; a review of the charter template (by 2027-02-28); a ranked candidate-unit list.
- **Qualified by.** Senior administrative experience at a comparable institution within the last ten years; has bought or governed student-facing technology.
- **Where to find.** Practitioner associations and their regional meetings (for example EDUCAUSE, NASPA, NACADA).
- **Constraint.** Not on the Vanderbilt decision path for Semester (conflict rule in §3).

### 2.2 Registrar

- **Why.** Every record-adjacent promise (registration planning, holds, degree audit, calendars) must survive a registrar's scrutiny. This role validates the line between display, record-of-intent and system of record.
- **Questions to answer by 2027-01-31.** What must a registrar see before permitting Semester to read or display records? Where exactly is the line between "prepares and tracks" (R3) and "is the record" (R4)? What are the dates the academic calendar fixes that the plan must respect? What practices apply to directory information and school-official access (**COUNSEL** for the legal reading)?
- **Produces.** A registrar-acceptance checklist; a review of [`MARKET-ENTRY-PLAN.md`](MARKET-ENTRY-PLAN.md) §4.
- **Qualified by.** Registrar or associate-registrar experience; active in a registrars' professional association (for example AACRAO).

### 2.3 Accessibility

- **Why.** Accessibility is an acceptance criterion in every story, a procurement gate (FR-007) and a core-value claim. It also needs people who use assistive technology daily, not only automated checks.
- **Questions to answer by 2027-01-31.** What is the scope of a qualified review for this product? How should the conformance report and public statement be worded so they are accurate? What does the testing panel need? How do the legal accessibility regimes that bind public institutions interact with a private-first plan, and where is counsel needed (**COUNSEL**; verify current rules and dates)?
- **Produces.** An assistive-technology test plan; the audit scope; a tester panel; review of scorecard S7 and P5.
- **Qualified by.** A recognised accessibility certification, plus higher-education disability-services or accessibility-program experience.
- **Constraint.** The advisor shapes the plan; the independent audit is performed by a different party.

### 2.4 Privacy

- **Why.** Student-record law, state privacy law, minors and, if financial data is ever touched, financial-data safeguards obligations all reach vendors through institutions. A privacy specialist prepares the questions; counsel answers the legal ones.
- **Questions to answer by 2027-03-31.** Under what arrangement does Semester handle education records for a pilot, and what must the paper say? What data classes stay out of every pilot? How should retention, deletion, legal holds, backups and sub-processors be described? What is the age posture? What does the university's own privacy office require of vendors?
- **Produces.** A privacy-scoping memo for counsel; the pilot data-scope rule; review of [`../DATA-RETENTION-EXPORT-DELETION.md`](../DATA-RETENTION-EXPORT-DELETION.md) and the privacy impact assessment.
- **Qualified by.** Education-privacy practice (for example a privacy certification and higher-education experience); knows institutional data-governance bodies.
- **Constraint.** Advises; never states a legal conclusion.

### 2.5 Security

- **Why.** The `security` seat is vacant and the strongest single risk to institutional trust is a cross-tenant incident (SR-022).
- **Questions to answer by 2026-12-31.** Is the threat model adequate and what is missing? Which independent assessors, with what scope and independence, should be commissioned? What is the efficient path from a HECVAT response to a SOC 2 Type I and Type II? What should the incident exercise cover? What supply-chain, foreign-ownership and sub-processor-jurisdiction questions will institutions with sponsored research raise?
- **Produces.** A security plan; the assessor shortlist and scope; acceptance of the `security` seat in writing; review of [`../SECURITY-THREAT-MODEL.md`](../SECURITY-THREAT-MODEL.md).
- **Qualified by.** Security leadership experience with a recognised credential and higher-education exposure.

### 2.6 Procurement

- **Why.** The buyer's process decides the calendar and the paper. The trust room and charter should be built for how procurement actually works.
- **Questions to answer by 2027-02-28.** What is the sole-source threshold and what exceptions exist for pilots and student-led technology? What security and privacy packet is demanded, in what order? What insurance and liability terms are standard, and where do offers usually break? How do conflict-of-interest and vendor-registration rules treat a student-founded vendor (**COUNSEL**)?
- **Produces.** A review of the trust room and charter; a list of typical thresholds; objections to expect.
- **Qualified by.** Direct experience at a university purchasing office or selling to one repeatedly. Access to the National Association of Educational Procurement community helps.

### 2.7 Finance

- **Why.** The `finance` seat is vacant, no price book exists, and every number in [`BOARD-MEMO.md`](BOARD-MEMO.md) §6 is an assumption.
- **Questions to answer by 2027-01-15.** A bottom-up budget for Years 1 to 3 with sources; a price-book method and floors from observed delivery cost; revenue-recognition and tax questions for counsel and an accountant (**COUNSEL**/CPA); the bar and sequencing for pre-seed and seed; runway rules.
- **Produces.** The bottom-up budget replacing A-06 to A-10; the price-book method; acceptance of the `finance` seat in writing.
- **Qualified by.** SaaS or edtech finance leadership; has taken a company through a first institutional financing.

### 2.8 AI safety

- **Why.** The product puts AI in front of students on deadlines and policy. The thresholds that decide "good enough to release" must be set by someone qualified to set them.
- **Questions to answer by 2027-01-31.** What accuracy and refusal thresholds are right for deadline facts and policy statements (S9)? What does a credible red-team cover for prompt injection, exfiltration and cross-role leakage? Which tiers need which human oversight? How should academic-integrity design avoid both enabling and policing? Which model and data terms should be non-negotiable?
- **Produces.** The S9 thresholds; the first red-team plan; review of the AI governance, assurance and evaluation documents; inputs to FD-2026-010.
- **Qualified by.** Applied evaluation and safety experience, ideally with a higher-education deployment.

### 2.9 Student experience

- **Why.** Every product claim must survive contact with students. This role also holds the line against engagement dark patterns, since the north star is paired with a mute-rate guardrail.
- **Questions to answer by 2027-01-31.** Does the planning layer help or add load? What does a student think the app knows about them? Which notifications cross from helpful to pressure? Who is missing from the testing (commuter, transfer, first-generation, students with disabilities, students on shared devices)?
- **Produces.** The Month 2 usability study design and review; a standing student panel (3 to 5 students, compensated); review of the notification rules.
- **Qualified by.** Student-affairs, advising or learning-design experience; credibility with students.

## 3. Selection criteria, independence and conflicts

| Rule | Why |
| --- | --- |
| **Disclose every tie** to a prospective customer, competitor or investor before the first conversation | A hidden tie voids the advice and can damage a deal |
| **No advisor from the first design-partner institution's decision chain** advises on that institution's purchase | Conflict of interest, especially while the founder is a student there (SR-007) |
| **Assessors are independent** of the builder, of the advisor who scoped their work, and of any vendor whose product they assess | Independent evidence is the moat (MOAT-PLAN §4.8) |
| **No customer data is shared with advisors**; they work from synthetic data and documents | Data minimisation; consent boundaries |
| **A confidentiality agreement** before access to non-public material; terms reviewed by counsel | **COUNSEL** |
| **Advisors state their limits.** A non-lawyer refuses to give a legal opinion; a non-assessor refuses to certify | Prevents a legal or compliance conclusion from an unqualified source |
| **Compensation** is cash honorarium and expenses by default; equity or other consideration only on counsel's advice | **COUNSEL** |
| **Term** is a year, renewable; either side can end it | Avoids dormant advisors |
| **Challenge log.** Disagreements with the founder are recorded with the founder's response | The value of an advisor is the challenge |

## 4. How advisors are used

| Mechanism | Cadence | Output |
| --- | --- | --- |
| Office hour | Monthly, 45 minutes each | A written list of answers to the standing asks |
| Document review | Per artifact in §2 | Annotated review; accepted and rejected changes |
| Quarterly board session | Quarterly (monthly in Year 1) | Challenge log entries; decisions on the agenda |
| Gate review | At each gate | A written view from each relevant advisor, appended to the evidence pack |

## 5. Engagement plan

| Step | Owner seat | Date | Evidence |
| --- | --- | --- | --- |
| Shortlist three candidates per role; check ties | `founder` | 2026-11-15 | Shortlist with conflict notes |
| Wave 1 engaged: corporate and IP counsel, finance, security, higher-education administration | `founder` | 2026-11-30 (higher-education administration by 2026-12-15) | Signed engagement or advisory letters; seat acceptance for `security` and `finance` |
| Wave 2 engaged: registrar, privacy, accessibility, procurement, AI safety, student experience | `founder` | 2026-12-31 | Signed letters |
| First office hours held; standing asks logged | `founder` | 2027-01-31 | Notes on file |
| Quotes received from independent assessors | `security` | 2026-12-15 | Two quotes per artifact |
| Advisory board charter adopted (FD-2026-013) | `founder` | 2026-11-15 | Decision record |
| Review: which seats remain vacant, and whether a hire should replace an advisor | `founder` | 2027-03-31 | Seat register |

**If a role cannot be filled by its date,** the dependent gate is re-planned in the decision log; no one covers a vacant seat by quietly adding it to the founder's list (the council records seats "Founder, acting" precisely so the vacancy is visible).
