# Registrar capability register

The registrar replacement specification ("expand outline … build entire registrar") names this register as its next implementation artifact: every capability linked to repository code, each classified by what has actually been reached. It is the build backlog for the native registrar scope. It does not claim the scope is built, deployed or authoritative.

**Evidence baseline:** `origin/main` at `436687a1`, assessed 2026-10-13. Test results were produced locally in this pass (see §Verification). The only remote check is the migration history of Supabase project `lzrqvlugnawcgywkhqlz`, read on 2026-10-18 (see Next executable tasks, item 1). Tables, functions and app state were not checked against that project, and nothing here was checked against an institution.

## Status key

Each row carries the highest status the evidence supports. A status is not inherited from a neighbouring row.

| Status | Meaning in this register |
|---|---|
| **Designed** | Specified in docs or a spec; no code path found. |
| **Implemented** | Code exists in the repository, in-app only. |
| **Tested** | Implemented, and automated tests exist and passed in this pass. |
| **Deployed** | Running in a named environment. **No row is at this status yet.** The three registrar migrations are recorded in the migration history of Supabase project `lzrqvlugnawcgywkhqlz` ("semester"), read on 2026-10-18. That shows the migrations were applied, not that the tables or functions they create exist or behave as the row describes, and no app deployment was verified. A row moves to Deployed only after its objects are checked in that environment. |
| **Institution-authorized** | Approved by the institution's authorities. **No row.** |
| **Production-enabled** | Authoritative for the institution. **No row.** |

Authority: `docs/learning-university-systems/SIS-AND-REGISTRAR-ROADMAP.md` states that holds, waitlists, enrollment, withdrawals, transfer credit, standing, degree audit and graduation remain authoritative in the SIS/registrar domain until separately activated. Every row below is therefore non-authoritative today.

## A. Academic structure and policy

| ID | Capability | Status | Repository evidence | Gap to next status |
|---|---|---|---|---|
| A1 | Academic calendar, deadlines, registration windows | Tested | `app/src/lib/registrar.ts` (`TermDate`, `LANDMARKS`, `parse`, `fromCalendar`); `term.ts`, `termtransition.ts`; tests `registrar.test.ts`, `registrar.calendar.test.ts`, `term.test.ts`, `termtransition.test.ts` | Not bound to effective-dated policy versions. |
| A2 | Credits, grading scales, GPA | Tested | `credits.ts`, `termgpa.ts`, `gpasheet.ts`, `gradebook/compute.ts` (`schemeProblems`, `letterFor`, `finalGrade`); tests `credits.test.ts`, `termgpa.test.ts`, `gpasheet.test.ts` | Grade modes, repeat and forgiveness rules are not verified as versioned policy. |
| A3 | Effective-dated academic policy publication and reproduction under historical policy | Designed | No policy-version table or publication workflow found in this pass. | Entire capability. Acceptance: reproduce a record under the policy in force at the time. |

## B. Curriculum and catalog

| ID | Capability | Status | Repository evidence | Gap to next status |
|---|---|---|---|---|
| B1 | Course identity, versioned descriptions, prerequisites | Designed | `Courses.tsx` and `EditCourse.tsx` are the learning course catalog (Course Studio), not an academic curriculum. | Academic course versions, prerequisites, corequisites, cross-listing. |
| B2 | Programs, requirement groups, substitutions | Partial | `degree.ts` and `degree.test.ts` evaluate requirements; the requirement model's versioning is not verified. | Program versions and catalog-year binding. |
| B3 | Curriculum approval workflow and catalog snapshots | Designed | Not found in this pass. | Entire capability. |

## C. Course scheduling

| ID | Capability | Status | Repository evidence | Gap to next status |
|---|---|---|---|---|
| C1 | Sections with capacity | Implemented | `registration_sections` table (`supabase/migrations/20260929300000_registration_transaction.sql`, line 110). | Offerings, meeting patterns, rooms, instructor assignment, reserved seats, cross-list capacity sharing. |
| C2 | Schedule publication, cancellation, student-impact queues | Designed | Not found in this pass. | Entire capability. |

## D. Registration and enrollment

| ID | Capability | Status | Repository evidence | Gap to next status |
|---|---|---|---|---|
| D1 | Transactional seat allocation | Implemented | `registration_transaction.sql`: sections read `for update` (lines 713, 805, 868, 1075, 1136); unique index `registration_enrollments_one_live` (line 153). | Concurrent load against real Postgres not verified in this pass. |
| D2 | Idempotent commands | Implemented | `registration_transaction.sql`: key required on every writer (line 634); same key with different arguments returns `idempotency_conflict` (line 588). | Idempotency under retried concurrent calls not verified. |
| D3 | Eligibility gates, waitlist promotion, skip reasons | Tested | `app/src/lib/enrollment/service.ts` (`gateReason`, `submit`, `promote`, `waitPosition`, `cartRequests`); `enrollment.test.ts`, `client.test.ts`. | Holds with responsible offices, permission-number overrides, credit-load checks on the resulting schedule, seat-offer expiry, swap atomicity — not verified. |
| D4 | Authority mode | Designed | Roadmap: SIS remains authoritative; Semester prepares and records pending outcomes. No external-authority adapter verified. | Connector for the legacy SIS; reconciliation of timeouts. |

