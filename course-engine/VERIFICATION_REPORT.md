# Verification report — 2026-10-12

## Passed

- `python -m pytest -q`: 85 passed with 41 subtests using the documented SQLite migration-test environment. Coverage includes authorization/ownership isolation, review resolution, bounded correction payloads, real migration round trips, concurrent upload completion, pre-completion retry rejection, owner-scoped job feeds, idempotent retry dispatch, abandoned-queue redelivery and broker failure isolation, worker fencing/recovery, asset-bound card reviews, aligned quiz validation, bounded durable quiz-result persistence, rejected-asset enforcement, safe archives, citation rejection, dates, ICS, and exports.
- `python -m ruff check app tests ../worker/tasks.py`: passed.
- `python -m compileall`: API, worker, scripts, and benchmark modules compile.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed; all 15 course workspace routes compiled.
- `pnpm test`: 28 frontend tests passed across eleven files, including the shell, command-palette focus, source/status vocabulary and locations, review correction and asset-cache refresh, calendar consequence preview/exact undo, upload job progress/cancellation/retry, card recall, validated cited guide rendering, authenticated document export lifecycle, quiz completion, rejected-asset exclusion, operational states, semantic token contracts, and an axe ready-state scan.
- `pnpm run test:e2e`: 3 real-Chromium browser tests passed for the landing page and mocked-data course shell. They enforce a clean browser console, axe checks including browser color contrast, skip-link and command-palette focus behavior, labeled mobile navigation, 390 px viewport containment, and desktop/mobile screenshot evidence. CI installs pinned Chromium and retains the HTML report and failure evidence for 14 days.
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

The responsive shell uses the Semester Ink/Parchment/blue system without gradients or decorative AI imagery. Desktop navigation, labeled mobile tabs, context continuity, command search, reduced motion, forced colors, explicit source statuses, and loading/error/empty/offline states are implemented as reusable components. The jsdom axe scan still excludes color contrast, while the new Chromium suite runs axe with a real layout/color engine and verifies critical keyboard focus and mobile containment. Cross-browser, live-data, assistive-technology, and human visual-regression review remain open.
The upload workspace now opens an owner-scoped, focus-managed source sheet and recovers current extraction state after reload. It polls only while queued or running work exists, displays progress, and gives the student explicit cancellation and failure-retry controls. Extracted chunks retain page, slide, sheet/cell, or media timestamp labels and confidence; exact PDF bounding-box overlays and correction actions remain open.

The Review workspace can confirm, reject, or correct extracted payloads, records an optional decision note, refreshes course counts, and blocks malformed correction JSON before sending it. The Calendar workspace now previews changed fields and ICS consequences before saving, preserves unspecified times, and offers one-step session undo.

Cards now reveal stored answers and citations before a student records recall confidence; each review is bound to its owning non-rejected asset, first-review counters are initialized explicitly, and progress refreshes after each response. Read and Doc validate optional stored lists before rendering guide sections as accessible prose with canonical source labels rather than raw JSON. Confirmed Doc versions download as DOCX or PDF through authenticated requests, with `Content-Disposition` exposed cross-origin and the object URL retained until the browser begins the download. Quiz presents each valid stored cited section as a retrieval prompt, applies the same validation on the client and server, requires an explicit self-rating for every prompt, verifies ownership and exact prompt coverage server-side, persists the answer evidence, and includes the 50 most recent completed attempts in Progress. Rejected card and quiz assets cannot be studied or recorded.
