# Service Expansion Register

<!-- Rendered from app/src/lib/serviceregister.ts by serviceregister.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

The twenty-six service layers a document of 28 September 2026 proposes beyond
coursework — student-life, academic, career, institutional, platform-and-trust
and commercial — and where the repository stands on each. The
[strategic expansion register](STRATEGIC-EXPANSION-REGISTER.md) is the
governance that makes Semester durable; this is what a student or an office
would use. Where a module overlaps an area there, or a row of the
[master register](MASTER-LAUNCH-READINESS-REGISTER.md), it names them.

**Do not add features because they are popular. Add services that eliminate a real point of student friction, preserve institutional authority, improve accessibility, and create measurable value for institutions.**

| Supplied document | What it holds |
| --- | --- |
| [Any other services, features and capabilities that can be further developed](expansion/Service-Layers-Beyond-Coursework.pdf) | The twenty-six service layers, their boundaries, the twelve questions every proposed service answers, and the strategic sequence. |
| [Show me the transfer transition hub details (with career, safe AI and basic needs)](expansion/Transfer-Hub-Career-Safe-AI-and-Basic-Needs.pdf) | The Career OS boundaries, the skills-evidence ladder, the workforce-partner line and the six-step delivery order. |

## Where it stands

A status is a claim about the *best* piece of a module — `tested` cites a test
that runs on every change, `building` code, `designed` a document — so nearly
every module is `tested`: the app already has a checklist, a directory entry or
a screen for part of it. What the status cannot say, the capability marks do:
each capability the document asks for is marked present or absent, and the
table counts them. A module that is `tested` at 3 of 12 is mostly not there.
Across the register, 121 of 253 capabilities have something in the tree.
Assessed against `origin/main` `92952f0` on 28 September 2026; the supplied
PDFs are never cited as evidence.

