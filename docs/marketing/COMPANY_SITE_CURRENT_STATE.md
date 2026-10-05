# Company site — current state

Date: 2026-10-05. Baseline: `origin/main` at `790ebbf`.
Evidence boundary: **source inspection only.** Nothing here was rendered in a
browser for this audit, and nothing says what is deployed now. Items marked
**[checked]** were re-verified directly against source by the author of this
document; the rest come from a read-only survey of the tree and carry its
file and line references. Where a line number has drifted, the quoted text is
the authority. This audit changed no public copy and no production claim.

Companion audit already on main: [`docs/product/company-site-audit.md`](../product/company-site-audit.md)
(2026-10-03) holds the conversion/SEO gap matrix. This document does not
repeat it; it adds what that one did not measure.

## 1. There are two public stacks

| | `company-site/` | `app/src/site/` |
| --- | --- | --- |
| Kind | Hand-authored single-document SPA (`index.html` 3,238 lines, `site.js` 1,585, `site.css` 1,018) | Typed React prerenderer, one HTML file per route |
| Routing | Path mode switched on by `<meta name="semester-routing" content="path">`; 96 `data-page` views toggled with `hidden`, plus generated solution/trust pages. `vercel.json` rewrites every path to `/index.html` | 48 `ROUTES` in `render.tsx` plus `/tools/<id>/`; built by `npm run site:build` into `app/dist-site/` |
| Deployed | Vercel project `semester-company-site`, `www.semester.website` (apex redirects to www) | **Not deployed by default.** `origin` is empty, so no canonical, no `og:url`, no `og:image`, no sitemap |
| Forms | 21 `<form>`s; 14 post to `lead-intake` | None. Contact is a `mailto:` |
| JS | One script, `/site.js` | None except tool pages |
| Brand | Graphite `#16181C`, Brass `#D8C79A`, Cinzel / Barlow Condensed / Barlow, 12 local fonts | Same fonts and tokens, via the app |
| Headline | "Turn your semester into one clear next step." | "College is complicated. Your path shouldn't be." |

`docs/product/company-site-audit.md` already calls shipping both as authorities
"the defect". This audit agrees and proposes the resolution in
[`MARKETING_SITE_INFORMATION_ARCHITECTURE.md`](MARKETING_SITE_INFORMATION_ARCHITECTURE.md) §4.

The authenticated app is separate: hash-routed (`#/screen`), no router library,
state-driven (`state.screen`), served from a GitHub Pages subpath. It has no
true unauthenticated gate; first-run onboarding is drawn above the router.
`#/login`, `#/signin` and `#/signup` are "doors" into the account screen.

## 2. Public routes

- **company-site:** 96 page views plus generated pages; 116 `<loc>` in the
  hand-maintained `sitemap.xml` (lastmod 2026-09-29 to 2026-10-01). Views missing
  from the sitemap: `compatibility`, `consent-history`.
- **app/src/site:** `/`, `/product/`, `/students/`, `/institutions/`,
  `/pricing/`, `/tools/`, `/resources/`, `/about/`, `/careers/`, `/contact/`,
  `/security/`, `/privacy/`, `/accessibility/`, `/help/`, `/known-limitations/`,
  `/launch-readiness/`, `/proof/`, `/legal/`, `/login/`, `/signup/`, `/account/`,
  `/membership/`, `/platform/*`, `/trust/*`, `/community/*`, `/k-12/`, and others.
- **Public-by-design entries mounted instead of the app** (`app/src/main.tsx`):
  trust-room reviewer (token in URL fragment) and published-form respondent
  (`?form=<uuid>`).
- **Static status:** `app/public/status.html`, `status-feed.xml`,
  `status-incidents.json`; rendered in the reader's browser, independent of the app bundle.

Mapping of the requested routes to what exists is in
[`MARKETING_SITE_INFORMATION_ARCHITECTURE.md`](MARKETING_SITE_INFORMATION_ARCHITECTURE.md).

## 3. CTAs and handoff

- Every sign-up, log-in and demo CTA on company-site points at a personal GitHub
  Pages host, `harrisonjrubin7-cmyk.github.io/semester/#/signup` (and `#/login`,
  `/demo/`). Register item C-12 already flags this.
- Header: "Start planning free". Pricing: Free → signup; Plus → "Planned · see
  terms"; Pro → "Join the waitlist" (**a link to the contact form; no waitlist exists**);
  Access → "For institutions"; "Plan a pilot" → `#contact`.
