## Executive summary

Semester is a platform for a student's whole educational journey, designed to work alongside an institution's own systems and not replace them. Its public descriptor is "the student action platform"; "Student OS" is used internally and in the design documents. The product reads an institution's official records from its student information system (SIS), learning management system (LMS) and identity provider, and turns them into one plan for each student: what needs attention now, what is coming, what is official, and who can help. Alongside the student app it offers staff workspaces for faculty, teaching assistants, advisors, registrars, finance and student affairs, an institution console for administrators and IT, and external views for applicants, guardians, alumni, employers and marketplace partners.

The company is at pre-seed. It is founder-led and bootstrapped, and its first paid pilot is signed with Vanderbilt University, with dates not yet set. Four items are in progress for the pilot: HECVAT Full, a VPAT/ACR accessibility report, SAML single sign-on and insurance. This book describes the product as it is designed, not as it is shipped. Every catalog carries the same caveat: the work is design-level, and nothing is verified until repository code, tenant isolation, accessibility, tests, monitoring, support, documentation and release evidence exist. The platform readiness scorecard scores the company 1.25 out of 5 on average across 24 dimensions, and says so plainly.

The core promise is clarity with accountability. The student app is organised around a daily loop of six questions: what changed, what matters, what can I do, what is official, who can help, and what progress did I make. Every date, grade, hold and answer carries a source label (official, connected, yours, estimated, AI-assisted, external or community) and a freshness time. When data is stale or unavailable the interface says so in a "status sentence": what is true, what that means for you, and what you can do. Semester does not claim to be the gradebook, registrar or payment processor; those remain with the institution, and Semester hands off to them.

The second part of the promise is governance. Every action in the system is resolved through a fourteen-link control chain: identity, institution (tenant), membership, role, capability, scope, policy, data classification, consent, source authority, workflow, audit, evidence and outcome. Consequential actions show their consequences before confirmation and, where the stakes are high, require two people. Students decide what advisors and family can see, for how long, and can revoke it. The AI assistant, Ask Semester, is always labelled AI-assisted, cites its sources, obeys the instructor's course AI policy and, according to the product brief and FAQ, never sees student records.

Semester differs from the tools it sits beside in five ways, each traceable to the source documents. It is one connected graph of 32 node types rather than separate apps. It treats source authority as a first-class property of every field. It routes AI through a gateway that checks classification, consent and course policy before any model is chosen. It treats integration and migration as a governed factory, in which the SIS stays read-only until a write direction is separately approved and reconciliation shows zero unexplained mismatches. And it pairs the student experience with the operating tools the institution and the company need to run it.

The scope of the design is large. The master catalogs describe 21 layers and 449 modules, 88 systems, 17 workflows with 319 steps, 49 roles plus three system or company actors, 589 catalogued screens in 14 groups plus 84 screens added to close workflow gaps, and a 22-point release gate that every screen, workflow, system or domain must pass before it is called complete. The catalogs are also frank about what is missing: 84 workflow steps had no screen, 13 roles have no workflow, 68 of 82 required documents are not started, and 8 of the 22 release gates are not reachable in the design project.

The long-term doctrine is stated in the OS master map: build core capabilities natively, integrate responsibly during transition, replace by domain only with evidence, and operate every domain as one coherent system. For the pilot, the stance is narrower and more conservative: connect first, read first, show the source, and hand off to the institution's own processes for anything official. A 36-month roadmap gates each phase on evidence rather than dates, beginning with proving the Vanderbilt pilot and ending, in its last phase, with a governed marketplace, multi-campus deployments and published outcome research.

## The product in numbers

All figures are taken as stated in, or counted directly from, the master catalogs and platform documents. Where two sources give different totals, both are shown.

