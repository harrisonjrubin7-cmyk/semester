# The four-pillar audit

<!-- Rendered from app/src/lib/audit.ts by audit.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

Website, application and console, operations, and funnels: the 45 controls of
the audit workbook, each scored 0–4 against the tree, with what holds it and
the gap. A score of 3 or 4 cites a path that exists; a 4 cites a test or
check that runs on every change. The workbook is filled from this page, so
the two cannot disagree.

**Scores: 5 at 4, 15 at 3, 14 at 2, 10 at 1, 1 at 0.**
Funnels is the weakest pillar because there is no traffic, no lead and no
customer to measure; every control there says what the measurement will be.

## The scale

| Score | Means | Required action |
| --- | --- | --- |
| 0 | Missing, unknown or unsafe | Fix or explicitly stop the affected workflow |
| 1 | Exists informally | Document owner, policy and minimum viable process |
| 2 | Implemented inconsistently | Standardise and instrument it |
| 3 | Implemented and measured | Add automated monitoring and recurring review |
| 4 | Evidence-led and continuously improved | Share as a market proof point |

## The pillars

| Pillar | Primary question | Primary failure mode | Benchmark outcome | Score | At 0 or 1 |
| --- | --- | --- | --- | --- | --- |
| Website | Can the right visitor understand, trust and act? | Confusion and distrust | Clear positioning plus credible conversion | 28 / 44 | WEB-010, WEB-011 |
| App and Console | Can each role complete important work safely and easily? | Friction, ambiguity, inaccessible workflows | Calm, source-aware, role-specific execution | 34 / 44 | — |
| Operations | Can Semester reliably keep its promises at scale? | Hidden risk and reactive work | Observable, auditable, resilient delivery | 23 / 44 | OPE-009, OPE-010 |
| Funnels | Can interest become adoption and advocacy without leakage? | Slow routing, weak activation, broken handoffs | Measurable progression from intent to value | 18 / 48 | FUN-002, FUN-003, FUN-004, FUN-006, FUN-007, FUN-010, FUN-011 |

## Website

> Can the right visitor understand, trust and act?

| ID | Domain | Control | Score | Evidence | Gap, or what is measured |
| --- | --- | --- | ---: | --- | --- |
| WEB-001 | Positioning | Homepage names the category without jargon and explains the primary outcome before features. | 3 | [`app/src/site/site.test.tsx`](../../app/src/site/site.test.tsx) | The home page leads with the promise and “what brings you”; the test holds both. No five-second test with visitors has been run. |
| WEB-002 | Positioning | Student, institution, faculty/advisor, and partner audiences have dedicated paths. | 2 | [`app/src/site/pages.tsx`](../../app/src/site/pages.tsx) | Students and institutions have pages; faculty and advisors share the institutions page; partners have only careers and contact. The home router sends each visitor to a real page. |
| WEB-003 | Trust | Security, privacy, accessibility, AI, status, and system-boundaries content is discoverable. | 4 | [`app/src/site/site.test.tsx`](../../app/src/site/site.test.tsx) | All six are in the footer and the test holds every link to a real page; the status page is linked from readiness, help and product quality. |
| WEB-004 | Trust | Claims link to evidence; logos, testimonials, metrics, and certifications are verified. | 4 | [`app/src/lib/ops/claims.test.ts`](../../app/src/lib/ops/claims.test.ts) | Every capability prints a register word the test refuses to overstate; there is no logo, testimonial, metric or certification on the site, and the proof rules say why. |
| WEB-005 | Conversion | Each high-intent page has one clear primary CTA matched to visitor intent. | 2 | [`app/src/site/pages.tsx`](../../app/src/site/pages.tsx) | Get started is the one button on most pages; institutions and demo end in a mail link. No click-through has been measured. |
| WEB-006 | Conversion | Forms ask only for necessary information and state what happens next. | 3 | [`app/src/site/site.test.tsx`](../../app/src/site/site.test.tsx) | There is no form: the site’s policy is form-action none, and contact is a mail link routed to a seat with no promised response time. The next step is stated on the contact page. |
| WEB-007 | Conversion | Demo/resource/booking paths work on mobile and failures are monitored. | 2 | [`app/src/site/more.tsx`](../../app/src/site/more.tsx) | The demo page hands off to the built demo; no booking exists; the site is checked at phone width in the accessibility smoke. Nothing monitors a failed handoff. |
| WEB-008 | Accessibility | Critical journeys are keyboard-operable, readable at high zoom, and tested with assistive technology. | 3 | [`app/src/site/site.test.tsx`](../../app/src/site/site.test.tsx) | One main, a skip link, one h1 and a language on every page by test, and the app’s axe run; no assistive-technology session has been recorded. |
| WEB-009 | Design | Design system is consistent across typography, spacing, colors, states, content voice, and responsive behavior. | 3 | [`app/src/site/site.test.tsx`](../../app/src/site/site.test.tsx) | The site’s colours are held equal to the app’s tokens by test, and the style and label lints run on every change. Content voice is reviewed by hand. |
| WEB-010 | Performance | Performance budgets and monitoring exist for LCP, INP, CLS, scripts, and media assets. | 1 | [`docs/PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md`](../PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md) | Content pages ship no script and the tool bundle is measured by hand at about 71 kB gzipped. No web-vitals budget, no field measurement. |
| WEB-011 | Measurement | UTM governance, CTA events, form events, booking events, and qualified-pipeline attribution are implemented. | 1 | [`app/src/lib/gtm/utm.ts`](../../app/src/lib/gtm/utm.ts) | Campaign naming and standard attribution are code with tests. The site sets no cookie and fires no event by design; only first-party server counts exist, so CTA and pipeline attribution are not implemented. |

