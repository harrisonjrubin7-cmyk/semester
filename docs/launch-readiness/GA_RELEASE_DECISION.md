# GA release decision

## Decision

**NO-GO — Semester is not approved for general availability.**

Candidate baseline: `origin/main` at `92eeafd9`
Candidate version: not assigned
Assessment date: 2026-10-02 (America/Chicago)
Release owner: Founder / repository owner; formal GA council sign-off not complete

## Why

The decision follows the repository's fail-closed launch model and external evidence boundaries. The current model returns `NO-GO`. The production go-live checklist has open blocking items. Required council seats/signatures, legal authority, independent security/accessibility evidence, production restore/rollback results, operational coverage, commercial acceptance and named-institution approval are missing.

## Blocking register

| Blocker | Severity | Owner role | Target | Evidence required |
| --- | --- | --- | --- | --- |
| Close executable go-live and council gates | P0 | Release owner | date after owner appointment | all gates met; all seats held and signed |
| Vanderbilt/named-tenant approvals | P0 | Institution champion | institution-controlled | current configuration approval for every enabled capability |
| Counsel-approved terms, privacy, DPA and contracting authority | P0 | Privacy/Legal | counsel-controlled | approved, versioned, in-force documents |
| Production restore/rollback and incident exercise | P0 | Operations/SRE | before new decision | dated drills with RTO/RPO and remediation |
| Independent accessibility audit and ACR/VPAT status | P1 | Accessibility | before new decision | audit, assistive-technology matrix and closure record |
| DAST/external penetration test | P1 | Security | before new decision | scan/test report, remediation and clean verification |
| Named on-call/support coverage | P1 | Customer Success/Operations | before new decision | reachable channel, roster, paging and ticket tests |
| Production payment lifecycle and approved commercial terms | P1 | Finance/Product | before paid GA | purchase, entitlement, cancellation, refund and reconciliation evidence |
| Browser/performance acceptance across the supported matrix | P2 | Product/Engineering | before new decision | completed matrix, clean console and accepted budgets |

Targets are intentionally tied to the next decision, not invented calendar promises. The council must assign accountable people and dates before this register can become a release plan.

The former automated-suite blocker is closed locally: the default command passes 1,257/1,257 files, with 19,610 tests passed and 48 intentionally skipped. A current CI run for the immutable candidate remains part of the complete release evidence.

## Allowed claims

- Semester is in private beta.
- The repository contains automated tests for core product, tenant-policy and accessibility behavior.
- Users have product surfaces for export and deletion; operational/legal limits must accompany the statement.
- Some institutional features are built and tested in controlled environments.
- SAML SSO is not live for an institution unless a tenant-specific verification says it is.
- Semester has no SOC 2 report, external penetration test or completed ACR/VPAT today.

## Prohibited claims

Do not claim “GA,” “enterprise-ready,” “institution-ready,” “secure,” “fully accessible,” “compliant,” “FERPA certified,” “GDPR compliant,” “WCAG conformant,” “Section 508 compliant,” “SOC 2,” “Vanderbilt approved,” “production SSO,” “guaranteed uptime,” or “24/7 support” without the specific independent evidence and approval that makes the statement true.

## Re-evaluation trigger

Open a new decision only after all P0/P1 rows have dated evidence, the complete candidate test matrix passes, beta-exit criteria are met, and the full council signs the same immutable commit and production configuration.

## Required sign-off roles

Founder/release owner, Product, Engineering, Security/vCISO, Privacy/Legal, Accessibility, Customer Success, Trust & Safety, Data/Integration, Finance/Commercial, Operations/SRE and the named institution champion. A role being listed or held does not equal signature.

## Rollback plan

No GA deployment is authorized. Keep the beta release state. A future GA candidate must record the last known-good application and schema state, deployment/migration ordering, rollback owner, smoke checks, data compatibility and stop thresholds. Exercise production application rollback and a separate restore drill before GO; application rollback must not be presented as database recovery.
