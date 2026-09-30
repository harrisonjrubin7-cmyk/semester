# M1/M2 automated verification — 30 September 2026

**Scope:** repository evidence for the Safe Core App and Registration Readiness milestones after the Semester Master Plan merged to `main`.

**What this proves:** the selected source-level workflows pass their automated contracts and the application produces a production build from the merged source.

**What this does not prove:** a production deployment, production persistence, live tenant isolation, a real backup restore, human accessibility conformance, institutional approval, or successful use by 10–20 students.

## Focused workflow run

Command: `vitest run` across 21 M1/M2 files covering:

- Today decisions and Action Center behavior;
- Path Snapshot and registration-day presentation;
- term planning, ranked backups, duplicate handling, and conflict detection;
- advisor agenda construction and sharing boundaries;
- source labels and source-aware calendar behavior;
- workspace backup/restore coverage and user export;
- account deletion;
- table RLS and the tenant contract.

Result: **21 test files passed; 355 tests passed.** The DOM environment emitted its expected `Not implemented: navigation to another Document` notice while the suites remained green.

## Master Plan controls

- `app/src/lib/governance/master-plan.test.ts`: **5 tests passed**.
- The test holds the 14-part definition of done, the M0–M10 dependency sequence, all 60 unique capability rows, high-risk activation denial, the four-week M1/M2 program, the generated Master Plan, the Product Status Map, and the interactive dashboard.
- TypeScript project check: passed.
- Focused Oxlint check for the Master Plan source and test: passed with warnings denied.
- Git whitespace check: passed.

## Production build

Command: `pnpm run build` (`tsc -b && vite build`).

Result: **passed**; Vite transformed 3,985 modules and emitted the production bundle. The build reported advisory chunk-size warnings, not a failure.

## Remaining evidence gates

1. Run keyboard, zoom, screen-reader, slow-network, stale-source, and failure-path sessions with recorded observations.
2. Exercise two real accounts against the intended hosted backend and retain tenant-isolation evidence.
3. Restore a real production backup into an isolated non-production project, record RPO/RTO and policy checks, and rehearse rollback with another operator.
4. Observe 10–20 consenting student design partners complete the bounded registration-readiness workflow.
5. Record denominators, failures, accessibility findings, incidents, limitations, and advisor feedback in the pilot outcome report.

Until those gates close, M1 and M2 remain **partial** and Semester must not claim institutional launch readiness.
