# Semester finalization baseline

**Assessment date:** 2026-10-03 (America/Chicago)

**Initial repository snapshot:** `fc08913447d691cf0fa8ef757dc365a3b7d8275d`, which matched the locally recorded `origin/main` when finalization began; the working branch has advanced through separately committed evidence packages

**Decision ceiling:** **GREEN / GO** for controlled non-activation discovery, synthetic demonstrations, evidence exchange and scoping; **YELLOW** for invitation-based individual validation after applicable gates; **NO-GO** for institutional activation, paid institutional pilots and broad enterprise sale
**Authority:** repository assessment only; not legal advice, customer acceptance, production attestation, accessibility conformance, certification, or authorization to publish, sign, bill, or activate

This baseline consolidates the current evidence layer for the approved company-and-product finalization program. It does not replace the deeper [GA baseline](GA_READINESS_BASELINE.md), [market-readiness baseline](docs/market-readiness/MARKET-READINESS-BASELINE.md), [evidence register](docs/EVIDENCE-REGISTER.md), [final validation record](docs/market-readiness/FINAL-VALIDATION-2026-10-02.md), or [requested-deliverable crosswalk](docs/finalization/REQUESTED-DELIVERABLE-CROSSWALK.md). Where sources conflict, the more conservative current statement controls until an owner resolves the conflict with dated evidence.

## Readiness labels

- **GREEN:** implemented, tested, documented, owned, and supportable for the stated scope.
- **YELLOW:** usable only within a narrow, disclosed scope with named ownership, safeguards, and active mitigation.
- **RED:** not safely supportable, insufficiently evidenced, or not ready to market, sell, or activate.
- **UNKNOWN:** cannot be established from the repository; requires founder, professional, provider, customer, or target-environment confirmation.

## Evidence layers

| Layer | What exists | What it does not prove | Status |
| --- | --- | --- | --- |
| Repository | Broad application, company site, Supabase assets, institutional gateway, tests, policies, runbooks, and governance code | deployment, staffing, contractual authority, customer acceptance, or control operation over time | YELLOW |
| Automated verification | Prior typecheck, lint, build, focused browser/a11y checks, dependency audit, and secret scan records | a currently green exact full matrix, independent review, or target-environment operation | YELLOW |
| Security | authorization, tenant, audit, data-rights, kill-switch, CSP, and scanning structures; point-in-time evidence register | penetration test, successful current HawkScan DAST, SOC 2/ISO certification, or no unknown vulnerabilities | RED for paid pilot |
| Accessibility | automated checks and accessibility design rules | WCAG conformance, a completed ACR/VPAT, or qualified manual assistive-technology review | RED for conformance claims |
| Legal/commercial | several working drafts and extensive issue lists/playbooks | counsel approval, enforceability, execution, entity facts, insurance, tax treatment, or authority to charge | RED |
| Operations | runbooks, local/preview rehearsals, decision controls, and evidence-expiry logic | staffed on-call/support, production restore/rollback, accepted SLOs, or exercised customer communications | RED |
| Institution | tenant/capability controls and extensive Vanderbilt readiness machinery | named-tenant approval, production acceptance, partnership, endorsement, or live institutional operation | RED |
| Market | proposed wedge, personas, pilot structure, and scorecards | validated demand, approved pricing, signed buyer, conversion, retention, or customer outcome | UNKNOWN/RED |

## 1. Company overview

Semester is represented in the repository as a unified academic operating system for students and institution-configured programs. The repository includes a public company site, a React application, Supabase data/functions, an institutional gateway, extensive product/governance documentation, and operating artifacts. The legal entity, jurisdiction, registered address, ownership, capitalization, workforce, bank, tax registrations, insurance, and signing authorities are **UNKNOWN** and must not be inferred from source code.

## 2. Product overview

The product covers local/manual academic planning, Today/This Week prioritization, courses and deadlines, study and writing tools, calendar/workload views, support discovery, account/data-rights surfaces, AI-assisted workflows, and institution-controlled capabilities. The route and feature breadth is documented in [the GA baseline](GA_READINESS_BASELINE.md) and [route crosswalk](docs/ROUTE-AND-FEATURE-CROSSWALK.md). Breadth is not evidence that every route is production-supported.

## 3. Current product maturity

