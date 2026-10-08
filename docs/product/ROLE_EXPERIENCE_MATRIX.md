# Role experience matrix

Status: Phase 0 baseline, assessed 2026-10-05 at `790ebbf`, read-only. Status codes are defined in [the product map](EDUCATION_OS_PRODUCT_MAP.md). Role counts come from `docs/ROLE-LAUNCH-REGISTER.md` (rendered 2026-10-04) and `app/src/lib/rolelaunch.ts`; the capability matrix `docs/ROLE-PERMISSION-MATRIX.md` is stale (84 capabilities listed, about 96 defined in migrations).

## The headline

Of 69 roles, all are provisionable, 0 are launch-approved, 3 reach "usable" as their top rung (career_coach, scholarship_provider, marketplace_partner), 18 reach "secure", and 2 reach "supportable" (moderator, trust_safety_reviewer). Most institutional roles hold capabilities proven in SQL and have **no role-specific screen**. `docs/screenshots/README.md` (captured 2026-10-05, tabs and Soft layout, phone viewport) found all nine non-student roles render pixel-identical to each other, with no role-specific home, and 15 dead-end "not switched on" screens. Role workspaces exist only in `app/src/components/institutional/role-workspace.ts` and render only in an institutional preview build on synthetic grants.

Goal for the program: each role below gets a home that answers "what must I do today, what changed, who needs me", built on the same graph and policy engine as the student OS. [The backlog](EDUCATION_OS_BACKLOG.md) epics E3 to E9 carry the work.

## A. Student OS

Persona goal: "This is where I understand where I am, what matters next, what I can do, who can help, and how I move forward."

| Experience | Today | Status | Exposure | Target next step |
| --- | --- | --- | --- | --- |
| Home / Today | Decision surface and Action Center | NV (device) / NI | prod | Per-item freshness and dismiss reasons; connect to registration readiness |
| Path | Student-entered requirements, pathway grid, graduation estimate | NI | prod nav | Institution-sourced requirements through a degree-audit adapter (blocked: no audit source) |
| Plan | The calendar screen; Study week plan | NV reads, NI writes | prod | Preview-and-confirm audit for external writes |
| Calendar, Tasks, Notes, Files | Calendar screen; tabs of Mine | NV / NI | prod | Sync files to the server with the same classification and export rules as notes |
| Search | Client-side | NI | prod | Server-authorized index shared with AI (the `capability-registry.md` gap) |
| Courses, Study | Course hub, 11 study modes | NI | prod | Faculty-published context when Course Studio is on |
| Community, Support | Community off; support map device-held | INT off / NI | off / prod | Release gates in [RELEASE_GATES](EDUCATION_OS_RELEASE_GATES.md) |
| Career, Profile | Device-only career library; profile | NI / NV | device / prod | Server persistence of skill claims, with student confirmation |
| AI copilot | Own key or proxy; shared key gated off | NI | prod (BYO) | Route through the governed gateway; see [AI governance](AI_GOVERNANCE_AND_MODEL_ROUTING.md) |

Navigation truth: `app/src/lib/tabbar.ts` `FIVE_DESTINATIONS` = Today, My Path, Search, Plan, Me, on by default. `nav.ts` has 63 destinations plus nested screens (gradebook under courses, registration under calendar, console, moderation, volunteer, agreements, dining). "Action Center", "Tasks", "Notes", "Files" are not screens of their own.

## B. Faculty and Course Studio

| Experience | Today | Status | Exposure | Gap |
| --- | --- | --- | --- | --- |
| Course home | Student-side hub only | NS (faculty home) | n/a | A faculty course home is not built |
| Syllabus, objectives | Student imports own syllabus; no faculty publication; no outcome map | NI / NS | prod | Faculty-published syllabus with outcomes |
| Resources, study packs, guidance, AI rules | `app/src/components/CourseStudio.tsx`: rules, guidance, packs, history, preview | NV in slice | off (`course_studio`) | Packs are link lists; course-scoped source approval not found in the migration |
| Assignments | Student planner only | NI | prod | No native assignment authoring or submission |
| Discussions | none | NS | n/a | |
| Gradebook, regrade | Instructor book, student view, moderation by a second person, release, export | NV in DB | off (`writeback.lms_grade_passback`) | No `LmsAdapter`; no anonymous or group grading; no student-view preview |
| Feedback | Instructor comments in gradebook entries | NI | off | No source-linked feedback outside gradebook |
| Office hours | Student-side only | NI | prod | No scheduling, no instructor side |
| Integrity and accessibility tools | Student declaration; policy panel | NI | prod | No instructor review queue, similarity integration, or accessibility checker |
| Faculty AI assistant | Absent | NS | n/a | |
| Learning insight | Prohibitions only | NS | n/a | Define measures first (see outcomes in [RELEASE_GATES](EDUCATION_OS_RELEASE_GATES.md)) |

