# Live-integration handoff: reconciliation

**Date** 2026-10-12 · **Base** `origin/main` `91cf0ddc` · **Source** "The Main Semester design system 3" export, `handoff/live-integration/` (9 files, migration `20261011120000_live_integration.sql`, five edge functions, one Playwright spec).

**Disposition: not applied.** The handoff proposes eight new `public.live_*` tables and five `live-*` edge functions. The repository already holds an authority for every one of them, and the handoff's own crosswalk (`REPO-CROSSWALK.md`: "The coding agent extends what exists. It does not create a parallel schema") forbids a second one. Applying it would add a second grant model beside `role_grants`, a second outbox beside `private.domain_outbox_events`, and a second kill switch beside `feature_kill_switch`. Each pair would disagree within a week.

This page maps each proposal to its owner, so the useful parts can be ported into the existing tables one at a time.

## Table by table

| Proposed | Existing owner (migration) | What to port, if anything |
| --- | --- | --- |
| `live_workspace_grants` | `role_grants` (`20260921223000`), `institution_membership` (`20260924150142`) | Nothing. Workspace access is a role grant scoped to a tenant. The "university email is not authority" rule already holds there. |
| `live_tenant_capabilities` (`enabled` needs `approval_ref`, `kill_switch`) | `tenant_module_mode` + `module_mode_request`/`module_mode_approval` (`20260930010000`), `feature_kill_switch` (`20260927170000`) | The CHECK constraint idea, enabled only with a named approver and reference, is already enforced through the approval rows. Compare before adding anything. |
| `live_integration_connections` (`secret_ref`, never the secret) | `integration_connections`, `integration_scopes`, `integration_mappings` (`20260927170000`) | Nothing structural. Confirm the existing row also stores a secret reference, never a value. |
| `live_sis_staging` | `private.roster_import_batch`, `roster_staged_row`, `source_records`, `source_snapshots` (`20260930220000`, `20260927170000`) | The OneRoster client-credentials reader in `live-sis-sync` is the one new behavior. It belongs behind the existing integration connection and writes to roster staging. Catalog row L-024 is blocked on a real OneRoster sandbox. |
| `live_command_receipts` (idempotent writes) | `registration_requests`, `registration_audit_event` (`20260929300000`), `private.domain_event_receipts` (`20260928320000`) | Nothing. Idempotency keys and receipts already exist, with the correlation-id limits recorded in the team notes (M14). |
| `live_outbox` | `private.domain_outbox_events` (`20260928320000`) | Nothing. The handoff itself says its outbox worker is not included. |
| `live_payments` | `billing_accounts`, `checkout_sessions`, `payment_events` and the `billing-*` functions (`20260929070000`, `20260929080000`) | Nothing. Stripe checkout and signature-verified webhooks already exist. |
| `live_messages` (in-app + Postmark email) | `public.messages` for in-app; no email provider wired. `support_notification_outbox` (`20261002003000`) queues support notices. | Email delivery is genuinely missing. Open work: #1464 (notification inbox foundation) and #1453 (operator `SendAdapter`, drafts-first, no real adapter wired). Port the Postmark adapter there, behind approval. |

## Edge functions

| Proposed | Existing | Note |
| --- | --- | --- |
| `live-lti` (OIDC login, JWKS-verified launch, single-use nonce) | `supabase/functions/lti` with `_shared/lti*.ts` and launch membership/entitlement migrations | Diff the nonce and deployment-allow-list handling against the existing launch before assuming either is complete. |
| `live-payments` | `billing-checkout`, `billing-webhook` | Duplicate. |
| `live-institution-command` | Gateway under `app/server/` and `packages/institution`, registration writeback behind `writeback.registration_submit` | Duplicate path. Institutional writes go through the gateway. |
| `live-sis-sync` | `integration-tick` | Port the OneRoster reader into the existing tick, not a new function. |
| `live-messaging` | none for email | See `live_messages`. |

## The release tests are worth keeping

`e2e/connected-journeys.spec.ts` asserts the right properties: an account reads only its own grants, a client cannot grant itself a workspace or switch a capability on, a disabled capability returns 423, a retried command returns the same receipt and one outbox event, a reused key with a different payload returns 409, a grant at one institution does nothing at another, students cannot submit final grades, and an unauthenticated call returns 401. They are written against the `live_*` tables. Rewritten against the existing owners above, they become the staging release check this repository does not yet have. That rewrite needs a staging Supabase project and two test institutions, which this session does not have.

## What needs a person

Applying any migration to a hosted project, setting provider secrets, and enabling `sis.read`, `lms.lti` or any official write for a real school. The handoff says the same: a staging test reference is not institutional approval.
