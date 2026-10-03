# Semester risk treatment plan — controlled draft

- **Status:** `PARTIAL / MATERIAL RISKS REMAIN OPEN`
- **Owner:** Executive risk owner with Security, Privacy, Accessibility, Product, Engineering, Operations, Legal, Finance, and customer authorities
- **Evidence date:** 2026-10-03

## Decision framework

For each risk, choose and document: avoid (do not launch/remove scope), reduce (implement and verify controls), transfer/share (contract/insurance/provider without pretending responsibility disappears), or accept (authorized, informed, time-bound residual risk). Zero-tolerance risks cannot be accepted. Any treatment must name owner/backup, actions, funding/dependencies, due date, evidence, residual rating, escalation, customer/notice effect, exception/expiry, and verification.

The generated [risk governance register](../operating-model/RISK-GOVERNANCE.md) is the principal source. It explicitly reports unnamed governance seats, no approved exceptions, no completed game days, and material open security, continuity, legal, staffing, monitoring, accessibility, and commercial risks.

## Priority treatment map

| Risk area | Treatment | Code/config evidence | Operational evidence | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| tenant/data authorization | reduce/avoid activation until accepted | extensive RLS/identity/capability tests | named-tenant independent test absent | Security/Engineering | two-account/two-tenant UAT and remediation |
| privileged access/MFA | reduce | MFA/freshness/access controls | all-console enforcement and review absent | Security/IAM | console proof, recovery/break-glass and access review |
| monitoring/key-person/incident | reduce and avoid broad commitments | smoke/status/runbooks | no rota, backup operator or integrated exercise | Executive/Operations | alert-to-response, key-person and tabletop evidence |
| backup/recovery | reduce; avoid RTO/RPO commitments | restore tooling and logical rehearsal | provider backup restore absent | Operations/Security | timed isolated provider restore and reconciliation |
| legal/privacy/accessibility claims | avoid unsupported publication/sale; reduce through qualified review | draft controls and automated evidence | approvals/external assessment absent | Executive/Legal/Privacy/Accessibility | counsel and qualified reviews plus remediation |
| vulnerability/independent assurance | reduce | CI/scans/test plan | current target DAST and penetration test absent | Security/Engineering | scan, assessment, remediation and retest |
| vendor/AI/integration | reduce/avoid activation pending authority and terms | provider, policy, kill-switch and integration controls | contracts, configuration, target/provider acceptance incomplete | Vendor/AI/Integration | reviews, terms, target drills and customer approval |

## Treatment record and review

`[RISK ID]`, statement/affected assets and people, source, inherent likelihood/impact, tolerance, controls/evidence, treatment decision/rationale, actions, owner/backup, budget/dependencies, target/milestones, residual rating, indicators/triggers, customer/legal/contract effect, exception/approver/expiry, validation, last/next review, status, closure and reopening criteria.

Critical, zero-tolerance, overdue, expired-exception, customer-impacting, or residual-above-appetite risks escalate to authorized executive and relevant domain/customer owners. Closing a document or merging code does not close the risk; verification and approval do.

## Claim ceiling and activation blockers

Permitted: “Semester has a structured risk register, treatment rules, and evidence-linked priority actions.” Prohibited: enterprise risks controlled, residual risk accepted, governance operating, exceptions approved, game days complete, or institutional launch risk acceptable. Blocks: named governance seats; current asset/risk reconciliation; funded owners/dates; zero-tolerance disposition; legal/privacy/accessibility/security external review; target testing and recovery; game days; exception process operation; metrics; customer disclosure/approval; and signed residual-risk decision.
