---
stale-refs:
  - source: MIGRATION-HISTORY.md
    changed_at: "2026-10-19T02:53:16"
    sections_changed: []
    summary: externally modified
  - source: SECRETS.md
    changed_at: "2026-10-21T02:32:34"
    sections_changed: []
    summary: externally modified
  - source: docs/ARCHITECTURE.md
    changed_at: "2026-10-21T01:38:54"
    sections_changed: []
    summary: externally modified
  - source: docs/FEATURE-FLAG-REGISTRY.md
    changed_at: "2026-10-21T01:38:55"
    sections_changed: []
    summary: externally modified
  - source: docs/guides/integrations/README.md
    changed_at: "2026-10-21T01:39:04"
    sections_changed: []
    summary: externally modified
  - source: docs/reference/ANALYTICS-MARKS.md
    changed_at: "2026-10-21T02:32:37"
    sections_changed: []
    summary: externally modified
  - source: docs/reference/API-GATEWAY.md
    changed_at: "2026-10-21T02:32:37"
    sections_changed: []
    summary: externally modified
  - source: docs/reference/AUTH-AND-LIMITS.md
    changed_at: "2026-10-21T02:32:37"
    sections_changed: []
    summary: externally modified
  - source: docs/reference/CONFIGURATION.md
    changed_at: "2026-10-21T01:39:12"
    sections_changed: []
    summary: externally modified
  - source: docs/reference/EDGE-FUNCTIONS.md
    changed_at: "2026-10-21T01:39:12"
    sections_changed: []
    summary: externally modified
  - source: docs/reference/ERRORS.md
    changed_at: "2026-10-21T02:32:37"
    sections_changed: []
    summary: externally modified
  - source: docs/reference/EVENTS.md
    changed_at: "2026-10-21T02:32:37"
    sections_changed: []
    summary: externally modified
  - source: docs/reference/SCIM-API.md
    changed_at: "2026-10-21T01:39:12"
    sections_changed: []
    summary: externally modified
---


























































# Reference

> **Type:** reference · **Audience:** partner-developers, implementers · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/docsystem.test.ts`

The exact facts about what Semester exposes: routes, errors, events, functions
and configuration. If you are building against the gateway or consuming its
events, start here; if you want to be walked through it, start with the
[integration guides](../guides/integrations/README.md).

Each page below is either rendered from the code by a test or checked against it
by one, so a route, code or event that exists and is missing from the page — or
the reverse — fails the build. The card on each page says which.

## The institution gateway

| Page | What it settles |
| --- | --- |
| [Gateway API](API-GATEWAY.md) | Every route, method, request and response, with real examples |
| [Authentication and limits](AUTH-AND-LIMITS.md) | How a request is authenticated, rate limited and sized; read-only mode |
| [Errors](ERRORS.md) | The error envelope and every code, with whether it can be retried |
| [SCIM provisioning API](SCIM-API.md) | The SCIM 2.0 surface as implemented, and what is not |
| [OpenAPI description](openapi/institution-gateway.openapi.yaml) | The same routes as a machine-readable file |

## Events and data

| Page | What it settles |
| --- | --- |
| [Events](EVENTS.md) | The event envelope, every event type with its version, classification and retention, and the outbox rules |
| [Event JSON Schemas](schemas/events/) | The envelope and per-type constants as JSON Schema files |
| [Registration-readiness workflow](registration-readiness-workflow.md) | Evaluation states, idempotent receipts, reconciliation generations and the persistence adapter contract |
| [Analytics marks](ANALYTICS-MARKS.md) | The three marks sent to a server, and the events that are only defined |

## Platform

| Page | What it settles |
| --- | --- |
| [Edge functions](EDGE-FUNCTIONS.md) | Each Supabase function: purpose, auth, inputs, outputs, environment, status |
| [Configuration](CONFIGURATION.md) | Every environment variable the server code reads, by name, never by value |

## What this section does not cover

- **Secrets and their values.** Where each lives and how it is rotated is
  [`SECRETS.md`](../../SECRETS.md).
- **The database schema.** Migrations are in `supabase/migrations/`, and
  [`MIGRATION-HISTORY.md`](../../MIGRATION-HISTORY.md) says what they are and
  are not evidence of.
- **Feature flags.** [`FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md)
  is the register, with owners and rollbacks.
- **The app's internal state and screens.** Those are not an interface anyone
  builds against; see [`ARCHITECTURE.md`](../ARCHITECTURE.md).