- Home institutional CTAs: "Plan a readiness pilot" → `#design-partners`,
  "Request the procurement pack" → `#procurement`, "Review the Trust Center" → `#trust`,
  "Talk to Semester" → `#contact`.
- `app/src/site` login/signup pages are handoff pages that link to `#/account`.

## 4. Lead forms and the one public endpoint

`POST https://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/lead-intake`,
`verify_jwt = false`. This is the only public lead/contact endpoint.

- Honeypot field `website` (decoy 200, nothing stored); origin allow-list
  (`www.semester.website`, `semester.website`, `semester-company-site.vercel.app`
  plus `SITE_ORIGINS`); body cap 16 KB; 5 submissions per hour per salted
  HMAC-SHA256 IP hash (raw IP never stored); 429 with `Retry-After: 3600`.
- Route must be an active `cta_routes` key (13 seeded). Institutional routes
  require `organization`. Institutional leads upsert a `gtm_accounts` and
  `gtm_stakeholders` row; the procurement route also files a `trust_room_requests` row.
- SLA is `cta_routes.response_sla_hours` → `site_leads.respond_by`.
- Client: every lead form carries an optional unchecked "occasional updates"
  box sent as `consent_updates`; UTM and referrer go in `sessionStorage` and ride
  on the lead; failure falls back to a `mailto:` to the founder's personal address.

**Not present, on the server path:** a stored consent version or timestamp; any
suppression check; any audit event; structured attribution columns (only free-text
`page` and `fields`).

**[checked] Two forms cannot succeed.** `site.js:1282` posts `route:"security_report"`
and `site.js:1286` posts `route:"privacy_request"` (forms `sec-form`, `pr-form`).
Neither key exists in any `supabase/migrations/*.sql`. The server returns
`400 { error: 'Unknown form.' }` (`_shared/leadintake.ts:261`, `unknown_route`).
The visitor sees an error and is offered the mailto fallback. The two paths a
visitor would use to report a vulnerability or make a privacy request are the
two that are broken.

## 5. Public data access

- anon-readable, intentionally: `commercial_products`, `commercial_plans`,
  `commercial_prices`, `entitlement_definitions`, `plan_entitlements`; also `schools`,
  `form_publications`/`published_forms`, and `form_responses` insert.
- **The catalog has no approval flag.** A price is visible to anon when `active`
  and inside its window. Approval is not enforced in the database (see
  [`MARKETING_COMPLIANCE_AUDIT.md`](MARKETING_COMPLIANCE_AUDIT.md) §3).
- Not anon-readable: `claims_register`, `content_register`, `cta_routes` (staff
  capability), `site_leads` and all consent/suppression tables (service role only),
  `trust_artifacts` (the `public` tier has no public read path).
- `claims_register` and `content_register` have **no rows and no code reads them**.
  The markdown register is the working control.
- No `marketing_public_*` function exists. `supabase/grants.check.sql` asserts no
  `public` function is callable by `anon`; the repo pattern for public flows is an
  Edge Function with `verify_jwt=false` calling a service-role-only RPC.
- Standing gap DR-04 (P2): anon holds default INSERT/UPDATE/DELETE/TRUNCATE on 26
  owner-scoped tables; no row access found; remediation SQL is proposed, not applied.

## 6. Analytics and consent

None. No analytics module, no `track()`, no cookies, no consent banner, no
third-party script on either site. The first-party model is three marks
(`opened`, `course`, `studied`) in `public.activity`, signed-in only. Docs state
"no third-party analytics" and a test fails if a vendor host is added to the CSP.
`marketing_*` strings appear in the repo only in unrelated notification and journey
catalogs. Lead attribution is the only measurement, and it travels with a submitted lead.

## 7. Security headers (company-site `vercel.json`)

CSP `default-src 'self'`; `style-src 'self'` (inline styles forbidden, hence
`data-site-style` hashes turned into classes by JS); `connect-src` limited to the
Supabase project, `harrisonjrubin7-cmyk.github.io`, `raw.githubusercontent.com`;
`frame-src youtube-nocookie.com`; `frame-ancestors 'none'`; HSTS 2 years with
preload; `nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`;
`Permissions-Policy` denying camera, mic, geolocation, payment; `X-Frame-Options: DENY`;
COOP `same-origin`. Findings: `script-src` still allows `cdnjs.cloudflare.com`,
`cdn.jsdelivr.net` and a script hash that no inline script uses (over-permissive);
no CORP/COEP. A publishable Supabase key is hard-coded at `site.js:1141` for a
status probe; it is designed to be public but couples the site to one project.
HawkScan has company-site steps (`hawkscan.yml`); the 1 October brand doc says no
company-site security-green claim is supported, and that doc may predate the workflow.

