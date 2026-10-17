# Semester ecosystem — coverage matrix against the 16-week plan

Audit of the Perplexity "week-by-week implementation plan" PDF against this
repository, measured at `origin/main` `b711c5c7`, 13 October 2026.

This is a **gap audit, not a build**. Its verdicts are measurements from grep
and file counts, labelled as such. Where a row says *not measured*, nothing was
checked and nothing is claimed. It does not replace
[`SEMESTER_IMPLEMENTATION_STATUS.md`](../SEMESTER_IMPLEMENTATION_STATUS.md),
which is the authoritative status against
[`SEMESTER-MASTER-COMMAND.md`](../SEMESTER-MASTER-COMMAND.md).

## Status vocabulary

| Status | Meaning |
| --- | --- |
| **Implemented** | Code exists that does the thing, measured by a file or a grep |
| **Partly** | Some of it exists; the row says what does not |
| **Absent** | Nothing in the repository does this, by name or by its equivalent |
| **Conflict** | The repository does something else on purpose, and says so in writing |
| **Not measured** | Not checked in this audit. Not a claim either way |

Not used here: *verified*, *deployed*. Neither was checked. The PDF's own
build rule is that a capability is active only when it is built, tested,
RLS-checked, audited, and deployed. Nothing below meets that bar on
measurement alone.

## What the PDF assumes, and what the repository is

| PDF assumption | Repository measurement |
| --- | --- |
| Empty repo; Week 1 creates a skeleton | Mature app: `app/` plus 5 packages (`contract`, `institution`, `offline-sync`, `platform`, `platform-control`) |
| 21 migrations, 227 tables | 239 migration files; 344 distinct table names created across them |
| Server-side Postgres as the system of record | Local-first app with IndexedDB (`lib/migrate.ts`, `state/slices/notes.ts`) and Supabase for accounts and cloud tables |
| Student data in `students` | Student data in `profiles`; courses in `courses`; `students` does not exist |
| 98 literal route paths such as `/app/today` | 185 screen files in `app/src/screens`; no route literal matches `/today`, `/registrar` or the other PDF paths. The repo's routing scheme is not the PDF's, so route coverage is **not measured** by path |
| Rego policy package from Week 3 | 15 `.rego` files exist. Their coverage against the PDF's permission grammar is **not measured** |
| 117 decisions (not in the PDF) | `docs/decisions/` holds 117 records. The repo's rule is that a new decision is `docs/decisions/D-<PR number>.md`, so decisions do not go into the PDF's flat plan |

The repository's own plan is explicit: the current phase is "finish Part B's
foundation, then begin Part A's", and Part A (§46–63) has not started. The PDF
does not mention this plan.

## Table-name check against the PDF's domain list

Measured by grepping `create table` across `supabase/migrations` for each name
in the PDF's domain table. **15 of about 150 PDF example tables exist under the
same name.** The rest are absent *by name*, which does not prove the behaviour
is absent: the repository may hold it under another name (for example `profiles`
for `students`).

Present by name: `courses`, `tasks`, `messages`, `blocks`, `profiles`, `schools`,
`communities`, plus eight others.

Absent by name, with the nearest repository equivalent where one is known:

| PDF table | Nearest in repo | Note |
| --- | --- | --- |
| `accounts`, `sessions`, `memberships`, `roles`, `grants`, `tenants` | Supabase Auth; `profiles.school_id` | No tenant or membership model |
| `policies`, `policy_decisions`, `consents`, `delegations`, `revocations` | `packages/platform-control`, 15 rego files | Not measured against this list |
| `audit_events`, `evidence_artifacts`, `release_manifests`, `approvals` | `docs/` evidence, `release` scripts | Not measured as tables |
| `workflow_instances`, `job_leases`, `dead_letters`, `outbox_events`, `receipts` | `packages/offline-sync` | Not measured |
| `integrations`, `integration_credentials`, `sync_runs` | not measured | |
| `files`, `file_versions`, `source_documents`, `source_chunks`, `citations` | IndexedDB notes (`state/slices/notes.ts`) | Client-side only |
| `students`, `goals`, `notifications`, `saved_views` | `profiles`; no notifications table | |
| `sections`, `assignments`, `study_assets`, `study_sessions`, `ask_threads` | Client-side study state | Server tables absent |
| `calendar_sources`, `calendar_events`, `conflicts`, `availability_windows` | `Calendar.tsx` | Client-side |
| `degree_requirements`, `degree_audits`, `what_if_plans`, `grade_drafts` | `Degree.tsx`, `Grades.tsx` | Client-side |
| `caseloads`, `cases`, `support_requests`, `readiness_cases`, `holds`, `override_requests`, `time_tickets` | none | Absent |
| `payment_intents`, `payment_receipts`, `refunds`, `ledger_entries`, `subscriptions` | none | Absent. Finance is not built |
| `employers`, `opportunities`, `applications`, `career_events` | `Career.tsx`, `Opportunities.tsx` | Client-side |
| `family_profiles`, `delegated_views`, `delegation_audit` | `Family.tsx` | Client-side |
| `applicants`, `decision_letters` | `Applying.tsx` | Admissions beyond that is absent |
| `alumni_profiles`, `engagement_events`, `giving_refs` | none | Absent |
| `posts`, `comments`, `appeals` | `Community.tsx`, `Moderation.tsx` | `communities` exists; `posts` and `comments` do not by name |
| `listings`, `offers`, `orders`, `disputes` | none | Marketplace is absent |
| `leads`, `accounts_b2b`, `quotes`, `contracts`, `renewals` | none | Company CRM is absent |
| `employees`, `candidates`, `vendors`, `legal_documents`, `board_reports` | none | Company operations are absent |
| `developer_orgs`, `api_keys`, `scope_grants`, `webhooks`, `deliveries` | none | Developer portal is absent |

