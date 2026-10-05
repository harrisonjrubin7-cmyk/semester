# ADR-0020 · Staff access to customer data is school-scoped, consent- or break-glass-based, logged, and reviewed

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Security owner with support operations owner (founder until others are named) |
| Deciders / reviewers | Founder; privacy owner; customer administrators (per tenant); counsel for student-record access by vendor staff, vendor/outsourced staff and sanctions (counsel required) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 gate "no staff capability reads across schools without a grant" |
| Related | [`privileged-surface-map.md`](../../architecture/security/privileged-surface-map.md) §6-8; [`tenant-boundary-map.md`](../../architecture/tenancy/tenant-boundary-map.md) rows 15-16; `docs/architecture/multi-tenant-isolation.md` invariant 7; `docs/SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md`; `docs/legal/SUPPORT-POLICY-DRAFT.md`; ADR-0017, ADR-0018; legal rows P-16, Q-04, Q-22, Q-24 |
| Supersedes / superseded by | — |

> **Counsel required.** Whether consent-plus-time-box suffices for FERPA-style access by platform staff, student visibility of access, outsourced after-hours triage and staff-misuse sanctions: `docs/privacy-operations/07-COUNSEL-REVIEW-QUEUE.md` P-16; `LEGAL_REVIEW_QUEUE.md` Q-04, Q-22, Q-24. The matter is a question, not a finding.

