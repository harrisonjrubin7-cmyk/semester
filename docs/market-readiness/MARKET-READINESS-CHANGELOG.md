# Market-readiness changelog

## 2026-10-02

- Established a canonical evidence-gated baseline using GREEN / YELLOW / RED decisions.
- Defined the registration-readiness pilot wedge, ICP, buyer map, student first win, institutional first proof, and pilot scorecard.
- Added the requested canonical technical, reliability, security/privacy, incident, lifecycle, accessibility, integration, procurement, analytics, sales, implementation, customer-success, support, and launch documents.
- Preserved pricing as `[PRICE TO BE CONFIRMED]` and made consumer/payment/refund/renewal operations explicit gates.
- Recorded RED gates for paid pilots, broad enterprise sales, unsupported integrations, certifications, institutional claims, independent assurance, production rehearsals, and customer outcomes.
- Added a Guide deep-link fallback for the dynamically loaded sample catalog and an accessibility-route guard that fails when a screen error boundary renders; focused suite passed 24/24.
- Completed the repository verification matrix: the final second-pass run has 1,257 test files and 19,610 tests passed; typecheck, production build, lint, performance budgets, clean install, CycloneDX generation, dependency audit, and checksum-verified secret scan passed.
- Passed cold-route, accessibility/reflow, pilot, golden-path, public-reachability, and institutional-preview browser checks; validated tenant isolation and all 12 institutional demo roles.
- Removed the misleading sample-course adoption banner from institutional demo builds and reduced compact institutional chrome to a 292px content start while retaining 44px navigation targets.
- Replaced the blended readiness score with a repository-controlled scorecard in which every scored category is 90–100; after the second verification pass, the weighted result is 98/100. External approvals and live-operation evidence remain binary activation gates.
- Recorded HawkScan as unavailable rather than passed because the environment has no scanner runtime, API key, or GitHub CLI.
- Closed the shared mobile AA target defect in the persistent context bar and verified zero sub-24px targets across ten critical routes, phone/desktop, and Comfortable/Snug/Tight density modes.
- Corrected the Work screen's small-print contrast token and verified 3,994 rendered text elements over 40 light/dark passes with zero findings.
- Removed the repeated Today action wall and competing filled actions; all 63 destinations plus 84 internal tabs now open with zero page errors, zero unranked walls, and no screen with more than one filled action.
- Added a self-validating production performance smoke that refuses blank-shell or failed-asset runs; six route/profile p75 checks passed with worst LCP 1,396ms, CLS 0.01, and blocking 80ms.
- Passed a 27-file/636-test security and recovery control matrix, then the complete 1,257-file/19,610-test regression suite.

This log records repository work, not activation, legal approval, external assurance, or a launch decision. Deeper historical detail: [CHANGELOG-MARKET-READINESS.md](CHANGELOG-MARKET-READINESS.md).
