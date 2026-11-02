# Shared contract stack

The seven contracts every Semester domain uses instead of its own ad hoc model,
and how far each one exists today. Each row cites the file that holds it and says
what is missing. Nothing here is marked done that the cited code does not show.

Status words: **exists** (in code, with a test), **partial** (some of it is in
code), **missing** (no shared artifact; prose at most).

## The seven contracts

| Contract | Where it lives | Status | Gap |
| --- | --- | --- | --- |
| Identity context | `packages/platform/src/tenancy/context.ts` (`RequestContext`, built from a verified identity; tenant is derived, never submitted) | exists | Used by the institution gateway only; no route outside it yet |
| Authority and provenance | `packages/platform/src/identity/affiliation.ts` (sources have a precedence order) | partial | No per-record authority block (owner, source system, observed-at, freshness) on a shared record type |
| Record envelope | none | missing | No shared `RecordEnvelope` type exists. Tenant, classification, lifecycle, version and generation are not enforced together on one object |
| Permission decision | `packages/platform/src/policy/engine.ts` (declared actions, deny by default); `packages/institution/src/policy.ts` (`decide()` for the three institution actions) | exists | No route calls the engine yet |
| Command contract | `packages/platform/src/gateway/command.ts` (`CommandEnvelope`, `CommandResult`) | exists | Declared and tested in memory; per `docs/platform/PRIMITIVES.md`, no route uses it yet |
| Event contract | `packages/institution/src/events.ts` (`SemesterEvent`, `makeEvent`, outbox); `packages/platform/src/events/emit.ts` | partial | Field names differ from the target shape (no `aggregateVersion`, `producer.releaseVersion` or per-event `classification` checked against the target). No registry file lists producers, consumers and classification per event |
| Evidence and audit | `packages/platform/src/identity/audit.ts` (append-only, hash-chained per tenant, redacted) | exists | Receipts for user-visible actions are not a shared contract yet |

## Rules that are not yet enforced

These are rules the target design states. Each one is checked against the code
it would have to live in.

- **Consent withdrawal increments an access generation.** `packages/platform/src/identity/consent.ts`
  has no generation field, and withdrawal does not enqueue a downstream
  revocation. Missing.
- **Restricted records carry a tenant before persistence.** Enforced for tenant
  scope in the repositories and the `TenantScope` type. Not enforced on a shared
  record envelope, because that does not exist.
- **Events are created only after the business state commits.** The institution
  outbox follows this (`docs/platform/EVENTS-AND-OUTBOX.md`). The platform
  `events/emit.ts` path is not yet shown to follow it.

## Artifacts named in the continuation brief and their status

| Artifact | Status | What exists instead |
| --- | --- | --- |
| Contract stack YAML (this page is the prose version) | missing | `docs/platform/PRIMITIVES.md` |
| Event catalogue registry (events, producers, consumers, classification) | missing | Event types are defined in code; no catalogue file |
| AI capability registry | missing | `docs/ai-governance/` (ten prose documents, including tool broker and model gateway) |
| Screen interface contract registry | missing | `docs/design-system/` and the design-system guide |
| Connector certification record | missing | Connector behaviour is described in `docs/platform/EVENTS-AND-OUTBOX.md` and `docs/platform/OPERATIONS.md` |
| Domain onboarding playbook (phased, checked) | missing | Phase list appears in `docs/platform/MIGRATION.md`, not as a checked artifact |
| Monthly operating review contract | missing | `docs/company/` holds planning documents, not a review contract |

## Order of the next code slices

Each slice is a code change with a test that fails before the change and passes
after it, and a revert check per `CLAUDE.md`. None of them is done by this page.

1. **Consent generation.** Add `accessGeneration` to the platform consent record,
   increment it on withdrawal, and emit a revocation job. Test: withdrawal from a
   grant at generation *n* leaves a live delegated session at generation *n*
   invalid.
2. **Record envelope.** Add the `RecordEnvelope<T>` type with the authority block,
   and a conformance test that a restricted record without a tenant is refused
   before persistence.
3. **Event registry.** Add a checked catalogue for the events already emitted,
   with producer, consumers and classification, and a test that every emitted
   event type is listed.
4. **Connector certification record** and **screen contract** as checked files,
   once a first connector and a first screen are chosen to certify.

Items 5 onward (AI capability registry enforcement, domain onboarding for advising
or degree planning, company operating reviews) need product decisions that are not
in the repository. They stay open until those decisions are recorded.

## What this page does not claim

- It does not claim that any contract is adopted by a user-facing route.
- It does not claim that the institution and platform event paths are one path.
- It does not establish a deployment. No deployment target for this stack was
  verified from this session.