| Fact | Value | Source |
| --- | --- | --- |
| Platform layers in the OS master map | 21 | SEMESTER_OS_MASTER_MAP |
| Modules across those layers | 449 (sum of the per-layer module counts) | SEMESTER_OS_MASTER_MAP |
| Systems | 88: 58 product systems and 30 platform control systems | SEMESTER_SYSTEM_CATALOG |
| Product systems with workflow steps assigned | 38 of 58 (together carrying all 319 steps) | SEMESTER_SYSTEM_CATALOG |
| Roles | 49 catalogued roles plus 3 system or company actors; the README quotes 51 | SEMESTER_ROLE_CATALOG; README |
| Roles with no workflow | 13 | SEMESTER_GAP_REGISTER |
| Screens in the screen catalog | 589 in 14 groups (A to N) | SEMESTER_SCREEN_CATALOG |
| Screens rendered as designed prototypes | 115 of 589 | SEMESTER_SCREEN_CATALOG |
| Screens used by at least one workflow step | 170 of 589 | SEMESTER_SCREEN_CATALOG |
| Screens no workflow uses | 419 | SEMESTER_GAP_REGISTER |
| Screens added to cover workflow gaps | 84, making 673 in total | ui_kits/master-catalog; README |
| Student destinations in the student app | 64 across seven areas; 26 fully recreated | README |
| Console screens | 122: 81 in the Operations Command Center (/ops) and 41 in the institution console | SEMESTER_CONSOLE_CATALOG |
| Integration screens | 28 | SEMESTER_INTEGRATION_CATALOG |
| Workflows | 17 | SEMESTER_WORKFLOW_CATALOG |
| Workflow steps | 319 (114 form, 56 review, 38 handoff, 29 milestone, 28 decide, 21 sync, 14 consent, 11 AI, 8 comms) | SEMESTER_WORKFLOW_CATALOG |
| Workflow step priority | 114 at P0, 27 at P1, 178 at P2 | SEMESTER_WORKFLOW_CATALOG |
| Workflow step status | 181 catalogued, 112 added by the runner, 26 designed as prototypes | SEMESTER_WORKFLOW_CATALOG |
| Steps with no catalogued screen | 84 (17 at P0, 12 at P1, 55 at P2) | SEMESTER_GAP_REGISTER |
| Traceability matrix rows | 507 across 20 of the 21 layers | SEMESTER_TRACEABILITY_MATRIX |
| Education graph | 32 node types, 17 rules every node carries | SEMESTER_EDUCATION_GRAPH |
| Data classification tiers | 7 (T0 to T6) | SEMESTER_DATA_CLASSIFICATION |
| Algorithms catalogued | 30 (6 designed with logic drafted; 10 flagged for human review) | SEMESTER_ALGORITHM_CATALOG |
| Release gates | 22 (14 reached at design level, 8 not) | SEMESTER_RELEASE_GATE_CATALOG |
| Required documents | 82 (14 exist, 68 not started) | SEMESTER_DOCUMENT_CATALOG |
| Control chain links | 14 | SEMESTER_OS_MASTER_MAP |
| Platform maturity pillars | 12, scored 0 to 5 | PLATFORM_MATURITY_MODEL |
| Readiness scorecard | 24 dimensions, average 1.25 of 5 | PLATFORM_READINESS_SCORECARD |
| Platform risks registered | 20 (5 at P0, 11 at P1, 4 at P2) | PLATFORM_RISK_REGISTER |

## Who it serves

The role catalog describes each role by its job to be done. The groups below follow the role pages kit, which sorts roles into learners, family, academic staff, campus services, institution leadership and IT, external parties and company roles. Each group has stated limits as well as powers.

**Students.** The student is the centre of the product and acts in 95 workflow steps and receives 46. They get one plan with courses, deadlines and registration readiness; a study planner that adapts to their pace; Ask Semester; campus services such as dining, housing and events; community groups and a campus-verified marketplace; career tools; and privacy controls. Key screens: Today, Action Center, Path, Plan, Registration readiness, Holds, AI Copilot, Advisor and Family sharing, Privacy settings and Data export. Sharing is the student's choice, scoped and revocable. Nine further student segments (such as online, graduate and international students) are catalogued but have no workflow yet.

**Faculty and teaching assistants.** Faculty use Course Studio to publish syllabi and guidance, set the course AI policy, build assignments and rubrics, give feedback, and enter, moderate and release grades. They act in 25 steps. Teaching assistants have scoped support and grading roles and can endorse Q&A answers. Grades stay in the LMS and SIS; Semester shows them and does not replace them.

**Advisors and student success staff.** Advisors work from a caseload that shows who needs attention, with the reason and its source. They review a student's path, record check-ins, create success plans, refer students to other offices and track the outcome, and review shares the student has consented to. Student success staff send approved outreach, review cohort aggregates and measure intervention effectiveness. Notes marked as shared are visible to the student. Read access is limited to assigned students and is logged.

**Registrars.** Registrar staff act in 25 steps: terms, catalog, sections, capacity, windows, time tickets, holds, overrides, add/drop, grade changes, degree audit, transfer credit and official exports. Their signature screen is SIS reconciliation, which shows mismatches between the SIS and Semester. Approvals show what will change before they confirm.

**Finance, aid and student accounts.** Student accounts staff handle charges and credits, payment plans, holds, refunds, dunning, disputes and the audit ledger. Financial aid staff receive handoffs. Payments go through a processor; Semester does not process them.

**Campus services.** Housing, dining, library, accessibility, counseling and campus safety staff each work their own queue and see minimum safe context. They cannot browse student records or see academic data unless the student shares it. Instructors see approved accommodations, never the reason.

**Student affairs and moderators.** Student affairs staff turn community and marketplace features on or off and manage club registration and peer-leader programs. Moderators work reports, escalations, appeals and an audit trail.

**Institution IT, security and executives.** IT configures SSO, SCIM, roles, feature cohorts and integrations, and acts in 17 steps. Security and privacy staff review data flows, scopes and incidents, and act in 7. Executives sponsor the pilot, review outcomes and decide on annual conversion or offboarding. Auditors get scoped evidence and audit history.

