# Claims register

<!-- Rendered from app/src/lib/ops/claims.ts by claims.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

Every capability the public site asserts, the status it may claim, the
evidence behind it and the pages it appears on. This is the map the master
register asks for in PRG-002: a public claim traces to the rows it rests on,
and the test refuses a claim whose word is above what those rows support, an
"available" with no test behind it, a page that does not print the wording,
and a page that prints a status label this register does not know.

The register covers the public site. Sales decks, RFP answers and anything
said in a meeting are not yet mapped; when they are, they are rows here with
a `pages` entry of their own kind, not a second register.

## The words

The site prints one of six words beside a capability. Each has a floor: the
lowest master-register status its rows may hold. A claim may understate; it
may not overstate.

| Word | Means | Floor | Claims |
| --- | --- | --- | ---: |
| **Available now** | Running for every student today, and a test exercises it on every change | `tested` | 0 |
| **Limited beta** | Running for named design partners; not yet for everyone | `implemented` | 0 |
| **Institution-configured** | Available once an institution turns it on and configures it | `tested` | 0 |
| **Built and tested, not yet deployed** | Code exists and its tests pass; no institution has it deployed | `tested` | 1 |
| **In preparation** | Work is under way; the register row says how far | `building` | 19 |
| **Planned** | Decided and scheduled; not built | `not-started` | 20 |

40 claims in all. Nothing is `limited-beta` or `institution-configured`: there is no design partner and no configured institution, so neither word is earned yet.

## The claims

