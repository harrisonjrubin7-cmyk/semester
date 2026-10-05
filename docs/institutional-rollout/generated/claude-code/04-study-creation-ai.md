# Packet 04 — Study, creation and governed AI

**Execution order:** 04 of 08  
**Status:** implementation handoff

## Objective

Implement study, creation and governed ai as a bounded increment in the existing Semester repository without deleting or silently repurposing a working capability. Fetch and inspect current `main` before editing.

## Outcomes

- A repository-backed implementation with explicit current, sandbox and external-gate status.
- Deterministic tests and operator evidence for the affected boundary.
- No regression to routes, stored data, offline behavior or the approved information architecture.

## Requirement IDs

CAP-025–CAP-040, CAP-056–CAP-057

## Dependencies

03-capture-planning-provenance

## Repository areas

app/src/ai; app/src/screens; app/src/lib; supabase/functions

## Security, privacy and accessibility constraints

Enforce tenancy and resource authorization server-side; minimize data; log privileged actions without sensitive payloads; keep presentation roles non-authoritative; preserve keyboard, screen-reader, contrast, reflow and reduced-motion behavior; never represent sample data as real.

## Tests-first steps

1. Reproduce the current behavior and write a failing contract test.
2. Add isolation, negative-permission, accessibility and migration cases before implementation.
3. Implement the smallest compatible change.
4. Mutation-check the highest-risk guard, then restore it.

## Verification commands

`cd app && npm run test`  
`cd app && npm run build`  
`cd app && npm run lint`  
Run the applicable disposable-database probe and browser smoke for this packet.

## Migration and rollback

Use additive schema changes, backfill in bounded batches, prove old-client compatibility, record reversible application steps, and rehearse rollback against a disposable copy before production. Never remove or reinterpret existing data until readback and rollback evidence are approved.

## Definition of complete

Code, schema, tests, documentation, telemetry, migration rehearsal and rollback evidence all pass in the intended environment. External integrations remain externally gated until credentialed authoritative readback succeeds.

## Evidence return format

Return commit SHA, changed paths, requirement IDs, test commands and results, migration and rollback evidence, screenshots or API readback where applicable, known risks, external gates, and a direct statement of what was not verified.

## Stop conditions

Stop when the approved architecture, data safety, tenant isolation, capability preservation or truthful external verification cannot be maintained.