**Families and guardians.** Guardians see only what the student shares, until it expires or is revoked. They can view shared items, use billing and support handoffs and set communication preferences. They cannot see anything not shared or contact instructors through Semester on the student's behalf. The student sees every access in an access history.

**Career, alumni and employers.** Career staff approve postings and book appointments. Employers post internships, set applicant criteria and review only evidence the student has approved. Alumni offer mentoring, hold credentials and join the network.

**Developers and partners.** Partners apply, get a sandbox tenant, request data scopes, pass certification and app review, and reach students only after an institution enables the app. Marketplace apps never receive student records.

**Semester's own operators.** Support, implementation, customer success, revenue, finance, security, privacy, product and executive roles work in the Operations Command Center. Company roles never see student records.

## Capabilities and features

The OS master map organises the product into 21 layers. This chapter summarises each domain: what it does, its main screens and workflows, and the data it relies on. Screen counts for each group come from the screen catalog.

**Identity, tenant, policy and trust foundation.** 11 modules: identity providers, SSO, SCIM, memberships, roles, capabilities, policy hierarchy, data classification, consent policy and audit explorer. Built in the console kit. It supports the Institution implementation workflow. It relies on directory data, tenant identifiers and the audit event store.

**Student OS and productivity workspace.** The student shell has 30 modules and a productivity layer of 15: Today, Action Center, Calendar, Tasks, Goals, Path, Notes, Files, Search, group workspaces, research and writing workspaces, focus mode, study sessions and templates. The student group has 70 screens, 40 of them prototypes. Main workflow: the 40-step Student journey. Data: student-owned workspace data, private by default, plus official records read from the SIS and LMS.

**Academic path and degree planning.** 16 modules covering requirements, term planning, degree audit, graduation scenarios, transfer credit, prerequisites, holds and registration eligibility. It is the heart of the registration readiness flow and relies on education records whose source authority is the official system.

**Course Studio and learning OS.** 25 modules, including syllabus, assignments, assessments, rubrics, study packs, gradebook, regrades, course AI rules, academic integrity and course analytics. 36 screens. The workflow is the 24-step Faculty course lifecycle. Data: course content, assessments and grades, with gradebook authority held by the official system.

**Governed AI and intelligence platform.** 26 modules, including the Student Copilot, Course Tutor, Registration Guide and Advisor assistants, model and provider registries, policy engine, course AI rules, consent controls, citation and provenance, tool permissions, spend meter, evaluation harness, red-team tests, human escalation and an AI audit log. Its workflow has 17 steps. It relies on classification per request, approved sources and course policy.

**Advising, student success and support.** 16 modules, including caseload, check-ins, success plans, referrals, outreach, consented shares, interventions and aggregate insight. The advisor group has 25 screens. Data is classified as education record, sensitive, or personal with minimum context for support.

**Registrar, SIS and academic operations.** 30 modules from academic calendar and catalog to waitlists, holds, overrides, add/drop, the academic record and grade ledgers, degree audit, transfer evaluation, reconciliation and a migration center. 35 screens. The workflow has 21 steps. Authority sits with the official system.

**Student accounts, billing and financial workflows.** 16 modules, including charges, credits, payment plan, payment handoff, refund status, financial-aid handoff, cost and budget planners, emergency support and an audit ledger. 29 screens, including 12 staff screens. The Student finance and payment workflow has 16 steps. Data is classified education record, financial.

**Campus life super-app.** 16 modules, including dining, housing, events, study spaces, transit, library, safety, wellness and accessibility. 35 screens. The Campus services workflow has 15 steps.

**Community, organizations and peer connection.** 16 modules, including feed, groups, peer mentoring, alias controls, reporting, moderation, appeals and safety escalation. 29 screens, 11 of them moderation screens. It is campus-verified only and never touches student records. Its workflow has 20 steps, and its data is personal and student-controlled.

**Career, alumni, employer and lifelong learning.** 19 modules, including a skills graph, evidence portfolio, verified skills, credential wallet, resume builder, opportunities, mentors, alumni network and microcredentials. 40 screens. The workflow has 18 steps.

**Family and guardian consent platform.** 11 modules: invitation, relationship confirmation, scoped grants, time-limited access, shared items, handoffs, access history, revocation and audit. 12 screens. The workflow has 13 steps. Data is personal and consent-bound.

**Institutional administration and control plane.** 35 modules, including SSO, SCIM, access reviews, entitlements, feature policies, cohorts, kill switches, rollouts, Configuration Studio, Workflow Builder, policy hierarchy, retention, legal holds, AI provider policy, approved sources, audit explorer, offboarding and portability. 41 screens.

**Integration, migration and interoperability fabric.** 26 modules, including scope approval, Mapping Studio, sync runs, dead-letter queue and replay, reconciliation, schema drift, duplicate resolution, webhooks, LTI, OneRoster, Edu-API and SIS, LMS, Google, Microsoft and Apple adapters. 28 screens. Workflows: Controlled integration (20 steps) and Domain migration (17 steps).

