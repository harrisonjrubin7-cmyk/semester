# Career system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Maintain student-controlled evidence and application planning with explicit consent and no invented eligibility or outcomes.

## System relationship

- `native`
- `connected`
- `orchestrated`
- `linked`

## System of record

Semester owns:

- Career profile
- confirmed skills
- application plans
- portfolio shares

External authority remains:

- Employer ATS
- career-center verification
- credential issuers

## Authority

- Students confirm and share their evidence.
- Institution staff verify only within authorized scope.
- Employers decide applications externally.

## Records

- `experience`
- `skill`
- `artifact`
- `application_plan`
- `portfolio_share`

## Commands

- `add_evidence`
- `confirm_skill`
- `request_verification`
- `share_portfolio`
- `track_application`

## Events

- `evidence.added`
- `skill.confirmed`
- `verification.requested`
- `portfolio.shared`

## Integrations

- Career center
- credential provider
- employer ATS links

## Workflows

- Evidence confirmation
- Verification request
- Portfolio sharing
- Application planning

## Screens

- Career
- Opportunities
- Applications
- People and letters
- Pathway

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Evidence source
- Student confirmation
- Consent and share expiry
- Verification disposition

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Career platform
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Policy refusal trend
  - Stale-source threshold
  - Workflow failure or reconciliation backlog
- Runbook: `docs/runbooks/career.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.career.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `consent`, `documents`
- Capability rows: `CAP-052`, `CAP-053`, `CAP-054`, `CAP-055`

## External activation gates

- Career-center scope
- Employer sharing consent
- No automated eligibility or submission
