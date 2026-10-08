# Domain replacement register

<!-- Rendered from app/src/lib/replaceregister.ts by replaceregister.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

**Connect first. Replace by domain. Operate as one system.**

Semester is meant to replace the fragmented university stack, not sit beside
it as another portal. It connects to the SIS, ERP, LMS, registrar, aid,
accounts, housing, dining and campus tools first, to migrate data, validate
workflows and earn trust; then replaces each domain with a native, governed
module when that domain is mature enough to run through Semester. D-143
records this as the destination. Until a domain clears the bar below, the
boundary in [`UNIVERSITY-OS-ARCHITECTURE.md`](UNIVERSITY-OS-ARCHITECTURE.md)
still holds for it.

> Semester is the system of engagement, system of action, system of learning, system of student success, system of services, and eventually the system of record for the domains an institution chooses to migrate.

Behind the scenes, each domain is run one of four ways:

1. Semester natively runs the domain.
2. Semester synchronizes and governs a transitional external domain.
3. Semester uses a partner for regulated or specialized infrastructure.
4. Semester provides an official handoff until native replacement is authorized.

| Supplied document | What it holds |
| --- | --- |
| [Those are also supposed to be replaced by Semester](expansion/Replace-by-Domain-University-Operating-System.pdf) | The end state: connect first, replace by domain, operate as one system. The six-area operating-system tree, fourteen domains from initial role to native replacement, what replacement requires, six phases, the core platform and domain modules, the bounded areas, the public positioning and the four ways a domain runs behind Semester. |
| [Architecture principle](expansion/Architecture-Principle-LMS-SIS-Holds-and-Advising.pdf) | Which system is authoritative today; the LMS plan in four stages; the SIS plan (minimum fields, fields avoided, the seven source states, the sync pipeline); the student portal; Advisor Meeting Mode; support routing; holds; FERPA and institutional control; the recommended build order and the final test. |
| [Anything else in terms of university services, course registration, LMS features](expansion/Registration-LMS-and-University-Services-Expansion.pdf) | Seventeen expansions: Registration Day Mode, the scenario engine, course pages, transfer, Course Studio, syllabus intelligence, assignments, assessments, competencies, group projects, the services hub, the office action publisher, financial planning, the Accessibility Passport, campus life, standards and integration progression; the ten best next modules and the final product standard. |
| [Anything else in any area](expansion/Replaceability-Migration-Continuity-and-Confidence.pdf) | The replaceability requirements; the Migration Center; parallel run; financial controls; financial-aid maturity; registrar-grade record integrity; the unified service desk; knowledge; communications; localization; privacy-safe analytics and data governance; the marketplace; the Implementation Academy; enterprise continuity; twelve final areas and the leadership standard. |

95 rows. Statuses were read on 29 September 2026 under the rule every register here uses: `designed` cites a document, `building` code, `tested` a test, and every cited path exists. A supplied PDF is never evidence.

| Status | Means |
| --- | --- |
| not-started | at most a document naming the gap |
| designed | a document says how; no code does |
| building | code exists; nothing holds it yet, or the join is missing |
| tested | a test that runs on every change holds the best piece of it |

| not-started | designed | building | tested |
| ---: | ---: | ---: | ---: |
| 4 | 4 | 31 | 56 |

## Can any domain be retired into Semester yet?

A domain is replaceable only when its native row and all 15 replaceability requirements are held by a test. That is computed, not asserted. **Today: 0 of 14.** 5 requirements stop every domain: `r-lifecycle` (building), `r-migration` (building), `r-change` (designed), `r-contract` (building), `r-exit` (building).

