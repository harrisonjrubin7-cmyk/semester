# Semester Operations Console Discovery Audit

Date: 2026-10-03
Baseline inspected: `origin/main` at `944a2878` plus the existing `codex/console-fail-closed-status` worktree
Evidence standard: repository implementation and tests are recorded separately from deployment, staffing, external approval, and observed production operation.

## Executive finding

Semester already has a substantial, security-oriented Operations Console foundation. It is not an uncontrolled admin dashboard and should not be replaced. The repository contains scoped capabilities, role grants, RLS coverage checks, fresh-MFA enforcement, two-person approvals, break-glass controls, an append-only audit chain, tenant/demo separation, support-access grants, a live exception-oriented command center, commercial and GTM schemas, and focused policy tests.

The principal gap is productization and operational integration. Much of the business control plane exists as database models, migrations, registers, or separate institutional screens, while the `/console` product exposes only eight views: Command center, Approvals, Break-glass, Audit, Customers, Figures, Evidence, and Views. Sales, billing operations, implementation, customer success, privacy/data-rights, integrations, reliability, vendors, company work, and analytics are not yet coherent console workspaces backed by a unified, capability-specific read/write service boundary.

The correct next move is to extend the existing control plane in vertical slices. No new global administrator role, client-side authorization scheme, second audit system, duplicate CRM schema, or broad student-data browser should be created.

## Source map

### Application and console

- `app/src/screens/Console.tsx` gates the console on a real account and a platform-scoped `console:operate` grant.
- `app/src/components/console/*` implements the current views and common context/provenance presentation.
- `app/src/lib/console/client.ts` is the browser-to-Supabase adapter for console RPCs and preferences.
- `app/src/screens/console.test.tsx` and `app/src/lib/console/client.test.ts` hold the main UI and adapter contracts.
- `docs/OPERATIONS-CONSOLE-MAP.md` and `ops/operations-console/README.md` describe the current control-plane contract.

### Authorization and audit

- `supabase/migrations/20260922012000_capabilities.sql` establishes the capability model.
- `public.app_roles`, `public.app_capabilities`, `public.role_capabilities`, and `public.role_grants` are the reusable authorization foundation.
- `private.has_capability` and scoped helper functions enforce authorization in database boundaries.
- `supabase/migrations/20260929100000_console_control_plane.sql` adds console capabilities, operator preferences, council seats, duties, MFA assertions, figures, and the audit chain.
- `supabase/migrations/20260929110000_console_approvals_and_break_glass.sql` adds approvals, action records, break-glass, customer records, and fail-closed action execution.
- `supabase/console-control-plane.check.sql`, `supabase/console-approvals.check.sql`, `supabase/rolegrants.check.sql`, `supabase/my-capabilities.check.sql`, `supabase/rls-coverage.check.sql`, and `supabase/grants.check.sql` are direct policy evidence.

### Commercial, GTM, and customer operations

- `supabase/migrations/20260928090000_gtm_foundation.sql` models prospects, consent, suppression, campaigns, accounts, stakeholders, decision logs, pilots, pilot metrics, and outcomes.
- `supabase/migrations/20260929070000_commercial_core.sql` models products, plans, prices, entitlements, billing accounts, quotes, contracts, subscriptions, invoices, payment events, credits/refunds, dunning, cancellation, implementation, success plans, QBRs, renewals, account health, compliance, content, and CTA routing.
- `supabase/migrations/20260929080000_commercial_automation.sql` adds checkout-session and site-lead automation boundaries.
- `supabase/commercial.check.sql`, `supabase/commercial-automation.check.sql`, and `supabase/gtm.check.sql` provide focused schema and authorization tests.
- Billing provider edge functions exist for checkout, cancellation, and verified webhook processing.

### Institution, integration, support, privacy, and reliability

- `supabase/migrations/20260927170000_integration_control_plane.sql` and later integration migrations model integration health, control, and governance.
- `app/server/institution/*` contains the institutional gateway and adapters with focused tests.
- `supabase/migrations/20260928210000_support_tickets.sql` and support-access migrations separate ticket handling from consent-bound student access.
- `supabase/migrations/20260929010000_account_erasure_and_export.sql`, `20260930000000_audit_and_subject_requests.sql`, `20260930234000_data_subject_request_intake.sql`, and legal-hold migrations provide data-rights foundations.
- `supabase/migrations/20260930173030_console_command_center.sql` provides a fail-closed operational exception queue using release, approval, break-glass, integration, support, and tenant-rollout sources.

### Delivery, CI, and documentation

- Application gates are run from `app/`: `npx tsc -b`, `npm run lint`, `npm run check:university`, `npm test`, `npm run test:shuffle`, and `npm run build`.
- SQL policy tests are run through `supabase/check.sh`.
- `.github/workflows/*`, `stackhawk.yml`, production/public smoke scripts, and release documentation provide delivery controls.
- Existing runbooks and operating documents cover portions of support, incident response, data rights, release gates, integration operations, identity providers, and production activation.