**YELLOW.** The application has a large implemented and tested foundation, including local-first workflows and controlled integrations. The exact full and shuffled release test commands were red in the most recent validation because of load-sensitive timeouts, and only a limited browser matrix was checked. Several features remain beta, pilot-only, configuration-dependent, institution-dependent, or experimental.

## 4. Current company maturity

**UNKNOWN/RED.** The repository contains sophisticated operating designs, but company facts and actual staffing are not established. Policies and templates do not prove that an owner has accepted the role, that a cadence operates, that insurance is bound, or that legal and financial controls are in force.

## 5. Initial market wedge

The recommended hypothesis is a bounded **Student Success and Registration Readiness Pilot** for one cohort, one milestone, manual/read-only data where possible, no system-of-record writes, privacy-thresholded reporting, weekly review, and explicit conversion/offboarding. The fallback is a lower-integration **Student Productivity and Academic Workload Pilot**. Neither offer is approved for activation or payment today.

## 6. Current buyer/customer segments

- Proposed institutional buyer: student-success, advising, enrollment, program, or dean-level leader with a specific cohort and near-term milestone.
- Required operational champion: a customer-side program/advising owner able to manage onboarding, weekly review, support routing, and outcome interpretation.
- Required reviewers: IT, security, privacy, accessibility, procurement, counsel, finance, and data owners as applicable.
- Individual segment: students seeking a coherent daily/weekly academic plan without waiting for an institutional integration.

These are targeting hypotheses, not evidence of signed customers or proven demand.

## 7. Current user segments

Implemented or designed audiences include individual students, institution-sponsored students, advisors/program operators, instructors, administrators, support/privacy/security operators, and configuration reviewers. Age eligibility, minor/dual-enrollment treatment, role authority, and institution-specific access require legal and customer confirmation.

## 8. Current capabilities and dependencies

- **Repository-evidenced:** local/manual planning, coursework organization, source-aware study tools, export/deletion surfaces, capability/feature controls, and extensive automated tests.
- **Configuration-dependent:** cloud sync, notifications, payment, email intake, AI providers, identity, institutional gateway, moderation, and admin/operations surfaces.
- **Institution-dependent:** official deadlines, registrar/SIS/LMS/gradebook, sanctioned directories/services, production SSO, and customer data authority.
- **Not proven for sale:** unconditional production operation, contractual service levels, named-tenant acceptance, broad enterprise replacement, or high-impact institutional decisions.

## 9. Required third-party vendors/subprocessors

The code-level register in [`app/src/lib/trust/subprocessors.ts`](app/src/lib/trust/subprocessors.ts) separates Semester subprocessors, institution-directed systems, and student-directed services. Registered or contemplated parties include Supabase, GitHub Pages, Vercel, Anthropic, Stripe, Resend, institution-approved OpenAI/LMS connections, and student-directed identity/productivity/map services. This is an implementation inventory, not proof of executed DPAs, approved terms, configured production accounts, data residency, vendor assurance, or legal classification. Each relationship requires contract and configuration verification.

## 10. Current revenue model assumptions

The repository contains proposed individual and institutional packaging, Stripe integration code, and pilot materials. Approved prices, discount authority, free-trial structure, tax treatment, billing entity, cancellation/refund rules, renewal terms, revenue recognition, and production payment configuration are **UNKNOWN** or explicitly `[PRICE TO BE CONFIRMED]`. No revenue, conversion, CAC, LTV, retention, or customer outcome may be claimed without records.

## 11. Current legal/commercial posture

**RED.** Several drafts exist under `docs/legal/`, but their headers state that they are not in force and not lawyer-reviewed. The approved brief requires a broader `docs/legal-drafts/` package with the exact disclaimer, decision placeholders, jurisdiction review, public-language summaries, and behavior mapping. No draft may be published, signed, or treated as sufficient before qualified review and business approval.

## 12. Current technical architecture

The principal application is React 19.3 with Vite 8.3 and TypeScript 7.0, backed by Supabase client/server assets and an institution gateway configured for Vercel. Static delivery, edge/server functions, local-first state, cloud sync, tenant/capability controls, third-party integrations, and extensive test/governance modules are present. A repository architecture description is evidence of design and implementation, not availability, scale, or provider guarantees.

## 13. Current security posture

**YELLOW in repository; RED for a paid pilot.** Security headers, CSP, authorization/tenant tests, audit structures, secret scanning, dependency evidence, risk controls, and incident materials exist. Missing or blocked evidence includes a current HawkScan run, independent penetration/security review, complete target-environment authorization/isolation acceptance, production access review, live alert verification, and closure of the Supabase advisor findings recorded in the evidence register.