| Domain | Connect first | Native replacement | Stopped by |
| --- | --- | --- | --- |
| Identity | tested | building | `identity-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |
| Student portal | tested | building | `portal-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |
| Course catalog | tested | not-started | `catalog-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |
| Degree planning | tested | not-started | `degree-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |
| Registration | tested | building | `registration-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |
| LMS | tested | building | `lms-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |
| Advising | tested | building | `advising-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |
| Student accounts | tested | building | `accounts-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |
| Financial aid | building | not-started | `aid-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |
| Housing | tested | building | `housing-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |
| Dining | tested | building | `dining-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |
| Career | tested | building | `career-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |
| Campus community | tested | building | `community-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |
| Institution operations | tested | building | `operations-native`, `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit` |

## The domain ladder

Replace by domain maturity, not all at once. Each domain has the role Semester plays at first and the native state it grows into.

| Domain | Initial role | Status | Evidence | Gap | Native replacement | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Identity | Connect to SSO and existing accounts | tested | `app/server/institution/postgres-scim.test.ts` — SCIM repository refusals<br>`supabase/scim-gateway.check.sql` — SCIM writes audited once; no grant to authenticated<br>`supabase/tenant-sso-policy.check.sql` — tenant SSO policy | SAML only, no OIDC; SCIM is off by default for every tenant; no acceptance run against a real identity provider. | The identity experience with SSO, SCIM, MFA, access governance and tenant administration | building | `app/src/components/MfaStep.tsx` — the second-factor step<br>`app/src/components/institutional/ControlPlane.tsx` — the tenant control-plane tab<br>`supabase/console-control-plane.check.sql` — a fresh second factor on operator actions | MFA covers operators only, tenant administration is a flagged preview tab, and there is no native directory or identity provider. |
| Student portal | Connect existing services | tested | `app/src/lib/today-decision.test.ts` — the Today decision logic<br>`app/src/components/ActionCenter.test.tsx` — most important action, next actions, why, source | The Action Center defaults to production (`today_action_center`; an explicit `off` rolls it back); no student acceptance run. | The default student portal and daily operating environment | building | `app/src/lib/tabbar.ts` — Today, My Path, Search, Plan, Me, on by default through `journeyNavigation`<br>`app/src/lib/fivedestinations.test.ts` — the five held to their screens | The five destinations are the default (`journeyNavigation` defaults to production) but Files, AI threads, Career and Pathway stay on the device, and there is no context bar on Today, Plan or Me; no student acceptance run. |
| Course catalog | Import or sync official data | tested | `app/src/lib/registration.test.ts` — catalog parse and time conflicts<br>`app/src/lib/course-detail.test.ts` — fit, conflicts and source labels<br>`supabase/migrations/20260926150000_expansion_roles_and_features.sql` — registrar-synced `catalog_sections` under `catalog:sync` | The catalog is a file the student imports; no live registrar feed. | Catalog authoring, publishing, search and curriculum discovery | not-started | `docs/UNIVERSITY-OS-ARCHITECTURE.md` — today’s boundary: Semester is not the catalog of record | No catalog authoring, approval, publishing or catalog-year versioning. |
| Degree planning | Read-only requirements and student planning | tested | `app/src/lib/degree.test.ts` — requirement arithmetic on student-entered requirements<br>`app/src/lib/graduation.test.ts` — the projection, labelled an estimate | Students type their own requirements; no institutional audit source. | Degree audit, pathway, scenario and graduation planning | not-started | `docs/PRODUCT-ROADMAP.md` — “no official degree audit” in any phase of the current product plan<br>`docs/UNIVERSITY-OS-ARCHITECTURE.md` — today’s boundary: the official degree audit is not replaced | No requirement rules of record, no audit engine and no certification by a registrar. |
| Registration | Plan and official handoff | tested | `app/src/lib/registration-day.test.ts` — ranked backups and the checklist<br>`app/src/components/RegistrationDay.test.tsx` — countdown and official handoff | No live seats. After the handoff the student can note where it stands (their own report, on their device, `handoff-status.ts`), but nothing reads the official system back. | The registration center: waitlist, enrollment, add/drop and approval workflow | building | `supabase/migrations/20260929300000_registration_transaction.sql` — terms, sections, enrollments, holds, completions, overrides, requests and an audit event; prerequisites, clashes, credit ceiling, holds, waitlist promotion, idempotency, a per-school-term lock and a registrar override<br>`supabase/registration_transaction.check.sql` — the transaction walked in a throwaway database<br>`app/src/lib/enrollment/enrollment.test.ts` — the pure model<br>`app/server/institution/registration.test.ts` — the sandbox flows | The native transaction exists in the database and is gated by `writeback.registration_submit` (off at every school); nothing feeds it from a student information system (no adapter, no importer) and nothing reads the official system back, so there is no seat inventory of record. The server module `app/server/institution/registration.ts` is a labelled sandbox demonstration. |
| LMS | LTI launch and selected context | tested | `supabase/functions/_shared/lti.ts` — OIDC login and JWT launch validation<br>`app/src/lib/lti.test.ts` — the positive and negative launch suite<br>`supabase/lti.check.sql` — row-level security on registration and nonce tables | No launch from a real LMS yet; names and roles not requested; grade passback off by flag. | Native Course Studio, learning platform, assignments, assessments and gradebook | building | `app/src/components/CourseStudio.test.tsx` — the faculty screens<br>`supabase/coursestudio.check.sql` — faculty-grant publishing, immutable versions<br>`supabase/migrations/20260929310000_gradebook.sql` — schemes, items, append-only grade entries, regrades and passbacks<br>`supabase/gradebook.check.sql` — the gradebook walked in a throwaway database<br>`app/server/institution/sandbox.test.ts` — release gating and appeal in the sandbox | Course Studio publishes rules, guidance and study packs only. A gradebook of record exists in the database and has instructor and student screens, gated by `writeback.lms_grade_passback` (off at every school); no `LmsAdapter` is implemented, and there is no course shell, roster, submissions, question banks or rubric levels in a screen. |
| Advising | Student-controlled agendas and plans | tested | `app/src/lib/advisor-meeting.test.ts` — the agenda and what is shared<br>`supabase/advisor.check.sql` — own-school advisors, 120-day expiry, reads logged | Behind `advisor_meeting_mode`; the advisor’s page is read-only with no reply. | The full advising case, plan, appointment, notes and follow-up system | building | `app/server/institution/advising.ts` — slot booking<br>`app/server/institution/advising.test.ts` — the sandbox flows | Runs against the labelled sandbox only: no store, no real institution. No case model, caseloads, advisor notes or campaigns. |
| Student accounts | Show deadline and safe handoff | tested | `app/src/lib/bill.test.ts` — the bill against aid, figures entered, never fetched<br>`app/src/lib/office-actions.test.ts` — office deadlines into the Action Center | Figures are typed by the student unless the school keeps its accounts in Semester (the native row); no feed from another bursar system. | Billing, invoices, payment plans, hosted payment, refunds and financial communication | building | `supabase/student-accounts.check.sql` — the student-account ledger (D-146): charges, payments, refunds, adjustments, reversals and aid credits, each approved by someone else<br>`app/src/lib/finance/accounts.ts` — balance, aging, holds, statements, payment plans and receipts from the ledger<br>`app/src/components/institutional/StudentAccounts.test.tsx` — the Student accounts tab<br>`app/src/components/MyStudentAccount.test.tsx` — a linked student reads their posted account, receipts and statements on Bill, and asks for a payment plan<br>`supabase/student-payment-plans.check.sql` — payment plans: the balance and schedule written by the database, decided by someone other than the asker | The ledger and its controls are built and held; nothing connects it to a payment provider, so payments are recorded by hand from the provider’s reference and settlements are read from a file. A student reads their account and asks for a plan, and is sent nothing: no statement, reminder or plan notice leaves Semester. |
| Financial aid | Checklist and official handoff | building | `app/src/lib/help-routes.ts` — financial aid routed to its office, nothing stored<br>`app/src/lib/help-routes.test.ts` — aid is directory-only | No checklist built from an aid deadline or status. | Aid workflow, documents, communication and packaging — only with legal and institutional capacity | not-started | `docs/UNIVERSITY-OS-ARCHITECTURE.md` — today’s boundary: aid determination is not replaced<br>`docs/FINANCIAL-READINESS-WORKSPACE.md` — Semester is not the aid package | No packaging, verification, disbursement or satisfactory-progress workflow; the brief itself says not to claim this until regulatory expertise exists. |
| Housing | Status and official handoff | tested | `app/src/lib/housing.test.ts` — move-out against exams, facts entered<br>`app/src/lib/campusdirectory.test.ts` — the school-imported housing directory | Entered or imported only; no live housing feed. | Housing application, room selection, residence life, maintenance and communications | building | `app/server/institution/housing.ts` — applications, room spaces, contracts, cooling-off<br>`app/server/institution/housing.test.ts` — the sandbox flows | Runs against the labelled sandbox only: no store, no real institution. Nobody is housed through it; no maintenance or residence-life workflow. |
| Dining | Hours and official handoff | tested | `app/src/lib/meals.test.ts` — swipe run-rate, entered never fetched<br>`app/src/lib/campusdirectory.ts` — the dining directory kind | No campus-card or balance feed. | Meal plan, dining locations, mobile ordering and campus card — where partner capacity exists | building | `supabase/migrations/20260929330000_dining.sql` — locations, hours, menus, plans, orders, an append-only integer-cents ledger and a shared-swipe pool<br>`supabase/dining.check.sql` — the dining store walked in a throwaway database<br>`app/src/lib/dining/client.test.ts` — the client<br>`app/server/institution/housing.test.ts` — the sandbox flows for meal-plan choice | A real store exists and is gated by `module.dining` (high-risk, off); no card-office partner is connected, so there is no point of sale or balance of record, and no staff screen is reachable from navigation. |
| Career | Portfolio and opportunity layer | tested | `app/src/lib/career-evidence.test.ts` — confirmed skills and artifacts<br>`app/src/lib/apply.test.ts` — the application tracker | The skills graph is behind a preview flag, and the data is device-local. | Career services, verified skills, employer, internship and alumni network | building | `supabase/mentor-rosters.check.sql` — alumni mentor consent on both sides<br>`supabase/expansion.check.sql` — `talent_profiles` opt-in and employer `talent:search`<br>`app/server/institution/career.test.ts` — sandbox employers | No real employer, no career-services appointments or recruiting, and no credential an employer can verify. |
| Campus community | Verified listings and events | tested | `supabase/listings.check.sql` — no self-publish, school-scoped visibility<br>`app/src/lib/listings.test.ts` — eligibility as written, https only | No verified live event source; no event accessibility details. | Campus community, organizations, events, mentoring and opportunities | building | `supabase/organizations.check.sql` — membership decisions refused when attempted<br>`app/server/institution/clubs.test.ts` — clubs in the sandbox<br>`packages/institution/src/workflow.ts` — organization recognition as a state machine nothing wires in | Elections and spend exist only in the sandbox; recognition is not wired to anything. |
| Institution operations | Configuration and integration controls | tested | `app/src/components/institutional/IntegrationDashboard.test.tsx` — every domain with health; counts exported, never ids<br>`supabase/integration-control-plane.check.sql` — row-level security and tenant kill switches | Behind `integrationDashboard`; only mock adapters exist. | The operational console for university workflow, services, content, analytics and governance | building | `app/src/screens/Console.tsx` — approvals, break-glass, audit, customers<br>`app/src/screens/console.test.tsx` — gated by `console:operate` | This is the operators’ console for Semester the company; a university’s own staff have no operations console, and tenant configuration is still spread across University tabs. |

| not-started | designed | building | tested |
| ---: | ---: | ---: | ---: |
| 3 | 0 | 12 | 13 |

## What replacement requires

Semester cannot claim to replace a system because it reproduces a screen. Product workflow + authoritative data model + approvals + permissions + audit + reporting + migration + integrations + support + continuity + legal and compliance evidence = a replaceable institutional system.

| ID | Requirement | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| r-record | Authoritative data ownership: the institution knows which system is the official record | tested | `app/src/lib/governance/data-contracts.ts` — owner, steward and source system per domain<br>`app/src/lib/governance/data-contracts.test.ts` — every connector has a contract | Every domain names an external record-holder; no contract yet declares Semester authoritative for anything. |
| r-lifecycle | Complete lifecycle: create, edit, approve, archive, correct, reverse and retain | building | `packages/institution/src/workflow.ts` — five state machines<br>`supabase/officeactions.check.sql` — draft → review → published with a second approver<br>`supabase/coursestudio.check.sql` — immutable versions | The full cycle exists per domain (office actions, Course Studio, the record and student-account ledgers with reversal and refund, Configuration Studio and Workflow Builder versions, school offboarding steps); there is no generic correct or reverse, and no per-object retention. |
| r-roles | Role and permission model for students, faculty, advisors, staff, admins, auditors and support | tested | `supabase/capabilities.check.sql` — scoped capability grants and refusals<br>`app/src/lib/ops/consoleduties.test.ts` — the duties matrix | No signed permission matrix per institution. |
| r-approvals | Approval engine with review, delegation and separation of duties | tested | `supabase/console-approvals.check.sql` — self-approval refused, two approvers where required | No delegation anywhere and no generic engine; second-person rules are enforced per domain (console operations, the record ledger, finance, configuration and workflow publish, migration cutover, module mode, offboarding, office actions). |
| r-audit | Audit history | tested | `supabase/console-control-plane.check.sql` — hash-chained audit; reads audited<br>`supabase/role-grant-audit.check.sql` — grant changes audited | Several audit tables with no single schema or search. |
| r-migration | Data migration: historical records, attachments, statuses and relationships move safely | building | `app/src/lib/migration/center.ts` — the Migration Center: mapping, cleaning rules, preview, validation and reconciliation of an export<br>`supabase/migrations/20260929200000_migration_center.sql` — the migration record and its stage gate<br>`docs/DATA-MIGRATION-PLAN.md` — the plan | The path from inventory to cutover is built and gated, but nothing imports records into a Semester domain of record, because none exists yet; attachments and relationships are not mapped. |
| r-parallel | Parallel-run mode: compare Semester against the retiring system before cutover | tested | `supabase/migration-center.check.sql` — cutover refused until enough distinct periods pass, the latest passing<br>`app/src/lib/migration/center.test.ts` — the comparison: missing, extra and differing records, by key | It compares exports the migration lead supplies, period by period; nothing yet runs a domain in shadow automatically. |
| r-reconcile | Reconciliation: differences between old and new are detected, investigated and resolved | tested | `supabase/integration-quality.check.sql` — reconciliation runs and discrepancies<br>`app/server/institution/gateway.test.ts` — prepare, commit, reconcile | Never run against a live source; no financial reconciliation. |
| r-reporting | Reporting: operational, regulatory, academic and financial | tested | `app/src/lib/institution-ops.test.ts` — small-group suppression and export refusals | Runs on pasted data in a hidden tab; no regulatory or financial report. |
| r-export | Export and portability for institution and student data | tested | `app/src/lib/export.test.ts` — CSV, Markdown, ICS<br>`app/src/lib/erasure.test.ts` — export and erasure on one data map | Student export only; no tenant bulk export and no OneRoster, Common Cartridge or QTI export. |
| r-a11y | Accessibility for every workflow and every user | tested | `app/src/a11y/axe.test.tsx` — axe on every route<br>`app/scripts/accessibility-smoke.mjs` — keyboard and 320px on six journeys | No conformance report and no third-party audit. |
| r-recovery | Disaster recovery: data and workflows survive outages, bad releases and mistakes | tested | `app/src/lib/rehearsal.test.ts` — the restore rehearsal runs in CI<br>`supabase/restore.sh` — the rehearsal | Production has never been restored; recovery time and point are unmeasured. |
| r-change | Change management: training, communications, support and adoption plans | designed | `docs/INSTITUTIONAL-CHANGE-MANAGEMENT.md` — the model<br>`docs/FACULTY-ENABLEMENT.md` — faculty enablement | No training exists for any role. |
| r-contract | Contractual support: service levels, escalation, maintenance and incident obligations | building | `app/src/lib/sla.ts` — the service-level arithmetic<br>`app/src/lib/sla.test.ts` — the arithmetic held<br>`docs/trust/SLA.md` — the framework, not a commitment | No signed service level, no uptime number, no on-call rota. |
| r-exit | Exit plan: a responsible way for an institution to migrate away | building | `docs/DATA-PORTABILITY-AND-OFFBOARDING.md` — the offboarding plan<br>`supabase/tenant-rollout.check.sql` — archiving requires offboarding and a completion certificate<br>`supabase/school-offboarding.check.sql` — offboarding cases and their steps<br>`docs/SCHOOL-OFFBOARDING.md` — the eight-step runbook | Offboarding is built and has never been used: the export file is not generated, nothing is purged, there is no screen, and no school has been offboarded. |

| not-started | designed | building | tested |
| ---: | ---: | ---: | ---: |
| 0 | 1 | 4 | 10 |

## The six phases

| Phase | Name | Domains | Weakest native row |
| ---: | --- | --- | --- |
| 1 | Own the student experience | portal, degree, registration, advising, career, community | not-started |
| 2 | Replace student-facing workflow modules | portal, advising, career, community | building |
| 3 | Replace learning delivery functions | lms | building |
| 4 | Replace academic administration functions | catalog, degree, registration | not-started |
| 5 | Replace student-service operations | accounts, aid, housing, dining, advising, career | not-started |
| 6 | Replace university operations and ERP workflows | identity, operations | building |

## The non-negotiable architecture

One modular platform, not disconnected applications. Every module shares:

- One identity.
- One profile.
- One permissions model.
- One source and trust model.
- One Action Center.
- One Search and knowledge graph.
- One Workspace.
- One AI policy layer.
- One notification system.
- One audit trail.
- One data-retention model.
- One design system.
- One mobile and accessibility standard.

### What stays bounded

| Domain | Semester can eventually support | Non-negotiable |
| --- | --- | --- |
| Academic records | Transcript, degree audit, enrollment, credentials | Registrar governance, audit history, records retention, reporting, legal review |
| Registration | Enrollments, waitlists, add/drop, approvals | Transaction integrity, concurrency, capacity rules, rollback, audit, financial dependency checks |
| Gradebook | Official grades, submissions, assessments | Faculty workflow, grade release, accommodations, retention, integrity, export, appeals |
| Financial aid | Workflow and aid operations | Regulatory expertise, eligibility rules, institutional authority, secure records, reporting |
| Payments | Tuition, invoices, plans, refunds | Hosted payment provider, PCI scope management, ledger integrity, reconciliation, financial controls |
| Housing | Contracts, assignments, payments | Housing policy, room inventory, privacy, legal contract management, support operations |
| Health | Resource navigation and scheduling | Never a clinical record system without the regulation, governance and security it needs |
| Emergency response | Institutional workflow support | Separate authorization, just-in-time access, legal review, complete audit, no ordinary admin access |

## The architecture principle for today

Until a domain is migrated, its official system stays authoritative; Semester receives only approved, minimum fields and shows where every fact came from.

| ID | Principle | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| p-boundary | Official-record boundary: the SIS and LMS stay authoritative for records, enrollment, holds and official grades unless Semester is deployed as that system | tested | `app/src/lib/integration/adapter.ts` — any non-read direction must sit behind a `writeback.*` flag<br>`app/src/lib/integration/mock-sis.test.ts` — SIS and degree-audit adapters are read-only<br>`app/src/lib/ltigate.test.ts` — the grade-passback gate | A gate, not a ban: when enabled, passback writes quiz scores to the LMS. |
| p-sis-fields | SIS gateway with the minimum fields: status, program, term, catalog, sections, enrollment, window, hold category, advisor | building | `app/src/lib/integration/mock-sis.ts` — the minimum field sets<br>`app/src/lib/integration/mock-sis.test.ts` — read-only, consent-scoped mapping | Only mock adapters exist; no real SIS gateway. |
| p-avoid | Fields avoided by default: detailed grades, finances, health, conduct, accommodation diagnoses, counseling notes, payment credentials | tested | `app/src/lib/integration/catalog.ts` — `NEVER_INGEST` and `NEVER_DISPLAY`<br>`supabase/canonical-display.check.sql` — the database refuses those keys | Enforced by field name; a sensitive value under an innocent name relies on the mapping review. |
| p-states | Seven source states on every imported item, with system, last updated and an official fallback | building | `app/src/lib/source.ts` — the five labels the database enforces<br>`app/src/lib/source.test.ts` — labels held to the check constraint<br>`app/src/lib/integration/freshness.ts` — stale and unavailable, in a separate vocabulary | Two vocabularies, not one seven-state model carried with system and fallback on every item. |
| p-pipeline | Durable sync: signature and schema validation, inbox, idempotency and replay, mapping, precedence, domain event, audit, reconciliation, exception queue | building | `app/src/lib/integration/pipeline.test.ts` — idempotency, timestamp regression, retry, dead-letter<br>`app/server/integration/worker.test.ts` — a duplicate is a duplicate; tenant from the connection | No inbound endpoint, so no signature check or durable inbox; reconciliation is never scheduled. |
| p-student-owned | Never overwrite student-created notes or plans with external data | tested | `app/src/lib/changeset.test.ts` — a moved deadline surfaces as a conflict, never replaced<br>`app/src/lib/merge.test.ts` — both notes kept across devices | Holds because the stores are separate; no explicit rule forbids an institutional sync from touching student rows. |
| p-holds | Hold cards: neutral category, source and time, official resolution route, never marked resolved by the student, nothing sensitive in notifications | tested | `app/src/lib/integration/school-records.ts` — “Action required before you can register — {office}”, never the reason<br>`app/src/lib/integration/school-records.test.ts` — only office and link; “no hold” only with fresh data | No hold-category field, no “this looks wrong” route, and no notification-content rule for holds. |
| p-advisor | Advisor Meeting Mode: the student chooses what to share, can revoke it, and private notes, health, finances and AI history never go | tested | `app/src/lib/advisor-meeting.test.ts` — only what the student ticked<br>`app/src/lib/advisor-shares.test.ts` — at most 120 days, revoke, read log<br>`app/src/components/AdvisorMeeting.test.tsx` — the preview leaves private notes out | Behind a flag; the shared agenda carries no sources or freshness. |
| p-support | Support routing: verified offices and why, hours, preparation, student-approved follow-up; urgent needs only to official resources | tested | `app/src/lib/nowrongdoor.test.ts` — crisis wording routed first; nothing typed is stored<br>`app/src/lib/help-routes.test.ts` — requests sent only on confirm | Offices are generic pointers, not institution-verified with hours. |
| p-ferpa | FERPA school-official control: agreement, authorized purpose, minimum fields, tenant isolation, no model training, retention, audit | building | `app/src/lib/trust/ai-training-policy.test.ts` — the no-training policy<br>`supabase/tenancy.check.sql` — tenant isolation<br>`docs/trust/DPA-CHECKLIST.md` — the agreement checklist | No signed data-processing agreement with any institution. |
| p-lti | LTI 1.3 launch with course context, deep links and assignment and grade services | tested | `app/src/lib/lti.test.ts` — launch and course context<br>`app/src/lib/ltideeplink.test.ts` — deep linking<br>`app/src/lib/ltiags.test.ts` — score post | The score write has no preview, reconciliation or exception queue; names and roles not requested. |
| p-oneroster | OneRoster roster, resource and gradebook exchange, adopted service by service | designed | `docs/INTEROPERABILITY-ROADMAP.md` — six OneRoster principles | No OneRoster code anywhere. |
| p-ai-policy | Course-level AI policy controls | tested | `app/src/lib/courserules.test.ts` — faculty-published, versioned rules shown before the assistant answers<br>`supabase/coursestudio.check.sql` — who may publish | Course and tenant layers only; no assignment layer. |

| not-started | designed | building | tested |
| ---: | ---: | ---: | ---: |
| 0 | 1 | 4 | 8 |

### The seven source states

Five are the labels the database enforces (`lib/source.ts`); two are freshness states (`lib/integration/freshness.ts`). The test holds each to exactly one.

| State | Meaning | Carried by |
| --- | --- | --- |
| Institution verified | Received from an approved, current institutional source | source label `institution_verified` |
| Imported | Received from a connected non-authoritative or user-authorized source | source label `imported` |
| Student entered | Entered or confirmed by the student | source label `student_entered` |
| Estimated | Calculated by Semester; not official | source label `estimated` |
| Needs review | Extracted or incomplete; requires confirmation | source label `needs_review` |
| Stale | Source has not refreshed within the expected window | freshness `stale` |
| Unavailable | Source could not be reached or data is not authorized | freshness `unavailable` |

### Hold categories

A hold is a source-controlled administrative state, not a generic item. Neutral language, source and time always shown, never a promise it will lift, and never marked resolved until the official source says so.

| Category | Semester supports | Official system keeps |
| --- | --- | --- |
| Advising | Checklist, advisor questions, appointment handoff | PIN release, approval, official clearance |
| Financial | High-level deadline, payment-plan link, aid-office questions | Balance ledger, payment, aid decision, release |
| Records | Document checklist, registrar contact, official link | Record review and hold release |
| Immunization / health | Neutral status and health-services handoff | Health data, documentation, clearance |
| Library | Resource link and contact | Fine or account detail and release |
| International | Compliance reminder, official adviser handoff | Visa and documentation record and decision |
| Conduct | General official contact path only | Case information, adjudication, release |
| Unknown | “Contact the official office” fallback | Internal determination |

## Registration, LMS and services expansion

| ID | Capability | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| e-regday | Registration Day Mode: countdown, time ticket, ranked backups, seat watch, copyable CRNs, official handoff, what changed | tested | `app/src/lib/registration-day.mode.test.ts` — countdown, CRN list, never says Semester registers anyone<br>`app/src/components/RegistrationDay.mode.test.tsx` — https-only handoff; no seat alerts without a live feed | No working seat watch and no “what changed” view; the time ticket is student-entered. |
| e-scenario | Academic scenario engine: what if I change majors, add a minor, study abroad, go part time | tested | `app/src/lib/graduation.test.ts` — term-by-term projection<br>`app/src/lib/scenario-compare.test.ts` — side-by-side plans<br>`app/src/lib/abroad.test.ts` — study-abroad planning | Credit and load arithmetic only; a change of major does not re-evaluate requirements. |
| e-course-page | Course intelligence pages: one detail page with fit, sections, schedule impact, outcomes, support and alternatives | tested | `app/src/components/CourseDetailV2.test.tsx` — every section with where it came from<br>`app/src/lib/course-detail.test.ts` — plan impact, related courses | Behind `course_detail_v2`; no people or resources on the page. |
| e-transfer | Transfer and dual-enrollment center | building | `app/src/lib/transferhub.ts` — eight workflows<br>`supabase/expansion.check.sql` — a student writes only estimated or submitted | No hub screen joins the workflows; dual enrollment is only a role. |
| e-studio | Native Course Studio: overview, syllabus, assignments, materials, study, office hours, projects, AI policy, official handoff | tested | `app/src/lib/coursestudio.test.ts` — AI rules and study packs checked before publishing<br>`supabase/coursestudio.check.sql` — publish rights, append-only versions | Publishes AI rules and packs only; no module, page or assignment authoring. |
| e-syllabus | Syllabus intelligence with a review screen before anything reaches the plan or calendar | tested | `app/src/lib/import-review.test.ts` — only approved, valid dates become the calendar<br>`app/src/lib/generate.test.ts` — dated items with verbatim quotes | Outcomes, office hours and AI policy are not extracted; no crunch-week view. |
| e-assignment | The assignment as a connected object: milestones, rubric checklist, sources, feedback into revision | tested | `app/src/lib/assignment.test.ts` — brief → outputs, rubric, dated steps<br>`app/src/lib/project.test.ts` — milestones and runway | No submission or receipt; not linked to requirements or skills. |
| e-practice | Practice assessments, grade estimator and “what score do I need?” | tested | `app/src/lib/examattempt.test.ts` — practice paper with autosave and receipt<br>`app/src/lib/whatif.test.ts` — what-if and what you then need | Estimates come from the student’s own records, not released grades. |
| e-faculty-assess | Faculty assessment: question banks, item versioning, rubric builder, grade release, regrade and moderation | building | `app/src/lib/exam.ts` — seeded draw over five item types<br>`app/server/institution/sandbox.test.ts` — release gating and appeal in the sandbox | No question banks, rubric levels or live grade release. |
| e-competency | CASE-compatible competency and skills alignment from program outcome to career pathway | not-started | `docs/INTEROPERABILITY-ROADMAP.md` — CASE deferred until competency mapping is real | No CASE identifiers anywhere. |
| e-group | Group-project workspace: charter, roles, timeline, board, peer feedback, reflections, shared artifact on consent | tested | `app/src/lib/groupwork.test.ts` — shared parts and pace<br>`supabase/groups.check.sql` — four-user row-level security walk | No peer-feedback workflow, instructor checkpoints or team portfolio artifact. |
| e-services-hub | Student Services Hub: each service a connected workflow, not a directory entry | building | `app/src/screens/Support.tsx` — office doors and checklists<br>`app/src/lib/campusdirectory.test.ts` — school-imported offices | The pieces are tested; no single hub joins them. |
| e-office-actions | Office action publisher: authorized offices publish into the Action Center with source, population, dates and approval history | tested | `app/src/lib/office-actions.test.ts` — office, link, source, dates, draft → review → published<br>`supabase/officeactions.check.sql` — publish roles and department scope | Behind `office_action_feed`; office actions do not reach search or the calendar. |
| e-life-planning | Financial and life planning: deadlines, scholarships, budget, work hours against credit load | tested | `app/src/lib/cost-plan.test.ts` — per-term cost lines with source labels<br>`app/src/lib/life-balance.test.ts` — work, commute and class hours | No scholarship tracker; work hours are not traded against credits in one view. |
| e-access-passport | Accessibility Passport: functional summary, student-chosen recipient and duration, read log, revocable | building | `supabase/expansion.check.sql` — issued by disability services; shared, time-limited, revocable; reads audited<br>`supabase/migrations/20260926150000_expansion_roles_and_features.sql` — the three passport tables | The database holds it; no screen issues, shares or shows it. |
| e-campus | Campus experience: verified events, clubs, accessible map, mentors, research and volunteer listings | tested | `app/src/components/CampusEvents.test.tsx` — school-supplied events<br>`app/src/components/MentorFinder.test.tsx` — mentors with two-sided consent<br>`app/src/lib/maps.test.ts` — the map | Directories are imported files; no content-governance workflow with owner and expiry. |
| e-standards | Standards: SAML/OIDC, SCIM, OAuth, iCal, Open Badges | building | `app/src/lib/oauthscopes.test.ts` — OAuth scopes pinned<br>`app/src/lib/ics.test.ts` — iCal<br>`app/server/institution/postgres-scim.test.ts` — SCIM | No OIDC sign-in; Open Badges not started. |

| not-started | designed | building | tested |
| ---: | ---: | ---: | ---: |
| 1 | 0 | 5 | 11 |

### The ten best next modules

1. `e-regday` — Registration Day Mode: countdown, time ticket, ranked backups, seat watch, copyable CRNs, official handoff, what changed (tested)
2. `e-studio` — Native Course Studio: overview, syllabus, assignments, materials, study, office hours, projects, AI policy, official handoff (tested)
3. `e-assignment` — The assignment as a connected object: milestones, rubric checklist, sources, feedback into revision (tested)
4. `p-advisor` — Advisor Meeting Mode: the student chooses what to share, can revoke it, and private notes, health, finances and AI history never go (tested)
5. `e-services-hub` — Student Services Hub: each service a connected workflow, not a directory entry (building)
6. `e-transfer` — Transfer and dual-enrollment center (building)
7. `e-competency` — CASE-compatible competency and skills alignment from program outcome to career pathway (not-started)
8. `e-group` — Group-project workspace: charter, roles, timeline, board, peer feedback, reflections, shared artifact on consent (tested)
9. `e-access-passport` — Accessibility Passport: functional summary, student-chosen recipient and duration, read log, revocable (building)
10. `e-life-planning` — Financial and life planning: deadlines, scholarships, budget, work hours against credit load (tested)

## What an institution needs to retire a system

The question is no longer what more Semester can do, but what must exist so an institution can confidently retire another system and run that domain through Semester.

| ID | Capability | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| m-migration-center | Migration Center: inventory, classification, mapping, cleaning, preview, sample import, validation, reconciliation, parallel run, cutover, archive, monitoring | tested | `app/src/lib/migration/center.test.ts` — the twelve stages, their gates and the arithmetic, held to the migration<br>`supabase/migration-center.check.sql` — every gate walked against the trigger, as the account that should be refused<br>`app/src/components/institutional/MigrationCenter.test.tsx` — the University tab: what is owed, the preview, the reconciliation, approvals | Behind `migrationCenter`, off by default, and not yet run with a real institution. Counts are the lead’s attributed claim about a file read in their browser; the database cannot re-run them. |
| m-migration-record | A record per migration: source and version, owner, classification, retention, mapping, cutoff, rollback plan, approvers | tested | `supabase/migrations/20260929200000_migration_center.sql` — `migration_projects`, `migration_field_maps`, `migration_runs`, `migration_approvals`<br>`supabase/migration-center.check.sql` — who reads and writes each; evidence append-only; audited | Validation tests are the three built-in counts, not rules an institution writes; known exceptions are not a field of their own. |
| m-parallel | Parallel run: the retiring system stays official while Semester runs in shadow and reports differences | tested | `app/src/lib/migration/center.test.ts` — the comparison and the parallel-run gate<br>`supabase/migration-center.check.sql` — a period that differs blocks cutover<br>`supabase/integration-quality.check.sql` — discrepancy rows for integration syncs | Differences are counted from exports the lead supplies; nothing yet runs a domain in shadow on its own schedule. |
| m-ledger | Account ledger with immutable entries, and invoices | tested | `supabase/student-accounts.check.sql` — a student-account ledger: signed entries written only on another person’s approval, append-only for the owner too<br>`app/src/lib/finance/accounts.test.ts` — a period’s statement, reproduced exactly from the ledger<br>`supabase/commercial.check.sql` — Semester’s own invoices: payment events append-only | Single-entry, signed per student, not double-entry against general-ledger accounts; statements are derived and numbered, not issued or sent. |
| m-checkout | Hosted checkout through a PCI-compliant provider; no raw card data | tested | `supabase/functions/_shared/billingcheckout.ts` — Stripe Checkout with an idempotency key<br>`app/src/lib/billing/checkout.test.ts` — the handler<br>`app/src/lib/billing/webhook.test.ts` — the signed webhook | Off until keyed; nothing has been charged. |
| m-refunds | Refunds, adjustments and reversals with role separation and approval thresholds | tested | `supabase/student-accounts.check.sql` — a requester never approves; whoever put a payment on the ledger does not approve its refund; above the threshold only finance:approve_high; a refund never exceeds what is left; a reversal is whole and once<br>`app/src/lib/finance/accounts.test.ts` — the same rules, checked before the database is asked | One threshold for every kind; no tiered limits or delegation, and Semester’s own subscription refunds still sit outside these controls. |
| m-reconcile-close | Provider, bank and ledger reconciliation, and monthly close | tested | `supabase/student-accounts.check.sql` — the ledger side computed by the database; a month closes only on a passing reconciliation recorded by someone else, with nothing waiting, and then takes nothing new<br>`app/src/lib/finance/accounts.test.ts` — provider settlement against ledger: missing, extra and different by reference | Provider to ledger only: there is no bank-statement leg, the settlement file is read by hand, and Semester’s own Stripe billing is not reconciled here. |
| m-disputes | Failed-payment and dispute workflow | tested | `supabase/commercial-automation.check.sql` — dunning: reminder, final notice, restrict, recover<br>`app/src/lib/billing/webhook.test.ts` — refunds and disputes recorded by kind | A chargeback is a ledger kind on student accounts, answering a payment and never exceeding it; there is still no evidence or outcome workflow for a dispute. |
| m-aid-boundary | Financial aid: no claim of replacement before regulatory expertise, agreements, controls and reporting exist | tested | `app/server/institution/money.ts` — aid as a labelled sandbox, applied by the institution<br>`app/server/institution/money.test.ts` — accept, decline and refusals | The boundary holds against the sandbox; no claim rule in the site’s claims register. |
| m-record-history | Append-only academic record history: effective date, reason, approver, previous value, source, correction without deletion | tested | `supabase/academic-record.check.sql` — an entry exists only on another person’s approval, names what it replaced, and is never edited or deleted, by the owner either<br>`app/src/lib/record/ledger.test.ts` — the record as of any date, the history, and the eight questions answered<br>`app/src/components/institutional/RecordLedger.test.tsx` — the Academic record tab | Behind `recordLedger`, off by default, and no school keeps its record here yet; students have no screen to read their own, and no importer loads a school’s existing record. |
| m-override | Registrar override controls and separation of duties | tested | `supabase/academic-record.check.sql` — a proposer never decides; correcting a grade, standing or conferral needs record:override, decided by the database from the ledger<br>`supabase/migrations/20260929210000_academic_record_ledger.sql` — record:propose, :approve, :override and :read | Two people is the only rule; there is no threshold, delegation or second approver for the gravest overrides such as rescinding a degree. |
| m-transcript | Transcript generation, credentials and degree conferral | building | `app/src/lib/record/ledger.ts` — the record as of a date, exported as CSV headed “Not an official transcript”; conferral is a ledger kind approved like any other<br>`docs/CREDENTIAL-WALLET.md` — design only; not a transcript replacement | No official transcript is issued, signed or sent, no credential is issued, and conferral has no degree-audit check behind it. |
| m-legal-hold | Legal-hold support | tested | `supabase/migrations/20260927200000_integration_hardening.sql` — `legal_hold` with a required reason<br>`supabase/integration-hardening.check.sql` — nothing old on a held connection goes<br>`supabase/migrations/20260930140000_erase_respects_holds.sql` — account erasure refuses under a hold<br>`supabase/legal-holds.check.sql` — erasure and sweeps respect holds; a bypass fails the check | Integration tables, retention sweeps and account deletion are hold-gated in the database. |
| m-service-desk | Unified Service Desk: request, routing, case, staff queue, escalation, service level, resolution, satisfaction | building | `supabase/migrations/20260928210000_support_tickets.sql` — tickets, agent queue, first-response targets<br>`supabase/support-tickets.check.sql` — every rule with two accounts and an agent<br>`supabase/help-requests.check.sql` — the office help inbox | Two separate queues, not one desk; no routing rules, escalation or satisfaction. |
| m-knowledge | Governed knowledge base: article owner, source, audience, review date, expiry, AI-use status | building | `app/src/lib/launch/content.ts` — content kinds with owner, review interval and expiry<br>`app/src/lib/launch/content.test.ts` — the kinds held | No article object; nothing carries an AI-use status. |
| m-comms | One communications engine: templates, segments, consent, quiet hours, caps, approval, delivery metrics | building | `app/src/lib/journey.guards.test.ts` — no source, no message; quiet hours<br>`app/src/lib/notify.test.ts` — per-tier daily caps<br>`supabase/officeactions.check.sql` — second-person approval for office notices | No templates, composer, email or SMS channel, or delivery metrics. |
| m-locale | Localization: languages, right-to-left, locale dates and zones, currencies, data residency | building | `app/src/lib/locale.ts` — locale formats, RTL and bidi isolation<br>`app/src/lib/locale.test.ts` — formats and RTL locales held | No message catalogue, no multi-currency, one region. |
| m-analytics | Privacy-safe analytics: group-size floors, no individual risk scores | tested | `app/src/lib/institution-ops.test.ts` — suppression and forbidden per-student metrics<br>`app/src/lib/cohortfloor.test.ts` — the app floor equals every SQL floor | No instructor course analytics. |
| m-governance | Data-governance workspace: catalog, owners, classification, retention, access review, consent, requests, deletion, audit search, PIA | building | `supabase/governance.check.sql` — governance registries<br>`app/src/lib/governance/pia.test.ts` — the PIA register<br>`supabase/deletion.check.sql` — deletion empties what it claims | No workspace joins them; no access review or audit-log search. |
| m-marketplace | Marketplace: developer registration, review, scopes, sandbox tenant, consent, revocation | designed | `docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md` — extension governance<br>`docs/SYNC-SIMULATION-SANDBOX.md` — the sandbox design | Nothing for third parties exists. |
| m-academy | Implementation Academy: role paths, certification, partner and migration-specialist training | designed | `docs/FACULTY-ENABLEMENT.md` — the faculty plan<br>`docs/LAUNCH-CONTENT-AND-TRAINING.md` — the training content plan | No curriculum, tracking or certification. |
| m-continuity | Enterprise continuity: export guarantee, exit help, escrow, continuity and recovery plans, tested restore, service level, insurance | tested | `app/src/lib/rehearsal.test.ts` — the restore rehearsal in CI<br>`app/src/lib/sla.test.ts` — the service-level arithmetic<br>`docs/DATA-PORTABILITY-AND-OFFBOARDING.md` — the offboarding steps | Production never restored; no escrow, insurance certificate, exit terms or tenant-wide export. |

| not-started | designed | building | tested |
| ---: | ---: | ---: | ---: |
| 0 | 2 | 6 | 14 |

### The twelve final areas

| Area | Rows | Weakest |
| --- | --- | --- |
| Migration Center | `m-migration-center`, `m-migration-record` | tested |
| Authoritative academic-record ledger | `m-record-history`, `m-override`, `m-transcript` | building |
| Financial-control system | `m-ledger`, `m-checkout`, `m-refunds`, `m-reconcile-close`, `m-disputes` | tested |
| Unified Service Desk | `m-service-desk` | building |
| Governed knowledge base | `m-knowledge` | building |
| Communications engine | `m-comms` | building |
| Localization and international architecture | `m-locale` | building |
| Privacy-safe analytics and data governance | `m-analytics`, `m-governance` | building |
| Semester Marketplace | `m-marketplace` | designed |
| Implementation Academy | `m-academy` | designed |
| Enterprise continuity package | `m-continuity` | tested |
| Parallel-run and cutover architecture | `m-parallel`, `r-parallel` | tested |

## The standard

> A university can run its academic journey, learning environment, student services, campus life, career ecosystem, communications, and institutional workflows from Semester — while maintaining control, security, accessibility, data portability, and continuity.

The last requirement is not another feature. It is institutional confidence.
Of 95 rows here, 56 are held by a test, 31 are being built, 4 are designed and 4 are not started.
