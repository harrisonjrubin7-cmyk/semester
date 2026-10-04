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