## E. Grades and academic history

| ID | Capability | Status | Repository evidence | Gap to next status |
|---|---|---|---|---|
| E1 | Append-only academic-record ledger: proposed → approved, reason, effective date, supersession | Tested | `supabase/migrations/20260929210000_academic_record_ledger.sql` (header: nobody writes the ledger directly; changes are proposed with a reason and effective date); `app/src/lib/record/ledger.ts` (`KINDS`, `SOURCES`, `ACTIONS`, `MIN_REASON`); `record/ledger.test.ts`. | Not connected to enrollment or gradebook posting; no posting workflow verified. |
| E2 | Course attempts linked to enrollment, official grade posting | Designed | Course gradebook (`gradebook/ledger.ts`: `enterScore`, `release`, `moderate`, `fileRegrade`, `resolveRegrade`) is learning-assessment grading. No link from a gradebook release to an official academic-record posting was found. | Attempt model; authorised posting event. |
| E3 | Working versus official grades, incomplete contracts | Designed | Gradebook draft and release states exist; official-grade separation and incomplete contracts not found. | Entire capability. |
| E4 | LMS grade passback with reconciliation | Tested | `gradebook/passback.ts` (`planPassback`, `runPassback`, `reconcile`); `passback.test.ts`. | This is course-to-LMS sync, not the registrar record. |

## F. Transfer and credit evaluation

| ID | Capability | Status | Repository evidence | Gap to next status |
|---|---|---|---|---|
| F1 | Transfer-credit record kind and source | Implemented | `record/ledger.ts` includes `transfer_credit` kind and `transfer_evaluation` source. | No evaluation workflow. |
| F2 | Transcript intake, equivalencies, articulation, manual queue, appeal | Designed | `transferhub.ts` is a student-facing transfer guidance hub (sources, timeline, MVP list), not a credit evaluator. | Entire evaluation pipeline. |

## G. Degree audit and graduation

| ID | Capability | Status | Repository evidence | Gap to next status |
|---|---|---|---|---|
| G1 | Degree audit | Tested | `degree.ts`; `Degree.tsx`; `degree.test.ts`. | Not verified: pinning to exact curriculum and policy versions; separation of what-if from official audit. |
| G2 | Graduation applications, clearance, conferral | Tested | `graduation.ts`, `graduation-cloud.ts`; `graduation.test.ts`, `graduation-cloud.test.ts`; `conferral` kind with override in `record/ledger.ts`. | Clearance workflow, duplicate-award prevention and conferral authority not verified. |
| G3 | Standing | Tested | `standing.ts`; `standing.test.ts`. | Not verified against versioned policy. |

## H. Transcripts and record services

| ID | Capability | Status | Repository evidence | Gap to next status |
|---|---|---|---|---|
| H1 | Official transcript generation and snapshot | Designed | `transcript.ts` loads **video-episode transcripts** (`load(courseId)`, `hasTranscript(courseId, episodeId)`), not academic transcripts. Searches for PESC, conferral and articulation in `app/src/lib` found no transcript-exchange module. | Entire capability: snapshot, recipient checks, fulfilment, verification, delivery receipts. |
| H2 | Transcript verification and disclosure accounting | Designed | Not found in this pass. | Entire capability. |

## I. Registrar operations

| ID | Capability | Status | Repository evidence | Gap to next status |
|---|---|---|---|---|
| I1 | Registrar workspace screen | Implemented | `app/src/screens/Registrar.tsx`; `app/src/lib/replaceregister.ts` (domain-level replacement register). | Unified work queue, ownership, service targets, delegated approvals. |
| I2 | Reconciliation | Partial | Gradebook drift reconciliation (`passback.ts`); registration-readiness store (`supabase/migrations/20261009160000_registration_readiness_store.sql`). | Registrar reconciliation workbench over SIS and enrollment differences. |
| I3 | Reporting, term open/close, archival | Designed | Not found in this pass. | Entire capability. |

## Cross-cutting requirements (spec §4–§8)

