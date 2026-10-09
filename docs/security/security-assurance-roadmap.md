# Security assurance roadmap

Status: evidence-gated roadmap; not a certification or legal-compliance claim.

## Current evidence

The repository has RLS and negative SQL suites, audit/outbox/support controls, secret scanning evidence, dependency checks, pinned CI actions, HawkScan workflows, incident/recovery material and trust registers. Current limits: PostgreSQL 17 policy tests were not runnable locally; no independent assessment is attached here; live provider/tenant configuration is absent; runtime secrets and access reviews are outside repository proof.

## Roadmap

| Priority | Assurance outcome | Exit evidence |
| --- | --- | --- |
| P0 | No cross-tenant, guardian or official-write bypass | PG17 clean/reapply/negative suites, independent review, authoritative receipt tests |
| P1 | Secure release candidate | Green lint/test/build, Gitleaks, dependency review, HawkScan, SBOM, threat-model delta and remediation SLA |
| P1 | Production access discipline | Named owners, least privilege, MFA, access review, JIT support, break-glass exercise and immutable evidence |
| P1 | Incident and recovery readiness | Tabletop, alert route, public communication rule, restore drill, measured RPO/RTO and rollback |
| P1 | Live-provider assurance | Before any capability sends student data to a live SIS, LMS, AI, payment, or other provider: approved subprocessor inventory, DPA/security terms, credentials, webhook/JWT contract tests, production-provider approval and exit plan |
| P2 | Continuous control evidence | Evidence expiry, exact SHA/environment binding, automated collection and exception ownership |
| P3 | Independent assurance decision | Counsel/customer-driven SOC 2 or other program decision; never self-claim certification |

## Release rule

A passing repository scan is necessary but not sufficient. Capability activation also requires current deployment evidence, configuration, staffing, remediation of applicable findings, and institutional approval for institution-controlled or connected capabilities. The current HawkScan workflow runs on same-repository pull requests and pushes to `main` without a documentation path exemption, so documentation-only changes in those event classes receive fresh product and company-site DAST jobs. Pull requests from forks skip DAST under the workflow's same-repository condition. Each result remains point-in-time evidence for its exact target and SHA.
