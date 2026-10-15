# Isolation is per layer, and a suite that cannot fail proves nothing

**Status:** Accepted for the **contract**. **No real adapter exists**; isolation for
any layer is evidence only after the suite has run against the real service.

## Decision

Each layer — api, database, object storage, queue, cache, search, analytics, support
tools, AI retrieval — has its own port with the tenant boundary **inside** it and a
control in `ISOLATION_CONTROLS`. A single conformance suite (`isolationCases`) of
plain throwing functions runs *write as tenant A, try as tenant B* with the **same
person id in both tenants**, each paired with a positive control. The memory
adapters pass it; **seven deliberately leaky adapters must make it go red, for the
layer they break and only that layer.**

## Why

RLS protects the database and nothing else, and a leak in the cache or the queue is
the same incident. [`multi-tenant-isolation.md`](../../architecture/multi-tenant-isolation.md)
says it: verify "across all layers, not only database RLS". The realistic bug is not
a stranger but an id that exists in two tenants. And this repository's own rule
(`CLAUDE.md`) is that a guard that has never failed is not known to be a guard — two
tests here once passed against a faithful revert of the bug they were for.

## What it was chosen over

- **RLS plus convention for the other layers:** that is the status quo.
- **Mocks of each real service:** prove the mock.
- **A suite tied to one test runner:** cases that throw run under vitest, a CI job
  against a real container, or a script.
- **Claiming isolation from the reference adapters:** rejected in `ISOLATION.md`'s
  first paragraph. They model the contract.

## How it is held

`packages/platform/src/isolation/isolation.test.ts` (memory adapters pass; each leaky
adapter fails exactly its layer; every layer has a control and ≥ 2 cases),
`packages/platform/src/testing/conformance.ts`, and the architecture test that every
control names a file that exists.

## What this constrains

A new layer (a CDN, a vector store, a provider that keeps message bodies) gets a row
in the matrix and a case in the suite **before** it holds tenant data. A real adapter
is accepted only when it passes `isolationCases` against the real service. No public
isolation claim for a layer until that has run.
