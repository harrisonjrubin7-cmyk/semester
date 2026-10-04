# Semester — launch critical path (Phase 0)

**Date:** 2026-10-04 · **Builds on, does not replace:** [`02-DEPENDENCIES-AND-CRITICAL-PATH.md`](02-DEPENDENCIES-AND-CRITICAL-PATH.md) (27 nodes, four motions, machine-checked) · **Gaps:** [`READINESS_GAP_MATRIX.md`](READINESS_GAP_MATRIX.md) · **Decisions:** [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md)

The existing pack's conclusion (README) is that no engineering work sets the date: the paths start at nodes nobody has sized and run through outside parties. Phase 0 confirms that and adds one finding: **several engineering items are also on the path**, because they produce the evidence the outside parties will ask for.

## 1. Who can unblock what

| Blocker class | Who must act | Can an engineer or agent close it? |
| --- | --- | --- |
| **H — human authority** | Founder, counsel, CPA/tax, broker, customer, independent assessors | **No.** Repository work can only prepare inputs |
| **E — engineering** | Engineering | Yes, in the repository |
| **O — owner-authorized operation** | Founder grants production/staging access, runs or witnesses a drill | Only with explicit authorization; an agent must not run these unprompted |
| **X — external evidence** | Third party produces it | No |

## 2. Critical path per motion

### Motion 1 — invitation-only unpaid individual validation (closest; YELLOW)

| Step | Gap | Class | Closes with |
| --- | --- | --- | --- |
| 1 | Immutable candidate + exact-SHA hosted CI | E+O | frozen SHA, run links (GO-NO-GO priority 1) |
| 2 | Terms / Privacy / Cookie / age posture reviewed | H | counsel memo + effective date (G-I10) |
| 3 | Qualified accessibility review of critical path | X | dated report; approved statement (G-I8) |
| 4 | Staffed support + named backup | H | rota, response expectations (G-I7) |
| 5 | Restore measured on the target | O | `RESTORE.md` filled with RTO/RPO (G-M5) |
| 6 | AI path governed for the cohort | E | A-02/A-03/A-05 (see Phase 1 step 3) |
| 7 | Representative-user UAT | H | signed record |

### Motion 2 — paid individual (Student Premium) — **held**

Adds to Motion 1: price authority (G-I2), counsel-approved refund/cancel/renewal terms (G-I11), tax adviser, annual/refund/failed-renewal/dispute exercised in live mode, entitlement enforcement (G-I3), flipping `individualPaidAcquisitionApproved` by a reviewed change (never by environment alone), payment support.

### Motion 3 — design-partner non-activation (GREEN, may proceed now)

Synthetic demos, evidence exchange, conditional scoping. **Engineering on the path:** a synthetic-data demo that does not depend on `sandbox.ts` 30-day keys; a claims-clean sales deck. No live data, no payment, no customer claim.

### Motion 4 — paid institutional pilot — NO-GO

| Chain | Gap | Class |
| --- | --- | --- |
| Entity → bank → price book → counsel-approved pilot agreement/DPA | G-P9, G-P14, G-C5/C6 | H |
| Named customer sponsor, cohort, data/integration map, UAT | G-P11 | X |
| DAST clean + independent security assessment | G-P10 | X |
| **Target-tenant isolation test over HTTP** | G-P1 | E+O |
| **First real connector (SSO/SCIM + one SIS or LMS adapter)** — `ADAPTERS = []` today | G-P5 | E |
| Restore, rollback, incident, export/delete, revocation, offboarding drills on target | G-M5, G-C2 | O |
| Offboarding wired to a caller (today operator-only) | G-C2 | E |
| Named support/escalation | G-P13 | H |

### Motion 5 — broad enterprise / mass-user — NO-GO

Everything above, plus repeatability across several deployments, HTTP-level load/soak, real telemetry and paging (no Sentry/OTel exists), on-call rota, vendor management, SLA.

## 3. Engineering items that sit on the path (ordered)

These are the Phase 1 plan, restated by what they unblock. Full ordering in the final report and in [`../../operations/LAUNCH_COMMAND_CENTER.md`](../../operations/LAUNCH_COMMAND_CENTER.md).

| # | Item | Unblocks | Depends on |
| --- | --- | --- | --- |
| 1 | Restore drill with measured RTO/RPO | Motions 1, 2, 4, 5 | O: scratch/branch target and witness |
| 2 | Grant hardening (`anon` DML/TRUNCATE; `authenticated` allowlist; table-grant check in CI) | 4, 5 | none |
| 3 | AI policy at every model/tool/retrieval call (close edge-function and browser bypass; wire `decideDoor`; redaction) | 1, 2, 4, 5 | decision on BYO-key policy |
| 4 | Scanning made blocking and proven (CodeQL/DAST required; npm audit at high; Deno coverage) | 2, 4, 5 | secrets configured (O) |
| 5 | Definer forged-argument audit + reconcile 25 names | 4, 5 | none |
| 6 | Staging proven equivalent | 1, 4 | O |
| 7 | One trusted tenant context (trace `q.ownerId`) | 4, 5 | none |
| 8 | PDP adopted route by route | 4, 5 | none |
| 9 | Governed productivity API adoption | 4 | 7, 8 |
| 10 | Runtime role / FORCE RLS decision and migration | 4, 5 | owner decision (D-`<PR#>`) |

## 4. What this page does not do

It does not estimate dates. The repository holds no sized estimate for the H, O or X nodes, and inventing one would be the kind of unsupported figure this program prohibits. Dates appear only where an existing document carries them.
