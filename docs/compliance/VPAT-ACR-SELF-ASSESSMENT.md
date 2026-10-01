# VPAT / Accessibility Conformance Report self-assessment

**Status:** Internal self-assessment published; **no formal ACR has been issued**.

**Assessment date:** 1 October 2026

**Owner:** Harrison Rubin, founder

**Product scope:** Semester student web application and company website

This document is not a completed VPAT, an Accessibility Conformance Report, or
a claim of WCAG conformance. A formal ACR must be based on a complete human
evaluation of the production product and must disclose support levels and known
limitations criterion by criterion.

## Evidence available now

- Automated accessibility journeys run in CI at desktop and 320px reflow:
  `app/scripts/accessibility-smoke.mjs`.
- Contrast and component behavior are held by tests under `app/src/a11y` and
  `app/src/lib/contrast.test.ts`.
- The current component-level audit and its explicit unaudited areas are in
  `docs/WCAG-UI-AUDIT-SCORECARD.md`.
- The public accessibility statement remains a draft in
  `docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md`.

## Evaluation still required before an ACR

| Evaluation | Required record |
| --- | --- |
| Keyboard-only completion of critical journeys | Tester, browser/OS, route, result, defect link, retest |
| VoiceOver and NVDA task passes | Assistive technology/version, browser, route, announced output, result |
| 200% and 400% zoom and reflow | Viewport, zoom, horizontal-scroll result, obscured-content result |
| Touch target and alternative-input review | Device/input method, target failures, remediation and retest |
| Forms, errors, status messages, dialogs, tables, media, charts, and editors | Criterion-level finding with support level and limitation text |
| Production equivalence | Exact deployed version/SHA evaluated and date of evaluation |

## Issuance gate

After the human evaluation, every material defect must have an owner and
disposition, the tested production version must be recorded, and the final ACR
must be reviewed for accurate support language. Until then the permitted public
claim is: **"VPAT/ACR self-assessment published; formal human evaluation and ACR
pending."**
