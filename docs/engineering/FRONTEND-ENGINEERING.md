# Frontend engineering control surface

Status: living document. Owner role: Frontend architect (accountable), with the design-systems, accessibility, QA and release roles named per section.

This file records what was inspected, what was executed, what is verified, and what remains open. It does not claim that any screen, journey or release gate is complete unless a row below says so with evidence. A passing build is not a verified workflow, and a verified workflow is not a production release.

Maturity labels used below:

- **Observed**: code exists in the repository and was read.
- **Executed**: a command was run in this session and its exit status is recorded.
- **Verified**: an automated test or manual check covers the behaviour end to end.
- **Deployed**: running in a named environment. Not claimed anywhere in this file.
- **Open**: known gap, with an owner and a next step.

---

## A. Evidence baseline

### A.1 Environment

| Item | Value | Evidence |
|---|---|---|
| Repository | `harrisonjrubin7-cmyk/semester`, working branch `claude/nice-knuth-lj38ll` | `git branch --show-current` |
| Commit at baseline | `706de357` (origin/main at the time of inspection) | `git log origin/main -1` |
| Node | v22.22.0 (repo `engines` asks for `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`; install warns, does not fail) | `npm ci` output |
| Package manager | npm workspaces (`app/`, `packages/*`), single root lockfile | `package.json`, `CLAUDE.md` |
| Install | `npm ci` from repo root, 237 packages added | executed, exit 0 |

Install from the root, not `app/`. `app/` has no `@semester/*` links unless the root install ran (per `CLAUDE.md`).

### A.2 Baseline commands

All commands run from `app/` unless stated.

| Command | Result | Status |
|---|---|---|
| `npx tsc -b` | exit 0 | Executed |
| `npm run lint` (oxlint `--max-warnings=25`, plus styles, labels, terms audits) | exit 0; styles, labels and terms audits report `ok`. oxlint prints existing warnings (React hooks, unsafe finally, unused expressions, set-state-in-effect). | Executed |
| `npx vitest run` (full suite) | Test files 1,574 (3 failed, 2 skipped); tests 24,774 (4 failed, 81 skipped, 24,689 passed). Exit 1. | Executed |
| `npm run build` | not run in this session | Open |
| `npm run design-system:check` / `design-system:report` | not run in this session | Open |
| `npm run check:university` | not run in this session | Open |
| `npm run test:shuffle` | not run | Open |

### A.3 Known red tests on this baseline (pre-existing, not introduced here)

These failed on the commit before any change in this session. They are recorded, not hidden.

| Test | Symptom | Diagnosis so far | Work item |
|---|---|---|---|
| `src/lib/sre/sre.test.ts` › generated pages match the registers › *scorecard baseline* and *service catalog* | `docs/sre/generated/*.md` is stale | Generated-doc drift. Documented fix is `npm run registers`. That script rewrites many registers at once and was not run here to avoid an unreviewed bulk diff. | WI-FE-003 |
| `src/lib/docs/developers.test.ts` › *names the other workflows by their file, name and trigger* | expected 14 table rows under "Other workflows", got 15 | The hard-coded `expect(table.length).toBe(14)` at `developers.test.ts:534` is stale. The "Other workflows" table has 15 data rows, and `.github/workflows` has 16 files including `ci.yml`, so the table is consistent with the repository. Owned by docs/CI, not the frontend. | WI-FE-004 |
| `src/screens/mine.removal-labels.test.tsx` › *distinguishes repeated steps and same-title actions before removal* | `Remove step 1 of 2 from Plan review: Draft outline · not done` not found after clicking *Edit Plan review* | Fails deterministically when the file runs alone. The label template at `src/screens/Mine.tsx:241` matches the expected string. The cause is test selection, not `TaskRow`: the seed holds two tasks titled *Plan review*. The one with steps is dated 2026-10-20 and the other, with no steps, is dated 2026-10-22. `Mine` lists the 10-22 "Coming up" task before the 10-20 "Overdue" task, so `edits[0]` opens the stepless duplicate. Not yet fixed. | WI-FE-002 |

---

## B. Frontend system architecture (as observed)

