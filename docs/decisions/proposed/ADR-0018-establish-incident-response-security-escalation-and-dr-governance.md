# ADR-0018 · Incident, escalation and disaster-recovery commitments exist only where a drill has exercised them

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Incident-response executive / security owner (the founder holds both roles today; backup `UNASSIGNED`) |
| Deciders / reviewers | Founder; named backup operator (to be appointed); privacy owner; counsel for notification decision rights and customer-facing representations (counsel required) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 gate "restore exercised on a live-shaped project with a witness; alert reaches a human" |
| Related | [`docs/trust/INCIDENT-RESPONSE-PLAN.md`](../../trust/INCIDENT-RESPONSE-PLAN.md); [`docs/trust/BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md`](../../trust/BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md); [`RESTORE.md`](../../../RESTORE.md); [`ROLLBACK.md`](../../../ROLLBACK.md); [`MONITORING.md`](../../../MONITORING.md); [`docs/legal/INCIDENT-RESPONSE-SUMMARY-DRAFT.md`](../../legal/INCIDENT-RESPONSE-SUMMARY-DRAFT.md); ADR-0015, ADR-0017, ADR-0020, ADR-0025; legal rows Q-05, Q-16, Q-17, Q-19, P-02 |
| Supersedes / superseded by | — |

> **Counsel required.** Who decides breach notification, what clock applies, what may be promised to customers, litigation/subpoena response, safety disclosure duties: `LEGAL_REVIEW_QUEUE.md` Q-05, Q-16 (`docs/legal-drafts/INCIDENT-NOTIFICATION-DECISION-WORKFLOW-DRAFT.md`), Q-17, Q-19; `docs/privacy-operations/07-COUNSEL-REVIEW-QUEUE.md` P-02 ("72 h" is called a placeholder there). No notification deadline is asserted here.