## Domain coverage, one row per PDF domain

Identifiers are `D-` plus the PDF's domain name. Screen counts are file names
in `app/src/screens`, not routes.

| Id | Domain | Workspace / system | Screens or routes (repo) | Status | Evidence | Blocker or open question |
| --- | --- | --- | --- | --- | --- | --- |
| D-identity | Identity | Shared | `Account.tsx`, `Recovery.tsx`, `Onboarding.tsx`, `FirstRun.tsx` | Partly | Sign-up, sign-in, reset, sign-out in `cloud.ts`; `private.verified_student()` in policies | No tenant, membership, or role model; PDF Week 2 not built |
| D-tenant | Tenant / control | Shared | `Console.tsx` | Partly | `schools` table (multi-university, deliberately unseeded); `platform-control` package | No `tenants`, `workspace_registry`, or `feature_configs` |
| D-policy | Policy / consent | Shared | `Privacy.tsx`, `Agreements.tsx`, `Data.tsx` | Partly | 15 `.rego` files; `Agreements.tsx` | Permission grammar against the PDF not measured |
| D-audit | Audit / evidence / release | Operations | `Proof.tsx`, `Export.tsx` | Not measured | `docs/` evidence | No audit table found by name |
| D-workflow | Workflow / jobs | Shared | none | Not measured | `packages/offline-sync` | PDF's worker and lease model not checked |
| D-integrations | Integrations | Shared | `Connect.tsx`, `Import.tsx` | Partly | Import and connect screens exist | No `integrations` table; no credential store |
| D-files | Files / documents | Shared | `Sheet.tsx`, notes slice | Partly | Client-side (IndexedDB) | No server file store |
| D-student | Student core | Student | `Today` (no file), `Launchpad.tsx`, `Calendar.tsx`, `Me.tsx`, `Mine.tsx` | Partly | Courses built per status doc §47.x | Notifications and saved views have no table |
| D-courses | Courses / learning | Student | `Courses.tsx`, `EditCourse.tsx`, `Lesson.tsx`, `Guides.tsx` | Partly | Course rooms built; `courses` table exists | Study assets and sessions are client-side |
| D-calendar | Calendar | Student | `Calendar.tsx` (plus keyboard and open-cal tests) | Partly | Built on the client | No `calendar_events` table |
| D-progress | Academic progress | Student | `Degree.tsx`, `Grades.tsx`, `Gradebook.tsx`, `Analyse.tsx` | Partly | Client-side | No `degree_audits` table |
| D-advising | Advising / support | Staff | none by name | Absent | | No caseload or case model |
| D-registrar | Registrar | Institution | `Registrar.tsx`, `Registration.tsx` | Partly | Screens exist | No readiness, holds, or overrides tables |
| D-finance | Finance / ledger | Institution | `Bill.tsx`, `Costs.tsx` | Partly | Screens exist | No payment, ledger, or refund tables. Finance is absent as a system |
| D-campus | Campus life | Student | `Housing.tsx`, `Dining.tsx`, `Meals.tsx`, `Activities.tsx`, `Athletics.tsx` | Partly | Screens exist | No housing or meal-plan tables |
| D-career | Career | Student | `Career.tsx`, `Opportunities.tsx` | Partly | Screens exist | No employer or application tables |
| D-family | Family | Family | `Family.tsx` | Partly | Screen exists | No `family_profiles` or delegation-audit table |
| D-admissions | Admissions | Applicant | `Applying.tsx` | Partly | Screen exists | No applicant or decision tables |
| D-alumni | Alumni | Alumni | none by name | Absent | | |
| D-community | Community | Student | `Community.tsx`, `Groupwork.tsx`, `Classmates.tsx`, `Moderation.tsx` | Partly | Community screen and moderation exist | Reporting partly built per status doc §58 |
| D-marketplace | Marketplace | Student | none | Absent | | |
| D-company | Company CRM and ops | Company | none | Absent | | |
| D-people | People, vendor, legal | Company | `People.tsx` | Partly | Screen exists | No employee or vendor tables |
| D-developer | Developer / partner | Developer | none | Absent | | |

