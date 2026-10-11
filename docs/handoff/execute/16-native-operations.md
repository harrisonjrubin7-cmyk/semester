# Stream 16 — Native operations (Institution OS, Company OS, Control Plane)

## Paste this

> You are the institutional operations, company operations, platform governance, product, engineering, security, privacy, accessibility, finance, GTM, implementation, customer-success and SRE team for Semester. Read design/docs/operations/README.md and every doc it links. Audit existing tenants, roles, audit and ops tables first; map migration 100_controlled_actions onto them — extend, never duplicate. Build P0 only, in the branch order below. Stop at the end of each branch for review.

## Rules

- No generic admin dashboards, duplicate records, broad unscoped admin access, static mockups or disconnected back-office tools.
- Every console: native, canonical data, tenant-isolated, capability-gated, policy-aware, consent-aware, audit-ready, source/authority/freshness-aware, accessible, responsive, monitored, tested, documented, supportable, reversible.
- Every high-impact action: Request → Identify tenant and operator → Policy / capability / consent validation → Retrieve authoritative records → Impact preview → Approval if required → Idempotent command → Immutable audit event → Outbox / domain event → Read-model update → Notify affected people → Receipt and history → Rollback or remediation path.
- Routes are not security: every screen, API, RPC, query, storage operation, workflow action and export enforces tenant + capability.
- Company roles never see student records.

## Branches

1. `feat/ops-tenant-capability-foundation` — Tenants, memberships, capability grants, delegation, permission decision function
2. `feat/ops-audit-policy-source` — Audit standard, explorer, policy + consent registries, source metadata
3. `feat/ops-controlled-actions` — api.request_action / approve / execute with impact preview, outbox, receipts
4. `feat/ops-inbox-work-approvals` — Operations Inbox, My Work, Approval Center
5. `feat/ops-tenant-customer-360` — Tenant 360, Customer 360, pilot tracking
6. `feat/ops-support-escalation` — Support queue, escalation, elevated-access workflow
7. `feat/ops-release-incident` — Release center, cohorts, kill switches, incident command, rollback
8. `feat/ops-integration-visibility` — Integration registry, sync status, mappings, reconciliation
9. `feat/inst-registration-readiness-console` — Registrar console for the pilot
10. `feat/ops-billing-entitlements` — Pilot quotes, invoices, entitlements, renewals (uses 090)

## Done when (per branch)

docs/operations/OPERATIONS_RELEASE_GATES.md items 1–10 pass for the consoles in that branch.

## Return

Existing-state audit · canonical data and authority map · console and route map · role/capability matrix · P0–P3 backlog · first 25 actions · first 10 branches · database/RLS/RPC plan · screen/component plan · test/security/accessibility plan · SLO/observability plan · risk register · 90-day/12-month/36-month roadmap · readiness scorecard by domain.
