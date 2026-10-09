# Semester Education OS current-state audit

> **Type:** explanation · **Audience:** contributors, implementers · **Owner:** `engineering` · **Truth:** reviewed · **Reviewed:** 2026-10-08 · **Held by:** —

Assessed: 2026-10-08

Repository baseline: `55adab11` (`origin/main`)

Scope: the two supplied Education OS outline PDFs, reconciled against the current repository rather than treated as implementation authority.

This is a revision-bound audit snapshot, not a new source of planning authority. The canonical dependency order remains [`docs/product/EDUCATION_OS_BACKLOG.md`](../product/EDUCATION_OS_BACKLOG.md); the current launch verdict remains [`docs/LAUNCH-READINESS-COUNCIL.md`](../LAUNCH-READINESS-COUNCIL.md).

## Executive finding

The PDFs assume that Semester still needs an initial platform scaffold. That assumption is no longer accurate. Current `main` is already a large modular monolith with a student application, institutional gateway and policy package, database migrations and negative SQL checks, workflow primitives, operations surfaces, a typed 60-capability rollout inventory, evidence-gated exposure decisions, and extensive documentation.

The correct next move is therefore **convergence**, not a second monorepo or a second capability catalog. Existing canonical sources must be extended:

- product capability inventory: `app/src/lib/rollout-capabilities.ts`;
- runtime exposure: `app/src/lib/governance/capability-exposure.ts` and release profiles;
- institution authorization and obligations: `packages/institution/src/policy.ts`;
- component/control-plane definitions: `packages/institution/src/registry.ts` and `docs/control-plane/`;
- student registration planning/readiness: `app/src/lib/registration-day.ts`, `app/src/lib/path-readiness.ts`, and `app/src/components/RegistrationReadiness.tsx`;
- governed registration transaction demonstration: `app/server/institution/registration.ts`;
- database controls and verification: `supabase/migrations/` and `supabase/*.check.sql`.

Repository implementation is not evidence of an approved or operating institution deployment. The current adapter remains an explicitly labeled sandbox; no institutional approval, tenant credential, live SIS connection, production UAT, staffed support operation, or observed outcome was established by this audit.

## What is already implemented in repository source

| Area | Evidence on current `main` | Assessment |
| --- | --- | --- |
| Capability governance | 60 typed capabilities with destinations, phase, owner, dependencies, acceptance criteria, evidence and disposition | Implemented as repository governance; not proof of live exposure |
| Exposure control | Evidence-, target-, entitlement-, connection- and kill-switch-aware exposure resolver | Implemented foundation; production evidence remains target-specific |
| Identity and contextual access | Tenant, membership, role-grant, capability, purpose and correlation context in institution policy/access saga | Implemented foundation; live provider and tenant operation remain external |
| Authorization | Central policy actions, deny reasons, field-limiting obligations, audit obligations and negative tests | Implemented for covered actions; not yet one universal enforcement point for every legacy surface |
| Audit and events | Typed institutional events, correlation IDs, SQL audit/outbox controls and evidence documentation | Substantial implementation; independent assurance and production durability evidence remain open |
| Registration readiness | Student checklist, blocker/conflict handling, source-aware school-record view, advisor/registrar policy relationships and tests | Repository vertical slice exists; official SIS-backed readiness is not active |
| Registration transaction | Two-phase sandbox adapter, holds, prerequisites, conflicts, seats, waitlist, receipts, idempotency and reconciliation tests | Complete sandbox demonstration; deliberately not an institutional enrollment system |
| Workflow primitives | Versioned workflow definitions, state guards, access saga, durable-store migrations and tests | Implemented foundation; registration-readiness is not yet one end-to-end durable institutional workflow |
| UI system | Established Semester semantic tokens, shared components, recovery states, accessibility and responsive contracts | Implemented and must be reused |
| Operations/governance | Operations console, release profiles, evidence registers, readiness and claims controls | Broad repository implementation; staffing and observed operations remain external gates |

## First milestone disposition

The PDFs require this first vertical slice:

> student signs in → selects institution/term → checks registration readiness → sees holds/prerequisites/conflicts → routes to advisor/registrar → receives an official handoff/receipt

Current source covers the student-owned planning/readiness path, centralized policy decisions for student/advisor/registrar relationships, and a receipt-bearing sandbox registration path. It does **not** yet prove the complete official flow because:

1. no approved live SIS registration-readiness adapter is configured;
2. the student readiness component primarily evaluates application/local planning data rather than a single server-issued governed readiness projection;
3. advisor and registrar experiences exist in several separate surfaces rather than one end-to-end readiness case queue;
4. no real tenant UAT, institutional reconciliation result, or production support evidence is present;
5. production deployment of this exact commit was not verified in this audit.

The milestone is therefore **repository-partial, operationally blocked by external authority and integration evidence**. Building another mock screen would not close it.

## Architectural decision

Keep the current modular monolith. Do not create the PDF's proposed parallel `apps/student-web`, `apps/staff-web`, and `services/*` tree merely to resemble the outline. Split a service only when ownership, availability, scale, or data-boundary evidence requires it. New work must reuse current contracts, design tokens, policy, event, audit, exposure and test systems.

## Immediate implementation sequence

1. Define one server-issued registration-readiness projection contract that carries tenant, subject, term, authority, source references, freshness, version and field-level visibility.
2. Route student, assigned-advisor and authorized-registrar reads through `packages/institution` policy evaluation and apply returned obligations before serialization.
3. Persist a durable readiness evaluation/request workflow with idempotency, audit event, receipt, stale/unknown states and a reconciliation task.
4. Replace only the readiness component's data seam—not its Semester UI—with the governed projection behind a feature flag; retain local planning as an explicit fallback.
5. Add advisor/registrar queue projections and negative cross-tenant/relationship tests.
6. Activate a real connector only after tenant approval, credentials, mappings, rollback, support and UAT evidence exist.

## Evidence boundaries

- `verified` in the rollout inventory means repository evidence satisfies that inventory's acceptance statement. It does not mean generally available, deployed, institution-approved or operationally staffed.
- A public institutional URL or data pack is not a connection.
- Sandbox enrollment is not enrollment at an institution.
- Generated documentation, tests and migrations are not production execution evidence.
- All claims of deployment, reliability, accessibility conformance, legal approval, security assurance and institutional use remain separate release gates.
