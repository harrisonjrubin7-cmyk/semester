# Phase 0/1 reconciliation (2026-10-04)

The Master Execution Program asks for a Phase 0 baseline and a Phase 1 spine. Main already holds much of
the Phase 0 evidence, so this page maps the program's deliverables to it instead of writing them twice
(`CLAUDE.md`: check main for the thing itself). Facts below were checked on `origin/main` at `8e9b746`
and, for the database, against production's catalog, read-only.

## Program deliverable → where it lives on main
| Program deliverable | On main | Gap |
|---|---|---|
| Baseline audit, feature inventory | `docs/architecture/semester-convergence-baseline.md`, `FEATURE-INVENTORY.md`, `docs/product/capability-inventory.md` | No keep/rebuild/migrate/retire classification per screen |
| Capability traceability matrix | `docs/product/capability-registry.md`, `docs/CAPABILITY-PARITY-MATRIX.md`, `docs/CAPABILITY-ACTIVATION-REGISTER.md` | Not keyed to owner, tests and release status per capability as the program defines |
| Risk register | `LAUNCH-RISK-REGISTER.md` | |
| Legal-review queue | `LEGAL-REVIEW-QUEUE.md`, `docs/COUNSEL-BRIEF.md` | Review it against the program's list (minors, marketplace terms, transfers) |
| Target architecture, domains, monorepo, conversion | `docs/target-architecture/01`-`09` (D-1144) | **Proposal, not built.** I did not create `apps/`, `services/` or `packages/` skeletons: that would pre-empt D-1144's conversion plan and add empty directories that read as capability |
| Tenant isolation, SECURITY DEFINER | `docs/architecture/multi-tenant-isolation.md`, `docs/DEFINER-RLS-REGISTER.md`, `docs/TENANT-CONTRACT.md` | Matrices were missing: now `database/` (partial, see its README) |
| Incident response, rollback, restore | `docs/INCIDENT-RECOVERY-PLAYBOOK.md`, `docs/CRISIS-RESPONSE-RUNBOOK.md`, `ROLLBACK.md`, `RESTORE.md` | Program wants 13 named playbooks; mapping not done |
| CI/CD | `.github/workflows/` (ci, contrast, functions, hawkscan, pages, production-smoke) | Not compared to the 10-stage pipeline; no SBOM, canary or protected-environment evidence checked |

## New in this change
`database/` (README, TENANT_ISOLATION_MATRIX, GRANT_ALLOWLIST, FUNCTION_AUTHORIZATION_MATRIX, `schema/inventory.sql`,
`proposed/anon_grant_reduction.sql`). Documentation and a read-only query only; no migration, no production change.

## Findings (measured; severity is my proposal, owner to confirm)
1. **P2** `anon` holds full DML plus TRUNCATE/TRIGGER on 24 owner-scoped tables. Row access is denied by policy; the grant is the gap. Proposal in `database/proposed/`.
2. **Question for product/counsel (Q1)** `schools` is readable by `anon` with policy `true`.
3. **Decision for owner** no table forces RLS (0 of 348).
4. **Open reconciliation** 205 authenticated-callable definers in `public` vs 180 in the register; names not diffed.
5. No P0/P1 found. That is a statement about what I looked at, not a clean bill: no cross-tenant test was run.

## Gates
- **Phase 0:** PASS WITH DOCUMENTED EXCEPTIONS is **not** claimed. Per-screen classification and the owner-keyed traceability matrix are not done. Status: **incomplete**.
- **Phase 1:** **NO-GO** as the program defines it. Unclassified tables remain, no cross-tenant negative suite was run by me, no restore drill was run. Identity/passkeys, policy layer, audit ledger, retention and break-glass already exist in part (see register and `supabase/`); I did not verify them against the program's list.
- **First vertical slice** (Today, tasks/calendar, encrypted offline store): **not started.** Main's app already has Today and calendar; building a second one is the wrong move before the D-1144 conversion decision.

## Not claimed
No statement here is a legal conclusion. FERPA, COPPA, GDPR, WCAG and security-readiness claims remain with qualified counsel/assessors.
