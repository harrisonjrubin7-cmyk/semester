# Operations Console UX architecture

## Purpose

One internal console operates two related systems without conflating them:

- **Product & Platform Operations:** reliability, tenants, identity, capabilities, integrations, data quality, support, trust, release, AI, marketplace/community.
- **Company & Business Operations:** executive health, revenue operations, customer success/implementation, finance, marketing/social, partnerships, people/governance, legal/procurement.

The planes share identity, context, evidence, approvals, audit, and design language. They do not share unrestricted data access.

## Current baseline

`screens/Console.tsx` is a real gated console shell. It requires a configured account service, a signed-in operator, a platform-scoped `console:operate` grant, and server enforcement. It exposes Command center, optional Support, Approvals, Break-glass, Audit, Customers, Figures, Evidence, and saved Views. It has an environment/scope/operator/role/MFA/session/support-access context bar and keeps preferences server-side.

This is a strong control foundation. It is not yet the requested dual-plane information architecture. Tenant, integration, release, security, AI, marketplace, revenue, finance, marketing, social, people, and legal work remain spread across registries, institutional components, documents, and SQL.

## Information architecture

```text
Operations Console
├── Product & Platform
│   ├── Command Center
│   ├── Tenants & Organizations
│   ├── Users & Identity
│   ├── Capabilities & Rollouts
│   ├── Integrations
│   ├── Data Quality
│   ├── Support
│   ├── Trust, Security & Privacy
│   ├── Releases & Reliability
│   ├── AI Operations
│   └── Marketplace & Community
└── Company & Business
    ├── Executive Dashboard
    ├── Revenue Operations
    ├── Customer Success & Implementation
    ├── Finance Operations
    ├── Marketing & Growth
    ├── Social Operations
    ├── Partnerships
    ├── People & Governance
    └── Legal, Procurement & Compliance Readiness
```

## Console page contract

Every page declares:

- plane, module, purpose, owner, data classification, authoritative source, refresh time, and limitations;
- environment, tenant/scope, operator, grants, MFA freshness, session expiry, and support-access state;
- loading/empty/stale/offline/permission/error states;
- read model and pagination/filter behavior;
- which actions are offered, which server capability authorizes them, and whether prepare/confirm/two-person approval is required;
- audit event, correlation ID, idempotency key, rollback/recovery path, and support/runbook link.

## Navigation and density

- Default landing is a read-only command center with exceptions, impact, owner, and next action—not vanity metrics.
- Plane switch is persistent and explicit; cross-plane links open with source context.
- Tenant scope is always visible and never inferred from a row selection alone.
- Desktop uses compact tables with drill-in; small screens use exception lists and read-only detail. Risky writes require a larger viewport or a deliberate supported mobile flow.
- Search returns permission-filtered operational objects and never raw student content.

## Action model

1. Read-only by default.
2. Explain why the operator may see the record.
3. Prepare action server-side; return impact, dependencies, approval rule, and expiry.
4. Re-authenticate for sensitive action.
5. Confirm with reason and, where required, typed target/evidence.
6. Enforce distinct approver and purpose scope server-side.
7. Execute idempotently; never report success without destination acknowledgment.
8. Write immutable audit and surface rollback/recovery.

## Gap matrices

### Product & Platform

| Module | Current state | Gap |
|---|---|---|
| Command center | Present | Needs authoritative telemetry/incident/release/tenant-health aggregation |
| Tenants/users | Partial | Lifecycle, domains, branding, suspension, sessions, recovery, and review need consolidated read models |
| Capabilities | Strong registries | One evidence-gated activation workflow is missing |
| Integrations/data quality | Extensive SQL/components | Exceptions, retry/replay, credential metadata, and reconciliation need one workspace |
| Support | Tickets and access grants | SLA, incident linkage, root cause, customer timeline, and CSAT need consolidation |
| Trust/release | Audit/evidence/readiness scaffolding | Production telemetry, restore, on-call, vulnerability, and status evidence need live feeds |
| AI | Policy/provider registries | Usage/cost/quality/safety rollups and minimized log access remain incomplete |
| Marketplace/community | Moderation and governance pieces | Partner agreement, delivery, fraud, retention, and support lifecycle need one module |

### Company & Business

| Module | Current state | Gap |
|---|---|---|
| Executive | Registry/document-derived | No authoritative connected company health model |
| RevOps | Commercial schemas/readiness | No verified CRM connector or governed manual pipeline workspace |
| Success/implementation | Docs and tenant readiness | No unified account plan, milestones, adoption, renewal, and escalation workspace |
| Finance | Billing/plan groundwork | No accounting authority, approved actuals, cash/runway source, or money-movement approval console |
| Marketing/social | Public site and content records | No governed calendar→review→publish→measure flow; external publishing remains prohibited |
| Partnerships | Marketplace pieces | No business pipeline tied to verification/agreements/performance |
| People/governance | Responsibility registries | No approved HR/candidate data system or access-review calendar UI |
| Legal/procurement | Evidence and draft policies | No approved document inventory/contract workflow or legal sufficiency claim |

## Success measures

Measure time to detect, time to understand impact, time to safe resolution, stale-evidence exposure, unauthorized-action refusal, support resolution, connector reconciliation, implementation milestone completion, forecast provenance, and operator error rate. Never create individual student surveillance metrics.

