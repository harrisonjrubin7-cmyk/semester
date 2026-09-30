# Semester Platform Constitution and Activation Control Plane Design

**Date:** 30 September 2026
**Status:** Approved conversational design; implementation planning follows user review of this specification
**Repository:** `harrisonjrubin7-cmyk/semester`
**Branch:** `codex/semester-platform-constitution`

## 1. Purpose

Semester already has substantial readiness, claims, evidence, feature-flag,
configuration, approval, and domain-replacement machinery. The next step is
not another parallel register. It is one enforceable control plane that gives
every capability a canonical identity and answers the same question everywhere:

> What may this capability truthfully claim and do, for this tenant, actor,
> purpose, configuration version, and evidence state, right now?

This design introduces the Semester Platform Constitution and Activation
Control Plane. It consolidates existing governance sources behind stable
interfaces, adds a shared capability-maturity model, and prevents a feature
flag or entitlement from activating a high-risk capability without its full
institution-specific activation contract.

The first implementation slice is governance infrastructure. It does not
activate, deploy, or represent as institution-ready any SIS, LMS, payment,
health, payroll, registration-write, grade-writeback, or autonomous-agent
capability.

## 2. Outcomes

The slice is complete when:

1. Every registered capability has exactly one stable identifier, domain,
   owner, platform-primitive mapping, maturity level, risk class, activation
   policy, evidence state, and permitted public claim.
2. Product, operations, readiness, procurement, and public-claims projections
   derive their answer from that canonical model rather than inventing status
   independently.
3. High-risk capabilities cannot activate through an ordinary feature flag,
   entitlement, client assertion, or incomplete approval.
4. Institution-specific activation decisions are explainable, versioned,
   audited, idempotent, and safe to deny.
5. Expired evidence, revoked approval, unhealthy required integration, or an
   active kill switch blocks new high-risk actions.
6. Historical decisions can be reproduced from the capability definition,
   tenant configuration, evidence, and policy versions effective at the time.
7. Automated tests prove the invariants above and generated documentation
   remains synchronized with the executable source.

## 3. Existing systems to preserve

The control plane adapts existing sources; it does not replace their domain
detail in one rewrite.

| Existing source | Role after this design |
| --- | --- |
| `app/src/lib/masterregister.ts` | Detailed launch requirements and gaps; projected through canonical capability IDs |
| `app/src/lib/ops/claims.ts` | Public wording and evidence references; permitted wording is capped by activation state |
| `app/src/lib/ops/evidence.ts` and `app/src/lib/trust/evidence-register.ts` | Evidence metadata and expiry; normalized for policy evaluation |
| `app/src/lib/flags.ts` | Rollout and kill-switch inputs; never sufficient authorization for a high-risk activation |
| `supabase/migrations/20260930230000_configuration_studio.sql` and `supabase/configuration-studio.check.sql` | Existing draft/publish/version foundation for institution configuration |
| `app/src/components/institutional/ConfigurationStudio.tsx` | Existing tenant administration surface; later consumes activation decisions and impact previews |
| `docs/DOMAIN-REPLACEMENT-REGISTER.md` | Domain boundary and replacement evidence; maps domains to canonical capabilities |
| Existing approval, migration, integration-quality, registration-transaction, and ledger controls | Domain-specific evidence and enforcement; retained behind activation requirements |

Adapters must be explicit and testable. A source that cannot map without
ambiguity fails validation instead of creating a second identity.

## 4. Semester Constitution

The control plane enforces these operating rules:

1. Students control personal plans, drafts, sharing, and exports.
2. Official institutional systems remain authoritative unless an institution
   explicitly approves Semester for a bounded workflow.
3. Meaningful facts carry source, provenance, freshness, and correction paths.
4. High-impact actions are explained, previewed, confirmed, and audited.
5. AI cites authorized sources, follows institutional and course policy, and
   does not silently make high-impact decisions.
6. No person, integration, or agent receives unrestricted student-data access
   by default.
7. Tenant data is isolated and sensitive requests are purpose-bound.
8. Accessibility is a release criterion.
9. Failures preserve data, expose honest status, and retain an official or
   human fallback.
10. Public claims cannot exceed verified maturity and current evidence.
11. Tenant activation requires the applicable policy, approval, data map,
    support ownership, monitoring, and rollback path.
12. Semester builds the smallest safe solution that improves a defined student
    decision or institutional workflow.

## 5. Platform primitives

Every capability maps to one or more of eight primitives:

1. **Identity and tenancy** — who the actor is and which tenant boundary applies.
2. **Permission, consent, and authority** — who may read, write, approve,
   share, export, or revoke for a stated purpose.
3. **Canonical data and provenance** — what the record means, where it came
   from, how fresh it is, and how it is corrected.
