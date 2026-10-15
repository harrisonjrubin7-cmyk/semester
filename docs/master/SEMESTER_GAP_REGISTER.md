# Gap register — from repo evidence

**As of** 2026-10-05 · **Base** origin/main `2d8dda1` · **Source** [`REPO_AUDIT.md`](REPO_AUDIT.md) · **Replaces** the design project's design-level `SEMESTER_GAP_REGISTER.md` (not copied here; repo beats design)

> **Claim ceiling.** A gap here is a difference between the design catalog and what the code does today. Priorities (P0–P3) are the catalog's own and are inputs, not decisions; the founder sets the pilot cut. "Stream" is the handoff stream that owns the work (`handoff/execute/NN-*.md`); streams 04, 07, 08, 11–13 follow the pilot.

Workflow steps not fully built: **203** of 319 (P0 68, P1 22, P2 113). Screens missing outright: **57** of 589.

## Workflow steps with nothing built (75)

| Workflow | # | Step | Actor | Priority | Stream | What was searched |
| --- | --- | --- | --- | --- | --- | --- |
| Campus services | 8 | Submit housing maintenance request | Student | P0 | 03 | Searched maintenance request, work order, repair in screens/Housing.tsx, server/institution/housing.ts, supabase: none (contracts only) |
| Campus services | 13 | Accommodation approved | Accessibility/disability services | P0 | 03 | Searched accommodation approval/status: by design never stored (support.ts says so); no decision flow |
| Faculty course lifecycle | 1 | Accept course assignment | Faculty/instructor | P0 | 04 | grep course assignment, department chair, teaching assignment in app/src, supabase/migrations: none |
| Faculty course lifecycle | 9 | Create rubric | Faculty/instructor | P0 | 04 | grep rubric in app/src, gradebook migration: only grading scheme, no rubric builder |
| Faculty course lifecycle | 10 | Create assessment | Faculty/instructor | P0 | 04 | lib/itembank.ts is pure rules wired to no screen; no assessment builder UI |
| Faculty course lifecycle | 13 | Review student work | Faculty/instructor | P0 | 04 | grep submissions, student work review in app/src: none; gradebook shows scores only |
| Faculty course lifecycle | 19 | Hold office hours | Faculty/instructor | P0 | 04 | grep office hours hold/schedule by instructor: OfficeHours.tsx only displays hours to students |
| Advising & student success | 1 | Receive caseload | Academic advisor | P0 | 04 | grep caseload, student_success, service_case in app/src, app/server, supabase: none; sandbox advising only |
| Advising & student success | 5 | Record check-in | Academic advisor | P0 | 04 | grep check-in, advisor notes in app/src, supabase: none (replaceregister notes no notes system) |
| Advising & student success | 6 | Create success plan | Academic advisor | P0 | 04 | grep success plan, student_success in app/src, app/server, supabase: none |
| Advising & student success | 8 | Track referral outcome | Academic advisor | P0 | 04 | grep referral outcome tracking: none |
| Advising & student success | 12 | Escalate risk through approved process | Academic advisor | P0 | 04 | grep escalate risk, risk signals, risk_score: institution-ops lists risk scores as never built |
| Advising & student success | 14 | Conduct term review | Academic advisor | P0 | 04 | grep term review, student_success in app/src: none |
| Advising & student success | 16 | Review intervention effectiveness | Student success staff | P0 | 04 | doc only: intervention metric defined in app/src/lib/institution-ops.ts; no tracker UI or data |
| Advising & student success | 17 | Close or transition case | Academic advisor | P0 | 04 | grep close case, case transition, student_success: none |
| Student finance & payment | 12 | Notify student of hold release | Student accounts staff | P0 | 04 | Searched hold release notify, notification in lib/finance, StudentAccounts, supabase/functions: none |
| Institution implementation | 14 | Admin training | Semester implementation lead | P0 | 05 | doc only: docs/institutional-implementation/TRAINING-PLAN-AND-ACADEMY.md; searched training, academy in app/src |
| Career, employer & alumni | 4 | Faculty verifies skill | Faculty/instructor | P0 | 07 | Searched verifiedBy/instructor verification flow; claims are labelled never institution verified |
| Career, employer & alumni | 8 | Career staff approves posting | Career staff | P0 | 07 | No career-staff posting approval action; career.ts employer state is sandbox data only |
| Career, employer & alumni | 10 | Employer reviews approved evidence | Employer | P0 | 07 | Searched employer review of approved evidence/skill evidence sharing; no employer-facing view |
| Developer platform & marketplace | 6 | Scopes approved | Institutional security/privacy | P0 | 07 | No scope approval flow for external apps; console Approvals are internal operator actions |
| Developer platform & marketplace | 13 | Institution enables app | Institutional security/privacy | P0 | 07 | Searched institution enable app/app allowlist; ModulesPanel toggles modules, not third-party apps |
| Analytics, outcomes & reliability | 9 | Course analytics shared with faculty | Semester customer-success manager | P0 | 08 | Searched course analytics sharing to faculty; no consented analytics share path (gradebook is grading only) |
| Incident response | 3 | Severity declared | Semester executive | P0 | 09 | Searched severity declare in console, supabase; SEV scale only in lib/incident-recovery.ts data; no declare action |
| Domain migration | 16 | Legacy retirement | Institutional IT | P1 | 05 | Searched legacy retirement/decommission in MigrationCenter, lib/migration, supabase: monitoring is terminal stage |
| Incident response | 2 | Triage | Semester security operator | P1 | 09 | Searched triage, incident intake in app/src, supabase/migrations, server: no triage step |
| Incident response | 4 | Incident commander | Semester executive | P1 | 09 | Searched incident commander/assign in console, supabase, server: none; Incidents capability absent |
| Incident response | 5 | Technical lead | Semester security operator | P1 | 09 | Searched technical lead assignment in console, supabase, app/src: none |
| Incident response | 6 | Communications lead | Semester customer-success manager | P1 | 09 | Searched communications lead assignment: none; only playbook text in lib/ops/incidentplaybooks.ts |
| Incident response | 7 | Impact assessed | Semester security operator | P1 | 09 | Searched impact assessment workflow: lib/governance/pia.ts is static data, no operator UI or table |
| Incident response | 14 | Postmortem | Semester executive | P1 | 09 | Searched postmortem/post-incident review: only a type in lib/incident-recovery.ts; doc only: docs/INCIDENT-RECOVERY-PLAYBOOK.md |
| Campus services | 9 | Housing staff accepts request | Housing staff | P2 | 03 | Searched housing staff queue/accept for maintenance in app/src, server, supabase: none |
| Campus services | 10 | Request resolved | Housing staff | P2 | 03 | Searched housing request resolved/notify in app/src, server: none |
| Faculty course lifecycle | 4 | Publish learning objectives | Faculty/instructor | P2 | 04 | grep learning objective(s) in app/src: no authoring or publishing |
| Faculty course lifecycle | 12 | Manage roster | Faculty/instructor | P2 | 04 | roster_stage migration has no app reader; gradebook roster not client readable; no roster UI |
| Faculty course lifecycle | 21 | Review aggregate learning signals | Faculty/instructor | P2 | 04 | grep aggregate learning signals, analytics for faculty in app/src: none |
| Faculty course lifecycle | 22 | Review course accessibility | Faculty/instructor | P2 | 04 | grep course accessibility review in app/src: none for courses |
| Advising & student success | 4 | Schedule meeting | Academic advisor | P2 | 04 | Sandbox advising.ts only lets student book/cancel; no advisor scheduling path |
| Advising & student success | 7 | Refer to office | Academic advisor | P2 | 04 | grep refer to office, referral workflow: only growth referrals and student help requests |
| Registrar & academic operations | 21 | Close-of-term audit | Registrar staff | P2 | 04 | no close-of-term audit; searched: close.?of.?term, term close, registrar audit, RegistrarDesk, CloseTerm (student-side only) |
| Institution implementation | 2 | Tenant created | Semester implementation lead | P2 | 05 | no create-tenant function/UI; searched schools, create school, tenant provision (schools written by service role/migration only) |
| Institution implementation | 20 | Midpoint review | Institutional executive | P2 | 05 | no midpoint review; searched midpoint, mid-point, pilot review in app/src (no code) |
| Community & moderation | 1 | Set profile visibility per field | Student | P2 | 07 | Searched visibility/per-field in Privacy, Profile, Classmates, Directory screens; only a single handle is shared |
| Community & moderation | 9 | Answer endorsed by TA | Teaching assistant | P2 | 07 | Searched endorse/teaching assistant/TA in community and screens; questions.ts verifies by office only, no TA role |
| Community & moderation | 10 | Create marketplace listing | Student | P2 | 07 | Searched marketplace in app/src, supabase; governance.ts defers marketplace to later tier |
| Community & moderation | 11 | Integrity filter checks listing | AI gateway (system) | P2 | 07 | No listings exist, so no integrity filter; searched marketplace/listing in community and migrations |
| Community & moderation | 12 | Make offer in chat | Student | P2 | 07 | No marketplace chat/offers; searched marketplace, offer in community and screens |
| Community & moderation | 13 | Arrange safe meet-up | Student | P2 | 07 | No meet-up flow for listings; community sessions are study sessions only, no safe-meetup logic |
| Career, employer & alumni | 3 | Request skill verification | Student | P2 | 07 | Searched request verification/faculty verify in skills-graph, career-evidence, Career; no request to instructor |
| Career, employer & alumni | 7 | Employer posts internship | Employer | P2 | 07 | Searched employer post/listing creation; gateway career.ts has no post action, only shortlist/offer/pass/close on sandbox listings |
| Career, employer & alumni | 12 | Interview scheduled | Employer | P2 | 07 | Searched interview schedule/employer actor; only student interview-prep drafts in Career.tsx |
| Career, employer & alumni | 14 | Career outcome captured | Career staff | P2 | 07 | Searched career outcome capture by staff in app/src, server, migrations; none |
| Career, employer & alumni | 15 | Transition to alumni | Student | P2 | 07 | Searched alumni transition/graduate to alumni in app/src, server, migrations; only register text |
| Career, employer & alumni | 18 | Continuing education enrolment | Student | P2 | 07 | Searched continuing education/enrolment in app/src, server, migrations; unrelated hits only |
| Family & guardian consent | 8 | Billing/support handoff | Family/guardian | P2 | 07 | Searched billing/support handoff from guardian in Family, Support, Bill screens and migrations; none |
| Developer platform & marketplace | 1 | Partner applies | Developer/partner | P2 | 07 | Searched partner/developer application/portal in app, server, packages, company-site; none |
| Developer platform & marketplace | 2 | Partner agreement signed | Semester product operator | P2 | 07 | No partner agreement flow; searched agreement in developer/partner context (escalation agreements are for campuses) |
| Developer platform & marketplace | 3 | Sandbox tenant created | Semester product operator | P2 | 07 | No sandbox tenant provisioning for partners; app/server/institution/sandbox.ts is an in-memory demo store |
| Developer platform & marketplace | 4 | Request data scopes | Developer/partner | P2 | 07 | Searched scope request/approval for third-party apps; platform approval.ts is internal, no developer UI |
| Developer platform & marketplace | 5 | Security review of app | Semester product operator | P2 | 07 | No app security-review workflow; searched security review in app/src, server, migrations |
| Developer platform & marketplace | 7 | Register OAuth client | Developer/partner | P2 | 07 | Searched register OAuth client/client_id issuance; lib/integration/oauth.ts is outbound to providers only |
| Developer platform & marketplace | 8 | Configure webhooks | Developer/partner | P2 | 07 | Searched developer webhook config; webhook-ingress.ts is inbound only; docs/API-PLATFORM.md says specified only |
| Developer platform & marketplace | 11 | App review | Semester product operator | P2 | 07 | Searched app review/marketplace app review; none |
| Developer platform & marketplace | 12 | Listed in marketplace | Semester product operator | P2 | 07 | Searched marketplace listing; none beyond governance.ts deferral |
| Developer platform & marketplace | 14 | Metering and billing | Semester finance operator | P2 | 07 | Searched metering/usage billing for platform; billing functions are student subscription only |
| Developer platform & marketplace | 16 | App retired | Developer/partner | P2 | 07 | Searched app retire/unpublish; no developer app lifecycle exists |
| Support request | 10 | Root cause tagged | Semester support operator | P2 | 08 | Searched root_cause, rootcause, root cause tag in app/src, supabase/migrations: none |
| Analytics, outcomes & reliability | 2 | Measures sheet signed | Institutional executive | P2 | 08 | Searched measures sheet/signature in app, migrations; none |
| Analytics, outcomes & reliability | 7 | Error budget checked | Semester product operator | P2 | 08 | Searched error budget in app, server, packages; only a journey-slo definition in lib/ops/firstyear.ts |
| Analytics, outcomes & reliability | 8 | Pilot midpoint report | Semester customer-success manager | P2 | 08 | Searched pilot midpoint/report in screens, lib, migrations; none |
| Analytics, outcomes & reliability | 11 | Pilot results report | Semester customer-success manager | P2 | 08 | Searched pilot results report generation; none |
| Analytics, outcomes & reliability | 12 | Improvement backlog prioritized | Semester product operator | P2 | 08 | Searched improvement backlog prioritisation tool; none in app |
| Analytics, outcomes & reliability | 14 | Quarterly operating review | Semester executive | P2 | 08 | Searched quarterly/operating review reports for board; none |
| Incident response | 10 | Internal update | Semester customer-success manager | P2 | 09 | Searched internal incident update/broadcast in app/src, supabase, server: none |
| Incident response | 15 | Corrective actions to Inbox | Semester security operator | P2 | 09 | Searched corrective action, operations inbox in app/src, supabase: none; doc only: docs/ops/CQRS_READ_MODEL_ARCHITECTURE.md |