## 14. Current privacy posture

**YELLOW in implementation; RED for approved legal posture.** The product has privacy disclosures, a party/subprocessor inventory, data-rights workflows, consent concepts, deletion/export code, and offboarding rehearsals. Retention/legal-hold decisions, counsel-approved notices and DPA, actual request staffing, provider contracts, backup deletion behavior, age posture, and target-environment end-to-end exercises remain incomplete or unknown.

## 15. Current accessibility posture

**YELLOW in engineering; RED for conformance claims.** Automated axe, label, contrast, focus, motion, and route checks exist, along with responsive/accessibility plans. There is no qualified full manual audit, screen-reader/voice/magnification coverage record for all critical flows, completed ACR/VPAT, or approved conformance statement. Public wording must remain “building toward,” not “WCAG compliant” or “fully accessible.”

## 16. Current design-system posture

**YELLOW.** The repository contains a substantial design system, UI constitution, component/state guidance, responsive specifications, and brand-alignment work. Existing audits still identify targeted migrations, inconsistent legacy surfaces, performance warnings, and incomplete human review. New work must preserve the established Semester system rather than replace it with a new shell.

## 17. Current operational posture

**RED for supported production launch.** Runbooks and local/preview rehearsals exist. Named primary/backup owners, staffed support and on-call coverage, exercised production alerting, independent production restore/rollback, incident communications, accepted RTO/RPO, capacity evidence, and customer-facing status operations are not established.

## 18. Current sales and customer-success posture

**GREEN for controlled non-activation discovery/demos/scoping; RED for activation.** Controlled positioning, discovery, claims, sales and demo materials now exist. There is no evidenced CRM operation, approved price book, contract authority, staffed implementation/support team, signed design partner, repeatable activation history, renewal history, or customer reference permission.

## 19. Current support posture

**RED for a paid or broadly promoted service.** Support flows and operational documents exist, but the live channel, hours, coverage, service targets, escalation ownership, privacy/security routing, abuse handling, response testing, and customer communication authority are not fully evidenced. Do not promise 24/7 support or response/resolution times.

## 20. Current data governance posture

**YELLOW.** Data classification, privacy thresholds, evidence registers, tenant controls, data-rights code, AI rules, and governance documentation exist. The program still needs a reconciled data inventory/flow map/processing register, approved retention schedule, named stewards, production access review, legal bases/applicability decisions, vendor approvals, and operating evidence.

## 21. Current integration posture

**YELLOW/RED.** Code and tests exist for several student-directed and institution-directed connections, but support must be claimed per exact protocol, environment, configuration, and acceptance result. SSO, SCIM, LTI, OneRoster, SIS/LMS, gradebook, calendar, mail, and AI connections must not be labeled generally supported based on placeholders, partial UI, or repository code alone.

## 22. Current monitoring and incident-response posture

**RED for commercial production.** Logging, monitoring, incident, kill-switch, and operational-console designs are present, with some repository and preview evidence. Production telemetry coverage, data minimization/access/retention review, alert delivery, staffed escalation, customer communications, incident exercise, post-incident review, and recovery evidence remain incomplete.

## 23. Current launch blockers

| Priority | Blocker | Owner role | Minimum evidence | Blocks |
| --- | --- | --- | --- | --- |
| P0 | Legal entity, counsel-approved public/institutional paper, age/privacy posture | Founder + qualified counsel | confirmed company facts; dated approvals; executed applicable agreements | broad individual, paid pilot, enterprise |
| P0 | Named customer, sponsor, cohort, data/integration scope, authorization | Founder + customer sponsor | signed charter/order; approved data map; customer authorities | any institutional activation |
| P0 | Critical security and tenant evidence | Security + engineering + customer IT | current DAST/penetration review; no open P0/P1; target tenant role/isolation acceptance | paid pilot, enterprise |
| P0 | Production monitoring, incident, restore, rollback, export/deletion/offboarding | Engineering + security + privacy + support | dated target-environment exercises with outcomes and remediation | supported production launch |
| P0 | Named primary/backup operating owners | Founder | accepted RACI, coverage schedule, tested channels | any supported launch |
| P1 | Qualified accessibility evaluation | Accessibility owner + counsel | manual AT report, remediation, approved statement/ACR disposition | broad public, paid pilot |
| P1 | Approved price/payment/tax/refund/renewal model | Founder + finance + counsel | approved price book, payment configuration, policies, accounting/tax review | accepting payment |
| P1 | Green exact release gates | Engineering + security | reproducible clean install, full/shuffle tests, build, scans, evidence log | release decision |
| P1 | Representative UAT and success baseline | Product + customer champion | signed critical-flow UAT and baseline scorecard | institutional activation |

