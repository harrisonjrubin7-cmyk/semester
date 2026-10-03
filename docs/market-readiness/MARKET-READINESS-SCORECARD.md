# Market-readiness scorecard

## Status definitions

| Status | Release meaning |
| --- | --- |
| **BLOCKED** | Unsafe, unowned, legally unavailable, or missing a prerequisite. It may not be sold or activated. |
| **INTERNAL** | Staff/test use with synthetic data only. No customer reliance. |
| **DESIGN PARTNER** | Narrow permissioned use with hands-on support, written limits, and a reversible setup. |
| **PILOT READY** | Safe and operational for a defined cohort under an agreement, with current evidence and named owners. |
| **GENERAL AVAILABILITY** | Repeatable, self-service or routinely delivered, supported, documented, and commercially approved. |
| **ENTERPRISE READY** | Multi-department scale, contractual service levels, integrations, migration, audit, 24/7 response, and independent assurance. |

No repository artifact alone can move an item to PILOT READY. The target tenant/environment, accountable owner, review date, and acceptance evidence must be recorded.

## Strict pilot gate

A capability reaches PILOT READY only when all ten criteria are evidenced: complete UX states; identity/authorization/tenant/data ownership; audit; purpose/retention/export/deletion; tested accessibility; privacy-conscious observability; owner/support/incident/rollback; configuration/disablement; acceptance test/checklist; and claim parity. A single missing criterion caps the capability at DESIGN PARTNER.

## Product and operating areas

| Area | Status | Repository evidence | Missing proof / release gate |
| --- | --- | --- | --- |
| Individual sign-up/sign-in | DESIGN PARTNER | Supabase account flow, local-first fallback, account lifecycle code/tests | target-environment auth/recovery/MFA abuse test, in-force terms, staffed support |
| Institution identification | DESIGN PARTNER | school data packs; relationship/readiness claims fail closed | institution-approved mapping and tenant acceptance |
| Consent/privacy notices | DESIGN PARTNER | structured disclosures, legal drafts, Trust & Data controls | counsel approval, target-cohort comprehension test, production evidence |
| Student onboarding | DESIGN PARTNER | onboarding, quick-start, first-day checklist, automated tests | representative student UAT and activation baseline |
| Manual course/schedule setup | DESIGN PARTNER | course/calendar/task planning and import paths | exact pilot workflow UAT, accessibility, recovery, support proof |
| Calendar import/subscription | DESIGN PARTNER | provider and sync logic, source/freshness labels, degraded/read-only states | live approved provider configuration, reconciliation evidence |
| Tasks/workload/Today/This Week | DESIGN PARTNER | mature UI and extensive tests | field outcome evidence and critical-path AT evaluation |
| Notifications/reminders | DESIGN PARTNER | preference and ethics controls; push configuration machinery | production delivery, opt-out, spam guardrail, support evidence |
| Help/support | INTERNAL | support routes, access controls, runbooks | staffed queue, response evidence, backup owner, customer channels |
| Export/deletion | DESIGN PARTNER | local/cloud export, erasure migrations, rights runbook | visible target-environment end-to-end acceptance and backup exception proof |
| Tenant/cohort administration | DESIGN PARTNER | school, role, capability, configuration and activation controls | named-tenant configuration/UAT and operator training |
| Institutional reporting | DESIGN PARTNER | privacy thresholds and aggregate reporting structures | approved measures, live dataset, disclosure review |
| Privileged audit trails | DESIGN PARTNER | database audit/event migrations and tests | production export, access review, retention and alert evidence |
| Failure/degraded/read-only | DESIGN PARTNER | feature flags, kill switches, read-only and degraded-mode maps | production drill and customer communication rehearsal |
| Offboarding | DESIGN PARTNER | data portability/offboarding and deletion plans | executed rehearsal in target tenant |
| SSO/SIS/LMS/LTI connections | BLOCKED | architectures, gateways, simulations and standards work | no approved live institutional connection or acceptance |
| AI learning assistance | DESIGN PARTNER | gateway controls, metering, provider governance, kill switch, evaluations | provider/data-use approval, target-scope evaluation, human oversight operations |
| High-impact AI decisions | BLOCKED | policy prohibits unsupported use | must remain blocked; Semester may not make authoritative admissions, aid, discipline, grading, legal, medical, or accessibility decisions |
| Public company/trust site | DESIGN PARTNER | company site, trust content, evidence register | external review, in-force policies, current status mechanism, claim approval |
| Paid institutional contracting | BLOCKED | templates, issue lists and deal rules | counsel-approved paper, insurance decision, executed agreement |
| Paid individual GA | BLOCKED | consumer experience and policy drafts | approved consumer terms/privacy, payments/tax/support/refund operations |

## Completion scores and activation gates

The former blended score combined repository work with approvals and operating evidence that the repository cannot create. It has been replaced by the [repository-controlled completion scorecard](REPOSITORY-CONTROLLED-COMPLETION-SCORECARD.md): every scored category is 90–100 and the weighted repository completion result is **98/100**. Independent assurance, legal authority, named-tenant approval, staffed operations, production drills, live integrations, and customer outcomes are binary gates. They remain open or blocked and cannot be improved by assigning them points.

## Non-negotiable blockers

- No use of `PILOT READY`, `GA`, `enterprise`, `compliant`, `certified`, `Vanderbilt-approved`, or `integrated` without the matching dated evidence.
- No launch with an open P0/P1, missing owner, missing data scope, missing rollback, or missing student support path.
- No marketing claim may outrun `CAPABILITY-STATUS-REGISTRY.json`.
