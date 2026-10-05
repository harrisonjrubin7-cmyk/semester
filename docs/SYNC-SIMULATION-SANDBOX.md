# Sync simulation sandbox

Part 1, item 5. Phase 1a. **Waits for #779.** Nothing here is built yet.

## What exists on main

- `app/src/lib/institutional-preview.ts` and the demo tenants in
  `app/src/lib/flight-plan.ts` run institutional screens against invented data.
  That is a presentation sandbox; this part is a processing sandbox.
- `app/scripts/institutional-preview.mjs` builds that preview.

## In flight

#779's `lib/integration/mock-sis.ts` and `mock-adapter.ts` are the payload
source a simulation runs, and `pipeline.ts` is the code it runs them through.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `sync_simulations` | **New** | A named scenario: mapping version under test, fixture set, expected outcome |
| `simulation_runs` | **New**, in its own schema (`simulation`) | Physically separate from `integration_sync_runs`, so no production query, dashboard or action can read a simulated row by accident |

## Capabilities and flags

- **`integration:simulate`**, new, for school integration administrators and
  `implementation_manager`.
- Flag `integration.simulation`, `off`.

## Hard boundaries

- Input is fixtures and the mock SIS only. There is no code path from a
  simulation to a live adapter: the simulation runner takes a `MockAdapter`
  type, not the adapter interface, so the compiler refuses a live one.
- No writeback, ever, from a simulation.
- Simulated records never reach actions, analytics, notifications or the
  reconciliation dashboard. The separate schema is the guarantee; a test checks
  it.

## Tests

- The runner's type refuses a live adapter (a `// @ts-expect-error` test).
- After a simulation, every production table the pipeline writes has the same
  row count as before.
- The Action Center's source query cannot see the `simulation` schema
  (`.check.sql` as `authenticated`).
