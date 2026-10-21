# Automated deployment and rollback map

## Preserve existing automation
Existing workflow inventory includes ci.yml, pages.yml, functions.yml, production-smoke.yml and infrastructure workflows. Vercel projects also exist. Confirm which delivery surface is authoritative; do not create a competing automatic deploy or database executor. Full deploy workflow internals/dashboard configuration require further inspection.

## Automation stages
1. Pull request: pinned checkout/setup actions; lockfile install; type/lint/unit/timezone/design gates; registry validity; local browser journeys; local policy/migration rehearsal. Capture exact outputs.
2. Release candidate: immutable commit/build/migration manifest; release:check (blocking); approver and target mapping; restore/rollback evidence. Informational release:report is not release approval.
3. Preview: production-equivalent base/CSP; separate local account build for destructive test fixtures; verified proposed domains.
4. Approval: protected environment and authorized reviewer; no client-controlled enablement.
5. Database expand: sole confirmed migration executor; compatible with prior app/function versions.
6. Functions/API: compatible versions and contract checks.
7. Application: approved existing delivery mechanism; verify artifact commit/config/route and observed role journeys.
8. Enablement: institution/domain-specific grants and gates; staged observation under approved thresholds.
9. Evidence: deployed versions, ledger/fingerprint, test receipts, monitoring and owner acceptance.

## Rollback procedure
Incident trigger → authorized containment → select previously verified compatible app/function versions → confirm schema compatibility → restore delivery pointers/redeploy prior ref through chosen surface → verify real page and cache/service-worker behavior → verify auth, writes, projections and receipts → reconcile in-flight commands → record incident and corrective work.
Pages and Edge Functions roll back separately in the repository runbook. Vercel rollback is a distinct surface; inspect actual project/deployment/config and approve exact target. Do not assume one rollback controls all.

## Database incident
No automatic destructive down migration. Pause affected server-side commands through a verified control, preserve evidence, investigate, then approved forward fix or tested recovery plan. Frontend read-only alone is not enforcement. ROLLBACK.md documents VITE_READ_ONLY/SEMESTER_READ_ONLY controls, but current enforcement and activation must be reverified. Historical timings are not new service commitments.

## Automation triggers and limits
Authorization leak or corrupt writes require immediate incident escalation. Error/latency and observation thresholds must be approved from measured baselines, not invented here. An automated rollback may proceed only with preauthorized compatible target and tested mechanism; otherwise automated containment/alert with human decision. Approval is required before changing live external systems.
