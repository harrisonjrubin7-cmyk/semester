# Current state

**As of** 2026-10-06. **Base** `origin/main` `1ba54a92`. **Branch** `audit/semester-mainframe-reconciliation`.

This page is repository evidence. Production projects, deployed rows, customer tenants, and live RLS were not inspected. Those facts are **unverified**, not complete and not absent.

The operations program already reconciled a similar brief. Where this page and `docs/operations/OPERATIONS_ROADMAP.md` disagree on a count, regenerate the count from the catalog. Do not hand-copy a figure from an older page. The roadmap’s own contradiction list (capabilities, roles, tables, definers) is still open.

## What was read

- `CLAUDE.md`, root `package.json`, `app/package.json`.
- `docs/operations/OPERATIONS_ROADMAP.md` and the role boundary in `app/src/lib/role.ts` and `app/src/lib/rolelaunch.ts`.
- Registration surfaces: `app/src/screens/Registration.tsx`, `app/src/screens/Yes.tsx`, `app/src/components/RegistrationPortal.tsx`, `app/src/components/RegistrationReadiness.tsx`, `app/src/lib/path-readiness.ts`.
- `docs/specifications/semester-mainframe.pdf` (10 pages, text extracted). The role-flow and web-versus-native PDFs were opened far enough to confirm title, page count, and that they are requirements, not a deployment audit. See `docs/specifications/README.md`.

## Repository shape

Root `package.json` is an npm workspace (`app`, `packages/*`) with one lockfile. Scripts run from `app/`, not the repository root. `packages/` holds `contract`, `institution`, `offline-sync`, and `platform`. `video/` and `pipeline/` keep their own manifests.

This environment’s Node is v22.23.3, which satisfies `engines.node` `>=22` and the jsdom range. `supabase/migrations` contains 185 SQL files. That count is a file count, not a claim about which migrations have been applied anywhere.

The app is a Vite + React + TypeScript client. Institutional writes go through the gateway under `app/server/` and `packages/institution`. Hash routing is the navigation model the operations roadmap already recorded: the brief’s `/app/ops/*` paths are aliases, not a second router.

## Nine layers, as the code stands

| Layer | What exists in the repository | What this audit did not verify |
| --- | --- | --- |
| A. Entry and onboarding | Signed-out local use. Syllabus import, by-hand course, and now a device registration plan on `FirstRun`. Account, SSO, and recovery exist as product surfaces and gateway code. | A live identity provider, a named tenant, and production session configuration. |
| B. Role experience | Client `Role` in `lib/role.ts` (student, faculty, teaching assistant, advisor, admin, staff, applicant, payer, family, alumni). `forRole` hides student-addressed screens. `rolejourney.ts` maps each role to a screen that role can already open, or to null. | Server membership for a real person. Choosing a role on the device does not grant a roster, a caseload, or a bill. |
| C. Domain engines | Student planner (`yes` / Term plan), official registration screen gated off (`registration`), learning and study screens, advising meetings, student-account UI, campus, community, career. | No domain here is the institution’s system of record. |
| D. Shared core | Capability grants, approval and audit machinery, module gates, device libraries, outbox described in the operations docs. | Production audit rows. The roadmap says the chain has never recorded a production row. That sentence is a repository claim, not a new production query. |
| E. Data | Local catalogue on the device. Postgres migrations for institutional records. Education-graph metadata is specified, not proven as one queryable graph. | Applied schema and row counts in any hosted database. |
| F. AI | Assistant calls are keyed. The registration plan does not call a model. AI policy docs and a kill switch exist in the repository. | A production provider, spend, or evaluation set. |
| G. Control planes | Company console at `#/console`. Institution side is the University screen’s tabs. | Operator staffing, a real tenant, and that the console’s writes cannot bypass approval. The roadmap marks that bypass open (F-1). |
| H. Integration | Catalog import, YES paste, registration writeback behind `writeback.registration_submit`, migration docs. | A live SIS or LMS connection. |
| I. Trust | CI scripts, RLS in migrations, design-system and accessibility gates, trust-room copy. | Backups, restore drills, and incident paging against a running environment. |

## Registration, three different things

These are already separate. This batch does not merge them.

1. **Device plan.** `FirstRun` can take a term and course codes, store empty courses with source `Added by hand`, and open the Term plan. With no imported catalog, the Term plan lists those codes and says they are not a section, a seat, or an enrollment. The registration-readiness checklist has a separate row, `named`, for those codes. That row stays short of ready. The cart’s primary-schedule row is the only one that can become ready from a selected section.
2. **Term plan.** `Yes` / `RegistrationPortal` is the student’s cart, conflicts, and saved schedules from an imported catalog. Saving a schedule records “No enrollment was submitted.”
3. **Official transaction.** `Registration.tsx` is enroll, waitlist, drop, and withdraw. The gate copy says the school has not turned registration on, so those actions still happen in the school’s system. Registrar actions require `registration:administer`. Client navigation does not grant that.

`RegistrationReadiness` already tells the student the checklist is preparation, not clearance, and names SSO, LTI, OneRoster, and official writes as unconfigured or handoff-only.

## Client role is not a permission

`lib/role.ts` decides which screens a chosen role is addressed. `lib/rolelaunch.ts` separates `OPERATIONS_ONLY` capabilities from `STUDENT_RECORD` capabilities and tests that a platform or commercial role does not receive the second list. Semester employment is not a grant to student records. That test is repository evidence. It is not a production access review.

## This batch

The local increment is the device registration plan described above. It reuses `blankCourse`, `addCourse`, `FirstRun`, and `RegistrationPortal`. It does not write a migration, call a registrar, or create a console.

## Not claimed

The nine-layer diagram in the mainframe PDF is the target. It is not a statement that every box is implemented or deployed. No customer, signed pilot, or production row count was verified in this session.