4. **Policy and rules** — versioned institutional, course, contractual, and
   product constraints.
5. **Action and workflow** — draft, review, confirmation, execution, receipt,
   recovery, and reconciliation.
6. **Integration gateway** — bounded external-system contracts, health,
   idempotency, fallback, and revocation.
7. **Trust and evidence** — audit events, controls, evidence, claims, incidents,
   and approvals.
8. **Experience and accessibility** — coherent interaction patterns, accessible
   alternatives, errors, degraded behavior, and support routes.

Capabilities must not create private substitutes for a primitive. A module may
own its domain write model, but it consumes shared primitives through stable
interfaces and does not read another module's private tables directly.

## 6. Capability maturity

The canonical maturity vocabulary is:

| Level | Name | Meaning |
| ---: | --- | --- |
| L0 | Vision | Product thesis only |
| L1 | Designed | Requirements, boundaries, threat model, data model, UX, and policy are approved |
| L2 | Built | Code, schema, configuration, permissions, and interfaces exist |
| L3 | Verified | Automated, manual, security, accessibility, failure, load, and migration tests required by the capability pass |
| L4 | Institution-ready | Support, documentation, governance, evidence, training, monitoring, rollback, and implementation materials exist |
| L5 | Tenant-approved | One tenant's contract, scope, configuration, data map, and accountable approvals are current |
| L6 | Parallel run | The capability operates beside the authoritative system and reconciles outcomes |
| L7 | Bounded system of record | Semester is authoritative for one explicitly scoped workflow |
| L8 | Tenant GA | The agreed institutional population is operationally supported |
| L9 | Repeatable | Activation is reusable across institutions with tested templates and evidence |

A capability's product maturity and a tenant's activation maturity are related
but distinct. Repository work may advance a product to L3 or L4. It cannot
produce a tenant's contract, institutional approval, parallel-run result, or
go-live authorization by itself.

## 7. Risk and activation classes

Capabilities use three activation classes:

- **Standard:** reversible, low-impact functionality with no official write or
  sensitive institutional decision. A feature flag, entitlement, policy, and
  ordinary authorization may be sufficient.
- **Controlled:** institutional data, sensitive reads, consequential drafts,
  or scoped workflows. Requires tenant policy, current evidence, accountable
  ownership, monitoring, support, and an approved rollout.
- **High-risk:** official writes, systems of record, grades, registration,
  payments or funds movement, regulated student services, broad exports, or
  autonomous action. Requires the complete domain-specific activation contract.

The following remain high-risk regardless of UI or implementation maturity:
SIS replacement, native LMS replacement, official registration writes,
gradebook passback, institutional tuition or aid processing, payroll and HR,
health/counseling/disability/conduct/emergency workflows, parent or guardian
record access, predictive student-risk decisions, marketplace payouts or funds
custody, and autonomous AI write authority.

## 8. Canonical capability definition

Each definition contains:

- stable capability ID, name, domain, description, and accountable owner role;
- platform primitives and domain dependencies;
- activation class and product maturity;
- data classifications, authorities, purposes, and retention references;
- required permissions, consent, approvals, and separation-of-duty rules;
- accessibility criteria and accessible fallback;
- required integrations, health conditions, reconciliation, and official fallback;
- evidence requirements with freshness rules;
- monitoring, support, incident, kill-switch, rollback, and offboarding requirements;
- public claim variants allowed at each maturity level;
- configuration schema and version compatibility;
- lifecycle state and replacement or sunset condition.

Stable identifiers survive wording changes. Removing or merging an identifier
requires an explicit compatibility mapping so evidence, audit history, and
customer commitments remain interpretable.

## 9. Components

### 9.1 Constitution registry

Holds the primitives and non-negotiable rules. It exposes stable identifiers
used by capability validation and documentation generation.

### 9.2 Capability registry

Holds canonical capability definitions and rejects duplicates, incomplete
high-risk definitions, unknown owners, unknown primitives, invalid maturity
transitions, and claims above maturity.

### 9.3 Activation policy engine

Evaluates a request using tenant, actor, purpose, capability, configuration,
entitlement, evidence, integration health, approvals, rollout, and kill-switch
state. It returns an allow, deny, or unmet-requirements decision. The first
slice evaluates policy; it does not itself execute domain actions.

### 9.4 Configuration ledger adapter

Normalizes the existing Configuration Studio's immutable versions and
draft/publish behavior for activation evaluation. Later work adds impact
preview and rollback UX without bypassing the current database controls.

### 9.5 Evidence and projection layer

Normalizes evidence dates, owners, scope, status, expiry, and artifact
references. It produces readiness, claims, procurement, and operational views
from the same decision model.

## 10. Activation decision flow

1. Receive a capability, tenant, actor, purpose, requested operation, and
   idempotency key.
