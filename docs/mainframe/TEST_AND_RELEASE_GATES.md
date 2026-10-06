# Test and release gates

Commands run from `app/` unless noted. Discover the script in `app/package.json` before inventing one. Root `npm test` is not a script.

## Run this batch

| Command | Working directory | Result |
| --- | --- | --- |
| `npx vitest run src/lib/planpreview.test.ts src/lib/rolejourney.test.ts src/screens/planpreview.test.tsx src/components/RegistrationPortal.namedplan.test.tsx src/screens/keyless.test.tsx src/components/RegistrationPortal.conflicts.test.tsx` | `app/` | Exit 0. 6 files, 32 tests passed. |
| `npx vitest run src/screens/planpreview.test.tsx src/components/RegistrationPortal.namedplan.test.tsx src/screens/keyless.test.tsx` | `app/` | Exit 0 after the label fix. 3 files, 19 tests passed. |
| `npx tsc -b` | `app/` | Exit 0. |
| `npm run lint` | `app/` | Exit 0. Oxlint warnings remained under the ceiling of 25. Styles, labels, and terms passed. |
| `npm test` | `app/` | Exit 0 after the named readiness row. 1452 files passed, 1 skipped. 23319 tests passed, 69 skipped. Duration 128.87s. |
| `node scripts/design-system-audit.mjs` | `app/` | Exit 0. 0 violations. Baseline unchanged at 67 raw-value warnings. |

## Not run

| Check | Why |
| --- | --- |
| `npm run test:shuffle` | Not run. The ordered suite passed. Shuffle was not required to see this change. |
| `npm run check:university` | Gateway not imported. |
| `npm run build` | Not run. |
| RLS, cross-tenant, and remote migration tests | No migration. No remote database. |
| Browser walkthrough | Not run this session. The journey is covered by jsdom tests that click the door, reject a bad code, save, and read the term-plan list. |
| Production smoke | Forbidden by the execution prompt. |

## Release rule

A green typecheck is not production readiness. Deployment readiness for the device plan stays `not-deployed`. Record authority stays `device-local`.

Do not weaken `keyless.test.tsx`. The syllabus door stays first. The by-hand door stays keyless-only.
