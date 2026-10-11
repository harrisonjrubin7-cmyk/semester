# Learning system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Create student-controlled, source-grounded study materials and formative practice without taking final assessment authority.

## System relationship

- `native`
- `connected`

## System of record

Semester owns:

- Study guides
- notes
- practice items
- mastery reflections
- reading progress

External authority remains:

- Instructor course policy
- official assignments and assessments
- LMS source material

## Authority

- Students create and revise study assets.
- Faculty set course and integrity policy.
- AI output remains draft until student review.

## Records

- `study_asset`
- `source_reference`
- `practice_attempt`
- `mastery_note`

## Commands

- `create_study_guide`
- `generate_practice`
- `record_attempt`
- `confirm_extraction`

## Events

- `study_asset.created`
- `practice.completed`
- `source.corrected`
- `extraction.confirmed`

## Integrations

- Academic
- Documents
- AI gateway
- LMS

## Workflows

- Multi-file study-guide generation
- Calendar extraction review
- Practice and reflection
- Source correction propagation

## Screens

- Study Studio
- Source locker
- Practice
- Exam runway

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Uploaded and connected sources
- Extraction confidence and confirmation
- AI model/policy version
- Student corrections

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Learning experience and AI governance
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Policy refusal trend
  - Stale-source threshold
  - Workflow failure or reconciliation backlog
- Runbook: `docs/runbooks/learning.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.learning.enabled`

## Dependencies and capability coverage

- System dependencies: `academic`, `documents`, `ai-gateway`
- Capability rows: `CAP-004`, `CAP-025`, `CAP-028`, `CAP-029`, `CAP-030`, `CAP-056`

## External activation gates

- Course policy and source authorization
- Model evaluation and kill switch
- No autonomous submission or grading
