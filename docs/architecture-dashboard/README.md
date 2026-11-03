# Semester architecture dashboard — package and status

Source: architecture package uploaded 2026-10-13 (`Semester-architecture-dashboard-and-code-review.zip`, sha256 `98fce65d…79bbab6`). `index.html` is the uploaded dashboard (sha256 `d6a41fb2…7507fd3a`) with four changes made in this repository: (1) search matches only route, title and regions; (2) the skip link focuses `main` without rewriting the route in `location.hash`; (3) dark-theme variables are reset under `@media print`; (4) the wireframe render omits the `hero` and `CTA` regions that the shell already renders. The current file's sha256 is `488d8cbf…de14`.

## Contents

| File | Purpose |
|---|---|
| `index.html` | Static route mapper for 44 public/entry patterns, component trees, per-page wireframes. No network calls, no records, no auth. |
| `vercel.json` | Headers for a noindex static preview: CSP `connect-src 'none'`, `X-Robots-Tag: noindex, nofollow`. |
| `public-route-contracts.json` | 44 public route patterns (source for the dashboard). |
| `platform-route-contracts.json` | 122 capability contracts across 8 workspace families. |
| `COVERAGE-MATRIX.md` | Generated inventory of all 122 capabilities and 44 public patterns with implementation / verification / deployment status. |
| `FULL-PLATFORM-SITE-ARCHITECTURE.md`, `PUBLIC-PAGE-WIREFRAMES.md` | Architecture and wireframe specification. |
| `reviews/SHARED-AND-STUDENT-CODE.md` | Partial source review of five repository files (2026-10-13). Not a test run. |
| `EXACT-DEPLOYMENT-REQUEST.json` | Deployment request as prepared in the package (Vercel team and file payload). |

## Verified in this change

- Headless Chromium (`/opt/pw-browsers/chromium`) at 1280×900 and 390×844: 44 of 44 routes listed; search filters to 2 for "pilot"; no horizontal page overflow; no page errors or console errors; zero non-`file://` requests.
- Screenshot pixels were not visually inspected; the checks above are DOM-level.

## Status (not product evidence)

- Designed: yes (this package). Implemented as product: no. Tested as product: no. Deployed: no deployment of this dashboard was made. Vercel's GitHub integration built previews of other linked projects from the branch push; none is a deliberate release of this package. Institution-authorized: no. Production-enabled: no.
- Capability entries in `platform-route-contracts.json` read "design source; live implementation not assessed". Public entries in `public-route-contracts.json` read "prototype mapping; clean URL proposed" or "proposed extension". Both are design declarations, not evidence of a live route.
- The package says a dashboard deployment is a design preview, not product activation.

## Open items before any release

1. Explicit confirmation of the preview deployment target and any production alias (none was made).
2. Acceptance criteria, owners and data-contract review for each of the 122 capabilities. None is written yet, and `COVERAGE-MATRIX.md` has no acceptance-criteria column; the Blockers column records this gap per row.
3. Independent accessibility and security review of the dashboard (not performed here).
4. Repository shared services named in the spec (identity, memberships, audit, files, AI gateway, outbox, notifications, search) are not implemented in this change.