## 24. Known unknowns

- Company formation, ownership, IP chain, workforce/contractors, jurisdiction, address, tax registrations/nexus, banking, insurance, budget/runway, and delegated authorities.
- Production accounts, provider contracts/DPAs, regions/residency, secret/access ownership, backup guarantees, incident commitments, and service capacity.
- Current customers, pipeline, pricing authority, paid usage, support volume, conversion/retention, outcomes, testimonials, references, partnerships, and permissions.
- Named pilot institution, champion, cohort, accessibility/security/privacy reviewers, data sources, integrations, schedule, success baseline, and approval status.
- Current `origin/main` ancestry, CI and deployment must be refreshed again before merge or release; the market-readiness branch was remotely verified at `9b866db3d7910f96f6d5f3ce97080aff155d69c9` on 2026-10-03.

## 25. Risks by severity

- **P0:** unsupported legal/compliance/institutional claims; unsafe authorization or cross-tenant access; exposed secrets; critical data loss; missing legal/operational authority; unexercised production recovery; activation without customer approval.
- **P1:** incomplete accessibility/security review; unreliable exact release matrix; absent monitoring/support ownership; inaccurate privacy/retention/deletion claims; payment/refund/tax uncertainty.
- **P2:** performance/chunk warnings; legacy UI inconsistency; incomplete documentation reconciliation; limited device/AT coverage; operational capacity/scaling uncertainty.
- **P3:** broader integrations, formal attestations, advanced automation, ecosystem/partner expansion, and segmentation after validated pilots.

## 26. Exact evidence missing for market readiness

1. Founder-confirmed company fact sheet and authority matrix.
2. Qualified counsel review of public terms/notices and institutional paper.
3. Accountant/tax review, approved financial controls, billing/tax/refund/renewal model, and revenue-recognition position.
4. Insurance broker assessment and evidence of any bound coverage that will be claimed or contractually required.
5. Executed vendor/subprocessor contracts and assurance review for the production configuration.
6. Named primary and backup owners for engineering, security, privacy, accessibility, support, implementation, finance, and incident communications.
7. Current independent security assessment or penetration test, successful HawkScan loop, and target-environment remediation evidence.
8. Qualified accessibility review covering critical journeys and an approved public/ACR position.
9. Target-environment monitoring, alerting, incident, restore, rollback, export, deletion, access-revocation, and offboarding exercises.
10. Reproducible clean-install and fully green exact release test/security matrix at a recorded commit.
11. Named customer authorization, data/integration map, responsibility matrix, contract, implementation plan, and signed UAT.
12. Measured pilot baseline/outcome evidence, customer permission for any reference, and a repeatable conversion/offboarding record.

## Market-motion decisions

| Motion | Decision on 2026-10-03 | Permitted next action |
| --- | --- | --- |
| Individual student acquisition | **CONDITIONAL GO / YELLOW** only for clearly labeled invitation-based validation after applicable terms/privacy, support, monitoring, lifecycle, security, accessibility, and UAT gates | complete evidence and controlled validation; no broad paid promotion |
| Design-partner engagement | **GO / GREEN** for controlled non-activation discovery, synthetic demonstrations, evidence exchange and scoping; **NO-GO** for activation today | qualify a partner and prepare a bounded conditional proposal without implying customer status |
| Paid institutional pilot | **NO-GO / RED** | close all P0/P1 legal, security, accessibility, staffing, production, customer, and commercial gates |
| Broad enterprise sale | **NO-GO / RED** | validate repeated pilots and operating maturity before reconsideration |

## Immediate sequencing

1. Reconcile the 232 requested deliverables against existing canonical sources.
2. Confirm company facts and assign accountable owners before pretending policies operate.
3. Build the legal-review queue and behavior truth map before drafting publication-ready language.
4. Close product/security/accessibility/reliability P0/P1 items in vertical slices with tests and scans.
5. Obtain target-environment, professional, and customer evidence.
6. Reissue the go/no-go package from dated evidence; never infer GO from document count.
