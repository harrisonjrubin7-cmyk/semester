# Semester platform control

This package is the repository-owned implementation control plane. It turns a bounded slice of the ecosystem catalog into machine-checkable records for capabilities, systems, roles, screens, workflows, integrations, controls, documents, tenants, and backlog work.

The root manifest also fixes the canonical product domain at `semesterintel.tech` and maps the 13 grouped workspace families to 17 independently governed pilot release scopes. Every scope declares its required operational loop, but remains blocked and activation-disabled until route, capability, workflow, code, test, deployment, and approval evidence is present. A reachable shell is never operational-readiness evidence.

The generated `execution-board.json` is the dependency-ordered P0 delivery board. Every item links to registry keys, names an owner, and keeps missing external or operational proof in explicit blockers. The derived `execution-plan.json` identifies ready work, active work, sequencing debt, dependency waits, and explicit blocks without treating partial implementation as verified.

It deliberately separates repository implementation evidence from deployment, activation, and observed operation. A stage may be `true` only when that exact stage has evidence, and stages cannot skip an earlier false gate.

Run from the repository root:

```sh
npm run registry:validate
npm run registry:build
npm run platform-control:test
npm run release:check
npm run tenant:create -- --key demo-campus --name "Demo Campus" --owner platform-security --synthetic
```

`release:check` is expected to fail until every in-scope capability has production-ready evidence. It writes the fail-closed decision to `generated/release-evidence.json`; a failed release check is evidence that release is blocked, not that the registry is broken.

`tenant:create` creates only a new, unactivated synthetic registry record and refuses production provisioning. It does not create credentials, deploy infrastructure, or activate a tenant.

The first implemented registry slice is `registration.readiness`. Extend the registry one real job loop at a time; do not bulk-mark the larger ecosystem roster as implemented.

## The inception layer

The execution specification of 11 October 2026 ("come on continue") asks for one source of truth per deployable unit — tenant → workspace → capability → screen → command → event → record → policy → integration → audit → owner → runbook → tests → evidence — across every operating system at once. The groups under `registry/` that carry it, each validated by `validators/inception-validator.ts` and shown to fail in `tests/inception-validator.test.ts`:

| Group | Holds | Refuses |
| --- | --- | --- |
| `operating_systems/` | The 26 operating systems the specification lists (it says 25), each with routes, the pilot release scopes it is delivered through, the master-catalog domains (D01–D40) it covers, its minimum events and the screens in this repository that serve it | Roster drift, an undeclared shared route, an uncovered pilot scope, an `implemented` or `verified` claim (nothing here can certify one), a system outside the master catalog that does not say so |
| `events/` | Every minimum event by system, mapped to the `EVENT_TYPES` key in `packages/institution/src/events.ts` that carries it, or null | A catalog event that is not in the catalog (the keys are read from the source), an implemented claim with no catalog type, a designed claim with one |
| `authority/` | The authority table: each record's connection type (authority, reference, derived, delegated), primary authority, Semester action and reconciliation | A reference or derived connection that does not reconcile; a delegation without scope, purpose, expiry and revocation |
| `permissions/` | The `resource.action.scope` grammar, by example, with the roles that may hold each | A key with fewer than three segments, a scope outside the declared set, an unknown role |
| `journeys/` | The 24 required cross-OS end-to-end journeys | Roster drift, an unknown system, `verified` without a named test |
| `screen_contracts/` | The machine-readable screen contract (`registrar.readiness.case` first) | Fewer than the seven view states, a route outside its workspace, an unknown role, capability or catalog event, an external authority that does not reconcile |
| `adapters/` | The 13 integration adapters, their domains and required behavior | A runtime health (`healthy`, `stale`, `degraded`) written in a file, a credential that looks like a secret, a sandbox claim without verification |
| `cadence/`, `service_levels/` | The operating cadence and the service levels | A cadence outside the seven, a blank field |
| `evidence_pack/` | The 27 artifacts of the release evidence pack and what produces each | Roster drift, `verified` without a producer |
| `lifecycle/` | The shared record lifecycle and the records it governs | A terminal state with an exit, an unreachable state |
| `workstreams/` | Workstreams A–K and the registry groups each converges | Roster drift, an unknown group |

`roles/inception.json` adds the specification's personal, institution and Semester roles, each mapped to the database role that exists for it or to null. Role records are the vocabulary permissions and screen contracts are checked against.

`npm run registry:build` now also writes `generated/inception-coverage.json` (one row per operating system: workspaces, domains, roles, screens, capabilities, permissions, adapters, journeys, status, evidence, deployment, blockers), `generated/INCEPTION-COVERAGE.md` (the same as the matrix the specification asks for, with the definition of inception completion measured rather than asserted), `generated/event-coverage.json`, `generated/release-evidence-pack.json` (which artifacts are present under `release/`; none are) and `generated/registry-projection.sql` (the files upserted into `private.registry_*`, see below). `npm run release:report` blocks on every unverified journey, every adapter without sandbox verification and every artifact nothing produces, in addition to capability maturity.

Three things outside this package belong to the same layer:

- `supabase/migrations/20261011120000_platform_registry.sql` creates `private.registry_workspaces`, `registry_capabilities`, `registry_capability_dependencies` and `registry_capability_evidence` with the `registry_status` lifecycle, service-role only. Two triggers make "a capability is live only when its full chain resolves" a database fact: a capability cannot be `deployed` or `active` below its workspace or any dependency's required status, cannot be `tested` without test evidence, cannot be `active` without verified unexpired evidence, and a workspace cannot fall out from under a live capability. `supabase/platform-registry.check.sql` attempts each before and after the condition is met.
- `infra/policy/access.rego` is the access policy baseline (authenticated, same tenant, active grant, scope, consent, authority, integration freshness, approval above risk tier 1) with a `deny` set naming the failed condition; `access_test.rego` holds it. It is the contract `packages/platform/src/policy/engine.ts` is measured against, not a second evaluator.
- `docs/decisions/` records the decision as `D-<pull request number>`.

What this layer does not do: it does not make any operating system implemented, deployed or activated. Every operating system is `designed`, every journey is `designed`, no adapter is sandbox-verified and no evidence artifact is present, and the generated matrix says so.
