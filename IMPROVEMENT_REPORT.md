# Semester full-site improvement report — 1 October 2026

## Executive summary

This pass reviewed Semester's complete 97-route application surface and built on
the latest `codex/frontend-usability-polish` branch. It preserved the existing
React/Vite architecture, navigation choices, student-controlled workflows and
near-black/metallic visual system.

No P0 build, route, data-loss or task-blocking accessibility failure was
reproduced. The highest-value remaining P1 was a shared semantic mismatch:
Accessibility tools and workflow steps looked and behaved like buttons opening
dialogs, but were implemented as empty native disclosure elements whose content
was portaled elsewhere. They now use a real button with an explicit dialog
relationship, accurate expanded state, and the same viewport-safe overlay,
focus, dismissal and state-retention behavior. This fixes both global tools from
one maintained primitive. A second render-safety cleanup replaces the class-chat
unread marker's render-time ref read with an opening-state snapshot, preserving
the position of the `NEW` divider while making the behavior explicit and
compiler-safe.

The production build, institutional TypeScript boundary, project policies,
focused regressions and isolated reruns all pass. Real-browser verification is
clean at phone and desktop sizes with no page overflow or console diagnostics.

## Full-site scope reviewed

- 96 registered screens across 90 lazy modules, plus onboarding.
- Primary Today, Courses, Study, Calendar and Progress/Me journeys.
- Eight directory shelves: Semester, Courses, Study, Make, Campus, Life, Beyond
  and Data.
- Workspace, mobile and alternate navigation shells; page/settings/specialized
  frames; global header, sidebar, tab bar and system context strip.
- Shared actions, forms, feedback states, overlays, source/trust indicators,
  data lists and responsive controls.
- Logged-out, unconfigured, unavailable and permission-gated institutional
  states without bypassing their safeguards.

The complete route inventory, architecture summary, checklist and prioritization
are in `FULL_SITE_AUDIT.md`. The earlier route-by-route visual evidence remains in
`docs/UI-USABILITY-REVIEW-2026-10-01.md`.

## Major findings

### Usability

- The existing branch had already corrected the highest-impact cross-product
  issues: clipped global tools, compact mobile search, inconsistent credentials,
  Today tab hierarchy, unclear accessibility controls, and undersized Quick Add
  actions.
- The remaining shared disclosure used an indirect native mechanism. Its visible
  control did not explicitly own the dialog it opened, making state and structure
  less predictable for assistive technology and future maintenance.

### Accessibility

- The shared tool trigger now exposes `aria-haspopup="dialog"`, a stable
  `aria-controls` target and accurate `aria-expanded` state.
- Escape and explicit Close both restore focus to the opener.
- Lazy-loaded content receives initial focus inside the dialog and remains
  mounted when closed, preserving read-aloud state.
- The two targeted render-time ref warnings in the shared disclosure and class
  conversation are gone. Lint passes with 22 remaining warnings, all outside
  the changed render paths and listed below.

### Responsive layout

- At the 320px test size, the Accessibility panel stayed within all four viewport
  edges and the document had zero horizontal overflow.
- At desktop size, Accessibility and Workflow panels remained attached to their
  triggers, fully reachable, and visually consistent with the established shell.
- No new breakpoint, shadow, radius, gradient or alternate component system was
  introduced.

### Design-system consistency

- The branch already consolidates panel positioning and behavior in `Popover`
  and global tool usage in `ToolDisclosure`.
- This batch completes that consolidation at the semantic layer: one button and
  dialog contract now serves both Accessibility tools and Decision Trail.
- Existing semantic tokens, spacing, typography, target sizes and motion
  preferences are unchanged.

## Changes implemented by priority

### P0

No confirmed P0 required a code change. Build, route exhaustiveness, and core
navigation were green at baseline.

### P1

1. Replaced the empty `details`/`summary` bridge in `ToolDisclosure` with a real
   button that reports popup type, expanded state and controlled dialog id.
2. Changed `Popover` to accept the concrete opener element and an optional id,
   removing render-time ref access while retaining opener-safe outside-click
   behavior.
3. Updated the shared open-state styling without changing the visual treatment.
4. Added regression assertions for dialog association, expanded state, close
   behavior and focus restoration in both global tool consumers.
5. Replaced the class conversation's render-time read of a mutable ref with a
   lazy state snapshot. The unread boundary still freezes when a room opens,
   so parent read-progress updates cannot make the `NEW` divider chase the
   reader down the transcript.
6. Added a component regression that loads messages on both sides of the
   opening mark, advances the parent mark, and proves the divider stays above
   the same first unread message.
7. Preserved the shared Back and global-action header when Search or App
   Directory owns the page heading outside Workspace. The header now omits
   only its duplicate title, and route focus follows the screen-owned heading.
8. Removed the broken initial `aria-controls` relationship from the lazy global
   Accessibility tools trigger. The relationship now appears with its real
   dialog target on first open and remains stable while that panel is retained.
9. Kept the shared header's flexible title column in place when Search or App
   Directory owns the visible heading, so Back and global actions retain their
   established alignment instead of jumping left.
