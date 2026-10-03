# Implementation Plan: Semester Operations Console Expansion

## Overview

Extend Semester's existing secure Operations Console into a complete internal SaaS and company control plane. The work preserves the current role/capability/RLS/audit/approval foundation, consolidates existing GTM and commercial records instead of duplicating them, and delivers one verified vertical slice at a time.

Planning baseline: `origin/main` at `944a2878`. The attached working branch contains relevant Command Center hardening but is behind main; the first implementation action is baseline reconciliation in a fresh or safely updated branch.

## Architecture decisions

- Keep Supabase Auth, `app_roles`, `role_capabilities`, `role_grants`, `private.has_capability`, and RLS as the authorization foundation.
- Treat `console:operate` as shell access only. Each workspace requires its own domain capability and scoped server-side authorization.
- Reuse GTM and commercial schemas as systems of record; do not create duplicate CRM, contract, billing, or success entities.
- Use typed, security-definer read RPCs with pinned search paths, explicit scope validation, demo exclusion, pagination, classification, and provenance.
- Route high-risk writes through fresh MFA, existing approval duties, reason/evidence capture, and audit-first transactional execution.
- Keep student-private content outside general console views and search. Support access remains consent-bound, scoped, expiring, bannered, and audited.
- Preserve the Semester visual system and build responsive, accessible operational density with existing components.
- Represent readiness in separate evidence layers: repository, configured, deployed, activated/approved, and observed-live.

## Dependency graph

```text
Current-main reconciliation
  -> workspace registry + scope contract
     -> reusable RPC/test pattern
        -> tenant/pilot slice
           -> support + privacy slices
           -> integration + reliability slices
        -> GTM/commercial mappings
           -> sales slice
           -> billing slice
           -> success/renewal slice
        -> trust/company operations
           -> analytics and automation
```

## Task list

### Phase A — Foundation and safety

- [x] A1: Reconcile current main with Command Center fail-closed fixes.
- [ ] A2: Add a capability-aware console workspace registry.
- [ ] A3: Establish the scoped RPC and negative-policy-test template.
- [ ] A4: Add a five-layer readiness/evidence registry.

### Checkpoint A

- [ ] Exact-commit TypeScript, lint, university, SQL policy, focused console, shuffle, and build gates pass.
- [ ] HawkScan completes against the runnable application with no unresolved high/critical finding.
- [ ] No new workspace can be opened or queried using `console:operate` alone.

### Phase B — Pilot operating backbone

- [ ] B1: Tenant and pilot operations read workspace.
- [ ] B2: Support case workspace with metadata-first diagnosis.
- [ ] B3: Privacy/data-rights request workspace.
- [ ] B4: Integration health and sync-exception workspace.
- [ ] B5: Release and incident workspace.
- [ ] B6: Implementation and success-plan workspace.

### Checkpoint B

- [ ] A limited institutional pilot can be operated end to end using synthetic/demo data.
- [ ] Cross-tenant, demo/production, support-consent, and legal-hold negative tests pass.
- [ ] Accessibility, keyboard, narrow viewport, loading, empty, stale, and error states are verified.

### Phase C — Revenue and enterprise operations

- [ ] C1: GTM account, stakeholder, opportunity, and pilot workspace.
- [ ] C2: Quote and contract workspace.
- [ ] C3: Billing, invoice, collections, and dunning workspace.
- [ ] C4: Credit, refund, and cancellation approval workflows.
- [ ] C5: Renewal, expansion, QBR, and account-health workspace.
- [ ] C6: Vendor, subprocessor, procurement, and policy-review workspace.

### Checkpoint C

- [ ] Draft, test, provider-verified, live, failed, refunded, and archived financial states are visibly distinct.
- [ ] No payment instrument, raw provider payload, secret, or credential is exposed.
- [ ] Revenue reports reconcile to provider-verified records and state their source and limitations.

### Phase D — Company control plane and advanced operations

- [ ] D1: Internal workstream, risk, decision, and operating-review workspace.
- [ ] D2: Provenance-bearing operational and revenue analytics.
- [ ] D3: Approval-enforced feature flag and entitlement changes.
- [ ] D4: Deployment/release adapter and rollback evidence ingestion.
- [ ] D5: Human-in-the-loop automation framework.
- [ ] D6: Complete runbook library, changelog, and readiness report.

### Checkpoint D

- [ ] Every sensitive action has server authorization, scope validation, reason, audit evidence, and required approval.
- [ ] All project gates and DAST pass on the exact release commit.
- [ ] The readiness report distinguishes repository evidence from external production evidence and names every remaining blocker.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing branch is behind main | High | Reconcile before implementation; do not stack new features on stale history |
| Duplicate business records | High | Declare GTM/commercial systems of record and add explicit mappings |
| Capability creep | High | One capability per domain action class; negative policy tests for every RPC |
| Cross-tenant leakage | Critical | Server-derived scope, RLS, demo exclusion, and direct adversarial SQL tests |
| Student-content exposure | Critical | Exclude content from console models; require separate support grants |
| False readiness claims | High | Five-layer evidence state and exact-source provenance |
| Financial-state ambiguity | High | Provider verification fields and explicit draft/test/live labels |
| Unverified external operations | High | Keep activation gates blocked until deployment, staffing, approval, and observed-operation evidence exists |

## Open decisions for review

- Choose the implementation branch/worktree after reconciling the existing Command Center fixes with current main.
- Confirm the first vertical slice: recommended default is Tenant/Pilot Operations because it exercises scope, entitlements, integrations, support, contracts, and readiness without introducing payment mutations.
- Confirm who may hold each new internal role in production and which actions require two-person approval; repository defaults are not staffing approval.