| Concern | Where it lives | Observed facts |
|---|---|---|
| Stack | `app/package.json` | React 19.3, Vite 8, TypeScript (`~7.0.2`), Vitest 5, `@supabase/supabase-js` |
| Bootstrap | `app/src/main.tsx` (318 lines) | Root render entry |
| Root component and routing | `app/src/App.tsx` (1,643 lines), `app/src/screens.tsx` (247 lines) | Single large root; screen registry lives in `screens.tsx` |
| Application state | `app/src/state/store.tsx` (2,275 lines), `state/reducer.ts`, `state/slices/`, `state/persist/` | Single store with reducer, slices, local fallback (`localfallback.ts`), sync retry and sync-state tests |
| Screens | `app/src/screens/` | About 175 entries including tests. Many are named for a student feature (Today, Calendar, Gradebook, Registration, Mine, Advising-style screens) |
| Shared components | `app/src/components/` (includes `ActionCenter.tsx`, `TodayActionCenter.tsx`) | Two Action Center components exist; which one the Today screen uses is **Open** (see E) |
| Design authority | `app/src/lib/look.ts` (1,867 lines), `app/src/styles/tokens.css` (266 lines), `app/design-tokens/` (generated export, do not edit) | Precedence order is defined in the root `CLAUDE.md` |
| Backend contracts | `app/api/` (institution, productivity), `app/server/` (course-sources, institution, integration, productivity) | Server-side code is outside the browser bundle |
| Database | `supabase/` with 254 migrations and about 150 `*.check.sql` suites | Schema and RLS checks are SQL, run outside the frontend test suite |

### B.1 Responsibilities, as they stand

- **Bootstrap**: `main.tsx`. Single entry. Route-level code splitting exists: `app/src/screens.tsx` declares 100 screens with `lazy(() => import(...))`, and its header states that each registry row remains a separate chunk. Bundle sizes were not measured.
- **Route protection (advisory, frontend)**: `screenForRole` in `app/src/lib/role.ts` redirects inapplicable screens to `home`. The navigation reducer applies it to ordinary navigation, workspace navigation, typed URLs, and role changes. `state/reducer.test.ts` covers denial of hidden internal navigation and typed URLs. This is a usability gate only. Backend authorization remains **Open** (section G).
- **Server state vs local state**: the store mixes both. Separation is **Open**; the sync tests (`syncretry`, `syncstates`, `localfallback`) show intent but not a written contract.
- **Design primitives**: `components/ui.tsx`, `components/Page.tsx`, `components/unity/`, `components/FieldMessage.tsx`, and state components `EmptyState`, `Notice`, `ErrorState`, `LoadingState`, `PermissionNotice` are named in `CLAUDE.md` as the shared set. Duplication against `components/semester-design/` (JSX, not TSX) was **not** inventoried.
- **Feature entitlement**: not inspected in this session.

### B.2 Import boundaries

Enforced by test: `app/src/lib/importboundaries.test.ts` walks the real `packages`, `app` and `supabase/functions` import graph, calls `checkBoundaries(real)`, and includes controls that prove each rule can fail. It was part of the passing full-suite run. The separate circular-dependency census was **not** run in this session and remains **Open**.

---

## C. Design-token and component architecture

- Colour is decided by `look.ts` (13 grounds, 11 accents), measured by `lib/contrast.test.ts`.
- Semantic tokens live in `tokens.css`. `design-tokens/semester.tokens.json` is generated and must not be edited.
- `npm run design-system:audit` and `design-system:css` count raw values against `design-system-baseline.json` and `src/styles/rawbudget.ts`. Ledgers may shrink, not grow. These were **not run** in this session.
- Component inventory against the requested list (typography, buttons, forms, navigation, data, surfaces, trust and governance, state and recovery): **Open**. A full classification (canonical / needs hardening / duplicated / domain / prototype / missing) requires a component census. The existing `scripts/design-census.mjs` (`npm run census:design`) is the intended tool and was not run here.

No component was added or changed in this session.

---

## D. Domain screens and user journeys

Journey register. Status reflects evidence in this session only. Nothing here is marked verified.

