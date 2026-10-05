# Access Simulator — design

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

**Status: design, not built. Decision D-153 (proposed).** It is a University
console tab behind a flag that ships off, the pattern D-145 (Academic record)
and D-146 (Student accounts) set.

## The point

An IT or privacy reviewer asks: *what can this role read, write, share and
export, in this scope, and why?* Today the answer is spread across a migration,
several registers and the policies themselves. The simulator answers it in one
place, names the rule that decided, and exports the whole thing as a matrix
for procurement.

## What already exists

| Piece | Where | What it gives the simulator |
|---|---|---|
| The role → capability matrix | `supabase/migrations/20260922012000_capabilities.sql` (`app_roles`, `app_capabilities`, `role_capabilities`) | The truth about what each role holds. Later migrations add roles and capabilities |
| Who holds which role, over what scope | `role_grants` (`20260921223000_role_grants.sql`): `scope_kind`, `scope_id` | Scope and expiry |
| The predicate every policy calls | `private.has_capability(...)` | The one place the answer is decided; policies ask for the capability, never the role |
| The client's read of it | `lib/capabilities.ts` (`loadMyCapabilities`), via `my_capabilities()` | Shape only. It "authorizes nothing" (its header) |
| Entitlement resolution | `docs/ENTITLEMENT-RESOLUTION.md`, `supabase/functions/_shared/entitlement.ts` | The ordered steps — kill-switch, environment, tenant plan, module, SSO policy, lifecycle, capability, course scope, course policy, data classification, individual plan, usage allowance — and the rule that *the first refusal wins and names its step*. Runs in **shadow** on LTI launches; it enforces nothing |
| Registers rendered from data | `lib/rolelaunch.ts` → `ROLE-LAUNCH-REGISTER.md`; `lib/definerregister.ts`; `lib/governance/module-privacy.ts` (`ROLE_MATRIX`) | The pattern: TS data, a test that renders the doc, `npm run registers`. Partial matrices only — Transfer, Career and Basic-needs |
| A simulator to copy | `components/institutional/PolicySimulator.tsx` + `lib/governance/policysim.ts` | Pure `simulate()`, drawn by a component; "Nothing here applies anything" |
| The console | `screens/University.tsx` areas, `components/institutional/*` | Where a tab goes |

**Absent:** a single role × data × action matrix, and any runtime tool that
answers "can this role do X here?". `INTEGRATION-PERMISSION-MATRIX.md` is
hand-written and covers integration tables only.

## Design

**Inputs.** A role (from `app_roles`), a scope (`scope_kind` + a named scope —
tenant, department, course, cohort), a data class, and an action: *read, write,
share, export*.

**Output.** One verdict, in the standard shape (DO-NOT-BUILD #3 — nothing
unexplained):

```
Registrar · course COMP-101 · Enrolment records · Export

Not allowed.
Decided by:  capability — the role does not hold `records:export`
Source:      role_capabilities, migration 20260922012000 (row absent)
Expiry:      —            Consent needed: no
What would change it: granting `records:export` to this role, over this scope.
                      Every role that gains it: [list]
```

Every verdict names **the step**, the **source row** (migration and role),
**expiry** from the grant, and any **consent dependency** (the `ferpa-consent`
and share tables). A "what changes if I grant this?" panel lists every other
role and scope that would gain the same reach.

**Data classes** are the missing mapping: capability → tables → action. It is a
reviewed table (`lib/governance/dataclasses.ts`), one row per capability, with
the tables it reaches and the actions it permits, rendered to
`docs/ACCESS-MATRIX.md` by the same test that renders the others. The matrix and
its CSV export for procurement are the same data.

**Read-only, and it says so.** It changes no grant, applies no policy, and
carries the same sentence `PolicySimulator` does. It also states, on the screen,
that the client's capability read decides only what to *offer*, and that row
level security is what decides.

## The risk, and how it is held

A simulator that disagrees with the policies is worse than none: a reviewer
signs off on its answer. Two things keep it honest.

1. **Same source, not a copy.** It reads `role_capabilities` from the
   migrations the way `rolelaunch.test.ts` already does (`seeded('role_capabilities')`),
   so a capability added in a migration is in the simulator by construction.
   `rolespec.test.ts` already pins the row count (D-146: 136 → 145); the
   simulator's fixtures are pinned to it.
2. **A conformance test against the real database.** In the CI job that runs a
   local Supabase (`680ec7b`), for a fixed sample of (role, scope, table,
   action) the simulator's verdict must equal what the policy actually returns.
   A drift is a red build, not a reviewer's discovery. Its guard has to be
   shown red by revoking a capability under it.

**Shadow output is labelled shadow.** Where a verdict comes from entitlement
resolution, the screen says it is a shadow reading and enforces nothing, until
that changes. It never presents it as enforcement.

## Constraints

- Inside the University console; **no top-level navigation** (#1).
- Behind a flag, off by default, like D-145/D-146.
- Verdict copy through the content standards and the label lint (#9).
- Must not import `supabase/functions/` into `packages/institution` or anything
  the gateway compiles (`CLAUDE.md`, `check:university`, TS1287). The data
  classes live in `app/src/lib`, not there.
- An export of the matrix is itself sensitive; it is behind the same capability
  that reads the register, and logs to the audit history.

## Tests it needs

| Behaviour | Held by |
|---|---|
| Every capability in the migrations has a data-class row, and no row names a missing capability | new `lib/governance/dataclasses.test.ts` |
| Every verdict names a step and a source | `lib/governance/accesssim.test.ts` |
| Simulator == policy on a sample | the local-Supabase job |
| The register and CSV render from the same data | `npm run registers` |
| Flag off → tab absent | existing flag tests |

## Open questions for the owner

1. Which data classes first? Proposal: student records, the account ledger,
   shares and consents — the three where a reviewer's question is most likely.
2. Should the conformance test gate merges, or run nightly (it needs the local
   Supabase job's time)?
3. Is a procurement export of the matrix something the school gets, or only
   Semester staff?