## App and Console

> Can each role complete important work safely and easily?

| ID | Domain | Control | Score | Evidence | Gap, or what is measured |
| --- | --- | --- | ---: | --- | --- |
| APP-001 | Context | Users can see and safely switch institution, term, course, role, and permissions. | 3 | [`app/src/lib/capabilities.ts`](../../app/src/lib/capabilities.ts) | School, term and role are shown and switchable; capabilities come from the database, never the selector, and the control plane refuses a cross-tenant view. No institution has more than one campus to switch between. |
| APP-002 | Completing work | Each role has a useful home screen and clear next important action. | 3 | [`app/src/lib/explain.ts`](../../app/src/lib/explain.ts) | Today leads with one next step for a student; the institution screen leads with services for staff. Role-specific homes for faculty and advisors are the role-launch register’s open items. |
| APP-003 | Completing work | Core workflows avoid internal jargon, use progressive disclosure, and have clear empty states. | 3 | [`app/src/content/terms.ts`](../../app/src/content/terms.ts) | The vocabulary lint refuses retired words on screen; About this screen is disclosed in place; empty, loading, error and success states have one spec. Not every empty state has been checked against it. |
| APP-004 | Trust | Important data shows Source, Scope, and Status; estimates are distinct from official outcomes. | 4 | [`app/src/lib/source.test.ts`](../../app/src/lib/source.test.ts) | Five source labels held to the database’s check constraints; source, scope and status as one shape; every estimate labelled and never called official. |
| APP-005 | AI governance | AI output identifies grounding, policy state, limitations, and review/escalation route. | 4 | [`app/src/ai/quality.test.ts`](../../app/src/ai/quality.test.ts) | Source strength, policy state, what it can and cannot claim, and six reasons to mark a reply, under every answer. |
| APP-006 | Recovery | High-impact actions offer preview, confirmation, undo/recovery, and meaningful error guidance. | 3 | [`app/src/lib/undo.ts`](../../app/src/lib/undo.ts) | Nothing is sent or shared without a preview; undo exists for the assistant’s applied actions and for deletions; Recovery is one screen under Me. Error copy is not yet audited screen by screen. |
| APP-007 | Sharing | Shares show recipient, scope, duration, purpose, and immediate revoke control. | 3 | [`app/src/lib/advisor-shares.test.ts`](../../app/src/lib/advisor-shares.test.ts) | Recipient, scope, expiry and revoke are held by test for advising and supporter shares. Purpose is not a field the recipient sees. |
| APP-008 | Accessibility | Keyboard, screen reader, zoom, contrast, motion, mobile, and non-drag alternatives are tested. | 3 | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | axe on twelve desktop and three phone screens; the contrast ramp on every ground; no drag-only planning. No human assistive-technology review has been recorded. |
| APP-009 | Console control | Tenant changes use permissions, review, version history, preview, and rollback. | 2 | [`app/src/lib/governance/config-tiers.ts`](../../app/src/lib/governance/config-tiers.ts) | Every setting has a tier and reviewers, the policy simulator previews a change, and the gateway applies with a receipt. Version history and rollback of a tenant setting are designed, not built. |
| APP-010 | Console control | Support access is least-privilege, time-bound, auditable, and revocable. | 4 | [`supabase/support-access.check.sql`](../../supabase/support-access.check.sql) | A support read needs a live, time-limited grant the student can see and revoke, and the grant is logged; held by a check that runs on every change. |
| APP-011 | Integration | Integrations show scope, owner, freshness, last success, failure state, and fallback guidance. | 2 | [`app/src/lib/integration/dashboard.ts`](../../app/src/lib/integration/dashboard.ts) | The staff dashboard shows all six behind an off-by-default flag; the trust dashboard shows a student’s connections with last sync. No institutional connection is live to be measured. |

## Operations

> Can Semester reliably keep its promises at scale?