| Id | Claim | Status | Owner | Capabilities | Rests on | Would move it | Evidence | Pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `source-labels` | **Every fact carries its source**<br>Institution verified, Imported, Student entered, Estimated or Needs review, on every fact the app shows. A label does not make an estimate official. | Built and tested, not yet deployed | `product` | `CAP-020`, `CAP-022`, `CAP-024`, `CAP-038` | `TRUST-001` | — | [`app/src/lib/source.test.ts`](../../app/src/lib/source.test.ts) — The five labels, what each means and the line a fact prints | `/` |
| `local-first` | **Your working copy lives on your device. An account is optional.**<br>Signed out, everything is in the browser’s own storage and nothing leaves it. With an account it is also kept in your account. Clearing the browser clears the copy. | In preparation | `engineering` | `CAP-010`, `CAP-014` | `IAM-001` | — | [`app/src/lib/inventory.test.ts`](../../app/src/lib/inventory.test.ts) — Every key the app writes to the browser is counted by the Data screen<br>[`RETENTION.md`](../../RETENTION.md) — The inventory of every store and the clock that runs on it | `/security/` |
| `export-delete` | **You can export everything, and delete your account, at any time, on any plan.**<br>Your account and what is in it. It does not delete what your institution holds about you in its own systems. | In preparation | `privacy` | `CAP-015`, `CAP-016` | `STU-011` | — | [`app/src/lib/plans.test.ts`](../../app/src/lib/plans.test.ts) — Export, deletion and saved plans are on every plan, including Free<br>[`supabase/deletion.check.sql`](../../supabase/deletion.check.sql) — Deleting the account removes its rows from every table | `/privacy/` |
| `rls` | **With an account, access to every table is enforced by the database itself, and tested as a second account in every build.**<br>Row-level security on every table, exercised by the policy suites CI runs against a fresh database. No exported policy listing for reviewers yet. | In preparation | `security` | `CAP-010`, `CAP-011`, `CAP-014`, `CAP-040` | `IAM-008` | — | [`supabase/check.sh`](../../supabase/check.sh) — Applies every migration to a throwaway database and runs every policy suite, on every change<br>[`supabase/access.check.sql`](../../supabase/access.check.sql) — One of the suites: what a second account can and cannot read | `/security/` |
| `secrets` | **No secret keys are shipped to the browser, and every change is scanned for leaked credentials.**<br>The browser bundle, the public folder and the entry page; and the history of every change. | Planned | `security` | `CAP-010`, `CAP-013`, `CAP-027` | `SEC-004` | — | [`app/src/lib/ops/boundaries.test.ts`](../../app/src/lib/ops/boundaries.test.ts) — No service-role credential, and no build variable that would carry one, in anything a browser loads<br>[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — gitleaks over every change | `/security/` |
| `no-payment-data` | **Semester never stores payment cards, bank details or university passwords.**<br>Plus checkout (D-128) sends the person to Stripe’s own page, so the card never reaches Semester. Sign-in to an institution is by its identity provider, so its password never reaches Semester. | In preparation | `privacy` | `CAP-010`, `CAP-046` | `IAM-001` | — | [`app/src/lib/plans.test.ts`](../../app/src/lib/plans.test.ts) — Nothing on the site or in the app collects a card; checkout hands off to Stripe<br>[`app/src/lib/ops/boundaries.test.ts`](../../app/src/lib/ops/boundaries.test.ts) — No database driver or connection string to any institution’s system | `/security/` |
| `incident-notice` | **Notice within 72 hours of a confirmed exposure of your data**<br>The commitment is written. The process behind it has not been exercised, even as a tabletop. | In preparation | `security` | `CAP-015`, `CAP-014` | `SEC-007` | [`tabletop`](../../docs/PROOF-CALENDAR.md) | [`SECURITY.md`](../../SECURITY.md) — The 72-hour commitment and what is read to honour it | `/security/` |
| `audit-log` | **A tamper-evident record of every privileged action**<br>Role grants, moderation, support reads and gateway actions are audited today. A unified event schema, and an export a reviewer can verify, are not. | In preparation | `security` | `CAP-010`, `CAP-014`, `CAP-041` | `SEC-006` | — | [`supabase/role-grant-audit.check.sql`](../../supabase/role-grant-audit.check.sql) — The role-grant audit cannot be updated or deleted | `/security/` |
| `restore-drill` | **A rehearsed restore from backup**<br>A restore rehearsal passes on every change in CI. Production has never been restored, and the recovery time is unmeasured. | In preparation | `engineering` | `CAP-014`, `CAP-016` | `SRE-005` | [`restore-drill`](../../docs/PROOF-CALENDAR.md) | [`RESTORE.md`](../../RESTORE.md) — The procedure | `/security/` |
| `mfa` | **Multi-factor sign-in**<br>For privileged roles first, then as a student opt-in. | Planned | `security` | `CAP-010` | `IAM-005` | — | — | `/security/` |
| `pen-test` | **An independent penetration test**<br>No firm engaged and no test environment built. The plan says how one is scoped and how findings are registered. | Planned | `security` | `CAP-010`, `CAP-013`, `CAP-015`, `CAP-041` | `SEC-005` | — | [`docs/trust/PENETRATION-TEST-PLAN.md`](../../docs/trust/PENETRATION-TEST-PLAN.md) — Scope, firm selection, findings register | `/security/` |
| `soc2` | **An independent audit or certification such as SOC 2**<br>Controls are mapped. None is operated over a period or evidenced, and no auditor is engaged. | Planned | `security` | `CAP-010`, `CAP-013`, `CAP-015`, `CAP-041` | `SEC-012` | — | [`docs/trust/SOC2-READINESS.md`](../../docs/trust/SOC2-READINESS.md) — The control mapping and its scoring | `/security/` |
| `a11y-site` | **Every page of this site has one main region, a skip link, a declared language and one heading, checked on every change.**<br>Structure and links, by test. Not a human review, and not the app. | In preparation | `accessibility` | `CAP-019` | `A11Y-003` | — | [`app/src/site/site.test.tsx`](../../app/src/site/site.test.tsx) — One h1, one main, a skip link and a language on every prerendered page | `/accessibility/` |
| `a11y-app` | **The main student screens are scanned for serious and critical accessibility violations on every change.**<br>axe-core in a simulated browser over twelve screens at desktop width and three at phone width, in CI. It cannot check colour contrast or layout, and automated checks find a minority of barriers; the rest need a person. | In preparation | `accessibility` | `CAP-001`, `CAP-017`, `CAP-020`, `CAP-021`, `CAP-025`, `CAP-031` | `A11Y-001`, `A11Y-002`, `A11Y-003`, `A11Y-004`, `A11Y-005` | — | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) — No serious or critical violation on the twelve desktop and three phone screens it lists, and the probe is shown a planted one first | `/accessibility/` |
| `a11y-human` | **A review of the main student journey by a person, with a screen reader, keyboard only, at 320px and at 200% zoom**<br>Month 1 of the proof calendar. Each failure is filed against the WCAG scorecard. | In preparation | `accessibility` | `CAP-001`, `CAP-020`, `CAP-021`, `CAP-025` | `A11Y-001` | [`a11y-baseline`](../../docs/PROOF-CALENDAR.md) | [`docs/WCAG-UI-AUDIT-SCORECARD.md`](../../docs/WCAG-UI-AUDIT-SCORECARD.md) — The per-component scorecard the review files against | `/accessibility/` |
| `vpat` | **A conformance report (VPAT/ACR) by a qualified evaluator**<br>Over the piloted screens, before institutional general availability. Code cannot produce it. | Planned | `accessibility` | `CAP-001`, `CAP-020`, `CAP-025` | `A11Y-007` | [`vpat`](../../docs/PROOF-CALENDAR.md) | [`docs/trust/HECVAT-VPAT-PLAN.md`](../../docs/trust/HECVAT-VPAT-PLAN.md) — The plan for both documents | `/accessibility/` |
| `a11y-lms` | **Accessibility of course authoring and assessments**<br>Course Studio and assessments are not released. Their keyboard, timing and accommodation behaviour is designed, not tested. | Planned | `accessibility` | `CAP-020`, `CAP-030` | `A11Y-006` | — | — | `/accessibility/` |
| `sso` | **Sign-in through your institution’s identity provider (SAML)**<br>SAML is configured for no tenant, OIDC is not offered, and nothing has been tested against a real identity provider. | In preparation | `security` | `CAP-010` | `IAM-003` | [`sso-integration`](../../docs/PROOF-CALENDAR.md) | — | `/institutions/`, `/platform/availability/`, `/platform/integrations/` |
| `scim` | **Automatic account provisioning (SCIM)**<br>Reachable, off by default, enabled for no tenant, and not yet run against an identity provider. | In preparation | `security` | `CAP-010`, `CAP-011` | `IAM-004` | — | [`supabase/scim-gateway.check.sql`](../../supabase/scim-gateway.check.sql) — The gateway’s policies | `/institutions/`, `/platform/integrations/` |
| `lti` | **Launch from your learning system (LTI 1.3)**<br>Tested against a test platform. No launch from a real institution’s learning system yet, and no 1EdTech certification. | Planned | `data` | `CAP-013`, `CAP-020` | `INT-002` | — | [`app/src/lib/lti.test.ts`](../../app/src/lib/lti.test.ts) — The launch, its validation and the membership it is scoped by<br>[`supabase/lti.check.sql`](../../supabase/lti.check.sql) — The launch tables’ policies | `/institutions/`, `/platform/integrations/` |
| `sis` | **Read-only connections to registration and student systems**<br>The framework is tested with mock adapters. No real adapter exists, nothing has been reconciled against a live source, and no institution has connected one. | Planned | `data` | `CAP-013`, `CAP-050` | `INT-001`, `INT-009` | [`sso-integration`](../../docs/PROOF-CALENDAR.md) | [`app/src/lib/integration/pipeline.test.ts`](../../app/src/lib/integration/pipeline.test.ts) — The sync pipeline, against the mock adapters | `/institutions/`, `/platform/integrations/` |
| `connector-health` | **Freshness and health of every connection, visible to your staff**<br>Behind an off-by-default flag. No alerting, and no proven fallback per connector. | Planned | `data` | `CAP-013`, `CAP-014` | `INT-014` | — | — | `/institutions/` |
| `support-access` | **Support staff see a student’s data only under a time-limited grant the student can see**<br>Grants carry a reason and an expiry and are audited. They are not yet tied to a ticket, and the workflow has had no acceptance test with an institution. | In preparation | `trust` | `CAP-010`, `CAP-015` | `IAM-010` | — | [`supabase/support-access.check.sql`](../../supabase/support-access.check.sql) — A read needs a live grant, and the grant expires | `/institutions/` |
| `hecvat` | **A completed HECVAT**<br>The readiness register answers each question with what exists. The workbook itself is not filled in or reviewed. | Planned | `security` | `CAP-010`, `CAP-015` | `SEC-011` | [`hecvat`](../../docs/PROOF-CALENDAR.md) | [`docs/market-readiness/HECVAT_READINESS.md`](../../docs/market-readiness/HECVAT_READINESS.md) — Each question, against the tree | `/institutions/` |
| `lti-advantage` | **Deep linking and grade services from your learning system (LTI Advantage)**<br>Deep linking is tested against a test platform; grade passback is gated per registration and still being built; roster membership (NRPS) is deliberately not requested. No real learning system has launched it. | Planned | `data` | `CAP-013`, `CAP-020` | `INT-004`, `INT-005` | — | [`app/src/lib/ltideeplink.test.ts`](../../app/src/lib/ltideeplink.test.ts) — Deep-link placements<br>[`supabase/ltiags.check.sql`](../../supabase/ltiags.check.sql) — Grade services gated per registration | `/platform/integrations/` |
| `oneroster` | **Roster and enrollment exchange (OneRoster 1.2)**<br>Not started. The first pilot runs without rosters by design; when built, it is an authorised feed under a data contract, never an open source. | Planned | `data` | `CAP-013`, `CAP-020` | `INT-006` | — | [`docs/FERPA-COPPA-1EDTECH-READINESS.md`](../../docs/FERPA-COPPA-1EDTECH-READINESS.md) — EDT-6: OneRoster not started, not planned for a first pilot | `/platform/integrations/` |
| `data-contracts` | **Documented APIs, webhooks and versioned data contracts**<br>The contract shape and the stewardship roles exist; webhooks and files are being built; no partner has integrated against them. | Planned | `data` | `CAP-013`, `CAP-014` | `INT-013`, `INT-012` | — | [`app/src/lib/governance/data-contracts.ts`](../../app/src/lib/governance/data-contracts.ts) — A contract names its domain, owner, steward and fields<br>[`docs/data-contract.md`](../../docs/data-contract.md) — The published contract | `/platform/integrations/` |
| `caliper` | **Learning-event interoperability (Caliper Analytics)**<br>No Caliper event is emitted. The aggregation and suppression rules any event would live under exist, and no event will ever become a risk score. | Planned | `privacy` | `CAP-013`, `CAP-009` | `UOS-008` | — | [`app/src/lib/institution-ops.ts`](../../app/src/lib/institution-ops.ts) — Aggregates only, at n ≥ 10; forbidden measures refused | `/platform/integrations/` |
| `qti` | **Portable assessments and competency frameworks (QTI, CASE)**<br>Designed, not built. Waits for assessment content and competency mapping to be real. | Planned | `product` | `CAP-020`, `CAP-030` | `INT-007`, `INT-008` | — | [`docs/LMS-LEARNING-ROADMAP.md`](../../docs/LMS-LEARNING-ROADMAP.md) — QTI and Common Cartridge listed as missing, with the phase that builds them | `/platform/integrations/` |
| `credentials` | **Verifiable, learner-held credentials (Open Badges 3.0, CLR)**<br>Designed as the credential wallet, Tier 2, Phase 3. No badge is issued, and none will be until the achievement is real, evidence-backed, issuer-controlled and portable. | Planned | `product` | `CAP-013`, `CAP-054` | `UOS-004` | — | [`docs/CREDENTIAL-WALLET.md`](../../docs/CREDENTIAL-WALLET.md) — The wallet’s design and where it sits in the plan | `/platform/integrations/` |
| `no-sale` | **Individual paid acquisition is held; Plus and Pro are planned, not on sale**<br>Checkout and cancellation are built, but new checkout is disabled while required approvals remain open. Existing subscribers keep cancellation and billing-history access. No live payment evidence authorizes broad acquisition, and the refund policy is still a proposal. | In preparation | `founder` | `CAP-010` | `LEG-003` | — | [`app/src/lib/plans.test.ts`](../../app/src/lib/plans.test.ts) — Every price matches the catalog, and no public page is a button that takes money | `/pricing/` |
| `company-addresses` | **Dedicated company addresses for support, security, privacy and accessibility**<br>They arrive with the company that owns the domain. Until then, one address read by a person, with each topic routed to a seat. | Planned | `founder` | `CAP-019` | `LEG-001` | — | — | `/contact/` |
| `student-terms` | **Terms of service and a privacy policy in force**<br>Drafts exist and are held to the subprocessor register by a test. Nothing is in force or reviewed by a lawyer, and there is no legal entity to be the party. | In preparation | `privacy` | `CAP-010`, `CAP-015` | `LEG-003` | — | [`docs/legal/TERMS-OF-SERVICE-DRAFT.md`](../../docs/legal/TERMS-OF-SERVICE-DRAFT.md) — The draft, its not-in-force banner intact<br>[`app/src/lib/trust/legal-drafts.test.ts`](../../app/src/lib/trust/legal-drafts.test.ts) — Holds the banner, and every subprocessor named in the policy | `/legal/` |
| `dpa` | **A data processing agreement your counsel can sign**<br>A checklist for counsel exists. No agreement language does. | Planned | `privacy` | `CAP-010`, `CAP-015` | `LEG-002` | [`dpa-trust`](../../docs/PROOF-CALENDAR.md) | [`docs/trust/DPA-CHECKLIST.md`](../../docs/trust/DPA-CHECKLIST.md) — What the agreement must settle | `/legal/` |
| `personal-planning` | **Plan your term, your path and your week from what you add**<br>Today, My Path, the registration plan with backups, the calendar and the study tools, from what the student enters or imports. No account is needed, and nothing here is the registrar’s record. | In preparation | `product` | `CAP-001`, `CAP-003`, `CAP-025`, `CAP-044` | `STU-001`, `STU-003`, `STU-005`, `STU-007`, `STU-010` | — | [`app/src/lib/registration.test.ts`](../../app/src/lib/registration.test.ts) — A plan with backups, checked for time conflicts<br>[`app/src/lib/source.test.ts`](../../app/src/lib/source.test.ts) — Every fact carries its source | `/platform/availability/` |
| `course-studio` | **An instructor publishes the course’s rules and guidance beside the course**<br>Course Studio: what an instructor publishes appears beside the course for its students, including the course’s AI policy. Switched on per institution; no institution has it on. | In preparation | `product` | `CAP-020`, `CAP-027` | `LMS-002` | — | [`supabase/coursestudio.check.sql`](../../supabase/coursestudio.check.sql) — Who may publish, who may read, and that a revoked grant is refused at the write | `/platform/availability/` |
| `grade-passback` | **Grades written back to the institution’s learning system**<br>A score written to the learning system needs that system’s approval and a write scope Semester does not hold. The read side of LTI is built; the write side is under way. | Planned | `data` | `CAP-013`, `CAP-020` | `INT-005` | — | [`docs/LTI-1.3-LAUNCH-RUNBOOK.md`](../../docs/LTI-1.3-LAUNCH-RUNBOOK.md) — The launch and grade-service design, and what is not yet built | `/platform/availability/` |
| `lms-migration` | **Moving courses from an existing learning system**<br>Project work with the institution — mapping, a rehearsal run, the real run, verification — never a self-serve import. No migration has been run. | Planned | `success` | `CAP-013`, `CAP-020` | `MIG-002`, `MIG-005` | — | [`docs/market-readiness/MIGRATION_PLAYBOOK.md`](../../docs/market-readiness/MIGRATION_PLAYBOOK.md) — The playbook a migration would follow | `/platform/availability/` |
| `ai-course-policy` | **What the assistant may do, set by the student, the course and the institution**<br>A student always controls what the assistant may see. A course policy published in Course Studio is shown before the assistant answers; the institution and department layers of the policy engine are under way. | In preparation | `product` | `CAP-017`, `CAP-027` | `AI-006`, `AI-013` | — | [`app/src/screens/settings/Assistant.tsx`](../../app/src/screens/settings/Assistant.tsx) — The student’s controls over what the assistant sees and does | `/platform/availability/` |
| `status-page` | **A status page that checks Semester from your own browser**<br>Up means this browser reached it just now. There is no uptime history. | In preparation | `engineering` | `CAP-014` | `SRE-002` | — | [`app/src/lib/statuspage.test.ts`](../../app/src/lib/statuspage.test.ts) — The page probes the same project the app is built against | `/launch-readiness/` |

