# Database checks

Each file runs a module's migration and its rule checks inside one transaction that always ends by raising
`RESULT pass=N fails=M [...]`, so nothing is ever committed. Run one with the Zite one-off script runner
(app `jeabiv2536`): `import { run } from './dbchecks/facilities'; await run();`

A check row counts as passed only when it is exactly TRUE; NULL counts as failed (`ok IS NOT TRUE`).
Earlier checks (IT help, Library, Parking, Inventory) were run with a counter that ignored NULL rows and their
scripts were not kept; re-running them with this counting is open in docs/execution/NEXT_ACTIONS.md.
