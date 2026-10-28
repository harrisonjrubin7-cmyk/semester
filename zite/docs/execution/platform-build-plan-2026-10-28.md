# Semester platform build plan (owner PDFs S-79, S-80, S-81 — 28 Oct 2026)

Three owner documents, one plan. They ask for: (1) Semester Institution and Semester Faculty rebuilt as the institutional
and teaching sides of the same product, on the Student app's shell; (2) all ten Zite apps completed as one education
operating system that natively replaces SIS, LMS and university systems domain by domain; (3) the 69 roles and 32
domains delivered as **workspaces inside the ten apps**, not as more top-level apps.

Status words follow the register: designed / implemented / tested / deployed / institution_authorized /
production_enabled. Nothing here is deployed, institution-authorized or production-enabled. A menu item is not a workflow.

## 1. Model

| Concept | Meaning | Example |
|---|---|---|
| App | Audience entry point (10, fixed) | Semester Institution |
| Workspace | Task-focused area inside an app | Registrar, Course Studio, Procurement |
| Domain | Canonical capability that owns the records | Enrollment, Learning, Accounting |
| Integration | Controlled link to an outside authority or rail | Payment network, IdP, card readers |

Rules carried from the PDFs and the existing build book: app entry and record authorization are separate; switching app
or role switches authorization context; Faculty submits a grade, only the records process makes it official; private
learner work is never instructor- or institution-readable by default; company staff, employers and testers get no blanket
access to student records; Health Services stays blocked before design.

## 2. The ten apps (Wave 0 inventory, observed 28 Oct)

| App | Audience | Routes / pages / endpoints | State today |
|---|---|---|---|
| Semester (Student) | Students, learners | 93 / 82 / 98 | Broadest; most tested workflows live here |
| Semester Institution | Registrar, advisors, administrators, service teams | 7 / 6 / 4 | Shared shell (28 Oct); overview, section requests, structure, holds, access, audit |
| Semester Faculty | Instructors, bounded TAs | 25 / 4 / 24 | Shared shell (28 Oct); reuses Student course, grading, integrity, curriculum pages |
| Semester Applicants | Prospective and admitted students | single page / 2 | Thin |
| Semester Family | Delegates, authorized payers | single page / 2 | Thin |
| Semester Employers | Employers, recruiters | single page / 3 | Thin |
| Semester Site | Public | 17 / – / 3 | Published |
| Semester Company OS | Semester staff | 26 / – / 18 | Broad, internal |
| Semester Security Lab | Assurance | 12 / 11 / 11 | Release evidence |
| Semester Developers | Developers | single page / 3 | Thin |

All Faculty and Institution endpoints are front doors over the Student app's implementations (decision C23): one
implementation, one data store — the PDFs' "shared canonical facts, not competing copies".

## 3. Zite verification checklist (S-80 §3)

From `zite-capability-assessment.md` plus today's work. "Semester-owned" means the invariant is enforced in our own
Postgres functions rather than assumed from the platform.

| # | Item | Status |
|---|---|---|
| 1 | Cross-app identity and session | Supported: one account opens every app (AppSwitcher); not tested through the login UI |
| 2 | App-user vs workspace-editor access | Not yet verified with a non-editor account |
| 3 | Server-enforced tenant and record isolation | Supported in endpoint code; cross-tenant probes passed; `endpointAuth` guard requires sign-in on every endpoint |
| 4 | Field protection / restricted projections | No platform field permissions; enforced by endpoint projections |
| 5 | Atomic transactions and concurrency | Platform: unsupported. Semester-owned: Postgres functions with locks; races measured (registration, grading policy) |
| 6 | Unique constraints / duplicate prevention | Semester-owned unique indexes and request keys |
| 7 | File authorization and revocation | Semester-owned private store, grants, quarantine (`fil_*`) |
| 8 | Background job and webhook authorization | Not yet verified |
| 9 | Pagination, bulk, reporting limits | Partly: listing limits in code; not load-tested |
| 10 | Secrets and environment isolation | Secrets supported; environment separation unsupported as used |
| 11 | Backup, restore, retention, export, deletion | Export supported; restore not exercised |
| 12 | Deployment versioning, rollback, monitoring | Partly: git + publish history; monitoring not set up |
| 13 | Institutional identity provider (SSO) | Not yet verified |
| 14 | Accessibility of the interface | Contracts in code (labels, focus); no browser audit run |

## 4. Shared shell and states (Wave 1)

Implemented 28 Oct: `apps/semester/src/components/AppShell.tsx` — the Student shell's dark rail, wordmark, institution and
role selector, grouped navigation, top bar with term context, search and notifications, scope bar, "All workspaces"
finder (⌘K), mobile tabs and app launcher, driven by a per-app manifest. Faculty and Institution use it and the Student
tokens (`index.css`); their Tailwind config now also scans Student source, fixing missing styles on reused pages.

