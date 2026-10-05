# Operations console: backlog

Ordered by dependency. Each item names the evidence it rests on. Sizes are
rough (S under 2 days, M under 1 week, L over a week) and have not been
estimated against the codebase by anyone who will do the work.

## Decisions needed before Phase 1 starts

| ID | Decision | Why it blocks | Recommendation |
|---|---|---|---|
| B-00 | Where do `/ops/*` routes live? | Navigation roots are frozen (`DO-NOT-BUILD` rule 1, `donotbuild.test.ts`); the app uses hash routing; a console already exists at `#/console` nested under `me`. | Extend Console: `#/console/<view>` for each `/ops` name, `/ops/...` kept as documented aliases. A new root needs portfolio approval. |
| B-01 | New tables in `private` or a new `ops` schema? | `rls-coverage`, `grants`, `definerregister` scan only `public` and `private`. | `private`, `projection_` prefix. |
| B-02 | Extend `domain_outbox_events` and `domain_event_receipts`, not recreate. | Brief assumes they are missing; they exist. | Extend. |
| B-03 | How does the browser learn a view changed? | No console realtime exists. | Poll a versions RPC first; add authorized Broadcast later. |
| B-04 | Freshness SLOs in `PROJECTION_AND_CACHE_POLICY.md` section 2. | Sets alert thresholds. | Founder confirms. |
| B-05 | Outbox retention window. | Sweep needs a number. | 90 days published; counsel confirms. |
| B-06 | Is F-1 (operator direct writes) fixed in this program or tracked separately? | The brief says approval-required actions cannot bypass approval; today they can. | Separate approved branch, **before** the console claims "cannot bypass approval". |

A decision record `docs/decisions/D-<pull request number>.md` is written after
the pull request is opened, per `CLAUDE.md`. None is written in Phase 0.

## Phase 0 (this branch): evidence only

Done: current state, exposure classification, architecture, permission matrix,
projection and cache policy, backlog, runbook. **Not done:** repository gates
and the SQL check suite (see the phase report for why).

## Phase 1: projection foundation (`feat/ops-projection-foundation`)

| ID | Item | Size |
|---|---|---|
| P1-01 | Migration: additive columns on `domain_outbox_events`; `projection_watermark`, `projection_invalidation`, `projection_rebuild_run`, `read_model_registry` in `private`; RLS on, no client grant | M |
| P1-02 | `private.emit_domain_event` helper with payload deny-list and hash | S |
| P1-03 | `claim_domain_events` (SKIP LOCKED, stale claim), `complete`, `fail` (bounded backoff, dead letter), `replay_dead_letter` (capability + audit) | M |
| P1-04 | Edge Function `ops-projector` and cron entry, following `support-reply-notify` | M |
| P1-05 | Outbox retention sweep gated by legal holds | S |
| P1-06 | Producers: approvals, rollout, support severity, kill switch (same transaction) | M |
| P1-07 | Projections: tenant health, inbox | L |
| P1-08 | `ops_*` read RPCs with the standard envelope (executive, tenant, inbox, projection dashboard first) | L |
| P1-09 | SQL checks: atomic write+event, duplicate event no duplicate effect, concurrent claim, bounded retry, dead letter needs replay, receipts idempotent, watermark lag, rebuild equals incremental | L |
| P1-10 | Fix F-3 (`my_capabilities` and break-glass) with a check | S |

## Phase 2: core command center (`feat/ops-command-center-p0`)

Add views to Console (not a second screen): Overview, Inbox, Tenants + detail,
Releases, Trust, Support overview, Audit explorer, Projections, My work. Wire
through `Screen`, `screens.tsx`, `nav.ts`, `screen-governance.ts`,
`nav.registry.test.ts`, `ops/console.ts` `VIEWS`, then `npm run registers`.
Component library under `app/src/ops/components` only where `components/ui.tsx`
has no primitive (the style audit forbids custom buttons, cards, modals, tabs).
Data client under `app/src/ops/data`. State: in-memory only.

## Phase 3: tenant lifecycle and health

Pre-contract and post-annual states only; reuse `tenant_rollout` and
`school_offboarding`. Explainable health with named sources and `unknown` for
components with no source (adoption, reliability).

## Phase 4: incident, SLO, access review

New tables are required; none exist. Reuse `lib/governance/error-budgets.ts` and
`incident-comms.ts` as logic. New capabilities `incident:command`, `access:review`
need a migration and threat model. Fix F-5 here.

## Phase 5 and 6

Business workspaces (customers, pilots, implementation, revenue, billing,
integrations, privacy, compliance) as read models over existing tables. Then
reports, exports, executive review generator, and the CQRS simulator
(`app/src/lib/ops` pure model plus a Console view; no database).

## Test debt to close (from the audit)

| ID | Test | Phase |
|---|---|---|
| T-01 | Every new read RPC: forbidden vs empty, cross-tenant, field minimization | each |
| T-02 | Approval cannot be bypassed for each duty with a direct write path (red until F-1 is fixed) | before "cannot bypass" claim |
| T-03 | Per-table assertion that the 63 no-policy tables have no client grant | 1 |
| T-04 | Break-glass expiry removes access and an overdue review is surfaced | 1 |
| T-05 | Browser storage untouched by a console session (four stores) | 2 |
| T-06 | Optimistic helper throws for non-allow-listed actions | 2 |

## Production-ready definition (copied from the brief, unchanged)

Not claimed until: every sensitive action has an authorization test; every
tenant or customer screen has a scope test; approval-required actions cannot
bypass approval; break-glass expires and is audited; sensitive operations are
not reachable through unscoped table access; existing gates pass; advisor
findings are remediated, accepted with reasoning, or tracked with an owner and
deadline (owners and deadlines are proposed in `SECURITY_EXPOSURE_CLASSIFICATION.md`
section 9 and still need confirming).