## Existing capability and role map

### Core internal roles already present

- `platform_admin`
- `support_agent`
- `implementation_manager`
- `data_steward`
- `incident_responder`
- `trust_officer`
- `account_executive`
- `finance_operator`
- `customer_success`
- `compliance_owner`
- `content_owner`

Tenant-scoped and domain roles, including `university_admin`, `billing_contact`, marketing roles, and integration roles, are also present. The exact effective access remains the product of a role grant, capability mapping, scope, expiry, and RLS—not the role name alone.

### Relevant capabilities already present

- Console: `console:operate`, `approval:decide`, `breakglass:request`
- Commercial: `billing:operate`, `billing:read`, `success:manage`, `account:manage`
- Trust/content: `compliance:manage`, `content:manage`
- Tenant/integration/support capabilities are distributed across their owning migrations and policy checks.

### Required model extension

The existing capabilities are strong foundations but too coarse for a complete console. Future slices should add least-privilege operations such as read/manage/approve distinctions for CRM, contract, invoice, refund, dunning, privacy request, incident, release, vendor, and company-work records. `console:operate` must remain an entry capability, not authorization to every domain.

## Existing privileged paths

- Console access: real signed-in account plus a live platform-scoped `console:operate` grant.
- Sensitive console actions: fresh MFA and database-side authorization.
- High-risk actions: request, independent decision(s), reason/evidence, then `console_act` with audit-first failure behavior.
- Break-glass: time-bounded, ticket-bound, separately reviewed, and not self-reviewed.
- Support data access: student-approved, purpose/scoped, expiring grants with visible session context and audited reads.
- Commercial writes: generally service-role or verified-provider paths; the browser receives narrowly scoped read or self-service cancellation access.
- Integration writes and tenant changes: capability and approval boundaries exist but are not consistently assembled into one operator workspace.

## Data-domain isolation assessment

| Domain | Repository evidence | Current concern |
| --- | --- | --- |
| Student private workspace | Owner/RLS patterns and support grants | Must never be joined into general console search |
| Institution-authoritative data | Tenant-scoped RLS and institutional gateway | Activation and named-tenant operation require external evidence |
| Internal platform operations | Console RPCs, duties, audit chain | Domain-specific read APIs remain incomplete |
| Support | Tickets plus separate access windows | Case management is not yet a full console workspace |
| Billing/finance | Rich commercial schema and verified webhook boundary | Provider/live-operation status must not be inferred from schema |
| Security/audit | Hash-chained audit, seals, policy tests | Production scheduling, key custody, and operator ownership need observed evidence |
| Analytics | Purpose-limited first-party activity model | Executive/operational metrics need provenance and suppression rules in-console |
| Legal/compliance | Registers and documentation | Vendor, policy, contract review workflows are not unified in-console |
| Demo/test/production | Demo tenant exclusion and deployment-derived environment | Must remain fail-closed through every new RPC and workspace |

## Reuse, harden, and build

### Reuse unchanged in principle

- Supabase Auth and the existing role/capability/grant model.
- RLS as the direct-data enforcement layer.
- Fresh-MFA assertions and console context bar.
- Approval requests, independent decisions, console duties, and audit-first action execution.
- Audit chain, integrity sealing, and audited audit reads.
- Demo-tenant exclusion and deployment-derived environment labeling.
- Support-access grants rather than impersonation.
- GTM, commercial, support, data-rights, integration, and governance schemas where they already model the needed fact.
- Existing Semester components, spacing, typography, responsive behavior, and calm operational visual language.

### Harden before expansion

- Reconcile the unmerged fail-closed Command Center branch with current `origin/main`; do not build new work on its stale baseline.
- Replace any broad `commercial_staff()` access with explicit capability checks where individual workspaces have materially different sensitivity.
- Define canonical object scope rules for billing account, GTM account, tenant, contract, support case, and data-rights request.
- Ensure every new console RPC defaults to excluding demo data and cannot widen scope through a client-provided identifier.
- Add consistent reason, ticket, impact, rollback, and evidence fields to high-risk duties.
- Verify deployment-time audit sealing, scheduler ownership, recovery, and key rotation outside repository claims.
- Validate accessibility and responsive behavior with the actual authenticated console, not only component rendering.

### Build as vertical slices

1. Console workspace registry and capability-aware navigation.
2. Tenant and pilot operations read workspace.
3. Support case workspace that keeps private-content access behind support grants.
4. Privacy/data-rights workflow workspace with legal-hold awareness.
5. Integration and sync-health workspace.
6. Release and incident workspace.
7. Sales/account/pilot pipeline workspace.
8. Contract, billing, invoice, collection, credit/refund, and dunning workspace.
9. Implementation, success, QBR, renewal, and account-health workspace.
10. Trust, vendor, policy, evidence, and procurement workspace.
11. Company work, risk, decision, and operating-review workspace.
12. Provenance-bearing operational and revenue analytics.