Errors: `lib/clientError.ts` turns endpoint failures into safe text (server's user-facing message, a reference code,
never `authz:` strings, SQL or stack traces). Used by all three apps.

Institution 403 (S-79 §1): traced. The overview always requested aggregate analytics (`readiness.read`, Staff and
Administrator only). The viewer was a Student or Faculty member, so the denial was correct; the defects were requesting
it unconditionally and rendering the raw message. Fixed: `institutionOps` `access` reports the caller's capabilities
(not an access attempt, not logged); the overview asks only for what the viewer may see and explains what is not shown;
the Action Center count shows "could not load" rather than 0. Authorization is unchanged.

Faculty states (S-79 §1): Today now distinguishes denied, could not load, no assigned sections, no sections in the
chosen term, and sections being set up (section requests naming the instructor, `forMe`).

Still open in Wave 1: Action Center, Mail, Calendar and Workspace as shared shell destinations in Faculty and
Institution; context switching that re-runs queries; overlapping Student labels (below).

Student label overlaps (S-81 §3), to resolve in the Student manifest: My final grades / Grades / Grade tracker →
official grades / released course grades / private what-if tracker; Accommodations / Disability services →
implementation notices / request-and-review service; Housing / Residence life; Career / Career services; Study / Study
guides / Toolkit; Work and HR / Recruiting; Audit / Procurement / Inventory (student receipts and requests only).

## 5. Institution and Faculty workspace manifests

The full manifests from S-79 / S-81 are the target. A destination is shown only when it exists and the person's role
includes it. Present today:

- **Institution:** Today · Sections & teaching assignments · Academic structure · Holds · Access & connections · Audit &
  assurance. Built in the Student app and reachable for staff there: registrar queue and ledger, official grades,
  grading policy, academic standing, registration requests, accommodations, admissions, aid office, analytics, data
  governance. Next: surface these in Institution through front doors.
- **Faculty:** Today · Office hours · Grading queue · Gradebook · Extensions & regrades · Academic integrity · Curriculum
  proposals · Section requests · Study guides · Reading lists, plus the course workspace (Course Studio: syllabus,
  materials, assignments, assessments, discussion, groups, attendance, grading, teaching team, accessibility, deadlines).
- **Missing from both** (each needs the full vertical slice, not a page): content & modules with versioned publication,
  announcements, course mail, teaching portfolio, research, workload and appointments; catalog and curriculum
  publication, terms and scheduling, degree evaluation and graduation, transfer, admissions administration, financial
  aid, student accounts, workforce, finance and procurement, campus operations, research administration, governance.

## 6. Connected journeys (S-79 §5, S-80 §12)

| Journey | Status |
|---|---|
| Section proposal → approval → instructor → publication → registration → roster | Implemented and tested (section requests, registration race, roster reconciliation); not yet run with two accounts end to end |
| Assignment → submission → grading → released feedback | Tested with two real accounts 28 Oct (27/27) |
| Final grade → records validation → official posting → student result | Tested in the database; posting needs a registrar account |
| Hold → student response → authorized release → fresh eligibility | Holds and release exist; student response step not built |
| Accommodation decision → minimum-necessary notice → implementation | Letters, acknowledgement and accommodation extensions exist; assessment timing not built |
| Term completion → archive → retention → course reuse without prior student data | Not built |
| Admission → first class; aid → reconciled account; need → delivered support; evidence → employment | Partial pieces; not connected end to end |

## 7. Waves (S-80 §13; dependency order, not calendar promises)

| Wave | Work package | Exit evidence | Status |
|---|---|---|---|
| 0 | Inventory and reconcile the ten apps | App/source map, gap register | This document |
| 1 | Identity, authorization, data contracts, shared shell | Cross-app context works; unauthorized direct calls fail safely | In progress (shell, errors, capabilities, sign-in guard done) |
| 2 | First connected SIS/LMS journey | Registration → roster → submission → grading → official record passes | Mostly tested; registrar posting pending a third account |
| 3 | Full academic lifecycle | Catalog, scheduling, transfer, records, graduation, applicant transition | Not started beyond records |
| 4 | Financial lifecycle | Ledger, aid, payments, refunds, reconciliation | Ledger pieces exist; money movement disabled by rule |
| 5 | Student services and campus operations | Accepted referrals, bookings, entitlements, work orders | Partial |
| 6–8 | Enterprise, research, migration and native operation | Per-domain replacement register gates | Not started |

## 8. Next increments

1. Institution front doors for registrar work already built in the Student app (official grades queue, grading policy,
   academic standing, registration decisions), shown by capability.
2. Faculty Today as a work list (next class, decisions, grading queue, questions, content to review) with scoped,
   state-aware counts.
3. Assignment versioning: publish an exact version; revising never changes what was assigned or submitted.
4. Multiple attempts and group submissions.
5. A third account with a sample Staff role to run registrar posting, two-registrar policy approval and standing appeals.