2. Resolve the canonical capability definition.
3. Load the effective tenant configuration and applicable policy versions.
4. Verify identity, membership, authority, purpose, consent, and entitlement.
5. Evaluate product maturity and activation-class requirements.
6. Resolve current evidence, approvals, integration health, support coverage,
   rollout state, and kill switches.
7. Return:
   - `allow`, with the governing versions and bounded operation;
   - `deny`, with a safe reason code; or
   - `unmet_requirements`, with actionable non-sensitive requirements.
8. Record the decision inputs by reference, policy version, outcome, and safe
   reason. Sensitive evidence content is not copied into general audit logs.

Domain services remain responsible for rechecking action-specific state at
execution time. An activation allowance is not a permanent credential and
does not replace transaction-level authorization, idempotency, or authoritative
readback.

## 11. High-risk activation contract

A high-risk capability cannot activate until its definition names and the
tenant satisfies all applicable requirements in these categories:

- executed agreement, DPA, scoped statement of work, and accountable owners;
- approved data authority, classification, retention, correction, export, and
  offboarding map;
- tenant configuration, role and purpose rules, consent, and separation of duty;
- accessible workflow and fallback;
- sandbox connection, source mapping, security validation, idempotency,
  concurrency, duplicate, failure, and reconciliation tests;
- migration, parallel run, rollback, archive, and last-known-good procedures;
- monitoring, SLOs, alerting, incident contacts, support coverage, and tested
  kill switch;
- staff training, UAT, staged rollout, and signed go-live authorization;
- truthful Product Status Map and public-claim review.

Requirements are domain-specific. Registration, gradebook, payments, AI, and
health workflows do not share a generic checkbox that erases their distinct
risks.

## 12. Failure and degraded behavior

- Missing or ambiguous capability definition: deny and report a registry defect.
- Missing tenant configuration: deny controlled and high-risk operations;
  standard features may use an explicitly declared safe default.
- Expired or revoked evidence/approval: block new actions and follow the
  capability's documented continuity or rollback behavior.
- Required integration unhealthy or stale: stop official reads or writes,
  label cached information, and provide the official fallback.
- Kill switch active: override entitlement, approval, rollout, and ordinary
  feature flags.
- Projection disagreement: fail the consistency check; do not publish the
  higher claim.
- Audit sink unavailable for an auditable action: deny rather than execute
  without a record.
- Existing active workflow loses a prerequisite: follow its declared degraded
  mode; do not silently revoke access in a way that risks data loss.

Denial messages remain useful without exposing private evidence, another
tenant's configuration, security findings, or secrets.

## 13. Verification strategy

Implementation follows red-green-refactor TDD. At minimum, tests prove:

1. An ordinary feature flag cannot activate a high-risk capability.
2. One tenant's approval, evidence, entitlement, or configuration cannot
   authorize another tenant.
3. Missing, expired, superseded, or revoked evidence prevents activation.
4. Duplicate requests and replayed approvals remain idempotent.
5. Kill switches override every positive input.
6. Effective dates and rollback reproduce historical configuration decisions.
7. Claims cannot exceed verified product and tenant maturity.
8. Safe denial explanations omit sensitive evidence and cross-tenant data.
9. Every existing mapped registry row resolves to one canonical capability ID.
10. Unknown or conflicting mappings fail validation.
11. Generated readiness and claims documents match the executable model.
12. Existing registers retain their stable IDs and current evidence detail.

Focused tests run first. The relevant application test suite, register
generation checks, type checks, lint, and database policy checks run before
completion. Local database checks prove repository policy logic only; live
deployment, migration, tenant isolation, and end-to-end activation require
separate current evidence.

## 14. Delivery sequence

Each item is a separate Superpowers spec, plan, and implementation cycle:

1. Platform Constitution and Activation Control Plane.
2. Institution Configuration Studio impact preview and rollback experience.
3. Registration and SIS capability progression.
4. Native LMS capability progression.
5. Semester commerce and student-accounts progression with regulated payment
   processing boundaries.
6. Governed Hermes integration through the Semester AI Gateway.
7. Specialist-led regulated student-service domains.

The first cycle does not include the implementation of items 2 through 7.

## 15. Explicit exclusions

This design does not authorize:

- production deployment, database migration, feature activation, or secrets changes;
- signing agreements or representing institutional approval;
- declaring HECVAT, VPAT/ACR, SOC 2, penetration testing, or legal review complete;
- storing raw payment credentials or building card-network infrastructure;
- direct Hermes access to production databases, shell, filesystem, browser
  automation, unrestricted web access, or broad MCP servers;
- official SIS, LMS, registration, grade, financial, health, conduct, payroll,
  or autonomous-agent writes;
- public claims above the state supported by current evidence.

Those actions require their own authority, controls, evidence, and release decisions.