10. Moved each selected Today tab's content ahead of the shared “More from
    Today” disclosure and reset that disclosure on tab changes, preventing
    secondary content from remaining expanded above the requested view.

### P2

- Added `FULL_SITE_AUDIT.md` with the route inventory, component inventory,
  design-system assessment, prioritized findings and implementation plan.
- Replaced the stale hardening report with this pass's exact scope and validation
  evidence.

## Routes and components improved

The change is visible anywhere `SystemContextBar` is rendered:

- `search` and `directory` through Accessibility tools.
- All regular student routes through Accessibility tools.
- Routes participating in a student workflow through Decision Trail.
- `classmates` through the stable unread boundary in an open room.

Shared implementation files:

- `app/src/components/Popover.tsx`
- `app/src/components/room/Talk.tsx`
- `app/src/components/unity/ToolDisclosure.tsx`
- `app/src/styles/unity.css`

Regression files:

- `app/src/components/Popover.behavior.test.tsx`
- `app/src/components/room/Talk.test.tsx`
- `app/src/components/unity/AccessibilityTools.test.tsx`
- `app/src/components/unity/SystemContextBar.navigation.test.tsx`

## Validation

| Gate | Result |
| --- | --- |
| Focused disclosure and conversation regressions | Pass: 4 files, 15 tests |
| Production build | Pass: TypeScript project build + Vite production build |
| Institution server boundary | Pass: `tsc -p tsconfig.university.json` |
| Lint | Pass: 22 warnings, below the 25-warning budget |
| Style policy | Pass |
| Accessible-label policy | Pass |
| Terminology policy | Pass |
| Full suite | 1,244 files passed, 1 skipped; 19,504 tests passed, 51 skipped; 5 source-census/property tests timed out under concurrent load |
| Isolated full-suite failure rerun | Pass: all 5 files, 60 tests |
| Phone browser check | Pass: contained dialog, no horizontal page overflow, accurate ARIA state, Escape focus return |
| Desktop browser check | Pass: Accessibility and Workflow dialogs associated with their triggers; clean console |
| Production accessibility smoke | Pass: 6 critical journeys at desktop and 400% reflow; skip focus, landmarks, titles, names and ARIA references verified |
| HawkScan local DAST | Unavailable: no HawkScan 6 runtime, Docker or `HAWK_API_KEY` in this environment |
| Hosted HawkScan | Pass on PR #1105 final head `1eeaf5c0` |
| Search/Directory review regression | Pass: 2 files, 13 selected tests; one `h1`, shared controls retained, Back restored, and route focus verified |
| Late review regressions | Pass: 2 files, 8 selected tests; shared actions retain their flexible spacer, Today tab content leads, and secondary disclosure state resets |
| Post-merge review corrections | Pass: 4 files, 108 selected tests; Course Hub create targets remain 44px, Workspace Search exposes one Quick Add, and scoped custom properties cannot impersonate global spacing tokens |

PR #1105 was squash-merged to `main` as `457f3c87`. Its final head
`1eeaf5c0` passed the complete hosted check set, including HawkScan. A clean
follow-up fixes the three actionable P2 findings posted after that final review:

- Course Hub's visually quiet creation buttons retain a 44px target.
- Workspace Search's inline `+` is the only Quick Add control in that frame.
- The style rule recognizes spacing steps only from global `:root`
  declarations, so a component-scoped custom property cannot validate an
  unrelated use.

The full-suite failures were timeouts only, not assertion failures, and all five
passed unchanged with one worker. The browser's effective CSS viewport was
slightly smaller than the requested outer size; containment was measured against
the actual viewport.

## Remaining known issues and risks

1. **Hosted security remains a per-head gate.** PR #1105's final head passed
   HawkScan. Any follow-up head must pass the same protected workflow before
   merge.
2. **22 React compiler warnings remain.** Highest-value groups are effect-driven
   state in real-time/call screens, ref reads in Green/Calendar, and manual
   memoization plus event-time clock reads in Sheet. Fix in isolated behavioral
   batches; do not suppress them globally.
3. **Large production chunks are warnings, not yet measured problems.** The
   largest diagram/parser and entry chunks should be profiled before changing
   boundaries; the expensive PDF, diagram and graph tools are already lazy.
4. **12ui CLI was unavailable locally.** No network installation was attempted.
   The pass therefore used Semester's established design system and existing
   route-by-route visual evidence rather than generating a replacement design.
5. Repository implementation and successful local/browser checks do not imply
   Vanderbilt approval, configured third-party credentials, staffed data-rights
   operations, or observed institutional production use.

## Suggested next improvements

1. Reduce the 22 React warnings in small, test-backed batches, starting with the
   real-time call surfaces and Sheet callbacks.
2. Add the repository's optional scratch Playwright runtime when a future pass
   needs repeatable screenshots across every breakpoint; keep it out of product
   dependencies.
3. Profile the two largest entry chunks on a cold mobile load before deciding
   whether another split materially improves task completion.
