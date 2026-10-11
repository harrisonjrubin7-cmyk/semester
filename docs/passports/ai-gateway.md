# AI Gateway system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Authorize retrieval and model use, preserve source proof and keep all consequential decisions with accountable people.

## System relationship

- `native`
- `connected`
- `orchestrated`

## System of record

Semester owns:

- Policy evaluation
- authorized retrieval
- model routing
- output provenance
- spend and refusal receipts

External authority remains:

- Approved model providers
- course and institution policy
- source-system access decisions

## Authority

- Users request assistance within purpose and consent.
- Policy owners approve models and use cases.
- AI may draft or explain but may not approve or execute consequential actions.

## Records

- `ai_request`
- `retrieval_receipt`
- `model_route`
- `ai_output`
- `evaluation_record`

## Commands

- `authorize_ai_request`
- `retrieve_sources`
- `route_model`
- `record_feedback`
- `disable_provider`

## Events

- `ai_request.allowed`
- `ai_request.refused`
- `model.routed`
- `output.created`
- `provider.disabled`

## Integrations

- Approved model providers
- Documents
- Academic
- Consent

## Workflows

- Request authorization
- Source retrieval
- Model routing and fallback
- Human review
- Provider incident

## Screens

- Semester Tutor
- AI source details
- Policy administration
- Evaluation and spend

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Purpose, consent and policy version
- Source references and classification
- Model/provider/version
- Refusal and human review

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: AI governance and platform engineering
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Kill-switch failure
  - Policy bypass attempt
  - Provider incident
  - Spend threshold
- Runbook: `docs/runbooks/ai-gateway.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.ai-gateway.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`, `consent`, `documents`, `operations`
- Capability rows: `CAP-027`

## External activation gates

- Approved provider and data terms
- Evaluation threshold and red-team evidence
- Kill switch and spend limits
