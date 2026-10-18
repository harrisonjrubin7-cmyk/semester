# Accessibility Test Plan

| Control | Value |
| --- | --- |
| Status | **CONTROLLED TEST PLAN — AUTOMATED COVERAGE PARTIAL; MANUAL/EXTERNAL EVIDENCE OPEN** |
| Owner | Harrison Rubin — company-side Accessibility, Product Design and Engineering coordination; backup and qualified external reviewer unassigned |
| Evidence date | 2026-10-03 at repository revision `8fc5fd56` |
| Standard basis | WCAG 2.2 AA evaluation target, subject to qualified scope/applicability review |

## Scope and priority

Test the student first win, Today/action completion, My Path/registration, course/study, support/recovery, account/data rights and the bounded pilot workflow before lower-risk secondary screens. Include shared shell, overlays, errors, charts/media, documents, external handoffs and AI disclosures used by those journeys.

Automated checks find only part of accessibility risk. Passing axe, contrast, label, focus, target or type tests is not a conformance determination and does not replace assistive-technology and disabled-user review.

## Test matrix

| Mode | Required checks | Evidence |
| --- | --- | --- |
| Keyboard only | skip route, logical order, visible/unobscured focus, all actions, no trap, overlay focus/return, drag alternatives, error navigation | annotated script, results and defects |
| Screen reader desktop | landmarks/headings, names/roles/states, page/route announcement, tables/lists/forms, status/errors, dialog behavior, source/AI/limit text | VoiceOver + Safari and/or NVDA + Chrome/Firefox record |
| Screen reader mobile | navigation, sheets, tab bars, gestures with accessible alternatives, dynamic results and errors | VoiceOver iOS and TalkBack Android scope record |
| Zoom/reflow | 200% and 400%; text-only enlargement; no lost content/action; logical one-column order | screenshots and task result at effective narrow widths |
| Contrast/forced modes | text/non-text/focus, high contrast/forced colors, selected/disabled/error states, every material ground/accent | automated sweep plus manual verification |
| Motion/cognition | device reduced motion and Semester calm settings; no essential timing/motion; predictable labels and recovery | settings matrix and task evidence |
| Touch/pointer | target size/spacing, orientation, pointer cancellation, no hover/swipe-only control | device/browser result |
| Forms/errors | instructions, autocomplete, labels, required/invalid state, inline and summary errors, preserved values | successful and failed submission evidence |
| Media/charts/files | captions/transcripts, controls, text/table equivalent, document semantics and download alternative | artifact review |
| Language/content | plain language, no color-only/state-only meaning, long text, magnification, translation expansion | content and layout review |

## Automated repository checks

Run the relevant axe, contrast, focus, label, landmark, target, text-scale, motion/calm, telling, modal, dragging, width and component tests; build the production bundle; and run the existing accessibility smoke. Record revision, command, environment, pass/fail/skip counts and artifacts. A skipped or unexecuted check is not a pass.

## Manual execution protocol

1. Reset to a documented data fixture and target configuration.
2. Test each journey without a pointer before using assistive technology.
3. Repeat with the named screen reader/browser combinations, 200–400% zoom, reduced motion, forced/high contrast and largest Semester text setting.
4. Exercise first-run, empty, loading, success, stale, offline/degraded, restricted, validation, error and recovery states.
5. Record exact route, control, expected/observed behavior, WCAG mapping, affected people, severity, workaround, owner and retest evidence.
6. Retest fixes and a neighboring regression scope. Obtain qualified review for any conformance statement or ACR/VPAT.

## Severity and release rule

P0 blocks access to critical safety/rights or creates immediate harm; P1 prevents a core task without an equivalent path; P2 creates material friction or ambiguity; P3 is limited polish/debt. Unresolved P0/P1 issues block the affected release/pilot. A workaround must be usable, documented, communicated and temporary; it does not convert a failure into conformance.

## Evidence state

**Code/config evidence.** The repository contains broad automated checks and shared accessible interaction primitives, described in [`RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md`](../RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md).

**Operational evidence.** Prior point-in-time audits exist, but no current complete manual matrix, disabled-participant study, qualified conformance assessment or scoped ACR covers the finalized journeys.

**Missing test/proof.** Execute and file the matrix across the required journeys and states; include real devices/assistive technology and representative disabled users; close critical defects; obtain qualified external review where a customer/public claim requires it.

## Claim ceiling

Semester may say it uses automated accessibility safeguards and has a controlled manual test plan. It may state exact test results with date, routes and technology.

## Prohibited claims

Do not claim WCAG conformance, full accessibility, VPAT/ACR completion, zero barriers or institution acceptance from automated tests or this plan alone.
