# Stream 30 · Phase 4 — institutional operation — first report

**Date** 2026-10-12 · **Branch** `claude/epic-galileo-aq26dg` · **Pull request** harrisonjrubin7-cmyk/semester#1475 · **Decision** [`D-1475`](../decisions/D-1475.md) §15–16 · **Plan** [`../handoff/execute/30-phased-build.md`](../handoff/execute/30-phased-build.md) Phase 4 · **Register** [`capability-register.csv`](capability-register.csv) rows `P4-I1`–`P4-L7`

## Verdict

**Phase 4's exit gate is not met, and most of what it asks for is not a build state.** The gate is "an authorized launch decision with evidence attached; G01, O01, O02 at Authorized". The three IDs have no definitions in anything supplied, and the launch decision, the backup tier, the staging environment, the support rota and the vendor credentials are all acts an owner performs outside this repository. This pass therefore did what a repository can do: four read-only audits placed the phase's thirty-one clauses against the tree (identity, integrations, operations, launch); one migration closed the three places where authority was handed out or kept without the server recording it; the restore rehearsal was run again on today's schema and filed honestly; and every open item is recorded with the person who can close it. Result: 3 clauses `tested`, 22 `partial`, 1 `untested`, 5 `absent`.

## Built this pass

- **Group → role mappings are stamped and kept (I5, I6).** `scim_group_mapping` decides which identity-provider group becomes which Semester role, `admin` included, and it was the least-audited privilege path in the schema: `approved_by`/`approved_at` were whatever the client wrote, nothing kept earlier versions, and no suite had read it as another school. `20261012050000_provisioning_authority_hardening.sql` stamps the approver and time from the session and copies every insert and update to an immutable `scim_group_mapping_history` readable with `audit:read`. `identity-provisioning.check.sql` gained nineteen checks (19 → 38): the approver is the session's user even when the row names somebody else; two changes leave two history rows naming who widened a mapping to `admin`; history is immutable to people; another school's administrator reads zero rows of mappings, provider, provisioning events and history, changes zero rows, and cannot plant a mapping. Red first: `expected <north admin>, got <cedar admin>`. The Vercel Agent review of the first cut found that the immutability trigger also aborted the foreign keys' own work, so an administrator whose account was erased could not be erased; the trigger now admits exactly the key's `changed_by` clearing (and the cascade from a removed school, which has no path here because `schools` refuses deletion outright: disposal is offboarding). The same shape had sat on `tenant_sso_policy_history` since 20260928011845 and is corrected in the same migration. Red first: `Tenant SSO policy history is immutable.` on `delete from auth.users`.
- **Integration approval has a way back (N2).** `integration_revoke_connection` and `integration_revoke_scope` take the same `integration:approve` capability the approval took, require a reason, clear the approval and disconnect the connection; the worker's existing rule (`approved_at` set, status not `disconnected`) then refuses the next run without being told anything new. Revoking twice is a no-op; a later approval is a new decision and restarts from `configuring`. Scopes carry a server-stamped `proposed_by` (the column is outside the client insert grant, so naming the proposer is refused) and the proposer cannot approve. `integration-control-plane.check.sql` 76 → 96 checks; the revocation is audited against the revoker. Red first: `the university admin revokes it, with a reason — was refused`.
- **Deprovisioning ends the person's sessions (I2).** The identity-provider deprovision trigger revoked school-scoped grants but left `auth.sessions`; the gateway reloads membership per request so gateway calls stopped, but an issued JWT kept working against PostgREST for whatever ownership or non-school grants still allowed, until it expired. The trigger now deletes the person's sessions the way school offboarding does for a whole school. The session ends everywhere, not only at the deprovisioning school: a membership elsewhere is re-established by signing in again, which is the one path that re-checks everything (D-1475 §15). `offboarding-grants.check.sql` 13 → 15 checks; the other administrator's session is untouched. Red first: `expected 0, got 2`.
- **The restore rehearsal ran on today's schema (O2).** `supabase/restore.sh` on the merged head: 342 tables, dump 0.6 s / 3,679,195 bytes, restore 7.6 s, six comparisons green, 28.3 s wall including the cluster build, on a local PostgreSQL 16 throwaway (`SEMESTER_CHECK_PG_ANY=1`). Filed as [`../evidence/restore/2026-10-12-logical-rehearsal.md`](../evidence/restore/2026-10-12-logical-rehearsal.md) with what it is not: staging, the live project's backup, or production's major. The live project was read the same day (`ACTIVE_HEALTHY`, PostgreSQL 17.6, sixteen preview branches, two `MIGRATIONS_FAILED`); its backups endpoint answered 401, so tier, retention and PITR stay unrecorded.

