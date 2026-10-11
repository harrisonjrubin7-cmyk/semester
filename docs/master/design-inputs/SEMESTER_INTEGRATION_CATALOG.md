# Integration catalog

_Generated 2026-10-05 from ui_kits/master-catalog/catalog-data.js, ui_kits/workflow-runner/runner-data.js and os-map-data.js. Design-level only: nothing here is verified until repo code, RLS/tenant isolation, accessibility, tests, monitoring, support, documentation and release evidence exist._

Integration screens and the controlled-integration and migration workflows.

| Integration screen | Built in |
| --- | --- |
| Provider directory | ui_kits/console/ |
| Connection list | ui_kits/console/ |
| Connection setup | ui_kits/console/ |
| Security review | ui_kits/console/ |
| Scope approval | ui_kits/console/ |
| Credentials configuration | ui_kits/console/ |
| Mapping studio | ui_kits/console/ |
| Mapping versions | ui_kits/console/ |
| Field transformations | ui_kits/console/ |
| Sync schedule | ui_kits/console/ |
| Sync run history | ui_kits/console/ |
| Sync errors | ui_kits/console/ |
| Dead-letter queue | ui_kits/console/ |
| Replay request | ui_kits/console/ |
| Reconciliation dashboard | ui_kits/console/ |
| Schema drift dashboard | ui_kits/console/ |
| Duplicate resolution | ui_kits/console/ |
| Source owner management | ui_kits/console/ |
| Data freshness | ui_kits/console/ |
| Integration analytics | ui_kits/console/ |
| Webhook events | ui_kits/console/ |
| LTI configuration | ui_kits/console/ |
| OneRoster import | ui_kits/console/ |
| OneRoster REST sync | ui_kits/console/ |
| Edu-API configuration | ui_kits/console/ |
| Google/Microsoft integration | ui_kits/console/ |
| AI provider integration | ui_kits/console/ |
| Integration offboarding | ui_kits/console/ |

## Controlled integration

1. Integration request
2. Business purpose defined
3. Data classification identified
4. Security/privacy review
5. Scope requested
6. Tenant approval
7. Credential configured server-side
8. Sandbox validated
9. Mapping created
10. Mapping version approved
11. Read-only sync enabled
12. Reconciliation passed
13. Monitoring enabled
14. Write direction requested
15. Higher approval required
16. Controlled write pilot
17. Rollback verified
18. Production approval
19. Periodic scope review
20. Retirement/offboarding

## Domain migration

1. Domain inventory
2. Source data inventory
3. Field mapping
4. Data classification
5. Import staging
6. Validation
7. Duplicate/conflict resolution
8. Reconciliation
9. Dual run
10. User acceptance
11. Institution approval
12. Cutover
13. Enhanced monitoring
14. Rollback window
15. Archive/export
16. Legacy retirement
17. Post-migration review

**Rule:** read-only until write is approved; reconciliation must show 0 unexplained mismatches.
