# Integration Capability Matrix

| Standard/path | Repository evidence | Status | Activation condition |
| --- | --- | --- | --- |
| OIDC/SAML SSO | runbooks and gateway code | YELLOW | Metadata, claims, MFA policy, UAT |
| SCIM | lifecycle migration/runbook | YELLOW | IdP credentials and deprovision proof |
| LTI 1.3 launch | matrix/runbook/tests | YELLOW | Platform registration and key rotation |
| Deep Linking/NRPS/AGS | contracts and partial tests | YELLOW | Scope-specific round-trip tests |
| OneRoster | models/roadmap | RED | Vendor-specific import and reconciliation |
| QTI 3 | parser/export foundation | YELLOW | corpus compatibility and accessibility |
| REST/webhooks | gateway/outbox patterns | YELLOW | signed delivery, replay, monitoring |
| CSV/SFTP | staging patterns | YELLOW | validation, quarantine, audit, owner |
| Caliper/xAPI/cmi5 | roadmap only | GRAY | Justified use case and privacy review |
| Open Badges/CLR/VC | wallet concepts | GRAY | Approved issuer and verification model |

---

Evidence baseline: `origin/main` at `8ccf55af`, assessed 2026-10-03. “Implemented” means repository evidence, not institutional approval or observed production operation.
