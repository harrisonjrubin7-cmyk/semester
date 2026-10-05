# Education OS product map

Status: Phase 0 baseline, assessed 2026-10-05 at `790ebbf`, read-only. Companion to [the thesis](SEMESTER_UNIFIED_EDUCATION_OS_THESIS.md). Evidence paths are relative to the repository root. No test was run for this audit.

## Status vocabulary

One primary status per row, plus any modifiers that apply.

| Code | Primary status | Means |
| --- | --- | --- |
| NV | Native and verified | Complete within its stated scope, with a test or `*.check.sql` suite asserting it. **Not** "live": see exposure. |
| NI | Native but incomplete | Code exists and works for part of the job; named gaps remain. |
| INT | Integrated | Works by connecting to, or importing from, another system or a mock of one. |
| DO | Designed or documented only | A document or pure rules file says how; no screen, store or caller uses it. |
| PL | Planned | Named in a roadmap or register; not designed. |
| NS | Not started | At most a document naming the gap. |
| UA | Unsafe to activate | Built, but activating it would breach a stated precondition. |

| Modifier | Means |
| --- | --- |
| `+APP` | Requires institutional approval |
| `+REV` | Requires legal, security or accessibility review |
| `+MIG` | Requires migration, reconciliation and rollback design |

**Exposure** is a separate column because repository maturity is not operational exposure (the rule in `docs/product/capability-registry.md`). `off` = defaults off everywhere; `prod` = defaults to production in a build; `device` = runs in the browser only; `db` = database objects exist and no screen reaches them.

## Layer view (from the brief's architecture map)

| Layer | Contents | State |
| --- | --- | --- |
| Experience | Student OS, Course Studio, advisor workspace, registrar, campus services, family, employer portal, company console | Student OS is the only layer with a usable default surface. Role workspaces for the other roles render only in an institutional preview build on synthetic grants (`app/src/components/institutional/role-workspace.ts`). |
| Intelligence | AI gateway, search, knowledge graph, recommendations, policy engine, workflow engine, analytics, evidence | AI gateway built, undeployed. Search is client-side. Workflow engine is definitions only. Analytics is three marks. |
| Domain and record | Identity, courses, catalog, enrollment, registration, grades, advising, support, community, career, family, billing, governance | See sections 3, 5, 6, 7 below. Built in the database, mostly off. |
| Control and trust | Tenant policy, RLS, capabilities, approvals, audit, rollouts, flags, break-glass, retention, consent, classification | Strongest layer. Gaps: no FORCE RLS decision, four classification vocabularies, `tenant_rollout` is a status record not an enforcement gate. |
| Integration and migration | LTI, OneRoster, Edu-API, SIS, SSO, SCIM, productivity, external AI | LTI, SCIM, SAML-binding and migration tooling are tested against synthetic data; OneRoster is a staging table; Edu-API and OIDC are absent; no live adapter. |

## 1. Foundation

