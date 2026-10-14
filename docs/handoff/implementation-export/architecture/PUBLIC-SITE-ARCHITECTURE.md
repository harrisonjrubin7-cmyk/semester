# Semester public company site — full architecture specification
Status: design-source reconciliation and generated preview, 2026-10-13. Not a deployed site.

## 1. Source and scope
The inspected prototype declares ten page keys: home, product, students, institutions, pilot, trust, pricing, about, contact and legal. Site.jsx uses hash navigation, not verified server clean-URL routes. Pages.jsx supplies page bodies; index.html loads React 18.3.1, ReactDOM, Babel, design-system bundle, business/gtm-copy.js, Pages.jsx and Site.jsx.
This export supplies 44 public/entry route patterns, including the shared sign-in entry and not-found page. Every route is labelled observed prototype mapping or proposed expansion. Dynamic patterns cover reviewed content records, not unlimited automatically published pages.

## 2. Route architecture
Public shell owns reviewed marketing content. Shared identity owns signup/sign-in/session authority. /open owns only handoff presentation; server validates single-use transaction, expiry, target account, redirect allowlist and scoped preview claim. /status requires authorized operations feed. Forms require real delivery ports; this preview performs local validation only.
Legacy prototype hashes map to proposed clean URLs in PUBLIC-ROUTE-MAP.csv. Preserve aliases deliberately; do not publish a duplicate canonical page. /students and /solutions/students, /institutions and /solutions/institutions require an approved canonical/redirect decision before production. Unknown route resolves to 404, never silently to home.

## 3. Component tree
SiteShell
  SkipLink
  SiteHeader: Wordmark / labelled main navigation / sign-in entry / contact CTA
  Main: PageHero / ordered layout regions / related paths / bounded CTA
  SiteFooter: product / trust / legal / contact / preview-status disclosure
All 44 pages use the same shell. No separate public account or second app inbox.
Forms: InquiryForm → Field labels/hints/errors → ErrorSummary → consequence/privacy copy → local preview or actual server receipt.
Trust: EvidenceRegister → lifecycle words → owner/scope/date → restricted evidence-request path.
Content: controlled versioned CMS record → approved-claim references → accessible renderer.

## 4. Desktop and mobile layout
Use source-provided Ink chrome and Parchment content. Barlow reading text, Barlow Condensed headings, Cinzel only for editorial moments; bundled fonts preserved where available. Header/footer persist as structure, not necessarily sticky. Wide layout uses two columns for hero/form detail and three/four peer cards; mobile preserves logical order in one column. Targets at least 44px in the generated preview. No essential information in color or motion alone.
Wireframes are ordered region specifications, not pixel-perfect finished design. Each route has a rendered wireframe in the preview and a textual diagram in PAGE-WIREFRAMES.md.

## 5. CMS and source boundaries
Proposed CMS fields: route/key, title, lead, audience, layout, region blocks, owner, version, publication_state, reviewed_at, expires_at, approver_ref, claim_refs, canonical_route, accessible_formats and source_refs. These are proposed mappings, not new tables to apply blindly. Reconcile cms.pages and cms.approved_claims against canonical repository schemas.
Published routes require approved copy and claim-specific evidence. Dynamic products/resources/jobs must resolve only approved records; missing content produces unavailable/404 and noindex. Staff biographies, job compensation and contact endpoints require approved facts.

## 6. Forms and delivery
Required validation: normalization, bounded input sizes, typed schemas, safe rendering, server abuse protection, purpose-bound consent, suppression/retention policy and recipient/channel allowlist. Marketing consent optional and separate from responding to inquiry. Show no 'Request sent' until a durable authoritative server receipt exists. Client-side success is not email delivery or booked meeting.
States: ready, loading, empty, error, forbidden, offline, unavailable; freshness is independent. Validation failure preserves input and focuses the summary/first invalid control. Server errors preserve draft and offer safe retry; duplicate submissions use scoped idempotency. No sensitive student, clinical or financial data in lead forms.

## 7. Claims and legal controls
Existing source copy contains paid-pilot traction, 'free' availability, reply-time commitments and absolute AI-data statements. These require exact approved evidence before publication. Keep original source for audit, but generated preview does not repeat them as verified facts. Legal documents remain drafts until qualified review; security/accessibility targets are not certifications. No institutional logo/reference without permission.

## 8. SEO, discovery and navigation
Preview noindex/nofollow. Production needs approved canonical route, title/description, social metadata, sitemap for approved static/dynamic records, robots policy and accessible error page. Validate inbound links, legal anchors, unknown slugs and account redirects. Never include restricted documents or tokens in public indexing.

## 9. Acceptance and activation
Validate all route patterns, links, form error states, source/claim labels, responsive reflow, keyboard/focus, AT/zoom and accessible alternatives. Verify actual identity/handoff/status/form adapters, privacy notices, rights routing, monitoring and publication rollback. Retain candidate SHA, target and qualified approvals. Static render tests do not satisfy backend, legal or customer activation gates.

## 10. Build integration
Reuse canonical public site and shared services. Generated vanilla preview is a review deliverable, not a demand to replace existing React architecture. Transfer approved content/layout contracts into canonical components. Do not create duplicate CMS, role model or command registry. Follow handoff/mainframe/START.md, inspect current diff, select one complete increment, test and stop before unauthorized external mutations.
