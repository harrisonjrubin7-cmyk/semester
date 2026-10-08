# ADR-0010 · Grades, records, finance, permission grants and high-risk exports require a second person, enforced in the database

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Security owner (approvals) with database owner |
| Deciders / reviewers | Founder; counsel (who must approve institutional record changes); pilot school registrar role |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 (list and design); Phase 2 (before any school record is changed through Semester) |
| Related | `docs/governance/DECISION_RIGHTS.md`; `docs/DECISION-RIGHTS.md`; `supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`; `supabase/migrations/20260929100000_console_control_plane.sql`; `supabase/migrations/20260930010000_module_mode.sql`; `docs/DEFINER-RLS-REGISTER.md`; `findings-database.md` #9; ADR-0003, ADR-0006, ADR-0007 |
| Supersedes / superseded by | — |

## Context
- Two-person rules that already hold in the database: approving a sensitive request (approver not requester, fresh MFA; `decide_approval`), and break-glass (requested, approved by someone else, time-limited, reviewed afterwards, overdue review blocks the next) (`docs/DECISION-RIGHTS.md` table; `console-approvals.check.sql`). Module Core switch needs two other `tenant:configure` holders (`20260930010000_module_mode.sql`).
- The duty matrix `public.console_duty` and seats exist for the operations console (`20260929100000_console_control_plane.sql` header). Break-glass audit is written before the effect and the call fails if the audit fails (`privileged-surface-map.md` §6).
- Elsewhere it is single-capability: of 205 authenticated-callable definers, 74 are `admin` where the register requires "capability, MFA for high risk, dual control, immutable audit" but only the console duty matrix carries MFA and dual control; "most admin functions are single-capability. Not every function mapped to a duty (not verified)" (`privileged-surface-map.md` §1).
- `gradebook_export` requires `grades:export` scoped by tenant, released rows only: one person, no approval, no audit reference in `20260929310000_gradebook.sql` (`database/FUNCTION_AUTHORIZATION_MATRIX.md`; `findings-database.md` #9).
- Financial definers `purge_financial_records`, `run_dunning`, `apply_payment_event`, `upsert_provider_invoice(_v2)` are service-only (`database/FUNCTION_AUTHORIZATION_MATRIX.md` correction); the three `financial` category rows callable by `authenticated` were not read (`privileged-surface-map.md` §1).
- Role grants are audited (`role_grant_audit_event`, `20260924213000_role_grant_audit.sql`) but granting a high-risk role is a single act.
- MFA freshness is a JWT claim shape tested on a stub (`supabase/local.stub.sql`), not the real stack (`privileged-surface-map.md` §8).
- The company has one operator and no named backup (`findings-platform.md` #7; tabletop `docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md`): a two-person rule has no second person today.

## Problem
Which acts are too consequential for one person, and how is "a different person approved this, recently, within scope" proven by the database rather than a runbook?

## Decision drivers
1. The approver is never the requester, holds the capability in the same school, and has fresh MFA.
2. The rule is in a definer or constraint, not in UI (`0002`: UI is not the boundary).
3. Friction only where harm is irreversible or cross-person.
4. Do not introduce a rule nobody can staff.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Single capability + audit (status for most admin functions) | Fast | No prevention; audit is missing for grades/export (ADR-0007) | Rejected for the listed acts |
| B. Dual control for every admin function (74) | Uniform | Unusable; one-operator team | Rejected |
| C. Dual control for a named high-risk list, reusing `console_duty` and approval records | Reuses shipped mechanism | Needs per-act definer changes | Chosen |
| D. Delay-and-notify (act executes after a window, others may veto) | Lower friction | Harm may occur during window; weak for exports | Considered for low-risk tier only |

## Decision
**Recommended, unratified; no agent can accept it. Who must approve institutional record changes is a counsel/school policy question, flagged.**
1. High-risk list (v1): release or change of a grade after release; amendment of an institutional record; refund, adjustment or purge of financial records; grant of a role carrying `grades:*`, `records:*`, `finance:*` or `tenant:configure`; export above a size or sensitivity threshold (grade export, bulk personal-data export); module Core switch (exists).
2. Each act is an approval request in the existing mechanism: requester and approver differ, both hold the capability scoped to the school (ADR-0002), approval is fresh-MFA, expires, and is consumed once.
3. The executing definer refuses without a consumable approval id; it writes audit before effect (ADR-0007).
4. A staffing rule: a school with fewer than two eligible approvers cannot enable the act; the platform operator is not an approver for school records.
5. Break-glass stays the only path around, with its existing review.

## Consequences
Positive: irreversible acts need two people. Negative: a one-person school office cannot act alone; approvals add latency. Harder: bulk operations; Semester's own one-operator support.

## Impact
- **Data / tenancy:** approvals are tenant-scoped rows.
- **Security:** stops single-account takeover from releasing grades or exporting; real-stack MFA claim must be verified.
- **Privacy:** reduces unilateral bulk export; counsel on required approvers.
- **Accessibility:** approval UI keyboard- and screen-reader-operable (ADR-0013).
- **Operations (SLO, alert, runbook, support):** approver rota; stale pending requests alert.
- **Cost / commercial:** may be a packaging line for schools; none decided.

## Implementation
1. Finalize list with the pilot school and counsel. 2. Add `approval_id` consumption to `gradebook_export`, role-grant for named capabilities, finance definers. 3. Extend `console_duty` rows. 4. Verify MFA claim on a real Supabase stack (ADR-0012 job). 5. Eligibility count check.

## Tests and verification
- Requester approves own request: refused (control, exists).
- `gradebook_export` called with no approval id: refused (fails today: succeeds with `grades:export`).
- Approval by a holder in school B for school A's act: refused.
- Expired or already-consumed approval id: refused.
- Stale MFA claim: refused.
- School with one eligible approver: act disabled with a stated reason.

## Fitness functions
- `audit-outbox` (`scripts/architecture/audit-outbox.mjs`): high-risk definer without audit.
- `definer` (`scripts/architecture/definer-count-drift.mjs`): listed definers diverge from register.
- `policy-gateway adoption`: gateway export/role routes call `decide` with the approval id.

## Rollback / reversal
Remove the approval requirement per act (revert definer). Not cheap after a school has relied on the second-person guarantee in its own procedures.

## Open questions
- Who is the second person at Semester (no named backup).
- Counsel: whether a school's records-amendment rules (appeal, hearing) change who may approve.
- Thresholds for "high-risk export".

## Addenda
(none)
