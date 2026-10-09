# Verification report — 2026-10-08

## Passed

- `python -m pytest -q`: 10 passed. Coverage includes authorization/ownership isolation, unsafe ZIP rejection, citation rejection, conflicting dates, missing time/year behavior, ICS publication filtering, flashcard deduplication, and PDF/DOCX/card export logic.
- `python -m ruff check app tests`: passed.
- `python -m compileall`: API, worker, scripts, and benchmark modules compile.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed; all 15 course workspace routes compiled.
- `pnpm test`: 11 frontend tests passed across five files, including the shell, command-palette focus, source/status vocabulary, operational states, semantic token contracts, and an axe ready-state scan.
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
- Local HawkScan DAST: blocked at mandatory preflight because `hawk` 6+ is not installed on this host. Hosted HawkScan remains a required pull-request gate; a hosted pass applies only to the exact commit it scanned.

## UI implementation pass

The responsive shell uses the Semester Ink/Parchment/blue system without gradients or decorative AI imagery. Desktop navigation, labeled mobile tabs, context continuity, command search, reduced motion, forced colors, explicit source statuses, and loading/error/empty/offline states are implemented as reusable components. Automated axe runs exclude color contrast because jsdom has no layout/color engine; real-browser WCAG 2.2 AA contrast verification remains open.
