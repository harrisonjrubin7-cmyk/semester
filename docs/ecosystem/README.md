# Semester ecosystem build: inventory and status

This folder holds the master inventory and coverage matrix for the Semester
handoff package (two uploaded archives, read in full on 2026-10-12). It is the
record of what exists, what is specified, and what is blocked. Nothing here
claims a screen works. Status words follow the ladder below, and a row moves
up only when its evidence is in the repo.

## Status ladder

`proposed` → `specified` → `in progress` → `implemented` → `verified` → `deployed`.
`blocked` can sit on any rung and names the blocker.

- **specified**: the handoff describes it (prototype screen, stream file or spec). No code.
- **implemented**: code exists in the repo, with tests where it is logic.
- **verified**: the repo gates pass on it and the evidence is listed here.
- **deployed**: running in a named environment. Nothing is deployed yet.

## Where the build stands (read from main, 19 October 2026)

The stream and phase reports in [`../execute/`](../execute/) are the authority on
progress. This table only points at them.

| Stream or phase | State | Evidence |
| --- | --- | --- |
| 00 Repo audit and design-system sync | complete; baseline approved by the founder | [`00-setup-report.md`](../execute/00-setup-report.md), [`D-1287`](../decisions/D-1287.md), [`D-1648`](../decisions/D-1648.md) |
| 01 Platform core | first slice landed; most of the 33-item work list open | [`01-platform-core-report.md`](../execute/01-platform-core-report.md), [`01-platform-core-diff.md`](../execute/01-platform-core-diff.md) |
| 02 Identity and SSO | complete in mock form; the remaining gates are human (IdP metadata, test accounts, group names) | [`02-identity-sso-diff.md`](../execute/02-identity-sso-diff.md) |
| 08 Projection foundation | recommendation and first slice | [`08-projection-foundation-diff.md`](../execute/08-projection-foundation-diff.md) |
| 30 Phased build, phases 0 to 5 | phase 0's first two deliverables done; phases 1 to 5 each have a report, and none of their exit gates is met | [`30-phase-0`](../execute/30-phase-0-coverage-report.md) to [`35-phase-5`](../execute/35-phase-5-enable-and-replace-report.md), [`capability-register.csv`](../execute/capability-register.csv) |
| Every other stream (03 to 07, 09 to 29) | not started as a stream; some routes they own exist from earlier work, per the matrix | `COVERAGE-MATRIX.csv` |

**App target ([`D-1648`](../decisions/D-1648.md)).** `app/` stays Vite + React,
and the API stays in `app/server`, `app/api`, the Supabase RPCs and the edge
functions. No Next.js `web/` app is created. Stream 01's diff marked the
handoff's Next.js routes `drop` because the gateway already does their job.

**`lib/core` removed ([`D-1648`](../decisions/D-1648.md)).** The nine
`semester-core` modules that [`D-1502`](../decisions/D-1502.md) placed in
`app/src/lib/core/` had no caller, and six of them repeat existing repo logic.
They were removed, along with their two draft equity reviews. The four
behaviours with no repo counterpart are listed in D-1648 as backlog. Each is to
be built beside the first screen that needs it.

## What the handoff contains

- `The_Main_Semester_design_system_2_copy_7.zip`: a `handoff/` tree of 644 files,
  about 33 MB uncompressed. It has 8 top-level docs and `execute/` with 31 stream
  prompts (00 to 30). `manifest.json` lists only streams 00 to 24.
- `The_Main_Semester_design_system_3.zip`: a `live-integration` bundle of 9 files. It holds
  one Supabase migration (`20261011120000_live_integration.sql`, eight `live_*` tables),
  five edge functions (SIS sync via OneRoster, LTI 1.3 launch, Stripe payments and
  webhook, messaging, institution command receipts) and a Playwright spec. It ships
  switched off, and every switch needs a named approver.

The archives are not copied into the repo. The handoff's own intake (START-HERE.md)
puts them in `design/`, which is a decision for the owner (see decisions below).

## Workspaces in the prototype inventory

Counts come from `screens.json` (281 routes across 26 workspace keys). The
handoff's own documents disagree on the total: `manifest.json` says 25 workspaces
and 281 routes, and `PHASES.md` says 20 workspaces and 123 screens. This table
follows `screens.json`, the most granular source.

