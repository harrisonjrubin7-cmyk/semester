> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester information security addendum — draft

- **Version/effective date:** `0.1 / [TO BE APPROVED]`
- **Customer/service/environment:** `[PARTIES AND SCOPE]`
- **Owner/approval:** Security owner; qualified security/privacy counsel and authorized signatories

## Plain-language summary

This exhibit would describe scoped technical and organizational measures for the contracted environment. It is not a SOC 2/ISO certificate, penetration-test report, security guarantee, universal encryption statement, uptime promise or evidence that controls operate in a customer's production tenant.

## Security schedule

Document approved measures and evidence for governance/risk, asset/data classification, identity/MFA/least privilege/access review, tenant isolation, secure development/change/release, credential and cryptographic-material handling, encryption configuration, network and application-interface protection, vulnerability management, dependency testing, logging/monitoring/alerting, incident response, backup/restore/rollback, continuity, vendor/subprocessor security, deletion/offboarding, AI/integration security, personnel/training and evidence retention.

For each control record owner, exact system/environment, implementation state, test/evidence/date/expiry, limitation, customer dependency and remediation. `[REQUIRED STANDARDS, CUSTOMER QUESTIONNAIRE, AUDIT/EVIDENCE ACCESS, TESTING RIGHTS, INCIDENT TERMS AND EXCEPTIONS TO BE NEGOTIATED BY COUNSEL.]`

## Product-behavior mapping

| Area | Current evidence | Contract position |
| --- | --- | --- |
| tenant/role/RLS/API controls | extensive code/config/tests | conditional on release and named-tenant acceptance |
| dependency/secret scanning | dated point-in-time evidence | no guarantee; rerun on immutable candidate |
| DAST/penetration testing | last HawkScan unavailable; no independent report | cannot claim complete |
| monitoring/incident/recovery | designs/tests/local or preview exercises | production staffing and drills absent |
| accessibility/privacy/legal assurance | separate drafts/reviews | not a security certification |

## Customer responsibilities

Customer protects identities/devices, assigns authorized roles, approves data/integrations/providers, configures its systems, reports incidents, maintains its continuity, and reviews outputs. Shared responsibility does not transfer Semester's own obligations or customer legal authority.

## Signature/activation blockers

Confirm covered user ages, student/minor-data scope, customer authority and jurisdictions before adopting security, access, notice or evidence obligations.

Immutable candidate evidence; closed P0/P1; current DAST and independent review as required; target-tenant role/isolation/access/monitoring acceptance; production incident/recovery drills; vendor/region/contract evidence; named primary/back-up; approved exceptions and no unsupported representations.