**Security, privacy, accessibility, compliance and trust.** 32 modules, from the public Trust Center and subprocessor list to vulnerabilities, threat models, incidents, controls, evidence, vendor risk, break-glass review, backup and restore, privacy requests, erasure and export. 48 screens. The Incident response workflow has 17 steps.

**Operations command center.** 41 modules and 81 screens covering approvals, tenant and customer 360, pilots, renewals, billing, support, releases, feature flags, trust, security, incidents, SLOs, error budgets, audit, risks, finance and board reporting. Company roles see no student records.

**Revenue, GTM, customer success and company operations.** 30 modules for governance, legal, finance, pricing, sales, marketing, CRM, partnerships, hiring, risk and operating cadence. Built in the business workspace.

**Developer platform, marketplace and partner ecosystem.** 19 modules, including API documentation, OAuth/OIDC, webhooks, SDKs, sandbox tenants, certification, marketplace, app review, data scopes, versioning and metering. Its workflow has 16 steps. The platform document lists 14 marketplace categories, from learning tools and tutoring to AI providers and connectors.

**Analytics, outcomes, reliability and continuous improvement.** 10 modules, including pilot metrics, program and course analytics, SLOs, error budgets and release evidence. Analytics is aggregate and de-identified, with a minimum cell size and no row-level export. Its workflow has 14 steps.

**Public company and growth layer.** 9 modules (homepage, product overview, solutions by audience, pilot pages, pricing, Trust Center, mission, contact, pilot request form) across 80 site screens. It has no workflow of its own.

## How the key workflows run

The workflow catalog resolves every step through the control chain and assigns an actor, a handoff, a kind, a system, a screen, a capability, a classification, a consent requirement, a source authority and an audit event. Universal workflow states are Draft, Submitted, Validating, Waiting for information, Waiting for approval, Approved, Executing, Completed, Failed, Escalated, Cancelled and Archived. Eleven of the most important workflows follow.

**1. Registration readiness and enrollment (Student journey, steps 12 to 15, with Registrar support).**
1. The student compares courses and sections on the Section comparison screen (P0; source authority: official system).
2. The student reviews registration readiness, which combines window, account status, holds, plan, prerequisites, credit load, sections and alternatives, and hands the result to registrar staff.
3. If a hold blocks registration, the student resolves it through an official handoff on the Holds screen, not inside Semester.
4. The student enrolls or requests registration. The system checks term, hold, prerequisite, capacity, credit and policy, then enrolls, waitlists, denies or routes the request.
5. An immutable audit entry is written and the authoritative result comes back from the official system. Consequence copy is shown first, for example the waitlist position or the fact that a withdrawal records a W.

**2. Hold resolution and payment plan (Student finance and payment, 16 steps).**
1. The student reviews the account, then charges and credits, and sees the hold blocking registration.
2. The student opens the cost planner and requests a payment plan; student accounts staff review the terms.
3. The student accepts the plan and is handed to the payment processor, which confirms payment.
4. Student accounts staff reconcile the payment with the SIS, release the hold and notify the student.
5. Refund status, financial-aid handoff and emergency support requests branch from the same flow. An auditor can review the audit ledger.

**3. Governed AI request (17 steps).**
1. The student asks. The AI gateway identifies intent and establishes role, tenant and course scope.
2. It checks data classification, consent, and the course and tenant AI policy.
3. It selects a provider and model, retrieves only allowed sources, and validates the prompt and tool permissions.
4. It generates the response and shows sources and limits, with a suggested action where relevant.
5. It offers an official handoff and a human escalation, logs usage and spend, records an audit and evaluation signal, and captures feedback or correction.

**4. Sharing with an advisor or family, and revoking (Student journey steps 27 and 28; Family and guardian consent, 13 steps).**
1. The student opens family sharing, chooses information categories and sets an expiry.
2. The student sends a consent invitation; the guardian confirms the relationship and accepts the scope.
3. The guardian views only the shared items; billing and support handoffs are available.
4. The student can review the access history, narrow the scope or revoke at any time.
5. Access expires automatically and an audit trail is retained. Protected categories such as counseling, health and disability services are never shared automatically.

**5. Advisor referral and student success (Advising and student success, 17 steps).**
1. The advisor receives a caseload and reviews the student's path and action completion.
2. The advisor schedules a meeting, records a check-in and creates a success plan.
3. For a referral, the advisor refers the student to an office (counseling and wellbeing staff in the catalog) and tracks the outcome.
4. Consented shares are reviewed; risk is escalated only through an approved process.
5. Student success staff send approved outreach, review cohort aggregates and intervention effectiveness, and the case is closed or transitioned.

**6. Course publication and grade lifecycle (Faculty course lifecycle, 24 steps).**
1. The faculty member accepts a course assignment and configures the workspace.
2. They publish the syllabus, objectives, course guidance and the course AI policy, and add approved resources.
3. They create assignments, rubrics, assessments and study packs, and manage the roster.
4. They review student work with TAs, give feedback, enter grades and moderate them with the chair.
5. They release grades to students, resolve regrades and, if the institution approves, pass grades back through the registrar. The phase 1 LMS connection is read-only.

