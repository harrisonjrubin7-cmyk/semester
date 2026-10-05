# Integration readiness

**Default first-pilot posture:** manual or approved read-only input. No official-record writes.

| Integration | Current status | Pilot rule |
| --- | --- | --- |
| Manual student setup | YELLOW | preferred path after UAT, support, privacy, and recovery acceptance |
| Personal calendar import/subscription | YELLOW | optional only after scope, consent, disconnect, source/freshness, and reconciliation tests |
| Institutional SSO/SCIM | RED | no named provider authorization or production acceptance evidenced |
| SIS | RED | no production write; any read-only exchange requires separate security/data/UAT approval |
| LMS/LTI | RED | repository architecture or sandbox tests do not establish a live institutional connection |
| AI provider | RED by default | enable only with approved provider, data-use/retention terms, evaluation, disclosure, monitoring, and kill switch |

Every integration needs a named owner, purpose, minimum data, direction, authentication method, authorization boundary, reconciliation process, source/freshness display, degraded behavior, rate limits, audit, monitoring, support, disablement, deletion, and acceptance record. See [integration readiness source](INTEGRATION_READINESS.md) only if this file is not the current path; deeper evidence is in [integration audit](../INTEGRATION-DATA-PIPELINE-AUDIT.md), [permission matrix](../INTEGRATION-PERMISSION-MATRIX.md), and [test plan](../INTEGRATION-TEST-PLAN.md).
