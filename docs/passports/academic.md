# Academic system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Provide a source-aware course and term experience while official catalog, section and transcript authority stays explicit.

## System relationship

- `native`
- `connected`
- `orchestrated`
- `embedded`
- `linked`

## System of record

Semester owns:

- Course workspace
- student planning overlays
- course-material organization
- workflow projections

External authority remains:

- Official catalog
- SIS course and section record
- LMS course authority
- transcript authority

## Authority

- Students organize personal course context.
- Faculty control instructor-owned course content.
- Registrars control official catalog and academic records.

## Records

- `course_workspace`
- `term`
- `course_projection`
- `section_projection`
- `academic_record_reference`

## Commands

- `create_workspace`
- `import_course`
- `update_personal_course`
- `request_record_correction`

## Events

- `course.imported`
- `course.updated`
- `source.changed`
- `record.correction_requested`

## Integrations

- SIS
- LMS
- catalog
- document service

## Workflows

- Course import
- Course change review
- Academic-record correction
- Term rollover

## Screens

- Courses
- Course detail
- Term deadlines
- School records

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Source and mapping version
- Faculty/student/registrar authority
- Date and content changes
- Official handoff

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Academic platform
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Policy refusal trend
  - Stale-source threshold
  - Workflow failure or reconciliation backlog
- Runbook: `docs/runbooks/academic.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.academic.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`, `integrations`
- Capability rows: `CAP-020`, `CAP-022`, `CAP-023`, `CAP-024`, `CAP-045`

## External activation gates

- Approved SIS/LMS/catalog sources
- Course-membership authorization
- Mapping and reconciliation evidence
