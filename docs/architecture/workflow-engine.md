# Workflow engine

Status: partial implementation; definition builder exists, universal runtime does not.

## Verified foundation

`workflow_versions`, a closed typed specification, validation, maker/checker publication, RLS and audit exist. Domain-specific state machines also exist for tenant rollout, reconciliation, community cases, dining and institutional sandbox flows. The workflow-builder migration explicitly stores definitions, not student workflow instances.

## Canonical runtime contract

A workflow definition has typed states, allowed transitions, actors/scopes, eligibility facts, policy checks, approvals, timers/escalations, notifications, compensation, evidence and reporting. An instance binds definition version, tenant, subject/resource, current state, source authority, assigned actors, deadlines and correlation ID. Transition commands are idempotent, server-authorized and append an immutable transition receipt.

## Gap

There is no one general instance/execution service spanning onboarding, guardian consent, institution provisioning, connector setup, marketplace review, support, data rights, billing and incident response. Domain-specific state machines must remain until migrated behind compatibility adapters; a large replacement migration would be unsafe.

## First implementation boundary

Add no high-risk workflow first. Prove the engine with an internal, reversible approval flow: versioned definition, instance, transition receipt, timeout, denial, audit, metrics and replay. Then migrate one existing state machine at a time with equivalence tests. Consequential external writes still require their provider receipt and cannot be inferred from workflow completion.

