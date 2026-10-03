# Responsive QA Plan

| Control | Value |
| --- | --- |
| Status | **CONTROLLED QA PLAN — AUTOMATED GUARDS PARTIAL; DEVICE MATRIX OPEN** |
| Owner | Harrison Rubin — Product Design and Frontend Engineering; backup device-matrix reviewer unassigned |
| Evidence date | 2026-10-03 at repository revision `8fc5fd56` |
| Canonical breakpoints | behavior follows repository media contracts; required observation widths below are test points, not new CSS breakpoints |

## Required observation matrix

| Width/context | Product mode | Required evidence |
| --- | --- | --- |
| 320 px | smallest supported reflow | no page overflow/clipping; primary task, source, help and recovery remain reachable |
| 390 px | common phone | one-column decision flow, sheets/keyboard/safe-area behavior, touch targets |
| 600–760 px | transition/high zoom | no breakpoint dead zone; desktop keyboard on narrow viewport still works |
| 768–840 px | small tablet | single-pane or focused layout; no compressed desktop grid |
| 1024 px | tablet/laptop | navigation and content coexist; drawers do not obscure work/focus |
| 1180–1280 px | desktop transition | optional context may appear without changing DOM/reading meaning |
| 1440–1600 px | wide desktop | readable line length and bounded workspace; no decorative empty sprawl |
| 200% and 400% zoom | effective narrow layout | reflow, focus visibility and every critical action preserved |
| portrait/landscape | phone/tablet rotation | context and unsaved work preserved; no duplicate navigation |

## Journey and state coverage

Test the first win, Today, My Path/registration, course/study, support/recovery, account/data rights and pilot workflow. At every applicable tier exercise first-run/empty, loading/saving, success, long content, stale, offline/degraded, restricted, validation/error, overlay, external handoff and resumed state.

Use long course names, translated-expansion strings, policy text, source excerpts, keyboard opening, large text, slow loading and populated tables/lists. Two-dimensional surfaces such as calendars, maps and canvases may pan only when a reachable agenda/list/table or equivalent task path exists.

## Interaction checks

- Exactly one usable navigation for the mode; stable route and back-to-context behavior.
- DOM/heading/focus order matches meaning when columns collapse or detail becomes a sheet/drawer.
- No essential control is hover-, swipe- or drag-only; pointer and keyboard alternatives remain visible.
- On-screen keyboard and safe-area insets do not cover the active field, action, error or sheet close control.
- Sticky headers, bottom navigation, assistant/composer and notices do not obscure focused content.
- Tables, charts, editors, cards and action rows wrap, scroll locally with labels, or switch to an equivalent semantic form.
- Reduced motion and calm settings remove decorative movement without hiding state change.

## Execution and artifacts

Run width/media/unit guards, the production build and browser smoke first. Then capture per-journey screenshots or video at required widths, light/dark representative grounds, largest text, reduced motion and at least one failure/empty state. Record browser/OS/device, DPR, input method, zoom, orientation, fixture, result, defect and owner. Compare with approved references; do not approve from a single desktop screenshot.

## Release rule

Horizontal page overflow, clipped/obscured primary action, lost data/context on resize/rotation, inaccessible alternative, duplicate/missing navigation, unreachable close/back/recovery, or a core task that cannot complete at a required tier blocks the affected release. Cosmetic differences may be accepted only with an owner and rationale.

## Evidence state

**Code/config evidence.** Width, breakpoint, chrome, focus, target, motion and selected screen tests exist; the prior responsive/accessibility plan includes manual checks.

**Operational evidence.** No current complete device/browser/zoom artifact set or CI screenshot-diff baseline covers the finalized journey/state matrix.

**Missing test/proof.** Automate route overflow/reflow checks where stable, execute the device/browser matrix, validate real mobile screen readers and keyboards, capture approved reference screens and close critical defects.

## Claim ceiling

Semester may say it has canonical responsive modes, automated structural guards and a controlled QA matrix. It may describe a tested viewport/route only with the recorded environment and date.

## Prohibited claims

Do not claim universal device support, pixel-perfect responsiveness, complete mobile validation, zoom conformance or absence of overflow from source review or a few screenshots alone.
