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

## Unmatched named codes

| Command | Working directory | Result |
| --- | --- | --- |
| `npx vitest run src/lib/planpreview.test.ts src/components/RegistrationPortal.namedplan.test.tsx src/components/RegistrationPortal.conflicts.test.tsx` | `app/` | Exit 0. 3 files, 15 tests passed. The new tests failed first with `unmatchedNamed is not a function`. |
| `npx tsc -b` | `app/` | Exit 0. |
| `npm run lint` | `app/` | Exit 0. |
| `npm test` | `app/` | Exit 0. 1467 files passed, 1 skipped. 23542 tests passed, 69 skipped. |
| Browser, 390×844, `#/yes` | named ECON 1020 and PSCI 1104; catalog file contains only ECON 1020 with 18 seats | PSCI 1104 stayed under Courses you named, with the institution, the import day, and “no seat was invented.” ECON 1020 left that list and appeared as section 01 with 18 reported seats. The stored catalog stayed one course and the cart stayed empty. |

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
