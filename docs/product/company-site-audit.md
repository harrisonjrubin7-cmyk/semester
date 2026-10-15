# Company-site audit

Date: 2026-10-03  
Evidence boundary: repository behavior only; not a claim about the currently deployed revision, inbox staffing, approvals, or conversion performance.

## Current architecture

There are two materially different public-site systems:

1. `company-site/`: a large hand-authored single-document site using hash navigation, `site.css`, `site.js`, Vercel rewrites, screenshots, sitemap, CSP, forms, and many legacy persona/procurement pages.
2. `app/src/site/`: a typed React static renderer built by `app/scripts/build-site.mjs` into `app/dist-site/`, with one HTML file per route, shared app fonts/tokens, route tests, canonical/OG support when an origin is supplied, and interactive scripts only for tools.

Both contain valuable work. Shipping both as authorities is the defect.

## Conversion, trust, and SEO gap matrix

| Area | Current strength | Gap | Required decision |
|---|---|---|---|
| Positioning | Student-action and operating-system narratives both exist | Headline and promise differ between stacks | Approve one message architecture |
| Student path | Signup/login handoff and free tools exist | First-value promise is not measured end to end | Define onboarding conversion and activation event |
| Institution path | Procurement, trust, readiness, and contact content is extensive | Qualification→request→security review→implementation is not one persisted workflow | Approve lead fields, routing, SLA, and CRM/manual owner |
| Family path | Product contains family controls | Public family education is not a canonical top-level route in both stacks | Approve consent language and support boundary |
| Partner path | Community/partner content exists | Verified application/agreement/review workflow is not established as public conversion | Approve partner criteria and agreement process |
| Trust | Strong honesty patterns, known limitations, policies, evidence pages | Certification/compliance language still requires release-by-release claim review | Name legal/security approvers and evidence expiry |
| Pricing | Pricing/plan content exists and uses planned/private-beta qualifiers | Commercial authority and provider state are external | Founder/finance approval before public amounts or availability |
| SEO | Sitemap, robots, canonical, descriptions, OG, semantic markup exist | Hash-based legacy pages and generated path pages encode different URL strategies | Choose canonical renderer and permanent redirects |
| Structured data | Organization JSON-LD exists in legacy page | Entity details, email, founder/social links require approval and maintenance | Approve public corporate facts and owner |
| Analytics | No third-party analytics; attribution accompanies submitted forms | Requested marketing taxonomy and consent-aware measurement are absent | Approve event catalog, retention, and access |
| Content operations | Source and tests are versioned | No explicit preview→review→approve→publish→rollback owner workflow | Establish content release gate |

## Brand and creative findings

- The existing Semester language is distinctive: calm, source-aware, academic, and trust-forward.
- The legacy public site is visually rich but extremely broad; mega-navigation exposes organizational complexity before visitor intent is known.
- The generated site is more reduced and technically maintainable, but it currently covers fewer audience-specific conversion journeys.
- The app and public site now share typefaces and several visual cues, but they do not yet share a governed semantic-token package.
- Screenshots are valuable proof only when their commit, capture date, environment, and fictional/real status stay visible.

## Required canonical information architecture

Use the charter's ten public groups, but keep the global header limited to Product, Solutions, Trust, Resources, Pricing, and Company. Route Students, Institutions, Families, and Partners from the hero and role selector. Legal remains in the footer. Integrations should be reachable from Product and Trust.

## Recommended convergence rule

Make `app/src/site` the authored source because it is typed, route-tested, multipage, and build-derived. Port approved content and conversion flows from `company-site/`; do not wholesale replace its brand work. Freeze the legacy file to redirects after parity is proved. Deployment ownership is a separate approval.

## Claims policy

Every material claim must carry one of: repository-evidenced, deployment-observed, externally approved, customer-observed, or planned. A claim requiring more than one class cannot publish until all required classes are present and unexpired. Never infer customer operation, certification, staffing, financial availability, or institutional approval from code.

