# Semester Command Center — current state and slice plan

Date: 2026-10-26. Baseline: `origin/main` at `9b248bab`.
Evidence standard: a row is "built" only when code and a test exist in this repository. Nothing here
claims deployment, production enablement or institutional authorization; none of those were checked.

## Direct answer

Semester already has the Command Center shell. It is the operations console at `#/console`
(`app/src/screens/Console.tsx`), gated on a signed-in account holding `console:operate` at platform
scope, with 18 capability-registered workspaces (`app/src/lib/console/workspaces.ts`), a context bar
(environment, identity, grants, MFA freshness), saved views stored server-side, and a fail-closed
exception queue. It is not rebuilt or re-scaffolded here. This slice adds the missing piece of
slice A — a cross-workspace **My work** queue with a truthful overview and record details — inside
that shell.

## What exists and is reused

| Ask (prompt §) | Existing implementation | Evidence |
| --- | --- | --- |
| Authorized shell (§2, §10A) | `/console` gate on `console:operate`; per-workspace capability registry; discoverability ≠ access, every reader re-authorizes server-side | `screens/console.test.tsx` "the gate", `lib/console/workspaces.test.ts` |
| Identity, roles, capabilities | `app_roles`, `app_capabilities`, `role_grants`, `private.has_capability` | `supabase/migrations/20260922012000_capabilities.sql`, `supabase/rolegrants.check.sql` |
| Operating scopes (§2) | Platform scope for company ops; exact-school scope for tenant ops, privacy, integrations; student data never exposed by console grants | `20261005120000_console_scoped_tenant_access.sql`, `OPS-CONSOLE-DISCOVERY-AUDIT.md` §Data-domain isolation |
| Truthful exceptions (§4) | `console_command_center` RPC: green only when empty; every row names source, evidence, limitation, next safe step | `supabase/console-command-center.check.sql`, `CommandCenter.tsx` |
| Controlled approvals (§7) | Duties matrix; request is immutable after creation (trigger pins target/detail/evidence); 7-day expiry enforced at decide and act; one decision per person; requester cannot approve; two-person duties; fail-closed `console_act` writes audit first; fresh MFA step for privileged writes | `20260929110000_console_approvals_and_break_glass.sql`, `supabase/console-approvals.check.sql`, `Approvals.tsx` |
| Audit (§7, §8) | Append-only hash-chained `console_audit_event`; reads are audited | `20260929100000_console_control_plane.sql` |
| Metrics with provenance (§4) | Figures: source, window, environment, owner, last refresh, evidence, limitation; "billing says there is no billing" | `Figures.tsx`, `lib/ops/console.ts` `FIGURE_PROVENANCE` |
| Break-glass, support access | 4-hour max, review due, subject closes, other person reviews | `BreakGlass.tsx`, support-access migrations |
| Tenant ops, privacy, integrations, release/incidents, launch gates, controls, evidence | Each its own workspace and capability | `components/console/*`, tests beside each |

## What this slice adds

`My work` workspace (`work`, `console:operate`, classified restricted):

- **Unified queue** over three existing readers — `console_command_center`, `console_approvals`,
  `console_integration_health` — normalized into one shape (`lib/console/workqueue.ts`).
- **Grant-aware reads**: a source is read only when its owning workspace is discoverable from the
  operator's grants; otherwise it shows "Not in your grants — not read" and is never called.
- **Truthful overview**: counts by priority; when any granted source fails or is loading, the total is
  labelled a floor ("At least N"), never a count. Unknown is never zero.
- **Approvals as work** only when movable: awaiting my decision, mine waiting on approvers, mine
  approved but not executed. Expired requests are dropped; ones expiring within 24h are raised.
- **Record details**: reason it is mine, owner, tenant, due, next safe step, evidence, limitation,
  source reader, observed time.
- **No new write path.** "Open in …" hands the record to the workspace that owns its actions, where
  MFA and server checks apply. No new RPC, migration or capability.

