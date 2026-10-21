# PDF to code reconciliation

**As of** 2026-10-05 · **PDF** native Education Operating System brief, 22 pages, read in full · **Base** `origin/main` `3bd382dc`

> **Claim ceiling.** Classifications describe the repository and the live `semester` project. They do not describe a customer deployment. "Native and verified" is reserved for a behavior held by an automated test with no open launch gap. No PDF domain earns it. "Native but incomplete" means code and, usually, tables exist and a named gap remains.

The brief's doctrine is the product thesis, not a status report:

> Build the full native Semester platform now. Use integrations only as controlled transition bridges. Replace legacy domains only after proof, migration, institutional approval, reconciliation, and rollback readiness.

The repository already states the same rule in [`docs/master/SEMESTER_DATA_AUTHORITY_MATRIX.md`](../master/SEMESTER_DATA_AUTHORITY_MATRIX.md) and [`docs/master/SEMESTER_DOMAIN_REPLACEMENT_GATES.md`](../master/SEMESTER_DOMAIN_REPLACEMENT_GATES.md). Today: **0 of 14** replacement domains are replaceable. This reconciliation does not move that number.

## How to read a row

Unless a row says otherwise:

| Field | Default |
| --- | --- |
| Tenant scope | Account for student-owned content; `school_id` where the table has one. F-01: school isolation is off. |
| Consent | Account-owned. Sharing is a separate grant (advisor, family, support). |
| AI policy | Explain, draft, rank, cite. Never an official grade, enrolment, payment, discipline, or safety decision. |
| Accessibility | WCAG 2.2 AA is the build target. No qualified human evaluation (EXT-008). No "conformant" claim. |
| Security / privacy / retention | RLS on. Classification and retention standards exist as documents. Per-table classes are rule-derived and not human-reviewed. |
| Audit | Sensitive mutations are supposed to write `audit_event`. Tamper-evidence is an open finding (F-10 in the trust model). |
| Support owner | One person holds or acts in seven launch-council seats; none has signed. |
| SLO | Class targets in `docs/sre/07-RESILIENCE-BACKUP-DR-AND-CHAOS.md`. Every RTO/RPO reads unmeasured. |
| Release evidence | 0 of 142 master-register rows are `operational` or `launch-approved`. |
| Authority | Not the institutional system of record. |

## Platform map

| PDF | Name | Repo home | Class | Authority today | Next action |
| --- | --- | --- | --- | --- | --- |
| A | Education experience / Student OS | `screens/Today.tsx`, `lib/nav.ts`, `lib/today-center.ts` | Native but incomplete | Student device plus labelled imports | Keep one shell. Do not add a second app. |
| B | Academic and learning | `screens/Courses.tsx`, `Gradebook.tsx`, `Study.tsx`, `Degree.tsx` | Native but incomplete; LMS is the record | Institution LMS / SIS | Do not call the gradebook official. |
| C | Registrar / SIS / records | `screens/Registrar.tsx`, `Registration.tsx`, `academic_record_*`, `registration_*` RPCs | Transitional; unsafe to activate | SIS | Parity, dual-run, registrar sign-off before any cutover. |
| D | Student success | `screens/Support.tsx`, help RPCs, sandbox advising | Native but incomplete; caseload not built | Advising/CRM | Build caseload only behind consent and capability. |
| E | Productivity | `screens/Calendar.tsx`, `Mine.tsx`, `Write.tsx`, `Sheet.tsx`, `app/server/productivity/` | Native but incomplete | Student-owned; sync off unless enabled | Finish account sync before calling it a suite. |
| F | AI and intelligence | `supabase/functions/claude`, `screens/settings/Assistant.tsx`, `ask` screen, `ai_spend` migration | Native but incomplete | Semester for policy and usage; provider for inference | Wire the decision flow before any new agent. |
| G | Campus services | `Dining.tsx`, `Housing.tsx`, `Meals.tsx`, `dining_*` RPCs | Native but incomplete + handoff | Office systems and dining partner | Partner contract before ordering is live. |
| H | Student finance | `screens` account/costs/bill, `student_account_*` | Native but incomplete; unsafe to activate | Bursar / payment provider | No raw card data. No authoritative ledger claim. |
| I | Career / alumni | `screens/Career.tsx`, `Opportunities.tsx`, `skill_*` | Native but incomplete; sandbox employers | Student-owned evidence | Never label a claim institution-verified. |
| J | Community | `screens/Community.tsx`, `Moderation.tsx`, `community_*` | Native but incomplete; unsafe to activate | Semester for its own posts | High-risk moderation stays refused for production. |
| K | Family / guardian | `screens/Family.tsx`, `family_*`, `guardian_*`, k12 migrations | Native but incomplete; unsafe to activate | Semester consent ledger | Time bounds, revocation, and audit before any share. |
| L | Institution control plane | `tenant_*`, `school_*`, `scim_*`, configuration and workflow migrations | Native but incomplete | Semester for its own config; IdP for identity | SSO/SCIM stay off until isolation (F-01) is fixed. |
| M | Integration and migration | `integration_*` (16 tables), `migration_*`, `supabase/functions/lti`, `canvas` | Integrated only as a bridge; adapters empty | Each source system | No domain becomes native-authoritative from a connector. |
| N | Trust, security, privacy | `docs/trust/`, `screens/TrustRoom.tsx`, `screens/Privacy.tsx`, legal-hold migrations | Designed/documented + partial code | Semester for its own evidence | Human review before any certification sentence. |
| O | Company operations | `docs/master/SEMESTER_COMPANY_OPERATING_SYSTEM.md`, `gtm_*`, commercial tables | Designed/documented + partial schema | Company-internal | Do not invent runway, customers, or insurance. |
| P | Operations Command Center | `screens/Console.tsx` (10 tabs) | Native but incomplete | Internal operators with `console:operate` | PDF's long section list is not built. |
| Q | Developer platform / marketplace | `docs/API-PLATFORM.md`, productivity OpenAPI | Designed/documented; marketplace not started | None for third parties | No OAuth client issuance, no marketplace listing. |
| R | Education graph | Per-domain tables, not one graph | Designed/documented | Each object's owner | Do not add a second graph beside source labels. |
| S | Technical stack | Vite/React/TS, Supabase, Vercel, RLS | Native and present as the stack | — | Extend it. Do not split a second frontend. |
| T | Market strategy | `docs/business/`, finish-line commercial docs | Designed/documented | — | Entry wedge is a plan, not a signed pilot. |

