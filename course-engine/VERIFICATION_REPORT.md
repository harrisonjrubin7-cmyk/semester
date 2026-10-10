# Verification report — 2026-10-10

## Passed

- `python -m pytest -q`: 73 passed with 41 subtests using the documented SQLite migration-test environment. Coverage includes authorization/ownership isolation, review resolution, bounded correction payloads, real migration round trips, concurrent upload completion, worker fencing/recovery, safe archives, citation rejection, dates, ICS, and exports.
- `python -m ruff check app tests ../worker/tasks.py`: passed.
- `python -m compileall`: API, worker, scripts, and benchmark modules compile.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed; all 15 course workspace routes compiled.
- `pnpm test`: 19 frontend tests passed across eight files, including the shell, command-palette focus, source/status vocabulary and locations, review correction validation, calendar consequence preview/exact undo, operational states, semantic token contracts, and an axe ready-state scan.
- Rendered smoke check: the built landing route rendered at the default desktop viewport and at 320 px without visible horizontal overflow.
- `alembic upgrade head`: passed against a clean SQLite verification database.
- `scripts/seed_demo_course.py`: passed and produced an authenticated demo course.
- Live smoke test: API `/health` returned 200; web `/` returned 200; seeded login returned a bearer token; authenticated course listing returned the seeded course.

## Renderer benchmark

One isolated run per renderer was attempted against the generated 100-page fixture. ReportLab produced exactly 100 pages (3,398.46 ms, 47.17 MB peak RSS). python-docx produced the 100-page-break document (544.35 ms, 55.62 MB peak RSS). WeasyPrint could not load macOS Pango libraries in this host runtime, so its run is recorded as failed rather than given invented metrics. The API Dockerfile installs the required Pango packages; that container run was not possible because Docker is unavailable on this host.

Locally generated artifacts (intentionally ignored by Git):

- `benchmark/output/benchmark_runs.csv`
- `benchmark/output/benchmark_runs.json`
- `benchmark/output/benchmark_summary.json`
- `benchmark/output/reportlab-100-page-1.pdf`
- `benchmark/output/python-docx-100-page-1.docx`

## Environment-blocked checks

- Docker Compose execution: blocked because the `docker` executable is not installed on the verification host. Compose configuration therefore remains source-reviewed, not runtime-verified.
- Local HawkScan DAST: blocked at mandatory preflight because `hawk` 6+ is not installed and `HAWK_API_KEY` is unset on this host. Hosted HawkScan remains a required merge gate; a hosted pass applies only to the exact commit it scanned, and no security-pass claim is made here.

## UI implementation pass

The responsive shell uses the Semester Ink/Parchment/blue system without gradients or decorative AI imagery. Desktop navigation, labeled mobile tabs, context continuity, command search, reduced motion, forced colors, explicit source statuses, and loading/error/empty/offline states are implemented as reusable components. Automated axe runs exclude color contrast because jsdom has no layout/color engine; real-browser WCAG 2.2 AA contrast verification remains open.
The upload workspace now opens an owner-scoped, focus-managed source sheet. Extracted chunks retain page, slide, sheet/cell, or media timestamp labels and confidence; exact PDF bounding-box overlays and correction actions remain open.

The Review workspace can confirm, reject, or correct extracted payloads, records an optional decision note, refreshes course counts, and blocks malformed correction JSON before sending it. The Calendar workspace now previews changed fields and ICS consequences before saving, preserves unspecified times, and offers one-step session undo.