**7. Support request (12 steps).**
1. The student searches help and opens a request; a support operator captures minimum safe context, sets severity and routes it.
2. The owner accepts or reroutes, and the student receives status updates.
3. Resolution is delivered; the student confirms or closes.
4. Root cause is tagged, the product feedback loop runs, and SLA and satisfaction are recorded.

**8. Controlled integration (20 steps).**
1. Institutional IT raises an integration request and defines the business purpose and data classification.
2. Security and privacy review the request; scope is requested and the tenant approves it.
3. Credentials are configured server-side, the sandbox is validated, and a mapping is created and its version approved.
4. Read-only sync is enabled, reconciliation must pass, and monitoring is turned on.
5. A write direction needs a higher approval, a controlled write pilot, and verified rollback before production approval. Scope is reviewed periodically and the integration is retired through offboarding.

**9. Domain migration (17 steps).**
1. The team inventories the domain and source data, maps fields and classifies data.
2. Data is staged, validated, deduplicated and reconciled; a dual run, user acceptance and institution approval follow.
3. Cutover happens with enhanced monitoring and a rollback window.
4. Data is archived or exported, the legacy system retired and a post-migration review held. The rule: read-only until write is approved, with zero unexplained mismatches.

**10. Community moderation (20 steps, with marketplace).**
1. Students set profile visibility per field, choose an alias and join course or organization spaces.
2. A public post is pre-screened by the AI gateway and then published; marketplace listings pass an integrity filter.
3. A reported item is reviewed by a moderator, who removes content or warns. The student may appeal.
4. Safety concerns escalate to campus safety staff, and community health is reviewed by the product operator.

**11. Incident response (17 steps).**
1. A security operator receives an alert and triages it; an executive declares severity and names the incident commander, technical lead and communications lead.
2. Impact is assessed with the institution's security and privacy staff, and risky releases are paused.
3. Mitigation runs, internal and customer updates go out, and recovery is monitored.
4. After resolution: postmortem, corrective actions to the Operations Inbox, SLO and error budget review, and a release policy update.

## Intelligence and data

Semester's algorithms are catalogued (30 in total) and governed by one rule: explainable, policy-bounded, source-aware and purpose-limited, with no black box making a high-impact educational decision. Six are designed with logic drafted; the rest are catalogued only. Ten are flagged as high impact and requiring human review: registration readiness, degree path scenarios, support routing, advisor caseload prioritization, student-success risk signals, AI model routing, content moderation assistance, pilot conversion scoring, revenue forecast and AI cost forecasting.

**Next-action ranking.** Purpose: show the most useful next action without overwhelming the student. Inputs include official deadlines, registration windows, holds, the academic plan, tasks, goals and institution notices. Score = urgency x consequence x confidence minus an effort penalty. Urgency scales from 1 (14 or more days away) up to 10 (under 24 hours), with 12 for overdue. Consequence runs from 1 to 4 by grade weight and 5 if the item blocks registration. Confidence runs from 1.0 for official data down to 0.6 for stale data, and AI or estimated items never outrank official ones at equal urgency. The effort penalty is minutes divided by 120, capped at 1.5. At most five items are shown. Each recommendation explains why, names the source and its age, and gives a next step.

**Workload model.** Takes credits, schedule, due dates, student time estimates and assessment dates, and produces a low, balanced or heavy estimate with peak weeks, conflict warnings and suggested study blocks. It is guidance, not academic authority; students can override it and no punitive action may use the score.

**Search ranking.** Query, then permission filter, tenant and course filter, source-authority ranking, freshness ranking, context relevance and result-type diversity, ending in an explainable list. The authority order for result types is official policy, course content, student-owned content, approved learning source, campus service, support resource, career opportunity, community content, external web and AI-generated answer. Community content never outranks official policy.

**Registration readiness.** Nine conditions must hold: window known, account status known, holds checked, plan exists, prerequisites checked, credit load reviewed, sections selected, alternatives considered and an official handoff available. Outputs are Ready, Almost ready, Blocked, Needs advisor review and Information unavailable. Degree scenarios label each line as an official requirement, planning estimate, assumption, unavailable data or confirmation required.

**AI routing and governance.** A request passes through data classification, tenant provider policy, course AI policy, cost and latency, and required capability (reasoning, research, writing, code, retrieval, summarization) before an approved model or provider is chosen, with a fallback model or human handoff. The router shows which model was chosen and why, what context was shared, which sources were used, whether data was retained and the cost impact. Student records are never sent to a provider, and this is red-team tested; the red-team suite has not yet been run.

