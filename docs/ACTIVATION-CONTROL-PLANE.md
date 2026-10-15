# Capability activation control plane

<!-- Rendered from app/src/lib/governance/activation-control-plane.ts by activation-control-plane.test.ts. Edit the data, then run `npm run registers` from app/. -->

This is the executable first slice of the Semester Platform Constitution.
A feature flag and entitlement are rollout inputs, never sufficient authority
for a controlled or high-risk capability. The evaluator also requires current
tenant-bound evidence, approval, configuration, integration health and operating
controls. It evaluates permission only; domain services must re-authorize and
reconcile the actual action.

## Current finding

The registry maps all 28 executable flags: 5 standard, 0 controlled and 23 high-risk.
Every definition is currently L2 (built) because repository code cannot by itself
create independent verification, institutional readiness or tenant approval.
Consequently, every controlled and high-risk capability remains denied until
current external and operational inputs are supplied.

## Eight activation primitives

1. identity-tenancy
2. permission-consent-authority
3. canonical-data-provenance
4. policy-rules
5. action-workflow
6. integration-gateway
7. trust-evidence
8. experience-accessibility

## Maturity

| Level | Meaning |
| --- | --- |
| L0 | Vision |
| L1 | Designed |
| L2 | Built |
| L3 | Verified |
| L4 | Institution-ready |
| L5 | Tenant-approved |
| L6 | Parallel run |
| L7 | Bounded system of record |
| L8 | Tenant GA |
| L9 | Repeatable |

## High-risk activation contract

- executed-agreement
- data-authority-map
- retention-correction-export-offboarding
- role-purpose-consent-policy
- separation-of-duty
- accessible-workflow-and-fallback
- sandbox-security-idempotency-reconciliation
- migration-parallel-run-rollback
- monitoring-slo-support-incident-kill-switch
- training-uat-staged-rollout-go-live-authorization
- truthful-product-status-and-claim-review

## Canonical capability projection

| Capability ID | Owner | Class | Product maturity | Fallback |
| --- | --- | --- | --- | --- |
| `flag:module.core_mode` | Platform | high-risk | L2 | Engage kill.core_modules for the school: every module reads Connect at once and any Core data is frozen, read-only, not deleted. Or request Connect for one module. |
| `flag:module.integration_dashboard` | Integrations | standard | L2 | Set the tenant policy row to off. The dashboard reads only; nothing to undo. |
| `flag:module.institutional_operations` | Institutional research | standard | L2 | Unset VITE_INSTITUTIONAL_OPERATIONS (or set it to off) and redeploy: the screen reads the build-time flag, not the tenant policy row. The studio stores its drafts on the analyst’s device only; nothing to undo server-side. |
| `flag:module.source_freshness_cards` | Student experience | standard | L2 | Set to off. Cards fall back to the student-entered data they show today. |
| `flag:module.campaign_manager` | Growth | high-risk | L2 | Set off. Scheduled sends stop at the next decision; nothing already sent is recalled. |
| `flag:module.sponsorship` | Trust & Safety | high-risk | L2 | Set off. Every placement disappears on the next render. |
| `flag:module.dining` | Campus services | high-risk | L2 | Engage kill.writeback for the school (new orders and gifts stop at once; cancellations and refunds still run), then set the tenant policy row off. Nothing already charged is reversed by the flag; staff cancel open orders, which refunds them. |
| `flag:release.integration_dashboard_v1` | Integrations | standard | L2 | Set to off; the University screen shows the control plane as it did before. |
| `flag:integration.lms_lti` | Integrations | high-risk | L2 | Engage the connection kill switch, set the flag off, then disconnect and revoke. |
| `flag:integration.sis_read` | Integrations | high-risk | L2 | Engage the connection kill switch, set the flag off, then disconnect and revoke. |
| `flag:integration.degree_audit_read` | Integrations | high-risk | L2 | Engage the connection kill switch, set the flag off, then disconnect and revoke. |
| `flag:integration.advising_crm` | Integrations | high-risk | L2 | Engage the connection kill switch, set the flag off, then disconnect and revoke. |
| `flag:integration.career` | Integrations | high-risk | L2 | Engage the connection kill switch, set the flag off, then disconnect and revoke. |
| `flag:integration.campus_services` | Integrations | high-risk | L2 | Engage the connection kill switch, set the flag off, then disconnect and revoke. |
| `flag:integration.erp_bursar_actions` | Integrations | high-risk | L2 | Engage the connection kill switch, set the flag off, then disconnect and revoke. |
| `flag:scope.sis.enrollment_read` | Integrations | high-risk | L2 | Set off and withdraw the scope; mapped references stay but stop refreshing. |
| `flag:scope.lms.assignment_dates_read` | Integrations | high-risk | L2 | Set off and withdraw the scope. |
| `flag:scope.sis.registration_hold_summary_read` | Integrations | high-risk | L2 | Set off and withdraw the scope. |
| `flag:writeback.registration_submit` | Integrations | high-risk | L2 | Engage kill.writeback. |
| `flag:writeback.space_booking` | Integrations | high-risk | L2 | Engage kill.writeback. |
| `flag:writeback.lms_grade_passback` | Integrations | high-risk | L2 | Engage kill.writeback. |
| `flag:ops.external_ai_generation` | AI platform | high-risk | L2 | Engage kill.ai_generation. |
| `flag:ops.data_upload` | Platform | high-risk | L2 | Engage kill.data_upload. |
| `flag:ops.code_sandbox_enabled` | Platform | high-risk | L2 | Engage kill.code_execution. |
| `flag:safety.scoped_pseudonymity` | Trust & Safety | high-risk | L2 | Set off; pseudonyms fall back to names at next load. |
| `flag:safety.volunteer_moderation` | Trust & Safety | high-risk | L2 | Set off. |
| `flag:safety.institution_escalation` | Trust & Safety | high-risk | L2 | Set off. |
| `flag:experiment.today_action_ranking_v2` | Student experience | standard | L2 | Set off; Today returns to the current ranking. |

## Decision boundaries

- This control plane does not deploy, migrate, activate a tenant, or execute a domain write.
- Allow decisions issue a fifteen-minute receipt bound to the tenant, capability, operation, policy and configuration.
- This first slice does not yet make `evaluateFlag` consume that receipt; the receipt is never server-side authorization.
- Evidence and approvals are tenant-bound, dated and configuration-version-bound.
- Kill switches and an unavailable audit sink fail closed.
- Public wording is capped at the lower of product and tenant maturity.
- Denial explanations omit evidence contents, security findings and other tenant data.
