# Developer Ecosystem system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Expose bounded APIs, webhooks and partner tools without bypassing Semester policy, tenancy or evidence requirements.

## System relationship

- `native`
- `connected`

## System of record

Semester owns:

- API client identities
- scopes
- webhook subscriptions
- sandbox state
- partner review records

External authority remains:

- Partner applications and infrastructure

## Authority

- Tenant administrators approve installations and scopes.
- Developers use only issued credentials and documented contracts.
- Semester security can suspend a client or webhook.

## Records

- `api_client`
- `api_scope`
- `webhook_subscription`
- `partner_review`
- `sandbox_tenant`

## Commands

- `create_api_client`
- `rotate_client_secret`
- `subscribe_webhook`
- `approve_partner`
- `suspend_client`

## Events

- `api_client.created`
- `credential.rotated`
- `webhook.delivered`
- `partner.approved`
- `client.suspended`

## Integrations

- API gateway
- Outbox
- developer portal
- partner systems

## Workflows

- Developer onboarding
- Credential rotation
- Webhook delivery and replay
- Partner review

## Screens

- Developer portal
- API credentials
- Webhook inspector
- Partner review
- Sandbox

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Tenant, client and scopes
- Credential rotation without secret logging
- Webhook attempts and signatures
- Partner approval

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Platform engineering and security
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Authentication abuse
  - Webhook failure rate
  - Scope escalation attempt
- Runbook: `docs/runbooks/developer-ecosystem.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.developer-ecosystem.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`, `integrations`, `operations`
- Capability rows: None directly; this is a shared or future system boundary.

## External activation gates

- Public API security review
- Rate limits and abuse response
- Partner terms and review process