| ID | Domain | Control | Score | Evidence | Gap, or what is measured |
| --- | --- | --- | ---: | --- | --- |
| OPE-001 | Reliability | Service objectives, monitoring, alert ownership, status communication, and incident runbooks exist. | 2 | [`app/src/lib/governance/error-budgets.ts`](../../app/src/lib/governance/error-budgets.ts) | SLOs and error budgets are code; the status page checks from the reader’s browser; runbooks are indexed. No synthetic monitoring has run long enough to publish an uptime figure, and alert ownership is one person. |
| OPE-002 | Incident response | Severity, impact, communications, evidence, post-incident review, and follow-through are tracked. | 2 | [`app/src/lib/governance/incident-comms.ts`](../../app/src/lib/governance/incident-comms.ts) | Severity, audiences and templates are code; the process has not been exercised, even as a tabletop, which is on the proof calendar. |
| OPE-003 | Security | MFA, access review, secrets, encryption, backups, vulnerability management, and logging have evidence. | 2 | [`SECURITY.md`](../../SECURITY.md) | Secrets scanning and RLS run on every change; a restore passes locally. MFA is planned, no access review has been held, and no independent test has run. |
| OPE-004 | Privacy | Data inventory, retention, export, deletion, legal holds, subprocessors, and access controls are enforceable. | 3 | [`app/src/lib/retention.test.ts`](../../app/src/lib/retention.test.ts) | The inventory, retention and deletion are held by bidirectional tests; export and deletion are self-serve; subprocessors are listed. Legal holds do not exist (maturity RM-02). |
| OPE-005 | AI operations | Model/provider, prompt, retrieval, evaluation, safety incidents, retention, and changes are inventoried. | 2 | [`app/src/lib/governance/ai-lifecycle.ts`](../../app/src/lib/governance/ai-lifecycle.ts) | The lifecycle gates and the kill switch are code; providers are listed with what each receives; the gateway keeps metadata 180 days. No evaluation has run and no change log exists per deployment. |
| OPE-006 | Release management | Release impact covers tenants, roles, integrations, accessibility, security, docs, support, and rollback. | 3 | [`app/src/lib/governance/consolechecks.ts`](../../app/src/lib/governance/consolechecks.ts) | Release impact and customer-promise checks are pure functions with tests; release readiness scores eight dimensions with a floor. No release has been scored for a real tenant. |
| OPE-007 | Customer promises | Contractual commitments map to operational controls, entitlements, support tiers, and monitoring. | 3 | [`app/src/lib/ops/commitments.test.ts`](../../app/src/lib/ops/commitments.test.ts) | Every customer commitment names its seat, date and record, and the promise checker reads them. No contract exists to map. |
| OPE-008 | Support | Support routing, escalation, permissions, knowledge base quality, and ticket resolution analytics are managed. | 2 | [`app/src/lib/help-routes.ts`](../../app/src/lib/help-routes.ts) | Routing to offices and to Semester support is code; tickets carry a handoff; escalation policy is written. No resolution analytics, and support is one person. |
| OPE-009 | Continuity | Business continuity covers vendor outage, staff loss, cyber incident, regional disruption, and communications. | 1 | [`docs/market-readiness/DISASTER_RECOVERY.md`](../market-readiness/DISASTER_RECOVERY.md) | Recovery is written and a restore passes locally; the app works offline. Founder-unavailable, vendor-insolvency and regional scenarios are named in the maturity register as owed. |
| OPE-010 | FinOps | Cloud, AI, storage, observability, and integration costs are allocated, monitored, and governed. | 1 | [`app/src/lib/spend.ts`](../../app/src/lib/spend.ts) | AI spend is metered per account and shown to the student. Nothing attributes cloud spend to a tenant or module, and no anomaly alert exists. |
| OPE-011 | Knowledge | Runbooks have owners, test dates, expiry review, onboarding validation, and emergency/offline access. | 2 | [`app/src/lib/ops/operatingsystem.ts`](../../app/src/lib/ops/operatingsystem.ts) | Every controlled document has an owner seat, a review date, and a test that fails when the date passes. No runbook records when it was last walked, and no hire has followed setup cold. |

## Funnels

> Can interest become adoption and advocacy without leakage?

