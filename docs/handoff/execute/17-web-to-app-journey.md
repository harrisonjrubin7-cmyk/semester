# Stream 17 — Company site → identity → onboarding → app

## Paste this

> You are the Semester frontend, company-site, brand, growth, lifecycle, identity, onboarding, accessibility, privacy, security, analytics and activation team. Read design/docs/growth/README.md, design/docs/auth/*, design/docs/onboarding/README.md and design/docs/analytics/*. Audit existing routing, tokens, auth, onboarding, company-site code, analytics, forms and lead models first. Map migration 110_onboarding_growth onto what exists — extend, never duplicate. Use ui_kits/journey as the behavioural reference, not as code to ship. Build P0 in order; stop at the end of each item for review.

## Never build

Static marketing mockups with no conversion flow · fake testimonials, logos, customers, reviews, outcomes, app-store badges, certifications, integrations, pricing or downloads · one generic signup for every audience · student signup for buyers · broad data collection before value · inaccessible forms, forced tours, dead-end errors, non-resumable onboarding · client-side-only enforcement of identity, consent, roles, tenant, entitlements or redirects · public indexing of private routes.

## P0

1. Reconcile company-site styles with the app design system.
2. Truthful homepage with two routes: Start your Semester · Design a pilot.
3. Role selection and EntryContext preservation on every CTA (lib/auth/return-path.ts).
4. Student signup, sign-in, email verification, safe /app hand-off.
5. Student onboarding around one first-value outcome (term/course/registration readiness).
6. Institution invitation and SSO entry without self-serve profile creation.
7. Demo/pilot inquiry with consent, routing, opportunity creation and response SLA (api.submit_lead).
8. /trust with verified content only.
9. Onboarding progress, resume, skip, support and recovery states.
10. Privacy-aware funnel analytics: signup completion, verified account, first meaningful action, 7-day return, demo→discovery, pilot→contract.

## P1

Institution implementation onboarding · faculty/advisor/staff onboarding · lifecycle email/reminders · content/SEO system · webinars/events · referral and ambassadors · /download + PWA · experimentation · growth and onboarding consoles (/app/ops/growth, /app/ops/onboarding).

## P2

Partner/developer onboarding · marketplace onboarding · advanced provisioning · localization · native mobile deep links and store paths (only when real apps exist) · advanced lifecycle automation and ABM.

## Done when

docs/onboarding/ONBOARDING_RELEASE_GATES.md items 1–8 pass.

## Report per item

Existing system found · canonical system reused · routes added · DB/RLS changes · screens/components · identity/consent/tenant controls · accessibility · SEO/indexing · analytics events · tests and results · evidence · readiness · risks and human review · next items.

## Addendum — web vs native, deferred signup, handoff

Also install migration 120_handoff_preview_devices and tests/handoff.test.ts. Build in P0: the student deferred-signup preview (#/students in the prototype) with api.claim_preview; /open/<route> resolver with api.create_handoff/api.consume_handoff (never tokens in links); step-versioned progress; device registry with revocation. P1: Universal Links/App Links only when native apps exist. Gates: docs/onboarding/ONBOARDING_RELEASE_CHECKLIST.md.