| Workspace | Key | Routes |
| --- | --- | --- |
| Public site | `public` | 8 |
| Applicant / admitted | `applicant` | 4 |
| Student | `student` | 62 |
| Faculty | `faculty` | 17 |
| Institution | `institution` | 19 |
| Advisor | `advisor` | 7 |
| Teaching assistant | `ta` | 4 |
| Financial operations | `finops` | 4 |
| Support desk | `support` | 3 |
| Admissions | `admissions` | 6 |
| Career Hub | `career` | 4 |
| Campus services | `campus` | 5 |
| Marketplace moderation | `marketplace` | 3 |
| Institutional insights | `insights` | 3 |
| Trust console | `trust` | 21 |
| Family delegate | `family` | 3 |
| Alumni | `alumni` | 7 |
| Employer | `employer` | 3 |
| Company | `company` | 17 |
| Operations | `operations` | 17 |
| Semester OS home | `os` | 8 |
| Student success | `success` | 4 |
| Executive OS | `executive` | 4 |
| Club leader | `clubs` | 4 |
| Semester Social (desktop) | `social` | 13 |
| Semester Studio | `studio` | 31 |

## Build streams and their route counts

Streams come from `manifest.json`. Each stream's exit gate is in
`BUILD.md` §4. Route status is in the generated `COVERAGE-MATRIX.csv`, not in
this table.

| Stream | File | Routes assigned |
| --- | --- | --- |
| 00 | `setup` | 0 |
| 01 | `platform-core` | 0 |
| 02 | `identity-sso` | 0 |
| 03 | `student-os` | 39 |
| 04 | `staff-academic` | 13 |
| 05 | `institution-integrations` | 11 |
| 06 | `ai-gateway` | 0 |
| 07 | `community-career-family` | 4 |
| 08 | `ops-command-center` | 0 |
| 09 | `trust-security` | 0 |
| 10 | `launch` | 0 |
| 11 | `company-site-grow` | 20 |
| 12 | `one-place` | 0 |
| 13 | `platform-maturity` | 0 |
| 14 | `native-platform` | 0 |
| 15 | `native-finance` | 2 |
| 16 | `native-operations` | 0 |
| 17 | `web-to-app-journey` | 0 |
| 18 | `role-system` | 28 |
| 19 | `academic-records` | 32 |
| 20 | `social` | 32 |
| 21 | `work-studio` | 32 |
| 22 | `trust-ferpa-data` | 12 |
| 23 | `collab-reliability` | 3 |
| 24 | `shell-nav-mobile` | 53 |

Streams 25 to 30 are in `execute/` (completion program, faculty OS intelligence,
executive OS, career interview, account identity and mail, phased build) but not
in `manifest.json`, and no prototype route names them. They are not in the matrix's
stream assignments yet.

Streams 00, 01, 02, 06, 08, 09, 10, 12, 13, 14, 16 and 17 own no prototype routes.
They are platform work (setup, schema, identity, AI gateway, trust, launch) that
the routes depend on, and they are in the plan, not skipped.

## Decisions still open for the owner

1. **Where the design archives live.** Copy the 33 MB handoff into `design/`
   or keep referencing it from `docs/handoff/`. Stream 00 kept only `handoff/`
   ([`D-1287`](../decisions/D-1287.md)).
2. **Reconciling the counts.** 25 vs 26 workspaces, 281 routes vs 123 screens in
   `PHASES.md`, and streams 25 to 30 missing from `manifest.json`.
3. **Live integration bundle.** Porting it needs a Supabase database to verify the
   migration against, and a staging project reference.
4. **Product decisions the phase reports name.** Examples: a student submissions
   model, person-level or office-level ownership of help requests, the coach
   role for career shares, and family-grant history
   ([`33-phase-3`](../execute/33-phase-3-cross-role-report.md)).

## Human-only steps (from BUILD.md §7; the agent stops and asks)

Insurance; DPA and student data privacy addendum; attorney review of
`docs/legal` drafts; HECVAT; Vanderbilt staging IdP metadata and test accounts;
IT, registrar and sponsor contacts; approval
of every PR; production cutover approval; choice and terms of the AI provider.

## Next executable slices

The phase reports each end with "what the next stream needs". The unblocked code
work there, plus the four backlog behaviours in D-1648, is the queue. Each item
lands beside the screen that uses it, with tests, and is recorded in
`capability-register.csv`.

## Files

- `COVERAGE-MATRIX.csv`, `INVENTORY.md`, `crosswalk.json`, `deployed.json`:
  generated by `npm run ecosystem:build` and held in step by
  `app/src/lib/docs/ecosystem.test.ts`. Those are the authority for route and
  capability status; this README records only what this branch added.
- `README.md`: this file.
