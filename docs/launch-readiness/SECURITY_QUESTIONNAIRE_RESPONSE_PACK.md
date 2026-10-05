# Security questionnaire response pack

**Status:** draft response starter; every answer requires owner review and current evidence

| Topic | Defensible current answer | Evidence / limitation |
| --- | --- | --- |
| Security program | Documented repository controls and a readiness program exist | not independently certified |
| Encryption | Provider/TLS controls are documented | verify live tenant and contract before answering “yes” without qualification |
| Tenant isolation | Tenant-aware policies and cross-tenant tests exist | production scope and all legacy paths require tenant-specific evidence |
| Access control | Role/capability controls and audit structures exist | privileged MFA/configuration evidence incomplete |
| Secure development | CI tests and security workflows are defined | current candidate CI and DAST must be attached |
| Vulnerability management | Production dependency audit reports 0 vulnerabilities for the candidate lockfile | DAST and external penetration testing remain incomplete |
| Penetration test | No completed external penetration test | do not imply otherwise |
| Incident response | Runbook and templates exist | live alerting, on-call and exercise incomplete |
| Business continuity | Rollback/restore procedures exist | production restore and measured RTO/RPO incomplete |
| Privacy | Data map, retention and student-control features exist | legal policies/DPA not approved or executed |
| Subprocessors | A register exists | vendor diligence and DPAs incomplete |
| SSO | SAML support is built/tested in controlled conditions | not live or institution-approved unless tenant evidence is attached |
| LMS/SIS | Adapters/standards may exist | no production institution connection should be claimed without acceptance evidence |
| Accessibility | Target and automated checks exist | no completed independent audit or ACR/VPAT |
| SOC 2 / ISO | No completed certification/report | readiness work is not certification |
| FERPA/GDPR | Product can support contractual/configuration controls | no blanket compliance claim; institution/counsel determines role and terms |
| Data export/deletion | User-facing paths and tests exist | backup, legal-hold, tenant-wide and contract-end limits must be disclosed |
| SLA | Framework only | no contractual SLO until measurements and operations are ready |

## Attachment rule

Attach only dated artifacts for the exact candidate or live tenant. Redact secrets and personal data. A policy, test, screenshot, attestation, signed agreement and independent report are different evidence types and must not be substituted for one another.