| ID | Domain | Control | Score | Evidence | Gap, or what is measured |
| --- | --- | --- | ---: | --- | --- |
| FUN-001 | Audience | ICP, jobs-to-be-done, messaging, proof, CTA, and qualification path are explicit by segment. | 2 | [`docs/INSTITUTIONAL-GTM-PLAYBOOK.md`](../INSTITUTIONAL-GTM-PLAYBOOK.md) | The ICP is ordered by fit, messaging is code with tests, and the home page routes six audiences. Qualification is described, not run; no lead has arrived. |
| FUN-002 | Acquisition | Campaigns have message match, source attribution, landing pages, and qualified-traffic measures. | 1 | [`app/src/lib/gtm/campaign.ts`](../../app/src/lib/gtm/campaign.ts) | Campaign objects, audience rules and approvals are code behind a flag. No campaign has run and no traffic is measured. |
| FUN-003 | Conversion | Track visit→CTA, CTA→form start, form→submit, submit→booking, and booking→meeting. | 0 | — | None of these is tracked: the site fires no event by design, and there is no form or booking. The leak detector below is the shape the measurement will take. |
| FUN-004 | Lead routing | Every lead is matched, assigned, acknowledged, SLA-tracked, escalated if unclaimed, and outcome-logged. | 1 | [`docs/INSTITUTIONAL-GTM-PLAYBOOK.md`](../INSTITUTIONAL-GTM-PLAYBOOK.md) | Contact topics route to a council seat by mail subject. No CRM, no SLA clock, no escalation; the routing rules below are the design. |
| FUN-005 | Lead quality | Lead scoring uses declared intent and account fit; it avoids unnecessary behavioral surveillance. | 2 | [`app/src/lib/gtm/campaign.ts`](../../app/src/lib/gtm/campaign.ts) | Prohibited targeting fields are refused in code. There is no scoring because there are no leads; the rule that scoring uses declared intent only is stated here. |
| FUN-006 | Sales handoff | Sales has source, stated intent, account context, prior actions, and required consent information. | 1 | [`app/src/lib/gtm/stages.ts`](../../app/src/lib/gtm/stages.ts) | Deal stages and what each needs are code. No handoff has happened. |
| FUN-007 | Activation | Track signup→verified→context selected→first meaningful outcome→week-one retention. | 1 | [`ANALYTICS.md`](../../ANALYTICS.md) | First-party counts exist for a few events; none of these five transitions is measured as a funnel. |
| FUN-008 | Onboarding | New users reach a useful first outcome quickly with progressive, role-specific guidance. | 3 | [`app/scripts/golden-path.mjs`](../../app/scripts/golden-path.mjs) | The golden path drives a new student to a usable week and is run as a smoke; onboarding is progressive and can be restarted from Help. Time-to-value is not measured for real users. |
| FUN-009 | Adoption | Measure repeat value, feature adoption, invite/share signals, support friction, and role-level success. | 2 | [`app/src/lib/ops/firstyear.ts`](../../app/src/lib/ops/firstyear.ts) | First-year measures by role, with the baseline each needs, are code. Nothing is measured yet because nobody is enrolled. |
| FUN-010 | Expansion | Customer health and expansion are based on transparent value, adoption, fit, and success-plan signals. | 1 | [`docs/PILOT-TO-ANNUAL-CONVERSION.md`](../PILOT-TO-ANNUAL-CONVERSION.md) | Four real outcomes and a decision meeting are written; no customer to apply them to. |
| FUN-011 | Retention | Renewal process starts early and uses agreed value evidence, risk review, and mutual success plan. | 1 | [`app/src/lib/gtm/pilot.ts`](../../app/src/lib/gtm/pilot.ts) | A pilot refuses to end without a signed decision and a conversion date inside its window. No renewal has occurred. |
| FUN-012 | Advocacy | References, case studies, community, research, and referrals are permissioned and evidence-led. | 3 | [`app/src/lib/ops/claims.ts`](../../app/src/lib/ops/claims.ts) | The proof rules forbid a logo, testimonial or number without permission and method; the research page sets the method before the data. There is nothing to reference yet. |

## Prioritising a finding

priority = (2 × user harm + 2 × revenue impact + frequency + strategic value + confidence) ÷ effort, each 1–5.
Bands: P1 ≥ 12; P2 8–11.99; P3 < 8. Any finding involving one of the following is P0 whatever the formula says:

- Security
- Privacy
- Legal or compliance exposure
- Critical accessibility failure
- Data loss
- Misleading official or AI guidance

| Quadrant | Default action |
| --- | --- |
| P0 | Contain and correct immediately; overrides the formula |
| quick-win | Prioritise next sprint, once P0 is controlled |
| strategic-bet | Fund in phases with an owner, discovery, measurement and a staged release |
| fill-in | Bundle with adjacent work; never displaces a quick win |
| defer | Defer, simplify or decline; reassess only with new evidence |

## The conversion-leak detector

For each funnel — student self-serve sign-up, institutional demo request, enterprise technical evaluation, pilot-to-paid, onboarding, activation, renewal — enter the count at each stage; `leaks()` gives step conversion, drop-off and an investigate flag under target. The stages, in order:

1. Landing page viewed
2. CTA clicked
3. Form started
4. Form submitted
5. Meeting booked
6. Meeting completed
7. Qualified opportunity
8. Proposal / pilot
9. Closed won
10. Account created
11. Email verified
12. Context selected
13. First meaningful outcome
14. Day 7 retained
15. Day 30 retained