| Item | Status | Exposure | Evidence | Gap |
| --- | --- | --- | --- | --- |
| Identity (account, SSO binding) | NV | db | `supabase/institutional-foundation.check.sql`, `identity-provisioning.check.sql`; `app/server/institution/auth.ts` | SAML only; no live IdP flow; email still a join key in advisor and support shares |
| SCIM | NI | off (`SEMESTER_SCIM=on`) | `app/server/institution/scim.ts`, `postgres-scim.ts`, `supabase/scim-gateway.check.sql` | Tested with fakes; no real IdP; no offboarding notice |
| OIDC | DO | n/a | `docs/OIDC-IMPLEMENTATION-RUNBOOK.md` | `provider_type` constrained to `saml` |
| Tenancy (`schools`) | NV | db | `20260921*` schemas; `docs/architecture/0005-multi-campus-scoping.md` | Campus is a `schools` row; no institution, campus, program or department tables |
| Policy hierarchy | NI | db | `governance_policy_nodes`, `private.check_policy_node` trigger; `app/src/lib/governance/hierarchy.ts` | Narrow-only trigger verified; **no runtime consumer** resolves the chain |
| Membership and role grants | NV | db | `role_grants`, `private.has_capability`; `supabase/rolegrants` suites | Three parallel membership models; exact-scope match, no tree inheritance |
| RLS isolation | NV (tables) / DO (other layers) | db | `database/schema/table-classification.json`, `app/src/lib/tableclassification.test.ts`; `database/TENANT_ISOLATION_MATRIX.md` | No FORCE RLS; `anon` holds DML on 32 public tables in production (`database/proposed/anon_grant_reduction.sql` not applied); non-DB layers proven only on in-memory adapters (`packages/platform/src/isolation`) |
| Audit | NV (chained streams) / NI (rest) | db | `private.console_audit_event`, `private.ledger_chain`; `supabase/ledger-chains.check.sql` | Streams fragmented; no shared correlation id; outbox has no publisher |
| Policy engine | NV (DB capability) / DO (TS engines) | mixed | `packages/institution/src/policy.ts`; `packages/platform/src/policy/engine.ts` | One production caller: `app/server/productivity/service.ts`. Capability vocabulary mismatch (dot vs colon) |
| Data classification | NI | db | `data_classification_rules`; `app/src/lib/integration/classification.ts` | Four incompatible vocabularies; no column-level classification |
| Consent | NV (grant lifecycles) / NI (record) | db | `consent_record`, `support_access_grant` composite FK; `supabase/support-access.check.sql` | `consent_record` lacks purpose, legal basis, revocation reason, correlation id; `family_*` tenant is free text |
| Legal hold, retention, export, erase | NV in repo | db | `supabase/legal-holds.check.sql`, `deletion.check.sql`; `RETENTION.md` | Last three sweeps, the guardian-restriction export fix and the audit-copy scrub are not in the production ledger; no rights-request answering surface |
| Rollout and flags | NV (tenant policy, kill switches) / NI (`tenant_rollout`) | db | `tenant_feature_policy`, `feature_kill_switch`; `app/src/lib/flags.ts` | `tenant_rollout` not consulted by any data-access policy |
| Observability and SLOs | DO | n/a | `app/src/lib/governance/error-budgets.ts`; `docs/sre/generated/ALERTS.md` | 33 alerts: 22 defined, 6 wired, 0 delivery-tested; `SEMESTER_MONITORING_READY` is self-asserted |
| Integration control plane | INT | off | `supabase/integration-control-plane.check.sql`, `integration-hardening.check.sql` | Mock adapters only; reconciliation never scheduled; no inbound endpoint |
| Support | NI (tooling) / NS (staffed service) | off (`supportTickets`) | `support_tickets`, `support-reply-notify` | Single responder; SLA not started |

## 2. Daily student OS

