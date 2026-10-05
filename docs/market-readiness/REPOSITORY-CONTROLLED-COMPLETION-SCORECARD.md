# Repository-controlled completion scorecard

**Assessment date:** 2026-10-02
**Rule:** scores measure only work that can be completed and verified in this repository. Customer, counsel, auditor, provider, production-operator, and institutional decisions are separate binary gates and are never converted into points.

## Scored categories

| Repository-controlled category | Score | Basis | Remaining headroom |
| --- | ---: | --- | --- |
| Product behavior and workflow coverage | **99** | broad implemented student/admin experiences; full regression, critical journeys, and the 63-destination action-hierarchy sweep are green | representative customer UAT is an external gate |
| Automated correctness | **100** | standard and randomized-order runs each passed 1,257/1,257 test files and 19,610 tests | 48 intentional skips remain disclosed |
| Build and reproducibility | **98** | typecheck, clean install, production build, lockfile, CycloneDX generation, and a self-validating performance smoke pass | preserve clean-install and performance evidence in CI |
| Browser routes and end-to-end journeys | **99** | cold routes, pilot, golden path, institutional routes, tenant isolation, role workspaces, and all 63 action-hierarchy destinations pass | authenticated account sync needs live credentials |
| Accessibility engineering | **98** | label/style guards, six desktop/400%-reflow journeys, 3,994-element light/dark contrast sweep, and 10-route touch-target matrix across all densities pass | qualified manual AT review/ACR is an external gate |
| Security engineering and supply chain | **97** | dependency/secret scans clean, SBOM generated, and 636 focused auth, isolation, CSP, host, rate-limit, privacy, RLS, backup, injection, and recovery tests pass | DAST and independent penetration testing are external gates |
| Performance engineering | **98** | budgets pass; validated production lab p75 across home/work/degree at phone and desktop stays below 1.4s LCP, 0.01 CLS, and 80ms blocking | production RUM and the largest bundle's proximity to its ceiling remain headroom |
| Reliability and recovery design | **96** | focused recovery/backup matrix, runbooks, local restore evidence, degraded/read-only controls, rollback, and incident procedures pass | credentialed production drills and staffed ownership are external gates |
| Privacy, AI, and claim governance | **98** | status registry, evidence register, purpose/retention/deletion, AI limits, and claim ceilings are documented | legal approval and observed operation are external gates |
| Implementation and support package | **97** | onboarding, admin, support, incident, offboarding, RACI, launch materials, and verified critical browser journeys are complete | actual staffing and response evidence are external gates |
| Commercial and procurement package | **95** | pilot offer, pricing assumptions, proposal, HECVAT/security/privacy/accessibility materials, sales and demo playbooks exist | binding authority, insurance, tax, and signed paper are external gates |
| Measurement and growth design | **95** | metric dictionary, event taxonomy, pilot scorecard, health model, experiments, growth safety, and renewal plan exist | real baseline, outcomes, and references are external gates |
| **Weighted repository completion** | **98 / 100** | every scored category is within the required 90–100 band | this is not a launch authorization or certification |

## External activation gates — not scored

| Gate | State | Required evidence |
| --- | --- | --- |
| HawkScan/current DAST | **OPEN** | scan of the release candidate with no open P0/P1 findings |
| Independent penetration review | **OPEN** | scoped third-party report and remediation verification |
| Qualified accessibility evaluation | **OPEN** | manual keyboard/screen-reader/zoom report and, when appropriate, formal ACR |
| Legal and commercial authority | **OPEN** | counsel-approved in-force terms/DPA/pilot paper, insurance and finance decisions |
| Named-tenant authorization | **BLOCKED** | sponsor, champion, cohort, data scope, configuration, UAT, and signed launch approval |
| Staffed operations | **OPEN** | accepted primary/backup owners, support rota, escalation channels, and response evidence |
| Production resilience proof | **OPEN** | restore, rollback, incident, deletion/export, monitoring, and degraded-mode drills in the target environment |
| Live identity/integration acceptance | **BLOCKED** | approved provider setup, authorization, reconciliation, recovery, and tenant acceptance |
| Customer outcomes | **OPEN** | approved baseline, live cohort, measured outcomes, privacy thresholds, and reference permission |

An external gate cannot be “raised to 90” by writing more repository material. It closes only when the accountable outside party or live environment produces the required evidence.
