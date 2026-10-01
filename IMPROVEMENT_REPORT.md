# Semester product hardening report

## Executive summary

This pass audited the current Semester product at `origin/main`
`f496fad7b3ffcc80abad717cc471f91a2c7bb938` and implemented a small,
evidence-led hardening set. It did not replace the existing architecture or
visual language.

The highest-impact confirmed defect was in the workspace shell. Search and All
Apps deliberately omit the global header, but neither supplied a page-level
heading or received route focus. A screen reader therefore had no page title to
jump to, and keyboard focus fell back to the document body after navigation.
Both screens now own one focusable `h1`, and the persistent workspace shell
moves focus to the new page title, including when a lazy route is still loading.

The pass also removed two confirmed lint warnings and made time reads in several
React components deterministic through the app's existing clock. The production
build, lint and policy checks, focused regression tests, and institution
TypeScript boundary pass. The complete post-change suite also passes after the
branch was rebased onto current `origin/main`.

HawkScan could not start locally because this environment has neither the
HawkScan CLI nor Docker and has no `HAWK_API_KEY`. The repository's protected
hosted HawkScan job subsequently passed on the pull request head.

## Scope and system boundary

- Product: Semester's existing React 19 / TypeScript / Vite application.
- Working branch: `codex/product-hardening-audit`.
- Product worktree: `.worktrees/product-hardening-audit`.
- Persistence: IndexedDB/local storage, with optional Supabase auth and sync.
- Authorization boundary: server policies and RLS, not browser role checks.
- Delivery boundary: local branch changes only. Nothing in this pass was
  merged, deployed, activated for a tenant, or institutionally approved.

The detailed architecture, risk ranking, and validation plan are in
`AUDIT_PLAN.md`.

## Confirmed findings and improvements

### 1. Workspace pages lacked a page heading

**Before:** Search rendered the Semester wordmark as a `span`, while All Apps
started at `h2`. Because the workspace intentionally suppresses the global
`Header` on both routes, the rendered document contained no `h1`.

**After:** Search wraps its existing wordmark in a reset, visually unchanged
`h1`. All Apps promotes its existing welcome line to `h1`. A landmark regression
test explicitly requires one heading on every headerless workspace screen.

### 2. Workspace route focus was stranded

**Before:** Browser verification showed that choosing **Explore all apps** left
`document.activeElement` on `BODY`. The global header's focus effect cannot run
when that header is intentionally unmounted.

**After:** The persistent workspace shell now focuses the route's
`h1[data-page-title]` after a screen change. A `MutationObserver` covers the
short interval where a lazy route is behind `Suspense`, and disconnects as soon
as the heading appears or the route changes.

Browser verification confirmed:

- Search navigation lands focus on `H1` “Semester”.
- All Apps navigation lands focus on `H1` “Welcome to Semester”.
- Both routes expose exactly one `h1`.
- No unnamed interactive controls were found on the inspected routes.
- No unintended page-level horizontal overflow was found at the inspected phone
  size. Desktop card-description overflow was the existing intentional clipped
  secondary line, not page overflow.

### 3. Render-time clock reads reduced determinism

**Before:** `Gallery` called `Date.now()` during render. `GoalPlan`,
`WeeklyReflection`, and `Toolkit` created a new `Date` as a render-time default.

**After:** These components use the app's existing `useNow()` clock while still
honouring injected `now` values in tests. `PacketPreview` keeps its timestamp at
the confirmation action boundary so a long-open confirmation screen does not
release with a stale render timestamp.

### 4. A test helper asserted through a possibly missing control

**Before:** `ProductivityPreparation.test.tsx` used an optional-chain result with
a non-null assertion, hiding the useful failure when a labelled field vanished.

**After:** The helper asserts that the field is an `HTMLInputElement` and throws
a labelled diagnostic before interacting with it.

## Validation evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Full baseline test suite | Pass | 1,245 files passed, 1 skipped; 19,424 tests passed, 51 skipped |
| Focused post-change tests | Pass | 6 files, 54 tests |
| Landmark regression rerun | Pass | 1 file, 16 tests |
| Lint and repository policies | Pass | 23 warnings, below the 25-warning budget; styles, labels, and terminology checks pass |
| Production build | Pass | TypeScript project build and Vite production build completed |
| Institution boundary | Pass | `tsc -p tsconfig.university.json` |
| Real-browser phone check | Pass for inspected routes | Effective viewport 351 × 760; headings, names, route focus, and page overflow inspected |
| Real-browser desktop check | Pass for inspected route | Effective viewport 1153 × 720; one heading and no unnamed controls |
| Post-change full suite | Pass | 1,246 files passed, 1 skipped; 19,481 tests passed, 51 skipped |
| HawkScan DAST | Pass in protected CI | Hosted `hawkscan` job passed on pull request #1097; the local runtime remained unavailable |

The first full baseline used the same locally resolved dependency set as the
post-change checks. An earlier post-change attempt encountered broad scanner-test
timeouts while another Vitest process was running from
`.worktrees/production-migrations`; it was superseded by the isolated green run
recorded above.

## Remaining risks and recommended next work

1. **Keep hosted HawkScan coverage in the protected merge path.** The local
   environment cannot reproduce it without the CLI and credentials, so CI is
   the authoritative DAST gate for this release.
2. **Continue reducing the 23 React warnings.** The warning gate now has two
   slots of headroom, but remaining render-time refs, effect-driven state, and
   two `Sheet` clock reads still deserve focused fixes rather than suppression.
3. **Measure large production chunks before changing boundaries.** The build
   still warns about chunks above 500 kB. Several are deliberately lazy heavy
   tools; split only where route timing shows user-visible cost.
4. **Keep browser coverage representative, not implied universal.** This pass
   verified the workspace routes that produced the confirmed defect. It is not
   a claim that every one of Semester's many screens and states received a full
   manual accessibility audit.

## Changed files

- `app/src/App.tsx`
- `app/src/a11y/landmarks.test.ts`
- `app/src/screens/Search.tsx`
- `app/src/screens/Directory.tsx`
- `app/src/styles/app.css`
- `app/src/components/Gallery.tsx`
- `app/src/components/GoalPlan.tsx`
- `app/src/components/WeeklyReflection.tsx`
- `app/src/components/toolkit/Toolkit.tsx`
- `app/src/components/PacketPreview.tsx`
- `app/src/components/ProductivityPreparation.test.tsx`

No dependency manifest, lockfile, migration, server policy, secret, deployment
configuration, or live environment was changed.