| Item | Status | Exposure | Evidence | Gap |
| --- | --- | --- | --- | --- |
| Home / Today | NV (device) | prod | `app/src/screens/Today.tsx`, `app/src/lib/today-decision.test.ts` | None named in scope; blob-synced when signed in |
| Action Center | NI | prod (`today_action_center`) | `app/src/components/TodayActionCenter.tsx`, `ActionCenter.test.tsx` | One snooze duration; no dismiss reason; no per-item freshness |
| Path (My Path) | NI | prod nav; add-ons off | `app/src/screens/Degree.tsx`, `Pathway.tsx`, `app/src/lib/degree.test.ts` | Student-entered requirements; no institution-verified audit; device-only |
| Plan (is the Calendar screen) | NV reads / NI writes | prod | `app/src/screens/Calendar.tsx`, `calendar-source` tests | External writes have no preview and confirm audit |
| Registration planning | NI | off | `app/src/lib/registration-day.ts`, `RegistrationDay.test.tsx` | Clipboard bridge, no SIS adapter |
| Tasks | NV (device and blob) | prod | `app/src/screens/Mine.tsx` tab, `state/slices/mine.test` | Server `public.tasks` engine path is flagged off (`offline_engine_tasks`) |
| Notes | NI | prod | `app/src/state/slices/notes.ts` | Thin direct tests |
| Files | NI | device | `app/src/lib/files.ts`, `files.test.ts` | IndexedDB only; never synced or shared |
| Search | NI | prod | `app/src/screens/Search.tsx`, `lib/search.ts` | Client-side over registry and own data; no server index; no course, event, policy or people sources |
| Courses | NI | prod | `app/src/screens/Courses.tsx`, `CourseHub` | See learning |
| Study | NI | prod | `app/src/screens/Study.tsx`, `lib/fsrs` tests | Device; client-side extraction |
| Community | INT | off (`communityFeed`, `communityReporting`) | `app/src/community/*`, `supabase/community.check.sql` (357 checks) | Not released; high-risk flags can never be `production` |
| Support (offices) | NI | prod | `app/src/screens/Support.tsx` | Device-held map; offices are generic pointers |
| Career | NI | device | `app/src/screens/Career.tsx`, `CareerEvidence.tsx` | Device library only |
| Profile | NV | prod | `app/src/screens/Profile.tsx` | Small scope by design |
| AI copilot | NI | prod (own key or proxy) | `app/src/ai/*`; `supabase/functions/claude` | Shared key gated off by five pending owner decisions; threads in `localStorage` only |

Note: "Action Center", "Tasks", "Notes", "Files" and "Plan" are components or tabs, not screens of their own: Tasks, Notes and Files are tabs of `mine`; "Plan" is the label for `calendar`.

## 3. Learning

| Item | Status | Exposure | Evidence | Gap |
| --- | --- | --- | --- | --- |
| Course home | NI | prod | `app/src/components/CourseHub.tsx` | No term plan, outcome map or submission state |
| Syllabus | NI | prod | `app/src/lib/generate.ts`, `import-review.ts` | Student approves their own import; no faculty publication |
| Objectives and outcomes | NS | n/a | `app/src/lib/learningmap.ts` (student-side map only) | No course-level outcome map |
| Resources and source locker | NI | off | `app/src/components/SourceLocker.tsx` | No expiry or outdated flag |
| Assignments | NI | prod | `CourseHub`, `lib/assignment.ts` | No native submission or receipt |
| Study packs, course AI rules, guidance | NV in slice | off (`course_studio`) | `app/src/components/CourseStudio.tsx`, `supabase/coursestudio.check.sql` | Packs are link lists, not files; faculty course-scoped source approval not found in `20260928309000_course_studio.sql` |
| Discussions | NS | n/a | none in course; Community is the substitute | |
| Gradebook of record | NV in DB / INT | off (`writeback.lms_grade_passback`) | `app/src/lib/gradebook/`, `supabase/gradebook.check.sql` (93 checks) | No `LmsAdapter` implementation; no anonymous or group grading |
| Student's own grades | NV | prod | `app/src/lib/grades.ts`, `whatif.test.ts` | Labelled estimate by design |
| Regrade | NI | off | `gradebook_file_regrade`, `gradebook_resolve_regrade` | Behind gradebook flag |
| Feedback | NI | device | `app/src/components/FeedbackInbox.tsx` | Device-only |
| Office hours | NI | prod | `app/src/components/OfficeHours.tsx` | No scheduling or instructor side |
| Integrity | NI | prod | `app/src/lib/toolkit/disclosure.ts` | Declaration stored on device, never submitted; no instructor review queue |
| Learning evidence | NI | off | `SaveAsEvidence.tsx`, `supabase/evidence-graphs.check.sql` | Server tables not written by the app |
| Rubric engine, item bank | DO | n/a | `app/src/lib/rubricengine.ts`, `itembank.ts` | Pure rules; no screen, store or QTI |
| Faculty learning analytics | NS | n/a | prohibitions only (`institution-ops`, `cohortfloor`) | None of the useful measures exist |