## The four surfaces, placed

| Surface | tested | partial | untested | absent | What only an owner can close |
| --- | --- | --- | --- | --- | --- |
| I Identity (SSO + SCIM) | I6 | I1, I2, I3, I5 | | I4 | Vanderbilt IdP metadata and a SAML registration; OIDC and JIT decisions; the SSO/SCIM admin screens re-supplied; D-150 hosting |
| N Integrations and reconciliation | N2, N8 | N1, N4, N5, N7, N9 | | N3, N6 | the 13-field matrix; SIS, LMS, payment, Handshake and Big Interview credentials; a real source per domain |
| O Operations and recovery | | O1, O2, O4, O5, O6, O7, O8 | O3 | O6b | backup tier and PITR; a witnessed restore of a real backup; staging; a pager and a second responder; the stream 29 release register |
| L Launch and acceptance | | L1, L2, L3, L4, L6, L7 | | L5 | G01/O01/O02 defined; council seats; a signed pilot; support owners and hours; branch protection; the BUILD.md §7 acts |

Each clause's evidence, gap and blocker is a register row. Two contradictions found by the audits are recorded there and not resolved here: `docs/master/*` say LTI NRPS is built and the LTI runbook says it is not (the code has none); the council's twelve go/no-go gates and the plan's eleven universal gates are different sets with no mapping.

## Commands run

From the repository root unless noted.

```
$ git fetch origin main && git merge origin/main                        → c47a32db, 104 commits, no conflicts
$ (app) tsc -b, lint, check:university, design-system:check (69), build, budgets ok, registers (1985), ecosystem:check (12)
$ (app) npm test on the merged head                                      → 2 files failed: CONTROL-FACTS.md (237 → 238 migrations) and MOCKS_MODULES
                                                                           (main carried a second copy of src/components/MyRules.test.tsx); both repaired
$ time SEMESTER_CHECK_PG_ANY=1 supabase/restore.sh                       → six comparisons ✓, 342 tables, dump 0.6s 3,679,195 B, restore 7.6s, 28.3s wall
$ SEMESTER_CHECK_PG_ANY=1 supabase/check.sh identity-provisioning integration-control-plane offboarding-grants
    before the migration                                                 → ✗ ✗ ✗ (approver 'expected <north admin>, got <cedar admin>';
                                                                           'the university admin revokes it, with a reason — was refused'; 'expected 0, got 2')
    after                                                                → ✓ 31, ✓ 96, ✓ 15 checks (PostgreSQL 16, local)
$ (app) REGISTERS=write vitest definerregister, trust-docs, rolelaunch, tableclassification, isolation, platform-reference, check-suites, migrationorder
                                                                         → 137 passed; DEFINER-RLS-REGISTER, CONTROL-FACTS (239 files) and ROLE-LAUNCH-REGISTER rewritten;
                                                                           scim_group_mapping_history classified
```

The whole-head gates for this push are recorded in [`../mainframe/TEST_AND_RELEASE_GATES.md`](../mainframe/TEST_AND_RELEASE_GATES.md).

## What the next stream needs

1. Definitions for G01, O01 and O02 and the approval reference that makes each `Authorized`; or the founder's word that the thirty-one clauses are the Phase 4 acceptance list.
2. Read off the Supabase dashboard by someone with access: plan tier, backup schedule, retention, PITR on or off. Then the PITR decision, which the ≤5 minute recovery point depends on.
3. A timed restore of a real backup onto a non-production project, by an operator other than the author, with the drill runsheet; and a staging environment, which rollback rehearsal needs first.
4. Named support and on-call owners, backups and hours; council seats signed or filled; branch protection applied.
5. Engineering that is unblocked now: an admin surface for `integration_approve_*`/`integration_revoke_*`; history for `institution_identity_provider`; an outbox event for provisioning and deprovisioning; the 12 → 11 gate mapping.
6. The second migration this pull request adds (`20261012050000`) is applied by CI to the throwaway database; applying it to production is a separate, approved step and is not done.
