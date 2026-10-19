# Example: SIS adapter

> **Type:** reference · **Audience:** implementers, institution-admins · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/examples.test.ts`

A skeleton institution adapter backed by a fake student information system, for the person at a school who connects a real system; stop reading if you only call the gateway (see [`gateway-client`](../gateway-client/README.md)).

**Status:** `PLANNED` for real connectors. The truth table lists SIS and catalog connectors as `PLANNED` and `BLOCKED` on a school-approved, credentialed adapter, and `ADAPTERS = []` in both registries ([`docs/FEATURE-TRUTH-TABLE.md`](../../docs/FEATURE-TRUTH-TABLE.md)). This skeleton connects to nothing real; its "SIS" is an in-memory class.

## What is here

| File | Purpose |
| --- | --- |
| [`adapter.ts`](adapter.ts) | `advisingAdapter`: the contract implemented for the `advising` area. |
| [`fake-sis.ts`](fake-sis.ts) | `FakeSis`: students, holds, slots, bookings, an idempotency key lookup, and switches that stage a lost response and an outage. |

## What it shows

- `status`: asked on every call, never cached.
- `list` and `get`: pages with an opaque cursor; a record the account cannot see does not exist.
- `review`: every check that could refuse the action, with no write and no reservation.
- `execute`: re-checks at the write boundary and passes the review id to the SIS as its idempotency key.
- `reconcile`: finds an operation by that key without repeating it.
- The refusal path: a `Refusal` carries a sentence for the person and asserts that nothing was written. Any other exception is flattened by the gateway into one generic sentence.

The example declares the adapter interface locally, because an example may not import from `app/`. The test hands the adapter to the real `createGateway`, so TypeScript fails if the real interface gains a required member, and a second check fails if the method lists drift.

## Run it and read it

```bash
cd app
npx vitest run src/lib/docs/examples.test.ts -t "sis-adapter"
```

Walk-through: [Write a SIS adapter](../../docs/guides/integrations/sis-adapter.md). The real interface: `app/server/institution/adapter.ts`.
