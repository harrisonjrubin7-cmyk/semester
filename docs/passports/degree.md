# Degree Planning system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Support source-linked what-if planning without presenting a projection as an official degree audit.

## System relationship

- `native`
- `connected`
- `embedded`
- `linked`

## System of record

Semester owns:

- What-if plans
- requirement projections
- student annotations
- comparison history

External authority remains:

- Official catalog year
- degree-audit engine
- registrar certification

## Authority

- Students edit plans.
- Advisors comment within assigned relationships.
- Registrars certify official requirements and exceptions.

## Records

- `degree_plan`
- `requirement_projection`
- `catalog_reference`
- `exception_reference`

## Commands

- `create_plan`
- `compare_plan`
- `request_review`
- `import_requirements`

## Events

- `plan.changed`
- `requirements.imported`
- `review.requested`

## Integrations

- Catalog
- SIS
- official degree audit

## Workflows

- Requirement import
- What-if comparison
- Advisor review
- Official handoff

## Screens

- Degree plan
- Graduation simulator
- Requirement detail
- Advisor review

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Catalog and source version
- Assumptions and unresolved mappings
- Reviewer comments
- Official handoff

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Academic records and advising
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Policy refusal trend
  - Stale-source threshold
  - Workflow failure or reconciliation backlog
- Runbook: `docs/runbooks/degree.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.degree.enabled`

## Dependencies and capability coverage

- System dependencies: `academic`, `integrations`
- Capability rows: `CAP-044`

## External activation gates

- Registrar-certified requirement map
- Catalog-year validation
- Explicit non-certification copy
