# Release evidence register — Phase 0

**As of** 2026-10-05 · **Base** `origin/main` `114ac32`. Evidence for release gates lives in `public.platform_release_evidence` (10 rows) and `docs/evidence/`; this page records only what was run in this session.

| Evidence | Command / source | Result | Owner to accept |
| --- | --- | --- | --- |
| Types | `npx tsc -b` (app/) | clean | engineering |
| Gateway types | `npm run check:university` | clean | engineering |
| Lint | `npm run lint` | passes, oxlint warnings listed in the current-state page | engineering |
| Design system | `npm run design-system:check` | 0 violations, 86 warnings; 69 contract tests pass | design systems |
| Unit suite | `npm test` (app/) | 1441 files passed, 1 skipped; 23,179 tests passed, 69 skipped (194 s). Run started before the last docs were written, so it covers the code, not these pages | engineering |
| Docs checks | `vitest run src/lib/docs/`, `npm run docs:impact` | 12 files / 814 tests pass; no obliged page missing | engineering |
| Supabase security advisor | read-only | 0 ERROR, 591 WARN/INFO | security |
| RLS | live table listing | all public tables RLS-enabled | security |
| Build, shuffle, secret scan, migration validation, a11y smoke | — | **not run** | — |

No security, accessibility, privacy, compliance, uptime or commercial claim follows from this page.
