> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester security overview — legal and procurement draft

> **DRAFT FOR QUALIFIED SECURITY, PRIVACY, LEGAL, AND CUSTOMER REVIEW. This document is not legal advice, a certification, penetration-test report, guarantee, or proof that controls operate in a live customer environment.**

| Control | Draft value |
| --- | --- |
| Version | 0.1 |
| Effective date | `[TO BE APPROVED]` |
| Owner | Security owner |
| Canonical technical summary | [`docs/market-readiness/SECURITY-OVERVIEW.md`](../market-readiness/SECURITY-OVERVIEW.md) |

## Plain-language summary

Semester's repository includes tenant/role controls, row-level policies, audit structures, fail-closed activation, secret boundaries, recovery mechanisms, data-rights tooling, dependency/secret scanning and security tests. These are implementation claims with dated scope and limits.

## Evidence layers

| Layer | Current statement | Missing before paid activation |
| --- | --- | --- |
| source/configuration | substantial controls exist | release-bound review and unresolved finding closure |
| automated tests/scans | repository matrix and point-in-time scans exist | current HawkScan DAST and no open P0/P1 |
| target environment | not established by this draft | authorization/isolation, monitoring, restore/incident and configuration acceptance |
| independent assurance | not established | scoped penetration and relevant external review |
| customer acceptance | not established | named-tenant security/privacy approval |

## Product-behavior and evidence mapping

Reconcile architecture, data flows/classification, identity/access, tenant isolation, encryption/key handling, secure development, vulnerability management, logging/monitoring, incident response, backup/recovery, vendors, AI, data rights and offboarding with exact evidence, owner, date, expiry and limitation.

## Publication blockers

Named security owner/backup; current release and target-environment evidence; HawkScan/current DAST; independent review as required; vulnerability closure; vendor/contract evidence; incident/recovery exercises; approved customer scope; legal review of commitments and exclusions.

## Prohibited claims

Confirm covered user ages, student/minor-data scope, institutional authority and jurisdictions before using this overview in a customer or public context.

No SOC 2/ISO certification, FERPA compliance, “enterprise-grade,” “encrypted everywhere,” “zero trust,” “penetration tested,” “no vulnerabilities,” uptime/response guarantee or universal isolation claim without direct current evidence.