## Experience workspaces the PDF names

| PDF workspace | What exists | Class |
| --- | --- | --- |
| Student OS | The app. 7 areas, 63 destinations, 97 screen ids. | Native but incomplete |
| Applicant | Onboarding and launchpad. No admissions SIS. | Designed/documented |
| Faculty | Course guidance publish RPCs, gradebook item/score RPCs. No assignment builder, no rubric builder, no roster UI. | Native but incomplete |
| Teaching assistant | No TA role path found in community endorse or grading. | Not started |
| Advisor | Advisor share RPCs. Caseload, check-in, and success plan are absent (`docs/master/SEMESTER_GAP_REGISTER.md`). | Native but incomplete |
| Student success | Help requests and office actions. No intervention tracker. | Native but incomplete |
| Registrar | `Registrar.tsx`, `registrar_*` RPCs. Not the SIS. | Transitional; unsafe to activate |
| Student accounts | Account and bill screens, ledger tables. | Unsafe to activate |
| Financial aid | Directory handoff only. | Transitional |
| Campus services | University, maps, meals, dining, housing screens. | Native but incomplete |
| Housing | `Housing.tsx`. Maintenance request workflow absent. | Transitional |
| Dining | `Dining.tsx`, `dining_*` RPCs, module flag. | Native but incomplete |
| Library / research | Sources, study, analyse. No library system. | Native but incomplete |
| Accessibility services | Accommodation tables exist. No approval workflow; the gap register says approval is never stored. | Designed/documented; unsafe to store decisions |
| Community | `Community.tsx`, `Moderation.tsx`. | Unsafe to activate |
| Family / guardian | `Family.tsx` and grant RPCs. | Unsafe to activate |
| Career / employer | `Career.tsx`. Employer review is sandbox. | Pilot-only data; not a network |
| Alumni | Register text only. No transition workflow. | Not started |
| Institution administration | Control-plane tables, university screen. | Native but incomplete |
| IT / security | Trust room, audit tab, break-glass tab. | Native but incomplete |
| Operations Command Center | Console, 10 tabs. | Native but incomplete |
| Public company and trust site | `company-site/`, `TrustRoom.tsx`. | Native but incomplete |

## Doctrine checks

| Rule in the brief | Held? |
| --- | --- |
| One frontend | Yes. Work stays in `app/`. |
| No second data model | Required. Catalogs point at existing tables. This pass adds none. |
| No second navigation, token, audit, or workflow engine | Required. Design map in the source-of-truth doc. |
| AI is not an official decision | Stated in product copy and in this folder. Not mechanically enforced on every future tool. |
| Integration is a bridge | Stated. `ADAPTERS` empty is the prior catalog's reading; this pass did not re-open that file. |
| Replace only with proof | 0 domains authoritative. Gates unchanged. |
| Do not fabricate customers, revenue, certification | This folder states none. Estimated rows are seed and catalog, not a cohort. |

## What the PDF asked to generate, and where it went

The PDF's "Build:" list names architecture essays (`NATIVE_PLATFORM_ARCHITECTURE.md`, `NATIVE_AI_PLATFORM.md`, and fifteen siblings). Those essays would duplicate `docs/master/` and this crosswalk. They were not created. The twelve files in this folder are the Phase 0 contract from the execution command. Architecture content lives in the domain, screen, workflow, role, authority, and capability documents.
