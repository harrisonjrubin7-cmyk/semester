# Responsive QA Plan

| Control | Value |
| --- | --- |
| Status | **CONTROLLED QA PLAN — AUTOMATED GUARDS PARTIAL; DEVICE MATRIX OPEN** |
| Owner | Harrison Rubin — Product Design and Frontend Engineering; backup device-matrix reviewer unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
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

Horizontal page overflow, a clipped or obscured primary action, lost data or context on resize or rotation, an inaccessible alternative, navigation that is duplicated or missing, unreachable close, back, or recovery controls, or a core task that cannot complete at a required tier blocks the affected release. Cosmetic differences may be accepted only with an owner and rationale.

## P06 repository and browser validation — 2026-10-03

The focused repository suite passed 31 files and 294 tests covering axe checks, focus and keyboard behavior, labels, landmarks, titles, modal behavior, drag alternatives, field and failure messages, offline state, reduced-motion and calm settings, type scale, narrow headers, safe-area and target CSS, scrolling, and Calendar keyboard and target behavior. TypeScript and the production build passed; Vite retained its existing advisory for chunks above 500 kB.

The local production bundle then passed the browser accessibility smoke on Home, Calendar, Courses, Work, YES, and Degree at desktop and 320 CSS-pixel reflow/400% effective zoom with reduced motion enabled. The smoke verified skip-link focus transfer, page titles, landmarks, accessible names, ARIA references, and absence of horizontal page overflow. This is evidence for those six signed-out fixtures in the local Chrome environment, not every route, signed-in state, browser, device, assistive technology, or deployment.

The final cold-load performance run passed all six route/profile checks, with three runs per check:

| Profile/route | FCP | LCP | CLS | Main-thread blocking |
| --- | ---: | ---: | ---: | ---: |
| phone / Home | 368 ms | 648 ms | 0.001 | 0 ms |
| phone / Work | 292 ms | 364 ms | 0.001 | 1 ms |
| phone / Degree | 468 ms | 548 ms | 0.001 | 135 ms |
| desktop / Home | 240 ms | 424 ms | 0.010 | 1 ms |
| desktop / Work | 212 ms | 416 ms | 0.010 | 30 ms |
| desktop / Degree | 316 ms | 472 ms | 0.010 | 0 ms |

An earlier full run measured 514 ms blocking on desktop Home against the 200 ms guard. A five-run isolated confirmation measured 0 ms and the complete rerun measured 1 ms, so the result was not reproduced and is retained as a laboratory spike rather than treated as a closed product defect. The bundle budget also passed: 435.0 KB first load against 479.0 KB, a 435.7 KB largest file against 480.0 KB, across 93 routes.

The Comfortable-density target sweep opened all six selected destinations at phone and desktop widths. It found no controls below the 24 CSS-pixel WCAG AA floor and no controls that were unreachable by scroll. At phone width it measured 199 controls, one inline exemption, and 50 controls below the 44 CSS-pixel AAA design aim; at desktop it measured 267 controls and 114 below that aim. It also inventoried 161 of 389 phone text nodes and 217 of 481 desktop text nodes below 12 CSS pixels. The AAA target and small-text counts are design-review observations, not claims of WCAG failure; six phone and seven desktop controls were painted over at initial rest but reachable by scrolling and remain candidates for manual obstruction review.

The scoped contrast sweep measured 1,199 text elements across 158 resting, hover, focus-visible, and focus passes on the same six destinations in the dark `ink` ground and reported zero findings. It did not measure 98 gradient-painted elements, four elements without resolvable text/color, 82 decorative glyphs, 47 passes that yielded no measurable text, the other 57 destinations, or the other dark and light grounds.

Open proof remains: manual screen-reader and mobile virtual-keyboard operation, real-device portrait/landscape and resize continuity, the other required viewport tiers and 200% zoom, signed-in and populated/error fixtures, representative users, approved screenshots, all destinations and grounds, and deployed-target validation. No result in this section establishes universal accessibility, device support, institutional acceptance, production activation, or observed user outcomes.

## Evidence state

**Code/config evidence.** Width, breakpoint, chrome, focus, target, motion and selected screen tests exist; the prior responsive/accessibility plan includes manual checks.

**Operational evidence.** No current complete device/browser/zoom artifact set or CI screenshot-diff baseline covers the finalized journey/state matrix.

**Missing test/proof.** Automate route overflow/reflow checks where stable, execute the device/browser matrix, validate real mobile screen readers and keyboards, capture approved reference screens and close critical defects.

## Claim ceiling

Semester may say it has canonical responsive modes, automated structural guards and a controlled QA matrix. It may describe a tested viewport/route only with the recorded environment and date.

## Prohibited claims

Do not claim universal device support, pixel-perfect responsiveness, complete mobile validation, zoom conformance or absence of overflow from source review or a few screenshots alone.