## 8. SEO

company-site: `<html lang="en">`, canonical `https://www.semester.website/`, title,
description, `og:*`, `twitter:card=summary`, `theme-color`; **no `og:image`/`twitter:image`**,
no apple-touch-icon, no manifest. One JSON-LD `Organization` whose `email` is the
founder's personal Gmail. `robots.txt` is `Allow: /` plus Sitemap.
**Every unknown URL returns 200 with the home shell** (catch-all rewrite), so there
are no real 404s; canonical/title/description are set by JS only; there is no
`<noscript>`. `og:title` differs from `<title>`.
app/src/site: static `<head>` per page with description and OG; canonical,
`og:url`, `og:image` and sitemap **only when `SITE_ORIGIN` is set (it is not)**; no JSON-LD.

## 9. Accessibility mechanics

Present on company-site: skip link (`#main`, `<main tabindex="-1">` focused on route
change); landmarks (`header.nav`, `nav[aria-label=Main]`, `main`, `footer`); one visible
`h1` per view (93 `h1` across 96 views, toggled by `hidden`) with `normHeadings()`
setting `aria-level` to avoid skips; every `<img>` has non-empty alt (0 missing,
0 empty); `:focus-visible` 2px brass; `.ok` blocks are `role=status`; global
reduced-motion block; forced-colors and print rules; Menu/Search modals isolate
the background and return focus; 44px header targets.
Gaps: dark only (`color-scheme: dark`, no `prefers-color-scheme`, no light theme);
**no `<noscript>`** so every route is empty without JS; the visible-`h1` model
depends on JS; breadcrumbs are `<p>`, not `<nav>`; no form error summary
(app has `FieldMessage` for field errors but no summary component); no
central announcer. Prior axe evidence is desktop, 28 Sep 2026; the site itself
says no manual screen-reader pass has been done. No ACR/VPAT exists
(`docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md`); the accessibility statement is an
unpublished draft.
App infrastructure to reuse: `a11y/modal.ts` (`useModal`: Tab trap, Esc, focus
return), `components/FieldMessage.tsx`, `a11y/title.ts`, `a11y/axe.test.tsx`
(axe-core 4.13, zero serious/critical over 12 desktop + 3 phone screens),
`smoke:a11y`, `contrast-sweep`, `targets-sweep`, `lib/prefers.ts`.

## 10. Design tokens

CSS-first. Primitives per ground from `lib/look.ts` (`tokensFor`), fixed scales in
`app.css`; semantic and (minimal) component layers in `styles/tokens.css`; six
`--brand-*` tokens shared with company-site. **`app/src/design-tokens/` does not
exist** and `docs/DESIGN-TOKEN-ARCHITECTURE.md` says the folder tree was
deliberately not built. company-site values are hand-copied, linked only by tests
(`companysitebrand.test.ts`). 13 grounds, 11 accents (`ink` is the Indigo one),
`prefers-contrast: more` handled in `tokensFor`. See
[`SHARED_BRAND_TOKEN_STRATEGY.md`](SHARED_BRAND_TOKEN_STRATEGY.md).

## 11. Performance

`app/perf-budgets.json` (gzip): first load 490,496 B, largest 491,520 B, route
49,152 B, measured 2026-10-01 and checked by `npm run budgets`. The 1 October
brand doc records 435.3 KB of 479.0 KB first load. company-site has no budget:
a 3,238-line HTML document plus 1,585-line script is parsed before any route
renders. No route-performance or frontend error monitoring exists for either stack.

## 12. Support / status handoff

Status is static files plus client-side probes (github.io, Supabase
`/auth/v1/health` using the publishable key, `status-incidents.json`, a
`raw.githubusercontent.com` history file); the page states "Up means this browser
reached the service just now. It is not an uptime percentage." Support: `customer_help`
route (24 h SLA), `accessibility_barrier` (48 h), `site_feedback` (120 h). The reply
text says no response time is promised, and no 24/7 rota exists.

## 13. Baseline gates at audit start

`tsc -b` pass. `npm run lint` pass (oxlint within the 25-warning ceiling; styles,
labels and terms audits ok). Full `npm test`: see the Phase 0 report for the final figure.
