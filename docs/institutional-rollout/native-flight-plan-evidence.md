# Native Flight Plan vertical slice — verification evidence

Verified locally on 2026-09-23 on branch `codex/institutional-rollout-design`.

## What is implemented

The current Semester application remains the only product root. Preview-only modules now extend the existing Home, Calendar, Study, When you are behind, Email, and University routes. They share one institution/person-scoped deterministic workspace and use the existing shell, routes, components, tokens, landmarks, and navigation.

The slice supports bounded planning, source confirmation, uncertain-date exclusion, sample learning evidence, non-mutating recovery, locally prepared unsent messages, and eight truthful role workspaces. Northstar University and Cedar Coast College remain fictional `.example` tenants.

## Automated verification

| Check | Exact command | Result |
| --- | --- | --- |
| Full suite | `vitest run` | 661 files passed, 1 skipped; 12,572 tests passed, 13 skipped |
| Time zones | `pnpm run test:zones` | Same counts passed in `America/Chicago` and `Pacific/Kiritimati` |
| Shuffled order | `pnpm run test:shuffle` | Same counts passed; seed `1790202353446` |
| Lint and design rules | `pnpm run lint` | Passed the repository's 25-warning ceiling; styles and accessible-label audits passed |
| TypeScript | `tsc -b` | Passed |
| Preview build | `VITE_INSTITUTIONAL_PREVIEW=true pnpm run build` | Passed |
| Preview browser smoke | `EXPECT_INSTITUTIONAL_PREVIEW=true SMOKE_PLAYWRIGHT=… node scripts/institutional-preview-smoke.mjs` | Seven route/viewport probes passed plus Northstar-to-Cedar-Coast draft isolation and Cedar Coast staff readback |
| Default build | `VITE_INSTITUTIONAL_PREVIEW=false pnpm run build` | Passed |
| Default browser smoke | `EXPECT_INSTITUTIONAL_PREVIEW=false SMOKE_PLAYWRIGHT=… node scripts/institutional-preview-smoke.mjs` | Seven route/viewport probes passed with no preview UI or preview storage |

Browser readback covered desktop `1440×1000` and phone `390×844`. Every probe reported exactly one `[data-semester-root]` and one `<main>`. Preview probes reported exactly one `nav[aria-label="Primary"]`; keyboard Tab entry moved focus off the document body. The flow prepared a help-request draft for the Northstar student, confirmed it in Email as local and unsent, switched to Cedar Coast, proved the draft absent, then selected the Cedar Coast student-success persona and read back its consent-aware workspace.

## Mutation evidence

- Removing one `data-semester-root` marker made `src/a11y/landmarks.test.ts` fail with 2 roots where 3 shell layouts are required. The marker was restored and the test returned green.
- Removing the tenant segment from `flightStorageKey` made `src/lib/flight-plan-storage.test.ts` fail on its institution/role/person key assertion. The tenant segment was restored and the test returned green.
- The earlier source-confirmation mutation check remains recorded in the execution ledger: disabling the completion guard caused the provenance test to fail before the guard was restored.

## Boundaries not claimed

This evidence is for a local synthetic preview and production build artifacts only. It does not prove a deployed environment, production identity or tenant authorization, live SIS/LMS writes, sent institutional email, booked appointments, payments, registration, official records, or server-enforced administrator settings. Those remain external rollout gates and every affected UI states that boundary.
