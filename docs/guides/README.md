---
stale-refs:
  - source: docs/guides/institution/README.md
    changed_at: "2026-10-19T02:23:41"
    sections_changed: []
    summary: externally modified
  - source: docs/guides/integrations/README.md
    changed_at: "2026-10-19T02:14:28"
    sections_changed: []
    summary: externally modified
  - source: docs/reference/README.md
    changed_at: "2026-10-19T02:14:29"
    sections_changed: []
    summary: externally modified
  - source: examples/README.md
    changed_at: "2026-10-19T02:14:30"
    sections_changed: []
    summary: externally modified
---


















# Guides

> **Type:** how-to · **Audience:** institution-admins, implementers, partner-developers · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/docsystem.test.ts`

Task-shaped walkthroughs for the people who adopt and integrate Semester. Pick
the one that matches who you are; each links to the reference or runbook that
holds the detail instead of repeating it.

| If you are… | Open | It covers |
| --- | --- | --- |
| A campus administrator or implementer | [Institution guides](institution/README.md) | Adopting, configuring, running and leaving Semester: roles, configuration, SSO, SCIM, LTI, data, change management |
| A developer or an integrator | [Integration guides](integrations/README.md) | Which integration path to choose, and four worked, tested examples: a gateway client, a SCIM provisioner, an event consumer and an SIS adapter |

The runnable code behind the integration guides is in
[`examples/`](../../examples/README.md). Every sample a guide quotes is checked
byte for byte against that code by a test.

Facts a guide mentions — a route, an error code, an event — are defined in the
[reference](../reference/README.md), and the guide links there rather than
repeating the value.
