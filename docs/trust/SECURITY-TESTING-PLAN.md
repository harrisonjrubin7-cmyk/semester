# Semester security testing plan — controlled draft

- **Status:** `PARTIAL / PLAN NOT FULLY EXECUTED`
- **Owner:** Security owner with Engineering, Privacy and independent tester where required
- **Evidence date:** 2026-10-03
- **Release gate:** no open P0/P1; target-environment and external gates remain separate

## Test portfolio

| Layer | Required coverage | Code/config evidence | Operational evidence | Status | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| static/source/supply chain | secrets, dependencies, licenses, workflow provenance, secure patterns | CI and supply-chain tests | current release evidence exists for selected scans | `PARTIAL` | full SAST/IaC and signed provenance |
| database/authorization | RLS, tenant/account/resource isolation, privilege, definer functions, deletion/hold | database policy suites | no named-tenant target acceptance | `VERIFIED — REPOSITORY` | target negative matrix |
| API/edge/integrations | auth, IDOR, replay, webhook/signature, SSRF, rate limit, scope, error handling | unit/integration/policy tests | no complete deployed target exercise | `PARTIAL` | authenticated target suite |
| web/client | XSS, CSP, redirects, token handling, clickjacking, unsafe content/import | application/browser tests and headers | target configuration validation incomplete | `PARTIAL` | target DAST/manual testing |
| identity/session/MFA | enumeration, fixation, refresh reuse, revoke, recovery, SSO/SCIM, step-up | identity/auth tests | console and named-IdP evidence absent | `PARTIAL` | target lifecycle/adversarial test |
| AI/tooling | injection, data leakage, permission/tool escalation, kill switch, cost abuse | selected injection/model/policy tests | full approved-provider evaluation absent | `PARTIAL` | release-gating evaluation/red-team |
| resilience/incident | alert, abuse, rollback, restore, key/secret compromise | runbooks and selected drills/tests | target exercises incomplete | `PARTIAL` | integrated tabletop/restore/rollback |
| independent penetration test | plan scope in [`PENETRATION-TEST-PLAN.md`](PENETRATION-TEST-PLAN.md) | plan only | none performed | `NOT STARTED` | firm, authorization, test, report, fixes and re-test |

## Execution record

For each run record `[TEST ID]`, candidate commit/artifact/SBOM, environment/configuration, scope/accounts/fixtures, authorization/window, tools/versions, exclusions, expected negative controls, results/logs, findings/severity, owner/remediation, re-test, residual risk/approval, evidence access/retention and release decision. Use synthetic data and a separate authorized environment unless the approved rules of engagement state otherwise.

## Rules and stop conditions

No unauthorized third-party, production, destructive, denial-of-service, social-engineering or real-student-data testing. Stop on unexpected production/third-party reach, real data, critical impact or scope uncertainty; preserve evidence and route through incident/counsel processes. A scan pass is not a penetration test, and a test plan is not a result.

## Claim ceiling and activation blockers

Permitted: “Semester has extensive repository security tests and a defined target/independent test plan.” Prohibited: fully security-tested, DAST-clean, penetration-tested, zero findings, secure, complete coverage, or independently validated. Blocks: named owners, immutable candidate, authorized target environment, authenticated DAST, negative coverage map, triage/remediation/re-test evidence, identity/integration/AI/resilience exercises, independent report, closure of P0/P1 and signed release acceptance.
