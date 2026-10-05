# Semester design refinement: third-pass audit

Date: 2 October 2026
Reviewed commits: `1cbacf01`, `98437503`
Branch: `codex/design-refinement-20261002`

## Verdict

**The second-pass request-changes verdict still stands.** This sweep did not
find a new accessibility, forced-colors, responsive-overflow, or route-state
blocker. It did confirm one additional metadata defect: client-side routes
update the browser title, description, and canonical URL, but leave all Open
Graph fields on the initial home-page values. The four required findings in
the second-pass audit also remain unresolved because this pass is audit-only.

## New required finding

### 5. Route-level Open Graph metadata remains frozen on the home page

`setMeta()` updates the standard description and canonical link after every
client-side route change, but it does not update `og:title`, `og:description`,
or `og:url`. On the live local Trust route, the browser title correctly became
“Trust Center · Semester,” the canonical became
`https://www.semester.website/trust`, and the standard description became the
Trust introduction. The Open Graph fields still advertised the initial home
page:

- title: “Semester — Make your next academic decision with confidence.”
- URL: `https://www.semester.website/`
- description: the generic student-action-platform/private-beta copy

This is broader than second-pass finding 2. Even after aligning the home-page
promise, every route would still share home-page metadata unless route-aware
Open Graph values are updated or the routes receive server-rendered head
metadata.

**Remedy:** make `setMeta()` update the Open Graph title, description, and URL
from the same resolved route values used for `document.title`, the standard
description, and the canonical link. Add route-level assertions for at least
Product, Pricing, and Trust, plus the home route. Because social crawlers do
not consistently execute client-side JavaScript, confirm the production
sharing requirement before treating client-side mutation alone as complete;
static route responses or prerendered metadata may be required.

Evidence: `company-site/index.html:13`, `company-site/index.html:15`,
`company-site/index.html:4096`, `company-site/index.html:4114`.

## Previously required findings still open

1. The shared semantic token vocabulary is declared but largely not consumed.
2. The revised home hero and the static Open Graph title disagree.
3. The seventh proof step has a stray right divider at the two-column
   breakpoint.
4. The reading measure changed from 68ch to 66ch despite the migration-safe
   claim.

No implementation files changed in either audit commit, so none of these
findings has been remediated by the audit documentation itself.

## Checks completed in this sweep

- **Forced-colors, company site:** Windows forced-colors emulation activated;
  the brand mark, primary action, content borders, and keyboard-focus outline
  remained visible with system colors.
- **Forced-colors, application:** controls, boundaries, text, and the skip-link
  focus outline remained visible with system colors.
- **Company-site axe, home:** zero violations and zero incomplete results.
- **Company-site axe, search dialog:** zero violations and zero incomplete
  results with the modal open.
- **Company-site axe, navigation drawer:** zero violations and zero incomplete
  results with the drawer open.
- **Representative route state:** Product, Pricing, and Trust each exposed one
  visible page, one `main`, and one H1; the URL and document title updated to
  the selected route.
- **Route metadata state:** the Trust route demonstrated that the standard
  description and canonical updated while all three Open Graph values did not.

The browser emulation and local accessibility instrumentation were temporary;
forced-colors was reset and no runtime code was modified.

## Review conclusion

The refinement remains a sound visual direction and the inspected interaction
states are robust. Merge readiness still depends on resolving or accurately
rescoping the four second-pass findings and the route-sharing metadata defect
above. The strongest next implementation pass is small and testable: adopt a
canonical semantic-token slice, fix the proof divider and reading-width claim,
and make both home and route metadata internally consistent.
