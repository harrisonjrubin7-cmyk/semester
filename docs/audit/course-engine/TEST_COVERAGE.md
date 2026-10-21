# Test coverage

## Verified on 2026-10-16

| Check | Result |
|---|---|
| Course-engine web unit/component tests | 29 passed across 11 files |
| Production-mode Chromium browser tests | 7 passed with deterministic API fixtures |
| Browser axe scan | passed with zero violations at the desktop ready state |
| TypeScript `tsc --noEmit` | passed |
| Next.js production build | passed; root, Semester OS routes, and 15 dynamic course routes compiled |
| Responsive browser checks | passed at 1440, 390, and 320 px with no document overflow |
| Visual regression baselines | reviewed desktop and mobile overview snapshots recorded for Linux and macOS |
| API pytest suite | previously passed on 2026-10-12: 85 tests with 41 subtests; backend was unchanged by this browser pass |
| API Ruff/compileall | previously passed on 2026-10-12; backend was unchanged by this browser pass |

## Covered behaviors

- Status labels include readable words and decorative glyphs.
- Unknown machine statuses degrade to readable neutral text.
- Desktop and mobile nav regions are named; current destination uses `aria-current`.
- Command palette opens from the keyboard, receives focus, and closes with Escape.
- Offline, loading, empty, and error states are announced and actionable.
- Canonical Ink/Parchment/motion tokens and reduced-motion/forced-color rules are locked by tests.
- The production browser journey covers source-sheet focus and dismissal, review confirmation, calendar consequence preview, cited card recall, self-graded quiz persistence, authenticated DOCX download naming, mobile command navigation, and console/page errors.
- Desktop and mobile overview screenshots are versioned as platform-specific Linux and macOS visual baselines.

## Not yet covered

- A seeded live API/worker/object-store browser journey; current browser coverage uses deterministic HTTP fixtures and does not prove service integration.
- Screen-reader testing with VoiceOver/NVDA.
- Touch/zoom/device testing and full interaction coverage at 768, 1024, and 1440 px (the landing view was smoke-checked at default desktop and 320 px).
- Reviewed Windows visual-regression baselines; the visual assertion is explicitly skipped outside Linux and macOS until those references exist.
- Provider-backed extraction/generation and production object storage.
- Docker Compose on this host (Docker is unavailable).
- HawkScan DAST (runtime and API key unavailable).