Every claim also appears on `/launch-readiness/`, grouped by the audience it
answers: **Students** (Can I use Semester today?); **Advisors and departments** (What does a launch for our students need?); **Institutions** (What is ready now, and what is built but not yet deployed?); **IT, security, privacy and accessibility reviewers** (What evidence exists, and what is still planned?).

## The policies

What `/legal/` lists. No policy is in force; the day one is, it carries a
version, an effective date, its previous versions and a plain-language
summary of what changed, and this table says so.

| Policy | Status | Where | Owner | Rests on | Note |
| --- | --- | --- | --- | --- | --- |
| Terms of Service | `draft` | [`docs/legal/TERMS-OF-SERVICE-DRAFT.md`](../../docs/legal/TERMS-OF-SERVICE-DRAFT.md) | `privacy` | `LEG-003` | — |
| Privacy Policy | `draft` | [`docs/legal/PRIVACY-POLICY-DRAFT.md`](../../docs/legal/PRIVACY-POLICY-DRAFT.md) | `privacy` | `LEG-003` | — |
| Acceptable Use Policy | `draft` | [`docs/legal/ACCEPTABLE-USE-POLICY-DRAFT.md`](../../docs/legal/ACCEPTABLE-USE-POLICY-DRAFT.md) | `privacy` | `LEG-003` | Its own document, expanding section 5 of the terms draft. |
| Community Guidelines | `draft` | [`docs/legal/COMMUNITY-GUIDELINES-DRAFT.md`](../../docs/legal/COMMUNITY-GUIDELINES-DRAFT.md) | `trust` | `LEG-003` | The student-facing side of the moderation SOP; published only when a school turns Community on. |
| Copyright and takedown policy | `draft` | [`docs/legal/COPYRIGHT-AND-TAKEDOWN-POLICY-DRAFT.md`](../../docs/legal/COPYRIGHT-AND-TAKEDOWN-POLICY-DRAFT.md) | `founder` | `LEG-003` | No designated agent is registered, so no DMCA safe harbour may be claimed yet. |
| Data retention and deletion policy | `draft` | [`docs/legal/DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md`](../../docs/legal/DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md) | `privacy` | `LEG-003` | The public summary of RETENTION.md, which prevails. |
| Support policy | `draft` | [`docs/legal/SUPPORT-POLICY-DRAFT.md`](../../docs/legal/SUPPORT-POLICY-DRAFT.md) | `success` | `LEG-003` | No response time is promised until support is staffed. |
| Incident response summary | `draft` | [`docs/legal/INCIDENT-RESPONSE-SUMMARY-DRAFT.md`](../../docs/legal/INCIDENT-RESPONSE-SUMMARY-DRAFT.md) | `security` | `LEG-003` | The procedure is written and has not been exercised. |
| Advertising and sponsorship policy | `draft` | [`docs/legal/ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT.md`](../../docs/legal/ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT.md) | `founder` | `LEG-003` | No advertising; the sponsorship rules apply only if a school turns the module on. |
| AI Use Policy | `draft` | [`docs/legal/AI-USE-POLICY-DRAFT.md`](../../docs/legal/AI-USE-POLICY-DRAFT.md) | `product` | `AI-001` | The plain-language companion to the AI model-training and data-use policy, which prevails. |
| Cookie notice | `draft` | [`docs/legal/COOKIE-AND-STORAGE-NOTICE-DRAFT.md`](../../docs/legal/COOKIE-AND-STORAGE-NOTICE-DRAFT.md) | `privacy` | `LEG-003` | No cookie is set anywhere; the notice says what browser storage holds instead, and the company site now says the same. |
| Data Processing Agreement | `outline` | [`docs/trust/DPA-CHECKLIST.md`](../../docs/trust/DPA-CHECKLIST.md) | `privacy` | `LEG-002` | — |
| Student data addendum | `not-started` | — | `privacy` | `LEG-002`, `SEC-009` | — |
| Service Level Agreement | `outline` | [`docs/trust/SLA.md`](../../docs/trust/SLA.md) | `engineering` | `SRE-001` | — |
| Refund and cancellation policy | `draft` | [`docs/legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md`](../../docs/legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md) | `founder` | `LEG-003` | Owed before a live payment: checkout exists since D-128, and the terms on the pricing page are still proposed; the policy is drafted, not in force. |
| Accessibility statement | `draft` | [`docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md`](../../docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md) | `accessibility` | `A11Y-007` | Claims no conformance: no manual assistive-technology review has been done. |
| Subprocessor list | `draft` | [`docs/SUBPROCESSORS.md`](../../docs/SUBPROCESSORS.md) | `privacy` | `SEC-010` | Held to the code by a test; public once counsel has read it. |

