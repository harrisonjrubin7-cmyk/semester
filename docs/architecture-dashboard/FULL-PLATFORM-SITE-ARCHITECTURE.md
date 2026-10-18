# Semester full-platform site architecture specification
Version: review draft 2026-10-13. Owner: proposed Product/Platform Engineering; publication/activation authority remains human and scope-specific.

## 1. Scope and status
One platform with eight design-catalog workspace families and 122 capability contracts. All public company pages have 44 proposed clean-URL route patterns, region layouts and wireframes. Ten correspond to inspected existing prototype page keys; clean URLs are not verified deployed routes. Source registry routes are design declarations, not endpoint availability evidence.
Designed, implemented, tested, deployed, institution-authorized and production-enabled are separate scoped evidence facts. A dashboard deployment is only a design preview, not product activation.

## 2. Platform boundaries
Public: reviewed marketing/CMS/claims and prospective-user entry.
Shared: identity, sessions, institution memberships, authorization, approvals, delegation, notifications, search, files, audit, controlled documents, AI gateway and outbox.
Education: student/faculty learning, planning, readiness, services, privacy and campus life.
Institution: office-owned administration, integrations, policy, support and approved authority.
Customer account: customer-specific commercial documents, invoices and support.
Company: corporate/business data only; no default student-record drilldown.
Operations: approved tenant/control metadata and scoped exact-target action authority.
Developer: application scopes, revocable keys and isolated synthetic sandbox.
These are family boundaries, not proof that eight production workspaces are enabled.

## 3. Shared routing and component architecture
PublicSiteShell → Header/Nav → PageHero → RegionGrid → bounded CTA → Footer.
ApplicationShell → verified account/tenant/term context → granted workspace navigation → page head → main/aside → source-labelled objects → Action Center.
Institution/company/operator shells reuse the design language but separate data scope. Role props and hidden links are presentation only; object policy and server-side command authority decide access.
Global search must filter retrieval/snippets/visibility; shared files need authorized signed access and retention; notifications need channel/recipient permission. No separate account, second inbox or duplicate command registry.

## 4. Public route specification
Route map preserves inspected hash-page mapping and labels proposed expansion. /product/:slug, /resources/:slug, /solutions/:audience and /careers/:slug resolve only approved content. Unknown content is 404/unavailable, not fabricated. /students vs /solutions/students and /institutions vs /solutions/institutions require canonical/alias decisions. Preview uses hash selection; production clean URLs and canonical metadata require integration.
/contact, /pricing/quote, /demo, /pilot and /partners require validated server delivery before claiming receipt. /auth/* and /join defer to canonical identity; /open uses expiring, account-bound, single-use handoff; /download needs verified distribution; /status needs actual operational source.

## 5. Component layout contracts
SiteShell: skip link, labelled header/nav, main, footer, status disclosure.
Hero: one h1, reviewed purpose, evidence/availability word, one primary CTA.
RegionGrid: ordered named regions; desktop peer columns, one-column mobile.
InquiryForm: persistent labels, required words, privacy hint, summary and inline errors, preserved input, durable receipt only after real adapter.
EvidenceRegister: scope, owner, version, review, expiry and limitations.
ControlledDocument: owner/version/status header, accessible body, revisions; drafts are not approved terms.
HandoffPanel: identity/provider/transaction validation, recovery, expiry and fallback.
SourcePreview: explicit synthetic label; authority and freshness are independent.
Seven region states: ready/loading/empty/error/forbidden/offline/unavailable. Freshness is separate. Missing values are unavailable, not zero.

## 6. Data/command continuity
Verified actor + tenant + purpose → scoped authorized read → current source/version → exact preview/approval → execution recheck → atomic canonical state/idempotency/outbox → authority receipt → projection/reconciliation → refetch. Approval binds exact payload/target/version/scope and expiry. Upstream confirmation is not undone by projection lag. Do not re-execute a confirmed action to repair a read model.
Student-private work stays separate from official records. Institution registration, grades/transcripts and financial decisions keep their owning authority until accepted domain replacement.

## 7. Governed AI
Verified identity/purpose, object policy, data classification, permitted egress/provider, source/output validation and separate human-confirmed action. Default deny unapproved education-record egress; do not publish absolute guarantees without evidence. AI suggestions remain drafts; no independent enrollment, grade release, protected disclosure or financial approval.

## 8. Student workflow code boundaries
Catalogued 40-stage student lifecycle is design evidence, not completed end-to-end operation. Reviewed registration-actions.ts creates navigation actions for missing time, cart, backups, conflicts and unchecked checklist entries. It does not enroll or inspect official holds/live seats. capabilities.ts discovers scope-matched grants for navigation; server/RLS remains authority. readiness.ts governs institution relationship/connection claims, not student eligibility.

## 9. Publication, privacy and deployment
Review claims, prices, availability, legal posture, contact channels, dynamic entries and assurance wording before external publication. Existing design prototype includes client-only form success and unverified traction claims; do not repeat them as facts. Architecture dashboard contains public synthetic metadata only, no student records, secrets, live credentials or private source dump.
Deploy as an isolated Vercel preview in harrison/harrison22; no production alias or DNS update; no existing project replacement. Target publication is subject to explicit confirmation. Protection remains provider/project-controlled and is not disabled. Hosting resources may incur normal account usage costs; no cost quote was obtained.

## 10. Acceptance and release
Test all route selections, component trees, region order, dynamic missing content, 404, mobile reflow, keyboard/focus, print/export and error states. Independently assess accessibility/security and actual adapters. Retain candidate SHA/config/tenant/environment/cohort/data mode and authority evidence. Local preview tests do not promote backend, institutional or commercial readiness.
