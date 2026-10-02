# Critical-journey browser accessibility smoke

**Produced:** 2026-10-02
**Source branch:** `codex/recovery-resilience-clean`
**Validated source:** merge commit `628f7093` (the later `6ea0f9b3` commit changed only release evidence text)
**Owner:** Accessibility

## Result

The production bundle built successfully from the current-main-integrated
readiness branch. The real-browser accessibility smoke completed all 24 cases:
six release-critical journeys across four test conditions.

```
accessibility smoke ok — 6 critical journeys at desktop, 200%/400% reflow and WCAG text spacing; skip focus, landmarks, titles, names and ARIA references verified
```

## Scope

The six journeys were Home, Calendar, Courses, Assignments, Registration and
Degree. Each was opened in installed Google Chrome against a local server
serving the production build at:

- 1280 × 900 desktop;
- 640 × 900, the 200% reflow equivalent from a 1280-pixel baseline;
- 320 × 900, the WCAG 400% reflow width from that baseline; and
- 1280 × 900 with WCAG 1.4.12 text-spacing overrides.

For every case, `app/scripts/accessibility-smoke.mjs` checked that the route
loaded without a page error, did not overflow at the page level, had one main
landmark and one page heading, exposed a route-aware document title, kept
visible controls named, kept IDs unique and ARIA references valid, and made
the skip link the first keyboard stop before transferring focus to `main`.

The same merged tree also passed:

- the full application suite: 1,261 files, 19,632 tests passed, 48 skipped;
- the release-register suite: 64 files, 765 tests passed;
- lint and form-label checks;
- TypeScript compilation and the production build; and
- production bundle budgets.

## Boundary

This is automated regression evidence. It is not a WCAG 2.2 AA audit, a
screen-reader evaluation, a manual browser-zoom review, a VPAT, an ACR, or an
accessibility certification. The qualified evaluator gate remains open until a
person completes the six-workflow protocol in
`docs/accessibility/AT-PASS-PROTOCOL.md` and signs the findings or remediation
disposition.
