# Platform ADRs

Named for the decision, **not numbered**. The repository's own history is why:
the decision log numbered in turn, and every pair of open pull requests collided
on the next number (`CLAUDE.md`, *A decision takes its pull request's number*;
[`docs/decisions/README.md`](../../decisions/README.md)). Numbered architecture
records ([`docs/architecture/`](../../architecture/README.md), 0001–0010) have
the same hazard; these avoid it, and the platform's one *recorded* decision lives
where the repository wants decisions — in `docs/decisions/D-<pull request>.md`.

Format, as in the existing records: status, decision, why, what it was chosen
over, how it is held (a test that exists), what it constrains. `docs.test.ts`
refuses a record missing a section or citing a test that is not there.

| Record | Decision |
| --- | --- |
| [tenant-is-derived-never-submitted](tenant-is-derived-never-submitted.md) | The tenant comes from the verified session; a client hint that disagrees is refused |
| [commands-commit-record-audit-and-event-together](commands-commit-record-audit-and-event-together.md) | One unit of work for the record, its audit row and its event |
| [policy-engine-declares-actions-and-delegates-institution-ones](policy-engine-declares-actions-and-delegates-institution-ones.md) | Declared actions, deny by default; the institution's three go to `decide()` unchanged |
| [isolation-is-per-layer-and-proven-by-conformance](isolation-is-per-layer-and-proven-by-conformance.md) | Each layer has its own boundary and a suite that must go red against a leaky adapter |
| [idempotency-keys-are-scoped-hashed-and-leased](idempotency-keys-are-scoped-hashed-and-leased.md) | `(tenant, actor, command, key)`, request-hashed, with a lease |
| [billing-never-gates-records](billing-never-gates-records.md) | A fixed always-entitled list is checked before any plan |
| [platform-is-layered-with-one-door-to-institution](platform-is-layered-with-one-door-to-institution.md) | Imports point down; `seam/` is the only importer of the institution package |
| [schema-contract-is-proposed-not-applied](schema-contract-is-proposed-not-applied.md) | The SQL lives under `docs/` until it can run against PostgreSQL 17 |