| ID | Module | Group | Status | Present | Overlaps |
| --- | --- | --- | --- | ---: | --- |
| [S01](#s01) | Basic-needs and crisis-resource navigator | Student-life services | tested | 3 / 8 | `STU-012`, `UOS-002`, [CGV](STRATEGIC-EXPANSION-REGISTER.md#cgv), [SVC](STRATEGIC-EXPANSION-REGISTER.md#svc) |
| [S02](#s02) | Transfer-student transition hub | Student-life services | tested | 8 / 12 | `STU-003`, `STU-004`, `STU-008`, [PRF](STRATEGIC-EXPANSION-REGISTER.md#prf) |
| [S03](#s03) | Commuter, working, parenting and adult-learner mode | Student-life services | tested | 4 / 10 | `STU-007`, `STU-010` |
| [S04](#s04) | International-student navigation layer | Student-life services | tested | 4 / 9 | `STU-002`, `STU-012` |
| [S05](#s05) | Veteran and military-connected student navigator | Student-life services | tested | 3 / 7 | `STU-002` |
| [S06](#s06) | Course readiness and skills bridge | Academic and learning services | tested | 6 / 7 | — |
| [S07](#s07) | Study accessibility and learning-strategy studio | Academic and learning services | tested | 8 / 14 | [WFA](STRATEGIC-EXPANSION-REGISTER.md#wfa) |
| [S08](#s08) | Library and research navigator | Academic and learning services | tested | 5 / 10 | — |
| [S09](#s09) | Assessment and feedback literacy | Academic and learning services | tested | 5 / 9 | — |
| [S10](#s10) | Research, project and team-workspace layer | Academic and learning services | tested | 6 / 12 | [RES](STRATEGIC-EXPANSION-REGISTER.md#res) |
| [S11](#s11) | Skills evidence and learner-owned record | Career and lifelong-value services | tested | 5 / 8 | `UOS-004`, `UOS-007`, `LMS-015`, [CRD](STRATEGIC-EXPANSION-REGISTER.md#crd), [PRF](STRATEGIC-EXPANSION-REGISTER.md#prf), [EVG](STRATEGIC-EXPANSION-REGISTER.md#evg) |
| [S12](#s12) | Career exploration laboratory | Career and lifelong-value services | tested | 7 / 12 | `UOS-004`, [EVG](STRATEGIC-EXPANSION-REGISTER.md#evg) |
| [S13](#s13) | Micro-experience marketplace | Career and lifelong-value services | tested | 3 / 9 | `UOS-005` |
| [S14](#s14) | Alumni lifelong-access layer | Career and lifelong-value services | tested | 2 / 8 | `LEG-004`, [PRF](STRATEGIC-EXPANSION-REGISTER.md#prf), [CRD](STRATEGIC-EXPANSION-REGISTER.md#crd) |
| [S15](#s15) | Student-service content operations | Institutional services | tested | 7 / 14 | `TRUST-002`, `UOS-001`, [CGV](STRATEGIC-EXPANSION-REGISTER.md#cgv), [DQC](STRATEGIC-EXPANSION-REGISTER.md#dqc) |
| [S16](#s16) | Campus process builder | Institutional services | tested | 5 / 11 | `STU-012`, `SUP-001`, [SVC](STRATEGIC-EXPANSION-REGISTER.md#svc) |
| [S17](#s17) | Institutional communications orchestration | Institutional services | tested | 4 / 10 | `STU-002` |
| [S18](#s18) | Service design intelligence | Institutional services | tested | 2 / 9 | `UOS-008`, [PPA](STRATEGIC-EXPANSION-REGISTER.md#ppa) |
| [S19](#s19) | Consent and data-agency center | Platform and trust services | tested | 8 / 12 | `STU-011`, `UOS-007`, `IAM-010`, [DQC](STRATEGIC-EXPANSION-REGISTER.md#dqc) |
| [S20](#s20) | Source freshness and institutional verification network | Platform and trust services | tested | 4 / 10 | `TRUST-001`, `TRUST-002`, [CGV](STRATEGIC-EXPANSION-REGISTER.md#cgv), [DQC](STRATEGIC-EXPANSION-REGISTER.md#dqc) |
| [S21](#s21) | Safe AI workspace for institutions | Platform and trust services | tested | 7 / 10 | `AI-001`, `AI-006`, `AI-012`, `AI-013` |
| [S22](#s22) | Accessibility quality-assurance service | Platform and trust services | tested | 3 / 9 | [WFA](STRATEGIC-EXPANSION-REGISTER.md#wfa) |
| [S23](#s23) | Implementation academy | Commercial and ecosystem services | tested | 3 / 9 | `IMP-001`, `SUP-003`, [KNW](STRATEGIC-EXPANSION-REGISTER.md#knw), [CNL](STRATEGIC-EXPANSION-REGISTER.md#cnl) |
| [S24](#s24) | Campus innovation lab | Commercial and ecosystem services | building | 3 / 9 | `COM-002`, [CNL](STRATEGIC-EXPANSION-REGISTER.md#cnl), [OUT](STRATEGIC-EXPANSION-REGISTER.md#out) |
| [S25](#s25) | Interoperability marketplace | Commercial and ecosystem services | tested | 5 / 8 | `INT-001`, `INT-014`, [IOP](STRATEGIC-EXPANSION-REGISTER.md#iop), [VND](STRATEGIC-EXPANSION-REGISTER.md#vnd) |
| [S26](#s26) | Open benchmark and research program | Commercial and ecosystem services | designed | 1 / 7 | [BEN](STRATEGIC-EXPANSION-REGISTER.md#ben), [OUT](STRATEGIC-EXPANSION-REGISTER.md#out) |
| **total** | | | not-started 0, designed 1, building 1, tested 24 | **121 / 253** | |

## The strategic sequence

The highest-leverage next additions, in the document’s order.

| # | What | Why | Modules |
| ---: | --- | --- | --- |
| 1 | Transfer and life-transition hub | A natural, differentiated wedge for Semester. | [S02](#s02), [S03](#s03), [S04](#s04), [S05](#s05) |
| 2 | Basic-needs and student-service navigator | High student value with clear institutional ownership. | [S01](#s01) |
| 3 | Accessibility and learning-strategy studio | A defensible core product strength. | [S07](#s07) |
| 4 | Library and research navigator, and feedback literacy | Connects learning to expert human support. | [S08](#s08), [S09](#s09) |
| 5 | Student-service content operations | Improves campus information quality and discoverability. | [S15](#s15), [S20](#s20) |
| 6 | Skills evidence, portfolio and learner-owned record | Connects university life to career value. | [S11](#s11), [S12](#s12) |
| 7 | Implementation academy and interoperability marketplace | Reduces institutional buying and adoption risk. | [S23](#s23), [S25](#s25) |
| 8 | Open research and benchmark program | Makes Semester a category-defining authority rather than only a vendor. | [S26](#s26) |

The second document orders its own four modules and their governance:

1. Transfer Hub MVP: verified timeline, official-resource directory, questions and document checklist, advisor agenda, first-term dashboard, transfer peer and community discovery.
2. Basic-Needs Navigator MVP: resource directory, source, owner and freshness model, private save and checklist, official handoff, accessibility and language metadata, broken-link reporting.
3. Safe AI foundation: policy engine, source, scope and status UX, approved retrieval, no-write-by-default, audit and feedback, human routing.
4. Career Evidence MVP: opportunity tracker, private project and evidence workspace, resume and portfolio export, career-center handoff.
5. Institutional governance: council, policies, data inventory, content operations, risk register, launch gates and recurring evidence review.
6. Advanced expansion: peer mentoring, verified contribution records, alumni and employer opt-in network, portable credentials, institution-approved workflow automation.

## The register

### Student-life services

#### S01

**Basic-needs and crisis-resource navigator.** Many students struggle because the right help is hard to find, eligibility is unclear, or the official route is buried across websites.

*Boundary.* Do not collect unnecessary sensitive details, diagnose a crisis, or replace emergency, health, legal, financial-aid or counseling professionals.

*Status.* tested, 3 of 8 capabilities present.

- [x] Institution-verified resource directory (food, housing, transportation, technology, childcare, emergency funds, aid, health, legal, international, disability, supplies)
- [ ] Eligibility and documentation checklist per resource
- [ ] Hours, location, languages, cost and accessibility details per resource
- [x] Appointment and official-portal handoff
- [ ] Save-for-later and reminder controls
- [x] Private personal action checklist
- [ ] “Last reviewed” and content-owner labels on resources
- [ ] Broken-link and outdated-information report

| Evidence | Shows |
| --- | --- |
| `app/src/lib/support.ts` | food, emergency housing, emergency grants, transport, childcare and legal aid, each with an office, a privacy level and a “never” list |
| `app/src/lib/journey.guards.test.ts` | every entry names an office, a line or a screen and states its privacy; no score, no tracking |
| `app/src/lib/help-routes.test.ts` | financial aid and accessibility are directory-only: nothing is stored |
| `app/src/lib/campusdirectory.ts` | a school-imported departments-and-offices directory with hours, appointments and walk-in fields |

*Gap.* The entries are generic office pointers, not an institution-verified directory: no per-resource eligibility, documents, hours, cost, language or accessibility, no owner or review date, no save-for-later, no broken-link report. The object model is docs/BASIC-NEEDS-NAVIGATOR.md.

#### S02

**Transfer-student transition hub.** Semester’s origin story is the fragmentation transfer students face; a one-stop, source-aware hub is its natural wedge.

*Boundary.* No official transfer-credit or degree-completion decision. Organize evidence, identify questions, surface authoritative information, and prepare the student for the official evaluation.

*Status.* tested, 8 of 12 capabilities present.

- [x] Transfer credit preparation checklist
- [ ] Major and requirement comparison workspace (old school against new)
- [x] Orientation timeline
- [x] Campus systems glossary
- [x] Transfer peer mentorship
- [ ] “Where do I go for this?” navigator, transfer-specific
- [x] Community and club discovery
- [x] Advisor meeting preparation
- [x] Course and workload planning
- [ ] Scholarship and financial-aid handoff for transfers
- [x] Career and portfolio continuity
- [ ] Term-to-term transition archive of past plans and work

| Evidence | Shows |
| --- | --- |
| `app/src/lib/launchpad.ts` | the transfer type adds a credit-evaluation step and transfer orientation; the campus-terms glossary |
| `app/src/lib/learner-pathways.test.ts` | the transfer pathway offers credit-evaluation and program-change checklists, and names the registrar or advisor as the one who decides |
| `app/src/lib/advisor-meeting.test.ts` | the advisor agenda shares only what the student ticked |
| `app/src/lib/mentors.test.ts` | mentor matching on listed topics and ticked interests, nothing else |
| `app/src/lib/termtransition.test.ts` | start- and end-of-term checklists, each opening an existing screen |
| `supabase/migrations/20260926150000_expansion_roles_and_features.sql` | articulation_rules (draft, proposed, approved) and transfer_evaluations |

*Gap.* The transfer pieces are checklist steps spread across launchpad, pathway and learner-pathways; no comparison workspace, no transfer navigator, no archive. The hub’s structure is docs/TRANSFER-TRANSITION-HUB.md.

#### S03

**Commuter, working, parenting and adult-learner mode.** Most campus technology assumes students live on or near campus with flexible daytime schedules.

*Boundary.* Chosen, never inferred: a student says they commute, work or care for someone; the app never guesses it from behaviour.

*Status.* tested, 4 of 10 capabilities present.

- [x] Commuter travel-time planning
- [ ] Parking and transit information
- [ ] Hybrid and asynchronous event filtering
- [ ] Childcare and family-resource directory
- [x] Evening and weekend service availability (course sections)
- [ ] Asynchronous club and study-group options
- [x] Work-schedule-aware study planning
- [ ] Low-bandwidth mode
- [x] Downloadable and offline material access where permitted
- [ ] Caregiver-friendly reminder controls

| Evidence | Shows |
| --- | --- |
| `app/src/lib/life-balance.test.ts` | the weekly hours count a stated commute, work and class, and suggest study blocks without placing them |
| `app/src/lib/windows.test.ts` | work windows the student sets replace the assumed sixteen-hour day |
| `app/src/lib/learner-pathways.test.ts` | working and caregiver pathways; sections filtered to evening, weekend, online or hybrid |
| `app/src/lib/journey.guards.test.ts` | leaveBy: travel time plus a buffer, doubled on bad-weather days |
| `app/src/lib/travelpack.test.ts` | a course’s audio, decks and handouts downloaded ahead for offline use |

*Gap.* No parking or transit data, no hybrid or asynchronous filters for events and clubs, no family directory, no low-bandwidth mode, no caregiver reminder controls.

#### S04

**International-student navigation layer.** Compliance, documents, time zones and language are a second campus to learn, and the office that answers is easy to miss.

*Boundary.* Never offer legal or immigration advice as AI output. Label official information, preserve freshness dates, and route to the designated international office or qualified adviser.

*Status.* tested, 4 of 9 capabilities present.

- [x] International orientation checklist
- [x] Institution-approved compliance reminders (office-targeted)
- [ ] Travel and document-preparation checklists with expiry tracking
- [x] International-office handoffs
- [ ] Language support (translated interface)
- [ ] Time-zone-aware scheduling for the home zone
- [ ] Cultural and community discovery
- [x] Emergency-information routing
- [ ] Career, internship and work-authorization resource handoffs

| Evidence | Shows |
| --- | --- |
| `app/src/lib/learner-pathways.ts` | the international pathway routes to the office and says Semester gives no immigration, work or tax advice |
| `app/src/lib/pathway.ts` | an international-arrival checklist: official instructions, document and travel deadlines, advisor appointment |
| `app/src/lib/office-actions.test.ts` | offices reach students who chose the international eligibility; the student is told the match was their own choice |
| `app/src/lib/locale.test.ts` | a student-chosen locale for dates and numbers; nothing inferred |
| `docs/LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md` | the message catalogue that does not exist yet |

*Gap.* No translated interface, no document-expiry or travel tracker, no home-zone scheduling, no community discovery, and nothing on CPT or OPT.

#### S05

**Veteran and military-connected student navigator.** Benefits certification, military credit and deployment planning each have an office and a deadline, and a student new to campus meets all three at once.

*Boundary.* Configurable by institution and built only with appropriate stakeholder input; never calculates a benefit.

*Status.* tested, 3 of 7 capabilities present.

- [x] Benefits-office routing
- [x] Military-credit documentation checklist
- [x] Deployment and absence planning handoff
- [ ] Veteran community discovery
- [ ] Career translation resources
- [ ] Counseling and wellness resource handoff, veteran-specific
- [ ] Flexible and asynchronous resource filters

| Evidence | Shows |
| --- | --- |
| `app/src/components/LearnerPathways.test.tsx` | ticking “veteran, service member” shows the military checklist; the choice stays on the device |
| `app/src/lib/learner-pathways.test.ts` | pathway steps never say submit, approve or eligible |
| `app/src/lib/learner-pathways.ts` | benefit certification, credit for military training, a deployment plan, withdrawal and readmission rules, routed to the certifying official |
| `app/src/lib/office-actions.ts` | a Veterans Services office label and a veteran_benefits eligibility |

*Gap.* No benefits office with a real address, no document store, no veteran community, no career translation, no veteran-specific counseling handoff.

### Academic and learning services

#### S06

**Course readiness and skills bridge.** Before a term starts, a student can assess readiness without receiving a punitive label.

*Boundary.* Do not create hidden “at-risk” scores or automatically notify faculty or advisors based on a student’s participation.

*Status.* tested, 6 of 7 capabilities present.

- [x] Prerequisite and source review
- [x] Self-selected confidence check
- [x] Optional diagnostic practice
- [x] Accessible learning resources
- [ ] Bridge study plan tying a prerequisite gap to refresher material
- [x] Tutoring, writing and library referral
- [x] Instructor-approved refreshers, when available

| Evidence | Shows |
| --- | --- |
| `app/src/lib/study-readiness.test.ts` | per topic, the student sets status and confidence; practice shows as counts; it never predicts a grade or compares the student |
| `app/src/lib/pretest.test.ts` | optional practice before a unit, never scored |
| `app/src/lib/course-detail.test.ts` | prerequisite and corequisite codes read from the catalog |
| `app/src/lib/help-routes.test.ts` | requests to tutoring, writing center and library, sent only on confirm |
| `app/src/lib/institution-ops.test.ts` | any metric built on an individual risk score is refused |
| `app/src/lib/coursestudio.test.ts` | instructors publish study packs and guidance |

*Gap.* Readiness covers upcoming assessments in the current course; no bridge plan and no prerequisite diagnostic bank.

#### S07

**Study accessibility and learning-strategy studio.** These should be ordinary quality features, not tools that require a diagnosis or a disclosure.

*Boundary.* Never inferred: a mode is turned on by the student, and nothing guesses a disability from how the app is used.

*Status.* tested, 8 of 14 capabilities present.

- [x] Read aloud and text-to-speech (flash cards)
- [x] Focus reading mode and presets
- [x] Font, spacing, colour and contrast preferences
- [x] Plain-language explanation mode
- [ ] Vocabulary support
- [ ] Citation-supported summaries
- [ ] Audio note capture tied to readings
- [x] Speech-to-text drafting
- [ ] Outline and visual planning tools
- [ ] Accessible math and chart descriptions
- [x] Study-time estimates
- [x] Pomodoro and focus sessions, optional
- [ ] Distraction-minimized reading workspace
- [x] Executive-function planning supports (dated steps)

| Evidence | Shows |
| --- | --- |
| `app/src/lib/accessmode.ts` | plain language, one step at a time, predictable layout, sensory-friendly; Focus, Easier reading and Lower load presets |
| `app/src/lib/contrast.test.ts` | every accent and background pair legible; line height, reading width and a hyperlegible face in look.ts |
| `app/src/lib/speak.test.ts` | browser text-to-speech reads a card aloud and is silent where no voice exists |
| `app/src/lib/transcribe.test.ts` | speech-to-text for lectures and any field |
| `app/src/lib/breaks.test.ts` | a focus-mode break reminder, suggested, never enforced |
| `app/src/lib/pace.test.ts` | study-time estimates from the student’s own past durations |

*Gap.* No vocabulary builder, no reader for PDFs or documents, no audio notes tied to readings, no chart descriptions, and Study Studio summaries cite no sources.

#### S08

**Library and research navigator.** Partner with libraries rather than trying to replace them.

*Boundary.* Sources are found, not generated; an AI summary is never “verified”, and the librarian is the route for a question the app cannot answer.

*Status.* tested, 5 of 10 capabilities present.

- [x] Research question → librarian and service route
- [ ] Database and subject-guide discovery
- [x] Citation and source-evaluation help
- [ ] Course-reserve linking
- [ ] Copyright, fair-use and permissions guidance
- [ ] Research appointment scheduling
- [x] Peer-reviewed and source-type education
- [x] Reading-list organization
- [x] Citation manager export
- [ ] Research data-management handoff

| Evidence | Shows |
| --- | --- |
| `app/src/lib/research.test.ts` | web-search sources are found, not generated; peer-reviewed sources separated; a librarian pointed to |
| `app/src/lib/sources.test.ts` | a source list per course or project, BibTeX export, reading-list titling |
| `app/src/lib/toolkit/research.test.ts` | “verified” needs the original opened and a complete citation; AI summaries never are |
| `app/src/lib/cite.test.ts` | a quote checked strictly against its source text |
| `app/src/lib/help-routes.ts` | the library as a help-request destination |

*Gap.* No course reserves, subject guides, appointment booking, copyright guidance or data-management handoff.

#### S09

**Assessment and feedback literacy.** Students often receive grades or comments without understanding how to improve.

*Boundary.* Predicts nothing: no output mentions a score, grade or points earned, and a what-if never touches a stored grade.

*Status.* tested, 5 of 9 capabilities present.

- [x] Assignment brief → student checklist
- [x] Rubric explanation in plain language
- [ ] Instructor-approved examples
- [x] Submission-preparation checklist
- [ ] Feedback organizer
- [ ] Revision plan built from feedback
- [ ] Office-hours agenda builder
- [x] Academic-integrity policy reminders
- [x] Grade scenario planner, clearly marked as estimated

| Evidence | Shows |
| --- | --- |
| `app/src/lib/toolkit/rubric.test.ts` | a rubric becomes a checklist in its own words, and predicts nothing |
| `app/src/lib/toolkit/templates.test.ts` | assignment workspaces by stage; an AI-use declaration when policy requires one |
| `app/src/lib/assignment.test.ts` | instructions become a dated step plan; never writes the work |
| `app/src/lib/whatif.test.ts` | a supposed score lies over a real one and never touches stored grades |
| `app/src/lib/returned.test.ts` | days left to query a returned grade, with no opinion on the mark |
| `docs/ai-toolkit/RUBRIC-AND-AI-USE-POLICY.md` | the rubric self-check and layered AI-use policy |

*Gap.* No organizer for instructor feedback, no revision plan from it, no office-hours agenda (only the advisor one), and the what-if says “supposed” rather than “estimated”.

#### S10

**Research, project and team-workspace layer.** Valuable with native LMS features, and still compatible with an external LMS workflow.

*Boundary.* Do not turn peer evaluation into an opaque reputation score; instructors choose whether and how any assessed peer review is enabled.

*Status.* tested, 6 of 12 capabilities present.

- [ ] Project charter
- [x] Role definitions (template stages)
- [x] Accessible action board (shared checklist)
- [ ] Source library shared across the team
- [x] Meeting agenda (template stage)
- [ ] Decision log
- [ ] Peer feedback templates
- [ ] Version history shared across the team
- [x] Evidence and portfolio export
- [x] Institutional data-classification prompt
- [x] Academic-integrity and AI-use disclosure
- [ ] Team closure and reflection

| Evidence | Shows |
| --- | --- |
| `app/src/lib/groupwork.test.ts` | a shared checklist with claimed and unclaimed parts; the per-person view sorts by name, not output |
| `supabase/groups.check.sql` | row-level security for group rooms and shared parts |
| `app/src/lib/toolkit/templates.ts` | group-project stages: scope, roles, milestones, agenda, contribution log, peer review, integration |
| `app/src/lib/toolkit/classification.test.ts` | unclassified material is T3 and kept out of AI, share and export |
| `app/src/lib/toolkit/disclosure.test.ts` | a student-written AI-use declaration naming the kind of material, never its contents |

*Gap.* No charter, decision log, peer-feedback templates, reflection, shared source library or shared version history; the template stages are individual notes.

### Career and lifelong-value services

#### S11

**Skills evidence and learner-owned record.** Coursework, projects, employment, service, leadership, research and credentials become understandable, portable evidence the student owns.

*Boundary.* Distinguish self-claimed skill, reflection, verified participation, verified contribution, assessed competency and issuer credential; never treat attendance or a self-description as a validated skill.

*Status.* tested, 5 of 8 capabilities present.

- [x] Skill or competency → evidence artifact
- [ ] Student reflection on the artifact
- [x] Optional faculty, advisor or issuer verification
- [ ] Criterion and issue date on a verified record
- [x] Private learner record
- [x] Student-controlled sharing (employer opt-in)
- [x] Resume, portfolio or application export
- [ ] Optional verifiable badge or credential (Open Badges, CLR, CASE)

| Evidence | Shows |
| --- | --- |
| `supabase/migrations/20260926150000_expansion_roles_and_features.sql` | skill_records: self-reported → verification requested → verified or declined, scoped to skill:verify; talent_profiles opt-in that expires |
| `supabase/expansion.check.sql` | the verifier policies and the opt-in, in SQL |
| `supabase/migrations/20260923211000_evidence_graphs.sql` | skill_claim with evidence references |
| `app/src/lib/skills-graph.test.ts` | skills suggested from courses, projects, work and organizations, with evidence links and a stale flag |
| `app/src/lib/career-evidence.test.ts` | the student confirms or rejects skills; an artifact must cite a course or experience |
| `docs/CREDENTIAL-WALLET.md` | private by default, share and revoke, sensitive classes out; then Open Badges and CLR — none built |

*Gap.* No reflection, criterion or issue date, named-recipient share, issuer revocation or standards export; the states do not separate participation, contribution, competency and credential.

#### S12

**Career exploration laboratory.** Turn “what could I do?” into questions, evidence and appointments rather than a verdict.

*Boundary.* Never score an individual’s employability or sell student academic data to employers; the student chooses whether to create a profile or share an artifact.

*Status.* tested, 7 of 12 capabilities present.

- [ ] Role and industry exploration
- [x] Skills-gap map, explainable and editable
- [ ] Portfolio readiness checklist
- [ ] Informational-interview preparation
- [x] Alumni mentor matching
- [ ] Employer office hours
- [x] Job and internship opportunity tracker
- [x] Interview practice
- [ ] Offer-comparison worksheet
- [x] Graduate-school planning (tracker)
- [x] Application calendar
- [x] Career-center handoff

| Evidence | Shows |
| --- | --- |
| `app/src/screens/career.test.tsx` | self-entered opportunities, experiences, contacts with permission recorded, resume and cover-letter scaffolds, interview practice |
| `app/src/lib/skills-graph.test.ts` | explainFit and missingSkillPlan: an explainable gap per opportunity |
| `app/src/lib/apply.test.ts` | a job, internship and grad-school tracker with stages, no probability or fit score, fed to the deadline calendar |
| `app/src/lib/mentors.test.ts` | peer and alumni mentors matched only on ticked topics |
| `app/src/lib/help-routes.test.ts` | a request to the career center after a preview |

*Gap.* No role explorer, portfolio-readiness checklist, informational-interview prep, employer office hours or offer comparison; and no written rule against employability scoring — the ordering score in career.ts is never displayed, but nothing forbids displaying one.

#### S13

**Micro-experience marketplace.** Institution-approved, well-described opportunities: research, faculty projects, micro-internships, consulting, service, startups, competitions, tutoring, leadership, workshops, alumni projects.

*Boundary.* Eligibility is shown as the office wrote it and never evaluated; the publisher cannot self-publish.

*Status.* tested, 3 of 9 capabilities present.

- [x] Institution-approved listings, moderated before publication
- [x] Deadline and eligibility, in the office’s own words
- [ ] Compensation disclosed on every listing
- [ ] Time commitment disclosed
- [ ] Supervisor or owner disclosed
- [ ] Accessibility accommodation contact
- [x] Source verification (https, publisher scope)
- [ ] Learning and career value stated
- [ ] The listing kinds: faculty projects, micro-internships, campus consulting, competitions, peer tutoring, alumni projects

| Evidence | Shows |
| --- | --- |
| `supabase/migrations/20260926150000_expansion_roles_and_features.sql` | opportunities: job, internship, scholarship, deal, program, housing; draft → pending review → published |
| `supabase/listings.check.sql` | the publisher cannot self-publish; a student sees only published listings at their school |
| `app/src/lib/listings.test.ts` | eligibility shown as written and never judged; https only |
| `app/src/lib/journey.guards.test.ts` | the student-side tracker with office-ordered checklists, hours per week and a time budget |
| `app/src/screens/Opportunities.tsx` | the Opportunities screen |

*Gap.* A listing has no required compensation, time, supervisor, accessibility contact or learning-value field, and the kinds stop at job, internship, scholarship, deal, program and housing.

#### S14

**Alumni lifelong-access layer.** After graduation Semester can remain useful without retaining data indefinitely or turning alumni into a marketing audience by default.

*Boundary.* No indefinite retention and no marketing audience by default; an alumnus keeps what they chose to keep.

*Status.* tested, 2 of 8 capabilities present.

- [ ] Portable credentials and project archive
- [x] Alumni mentoring
- [ ] Career and job resources for alumni
- [ ] Continuing-education discovery
- [ ] Professional community groups
- [ ] Transcript and official-record handoff
- [ ] Portfolio maintenance after graduation
- [x] Data-export and account-transition tools

| Evidence | Shows |
| --- | --- |
| `supabase/mentor-rosters.check.sql` | alumni mentor offers and requests needing consent from both sides |
| `app/src/components/MentorFinder.test.tsx` | finding and requesting a peer or alumni mentor |
| `supabase/migrations/20260929010000_account_erasure_and_export.sql` | export_my_data() and erase_account, recorded in data_requests |
| `app/src/lib/erasure.test.ts` | export and erasure held to the same data map |
| `docs/CAREER-PORTABILITY-AND-LIFELONG-ACCESS.md` | alumni_transitions and portfolio visibility, not built |

*Gap.* Nothing moves a graduating student into an alumni account or keeps access after the institutional login ends; no archive with a manifest, no credential carry-over, no transcript handoff.

### Institutional services

#### S15

**Student-service content operations.** Most institutions have good resources but poor discoverability and stale pages; a governed publishing system improves the experience without a SIS replacement.

*Boundary.* A second person approves; nothing publishes with no source, no owner or a plain-http link.

*Status.* tested, 7 of 14 capabilities present.

- [x] Content owner
- [x] Audience (approved roles, terms, eligibility the student chose)
- [x] Eligibility, in the office’s words
- [x] Official source
- [x] Review date
- [x] Expiry date
- [ ] Accessibility checklist per item
- [ ] Translations
- [ ] Related workflows
- [ ] Search keywords
- [ ] Usage and failed-search insights
- [ ] Broken-link alerts
- [ ] Student feedback per item
- [x] Approval and version history (office actions; Course Studio)

| Evidence | Shows |
| --- | --- |
| `supabase/migrations/20260928302000_office_action_feed.sql` | an office action needs an office, an https official link, a source note and an updated_at; draft → review → published, a second person approving |
| `supabase/officeactions.check.sql` | office scope, second-person approval and the required fields |
| `app/src/lib/office-actions.test.ts` | incomplete rows refused; the audience named; expires a day after its date |
| `app/src/lib/launch/content.test.ts` | thirteen institutional content kinds, each with source type, owner, review interval, visibility, expiry and correction route |
| `docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md` | lineage and freshness per field, planned |

*Gap.* Governed publishing exists for office actions and launch content, not for general office pages: no accessibility checklist, translations, keywords, failed-search or broken-link signals, or per-item feedback.

#### S16

**Campus process builder.** Authorized offices configure safe, clear workflows — tutoring request, library consultation, career coaching, scholarship checklist — that route and prepare, never decide.

*Boundary.* Route and prepare — never determine eligibility or make an official decision; nobody is referred automatically.

*Status.* tested, 5 of 11 capabilities present.

- [x] Appointment or help request, previewed and sent by the student
- [ ] Document checklist an office configures
- [x] Referral (student-initiated, to a named destination)
- [ ] Service intake form an office configures
- [x] Status tracker (help request statuses)
- [ ] Reminder step
- [x] Handoff to the official system
- [ ] Escalation step
- [x] Closure (withdraw, answer)
- [ ] Feedback step
- [ ] An office configuring any of the above without code

| Evidence | Shows |
| --- | --- |
| `supabase/migrations/20260927230000_help_requests.sql` | send_help_request: the student’s own previewed request to an office; staff read it through an inbox and a logged open |
| `supabase/help-requests.check.sql` | the request and inbox refusals |
| `app/src/lib/help-routes.test.ts` | need → question → preview → send or withdraw; nobody referred automatically |
| `packages/institution/src/workflow.test.ts` | fixed state machines: assessment submission, support access, data deletion, grade passback |
| `app/src/components/OfficeActionFeed.test.tsx` | submit, approve, return, withdraw on the office side |

*Gap.* Every flow is hard-coded; nothing lets an office configure steps, checklists, intake, reminders, escalation or feedback.

#### S17

**Institutional communications orchestration.** Every communication answers: who sent this, why am I receiving it, what action is needed, where is the official source, how do I change preferences.

*Boundary.* No source, no message: a message with no source or sponsored content is dropped, and Required is only for a current official message.

*Status.* tested, 4 of 10 capabilities present.

- [x] Verified office announcements
- [x] Audience segmentation by approved roles and terms, never inferred behaviour
- [x] Student notification preferences (mute, quiet hours, digests)
- [ ] Accessibility-compliant message templates
- [ ] Multi-channel delivery (email, SMS)
- [ ] Message scheduling
- [ ] Delivery and action metrics
- [ ] Duplicate-message suppression across offices
- [ ] Emergency communications handoff
- [x] Archive and expiry controls (a notice expires a day after its date)

| Evidence | Shows |
| --- | --- |
| `app/src/lib/journey.guards.test.ts` | admit drops messages with no source and sponsored content; Required only for current official messages; quiet hours hold only optional ones |
| `app/src/lib/official-notices.test.ts` | school records become official messages with freshness and source, downgraded when stale |
| `app/src/lib/office-actions.test.ts` | whyYouSee: the audience came from the student’s own choice |
| `app/src/lib/push.test.ts` | web push from a queue |
| `app/src/screens/Hub.tsx` | the Notices hub: Official, Courses and Semester channels |

*Gap.* No announcement composer for offices, no templates, no email or SMS, no scheduling, no metrics, no duplicate suppression, no emergency handoff.

#### S18

**Service design intelligence.** Offices get aggregate, privacy-protected visibility into friction without any monitoring of individual students.

*Boundary.* Never a per-student grain; every aggregate a university reads is suppressed below ten, and the next-smallest cell beside a published total is suppressed too.

*Status.* tested, 2 of 9 capabilities present.

- [ ] Most-searched unanswered questions
- [ ] Common failed handoffs
- [ ] Stale information
- [ ] Broken links
- [x] Appointment and course demand patterns (consented, at ten or more)
- [ ] Accessibility barriers reported
- [ ] Resource discovery gaps
- [ ] Repeated service-navigation issues
- [x] Small-cell suppression

| Evidence | Shows |
| --- | --- |
| `app/src/lib/institution-ops.test.ts` | MIN_COHORT ten, complementary suppression, question themes without ids, forbidden per-student metrics |
| `app/src/lib/cohortfloor.test.ts` | the app floor equals every SQL floor in the migrations |
| `app/src/lib/course-demand.test.ts` | demand from consenting students, published only at ten or more |
| `supabase/demand.check.sql` | staff read counts in their own scope, never a person |
| `docs/PRODUCT-ANALYTICS-DATA-ETHICS.md` | what is measured and what is promised never to be |

*Gap.* No telemetry for failed searches, failed handoffs, stale pages, broken links or reported barriers; workflow_friction is a definition with no data source.

### Platform and trust services

#### S19

**Consent and data-agency center.** A visual control center where every control says what changes, who loses or gains access, what remains due to retention, and how to reverse or appeal it.

*Boundary.* Every control is the student’s; nothing here reads what a student did to decide what to show them.

*Status.* tested, 8 of 12 capabilities present.

- [x] Connected accounts
- [x] Data categories and what AI may not use
- [x] Active shares, revocable after saying what happens
- [ ] Mentorship and club visibility controls
- [x] Employer and alumni profile visibility (opt-in)
- [x] AI settings and history (delete conversations)
- [x] Notification settings
- [x] Exports
- [x] Deletion requests
- [ ] Support-access history on screen
- [ ] Consent and policy history on screen
- [ ] Each control stating what changes, who gains or loses, what retention keeps, how to reverse or appeal

| Evidence | Shows |
| --- | --- |
| `app/src/components/TrustCenter.test.tsx` | what is connected, what the labels mean and what AI may not use; a share revoked only after saying what happens; conversations deleted after a confirm; export one tap away |
| `app/src/components/DataRightsRequests.test.tsx` | a signed-in student files and tracks formal access, correction, restriction and assisted-erasure requests |
| `app/src/lib/privacy.test.ts` | the privacy claims are checked data, and whatDeletionLeaves() says what survives |
| `app/src/lib/deleteaccount.test.ts` | delete-account with an authenticated token only |
| `supabase/support-access.check.sql` | support access granted by the student, time-boxed and audited |
| `docs/DATA-RIGHTS-REQUEST-RUNBOOK.md` | daily handling, escalation, evidence and quarterly rehearsal procedure |

*Gap.* No screen shows consent or policy history or support-access history, the staff handling surface is not built, and not every control states in a structured way who gains or loses access and how to reverse it.

#### S20

**Source freshness and institutional verification network.** Semester’s signature institutional capability: not simply showing content, but ensuring students can rely on it.

*Boundary.* Five source labels, the same five the database enforces; nothing says “verified” unless the institution’s own system did.

*Status.* tested, 4 of 10 capabilities present.

- [x] Source owner (per content kind and per connection)
- [x] Verification date (source labels; freshness on notices)
- [x] Review cycle (per content kind and per connection)
- [x] Expiry date
- [ ] Change history per resource
- [ ] Linked workflows
- [ ] Student-reported issue queue per resource
- [ ] Accessibility status
- [ ] Language availability
- [ ] Usage and search demand

| Evidence | Shows |
| --- | --- |
| `app/src/lib/launch/content.test.ts` | each content kind has a source type, steward owner, review interval, visibility, expiry and correction route |
| `supabase/integration-quality.check.sql` | an owner, a backup owner and a review cadence per connection |
| `app/src/lib/source.test.ts` | the five source labels held to the database constraint |
| `app/src/lib/official-notices.test.ts` | freshness text and a stale item that cannot claim Required |
| `app/src/lib/governance/data-contracts.test.ts` | owner, steward, freshness and correction per domain, unstaffed until named |
| `docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md` | source_records, snapshots and freshness events, planned |

*Gap.* Ownership and review cadence exist per content kind and per connection, not per resource; campus links are hard-coded; no change history, issue queue, accessibility or language status per resource.

#### S21

**Safe AI workspace for institutions.** AI policy needs to be understandable at the moment students act — not hidden in a PDF.

*Boundary.* No autonomous or consequential decision about a student, refused at intake; the matrix and checklist are docs/operating-model/AI-ASSURANCE.md.

*Status.* tested, 7 of 10 capabilities present.

- [x] Approved AI tools and modes per tenant
- [x] Source restrictions (approved sources; course sources only)
- [x] Course-specific instructions (course AI rules)
- [x] Student-facing policy display (assignment → course → school → university)
- [ ] Citation and attribution expectations as a setting
- [ ] Human-review requirements as a setting
- [x] Data-retention settings per tenant
- [x] Prompt and output safeguards (kill switch; classification)
- [ ] Feedback and incident reporting that reaches an owner
- [x] Usage transparency (what each answer used)

| Evidence | Shows |
| --- | --- |
| `supabase/intelligence-policy.check.sql` | ai_policy: allowed modes and providers, course sources only, web allowed, retention days, policy version; approved_source per course |
| `app/src/lib/coursestudio.test.ts` | faculty publish per-course AI rules for ten uses, versioned and append-only |
| `app/src/lib/toolkit/policy.test.ts` | policy resolves assignment → course → school → university; unknown is not allowed |
| `app/src/lib/aikillswitch.test.ts` | the global and per-tenant switch fails closed |
| `app/src/lib/governance/ai-lifecycle.test.ts` | gates in order; consequential scopes refused at intake |
| `app/src/intelligence/Disclosure.test.tsx` | each answer shows what it used |

*Gap.* The claude edge function enforces neither ai_policy nor course_ai_rules nor the tenant switch row; no admin authoring screen; no citation or human-review setting; no report that reaches an owner.

#### S22

**Accessibility quality-assurance service.** A continuous operational service, not a one-time VPAT document.

*Boundary.* No certification claim: Semester has no ACR, and says so.

*Status.* tested, 3 of 9 capabilities present.

- [x] Automated accessibility checks
- [ ] Manual assistive-technology testing, completed
- [ ] Accessibility issue tracker
- [ ] Remediation workflow
- [ ] Accessible-content authoring guidance
- [x] Release accessibility gate (definition of ready and done)
- [ ] Current ACR or VPAT materials
- [x] Student feedback route (a support-ticket category)
- [ ] Quarterly accessibility quality report

| Evidence | Shows |
| --- | --- |
| `app/src/a11y/axe.test.tsx` | axe-core over the rendered app, beside label, landmark, focus, motion and title guards |
| `app/scripts/accessibility-smoke.mjs` | the browser smoke CI runs |
| `app/src/lib/governance/quality-gates.test.ts` | accessibility criteria in the definition of ready and done; defect aging a metric |
| `docs/accessibility/AT-PASS-PROTOCOL.md` | the manual screen-reader protocol, not yet done |
| `docs/operating-model/ACCESSIBILITY-GOVERNANCE.md` | champions, a severity backlog and a paid assistive-tech panel, no members |
| `docs/trust/HECVAT-VPAT-PLAN.md` | the ninety-day plan for an ACR; none exists |

*Gap.* Beyond the automated checks nothing runs: no tracker, no remediation workflow, no completed manual pass, no ACR, no quarterly report.

### Commercial and ecosystem services

#### S23

**Implementation academy.** Lowers implementation risk and gives institutions a reason to choose Semester over a tool that requires them to invent their own operating model.

*Boundary.* Training and communications finish before a cohort launches; the ninety-day program refuses a launch marked done ahead of its prerequisites.

*Status.* tested, 3 of 9 capabilities present.

- [x] Administrator onboarding (in progress)
- [ ] Student-affairs playbooks
- [ ] Faculty and advisor enablement, delivered
- [ ] Accessibility and AI governance training
- [ ] Integration certification
- [ ] Office-hours clinics
- [x] Launch communications kit
- [x] Pilot measurement guide
- [ ] Annual maturity review, institution-facing

| Evidence | Shows |
| --- | --- |
| `app/src/lib/launch/content.test.ts` | the launch package: seventeen guides with status; faculty and advisor quick-starts not started |
| `app/src/lib/launch/ninety-day.test.ts` | owned, ordered actions; training and communications before the cohort launches |
| `docs/launch/ANNOUNCEMENT-TEMPLATES.md` | the campus announcement kit |
| `docs/operating-model/CHANGE-MANAGEMENT.md` | the institutional change path; training tracking marked designed |
| `docs/FACULTY-ENABLEMENT.md` | the faculty plan, almost none of it built |

*Gap.* No curriculum, no training tracking, no certification program, no clinics, no playbooks, no institution maturity review; what exists is checklists, templates and plans.

#### S24

**Campus innovation lab.** A paid or strategically subsidized design partnership creates trusted relationships before a full enterprise commitment.

*Boundary.* A pilot is not a free trial: three to five metrics with baselines, a sponsor, a champion and a signed conversion decision.

*Status.* building, 3 of 9 capabilities present.

- [ ] Journey mapping
- [x] Student, faculty and staff research cadence
- [ ] Accessibility review as part of the partnership
- [ ] Service-directory cleanup
- [ ] AI governance workshop
- [x] Pilot design (readiness, baselines, sponsor, champion, data plan)
- [x] Success metrics with baselines
- [ ] Implementation plan template
- [ ] Executive readout

| Evidence | Shows |
| --- | --- |
| `app/src/lib/gtm/pilot.test.ts` | pilotReadiness needs a baseline per metric, a sponsor, a champion and a data plan; the verdict needs a signed decision |
| `docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md` | interviews, workflow maps, an assistive-tech review, a usability benchmark and a trust survey — owned roles, no staff |
| `docs/trust/PILOT-AGREEMENT-OUTLINE.md` | the pilot agreement’s sections and scorecard |
| `PILOT.md` | the student pilot: owner, cohort, consent, end conditions |
| `docs/INSTITUTIONAL-GTM-PLAYBOOK.md` | the buying committee and stages |

*Gap.* No packaged design-partnership offering: no journey-mapping method, directory cleanup, workshop kit, plan template or executive readout; only pilot mechanics and a research cadence.

#### S25

**Interoperability marketplace.** A curated connector ecosystem where each listing shows data direction, scope, permissions, freshness, version, certification, limitations, owner, health and how to disconnect.

*Boundary.* A do-not-ingest list per provider; a matched record is a count, never a discrepancy row with a person in it.

*Status.* tested, 5 of 8 capabilities present.

- [x] Connector catalog: LMS, SIS, identity, calendar, library, career, events and more
- [x] Data direction and scope per student-connectable account
- [x] Freshness and sync class per domain
- [x] Certification only with dated, person-verified evidence
- [x] Health status on a staff dashboard
- [ ] Fields and scope, version, limitations, setup guide, owner and disconnect process on one listing
- [ ] Room reservations, credential providers, payments and accessibility tools as domains
- [ ] Third-party connectors, and the governance for admitting one

| Evidence | Shows |
| --- | --- |
| `supabase/functions/_shared/integration/catalog.ts` | twenty-one provider domains with canonical entities, freshness, sync classes and a do-not-ingest list |
| `app/src/lib/integration/quality.test.ts` | the maturity ladder; “certified” only with dated, person-verified evidence that lapses |
| `app/src/components/institutional/IntegrationDashboard.test.tsx` | every domain with status and health; pausing needs a reason |
| `app/src/lib/connect.scopes.test.ts` | each account says what it reads and writes |
| `supabase/integration-control-plane.check.sql` | connections and source records under tenant RLS |
| `docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md` | third-party extension governance, none of it existing |

*Gap.* No listing surface combining scope, version, limitations, setup guide, owner, health and disconnect; no third-party connectors; four domains missing.

#### S26

**Open benchmark and research program.** Makes Semester a category-defining authority rather than only a vendor.

*Boundary.* Never rank institutions using private operational data without express agreement; publish methodology, consent, aggregation and limitations.

*Status.* designed, 1 of 7 capabilities present.

- [ ] Academic Friction Index
- [ ] Student digital access and accessibility benchmark
- [ ] AI policy clarity benchmark
- [ ] Campus resource discoverability report
- [ ] Interoperability maturity model
- [ ] Student data-agency benchmark
- [x] A minimum cell size on every aggregate

| Evidence | Shows |
| --- | --- |
| `app/src/lib/expansionregister.ts` | BEN: the benchmark programme designed with no methodology; OUT: no research protocol |
| `docs/operating-model/DEFENSIBILITY.md` | benchmarks only from aggregated, consented, privacy-preserving outcomes with a minimum cell size |
| `docs/PRODUCT-ANALYTICS-DATA-ETHICS.md` | what is measured and what is promised never to be |
| `app/src/lib/cohortfloor.test.ts` | the floor of ten in the app and in every migration |

*Gap.* None of the six benchmarks exists, there is no methodology or data-sharing agreement, and no written rule against ranking institutions on private data beyond the cell-size floor.

## Career OS: what Semester does, and does not

| Capability | What Semester does | What Semester does not do |
| --- | --- | --- |
| Career exploration | Maps roles, industries, pathways, skills and questions to explore | Declare a career “best” for a student |
| Skills evidence map | Connects coursework, projects, clubs, work, research and service to student-selected skills | Infer hidden traits or rank students |
| Portfolio builder | Organizes artifacts, contribution statements, reflections and links | Publish work without student approval |
| Opportunity tracker | Tracks internships, jobs, research, fellowships, events and deadlines | Guarantee job outcomes or hide compensation |
| Application workspace | Resume tailoring, cover-letter drafting, interview practice, action calendar | Submit applications automatically without review |
| Mentor and alumni tools | Helps students request informational conversations and prepare agendas | Expose academic records to alumni or employers |
| Credential wallet | Stores and exports eligible verified achievements and evidence | Treat a badge as proof of competence without stated criteria |
| Career-center routing | Finds appointments, workshops, official services and accessibility support | Replace career professionals |

A skills record distinguishes, in order: self-claimed skill → student reflection → verified participation → verified contribution → assessed competency → issuer credential. That prevents a common credibility failure: treating attendance or a self-description as an independently validated skill.

Employers may pay for legitimate services — verified postings, office hours,
events, portfolio review. They never receive:

- Student grades
- Course performance
- Accommodation information
- Mental-health or basic-needs information
- Private club or mentorship activity
- Hidden engagement scores
- AI conversation history
- Unapproved student data exports

Students opt in to any employer-facing profile, select individual artifacts,
set expiry dates, and revoke sharing where technically possible.

## What to evaluate next

Score every proposed service against these before adding it. The scope rule and
its nine questions in the pull-request template apply first; these are the
service-specific ones.

| Question | Why it matters |
| --- | --- |
| What concrete student or institutional friction does this remove? | Prevents feature accumulation |
| Who is the accountable owner? | Prevents ungoverned modules |
| What remains officially decided elsewhere? | Protects institutional authority |
| What data is necessary, optional, sensitive, or prohibited? | Preserves privacy and trust |
| What are the accessibility requirements? | Makes inclusion foundational |
| What could go wrong or be abused? | Forces safety design early |
| What is the human escalation path? | Avoids false automation |
| How does a user correct, export, delete, revoke, or recover? | Builds student agency |
| What evidence will prove value? | Avoids vanity metrics |
| Can this be built through standards and integration rather than replacement? | Reduces implementation cost and lock-in |
| Does this increase or reduce operational burden? | Protects scale and margins |
| Is it a short-term feature or a defensible platform capability? | Keeps the plan strategic |

The ultimate benchmark is a platform that helps a student move from “I do not
know where to start” to “I know what matters, what I can do, who can help, and
what is officially true” — while giving institutions the governance and evidence
to support that experience.
