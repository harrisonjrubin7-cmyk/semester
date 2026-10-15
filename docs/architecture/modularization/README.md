# Modularizing Semester

Measured at `origin/main` `7287ddc`, pull request
[#1156](https://github.com/harrisonjrubin7-cmyk/semester/pull/1156). Every
figure here comes from `npm run census:arch` (run from `app/`) and can be
re-derived; where something was read rather than measured, the text says so.

The goal is bounded, testable product domains **without losing a requirement
and without a rewrite**. The code stays deployable at every step, and the old
and new structure coexist until a screen has moved and been locked.

| # | Deliverable | Where |
|---|---|---|
| 1 | Current-state audit | [01-current-state-audit.md](01-current-state-audit.md) |
| 2, 3 | Target module graph, dependency rules, domain boundaries, anti-corruption layers | [02-target-architecture.md](02-target-architecture.md) |
| 4, 7 | Refactoring sequence, repository restructuring, commits and validation | [03-refactoring-sequence.md](03-refactoring-sequence.md) |
| 5 | Coding standards, error model, state machines, DI, configuration, feature lifecycle | [04-engineering-standards.md](04-engineering-standards.md) |
| 6 | ADRs: modular monolith versus service extraction | [0011](../0011-modular-monolith-before-services.md), [0012](../0012-legacy-only-through-anti-corruption-layers.md), [D-1156](../../decisions/D-1156.md) |
| 8 | Legacy retirement: reuse, migrate, replace, archive, delete | [05-legacy-retirement.md](05-legacy-retirement.md), [legacy-inventory.csv](legacy-inventory.csv) |
| 9 | Architecture tests | [06-architecture-tests.md](06-architecture-tests.md) |
| 10 | Vertical slice: identity, policy, tasks, calendar, Today | [07-vertical-slice.md](07-vertical-slice.md), code in `app/src/domains/` |

## What exists in this pull request, and what does not

Exists and is tested: the kernel, the architecture rules, the census and
inventory, five domain modules with a composition root, and the parity tests
that hold them to the legacy functions they wrap.

Does not exist yet: any screen reading the new modules; a React binding for
`LegacyHost`; any server-side caller of `decide()`; any extraction of a
service. [03](03-refactoring-sequence.md) says in what order and what proves
each step.

## Relationship to D-1144

The CTO pack ([`docs/target-architecture/`](../../target-architecture/README.md),
[D-1144](../../decisions/D-1144.md)) landed on `main` mid-way. It is the
server-side, docs-only proposal for the same direction; this is the
client-side, measured, enforced half, with code. The mapping and the points
this leaves to its review are in the last section of
[02](02-target-architecture.md).

## On the earlier "rebuild from scratch" prompt

The audit that prompted this work (a Perplexity export) recommends a
`services/`-per-domain monorepo and a clean-platform rebuild. This work takes
its domain list and its launch discipline and **declines the rebuild and the
service split for now**, for reasons in [0011](../0011-modular-monolith-before-services.md):
the repository already has the pieces a rebuild would re-create (a decision
point, workflow machines, an event envelope, an error envelope, a gateway), and
what it lacks is the boundary that makes them load-bearing.