**Algorithm governance.** Every algorithm records its purpose, owner, inputs and excluded data, source authority, consent requirement, explanation, human review and appeal path, bias and fairness review, evaluation dataset, version and rollback plan. Some inputs are never used without explicit policy or consent: private messages, sensitive health data, protected characteristics, accommodation details, disciplinary records and unapproved behavioural surveillance. As a hard limit, no algorithm makes a clinical, disciplinary, emergency or financial decision; it routes to the official process.

**Data flow, classification and provenance.** Data moves from source system through connection approval, scope approval, secure ingestion, staging, validation, transformation, the canonical model, a provenance record, policy and permission filtering, a role-specific read model and the UI. Actions return through command, audit, event and outbox into projections and analytics. Seven classification tiers set handling: T0 public marketing content, T1 internal operational metadata, T2 student-owned workspace data (private by default), T3 institutional academic and personal data (FERPA, tenant-scoped), T4 sensitive support, accessibility and financial data, T5 credentials and secrets (server-only) and T6 highly restricted legal and security evidence. AI may receive T0 to T2 under policy and never T3 to T6 student records. Every node and relationship in the education graph carries 17 properties, including canonical ID, tenant ID, source authority, freshness timestamp, classification, consent requirement, retention rule and audit history. Derived data and AI outputs record their inputs and version so any value traces back to its sources.

**Source authority.** Eight categories govern how a fact is labelled and handled: official institutional (Official), instructor-published (Course), student-owned (Yours), Semester-derived (Estimated), AI-generated (AI), external source (External), community (Community) and verified credential (Verified).

## Trust, provenance and safety in the product

**Source labels.** The provenance ladder ranks sources from strongest to weakest: official, connected, made here, yours, sample and stale. Stale deliberately ranks below yours, because an unchecked copy of something that may have moved is worth less than a guess that knows it is a guess. Display-only kinds add AI-assisted, Estimated, Needs review and External. Estimates and AI are styled to be noticed, because they are what students over-trust. The product never says "official" for anything the institution did not send, and never writes "just now" for an unknown time. Freshness states are live (5 seconds or less), recent (60 seconds or less), delayed, failed and rebuilding; delayed data shows a badge and blocks destructive actions until confirmed at the source. A "Source and details" sheet gives origin, freshness, visibility, limitations and a way to report incorrect information.

**AI labelling.** Every AI answer carries the AI-assisted label, the allowed data scope, numbered sources with their own provenance chips, a confidence statement and what the model cannot know, request cost, the applicable policy, and any actions. Anything that writes, sends, shares, pays or registers opens a dialog with an action preview first. When an instructor restricts AI, the course workspace says so, a policy chip appears on every answer in that course, and disallowed actions are disabled with a reason rather than hidden. One point needs reconciling: the FAQ and brief state that the AI never sees student records, while the launch-kit hand-off says AI does not read student records until the institution switches it on per data type. The data classification document permits T0 to T2 only.

**Consequential actions.** Five patterns scale with risk. Reversible personal actions happen with an undo toast. Actions that leave Semester or are seen by someone else use a dialog with a preview covering what happens, exactly what, what stays the same and how to take it back. Academic record actions (enroll, drop, withdraw, regrade) use a two-step review and confirm that states where the request will land. Financial actions name the amount, method and processor. High-risk institutional actions (release hold, change role, break-glass) require two-person duty: request, approve by someone other than the requester, then act, with fresh MFA and the audit event written first.

**Consent and sharing.** Everything is private by default. Each ask states what, with whom, why, for how long and how to undo it, with decline given equal weight. Before a share the student previews exactly what leaves. Shares expire or are revoked from the same place they were made, and the student sees an access history of who viewed what and when. Protected categories are never shared automatically. Private notes are never shared or exported.

**Company and staff access.** Only named support and engineering staff can access student data, under the institution's DPA, and every access is logged. Sales, finance, marketing and investors never see student records. Safety reports go to the institution, not to Semester. Marketing claims are bounded: the product names controls rather than claiming "secure" or "certified", and the Trust Center presents status, not certifications. The FAQ states that SOC 2 is not held, HECVAT Full is in progress and SOC 2 is planned.

## Platform roadmap and maturity

**Maturity model.** Twelve pillars are scored 0 to 5 (0 none, 1 idea, 2 designed, 3 built but untested, 4 in production with evidence, 5 proven at scale). The stated measure of success is not more features but daily user preference, institutional trust, migration confidence, partner leverage, operational resilience, durable economics, measurable outcomes and compounding platform advantage. Each has a documented state and next action, such as running a five-student moderated test of Today or building the SIS read connector and reconciliation report.

**Readiness scorecard.** Twenty-four dimensions average 1.25 out of 5: ten dimensions score 2, ten score 1 and four score 0 (developer ecosystem, marketplace maturity, global readiness and partner ecosystem). Tenant isolation, security, reliability, integration, migration and customer success each score 1. The rule is to re-score monthly and raise a score only with evidence.

