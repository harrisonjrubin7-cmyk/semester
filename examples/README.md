# Reference applications

> **Type:** reference · **Audience:** implementers, partner-developers · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/examples.test.ts`

Four small programs that talk to the institution gateway and its neighbours, for people who build the other side of the connection; stop reading if you only use the Semester app.

**Status:** `MOCK_DEMO`. Each example runs in-process against the real gateway, SCIM service or event code, with in-memory stores and invented data. No production adapter is installed anywhere ([`docs/FEATURE-TRUTH-TABLE.md`](../docs/FEATURE-TRUTH-TABLE.md)), so there is no deployed gateway for these programs to call yet.

## The examples

| Example | You are | What it shows | Guide |
| --- | --- | --- | --- |
| [`gateway-client`](gateway-client/README.md) | A partner or app calling a gateway | Bearer auth, correlation ids, record pages, the prepare, review, commit flow, reconcile on a 502, the error envelope, backoff | [Gateway client](../docs/guides/integrations/gateway-client.md) |
| [`scim-provisioner`](scim-provisioner/README.md) | An identity provider pushing accounts | Create, update, deactivate, filter and page users over SCIM 2.0, with idempotent retries | [SCIM provisioner](../docs/guides/integrations/scim-provisioner.md) |
| [`event-consumer`](event-consumer/README.md) | A module reacting to events | Validate the envelope, process once, retry, dead-letter, add an event type | [Event consumer](../docs/guides/integrations/event-consumer.md) |
| [`sis-adapter`](sis-adapter/README.md) | An integrator at a school | The adapter contract, backed by a fake in-memory SIS: records, a two-phase action, a refusal | [SIS adapter](../docs/guides/integrations/sis-adapter.md) |

Not sure which one you need? Read [Which integration path do I want?](../docs/guides/integrations/which-integration-path.md).

## Rules every example follows

- Plain Node 22 TypeScript with type stripping. No build step.
- Imports only `node:` builtins, other files in `examples/`, and `packages/institution/src`.
- No `package.json`, no `node_modules`, no new dependency. `examples/` is not in the root `package.json`'s `workspaces` list (`app` and `packages/*`), and having no `package.json` of its own keeps it out of any later glob.
- Each example is about 250 lines of code or fewer.

`app/src/lib/docs/examples.test.ts` holds all four rules by scanning the files.

## Run them

The examples have no entry point of their own. Their test drives each one against the real code it talks to:

```bash
cd app
npx vitest run src/lib/docs/examples.test.ts
```

The files also load under Node 22 on their own, with its default type stripping (checked with `import()` of each file from the repository root). They need the test only for the server side they call.

## What the test holds

- Every example is executed, and its outputs are asserted.
- Every guide quotes the example's source byte for byte. A guide that drifts fails the test and names the block.
- Every `README.md` here carries a valid card, and no example carries a `package.json`.