Tests: `lib/console/workqueue.test.ts`, `components/console/MyWork.test.tsx`. Both were reverted
against a broken overview (unavailable counted as read) and went red.

## Information architecture reconciliation (§3)

The requested 36 navigation entries are proposals. Status against the repo:

| Group | Entry | State |
| --- | --- | --- |
| Home | Command Center | Built (`command`) |
| Home | My Work | Built in this slice (`work`) |
| Home | Approvals | Built (`approvals`) |
| Home | Action Center, Calendar, Search | Student-facing equivalents exist (`Today`, `Calendar`, `Search` screens); no operator-scoped version. Operator search must be domain-specific and classification-aware (audit risk 5) |
| Build | Releases and Rollouts | Built (`releases`, `release-incidents`, `launch`) |
| Build | Documentation and Decisions | Repo docs + `docs/decisions/`; no console view |
| Build | Product/Roadmap, Research/Design, Engineering, Quality/Testing | Not built as console workspaces |
| Customers | Institutions and Tenants | Built (`customers`, `tenant-operations`) |
| Customers | Support | Built (`support`, behind `support:ticket` and a flag) |
| Customers | Pilots | Built in slice B (`pilots`, behind platform `account:manage`; read-only; `console_pilots` RPC, `supabase/console-pilots.check.sql`) |
| Customers | Sales/Pipeline, Implementations, Customer Success | Schema exists (`gtm_foundation`, `commercial_core`); no console workspace yet |
| Operate | Integrations and Syncs | Built (`integration-health`) |
| Operate | Incidents | Built (`release-incidents`) |
| Operate | Platform/Reliability, Data Quality, AI Operations, Developer/Partner Ops | Projection health only; rest not built |
| Business | Finance | Finance model view (`finance`) — a model, not booked figures |
| Business | Revenue/Billing | Schema exists; Figures states billing is not live |
| Business | Growth, People/Access, Vendors/Legal, Strategy/Risks/Board | Not built |
| Govern | Audit and Evidence | Built (`audit`, `evidence`, `controls`) |
| Govern | Privacy | Built (`privacy`) |
| Govern | Security, Accessibility, Policies, System Settings | Registers in repo docs; not console workspaces |

## Plan (dependency order; nothing later is dropped)

1. **A — this PR.** My work queue, overview, record details. Next in A: add `console_release_incidents`
   and `console_privacy_requests` as queue sources (both readers exist), and a server-side
   `console_my_work` RPC only if client fan-out becomes a performance problem.
2. **B — customers.** *Pilots done (read-only): `console_pilots` requires `console:operate` and platform
   `account:manage`, returns no free text, and its SQL check (11 assertions) went red when the
   `account:manage` gate was removed.* Next: implementation and customer-success workspaces reading `gtm_foundation` and
   `commercial_core` as systems of record; map the legacy `customer*` console tables first (audit risk 3).
   Each needs its own capability, scoped RPC and a negative cross-tenant check.
3. **C — build and operate.** Product/engineering delivery view reading GitHub through a server-side
   adapter (no tokens in the browser); reliability from real telemetry only.
4. **D — business and govern.** Sales, success, growth, finance, people, vendors, AI governance, risk.
   Financial actions stay request-only approvals; no autonomous refunds or payments.

## Blockers and owners

| Blocker | Owner | Needed for |
| --- | --- | --- |
| No access from this session to a running Supabase project; SQL checks (`supabase/check.sh`) not run | Harrison / platform owner | Verifying RPC behaviour against a live database |
| No staging deployment target confirmed for the console | Harrison | Deployed-state evidence |
| GitHub, telemetry and billing provider credentials for read adapters | Harrison | Slice C and D data |
| Product decision on operator-wide search scope | Harrison + privacy reviewer | Home › Search |

## Activation gates for this slice

Designed ✓ · Implemented ✓ · Tested (unit/component) ✓ · Deployed ✗ · Production-enabled ✗.
Institution authorization does not apply: the queue shows company-operations records only and adds
no read of student or institution data beyond what each existing reader already returns.
