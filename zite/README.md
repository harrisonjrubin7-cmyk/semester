# Semester on Zite

This folder is a snapshot of the Semester Zite monorepo (workspace `1c4b0d16210e8d4b`), imported from Zite commit
`e9d7082` on 2026-10-29 (previous import: `53bba1a`, 2026-10-29)

**Zite is still the source of truth for this folder.** Edits are made in the Zite project and re-imported here; a change made
only in this folder will not reach the running Zite apps. It is kept separate from `app/` and is not part of the root npm
workspaces, so it does not change installs, builds or tests of the existing app.

## Apps

| Folder | Zite app | Purpose |
|---|---|---|
| `apps/semester` | Semester (`jeabiv2536`) | The connected product: student, faculty, staff and institution workspaces, 69 role apps, Semester Intelligence |
| `apps/semester-company-os` | Company OS (`sbjuykr2qw`) | Internal company operations: finance, CRM, incidents, marketing, migrations, support access, board |
| `apps/semester-site` | Site (`qd1fxwimuc`) | Public website |
| `apps/semester-applicants` | Applicants (`eqm85cdpm7`) | Applicant portal |
| `apps/semester-employers` | Employers (`qmccgvt5tr`) | Employer portal |
| `apps/semester-family` | Family (`vpysx5dj4n`) | Guardian view of what students share |
| `apps/semester-security-lab` | Security Lab (`jw85ejkuj1`) | Capability evidence and release gates |
| `apps/semester-developers` | Developers (`sci91lofpm`) | Developer platform console and sandbox |

Traceability and status registers live in `docs/execution/` (source manifest, requirement and module registers,
conflicts and decisions, `NEXT_ACTIONS.md`).

## Status

Designed, implemented, tested, deployed, institution-authorized and production-enabled are separate states. Code here is
implemented in Zite and covered by the unit suites (`sh apps/semester/tests/run.sh` inside a Zite sandbox) and by
rolled-back database checks recorded in each Zite commit message. Only the Site is published; Semester and Company OS are
not published, and nothing here is production-enabled or institution-authorized.

Secrets are not in this folder: Zite holds credentials server-side (`.env.local` is not tracked).
