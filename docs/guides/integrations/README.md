# Integration guides

> **Type:** reference · **Audience:** implementers, partner-developers · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/examples.test.ts`

The index of walk-throughs for people who build the other side of a Semester integration, each tied to a runnable example; stop reading if you use the app as a student or run a school's rollout (see the runbooks linked from [Which integration path do I want?](which-integration-path.md)).

**Status:** `MOCK_DEMO` for the gateway and `PLANNED` for real school connectors. Every guide says its own state in its first screen, and every example runs in-process against real code with invented data. Nothing here connects to a real institution.

## Start here

[Which integration path do I want?](which-integration-path.md) maps SSO, SCIM, LTI, a SIS adapter, events, calendar feeds and the browser extension to the right guide or runbook, with each path's status from the truth table.

## The guides

| Guide | You are | Example | State |
| --- | --- | --- | --- |
| [Call the institution gateway](gateway-client.md) | A partner or app calling a gateway | [`gateway-client`](../../../examples/gateway-client/README.md) | `MOCK_DEMO` |
| [Provision users over SCIM](scim-provisioner.md) | An identity provider pushing accounts | [`scim-provisioner`](../../../examples/scim-provisioner/README.md) | `IMPLEMENTED_NOT_RELEASED` |
| [Consume events](event-consumer.md) | A module reacting to events | [`event-consumer`](../../../examples/event-consumer/README.md) | `IMPLEMENTED_NOT_RELEASED`; one producer, mounted nowhere |
| [Write a SIS adapter](sis-adapter.md) | An integrator at a school | [`sis-adapter`](../../../examples/sis-adapter/README.md) | `PLANNED` |

## How these pages stay true

- Each guide quotes the example's source in fenced blocks, each preceded by a marker comment that names the file. `app/src/lib/docs/examples.test.ts` checks that the block appears in that file byte for byte, and that each printed output equals what the example prints when the test runs it.
- The test runs every example against the real gateway, SCIM service and event code.
- To change an example, edit the code, then update the guide block the test names.

## Reference pages

These pages hold the wire formats and are written separately:

- [`docs/reference/API-GATEWAY.md`](../../reference/API-GATEWAY.md)
- [`docs/reference/SCIM-API.md`](../../reference/SCIM-API.md)
- [`docs/reference/ERRORS.md`](../../reference/ERRORS.md)
- [`docs/reference/EVENTS.md`](../../reference/EVENTS.md)

The code is in [`examples/`](../../../examples/README.md).
