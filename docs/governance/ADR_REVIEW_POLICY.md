# ADR review policy

Status: Proposed Phase 0 policy (2026-10-04). Not adopted until the founder, acting as the repository's decision authority, accepts ADR-0001. It adds to, and does not replace, [`docs/DECISION-RIGHTS.md`](../DECISION-RIGHTS.md) (what the database already enforces) and [`CLAUDE.md`](../../CLAUDE.md) (`D-<pr>` records).

## When an ADR is required
A change needs an ADR when it alters any of: tenancy or the identity of the acting user; the authorization model; grants, ownership, `FORCE ROW LEVEL SECURITY` or any `SECURITY DEFINER` function; where an AI model, tool or retrieval is invoked; a data store, queue, cache or index boundary; an integration's source of authority; retention, deletion or export behaviour; a release or rollback mechanism; a price, plan or entitlement rule; a public compliance claim.

## Lifecycle
Proposed → Researching → Review Required → Accepted → Implemented → Verified; or → Superseded / Deprecated. The ADR's folder under `docs/decisions/` and its Status field must agree.

- **Accepted** needs the named owner's approval recorded in the accepting pull request, and (for any item in the "counsel" column of the backlog) qualified-counsel review recorded in [`docs/legal/LEGAL_REVIEW_QUEUE.md`](../legal/LEGAL_REVIEW_QUEUE.md). An agent never accepts an ADR.
- **Implemented** needs the merge that ships it, with its `D-<pr number>.md`.
- **Verified** needs its fitness function green in CI on `main` and, for operational ADRs, a dated evidence record.

## Rules
1. Historical rationale is never rewritten: add a dated addendum or supersede.
2. A high-risk pull request cites its ADR (`ADR-nnnn`) in the description, or states `ADR-Exempt: <reason>` and the reviewer agrees. High-risk paths are listed in [`FITNESS_FUNCTIONS.md`](FITNESS_FUNCTIONS.md) (watched paths).
3. Every ADR that reaches Accepted names a measurable verification, or says why none is technically possible.
4. A Proposed ADR that has not moved in 60 days is reviewed or withdrawn.
5. Exceptions are dated, owned and expire; they are listed in the program risk register, not buried in an ADR.
