# Database checks

Each file runs a module's migration and its rule checks inside one transaction that always ends by raising
`RESULT pass=N fails=M [...]`, so nothing is ever committed. Run one with the Zite one-off script runner
(app `jeabiv2536`): `import { run } from './dbchecks/facilities'; await run();`

A check row counts as passed only when it is exactly TRUE; NULL counts as failed (`ok IS NOT TRUE`).

Two rules for writing a check:
- Call the function in its own statement (`x := fn(...)`) and read the table in the next one. A subquery in the same
  statement as the call sees the row as it was before the call, which made IT help's F19b come back NULL.
- Include the returned text in the label (`'F19b ... ' || coalesce(x,'')`) so a failure says why.

Current results (26 Oct, all re-run with this counting): IT help 38/38, Library 33/33, Parking 34/34,
Inventory 37/37, Facilities 27/27, ID card 29/29, Records rights 30/30, Partners 25/25, Audit 38/38, Partner links 8/8, Continuing education 32/32, Design 22/22, HR 25/25, Recruiting 22/22, Procurement 28/28, Organizations 27/27, Aid office 20/20, Transition 27/27, Governance 26/26, Portfolio council 25/25, Residence life 23/23, Careers 29/29, Peer support 27/27, Disability services 38/38, Study guides 16/16, Toolkit 14/14 (plus upgrade path), Sources 20/20 (27 Oct). Run them:
`import { run as a } from './dbchecks/it'; ...` — one import per file; the runner cannot import this README.