## 4. Institutional workflow

| Item | Status | Exposure | Evidence | Gap |
| --- | --- | --- | --- | --- |
| Student-controlled advisor share | NV (DB) | off (`advisor_meeting_mode`) | `supabase/advisor.check.sql`, `app/src/lib/advisor-meeting.ts` | Advisor view is read-only with no reply |
| Native advising system (cases, caseloads, notes) | PL | n/a | `app/server/institution/advising.ts` is a sandbox demo | No case model anywhere |
| Help-request inbox | NV | off (`humanHelp`) | `supabase/help-requests.check.sql` | |
| Registration readiness | NI | off | see section 5 | |
| Tenant configuration | NI | preview | `app/src/components/institutional/ConfigurationStudio.tsx`, `supabase/configuration-studio.check.sql` | **Nothing in the app reads the settings** (`effectiveConfig` called only by the studio) |
| Workflow builder | NI | preview | `app/src/lib/workflow`, `supabase/workflow-builder.check.sql` | Definitions only; no student instance |
| Implementation and pilots | NI | n/a | `app/src/lib/gtm/pilot.ts`, `supabase/gtm.check.sql` | No pilot is running |

## 5. Core academic operations

| Item | Status | Exposure | Evidence | Gap |
| --- | --- | --- | --- | --- |
| Catalog | NS (native authoring) / INT (mirror) | db | `catalog_sections`, `catalog:sync` | No authoring, approval or catalog-year versioning |
| Sections and registration | NV in DB, `+APP +MIG` | off (`writeback.registration_submit`) | `supabase/registration_transaction.check.sql`, `app/src/lib/enrollment/`, `app/src/screens/Registration.tsx` | SIS adapter not built; no seat inventory of record |
| Holds | INT | db | `registration_holds`, `my_registration_hold` | SIS-sourced; students see office and link, never the reason |
| Overrides | NV in DB | off | `registration_overrides`; `supabase/human-overrides.check.sql` | |
| Academic record ledger | NV in DB, `+APP +MIG` | off (`recordLedger`) | `supabase/academic-record.check.sql` (31 checks), `RecordLedger.tsx` | No student screen reads it; no importer; no transcript issued |
| Gradebook | see section 3 | | | |
| Degree progression, graduation | NS (audit) / NI (student estimates) | off | `app/src/lib/degree.ts`, `graduation.ts` | No degree audit, no rules of record |
| Transfer evaluation | NI (DB only) | db | `articulation_rules`; `app/src/lib/transferhub.ts` | No screen uses the tables |
| Student accounts | NV in DB, **UA** | off | `supabase/student-accounts.check.sql`, `student-payment-plans.check.sql`; `docs/MONEY-MODULES-SWITCH-ON.md` | Nine unmet preconditions; no payment provider; no finance owner |
| Course demand | NV | off | `supabase/demand.check.sql` | n>=10 floor |

## 6. Campus life and services

| Item | Status | Exposure | Evidence | Gap |
| --- | --- | --- | --- | --- |
| Dining | NV in DB, **UA** | off (`module.dining`) | `supabase/dining.check.sql` (137 checks), `app/src/screens/Dining.tsx` | No card-office connection; no staff screen in navigation |
| Housing | PL (native) | n/a | `app/server/institution/housing.ts` sandbox only | No housing table |
| Events | INT | prod | `app/src/lib/campusdirectory.ts` | `event:create` is a dormant capability; no organization events table |
| Organizations | NI (DB) | db | `organizations`, `supabase/organizations.check.sql` | No screen for membership decisions |
| Community | INT, off | off | as section 2 | Best-evidenced campus area (100 of 150 register rows tested) |
| Study spaces | INT | db | `space_availability`; booking refused by design | `writeback.space_booking` not built |
| Support offices | NV | off | `help_destinations`, `help_requests` | Generic pointers, not school-verified |
| Accessibility passport | NI (DB) | db | `accommodation_passports`, `accommodation_shares`; `supabase/expansion.check.sql` | No screen uses it; `+REV` |
| Safety handoffs | NV | prod | `app/src/community/crisis.ts` | US numbers only; states it is not an emergency service |