## Context
- The plan is written and unexercised: status `DESIGNED / NOT TARGET-EXERCISED`, backup `UNASSIGNED` (`docs/trust/INCIDENT-RESPONSE-PLAN.md`); the public summary says "no tabletop has been run" (`docs/legal/INCIDENT-RESPONSE-SUMMARY-DRAFT.md`), while a founder tabletop is filed 2026-10-03 (`docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md`) with "no demonstrated automated alert-to-case route" (`docs/governance/FITNESS_FUNCTIONS.md` #16).
- DR is unproven: restore result tables empty, PITR "not verified" (`RESTORE.md`); only a local one-account logical rehearsal (`docs/evidence/restore/2026-09-30-logical-rehearsal.md`); `supabase/restore-drill.sh` written, never evidenced (findings-platform #1, P0). `docs/trust/BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md` says RTO/RPO "are not promised until measured".
- Detection: `.github/workflows/production-smoke.yml` hourly with no notify step; `app/public/status.html` "sends no notifications" (`MONITORING.md`); status-data branch holds 75 probe samples vs ~24/day expected (findings-platform header). CI `notify` job opens an issue when main is red with `continue-on-error: true` (`.github/workflows/ci.yml`); main failed 48 of 100 recent push runs, 11 consecutive `Test` failures 2026-10-04 17:52-18:03Z (findings-platform #4).
- Rollback: migrations reach production through Supabase Branching with no workflow or rollback; an 18 Sep silent failure is recorded (`ROLLBACK.md`; findings-platform #12). Session-invalidation lever never exercised; rotation log empty (`SECRETS.md`, `SECURITY.md`; #13).
- Single operator with no rota (`docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md`; EXT-009; findings-platform #7). Site copy says "24/7" (claim C-05; `company-site/index.html:662`).
- AI-specific response exists with one drill: `docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`; `docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json` (ADR-0014).
- Tenant-visible audit gaps hinder scoping an incident (findings-database #9): four audit stores, no single "what happened in school X" query.

## Problem
What must be true (named people, alert route, drill evidence, restore evidence, decision rights) before Semester may state an incident-response or recovery capability to any customer, and how is that kept true after it is first met?

## Decision drivers
1. A capability is stated only if a dated drill exercised it (CLAUDE.md measurement standard).
2. A human is reachable within a stated window, with a backup.
3. Recovery figures (RTO/RPO) are measured, never asserted.
4. Notification decisions have a named decision-maker before an incident (counsel).
5. Evidence of incident handling is retained and tenant-scopable.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Keep plans as drafts; rely on the founder | No cost | Single point of failure; contradicts any institutional representation | Not chosen |
| B. Contract an on-call/MSSP service now | Coverage | Cost; vendor access to data; counsel on subprocessors (Q-22) | Option for later |
| C. Evidence-gated commitments: appoint backup, add alert delivery, run restore and tabletop drills with a witness, then publish only what was exercised | Cheapest path to truthful claims | Slower claims | **Recommended** |
| D. Publish aspirational SLAs and RTO/RPO | Competitive parity | Unbacked representation (`docs/trust/SLA.md` `NOT_STARTED`) | Not chosen |

## Decision
**Recommended, unratified.** (1) Appoint a named backup operator and incident commander role; until then no document or page states 24/7 or response-time commitments. (2) Severity ladder and decision rights: SEV levels in `INCIDENT-RESPONSE-PLAN.md` are adopted as the single ladder; notification and safety-disclosure decisions stay with the roles counsel names under Q-16/Q-19 (counsel required). (3) Alert delivery: a failing production probe or a red `main` for more than N consecutive runs opens an on-call alert that reaches a human; N and window are for the owner. (4) Drills with evidence files in `docs/evidence/`: a restore on a second Supabase project with a non-author witness measuring RTO/RPO; a tabletop with the backup operator; a tenant-scoped incident reconstruction using the audit stores; a session-invalidation and secret-rotation exercise logged in `SECRETS.md`. (5) Migration rollback procedure written and exercised once (forward-fix is acceptable if stated). (6) Evidence expires (restore: 90 days proposed) and an expired drill removes the capability statement until re-run. Not ratified.

## Consequences
Positive: every incident statement carries a dated drill. Negative: Phase 1 time and cost; a backup operator must be found. Harder: marketing a response time.

## Impact
- **Data / tenancy:** restore drill must cover tenant isolation after restore (ADR-0021 boundaries).
- **Security:** rotation and invalidation levers exercised; branch protection readback (findings-platform #2).
- **Privacy:** breach-notification clocks and recipients are counsel's (P-02).
- **Accessibility:** status page and incident notices need accessible form; not assessed.
- **Operations (SLO, alert, runbook, support):** adds alert route, rota, drill calendar; links to ADR-0025 SLOs.
- **Cost / commercial:** premium-support and SLA terms (ADR-0016) depend on this.

## Implementation
1. Appoint backup; record in `INCIDENT-RESPONSE-PLAN.md`. 2. Add notify job to `production-smoke.yml`; add main-health threshold. 3. Run `supabase/restore-drill.sh` against a second project; fill `RESTORE.md` tables. 4. Tabletop with backup; file evidence. 5. Write and exercise rollback for migrations (`ROLLBACK.md`). 6. Publish only after drills (claims via ADR-0022).

## Tests and verification
- `scripts/architecture/alert-delivery.mjs` (proposed) injects a failing probe in a staging repo and asserts an alert artifact; fails today (no notify step). Control: healthy probe produces none.
- Restore drill: row-count and hash comparison of two accounts plus a cross-tenant read test after restore; failing case: a restore missing `private` schema objects.
- Evidence-expiry test: a drill dated 91 days ago removes the capability from `claims.ts` publication.
- `app/src/lib/ops/claims.test.ts` already refuses an "available" claim on expired evidence; add a case for incident-response claims.

## Fitness functions
- `alert-delivery` (#16): fails if no notify path on probe failure; `scripts/architecture/alert-delivery.mjs`.
- `restore-drill-freshness` (#17): fails if no dated drill within 90 days.
- `main-health` (#14): fails above the red-ratio threshold; `scripts/architecture/main-health.mjs`.
- `secrets-and-rotation` (#19): fails if the rotation log has no entry within the period.
- `drift-ran` (#15), `branch-protection-readback` (#13).

## Rollback / reversal
Policy-only until drills exist; reversible by superseding ADR. Any customer representation made on the basis of these drills is a contract matter (counsel required) and not cheap to retract.

## Open questions
Who is backup operator; RTO/RPO targets; whether PITR is enabled on the live project (not inspected); who decides notification (Q-16); jurisdictions J1-J2.

## Addenda
None.