## Gap register

### P0 — safety and trustworthy baseline

- Reconcile the current console fail-closed fixes onto the latest main line.
- Add a workspace registry that authorizes each domain separately and does not treat console entry as domain access.
- Define a canonical scoped RPC contract and negative cross-tenant tests for every new workspace.
- Add a console readiness registry that distinguishes repository-ready, configured, deployed, activated, and observed-live states.
- Verify the existing SQL and frontend gates on the exact baseline before feature work.

### P1 — pilot operating backbone

- Tenant/pilot read workspace using existing school, rollout, GTM pilot, entitlement, contract, integration, and support records.
- Support cases with metadata-first diagnosis and explicit support-access escalation.
- Integration health and sync exception routing.
- Privacy requests, exports, erasure, legal holds, and completion evidence.
- Release/incident records and customer-impact communication status.
- Implementation milestones, success plans, pilot metrics, and ownership.

### P2 — revenue and company operations

- Sales pipeline, stakeholders, decisions, quotes, and contracts.
- Billing accounts, subscriptions, invoices, collections, dunning, credits, refunds, and cancellations.
- Renewals, expansion, account health, QBRs, and customer-success actions.
- Vendor/subprocessor, policy review, procurement, and security-review workspaces.
- Internal risks, decisions, OKRs/workstreams, owners, and weekly operating review.

### P3 — advanced control plane

- Approval-enforced production flag and entitlement changes.
- Deployment-provider integration, release automation, and rollback evidence ingestion.
- Incident automation and status-page/customer communication integration.
- Advanced operational analytics and forecast/budget adapters.
- Human-in-the-loop automations with idempotency, preview, approval, audit, and rollback.

## Security gaps and risks

1. **Stale-branch risk:** the existing console hardening branch is materially behind `origin/main`; feature work there would hide regressions or create a difficult merge.
2. **Capability aggregation risk:** `console:operate` and helper predicates must not become de facto super-admin paths as more domains are added.
3. **Duplicate-record risk:** `customer`/`customer_contract` console tables overlap conceptually with GTM and commercial records. Establish system-of-record mappings before adding more customer entities.
4. **Status-claim risk:** repository migrations and tests do not prove production deployment, staffed operations, payment activation, institutional approval, or observed customer use.
5. **Sensitive-join risk:** unified search can accidentally bridge student-private, institution-authoritative, support, billing, and audit data. Search must be domain-specific and classification-aware.
6. **Automation risk:** service-role commercial writes are safe only when the server boundary validates authorization, idempotency, provenance, and provider signatures.
7. **Operational-key risk:** audit-chain and webhook designs require external evidence for key custody, rotation, scheduler execution, alert routing, and recovery.

## Recommended architecture

- Keep `/console` as the authenticated internal shell and context boundary.
- Add a typed workspace registry whose entries declare capability, scope kind, data classification, read RPC, supported actions, approval duty, and evidence fields.
- Expose read models through security-definer RPCs with pinned search paths, explicit capability checks, tenant/demo filtering, stable pagination, and provenance.
- Perform high-risk writes through narrow functions connected to the existing approval and audit-first action machinery.
- Treat GTM and commercial tables as systems of record; map legacy `customer*` console records rather than creating another business schema.
- Keep student-content access out of ordinary workspace RPCs. Link to a separately granted, bannered support session only when consent and purpose exist.
- Model external systems behind adapters. Store opaque provider references and verification state, never payment instruments or credentials.
- Use the existing design system and console field components; add dense responsive tables progressively, with accessible summaries and empty/error states.
- Put readiness assertions in a registry with five distinct states: repository evidence, configuration, deployment, activation/approval, and observed operation.

## Verification baseline

Before implementation, run from `app/`:

1. `npx tsc -b`
2. `npm run lint`
3. `npm run check:university`
4. Focused console and domain tests
5. `npm test`
6. `npm run test:shuffle`
7. `npm run build`

Run `supabase/check.sh` for direct database-policy evidence. For any meaningful code change, run the configured HawkScan DAST loop after the application is available to scan; fix findings and rescan. A missing runtime or API key is an explicit unverified security gate, not a pass.

## Readiness decision

**Current decision: NOT READY / NEEDS REMEDIATION for the complete mission described in the source brief.**

The existing foundation may be suitable for controlled internal development and limited read-only evaluation, but this audit does not establish production deployment, staffed operations, live billing, institutional approval, or end-to-end operation of the broader business console. The first implementation release should target **READY FOR INTERNAL USE** for the P0 foundation and one P1 vertical slice, then advance only with exact-commit tests and external operational evidence.
