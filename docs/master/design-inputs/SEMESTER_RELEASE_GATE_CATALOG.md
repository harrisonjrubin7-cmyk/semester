# Release gate catalog

_Generated 2026-10-05 from ui_kits/master-catalog/catalog-data.js, ui_kits/workflow-runner/runner-data.js and os-map-data.js. Design-level only: nothing here is verified until repo code, RLS/tenant isolation, accessibility, tests, monitoring, support, documentation and release evidence exist._

Every screen, workflow, system or domain must pass all 22 points before it is called complete.

| # | Gate | Reached at design level here | Evidence needed |
| --- | --- | --- | --- |
| 1 | Product requirement | Yes | Repo artifact + review |
| 2 | Role definition | Yes | Repo artifact + review |
| 3 | Route/screen | Yes | Repo artifact + review |
| 4 | Data model | Yes | Repo artifact + review |
| 5 | Source authority | Yes | Repo artifact + review |
| 6 | Tenant scope | Yes | Repo artifact + review |
| 7 | Permission/capability | Yes | Repo artifact + review |
| 8 | Data classification | Yes | Repo artifact + review |
| 9 | Consent model | Yes | Repo artifact + review |
| 10 | Accessibility evidence | No | Repo artifact + review (not yet started) |
| 11 | Security controls | No | Repo artifact + review (not yet started) |
| 12 | Privacy/retention rules | Yes | Repo artifact + review |
| 13 | Audit event | Yes | Repo artifact + review |
| 14 | Integration plan | No | Repo artifact + review (not yet started) |
| 15 | Error/loading/empty/forbidden state | Yes | Repo artifact + review |
| 16 | Support path | Yes | Repo artifact + review |
| 17 | Monitoring/SLO | No | Repo artifact + review (not yet started) |
| 18 | Test coverage | No | Repo artifact + review (not yet started) |
| 19 | Rollback plan | No | Repo artifact + review (not yet started) |
| 20 | Documentation | Yes | Repo artifact + review |
| 21 | Release evidence | No | Repo artifact + review (not yet started) |
| 22 | Owner and review date | No | Repo artifact + review (not yet started) |

## Pilot launch gates

See docs/launch/Launch Runbook.html §1 (DPA/FERPA, HECVAT Full, insurance, VPAT/ACR, SAML SSO, SIS reconciliation, RLS tests, AI gateway red-team, restore drill, incident contacts, success measures).
