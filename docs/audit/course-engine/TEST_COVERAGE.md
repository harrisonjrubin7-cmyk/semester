# Test coverage

## Verified on 2026-10-08

| Check | Result |
|---|---|
| Course-engine web unit/component tests | 11 passed across 5 files |
| Automated axe ready-state scan | passed; color contrast excluded because jsdom has no layout engine |
| TypeScript `tsc --noEmit` | passed |
| Next.js production build | passed; root plus 15 dynamic course routes compiled |
| Rendered landing-page smoke | passed at default desktop viewport and 320 px mobile viewport; no horizontal overflow observed |
| API pytest suite | previously passed: 10 tests across 5 files; backend was unchanged by this UI pass |
| API Ruff/compileall | previously passed; backend was unchanged by this UI pass |

## Covered behaviors

- Status labels include readable words and decorative glyphs.
- Unknown machine statuses degrade to readable neutral text.
- Desktop and mobile nav regions are named; current destination uses `aria-current`.
- Command palette opens from the keyboard, receives focus, and closes with Escape.
- Offline, loading, empty, and error states are announced and actionable.
- Canonical Ink/Parchment/motion tokens and reduced-motion/forced-color rules are locked by tests.

## Not yet covered

- Browser-level upload, review correction, calendar edit, source sheet, and export journeys.
- Visual regression and real-browser color-contrast checks.
- Screen-reader testing with VoiceOver/NVDA.
- Touch/zoom/device testing and full interaction coverage at 768, 1024, and 1440 px (the landing view was smoke-checked at default desktop and 320 px).
- Provider-backed extraction/generation and production object storage.
- Docker Compose on this host (Docker is unavailable).
- HawkScan DAST (runtime and API key unavailable).
