# Marketing site backlog

Status: proposed, ordered. Nothing here is started in this phase except the audit
documents. "Owner decision" items cannot be resolved by engineering. Branch names follow
the plan in the request; each branch is a small reviewed PR that rebases onto `origin/main`.

## Decisions needed from the owner (blocking)

| ID | Decision | Recommendation | Blocks |
| --- | --- | --- | --- |
| D-1 | Public identity: keep Graphite/Brass, or move to indigo as the primary action colour | Keep; indigo stays an available accent | token work |
| D-2 | One renderer: converge on `app/src/site`, freeze `company-site/` to redirects | Yes, in the staged order in the IA doc §4 | everything under "build" |
| D-3 | Deployment target and `SITE_ORIGIN` for the new renderer; custom domain for app links (replace the personal GitHub Pages host) | Decide host and origin | SEO, canonical, sitemap |
| D-4 | Analytics: first-party, consent-gated collection, or none beyond lead attribution | Contract and no-op sink first; collection only after the preconditions | analytics events |
| D-5 | Pricing display: request-pricing only until a price book and an approval record exist | Yes | pricing page |
| D-6 | Name reviewers for Security, Privacy, Accessibility, Legal and counsel | — | all publish gates |
| D-7 | **Resolved by the owner:** `harrisonjrubin7@gmail.com` is the non-personal company mailbox for security, privacy, accessibility and contact. Remaining: confirm who monitors it and who else has access, and whether to give security reports a dedicated alias later | Use it as is | none; was blocking vulnerability reporting |

Each becomes `docs/decisions/D-<PR number>.md` once its PR exists (CLAUDE.md).

## P0 — exposure and live defects (independent of any new build)

| ID | Item | Evidence | Size |
| --- | --- | --- | --- |
| P0-01 | Add `security_report` and `privacy_request` to `cta_routes` (migration) with a `*.check.sql` test; verify both forms succeed end to end | audit F-01 [checked] | S |
| P0-02 | Remove or rewrite rows 2, 4, 5, 6, 14, 25, 31 of the claims audit (save 38%, "forever", institutional price floors, "24/7 operations", sample uptime figures, "Join the waitlist", the ✓ on the claims audit) | audit §2 | S, needs claim-owner go-ahead |
| P0-03 | Stop rendering pending frameworks with the "available" badge | audit F-02 | S |
| P0-04 | Tighten CSP `script-src` (drop cdnjs, jsdelivr, unused hash) | F-06 | S |
| P0-05 | Add a real 404 and `<noscript>` content on company-site while it remains live | F-04 | M |

## P0 — the build (the request's first 20 items), by branch

1. `audit/company-site-compliance-baseline` — **this phase:** the 14 docs.
2. `feat/shared-brand-token-system` — typed `app/src/design-tokens/*` read layer + drift test; marketing-expression and component tokens as aliases; contrast walk extended.
3. `feat/marketing-site-foundation` — `MarketingShell`, navigation (mobile drawer on `useModal`), footer, skip link, status/support/login handoff, 404, content-state components (`Empty/Error/Loading`).
4. `feat/marketing-lead-intake-consent` — migration (`site_consent`, `site_suppression`, structured attribution, audit event, per-email limit, first/last name), hardened `lead-intake`, `MarketingLeadForm` + `MarketingConsentControl`, error-summary component, tests.
5. `feat/marketing-homepage-pilot-pages` — homepage per the wireframe; `/pilot`; `/product/student-workspace`, `/institution-platform`, `/registration-readiness`.
6. `feat/marketing-trust-center` — `/trust/*`, `security.txt`, security-document request, accessibility and responsible-AI pages, privacy/legal navigation (all rendering draft status).
7. `feat/marketing-testimonial-governance` — claims/content read model (`marketing-public` Edge Function + service-role RPCs), `MarketingTestimonialCard`, `MarketingClaimDisclosure`, eligibility predicate, tests that unapproved/expired/withdrawn/unpermitted items never render. **Land before any page that shows proof.**
8. `feat/marketing-pricing-comparison` — `MarketingPricingTable`/`ComparisonTable` with request-pricing fallback and an accessible mobile alternative; feature rows only for features that exist, are enabled in that tier and are supportable.
9. `feat/marketing-resource-seo` — resource hub, taxonomy, generated sitemap and robots, canonical/OG, `BreadcrumbList`, redirect table, broken-link check.
10. `feat/marketing-student-acquisition` — student path with invite-gate-aware CTA.
11. `feat/marketing-institutional-conversion` — enablement pages; analytics contract and no-op sink; release gates in CI (axe over public routes, heading/landmark/title/link checks, budgets).

Order rationale: the testimonial/claim gate precedes every proof-bearing page; intake
precedes the pages that link to it; tokens precede components.

## P1

Keep/merge/retire decision for the ~60 company-site views outside the target route set
(`outcomes`, `executive-briefing`, `launch-estimator`, `rfp`, calculators first, because they
carry the most claim risk); light and high-contrast public themes; generate the sitemap from
the route table; replace the hard-coded publishable key in the status probe with a first-party
status endpoint; apply `database/proposed/anon_grant_reduction.sql` (DR-04) as its own PR;
company-site HawkScan result review.

## P2

Webinars with captions and transcripts; partner/ambassador/careers pages (disclosure
requirements first); email/PDF token export; calendar integration with consent-aware loading.

## Human-review items this work cannot clear

Legal (all public wording, DPA/terms/privacy/cookies pages, consent copy), Security
(what the Trust Center may say; independent assessment; HawkScan), Privacy (retention
summary, analytics decision), Accessibility (qualified assessment, manual screen-reader pass,
the statement), Finance/Tax (price book and approval), customer approval and logo
permission for anything that names a customer, and the university-name use on the site.