## Context
- Student-granted support access: `support_access_grant` and `support_access_event` with reason, expiry and an index by `tenant_id, occurred_at` (`supabase/migrations/20260925103000_support_access.sql:69,107,127`; `supabase/support-access.check.sql`); "read audit on every access not confirmed for all record types" (privileged-surface-map §7).
- Support tickets and replies: `20260928210000_support_tickets.sql`, `20261002003000_support_notification_outbox.sql`, `20261003120000_support_notification_consent_boundary.sql`; the `support-reply-notify` function authorises agents by a **platform-scope** `support:ticket` capability (`supabase/functions/support-reply-notify/index.ts:mayAnswer`), so any holder reads across schools (findings-database #8). Cron path compares a bearer with `===` (`_shared/supportnotify.ts:55`).
- Moderation reviewers: `community:review` checked at platform scope in `20260928032000_community.sql:private.media_read_allowed`.
- Break-glass: `20260929110000_console_approvals_and_break_glass.sql` (`break_glass_grant` opened only by `console_act` on a two-person duty, max four hours, review by someone other than holder, overdue review blocks the next, audit written before effect), `20260930160000_override_break_glass.sql`; honoured inside `private.has_capability` for **school scope only**; checks `supabase/console-approvals.check.sql`, `console-control-plane.check.sql`, `ledger-chains.check.sql`.
- Platform admin: `private.is_app_admin` (`20260921161500_roles.sql`); multi-tenant-isolation invariant 7 says admin status grants no data; callers were not enumerated (privileged-surface-map §7).
- Operator SQL (`supabase/analytics.sql`, `health.sql`, `advisor-probe.sql`) runs with owner rights in the dashboard, unaudited by the repository (privileged-surface-map §8).
- Service-role Edge Functions bypass RLS (13 of 16; `SECRETS.md` row `SUPABASE_SERVICE_ROLE_KEY`); `SEMESTER_AUTH_SERVICE_KEY` absent from `SECRETS.md` (findings-database #12).
- One operator holds every role (findings-platform #7); SLA not started (`docs/trust/SLA.md`).

## Problem
What access may Semester staff and operator tooling have to a school's or a person's data, through which mechanism, with what record, and what refuses everything else?

## Decision drivers
1. No staff capability reads across tenants by default (invariant 7).
2. Access is grant-bound: student consent for support, school-scoped capability, or break-glass with review.
3. Every access leaves a tenant-visible record.
4. Operator tools used with owner rights are inventoried and replaced or logged.
5. Separation of duties is realistic for a one-person company (compensating review).

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Keep platform-scope support/review capabilities | Simplest | Cross-tenant read for any holder; conflicts with invariant 7 | Not chosen |
| B. Only break-glass for any customer data | Strongest | Slow for routine tickets; two-person duty unrealistic for one operator | Not chosen as sole path |
| C. Scoped model: (1) ticket-bound reads need a grant tied to the ticket and tenant; (2) moderation uses school-scoped review capability or a platform queue with redacted views; (3) break-glass for emergencies with post-hoc review by someone other than the actor (a named external reviewer if staff is one person) | Matches existing tables | Needs scope change in two functions and a grant UI | **Recommended** |
| D. Outsource support access to a vendor | Coverage | New subprocessor; counsel (Q-22) | Later |

## Decision
**Recommended, unratified.** (1) Support and review capabilities become school-scoped (`scope_kind='school'`) or are gated by an active `support_access_grant` tied to a ticket; a platform-scope holder sees only the ticket and redacted fields. (2) Every staff read of customer rows writes a tenant-queryable event (extend `support_access_event` to all record types the console reads); school administrators can list them. (3) Break-glass remains the only cross-tenant emergency path, for school scope; its review is performed by a person other than the actor, naming an external reviewer while staff is one person. (4) `is_app_admin()` grants no data: enumerate its callers and remove any data read. (5) Operator SQL is inventoried; any query reading customer rows moves to a logged definer or an audited console figure. (6) Secrets: add `SEMESTER_AUTH_SERVICE_KEY` and `SEMESTER_JOURNAL_KEY` to `SECRETS.md`; use constant-time comparison for function bearers. (7) Staff-misuse sanctions and external reporting follow counsel (Q-24). Not ratified.

## Consequences
Positive: access is explainable to a school. Negative: support is slower; grant UX and school scoping work; one-person separation of duties stays weak. Harder: ad-hoc debugging in the dashboard.

## Impact
- **Data / tenancy:** capabilities scoped by `tenant_id`; audit by tenant.
- **Security:** removes platform-wide read; fewer owner-rights queries.
- **Privacy:** support reads of education records need counsel's view on consent sufficiency (P-16).
- **Accessibility:** a student-facing "who accessed my data" view must be accessible; none exists.
- **Operations (SLO, alert, runbook, support):** support response targets must not assume cross-tenant tooling; ties to ADR-0018 and ADR-0025.
- **Cost / commercial:** premium support (ADR-0016) is built on this path.

## Implementation
1. Migration changing `support:ticket` and `community:review` checks to school scope or grant-bound (forward-only). 2. Extend `support_access_event` coverage. 3. Update `mayAnswer` and cron comparison. 4. Enumerate `is_app_admin` callers (grep in migrations) and file the list. 5. Operator SQL inventory in `privileged-surface-map.md`. 6. `SECRETS.md` additions and rotation entry.

## Tests and verification
- `supabase/support-scope.check.sql` (proposed): an agent holding `support:ticket` for school A reads a ticket of school B: refused; fails against today's platform-scope check. Control: agent reads school A ticket.
- Break-glass: an actor reviewing their own grant is refused (exists in `console-approvals.check.sql`; confirm).
- Audit test: any staff read of a customer table via the console writes an event (fails for record types not yet logged).
- Constant-time compare unit test for `_shared/supportnotify.ts`.

## Fitness functions
- `tenant-boundaries` (#5): staff-role sweep in the negative suite; `scripts/architecture/tenant-boundaries.sh`.
- `definer` (#4): console and support definers have identity gates and stranger tests.
- `audit-outbox` (#8): a console read without an event fails.
- `secrets-and-rotation` (#19): `SECRETS.md` lists every service key.
- `grant-allowlist` (#2).

## Rollback / reversal
Scope changes are reversible by migration but widen access; reversing requires a new ADR. A grant history is retained.

## Open questions
Names of `is_app_admin` callers; read-audit coverage by record type; whether outsourced staff are planned (Q-22); production state of grants.

## Addenda
None.
