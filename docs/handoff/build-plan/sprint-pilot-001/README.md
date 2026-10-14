# SPRINT-PILOT-001 — registration readiness as a release candidate (from "continue (15).pdf")

**Start here in the repo.** This is the first implementation sprint: no new domains, one wedge proven end to end.

1. `docs/sprints/SPRINT-PILOT-001.yaml` — scope, the seven slices in order, what's out of scope, done-when. Owners and environments from DEC-OWNER-001/002 and DEC-ENV-001.
2. `docs/engineering/repository-map.yaml` — the repo is canonical; prototypes are illustrative and never evidence.
3. `packages/domain-core/source-state.ts.txt` — one source/freshness/evaluation vocabulary; `mayShowDefinitiveReadiness` (ready + current + confirmed only), `studentOutcome` (failure → needs review, never a negative result), `validate` (blocked names a next step; resolved needs a reconciliation decision). **Run here: 9/9 cases.**
4. `registry/data/pilot-table-classification.yaml` — classify before building; first task is mapping to the repo's existing registration tables.
5. `tests/rls/readiness-access.spec.ts.txt` — the PDF's access cases plus "no client writes"; deny means zero rows, not an error that reveals the record exists.
6. `evidence/control-plane/CERT-CONTROL-001.yaml` — v4 baseline, five hard invariants, five blocking failures.
7. `evidence/drills/drill-program.yaml` — nine drills incl. DRILL-REVOCATION-001; all pending.
8. `registry/operations/pilot-command-center.yaml` — six queues, operator action receipt.
9. `docs/product/build-gates.yaml` — gates 0–5 = maturity levels; four evidence streams; AI red-team matrix (12 categories, not in this sprint).

Milestone: a readiness release candidate that survives source failure, duplicate delivery, revoked access, policy denial, staff escalation, accessibility review, rollback and hypercare — with evidence for each.