| Area | Status | Evidence | Gap |
|---|---|---|---|
| Canonical entities (§4) | Partial | Sections, registrations, enrollments, academic-record changes exist. | Most entity families in §4 have no table. |
| Role and access control (§6) | Not verified | Repository has role-grant tables (`20260921161500_roles.sql`, `20260924213000_role_grant_audit.sql`). Registrar-specific role bundles and field-level rules not verified. | Registrar role bundles; separation of duties. |
| Connected events (§8) | Not verified | Outbox and domain-event migrations exist (`20260928320000_audit_correlation_and_outbox.sql`, `20261008183934_emit_domain_event.sql`). No registrar event contract (e.g. `EnrollmentConfirmed`) verified as emitted. | Event contracts and consumers. |
| Migration authority (§9) | Designed | `docs/migration/workbooks/academic_records.md` exists; roadmap sets P1 read-only, P3 gated. No authority register entries are active. | Discovery, mapping, rehearsal, shadow runs, institutional approval. |

## Work packages (spec §11)

| Package | Status | Note |
|---|---|---|
| R01 Current-state reconciliation | Partial | This register is the first pass. |
| R02 Policy and academic structure | Designed | No versioned policy model found. |
| R03 Canonical records | Partial | Ledger and sections exist; not complete. |
| R04 Scheduling | Partial | Sections only. |
| R05 Enrollment | Tested (in-app) | Non-authoritative. |
| R06 Academic history | Partial | Ledger exists; no posting from grades. |
| R07 Transfer | Designed | Ledger kind only. |
| R08 Degree and graduation | Tested (in-app) | Non-authoritative; audit pinning not verified. |
| R09 Record services | Designed | No transcript module. |
| R10 Governance and operations | Partial | Audit and outbox migrations exist; registrar governance not verified. |
| R11 Migration | Designed | Roadmap only. |
| R12 Replacement acceptance | Not started | Requires institutional decisions. |

## Verification run in this pass

```bash
cd app
npx vitest run src/lib/enrollment src/lib/gradebook src/lib/term.test.ts src/lib/credits.test.ts \
  src/lib/degree.test.ts src/lib/graduation.test.ts src/lib/standing.test.ts \
  src/lib/transcript.test.ts src/lib/transferhub.test.ts src/lib/registrar.test.ts \
  src/lib/graduation-cloud.test.ts
# Test Files  14 passed (14)
# Tests       294 passed (294)

npx vitest run src/lib/record src/lib/replaceregister.test.ts
# Test Files  4 passed (4)
# Tests       46 passed (46)

npx vitest run src/lib/termgpa.test.ts src/lib/gpasheet.test.ts src/lib/termtransition.test.ts \
  src/lib/registrar.calendar.test.ts
# Test Files  4 passed (4)
# Tests       79 passed (79)
```

Not run: `npx tsc -b`, `npm run lint`, `npm run check:university`, `npm run test:shuffle`, `npm run build`. This change is documentation only, so the gates were not required for it; they remain required for any code change.

## Blockers to the next statuses

- **Institutional decisions** (spec §12): policy owners' approval of rule interpretation; registrar acceptance of historical cases; privacy and counsel review of disclosure controls. None is recorded in the repository.
- **Named owners and capacity** (spec §11): the work-package owners are proposed roles. No person has been assigned.
- **Authority transfer:** nothing in this repository is authoritative. The roadmap keeps the SIS authoritative.
- **Deployment:** no staging or production target is specified. Remote migration history was read for one project (item 1 below), and table, function and app state there was not checked. Production deployment needs the approvals listed in the spec's §12 and the release gates in §10.

## Next executable tasks (in order)

1. ~~Check remote migration state~~ **Done (2026-10-18).** `academic_record_ledger` (`20260929210000`), `registration_transaction` (`20260929300000`) and `registration_readiness_store` (`20261009160000`) appear in the migration history of project `lzrqvlugnawcgywkhqlz`. The project was chosen from the proxy configuration; four Supabase projects are visible, and the mapping to this repo should be confirmed. Table-level state was not checked. Next: confirm the app deploy target.
2. **Policy-version binding (A3, R02):** add effective-dated policy versions and bind grading, credit and standing calculations to the version in force. Acceptance: a golden test reproduces a historical record under its original policy.
3. **Official transcript snapshot (H1, R09):** build an immutable snapshot of the academic record at issue time, with a recipient check. Acceptance: re-issuing an old transcript reproduces the original snapshot after later corrections.
4. **Gradebook-to-record posting (E2):** an authorised posting event that creates an academic-record change from a released grade. Acceptance: every posted grade traces to its authority and policy.
5. **Concurrency test (D1):** run last-seat contention against real Postgres. Acceptance: no double allocation under concurrent requests.

Each task needs a decision record under `docs/decisions/D-<pull request number>.md` when it is opened as a pull request.
