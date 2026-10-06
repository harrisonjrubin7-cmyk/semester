# Execution backlog

Phases follow the mainframe PDF. The operations roadmap’s P0 line (safe delivery, not thirty-three consoles) still wins when the two disagree about what to build next.

## Done in this batch

- Phase 0 records in `docs/mainframe/`, traced to code and to `docs/operations/`.
- One local slice of Phase 2: name a term and course codes without an account, store them as hand-added courses, show them on the Term plan when no catalog is imported, and say they are not an enrollment.

## Next, in dependency order

1. **Readiness row for named courses.** Extend `pathReadiness` so “courses you named” is its own item, distinct from “primary schedule” (the cart). State stays short of ready until a catalog section is chosen. Destination remains `yes`. Tests must fail if the row calls the codes enrolled.
2. **Advisor handoff without a caseload.** From that checklist, open the existing meeting screen (`meet`) with the course codes as student-authored agenda text. Do not create an advisee grant.
3. **Source and freshness on the cart.** When a catalog is imported, keep the named codes visible as unmatched until a section with the same code is in the file. Do not invent seats.
4. **Security closure OP-01.** Only with explicit approval to add a migration and only against a non-production database the operator names. Do not infer a project id.

## Not in this backlog yet

Placeholder consoles, new domain tables for every engine, native iOS or Android, marketplace, authority transfer, and any charge or official grade.

## Stop conditions

Production mutation, remote migration, destructive git, a second permission model, or a policy choice the roadmap lists as an open decision (OD-1 through OD-9).