## P0 and P1 steps that are only partly built (59)

| Workflow | # | Step | Priority | Stream | What is absent |
| --- | --- | --- | --- | --- | --- |
| Student journey | 14 | Resolve hold through official handoff | P0 | 03 | Hold notice names office and link; no in-app handoff or tracking |
| Student journey | 21 | Search approved sources | P0 | 03 | Instructor packs feed study guides and do-not-use guard; no search over approved sources |
| Student journey | 39 | Request deletion/correction | P0 | 03 | Self-serve account deletion; no correction request or privacy-office handoff |
| Faculty course lifecycle | 8 | Create assignment | P0 | 04 | gradebook_add_item creates graded item; no assignment instructions/dates |
| Faculty course lifecycle | 14 | Provide feedback | P0 | 04 | Per-grade comment on score entry only; no feedback workspace/TA |
| Faculty course lifecycle | 24 | Grade passback (if approved) | P0 | 04 | queuePassback in UI; runPassback adapter not invoked outside tests |
| Advising & student success | 9 | Send approved outreach | P0 | 04 | Office drafts, reviews, approves actions published to Action Center; not per-student outreach |
| Advising & student success | 15 | Prepare registration readiness outreach | P0 | 04 | Office actions and campaigns can reach cohorts; no registration-readiness outreach page |
| Registrar & academic operations | 3 | Import/manage catalog | P0 | 04 | Sections added one at a time; Migration Center validates catalog sample but never loads a catalog; no bulk import |
| Registrar & academic operations | 6 | Define prerequisites/co-requisites | P0 | 04 | Prerequisite course codes per section; no co-requisite rule anywhere |
| Registrar & academic operations | 8 | Issue time tickets | P0 | 04 | registration_time_tickets is student-writable own copy; registrar cannot issue/stagger tickets; server enforces opening only |
| Registrar & academic operations | 9 | Sync holds | P0 | 04 | registration_holds table server-only; hold adapter framework exists but ADAPTERS empty and no registrar sync action |
| Registrar & academic operations | 12 | Approve/deny exception | P0 | 04 | Approve/deny exists for enrollment requests only; no data-quality exception queue (integration conflicts are read-only) |
| Registrar & academic operations | 13 | Manage add/drop/withdrawal | P0 | 04 | Registrar sets windows and grants late-add override; student drops/withdraws; no registrar-initiated drop on behalf |
| Registrar & academic operations | 17 | Run degree audit | P0 | 04 | Student-side degree/graduation arithmetic only; registrar cannot run an audit (Degree.tsx says it is not the registrar audit) |
| Registrar & academic operations | 18 | Evaluate transfer credit | P0 | 04 | transfer_credit kind recorded via ledger (source transfer_evaluation); no evaluation workflow or transfer-student view |
| Registrar & academic operations | 19 | Review graduation | P0 | 04 | Conferral recorded in ledger with override; no graduation review/checklist workflow for registrar or advisor |
| Registrar & academic operations | 20 | Export official records | P0 | 04 | Per-student ledger CSV export as-of date; no bulk official export and no transcript issuance (ledger.ts says not done) |
| Student finance & payment | 7 | Accept payment plan | P0 | 04 | Student requests schedule, staff agree/decline; no separate student acceptance of agreed terms |
| Student finance & payment | 11 | Release hold | P0 | 04 | Financial hold is derived from overdue/plan state and lifts on payment; no explicit release action |
| Student finance & payment | 13 | Request refund status | P0 | 04 | Student sees refund/credit ledger entries; no refund-status request handoff to staff |
| Student finance & payment | 14 | Financial-aid handoff | P0 | 04 | financial_aid is directory-only (office link and hours); no handoff stored or sent |
| Institution implementation | 5 | Security/privacy scope confirmed | P0 | 05 | integration_approve_scope RPC only (university_admin); no privacy-scope confirmation screen or Privacy requests tie-in |
| Institution implementation | 11 | Data mapping approved | P0 | 05 | Migration field-map + cutover approvals by data_owner/registrar/IT; integration mapping approval not persisted |
| Institution implementation | 22 | Annual conversion or offboarding | P0 | 05 | Offboarding RPC procedure (propose..archive) exists, no UI; annual conversion only renewal tables, no flow |
| Controlled integration | 4 | Security/privacy review | P0 | 05 | integration_approve_connection (owner cannot self-approve) RPC; no security/privacy review workflow or consent record |
| Controlled integration | 10 | Mapping version approved | P0 | 05 | propose/approve/goLive logic is pure lib not wired; table has active flag, no approver column |
| Controlled integration | 15 | Higher approval required | P0 | 05 | integration_approve_connection takes any approver; no tiered/higher approval for write directions |
| Controlled integration | 18 | Production approval | P0 | 05 | Connection approved_by/approved_at only; no sandbox-to-production approval gate |
| Controlled integration | 20 | Retirement/offboarding | P0 | 05 | School offboarding disconnects connections + tombstone fn; no per-connection retire UI or consent step |
| Domain migration | 1 | Domain inventory | P0 | 05 | Migration projects are per-domain (11 domains); no cross-domain inventory of domains to migrate |
| Domain migration | 14 | Rollback window | P0 | 05 | Rollback plan text and back-navigation only until cutover; no timed rollback window |
| Governed AI request | 2 | Intent identified | P0 | 06 | Client readMode/category picks mode; no gateway-side intent classification |
| Governed AI request | 5 | Consent checked | P0 | 06 | Client sends consentIds: []; no per-request consent-grant check in gateway respond() |
| Community & moderation | 6 | AI pre-screen public post | P0 | 07 | Regex rule detectors on device and DB, not an AI gateway pre-screen |
| Career, employer & alumni | 13 | Offer recorded | P0 | 07 | Employer offer and student accept/decline in gateway sandbox only; not an academic record entry |
| Family & guardian consent | 6 | Guardian accepts scope | P0 | 07 | Guardian accepts via code (claim_family_invite); scope is fixed by student, not shown for acceptance |
| Family & guardian consent | 10 | Student narrows scope | P0 | 07 | Student can stop sharing (all items for a person); no per-category narrowing of a live grant |
| Family & guardian consent | 13 | Audit retained | P0 | 07 | Read log table retained and student-visible; no operator retention/review surface |
| Developer platform & marketplace | 9 | Build against SDK | P0 | 07 | Internal SDK client exists and is tested; no published developer SDK or portal |
| Support request | 11 | Product/KB feedback loop | P0 | 08 | Student moment feedback + what-changed log; no product-operator review/KB loop screen |
| Analytics, outcomes & reliability | 1 | Define success measures with sponsor | P0 | 08 | gtm_pilots holds sponsor/baseline/metrics in DB; no sponsor-facing UI for defining measures |
| Analytics, outcomes & reliability | 13 | Release evidence recorded | P0 | 08 | Evidence register view with expiry states; entries are static data, not recorded per release |
| Incident response | 8 | Risky releases paused | P0 | 09 | Per-connection pause and approvals duty for release/rollback; no release-level pause action |
| Faculty course lifecycle | 23 | Export/archive | P1 | 04 | Released-grades CSV export; no course archive or registrar handoff |
| Registrar & academic operations | 14 | Reconcile with SIS | P1 | 04 | Reconcile logic + run/discrepancy tables + read-only conflicts view; no live SIS adapter or registrar reconcile action |
| Student finance & payment | 10 | Reconcile payment with SIS | P1 | 04 | Reconciles ledger with payment-provider settlement file and monthly close; not against SIS |
| Institution implementation | 6 | Data/integration inventory | P1 | 05 | Migration Center source-inventory stage + Integration dashboard system map; no tenant-wide data inventory screen |
| Institution implementation | 12 | Sandbox sync tested | P1 | 05 | Sandbox adapters and contract harness exist; no per-tenant sandbox sync run/record; ADAPTERS empty |
| Controlled integration | 7 | Credential configured server-side | P1 | 05 | credentials_reference pointer + lease broker; no credential entry/rotation UI or live vault backend |
| Controlled integration | 8 | Sandbox validated | P1 | 05 | Contract harness/preflight gate adapters; no per-connection sandbox validation record |
| Controlled integration | 11 | Read-only sync enabled | P1 | 05 | read direction + approval + scheduler exist; ADAPTERS registry empty so no connection actually syncs |
| Controlled integration | 13 | Monitoring enabled | P1 | 05 | Health/freshness/breach logic + dashboard + pause/resume; no alert routing to support operator |
| Domain migration | 2 | Source data inventory | P1 | 05 | Inventory stage records system, version, data owner only; no table/field-level source inventory |
| Domain migration | 5 | Import staging | P1 | 05 | Sample import run records counts and SHA-256 in browser; no rows actually staged/imported |
| Domain migration | 15 | Archive/export | P1 | 05 | Archive stage records archive/export location only; no export generation or auditor handoff |
| Incident response | 1 | Alert or report | P1 | 09 | Command center shows live exception queue; no incident intake/report record |
| Incident response | 9 | Mitigation executed | P1 | 09 | Break-glass grant tied to incident ticket and connection pause exist; no mitigation runner/log |
| Incident response | 12 | Recovery monitored | P1 | 09 | Hourly smoke checks drawn as 90-day bars; no recovery tracking per incident |