**Three-tier architecture.** The strategy borrows from three models: an experience tier (calm, clear, accessible, coherent), an education intelligence tier (graph, search, AI gateway, policy engine, provenance, analytics) and an institutional infrastructure tier (tenant control plane, RLS, SSO and SCIM, audit, integration gateway, migration and reconciliation, feature flags, billing, trust, SLOs, backup and offboarding, developer ecosystem). A deployment ladder runs from development through sandbox, internal beta, private beta tenant and pilot tenant to annual deployment and multi-campus expansion.

**36-month roadmap.** Phases gate on evidence, not dates.
- 0 to 6 months, prove the pilot: close six launch blockers; ship SSO, SIS read sync, Today, registration readiness and governed AI; run the Vanderbilt pilot with signed measures; put monitoring, runbooks and a restore drill in place.
- 6 to 12 months, convert and repeat: results report and case study, annual conversion, pilots two and three through the implementation factory, first engineer and implementation lead.
- 12 to 24 months, become the operating layer: Course Studio, advising and the registrar desk in production; the first real domain migration; SOC 2 readiness and a penetration test; a public API beta and first certified partner.
- 24 to 36 months, platform and ecosystem: a marketplace with governed installs, multi-campus and system offices, a first non-US or K-12 model, published outcome research.

The plan also lists 12 priorities for the first 90 days (starting with insurance, counsel review of the MSA, DPA and order form, the DPA and FERPA addendum, and HECVAT Full), 20 strategic moats, and an ordered list of 50 next actions running from binding insurance to publishing the case study. Pilot launch gates listed in the release gate catalog are the DPA and FERPA addendum, HECVAT Full, insurance, VPAT/ACR, SAML SSO, SIS reconciliation, RLS tests, an AI gateway red-team, a restore drill, incident contacts and success measures. Twenty platform risks are registered; the five at P0 are launching without insurance or a DPA, cross-tenant exposure, AI receiving student records, SIS data shown wrongly and solo-founder capacity.

## Known gaps

The gap register (generated 2026-10-05) lists four kinds of gap, each framed as a next action.

**Steps with no catalogued screen: 84.** By priority, 17 are P0, 12 are P1 and 55 are P2. The largest clusters are Developer platform and marketplace (10), Domain migration (9), Institution implementation (8), Support request (8), Incident response (8) and Governed AI request (7); the other eleven workflows have between 0 and 6 each. P0 examples include publishing the course AI policy, reviewing a consented share, AI tool permission validation, severity declaration, migration cutover, rollback window, accommodation approval and audit retention. The master catalog's gap-screens kit holds 84 added screens, each tied to one of these steps.

**Roles with no workflow: 13, all P2.** Prospective student, applicant, online student, adult learner, graduate student, international student, student athlete, student worker, student parent or caregiver, program director, admissions staff, library staff and mentor.

**Screens no workflow uses: 419 of 589.** They include public site pages, trust and security screens and operations screens, for example the Homepage, Cash/runway and Board/investor reports.

**Completion gates not reachable in this project: 8, all P0 for pilot scope.** Accessibility evidence, security controls, integration plan, monitoring and SLO, test coverage, rollback plan, release evidence, and owner and review date.

**Documents.** Of 82 required documents, 68 are not started. Academic and learning and Integration and migration have none of their 10 documents; Engineering and reliability has 1 of 11. Formal documents already in docs include the one-pager, FAQ, role sheets, guides, launch runbook, cutover plan, support plan and security policies, plus drafts of the terms, privacy policy, community guidelines and subprocessors.

**Other known limits.** The platform tables are written but not yet run. The student app recreates 26 of 64 destinations; the rest open an outline screen. There is no native iOS or Android app; the mobile kit is the responsive web app at phone width. Only two of the production app's 13 grounds are included. Some workflows named as required (price exception, security document request, tenant offboarding) are marked as not yet covered.

## Reader's guide

