# Higher-Ed RFP Response Library

Standard answers for university RFPs, security questionnaires and procurement
reviews. Every answer has a status, the files that show it, and, for
security, privacy, accessibility and AI, the HECVAT control it rests on.
Launch-readiness Phase 3.

**The source of truth is `app/src/lib/gtm/rfp.ts`.** The table below is that
data rendered with `renderLibrary()`, and `rfp.test.ts` fails if the two
differ. To change an answer, change the data, then paste the new rendering
here. Do not edit the table alone.

## Statuses

| Status | Means | Needs |
| --- | --- | --- |
| Available now | Shipped and in use, for any institution | Cited evidence, and every cited HECVAT control `READY` |
| Available with tenant configuration | Shipped; switched on per institution after its own setup | Cited evidence |
| Available through an approved integration | Works through a connected university system | A production adapter installed. **None is, so no answer may use this status today** |
| Feature-flagged pilot | Built, off by default, turned on for a pilot | Cited evidence |
| Planned / not available | Not something to sell yet | Nothing, and nothing implying otherwise |
| Not supported | A deliberate no | Nothing |
| Company to supply | Only the company knows, per response | A person writes it; never copy these rows as they stand |

## What the test refuses

- An answer claiming something exists without evidence, or citing a file that
  isn't there.
- "Available now" resting on a HECVAT control that isn't `READY` in
  [`HECVAT_READINESS.md`](market-readiness/HECVAT_READINESS.md).
- "Available through an approved integration" while
  `app/server/institution/adapters.ts` is empty.
- Certification language unless it is negated: *compliant, compliance,
  certified, certification, conformant, conformance, guarantee, real-time,
  HIPAA*. "Semester does not claim WCAG conformance" passes. "Semester is FERPA
  compliant" does not. Only a third party's report under `docs/evidence/` can
  support those words, and none exists.

## Using an answer in a response

1. Copy the answer as written. If the question asks more than the answer
   covers, write the extra part and add it here first. Don't improvise in the
   response.
2. For a security, privacy or accessibility question, attach the
   [HECVAT register](market-readiness/HECVAT_READINESS.md) row rather than
   paraphrasing it.
3. The "Company to supply" rows need a person every time.
4. When a status goes up (a pen test done, an ACR delivered, an adapter
   installed), change the library in the same commit as the evidence.

## The library