Roles: `faculty`, `teaching_assistant`, `tutor`, `learning_center_staff` reach "secure". Capability `course:publish` at course scope is proven by `supabase/coursestudio.check.sql`.

## C. Advisor and student success

| Experience | Today | Status | Exposure | Gap |
| --- | --- | --- | --- | --- |
| Caseload, success plans, outreach | Sandbox demo only (`app/server/institution/advising.ts`) | PL | n/a | No case model anywhere |
| Student path view for the advisor | Student-initiated share, read-only, 120-day expiry, reads logged | NV in DB | off (`advisor_meeting_mode`) | No reply; shared agenda lacks sources and freshness |
| Check-ins, referrals | Help-request inbox (`components/HelpInbox.tsx`) | NV | off (`humanHelp`) | |
| Outcome insight | `outcome_aggregates`, n>=10 | NI | off | No signal model; `FORBIDDEN` list in `app/src/lib/institution-ops.ts` bars risk scores and wellbeing metrics |
| Privacy-scoped sharing | `advisor_shares`, `consent_record` | NV | off | Email as join key (identity gap) |

`academic_advisor` is "secure", not launch-approved. Warning: `supabase/advisor-probe.sql` and `advisor-reconciliation.check.sql` concern the Supabase linter (D-1026), not academic advisors; they are not evidence here.

## D. Registrar and academic operations

| Experience | Today | Status | Exposure | Gap |
| --- | --- | --- | --- | --- |
| Terms, sections | `registration_terms`, `registration_sections` | NV in DB | off | No SIS feed |
| Catalog authoring | none; sync only | NS | n/a | |
| Registration, waitlist, add and drop | `app/src/components/enrollment/RegistrarDesk.tsx`, `StudentRegistration.tsx` | NV in DB, `+APP +MIG` | off (`writeback.registration_submit`) | SIS adapter not built; no seat inventory of record |
| Holds, overrides | SIS-sourced holds; `registration_overrides` | INT / NV | db | |
| Academic record, grade changes | `RecordLedger.tsx`: propose and approve by different people, `record:override` | NV in DB, `+APP +MIG` | off (`recordLedger`) | No student screen reads it; no importer; no transcript |
| Regrades | See faculty | NV in DB | off | |
| Degree progression, graduation | Student estimates | NS (audit) | off | No audit engine or rules of record |
| Transfer evaluation | `articulation_rules` | NI (DB only) | db | No screen |
| Audit reports | Hash-chained ledger | NV | db | |

Role `registrar` is "secure". The Domain register's "sandbox only" for registration is wrong; see the correction table in [the thesis](SEMESTER_UNIFIED_EDUCATION_OS_THESIS.md).

## E. Campus services

| Service | Today | Status | Exposure | Gap |
| --- | --- | --- | --- | --- |
| Dining | Real store; student order UI (`components/dining/Counter.tsx`) | NV in DB, **UA** | off | No card-office connection; no staff screen in navigation |
| Housing | Sandbox only; student-entered facts | PL | n/a | No housing table |
| Events, organizations | Imported files; org tables | INT / NI | prod / db | No organization events table; no membership-decision screen |
| Community | Large real store, 100 of 150 register rows tested | NV, off | off | Best-evidenced area; high-risk flags can never be `production` |
| Study spaces | Availability mapping; booking refused by design | INT | db | `writeback.space_booking` not built |
| Campus employment | none | NS | n/a | |
| Support offices | `help_destinations` | NV | off | Not school-verified |
| Accessibility services | Passport tables only | NI (DB), `+REV` | db | No screen; ACC-008 single workspace not started |
| Safety handoffs | Crisis wording first; "not an emergency service" | NV | prod | US-only numbers |

Moderators (`moderator`, `trust_safety_reviewer`) are the only "supportable" roles. Residence life, counseling liaison, career center and similar roles are provisionable with publish capabilities and have no role screens.

## F. Family and guardian

| Experience | Today | Status | Exposure | Gap |
| --- | --- | --- | --- | --- |
| Consented invitations, scoped sharing, revocation | Share codes, shared items, access events; `app/src/screens/Family.tsx`, `FamilyInvite.tsx`, `SharedWithYou.tsx` | NV (suites) | needs a cloud account | `institution_id` is free text, no FK to `schools` |
| Audit history | `family_access_events` | NV | db | |
| Resource and support handoff | `SharedWithYou` supporter reads copies the student confirmed | NI | needs cloud account | |
| K-12 guardian link | `guardian_links`, `guardian_may_read`, restrictions withheld from export | NI, **UA** | db | Counsel questions P-04 and P-06 open; no staff screen records guardians |
| Parent portal | none | NS | n/a | Intentionally absent: no broad academic surveillance |