## 7. Career and lifelong relationship

| Item | Status | Exposure | Evidence | Gap |
| --- | --- | --- | --- | --- |
| Skills graph | NI | preview | `app/src/lib/skills-graph.ts` | Device-derived; student confirms |
| Portfolio / career evidence | NV (local) | off | `app/src/lib/career-evidence.ts` | Nothing on the server |
| Credential wallet | NI | device | `app/src/components/CredentialWallet.tsx` | No issuer, revocation state or recipient sharing |
| Verified skills | NI (DB) | db | `skill_records`, `skill:verify` | No screen writes verification requests |
| Opportunities and employers | NI | prod (listing desk) | `ListingDesk`, `talent_profiles` | No employer search UI |
| Mentors | NV | prod | `mentor_rosters`, `supabase/mentor-rosters.check.sql` | |
| Alumni | PL | n/a | role provisionable only | |
| Lifelong credentials, CASE, Open Badges | NS | n/a | `app/src/lib/learnerrecord.ts` export shape only | Do not claim support |

## 8. Platform

| Item | Status | Exposure | Evidence | Gap |
| --- | --- | --- | --- | --- |
| Domain API (productivity) | NI | off | `app/server/productivity/`, `docs/api/productivity.v1.openapi.json` | No authenticator, no scheduled sweep, no client queue |
| Developer portal, API keys, SDK, sandbox | NS | n/a | `docs/developers/` is internal how-tos | |
| Webhooks, file service, other 12 domains | DO | n/a | `docs/API-PLATFORM.md` | |
| Marketplace | PL, held, **UA** | n/a | `docs/decisions/D-1236.md` | Gates G-OWN, G-DATA, G-TERMS, G-QUEUE unmet |
| Extensions (third party) | DO | off | `docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md`; `externalConnectors`, `codeExecution` hard-off in `app/src/lib/toolkit/flags.ts` | First-party `extensions/semester-capture` exists |
| Multi-campus governance | NV (policy) / NI | db | `app/src/lib/governance/hierarchy.ts`, `docs/operating-model/MULTI-CAMPUS.md` | No enabled school; no system-level console |

## 9. Company command center

| Item | Status | Exposure | Evidence | Gap |
| --- | --- | --- | --- | --- |
| Operations console | NV (control foundation) / NI | gated `console:operate` | `app/src/screens/Console.tsx`, `app/src/components/console/*`, `supabase/console-*.check.sql` | No revenue, finance, marketing, people or legal modules; billing figure "not applicable" by design (D-009) |
| GTM and pilots | NI | gated | `app/src/lib/gtm/*`, `supabase/gtm.check.sql` | No CRM of record, pipeline report or forecast |
| Individual billing | NI / **UA** to broaden | held (`INDIVIDUAL_PAID_ACQUISITION_ENABLED=false`) | `supabase/functions/billing-*`, `docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md` | Monthly acceptance only; annual, refund, failure, dispute and tax unexercised |
| Institutional billing | NS | n/a | all six institutional `commercial_prices` rows quote-only | No invoicing, PO, terms or AR |
| Customer success, renewals | NI | gated | `compute_account_health()` | No accounts to run on |
| Trust room, compliance | NI | gated | `supabase/functions/trust-room`, `docs/trust/` | No SOC 2 report, no pen test, HECVAT planned |
| Finance visibility | DO | n/a | `docs/finance/` | Planning model of hypotheses, not wired to the console |
| Release ops, SLOs | NI / DO | n/a | `app/src/lib/governance/release-profiles.ts`, `error-budgets.ts` | Targets only; no measured availability |
| Capacity planning | DO | n/a | `docs/finance/12`, `docs/operations/coo/` | |
