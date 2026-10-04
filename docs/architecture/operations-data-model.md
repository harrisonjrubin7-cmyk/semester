# Operations data model

## Boundary

Operational data is separate from student product content. Links use tenant, actor, subject, purpose, correlation, and audit identifiers—not copied private content. Company records are global only where genuinely company-wide; customer records retain tenant/account boundaries.

## Common record fields

Every operational table should define:

- `id`, `created_at`, `updated_at`, optimistic `version`;
- `tenant_id` when customer/tenant scoped; non-null unless explicitly company-global;
- `owner_role` and accountable `owner_id` where safe;
- `classification` and `purpose_code`;
- `source_type`, `source_id`, `authority`, `observed_at`, `verified_at`;
- `retention_class`, `retention_until`, `legal_hold_state`;
- `status` from a domain-specific finite state machine;
- immutable transition/audit linkage and `correlation_id`;
- soft deletion/tombstone where synchronization/history requires it.

Do not add a JSON blob as a substitute for tenant, classification, purpose, state, or authority columns.

## Domain groups

### Product & Platform

| Domain | Core records | Notes |
|---|---|---|
| Tenant | tenants, domains, health snapshots, implementations, contacts | Subscription is referenced, not inferred |
| Identity | people, memberships, roles, grants, sessions, devices, access reviews | Personal identity remains separate from institutional membership |
| Capability | definitions, evidence, dependencies, entitlements, flags, cohorts, activation decisions | “live” requires evidence and approval |
| Integration | connections, credential metadata, sync runs, exceptions, mappings, reconciliation cases | Never store/display secret values |
| Support | cases, messages, notes, access grants, SLA events, escalations, CSAT | Notes classified independently from ticket shell |
| Reliability | incidents, updates, SLO snapshots, releases, rollbacks, synthetic results, backups, restore drills | Evidence is revision/environment bound |
| Trust | audit, security events, retention/export/deletion requests, holds, reviews | Audit reads are audited |
| AI | provider configs, tenant policy, usage/cost rollups, action audits, safety/quality cases | Raw prompts/context minimized and policy-gated |
| Marketplace | partners, verifications, agreements, listings, moderation, abuse, delivery receipts, retention obligations | Student disclosure is a separate consent snapshot |

### Company & Business

| Domain | Core records | Notes |
|---|---|---|
| Revenue | leads, accounts, opportunities, stages, activities, contracts, renewals | Native manual baseline; connector provenance retained |
| Success | implementation plans, milestones, training, success plans, health snapshots, QBRs, escalations | Health formula versioned and explainable |
| Finance | plans, subscriptions, invoices, payments status, finance snapshots, vendors, budgets, costs | Provider/accounting status authoritative; no direct money movement by dashboard |
| Marketing | campaigns, assets, content items, approvals, attribution events | Consent and channel policy mandatory |
| Social | accounts metadata, drafts, approvals, publication receipts, engagement rollups | No tokens or publish without explicit approved provider action |
| Partnerships | pipeline, onboarding, agreements, coverage, performance, support, renewal | Link to marketplace partner after verification |
| People/governance | requisitions, responsibility assignments, review schedules, decisions | Sensitive HR/candidate data excluded until approved system/policy exists |
| Legal/procurement | document inventory, questionnaires, approvals, subprocessors, insurance, policy reviews, compliance evidence | Status means workflow status, never legal sufficiency |

## Source and authority

`source_type` identifies manual, imported file, connector, provider webhook, system observation, or derived rollup. `authority` identifies who may establish the fact. A manual finance snapshot can be valid manual data but cannot be labeled accounting-authoritative. A provider event without reconciliation is observed, not verified.

## State machines

Each domain owns allowed transitions. Transitions record prior/new state, actor, purpose, approval, evidence, timestamp, correlation ID, and recovery/rollback. Invalid transitions fail closed. UI labels are generated from domain state plus authority, not stored as free text.

## Tenant, role, and purpose enforcement

- Derive tenant and membership on the server; never trust a client-supplied tenant alone.
- Apply RLS plus service authorization; background jobs receive explicit tenant-scoped context.
- Sensitive reads require purpose and, where applicable, time-bound support or restricted grant.
- Cross-tenant aggregates require an approved company role, privacy thresholds, and a separate aggregate table/read model.
- Company-global rows cannot contain student or education-record content.

## Retention and deletion

Retention rules are data, versioned and approved. Deletion produces per-store outcomes: deleted, retained under policy, held, or scheduled. Legal hold overrides sweeps through a tested server path. Backups and derived aggregates have explicit treatment; deletion completion is not claimed until reconciliation closes.

## Event separation

- Audit: immutable accountability and security evidence.
- Operational telemetry: service health and performance.
- Product analytics: approved value events without raw content/PII.
- Marketing analytics: consent-aware public journey events.
- Business events: pipeline/finance/success workflow changes.

One event may cause another, but a product analytics row never substitutes for audit or an accounting record.

## Current repository gap

Supabase already contains many of these nouns and strong RLS/check evidence. The missing layer is normalization and authoritative read models: multiple migrations, registries, and documentation tables describe overlapping states. Implement adapters and compatibility views before schema consolidation; do not destructively rewrite production history.

