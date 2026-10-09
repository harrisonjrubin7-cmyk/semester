# Workflow engine

Status: partial implementation; a generic in-memory runtime and definition builder exist, but durable production wiring and cross-domain adoption do not.

## Verified foundation

`packages/platform/src/engines/workflow.ts` provides a tenant-scoped generic `WorkflowRuntime` and `WorkflowInstance` with optimistic concurrency, legal-transition enforcement, and append-only history. The access saga adds a runner with durable audit/outbox persistence. `workflow_versions`, a closed typed specification, validation, maker/checker publication, RLS and audit also exist, alongside domain-specific state machines for tenant rollout, reconciliation, community cases, dining and institutional sandbox flows. The workflow-builder migration stores definitions, not a universal durable instance service.

## Canonical runtime contract

A workflow definition has typed states, allowed transitions, actors/scopes, eligibility facts, policy checks, approvals, timers/escalations, notifications, compensation, evidence and reporting. An instance binds definition version, tenant, subject/resource, current state, source authority, assigned actors, deadlines and correlation ID. Transition commands are idempotent, server-authorized and append an immutable transition receipt.

## Gap

The generic runtime is not wired to durable production storage, timers/escalations, metrics, replay, or provider receipts, and it is not adopted across onboarding, guardian consent, institution provisioning, connector setup, marketplace review, support, data rights, billing, and incident response. Domain-specific state machines must remain until migrated behind compatibility adapters; a duplicate replacement runtime or large migration would be unsafe.

## First implementation boundary

Add no high-risk workflow first. Prove the engine with an internal, reversible approval flow: versioned definition, instance, transition receipt, timeout, denial, audit, metrics and replay. Then migrate one existing state machine at a time with equivalence tests. Consequential external writes still require their provider receipt and cannot be inferred from workflow completion.
