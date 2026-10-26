# Scope coverage (updated 25 Oct 2026)

Status columns are independent: designed, implemented, tested, deployed, institution-authorized, production-enabled.
Across every area: **deployed = no** (only the Site app is published), **institution-authorized = no**,
**production-enabled = no**. "Tested" below means pure-module unit suites plus rolled-back database checks
recorded in commit messages; browser, accessibility, load and hosted-sync tests are NOT RUN.

Module inventory (S-53, 135 apps in 13 groups): [`module-register.csv`](module-register.csv) — 8 implemented, 93 partial, 34 missing (first-pass, per module).
Per-capability detail for the 69 role apps: [`role-app-requirements.csv`](role-app-requirements.csv)
(460 capabilities: 167 existing, 120 incomplete, 173 missing; regenerate with `tools/roleAppRequirements.ts`).

| # | Area | Implemented in Zite (main modules) | Largest gaps |
|---|---|---|---|
| 1 | Public sites, discovery, admissions, applicants | Site (published), Applicants app (inquiry/application prep), `admissions` | Program discovery, fit/cost comparison, visits; admitted-student checklist |
| 2 | Accounts, SSO, memberships, delegation, consent | Zite auth, `onboard`, memberships + epochs (`plt_epoch`), consent ledger, context switching (`ctx_*`, `contextSession`) | SAML/OIDC SSO (C5), device/session management, delegation, multi-school |
| 3 | Planning, degree requirements, registration readiness | `progress`, `registration` (window + max credits), `catalog` rules, `transfer` path comparison, graduate milestones | Curriculum versions, workload/cost scenarios, full degree audit |
| 4 | Learning and Course Studio | `learn` (syllabus versions, materials), `teaching`, `regrade`, `study` | Assessments/question banks, submissions, gradebook release, integrity |
| 5 | Registrar/SIS | `registrarQueue/Decide/Ledger`, academic calendar, catalog, transfer evaluation, **waitlists and registrar-decided drop/atomic swap (`registrationChanges`, wl-001)** | Rooms/scheduling, reserves, conferral, transcripts, official reporting; transcript posting disabled; concurrent-decision load test NOT RUN |
| 6 | Advising and student services | advising cases, `advisorShare`, `tutoring`, `accommodations`, `referrals` (outbox), `alumni` | International, veterans, athletics, study abroad workflows |
| 7 | Productivity | tasks, notes, study workspace, search, inbox | Documents/sheets/decks, files (private storage blocked), offline sync, collaboration |
| 8 | Campus services | `campus`, community | Housing, dining entitlements, maintenance, spaces, library, jobs |
| 9 | Student accounts and aid | `accountServices` (disputes, proposals approved-not-posted), `financialAid` | Payments, refunds, payment plans, ledger posting (disabled by rule) |
| 10 | Career and credentials | career page, Employers app, portfolio | Evidence verification, credentials, applications, internships |
| 11 | Communities and organizations | `community` + moderation (APP-007) | Elections, budgets, marketplace, fulfillment, appeals |
| 12 | Institutional administration | Console: readiness, roles, approvals, retention, audit, privacy and access reviews, analytics with disclosure control | Feature cohorts, entitlements, offboarding |
| 13 | Integrations and developer platform | connectors (status), outbox consumer + two-person replay, **mappings and drift (36e5838)**, Developers app, sandbox API, app review | Live SIS/LMS/SSO sync, reconciliation runs, dual run/cutover, SDKs, webhooks |
| 14 | Semester Intelligence | 97-profile registry, composed prompts, 3 enabled specialists, run-state reducer, tool input validation, AI egress gate | Memory, spend controls, evaluations, action execution (disabled by design) |
| 15 | Company operations | Company OS: finance, CRM, incidents, marketing, migrations, support access, board, trust center | Contracts/procurement, customer success depth |
| 16 | Security, audit, recovery | audit log, Security Lab, append-only triggers, two-person rules | Backups/restore drills, observability, incident runbooks exercised |
| 17 | Brand, design system, mobile, localization | shared kit components, responsive layouts | Token parity with `app/` design system, localization, jurisdiction rules |
| 18 | Hermes, Mail, other named items | none | Specifications not found in supplied files; recorded as unresolved |

See also domain-families.csv (S-54: 45 families, 34 partial / 11 missing) and cross-app-workflows.csv (10 acceptance workflows, all NOT RUN).