| ID | Question | Status | Answer | Evidence |
| --- | --- | --- | --- | --- |
| ES-1 | Summarize the solution and its role on campus. | Available now | Semester is a planning and experience layer over university life: a student sees deadlines, degree progress, registration planning, study tools and campus help in one place, on phone and desktop. It is not a system of record. It does not submit registrations, grades or forms to university systems, and says so on screen. | `docs/market-readiness/EXECUTIVE_READINESS.md`, `app/src/screens/Today.tsx`, `app/server/institution/adapters.ts` |
| CP-1 | Company ownership, size, years in operation, financial standing. | Company to supply | To be written by the company from its own records for each response. This repository holds no company records by design. | — |
| PS-1 | Which student workflows does the product support today? | Available now | Today (next actions and deadlines), courses and assignments, calendar, degree planning from published requirements, registration planning, study tools and campus directories. The in-app guide is generated from the shipped screens, so it cannot describe a screen that does not exist. | `app/src/screens/Today.tsx`, `app/src/screens/Degree.tsx`, `app/src/screens/Yes.tsx`, `app/src/lib/guidebook.ts` |
| PS-2 | Does the product work offline and across devices? | Available now | Yes. It is local-first: a student’s work is on their device and, when signed in, merged field by field across devices. It shows what it has when offline and says it is offline. | `app/src/lib/cloud.ts`, `app/src/lib/merge.ts`, `app/src/lib/offline.ts` |
| FR-1 | Can students register for courses through the product? | Not supported | No. Semester helps a student plan a schedule and find conflicts; registration is completed in the university’s own system. No registration adapter is installed. | `app/server/institution/adapters.ts` |
| FR-2 | Does the product support degree planning? | Available now | Yes, from the university’s published requirements, labelled as a plan rather than an official audit. | `app/src/screens/Degree.tsx` |
| FR-3 | Does the product read the official degree audit? | Planned / not available | Not yet. A degree-audit integration is designed and exercised only against mock providers; no university’s audit system is connected. | `app/src/lib/integration/catalog.ts` |
| FR-4 | Can a student reach a person at a campus office from the product? | Feature-flagged pilot | Yes, behind a feature flag. The student sees exactly what will be sent (their name, confirmed email and only what they wrote and ticked) before sending; only staff who answer for that office can read it, and every open is shown to the student. Wellbeing needs route to a crisis line and are never stored as requests. | `supabase/help-requests.check.sql`, `app/src/lib/experience-flags.ts` |
| TA-1 | Describe hosting and data storage. | Available now | A static web application; account data in Supabase Postgres with row-level security on every table, tested by policy suites in CI against the Postgres major version production runs; an institutional gateway as serverless functions for university integrations. | `supabase/check.sh`, `.github/workflows/ci.yml`, `.github/workflows/pages.yml`, `app/server/institution/runtime.ts` |
| TA-2 | Is each institution’s data isolated from every other? | Planned / not available | Isolation is enforced and tested with cross-tenant negative checks for the institutional data layer. Extending the same proof to every older table is in progress, so this is not yet claimed for the whole schema. | `supabase/tenancy.check.sql`, HECVAT TEN-1 |
| SEC-1 | Do you support institutional single sign-on? | Available with tenant configuration | SAML single sign-on through the platform’s SSO, bound to one authorized identity provider per institution, with first sign-in bound to a provisioned membership. It is enabled per institution after an acceptance test with its identity team; no institution is live yet. | `supabase/migrations/20260924150142_institution_identity_provisioning.sql`, `supabase/migrations/20260924154500_bind_institution_sso_membership.sql`, `docs/vanderbilt/identity-scim-acceptance.md`, HECVAT IAM-1 |
| SEC-2 | How is access to administrative functions controlled? | Available now | By capability, not by role name: each role carries named capabilities over a scope, grants are audited, and the database checks the capability on every protected read and write. | `supabase/migrations/20260922012000_capabilities.sql`, `supabase/capabilities.check.sql`, HECVAT IAM-2 |
| SEC-3 | Describe your secure development lifecycle. | Available now | Every change runs type, lint, unit, shuffled-order and database-policy checks in CI, with secret and dependency scanning. | `.github/workflows/ci.yml`, `.gitleaks.toml`, HECVAT SDLC-1, HECVAT SDLC-2 |
| SEC-4 | Has an independent penetration test been performed? | Planned / not available | No. An external test is planned; its report and remediation plan will be shared under NDA once it exists. | HECVAT VULN-2 |
| SEC-5 | Provide your SOC 2 Type II report. | Not supported | Semester has no SOC 2 report and does not plan one before a first pilot. The HECVAT readiness register is available instead. | HECVAT LEGAL-1 |
| SEC-6 | State your recovery time and recovery point objectives. | Planned / not available | Not yet stated. A restore rehearsal has been run locally; a timed restore of production, from which the objectives will be measured rather than chosen, has not. | HECVAT BCP-1 |
| PF-1 | Will you sign a data protection agreement with FERPA school-official terms? | Planned / not available | A DPA is drafted by counsel on request; none has been signed yet. Semester does not claim FERPA compliance on its own authority; it describes its controls and the institution’s counsel decides. | HECVAT PRIV-4 |
| PF-2 | Provide a data inventory and retention schedule. | Available now | Every table has a written retention answer, and a test fails if a table is added without one. | `RETENTION.md`, `app/src/lib/retention.test.ts`, HECVAT PRIV-1 |
| PF-3 | Can a student export and delete their data? | Available now | Yes, themselves: a portable export (CSV, Markdown, calendar, restorable JSON) and account deletion that empties every table it claims to, proven by a database check. | `app/src/lib/export.ts`, `supabase/deletion.check.sql`, HECVAT PRIV-2 |
| PF-4 | List your subprocessors. | Planned / not available | A register of every destination student data can reach exists, labelled as subprocessor, institution-directed or student-directed, and a test holds it to the app’s content-security policy and its server functions. It is a draft: counsel has not reviewed it, each provider’s own terms and hosting regions are not yet on file, and it has not been published to institutions. | `docs/SUBPROCESSORS.md`, `app/src/lib/trust/subprocessors.test.ts`, HECVAT PRIV-5 |
| PF-5 | Do you sell data, advertise to students, or score students for risk? | Available now | No to all three. The privacy disclosure is written as data and a test fails when it drifts from the code; student risk scoring was considered and refused in writing. | `app/src/lib/privacy.ts`, `app/src/lib/privacy.test.ts`, `docs/superpowers/specs/2026-09-23-semester-intelligence-expansion-design.md`, HECVAT PRIV-3 |
| AX-1 | How is accessibility tested? | Available now | Automated audits of the critical student journeys run in CI in a real browser, at desktop width and at the 320-pixel reflow width, alongside component-level focus, label, landmark and motion tests. | `app/scripts/accessibility-smoke.mjs`, `app/src/a11y`, HECVAT A11Y-1 |
| AX-2 | Provide a current VPAT / Accessibility Conformance Report. | Planned / not available | No ACR exists yet; it requires a formal evaluation, which is planned. Semester does not claim WCAG conformance until that evaluation is done. | HECVAT A11Y-2 |
| AX-3 | Has the product been tested with screen readers? | Planned / not available | Not yet by a recorded manual pass. NVDA and VoiceOver passes of the critical journeys are planned. | HECVAT A11Y-3 |
| AI-1 | How is generative AI governed? | Available with tenant configuration | AI that uses institutional data runs only through a provider the institution has approved, with sources held on the server, a metered budget per tenant, and data classified so that sensitive classes never reach a consumer model; it is off until the institution turns it on. Separately, the student study toolkit is on in the public app, with code execution and external connectors off, and can be switched off by a rebuild. | `docs/market-readiness/AI_GOVERNANCE.md`, `docs/ai-toolkit/DATA-CLASSIFICATION-AND-TOOL-GOVERNANCE.md`, `docs/ai-toolkit/AI-TOOLKIT-FEATURE-FLAGS.md`, HECVAT AI-1 |
| AI-2 | How are models evaluated for accuracy and bias? | Planned / not available | An evaluation set built from approved course sources is planned. No model evaluation results exist yet. | HECVAT AI-2 |
| INT-1 | Do you support LTI 1.3? | Available with tenant configuration | Yes: launch, deep linking and assignment scores, registered per institution. Names and Roles (the course roster) is deliberately not requested. | `supabase/functions/lti/index.ts`, `supabase/lti.check.sql`, `app/src/lib/ltikey.test.ts` |
| INT-2 | Do you support SCIM provisioning? | Planned / not available | The SCIM 2.0 service and its audited data layer are built and tested; it is not yet reachable in production. Group-to-role mapping is always approved by the institution’s administrator. | `app/server/institution/scim.ts`, `supabase/identity-provisioning.check.sql` |
| INT-3 | Which SIS, LMS and CRM systems do you integrate with? | Planned / not available | None is connected today. The integration contract, control plane and adapters are built against mock providers; each real connection is approved, credentialed and tested per institution before it is described as available. | `app/server/institution/adapters.ts`, `docs/UNIVERSITY-OS-ARCHITECTURE.md` |
| INT-4 | Can you import full course rosters? | Not supported | No, by design: Semester does not request rosters, grades or enrollment lists through identity or LMS flows. | `app/src/lib/ltikey.test.ts` |
| IM-1 | Describe your implementation approach. | Available now | A time-boxed paid pilot of 26 weeks with a written plan: an executive sponsor and an operational champion at the institution, a minimum-necessary data plan, a measured baseline and success criteria agreed before launch, and a signed decision to convert, expand, pause or stop. | `docs/PAID-PILOT-FRAMEWORK.md`, `docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md` |
| SS-1 | Describe support tiers and response times. | Planned / not available | Tiers and an incident process are written; a staffed support desk with stated response times is not yet in place and will be agreed per pilot. | HECVAT SUP-1 |
| SS-2 | What uptime do you commit to contractually? | Not supported | No uptime commitment is offered before a first pilot. Production is monitored hourly by a synthetic check. | — |
| PR-1 | Provide pricing. | Company to supply | Priced per response by the company under the deal-desk policy; the figures in the repository are proposed defaults, not a price book. | `docs/operating-model/COMMERCIAL-GOVERNANCE.md`, `app/src/lib/governance/deal-desk.ts` |
| RF-1 | Provide three institutional references. | Company to supply | There is no institutional customer yet. Do not name one; offer design-partner conversations instead, and only with that person’s written consent. | — |
| CT-1 | Provide your standard terms, order form and DPA. | Company to supply | Drafts exist in the repository of a master subscription agreement, order form, statement of work, data processing addendum and pilot agreement. None has been reviewed by qualified counsel, approved or signed, so none can be offered as Semester’s terms. Counsel prepares the terms that are offered; the procurement checklist tracks what exists. | `docs/legal-drafts/MASTER-SUBSCRIPTION-AGREEMENT-DRAFT.md`, `docs/legal-drafts/ORDER-FORM-TEMPLATE-DRAFT.md`, `docs/legal-drafts/STATEMENT-OF-WORK-TEMPLATE-DRAFT.md`, `docs/legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md`, `docs/legal-drafts/PILOT-AGREEMENT-DRAFT.md`, `docs/market-readiness/PROCUREMENT_CHECKLIST.md` |