| ID | Journey | Primary roles | Entry point observed | Status | Gap |
|---|---|---|---|---|---|
| A | Student Action Center (deadlines, tasks, blockers, freshness, next permitted action) | Student | `components/TodayActionCenter.tsx`, `screens/Today.tsx`, `components/ActionCenter.tsx` | Observed; two components, not verified | Which component is canonical; end-to-end test absent in this session |
| B | Registration (plan, eligibility, holds, approvals, enrollment outcome, schedule) | Student, registrar | `screens/Registration.tsx`, `screens/Registrar.tsx`, `registration*.test.tsx` | Observed | No end-to-end verification run |
| C | Coursework (course, assignment, private draft, submission revision, receipt, grading, release) | Student, faculty | `screens/Courses.tsx`, `screens/Gradebook.tsx`, `screens/Grades.tsx`, `screens/Write.tsx` | Observed | Submission revision and release receipts not traced |
| D | Advising and support (request, consent-aware context, referral, owner, resolution) | Student, advisor | `screens/Support.tsx`, `screens/Help.tsx`, `help-requests.check.sql` | Observed (SQL check exists) | UI-to-backend path not traced |
| E | Academic progress (released grades, official records, estimates, degree requirements, what-if) | Student | `screens/Degree.tsx`, `screens/Grades.tsx`, `screens/Pathway.tsx` | Observed | Released-vs-estimate distinction not checked against copy |
| F | Campus services (eligibility, request, reservation, fulfillment, support) | Student, staff | `screens/Dining.tsx`, `screens/Housing.tsx`, `screens/Meals.tsx`, `screens/Athletics.tsx` | Observed | Not traced |
| G | Career and portfolio (selected evidence, visibility, sharing, opportunity, revocation) | Student | `screens/Career.tsx`, `screens/Proof.tsx`, `screens/Opportunities.tsx`, `screens/Profile.tsx` | Observed | Revocation path not traced |
| H | Institutional operations (queues, approvals, reconciliation, audit, interventions) | Institution staff | `screens/Console.tsx`, `screens/Moderation.tsx`, `screens/Reports.tsx`, `supabase/*console*.check.sql` | Observed | Largest surface; not inventoried |

### D.1 Journey selected for the next slice

**Journey A (Student Action Center)** is the first high-value incomplete journey: it is the cross-role entry point for the other journeys. Its two Action Center components are composed layers, not competing implementations. `screens/Today.tsx` renders `TodayDecisionSurface`, which lazy-loads `TodayActionCenter`. `TodayActionCenter` renders `ActionCenter` and adds the path, commitments, freshness and quick-action surfaces around it. Removing either would discard functionality. The first step is to record this relationship and trace the existing feature-flagged route, then route → context → data → action → receipt → recovery.

The smallest verified defect on the path is WI-FE-002 (the red `mine.removal-labels` test), because it is a student-facing task row and a confirmed failure, not a theoretical gap.

---

## E. Backend and database contracts

Not yet traced for any journey. The following must be recorded per data region before a journey is marked implemented:

canonical entity · stable identifier · tenant and owner scope · source and authority · version · freshness · permissions · backend operation · runtime validation · error model · audit or receipt requirement.

Known contract surfaces, observed only: `app/api/institution`, `app/api/productivity`, `app/server/*`, and about 150 `supabase/*.check.sql` suites (for example `console-scoped-tenant-access.check.sql`, `registration-readiness-store.check.sql`, `support-tickets.check.sql`). Mapping them to screens is **Open**.

The frontend has hand-written runtime validators for some responses. `readIncidents(value: unknown)` in `app/src/lib/statusnotice.ts` backs `StatusNotice`, and `readOfficeActions(rows: unknown)` in `app/src/lib/office-actions.ts` validates Supabase RPC rows before display. No general schema library is used. **Open**: inventory which responses are validated this way, which are not, and whether `app/server` validates request payloads.

---

## F. State, caching, synchronization, and offline behaviour

Observed mechanisms: `state/localfallback.ts`, `state/persist/`, `state/syncretry.test.tsx`, `state/syncstates.test.tsx`, `state/twotabs.test.ts`, `state/account-refresh.test.tsx`, `state/readonly.test.tsx`, `state/returnto.test.tsx`.

Not verified: query-key scoping by identity and tenant, request cancellation on account or workspace change, optimistic-update policy for consequential actions, and realtime handling. These are the requirements in the brief and are **Open**. They must not be reported as satisfied from the existence of tests with similar names.

---

## G. Authorization, privacy, and AI boundaries

Not verified in this session. Frontend checks are advisory. Authorization must be enforced by the backend and the RLS suites in `supabase/`. The following were not checked: direct-route denial, search-result permissions, file-preview permissions, export permissions, realtime subscription scoping, and AI-assistant source scoping (`src/ai/`, `Assistant.tsx` is referenced by `Mine.tsx`).

Telemetry, URLs, browser storage, and cached previews have not been audited against the restricted-information rules.

---

## H. Accessibility and responsive behaviour

