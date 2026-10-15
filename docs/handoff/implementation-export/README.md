> In this design project `public-site/app.js`, `site-core.js`, `source/registry-source.js` and the `.jsx` excerpts end in `.txt` so the design-system bundler skips them. Rename back before running the tests. Findings 1, 6, 8 and 9 in `source/PUBLICATION-FINDINGS.md` are fixed in `ui_kits/company-site` (form says "saved in this preview — not sent", Sign in → platform, WCAG/standards wording, Fri 9 Oct); finding 4 softened to "built to keep … evidence in the Trust Center". Finding 2 (pilot claim) follows the founder-approved wording.

# Semester refreshed implementation and architecture export — 2026-10-13
## Start here
Open public-site/standalone-preview.html. Its workspace selector opens public pages, shared services and the student journey. Source code is provided separately in public-site/index.html, styles.css, app.js, site-core.js and routes.json. Forms and page states are local demonstrations only.

## Scope
- Public architecture: 44 route patterns, 12 component contracts, 44 wireframes. Ten routes map to inspected existing prototype pages; other patterns are proposed capability expansions, including shared sign-in and 404.
- Shared services: all 13 source-declared services with authority boundaries, contracts and negative-test requirements.
- Student experience: 40 design-catalog steps with proposed capability crosswalks, daily/learning/registration/privacy loops.
- Implementation export: all 122 original capability definitions, individual specs, 732 maturity rows, source data catalog, reconciliation findings, server integration ports and execution handoff.
- Original HTML preserved unchanged; exact inspected project source excerpts kept separate from newly generated runnable code.

This is a refreshed consolidated export, not a byte-identical reconstruction of the earlier generated archive. No production checkout or deployment is represented by it.

## Verified
54 Node tests passed. Chromium checked 44 views/wireframes, 308 state presentations, 13 shared-service entries, 40 student-step entries, mobile reflow, validation focus and local-receipt wording with no observed page errors. These tests validate this preview only. PDF generation and ZIP integrity verified.
Run pure tests from package root: node --test tests/site-core.test.cjs
Optional browser reproduction: install approved Playwright/Chromium tooling in your development environment, then python tests/browser-smoke.py. Those dependencies are not bundled.

## Not verified/implemented
Actual live repository backend, deployment, identity, message delivery, booking, CRM, CMS, status feed, professional accessibility/security/legal review, institutional acceptance or production-enabled capabilities. TypeScript ports were not compiled. Local receipts never mean messages sent or meetings booked.

## Source context
Project paths inspected: ui_kits/company-site/index.html, Site.jsx, Pages.jsx; docs/master/SEMESTER_WORKFLOW_CATALOG.md; docs/native-platform/NATIVE_WORKFLOW_CATALOG.md; handoff/mainframe/START.md. Registry/catalog decoded from attached The-Main-Semester-design-system.html.
Source namespace differences and questionable workflow/system mappings need reconciliation, not automatic authority inheritance. Exact source excerpts are not complete JSX exports.
Do not enter student records, credentials or private financial data. No external systems were modified.
