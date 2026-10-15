# Operational control plane

Status: partial implementation. The repository contains console components, typed operating policy, support/audit/approval foundations and several server-backed workspaces; some views remain illustrative or lack operated production evidence.

| Workspace | Current repository evidence | Missing operational proof |
| --- | --- | --- |
| Tenants/users | Tenant, membership, role and customer models | Named-tenant provisioning/offboarding |
| Capabilities/entitlements | Registry, activation and release profiles | Runtime exposure parity and current owner/evidence |
| Integrations | Adapter, worker, registry, reconciliation and health code | Live adapters, credentials, paging and UAT |
| AI | Governance, provider, budget and kill-switch patterns | Approved evaluations and production cost/incident data |
| Marketplace | Opportunity and moderation foundations | Verified partners and staffed escalation |
| Guardian | Family services and guardian schema | Projection service, invalidation and production verification |
| Support | Queue, grants, audit and runbooks | Staffed coverage and observed SLA/closure |
| Trust/audit | Trust room, evidence and break-glass policy | Independent review and live export/search exercise |
| Incidents/release | Incident, recovery and status artifacts | Current roster, synthetic history, restore/rollback exercises |
| Analytics/revenue | Taxonomies and operating-model sources | Validated metrics, contracts and accounting authority |
| Data rights/legal | Export/deletion/retention/hold foundations | Live end-to-end proofs and counsel-approved policy |

Every request derives operator identity and tenant server-side; resolves role, scope, purpose, entitlement and policy; displays environment/scope/operator/MFA/session/support access; defaults to read-only; requires fresh confirmation or dual control for dangerous actions; emits an audit/outbox record; returns an idempotent receipt; and defines rollback or compensation. Browser filtering is presentation, never permission.

Operational health uses `healthy`, `degraded`, `unhealthy`, `unknown`, `disabled` with checked time, owner, affected tenants/capabilities, customer impact, runbook and next action. Unknown/stale health blocks connected/live claims.

## Documentation and branch consolidation

1. Add `docs/README.md` grouped into architecture, product, security, operations, API, runbooks, launch evidence and archive.
2. Keep the Phase A set as current entry points and link generated sources rather than copy mutable facts.
3. Add status, owner, reviewed date, source commit, supersedes and evidence horizon metadata.
4. Move superseded root audits/plans into dated archives in a separate documentation-only PR; delete nothing blindly.
5. Keep legal templates visibly unapproved and operational evidence separate from plans.

At assessment GitHub had 36 open PRs and Git exposed 502 remote branches. Before implementation, identify superseded/duplicate work, migration-version collisions and overlapping release claims. This audit does not close, merge, delete or rebase anything. Future PRs declare base SHA, owned files/migrations, overlap check, evidence, rollback and claim/activation impact.