- `npm run lint` executes the label audit (`scripts/labels.mjs`), which reported `ok`: every form control has a name a screen reader can read. This is an **automated static check only**.
- Responsive contracts exist under `styles/{breakpoints,gutter,taps,density,stacking}.test.ts` and passed in the full run, except as listed in A.3.
- Not performed: manual keyboard walkthrough, screen-reader evaluation, zoom and reflow at 320px, reduced-motion check, forced-colours check, and formal conformance assessment. No conformance claim is made.

---

## I. Test strategy and acceptance criteria

Executed: full Vitest suite on the baseline (A.2). Result: 24,689 passed, 81 skipped, 4 failed in 3 files.

Not executed: `test:shuffle`, end-to-end browser tests, visual screenshot review, performance budgets (`npm run budgets`), and the Playwright smoke scripts.

Section D's register does not define pass/fail acceptance criteria or required evidence for any journey, so no journey can yet be judged met or not met. The criteria must be written before any journey status changes. Until then, no journey in this document is verified.

---

## J. Release gates and operational readiness

Not evaluated. The following are blocking for a frontend release and currently open:

1. WI-FE-002 (red test) and WI-FE-003 / WI-FE-004 (red generated-doc and docs-table tests): the suite is not green on the baseline.
2. `npm run build` not executed in this session.
3. No journey has end-to-end evidence.
4. No error-monitoring, support-recovery or feature-flag verification was performed.

Deployment status: **none**. Nothing in this session was deployed, migrated, or pushed to a remote environment.

---

## K. Implementation ledger and continuation checkpoint

### K.1 Work items

| ID | Domain / roles | Dependencies | Current maturity | Acceptance criteria | Evidence | Owner role | Blockers | Continuation |
|---|---|---|---|---|---|---|---|---|
| WI-FE-001 | Baseline, all | none | **Executed** | install, `tsc -b`, `lint`, full test run recorded (A.2) | A.2 table; log kept outside the repo | Frontend architect | none | done |
| WI-FE-002 | Student, task rows (Journey C/A) | WI-FE-001 | **Open**, defect confirmed deterministically; cause identified as test selection | `mine.removal-labels` test green, with the assertion strength unchanged | A.3 | Frontend engineer; QA | none known | In the test, select the task by context rather than by `edits[0]`: the *Plan review* row dated 2026-10-20 that has steps. Do not change `TaskRow`. Re-run the single file, then the full suite |
| WI-FE-003 | Docs / SRE register | WI-FE-001 | **Open** | `sre.test.ts` green | A.3 | Docs owner | bulk regeneration needs review | Run `npm run registers`, read the diff, commit only the regenerated `docs/sre/generated/*` files |
| WI-FE-004 | Docs / CI | WI-FE-001 | **Open** | `developers.test.ts` green | A.3 | Docs owner | none | Update the stale assertion at `developers.test.ts:534` to the actual row count (15), or derive it from `.github/workflows`. Do not edit the table |
| WI-FE-005 | Student Action Center (Journey A) | WI-FE-002 recommended first | **Open**, not started | the composed layers are recorded; the feature-flagged route is traced end to end; tests for loading, empty, error, stale, permission | D.1 | Frontend architect, backend, QA | none | Record the `TodayDecisionSurface` → `TodayActionCenter` → `ActionCenter` relationship, then trace the feature-flagged route |
| WI-FE-008 | Shared: required frontend CI gates not run | WI-FE-001 | **Open** | each gate below executed and recorded with its exit status | A.2 | Release engineer | none | Run `npm run check:video`, `npm run test:zones`, `npm run budgets`, `npm run smoke:cold`, `npm run smoke:a11y`, `npm run smoke:golden`, and `npm run smoke:registration-states`, recording exit status and any blocking result for each |
| WI-FE-006 | Shared: component census | none | **Open** | section C classification table | C | Design systems | none | `npm run census:design`, then classify |
| WI-FE-007 | Shared: gates not run | WI-FE-001 | **Open** | `npm run build`, `design-system:check`, `design-system:report`, `check:university`, `test:shuffle` executed and recorded | A.2 | Release engineer | none | Run each and record exit status here. The required CI `build` job runs further gates, listed in WI-FE-008 |

### K.2 Checkpoint

- **Completed in this session**: baseline install and the four commands in A.2; the failing-test diagnosis in A.3; this document.
- **Changed files**: `docs/engineering/FRONTEND-ENGINEERING.md` (new). No application source was changed.
- **Next dependency-ordered task**: WI-FE-002. It is a confirmed, student-facing, deterministic failure on the path to Journey A, and it is smaller than the journey itself.
- **Not to be treated as done**: any journey in D, any gate in J, and the claim that the frontend is "complete".