- `not-started`: Nothing is written.
- `outline`: Notes for counsel on what the document must settle; not the document.
- `draft`: The document, written; not reviewed by a lawyer and not in force.
- `in-force`: Reviewed, versioned, effective from a date, with the previous versions kept.

## The proof policy

How Semester will show proof, written before there is any to show, and
printed at `/proof/`:

- No invented metrics. A number appears only with the measurement behind it.
- No logo without the institution’s written permission.
- No anonymous “a leading university” without the context that makes it checkable.
- No causal claim without the method, the cohort and the limitation.
- Every outcome report states its scope, cohort, method, limitation and date.
- No testimonial until there is a pilot report for it to describe.

## How a claim changes

1. Edit `app/src/lib/ops/claims.ts`: the wording, the word, the rows, the
   evidence, the pages. The founder seat owns the register; the owning seat
   of the claim approves its wording.
2. Run the suite. `claims.test.ts` refuses a word the rows do not support,
   a page that does not print it, and a label the register does not know.
3. Run `npm run registers` from app/ so this page matches, and commit both
   in the same change.

When evidence lapses — a proof-calendar artifact expires, a row falls below
a floor — the test fails on the next change, and the claim is reworded or
the row is moved back up before anything else merges. That is the
"claim-to-evidence control": not a review, a red build.

The seats are those of [`docs/LAUNCH-READINESS-COUNCIL.md`](../../docs/LAUNCH-READINESS-COUNCIL.md): `founder` (Founder / CEO), `product` (Product lead), `engineering` (Engineering lead), `security` (Security / vCISO), `privacy` (Privacy / legal), `accessibility` (Accessibility lead), `success` (Customer success), `trust` (Trust & Safety), `data` (Data / integration owner), `finance` (Finance / commercial), `operations` (Operations / SRE), `champion` (Pilot institution champion). Every seat is vacant; the owner column says which will hold it.