Minimum age 13 and minors off discovery, matching and employer visibility to 18 are database-enforced (`supabase/minimum-age.check.sql`).

## G. Career, alumni, employers

| Experience | Today | Status | Exposure | Gap |
| --- | --- | --- | --- | --- |
| Skills graph | Device-derived suggestions | NI | preview | Student confirms; not server-written |
| Verified evidence | `skill_records` + `skill:verify` | NI (DB) | db | No screen writes verification requests |
| Portfolio | Device-local career evidence; wallet export | NV local / NI | device | Labelled not official |
| Opportunities | Listing desk | NI | prod | |
| Mentors | Two-sided consent rosters, `MentorFinder.tsx` | NV | prod | |
| Employers | `talent_profiles`, `talent:search` | NI (DB) | db | No employer UI; role `employer` is "secure" |
| Alumni, lifelong credentials | none | PL / NS | n/a | No issuer, revocation, Open Badges or CASE |

## H. Institutional control plane

| Surface | Today | Status | Exposure | Gap |
| --- | --- | --- | --- | --- |
| Policy simulator and Control + Trust tab | Display only; inputs hard-code `activeConsentCount: 0`, `auditEventCount: 0`; no `onApply` | DO | preview | Applies nothing |
| Modules (Connect or Core per module) | `ModulesPanel.tsx`, `supabase/module_mode.check.sql`: two approvers, immediate way back, freezes not deletes | NV in DB | needs `tenant:configure` | Core mode is a boundary, not a deployment claim |
| Integrations | `IntegrationDashboard.tsx`; kill switches, dead letters, replay requests | INT (mock only) | preview | No real connector; no inbound endpoint |
| Configuration Studio | 11 domains, second-person publish | NI | preview | Nothing reads the settings |
| Workflow Builder | Spec, deterministic engine, templates | NI | preview | No student instance; no consumer |
| Migration Center | 12 stages with DB-trigger gates, parallel-run gate | NV (gating) | preview | Never run with an institution; imports into no domain |
| AI provider policy | `ai_policy`, `approved_source`, `consent_record` | NV in DB | db | No admin UI uses `ai:configure`; consent never read on the AI path |
| Approvals and break-glass | Semester operator console, not a university's own | NV | gated | A university admin has no approvals queue beyond module mode, config and workflow publish, offboarding |
| Rollouts | `tenant_rollout` | NI | operator-only | Not an enforcement gate |
| Trust room, compliance | Semester procurement room; University `TrustDashboard.tsx` is a computed list | NV / NI | gated | |
| Offboarding | `school_offboarding` cases, 98 checks | NV in DB, "built, not used" | db | No export file generator, no purge, no screen, no school offboarded |
| SSO and SCIM | SAML binding; SCIM gateway | NI | off | No OIDC; roles assigned only by console role-grant duty |
| Student accounts | `MyStudentAccount` on Bill | NV in DB, **UA** | off | Nine unmet preconditions |

## I. Semester company operations

| Function | Today | Status | Gap |
| --- | --- | --- | --- |
| Console shell, approvals, break-glass | Eight views, two-person approvals, hash-chained audit | NV | |
| GTM, pilots | Rules in `app/src/lib/gtm/`; `gtm_accounts` | NI | No CRM of record, pipeline report or forecast |
| Billing | Individual Plus monthly accepted live 2026-10-03; checkout held | NI / **UA** to broaden | Annual, refund, failure, dispute, tax unexercised; institutional billing NS |
| Customer success, renewals | Schema and nightly job | NI | No accounts |
| Trust, compliance | Trust room; `docs/trust/` | NI | No SOC 2 report, pen test or HECVAT |
| Support | Tickets, reply notify | NI / NS | Single responder; site says "no 24/7 rota yet" |
| Security, release ops | Release profiles, SLO targets | NI / DO | Targets only; DAST and external assessment outstanding |
| Finance visibility | `docs/finance/` model | DO | Hypotheses; not wired to the console |
| Workforce and capacity | `docs/operations/coo/`, `docs/finance/12` | DO | One person holds nearly every company seat (FR-006) |

The console ships eight views; Revenue Ops, Finance, Marketing, People, Legal and Executive modules specified in `docs/operations/company-operations-console.md` and `docs/product/operations-console-ux-architecture.md` are not built.