- **Product brief.** One page: what Semester is, who it serves, data handling, status and what a pilot looks like.
- **FAQ.** Product, data and AI, security and accessibility, pilots and pricing.
- **Role sheets.** What Semester does for each of eight roles.
- **User guide.** Getting started, then guidance by role.
- **Master map.** The 21 layers, the control chain and the journeys.
- **Systems.** The 88 systems with classification and source authority.
- **Roles.** The 49 roles and system actors with the steps they act in.
- **Screen catalog.** All 589 catalogued screens by group.
- **Workflow catalog.** The 17 workflows and 319 steps.
- **Consoles.** The 81 operations screens and 41 institution console screens.
- **Data and integrations.** Data domains, the education graph, integration catalog and data-flow documents.
- **Algorithms.** The 30-algorithm catalog, governance rules and five detailed documents.
- **Data provenance.** The provenance model and source authority.
- **Release gates.** The 22-point gate and pilot launch gates.
- **Gap register.** Every known gap with priority and next action.
- **Traceability matrix.** Layer to workflow to step to screen to system to capability to audit event.
- **Platform roadmap.** Maturity model, scorecard, risks and the 36-month plan.
- **Data catalogs appendix.** The document catalog and supporting catalogs.
- **Student app.** The desktop workspace with 64 destinations and Ask Semester.
- **Mobile.** The phone-width app: Today, My Path, Search, Plan, Me.
- **Staff.** Faculty, TA, advisor, registrar, finance and student affairs workspaces.
- **Console.** Overview, approvals, support queue, integrations, security operations and audit log.
- **External roles.** Applicant, guardian, alumni, employer and marketplace partner.
- **Every screen.** A renderer that shows a screen for every catalog group.
- **Gap screens.** The 84 added screens that close workflow gaps.
- **One place.** 45 jobs mapped to the Semester module that does them (30 designed, 7 to build, 8 embedded).
- **Role pages.** One page per role: home screens, onboarding, KPIs and a day in the life.
- **Role lens.** The 64 student screens through 14 roles, with access level and backend.
- **Atlas.** Each role's features, screens and functions.
- **Master catalog.** Roles, screens, workflow steps, systems and documents with status.
- **Workflow runner.** An interactive walk through the 17 workflows.
- **Platform maturity.** The interactive scorecard and roadmap.
- **Community.** Feed, groups, events, Q&A, clubs, mentorship, marketplace, messages, safety.
- **Forms.** Twelve working forms with role capabilities and API contracts.
- **Wireframes.** Low-fidelity wireframes of every screen by role.
- **Templates.** Decks, screen templates, the pilot results report and launch pieces.
- **Role onboarding.** Thirteen role flows: sign in, role home, three-step setup checklist.

## Glossary

| Term | Meaning |
| --- | --- |
| Ask Semester | The AI study helper. Always labelled AI-assisted, has no human name or face, and cites its sources. |
| AI gateway | The governed route every AI request takes: classification, consent, policy, provider selection, retrieval and audit. |
| AI-assisted | The label on anything a model drafted; shown with the glyph ✦. |
| Action preview | The pre-confirmation panel stating what happens, exactly what, what stays the same and how to take it back. |
| Capability | A permission to perform a kind of action, such as `registration.review`. |
| Caseload | The advisor's list of students needing attention, each with a reason and a source. |
| Console | The institution console where administrators manage identity, roles, integrations, rollouts, policy and audit. |
| Consent | The student's scoped, time-limited, revocable permission to share. |
| Control chain | The fourteen-link path from identity to outcome that every step is resolved through. |
| Course AI policy | The instructor's setting for what Ask Semester may help with in a course. |
| Course Studio | The faculty workspace for building and running courses. |
| Education graph | The connected model of 32 node types and their relationships; the product's claimed moat. |
| Education record | Data covered by FERPA, never sent to AI and never readable by company roles. |
| FERPA | The US student-records law under which Semester acts as a school official via a DPA. |
| Freshness | How recently a value was checked: live, recent, delayed, failed or rebuilding. |
| HECVAT | The higher education security questionnaire; Semester's Full version is in progress. |
| Hold | A block on registration or services, owned by the institution and resolved through its own process. |
| Implementation factory | The repeatable process intended to take a customer from signature to launch in weeks. |
| Made here | A source rank for items the app built from sources the student gave it, using rule-based extraction. |
| Migration factory | The governed process of inventory, mapping, reconciliation, dual run, cutover and retirement. |
| Operations Command Center | The /ops workspace with 81 screens where Semester's own staff run the company. |
| Pilot | One term with a defined group of students and staff, SIS and SSO connections and agreed success measures. |
| Provenance | The recorded origin and history of a value, including inputs for derived and AI values. |
| Reconciliation | Comparing Semester's copy with the SIS; the target is zero unexplained mismatches. |
| Registration readiness | The assessment of whether a student is clear to register; Ready, Almost ready, Blocked, Needs advisor review or Information unavailable. |
| Release gate | The 22 points an item must pass before it is called complete. |
| RLS | Row-level security, used with tenant IDs to isolate each institution's data. |
| SAML SSO | Single sign-on through the institution's identity provider. |
| SCIM | Standard for provisioning accounts and memberships from the institution's directory. |
| Source authority | Which system or party is the authoritative source for a field. |
| Source label | The visible tag on a fact showing its origin, such as Official, Connected, Yours or AI. |
| Status sentence | The product's voice unit: what is true, what that means, what you can do. |
| Student action platform | The public descriptor for Semester; "Student OS" is internal. |
| Tenant | One institution's isolated space in the platform. |
| Today | The student's home screen, showing what needs attention now and why. |
| Trust Center | The public page of security, privacy, accessibility and AI practices, stating status rather than claiming certification. |
| Two-person duty | A high-risk action needs a requester and a different approver, with fresh MFA. |
| VPAT/ACR | The accessibility conformance report; in progress. |
| Workflow | A named sequence of steps with actors, handoffs, states and audit events. |
| Action Center | The student screen for creating and completing actions and tasks. |
| Estimated | A value Semester computed, not an official record. |
| Gap register | The list of steps, roles, screens and gates not yet covered. |
| Master map | The OS map of 21 layers, journeys and the control chain. |
