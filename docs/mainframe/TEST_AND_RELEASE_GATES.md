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

## Advisor agenda handoff

| Command | Working directory | Result |
| --- | --- | --- |
| `npx vitest run src/lib/advisor-meeting.test.ts src/lib/path-readiness.test.ts src/components/AdvisorMeeting.test.tsx src/components/PathSnapshotCard.test.tsx` | `app/` | Exit 0. 4 files, 36 tests passed. The new tests failed first with `namedAgendaText is not a function`. |
| `npx tsc -b` | `app/` | Exit 0. |
| `npm run lint` | `app/` | Exit 0. Oxlint warnings remained under the ceiling of 25. Styles, labels, and terms passed. |
| `npx vitest run src/lib/path-readiness.test.ts src/lib/advisor-meeting.test.ts src/components/AdvisorMeeting.test.tsx` | `app/` | Exit 0 after the rebase onto `7b9ae1c2`. 3 files, 41 tests passed. An empty named row does not stop the headline saying Ready. A named code that is not yet an agenda line does. |
| `npx tsc -b` and `npm run lint` | `app/` | Exit 0 again after the rebase. |
| `npm test` | `app/` | Exit 0 after the rebase. 1467 files passed, 1 skipped. 23538 tests passed, 69 skipped. Duration 132.49s. |
| Browser, 390×844, `http://127.0.0.1:5173/#/degree` | seeded `ECON 1020`, source `Added by hand` | Flag off: the row moved from Needs attention to a line that says the code is on the meeting agenda, is not an enrollment, and that nothing was shared. The meeting library held one agenda line, empty notes, and no attached courses. The secret planted on the course was not stored. |
| Browser, same viewport, `VITE_ADVISOR_MEETING_MODE=production` on port 5174 | same seed | The Advisor meeting tab opened. Agenda item 1 was `ECON 1020 (Fall 2026). Named on this device. Not an enrollment.` Private notes stayed empty. |

## Not run

| Check | Why |
| --- | --- |
| `npm run test:shuffle` | Not run. The ordered suite passed. Shuffle was not required to see this change. |
| `npm run check:university` | Gateway not imported. |
| `npm run build` | Not run. |
| RLS, cross-tenant, and remote migration tests | No migration. No remote database. |
| Browser walkthrough for the earlier plan slice | Recorded in the previous batch. This batch’s walk is in the table above. |
| Production smoke | Forbidden by the execution prompt. |

## Release rule

A green typecheck is not production readiness. Deployment readiness for the device plan stays `not-deployed`. Record authority stays `device-local`.

Do not weaken `keyless.test.tsx`. The syllabus door stays first. The by-hand door stays keyless-only.

## Handoff intake and coverage matrix (11 October 2026, #1475)

| Command | Working directory | Result |
| --- | --- | --- |
| `npx vitest run src/lib/path-readiness.test.ts` | `app/` | 5 new tests failed first (`unmatched` undefined); exit 0 after the change, 20 tests passed. |
| `npx vitest run src/lib/docs/ecosystem.test.ts` | `app/` | Exit 0. 12 tests passed; `problems: []` over 281 routes and 122 capabilities. Controls prove a missing path, an over-claimed status and a ghost route are each reported. |
| `npx tsc -b` | `app/` | Exit 0, before and after the rebase onto `ccf2d45f`. |
| `npm run lint` | `app/` | Exit 0. Styles, labels and terms passed. |
| `npm run check:university` | `app/` | Exit 0. |
| `npm run design-system:check` | `app/` | Exit 0. 69 tests passed. |
| `npm test` | `app/` | 1516 files passed, 4 failed, 1 skipped; 24192 tests passed, 4 failed, 69 skipped. One failure was plugin debris at the repository root (`.md-linker`, `.ruff_cache`; removed). Three reproduce on the untouched base `a4742f6b`: `src/isolation.test.ts`, `src/lib/docs/trust-docs.test.ts`, `src/components/unity/rollout-c.test.tsx`. |
| `npm run test:shuffle` | `app/` | Seed `1791757697990`. 1517 files passed, 3 failed, 1 skipped; 24196 tests passed, 3 failed. The same three. No ordering failure. |
| `npm run build` | `app/` | Exit 0 after the rebase. |
| Read-only SQL on production `lzrqvlugnawcgywkhqlz` | Supabase MCP | 234 applied migrations, md5 of the ordered version list `b3f233cab6a321ee41bdc2d7716fb64f`, equal to the repository's. Nothing applied. |
| `curl` and the authorized Vercel fetch on the branch preview | — | 302 (Vercel Authentication) and 403 (team not authorized for this connection). Preview built, not seen. |

Not run: `verify.sh` (no Docker), HawkScan locally (no `HAWK_API_KEY`), a browser walk (one sentence changed in an existing list), any remote migration.

## Phase 1 foundation hardening, first pass (11 October 2026, #1475, second push)

Recorded from `docs/execute/31-phase-1-foundation-report.md`; the full-suite figures below are filled from the gate run on this head.

| Gate | Result |
| --- | --- |
| `npx vitest run server/institution/gateway.test.ts` | 48 passed (2 new; both watched red first) |
| `npx vitest run src/lib/docs/check-suites.test.ts` | 3 passed (red on a dropped manifest line) |
| `SEMESTER_CHECK_PG_ANY=1 supabase/check.sh gradebook` | ✓ 145 checks on PostgreSQL 16, local; red run: "a registrar whose grant was revoked exporting 2026FA — was allowed" |
| `npm run ecosystem:build` / `ecosystem:check` | 12 passed, twice |
| `REGISTERS=write` trust docs | 38 passed; CONTROL-FACTS.md regenerated |
| `npx tsc -b`, `npm run lint`, `npm run check:university`, `npm run design-system:check`, `npm test` | all exit 0; design-system 69 tests; suite: Test Files 1521 passed, 1 skipped (1522); Tests 24204 passed, 69 skipped (24273) |