## Screens with nothing built (57)

| Key | Screen | Stream | What was searched |
| --- | --- | --- | --- |
| A-035 | Calendar booking | 11 | Searched booking/Calendly/schedule a demo/Book a in company-site, app/src/site; only "Book an executive briefing" link to contact |
| C-004 | Course setup | 04 | Searched course setup/create course/EditCourse in app/src, supabase; only student EditCourse and gradebook scheme exist |
| C-005 | Syllabus | 04 | Searched syllabus authoring in CourseStudio, lib, supabase; only an optional syllabus URL on AI rules; student-side syllabus import only |
| C-006 | Learning objectives | 04 | Searched learning objective/outcome authoring in app/src, supabase; masterregister LMS-015 says no authoring |
| C-007 | Course schedule | 04 | Searched course schedule publish/faculty schedule in app/src, supabase; only student calendar and import exist |
| C-008 | Course announcements | 04 | Searched announcement/announce in app/src, supabase; 'announce' screen is student tool; no faculty course announcements |
| C-024 | Student progress view | 04 | Searched student progress/roster view in app/src, supabase; deliberately refused per FACULTY-COURSE-STUDIO-DESIGN F5 and institution-ops |
| C-030 | TA management | 04 | Searched TA management/ta_assign/teaching_assistant; only preview persona in RoleWorkspace and role_grants, no TA UI |
| C-031 | Course accessibility review | 04 | Searched accessibility review in app/src, supabase; only per-item review inside unwired itembank.ts |
| C-032 | Academic-integrity workflow | 04 | Searched academic integrity/integrity case; institution-ops FORBIDDEN refuses integrity accusations; no workflow |
| C-034 | Course archive | 04 | Searched course archive/conclude/restore in app/src, supabase; only student term rollover (lib/rollover.ts) |
| D-002 | Caseload | 04 | Searched caseload/advisee list in app/src, supabase; none; product says it does not flag or rank students |
| D-003 | Student profile | 04 | Searched advisor student profile in app/src, supabase; advisor sees only the consented share snapshot |
| D-008 | Check-ins | 04 | Searched advisor check-in/check-ins in app/src, supabase; only community mentorship and student self check-ins |
| D-011 | Success plan | 04 | Searched success plan/student success plan in app/src, supabase; only commercial customer-success hits |
| D-016 | Risk and priority signals | 04 | Searched risk score/at-risk signals; refused by design: institution-ops FORBIDDEN risk_score; atrisk.ts is student's own absences |
| D-019 | Cohort dashboard | 04 | Searched cohort dashboard/cohort view in app/src, supabase; only aggregate engine and outcome_aggregates table, no dashboard |
| D-022 | Intervention tracker | 04 | Searched intervention tracker/intervention in app/src, supabase; only an 'intervention' metric definition in institution-ops |
| D-023 | Escalation workflow | 04 | Searched escalation/escalate in app/src, supabase; only community moderation escalation (components/community/Escalation.tsx) |
| D-025 | Advisor settings | 04 | Searched advisor settings/preferences in app/src/screens/settings, lib/settings.ts; no advisor-specific settings |
| E-007 | Faculty assignment | 04 | Searched instructor, faculty assign in registration migration, lib/enrollment, RegistrarDesk: sections have no instructor field |
| E-008 | Room scheduling | 04 | Searched room schedul, rooms, location in registration migration, RegistrarDesk, lib/enrollment: no course room assignment |
| E-012 | Co-requisite rules | 04 | Searched corequisite in registration migration, lib/enrollment, RegistrarDesk: none; only student-side catalog text parsing |
| F-026 | Staff: Dunning | 04 | Searched dunning in app/src, StudentAccounts, student_accounts migration: only Semester own-subscription dunning exists |
| G-010 | Maintenance | 03 | Searched maintenance, work order, repair request in app/src, supabase, packages: no feature |
| G-011 | Roommate resources | 03 | Searched roommate in app/src screens/components/lib: only nav keywords and StarRez link note |
| G-015 | Event registration | 03 | Searched register/rsvp in CampusDirectory, community/, screens: no event registration (connect.ts roadmap text only) |
| G-021 | Leadership tools | 03 | Searched officer/leadership tools in screens, components, lib/activities: only Support pointer to running an org |
| G-031 | Local services | 03 | Searched local services/off-campus/nearby businesses in app/src: nothing |
| H-004 | Comments/reactions | 07 | Searched comment/reply/reaction in community/, screens/Community.tsx: none; migration says no reactions table by design |
| H-014 | Community guidelines | 07 | Searched guidelines/code of conduct in screens, components, community/: no page; doc only: docs/CAMPUS-MODERATION-SOP.md |
| H-029 | Mod: Analytics | 07 | Searched moderation analytics/metrics/stats in screens/Moderation, community/, components: none (register text only) |
| I-008 | Resource center | 07 | Searched family/parent/guardian resources in app/src screens, components, site: none; doc only: docs/FAMILY_REQUIREMENTS.md |
| I-009 | Communication preferences | 07 | Searched notification/communication preference for family in lib/family*.ts, Family.tsx: none |
| J-022 | Credential renewal | 07 | Searched renew/expir in opportunities, career, credential-wallet; no renewal tracking |
| J-023 | Career outcome history | 07 | Searched outcome/first destination/post-graduation in app/src, server, docs; none implemented |
| J-026 | Employer: Applicant criteria | 07 | Searched criteria/requirements in server/institution/career.ts, role-workspace; no applicant criteria |
| J-027 | Employer: Talent discovery | 07 | Searched talent/discovery/candidate in app/src, server; only a capability label in role-workspace.ts |
| J-029 | Employer: Interview scheduling | 07 | Searched interview scheduling in server/institution/career.ts, advising.ts, supabase; none for employers |
| J-032 | Employer: Analytics | 07 | Searched employer analytics/funnel in app/src, server; none |
| J-033 | Employer: Partnership settings | 07 | Searched partnership/employer settings in app/src, server, supabase; none |
| J-036 | Alumni: Opportunities | 07 | Searched alumni opportunities/job posting by alumni in app/src, server; none |
| J-037 | Alumni: Continuing education | 07 | Searched alumni continuing education in app/src, server; only Pathway checklist items |
| J-039 | Alumni: Donations/engagement handoff | 07 | Planned only: app/src/lib/advancement/edition.ts says no giving or handoff built |
| K-012 | Access reviews | 05 | Searched access review/recertification in supabase, app/src; only break-glass review in console/BreakGlass.tsx |
| L-004 | Security review | 05 | No security-review screen/flow found (grep security review in app/src, server, migrations); only threat-model docs |
| L-024 | OneRoster REST sync | 05 | Searched oneroster in app/src, server, packages, supabase: only staging foundation; "no OneRoster client" |
| L-025 | Edu-API configuration | 05 | Searched edu-api/eduapi in app, packages, supabase: only registers/docs mentions, no config |
| M-016 | Sec: Asset inventory | 09 | Searched asset inventory in app, supabase, docs: doc only: docs/trust/ASSET-INVENTORY.md |
| M-018 | Sec: Secret inventory | 09 | Searched secret inventory/register in app, supabase: doc only: SECRETS.md |
| M-022 | Sec: Threat models | 09 | Searched threat model in app/src, supabase: doc only: docs/trust/THREAT-MODEL.md |
| M-027 | Sec: Pen-test evidence | 09 | Searched pen-test/pentest: none done; doc only: docs/trust/PENETRATION-TEST-PLAN.md |
| M-028 | Sec: Vendor risk | 09 | Searched vendor risk in app/src, supabase: doc only: docs/trust/VENDOR-RISK-REGISTER.md |
| M-048 | Priv: Reporting | 09 | Searched privacy report(ing) in app/src, console: none; only generic Figures and trust scorecard |
| N-003 | My Work | 08 | no per-operator task view; searched "my work", "assigned to me" in components/console and Console.tsx; Approvals flags mine only |
| N-065 | Access review | 08 | no access review/attestation tables or UI; searched access_review, attestation in app/src, supabase/migrations; no screen |
| N-072 | Vendor management | 08 | no vendor mgmt UI/tables; searched vendor, subprocessor in app/src, supabase/migrations; doc only: docs/SUBPROCESSORS.md |

## What the audit says about the handoff itself

- **The repo is ahead of the handoff on the student side** (60 of 70 Student OS screens exist) and **behind it on the staff and operator side** (most K and N rows are a table or library with no screen).
- **Controlled integration: 0 of 20 steps are fully built.** The control plane is reachable by RLS/RPC only; the app has no screens or client calls, and `app/server/integration/registry.ts` has an empty adapter list. This is the largest single pilot-path gap and belongs to stream 05.
- **Developer platform: 0 of 16 steps fully built.** Developer portal, SDK distribution, certification and deprecation notices exist only as internal code.
- **Incident response: 0 of 17 steps fully built** in-app. Runbooks and a break-glass console exist; release-level pause and a mitigation log do not.
- **Registration and grade passback do not reach a real institution:** the passback runner has no caller and no live LMS adapter, and the enrolment module is off at every school.
