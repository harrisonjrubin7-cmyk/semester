# Semester launch risk register

**Version:** 0.2
**Assessment date:** 2026-10-03 (America/Chicago)
**Owner:** Harrison Rubin, Founder/Business Operations primary; backup `UNASSIGNED`
**Approval authority:** Founder/CEO plus the accountable domain owner; customer authority for customer-controlled risks
**Review cadence:** weekly during finalization and pilots; immediately after a material incident, scope change, or contradictory evidence

This register is conservative by design. A risk closes only when the linked evidence exists, is current, and has been accepted by the authorized owner. A document, test, or policy does not close a target-environment, professional-review, customer-approval, or operating-evidence risk.

## Severity and launch rule

- **P0:** blocks every affected launch motion; no exception.
- **P1:** blocks paid or supported activation; no exception without reducing the affected motion/scope so the risk no longer applies.
- **P2:** may proceed only with a named owner, dated mitigation, disclosure, and approval.
- **P3:** maturity work after validated pilots.

## Active risks

| ID | Priority | Category | Risk and current evidence | Owner role | Minimum remediation/evidence | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| FR-001 | P0 | Legal/company | Legal entity, jurisdiction, address, ownership/IP chain, signing authority, and age posture are not confirmed; existing legal documents are drafts | Founder + qualified counsel | founder fact sheet; entity/IP records; counsel-approved posture; decision log | paid individual, paid pilot, enterprise |
| FR-002 | P0 | Customer/institution | No named sponsor, champion, cohort, data scope, contract, or launch authorization is evidenced | Founder + customer sponsor | executed scoped agreement/charter; approved cohort/data/integration map; signed launch approval | institutional activation |
| FR-003 | P0 | Security | Current HawkScan DAST and independent penetration/security review are absent | Harrison Rubin primary; independent assessor unassigned | candidate-bound scan and independent review; no open P0/P1; remediation and clean rescan | paid pilot, enterprise |
| FR-004 | P0 | Authorization | Repository controls do not prove target-tenant role boundaries, cross-tenant isolation, privileged access, or audit completeness | Engineering + security + customer IT | signed target-environment role/isolation test; access review; audit export | institutional activation |
| FR-005 | P0 | Reliability | Production restore, rollback, incident, export/deletion, access revocation, and offboarding are not exercised end to end | Engineering + privacy + support | dated target-environment drills with independent witness, timings, outcomes, and remediation | supported production launch |
| FR-006 | P0 | Operations | Harrison Rubin is primary across company-side seats, but backups, rota, coverage calendar, independent review and live escalation evidence are absent | Harrison Rubin | named/trained backups, coverage calendar, tested channels, escalation exercise | any supported launch |
| FR-007 | P1 | Accessibility | Automated evidence exists, but qualified critical-path manual assistive-technology evaluation and approved ACR/statement are absent | Accessibility owner + counsel | qualified report; remediation; approved claim/status language | broad individual, paid pilot |
| FR-008 | P1 | Commercial/finance | Pricing, payment production configuration, tax/nexus, refunds, cancellation, renewal, insurance, and revenue recognition are unapproved or unknown | Founder + finance + counsel | approved price book and policies; processor evidence; tax/accounting and insurance decisions | accepting payment, contracts |
| FR-009 | P1 | Release quality | P07 reconciled the earlier conflicting full/shuffle records; after current-main reconciliation, local commit `125524a3` passed focused claims, lint, type/build and 1,262 test files, but it is unpublished and has no exact-SHA hosted-CI/DAST or environment-dependent record | Engineering owner | publish/freeze an authorized candidate; rerun hosted CI and every environment-dependent gate; bind evidence to the SHA | any release decision |
| FR-010 | P1 | Privacy/data | Retention, legal hold, backup deletion, request staffing, vendor terms, minor posture, and production data-flow verification are incomplete | Privacy/data owner + counsel | approved data inventory/flow/register; retention/legal-hold decisions; request/offboarding drills | broad individual, paid pilot |
| FR-011 | P1 | Monitoring/support | A 2026-10-03 public production smoke passed, but institutional telemetry, alert delivery, retained history, on-call/support channel, privacy-safe logging, service communications, and response operation are not accepted | Harrison Rubin primary; backup unassigned | target-environment alert tests; staffed rota; support/incident exercises; approved commitments | supported production launch |
| FR-012 | P1 | Product/customer | Representative student/admin UAT and agreed outcome baseline do not exist | Product + customer champion | signed critical-flow UAT; accessibility/role acceptance; baseline scorecard and guardrails | institutional activation |
| FR-013 | P2 | Performance | Build/chunk warnings and limited real-device/route coverage remain despite budget evidence | Frontend/performance owner | agreed performance budgets; representative device/network results; regression gate | scaled acquisition/pilot |
| FR-014 | P2 | Documentation | All 232 requested exact filenames are reconciled after F02, but canonical sources, executive indexes and older overlapping readiness records can drift | Document-control owner | retain canonical/index designations; automate link, claim, freshness and contradiction checks; review on material change | procurement consistency |
| FR-015 | P2 | Vendor/supply chain | Code inventory does not prove executed contracts, assurance, regions, access ownership, or renewal monitoring | Vendor management + security/privacy | vendor inventory; contracts/DPAs; assurance reviews; owner/renewal/offboarding records | affected production features |
| FR-016 | P3 | Scale/maturity | No repeatable multi-customer implementation, capacity, renewal, reference, or expansion evidence exists | Executive + revenue + success | multiple validated pilots, capacity results, renewals, permissioned references | broad enterprise sale |

## Immediate escalation conditions

Stop or withhold activation if any of the following occurs: suspected secret exposure; unauthorized or cross-tenant access; material data loss; a critical accessibility barrier without an equivalent path; unavailable monitoring/support; false public or contractual claim; customer/data authority uncertainty; failed restore/offboarding; or an unreviewed material change to legal, data, AI, identity, payment, or high-impact workflows.

## Current decision

- Individual invitation-based validation: **YELLOW**, only after the applicable gates are accepted.
- Design-partner discovery, synthetic demonstrations, evidence exchange, and scoping: **GREEN / GO** within the controlled non-activation scripts, claim ceilings, approved-data boundary, and no-customer-status rule; activation is **RED / NO-GO** today.
- Paid institutional pilot: **RED / NO-GO**.
- Broad enterprise sale: **RED / NO-GO**.

See the [go/no-go decision](GO-NO-GO-DECISION.md), [executive evidence register](EVIDENCE-REGISTER.md), [requested-deliverable crosswalk](docs/finalization/REQUESTED-DELIVERABLE-CROSSWALK.md), and [external evidence queue](docs/finalization/EXTERNAL-EVIDENCE-QUEUE.md).