Counts are measured and not interpreted: 185 screen files, 344 distinct
tables, 239 migrations, 15 rego files, 117 decision records.

## Week-by-week mapping

| Week | PDF objective | Repo status | Notes |
| --- | --- | --- | --- |
| 1 | Program setup | Implemented | Monorepo, CI, environments, and gates exist. The PDF's skeleton is already past |
| 2 | Identity backbone | Partly | Sign-up and sign-in exist. No memberships, grants, or workspace switcher |
| 3 | Policy backbone | Partly | Rego files exist. Decision contract and permission grammar not measured |
| 4 | Data foundation | Partly | 239 migrations and RLS on the tables that exist. PDF's exact schema not present. Migrations conflict with the PDF's numbering if followed literally |
| 5 | Workflow backbone | Not measured | `packages/offline-sync` exists. Worker, lease, and dead-letter model not checked |
| 6 | Shared platform services | Absent as a unit | Notifications, files-as-server, search, and feature config are not built as services |
| 7 | Public + onboarding | Partly | Public and onboarding screens exist; role routing not measured |
| 8 | Student core | Partly | Built in part; see D-student |
| 9 | Learning core | Partly | Course rooms and study screens exist; AI source boundaries not measured |
| 10 | Institution core | Absent in server form | Faculty, advisor, registrar, and finance workspaces are screens, not systems |
| 11 | Readiness and finance | Absent | No readiness, payment, or ledger tables |
| 12 | External and lifecycle | Absent | No applicant, alumni, employer, or developer data model |
| 13 | Community and marketplace | Partly / Absent | Community partly built; marketplace absent |
| 14 | Company and operations | Absent | No company tables; operations screens are not measured |
| 15 | Integrations and hardening | Not measured | Adapters and drift detection not checked |
| 16 | Launch proof | Not started | Not a measurable state today |

## Where the PDF and the repository disagree on purpose

These are not gaps. They are decisions the repository has already made and
written down. The PDF's plan would reverse them without saying so.

- **Multi-university.** The repository seeds no school, on purpose, and its
  `schools` table is readable before sign-in. The PDF's tenant-first model
  assumes a tenant per organisation.
- **Local-first data.** Files and study state live in the browser. A PDF plan
  that moves them to Postgres is a change of architecture, not a build step.
- **Deadline ownership.** The repository's `Item` is the syllabus's record and
  keeps the source sentence and any move; it is not an enum of states. See
  Phase 1 in `SEMESTER_IMPLEMENTATION_PLAN.md`.

## Top unbuilt items, in order

1. **Phase 1 of the repository plan (§91, the deadline record).** Re-measured
   against `origin/main` on 13 October 2026, this is **partly built**, not
   absent as the matrix first said:
   - Status (step 1): **built.** `app/src/lib/stage.ts` derives the seven §91
     statuses from existing facts (`task.from`, `state.started`, `state.done`,
     `state.returned`) and adds two stored maps, `ready`/`submitted`.
   - Stored effort override (step 2): **not built.** `lib/pace.ts`
     `estimate(spent, courseId, kind)` infers effort per kind; no per-item
     stored value overrides it.
   - User-set priority (step 3): **not built.** No `priority` on `Item`.
   - Subtasks on the item (step 4): **partly.** `components/BreakItUp.tsx`
     writes tasks with `from`; they are not hung off the item as a record.
   - Attachments and links on a deadline (step 5): **not built.** Note
     attachments exist (`state/slices/notes.ts`); deadlines have none.
   Blocks Phase 2 until steps 2–5 are done or explicitly deferred.
2. **A notifications model.** Named in the PDF's Week 6 and in the Student
   routes. Not built as a table or service.
3. **Tenant and membership model.** Week 2 in the PDF. Needed before any
   staff or family workspace can be scoped correctly. Conflicts with the
   local-first architecture; needs a decision before building.
4. **Finance ledger.** Weeks 11 and the registrar path. Absent. Needs a
   product decision on payments before any build.

## Open decisions

These change scope, architecture, or cost. They need an answer before
building the affected rows.

1. Does the repository adopt the PDF's server-side tenant model, or keep the
   local-first model with server sync added? It changes D-identity, D-tenant,
   and every row that depends on them.
2. Is finance (payments, ledger, refunds) in scope for this product at all?
   The status doc does not list it as a requirement.
3. Which of the PDF's 16 weeks, if any, should be followed as written? The
   repository's own plan is the proposed source of truth.

## Method

Measurements were taken from `origin/main` `b711c5c7` on 13 October 2026:

- Migration count: files in `supabase/migrations`.
- Distinct table names: `create table` statements across those files.
- PDF table check: `create table` grep for each name in the PDF's domain list.
- Screens: files in `app/src/screens`.
- Routes: literal string search for each PDF route path under `app/src`. No match
  for any PDF path, so route coverage is not measured.
- Rego: `git ls-files` filtered to `.rego`.
- Decisions: files in `docs/decisions`.

Nothing was run: no tests, no build, no typecheck. The working tree was clean
before this document was written.
