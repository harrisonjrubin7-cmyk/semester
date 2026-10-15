# Security exposure classification

Read-only audit. **No grant, policy, or function was changed.** Source: Supabase
security advisor and catalog queries against `lzrqvlugnawcgywkhqlz`, 2026-10-05.
Classes follow the brief. Nothing here is a remediation; each "needs" row is a
future branch with its own migration, test, threat model and explicit approval.

Classes: **P** intentionally private/internal · **R** intentionally exposed and
RLS-protected · **C** intentionally callable RPC · **N** needs privilege
narrowing · **M** needs a dedicated read-model RPC · **T** needs authorization
tests · **X** needs remediation · **A** accepted risk (owner + deadline).

## 1. Advisor summary (4 lint types, 4 findings groups)

| Lint | Level | Count | Class overall |
|---|---|---|---|
| `rls_enabled_no_policy` | INFO | 63 tables (30 private, 33 public) | P, with exceptions below |
| `pg_graphql_anon_table_exposed` | WARN | 32 (31 tables, 1 view) | R/N, see 3 |
| `pg_graphql_authenticated_table_exposed` | WARN | 289 (287 tables, 2 views) | R, T |
| `authenticated_security_definer_function_executable` | WARN | 205 functions | C, T |

Catalog context: `public` has 321 tables, **all with RLS on**; `private` has 31,
all RLS on. Two views, both `security_invoker=true`. **Zero** SECURITY DEFINER
functions in `public` are executable by `anon`. **Zero** SECURITY DEFINER
functions lack a `search_path` setting.

## 2. `rls_enabled_no_policy` (63)

RLS on with no policy means deny-all to API roles. That is the intended
private-by-default pattern, provided no direct grant exists.

| Tables | Authenticated grant? | Class | Note |
|---|---|---|---|
| `app_admins`, `payment_events`, `support_tickets`, `support_ticket_messages`, `support_notification_outbox` | none | P | Reached only by RPC or service role. `payment_events` and support tables are exactly the ones the console must never browse directly. |
| `private.domain_outbox_events`, `domain_event_receipts`, `console_audit_*`, `ledger_chain*`, `gateway_*`, `direct_rate_limit`, `account_ages`, `ai_usage_*`, … | none (private schema) | P | Private schema not exposed. |
| `beta_*` (8), `gtm_prospects`, `gtm_consent`, `gtm_suppression`, `gtm_communication_events`, `gtm_conversion_events`, `site_leads`, `site_lead_hits`, `invites`, `lti_*`, `roster_*`, `scim_credential`, `registration_*`, `school_offboarding_undo`, `integration_simulation_runs`, … | none per migrations | P | Mutated only through DEFINER RPCs. **T:** confirm with `grants.check.sql` (not re-run here). |

Accepted as intentional. Add a row-per-table assertion that these have no
client grant (T-03 in the backlog); `rls-coverage.check.sql` already covers part.

## 3. `pg_graphql_anon_table_exposed` (32)

`anon` can `select` these tables: `appointments, blocks, calendar_feeds,
commercial_plans, commercial_prices, commercial_products, courses, enrollments,
entitlement_definitions, family_grants, form_publications, group_members,
group_tasks, groups, message_reactions, messages, notes, organization_members,
organizations, plan_entitlements, profiles, published_forms, push_devices,
push_queue, referral_codes, referrals, reports, schools, sittings, state, tasks,
usage`.

- **R (probably intended):** `commercial_products/plans/prices`,
  `entitlement_definitions`, `plan_entitlements` (public price book), `schools`
  (login picker), `published_forms` (public forms).
- **N/T (needs a decision):** the remaining ~25 are per-user data (`notes`,
  `tasks`, `messages`, `push_queue`, `push_devices`, `profiles`, `family_grants`,
  …). RLS should return no rows to `anon`, but **an anon `select` grant on user
  data is not required for anon to function** and widens schema discoverability
  through GraphQL. The `anon` grant is probably a Supabase default-privilege
  artifact. **Not verified:** whether each has an `anon`-reachable policy.
  Action: for each, read `pg_policies` roles; if no policy applies to `anon`,
  the grant is dead and can be narrowed (F-4).
- Not an operations-console surface. Listed because the brief demands the
  classification.

## 4. `pg_graphql_authenticated_table_exposed` (289)

Every authenticated user can discover 287 tables via GraphQL introspection and
`select` through RLS. Operations-relevant ones are classified in section 5. For
the console the rule is: **the console never reads these tables.** It reads only
capability-checked RPCs (section 7).

## 5. Browser-writable high-risk tables (finding F-1, most important)

Live: **129 public tables grant INSERT/UPDATE/DELETE to `authenticated`**, gated
only by RLS policies. Those policies were read for the operations-relevant ones:

| Table | Write policy | What it means |
|---|---|---|
| `feature_kill_switch` I/U | `killswitch:engage` at platform (tenant null) or school scope | Any holder can engage or release a **platform** kill switch directly. No request, no approval, no console audit event. |
| `tenant_feature_policy` I/U/D | `tenant:configure` over the school | A tenant admin changes feature policy directly. The `tenant-policy` duty is not on this path. |
| `tenant_sso_policy` I/U | `tenant:configure` | SSO policy changed directly. |
| `scim_group_mapping` I/U | `tenant:configure` | Same. |
| `feature_cohort_members` I/U | `tenant:configure` | Same. |
| `provider_registry` I/U | `platform:configure` | AI/provider registry directly writable (duty `ai-provider` exists). |
| `trust_artifacts` I/U, `trust_artifact_versions` I | `trust:publish` | Direct publish. |
| `gtm_pilot_metrics` I/U/**D**, `gtm_accounts`, `gtm_pilots`, `gtm_decision_log` | `account:manage` platform | Direct CRUD including **delete** of pilot metrics. |
| `legal_holds` I, release U | `hold:place` / `hold:release` | Two-person release is a check constraint, not an approval. |
| `schools` ALL (role `public`) | `private.is_app_admin()` | Legacy admin gate; policy is on role `public`, effective only for the admin. |
| `human_overrides` I | `override:record` | Recorded, by design. |

Classification:

- **Tenant-admin writes to their own tenant** (`tenant:configure`): R. A school
  administering its own configuration is a customer feature, not an operator
  action. Needs **T** (a cross-tenant write test per table).
- **Platform-operator writes** (`killswitch:engage`, `platform:configure`,
  `trust:publish`, `account:manage`): **X/N**. These bypass
  `request → evidence → approval → execution → audit` that the brief and the
  `console_duty` matrix (`release`, `ai-provider`, `evidence-release`,
  `tenant-policy`) require. They are authoritative today, and the console must
  **not** add a second, UI-only gate on top; it must route through RPCs.
- Remediation is a separate, approved migration (move writes behind
  `console_act`-style RPCs, then revoke table DML). **Do not revoke blindly:**
  `Console`-adjacent screens (`lib/integration/*`, `modulegate.ts`, community)
  currently depend on the direct writes (finding in the frontend survey).

## 6. SECURITY DEFINER functions (205 executable by `authenticated`)

- All set `search_path = ''` (live check: none missing).
- None executable by `anon` in `public`.
- `private.has_capability` and `has_capability_anywhere` are executable by `anon`
  and `authenticated`. The `private` schema is not exposed to the API, so this
  is not an API surface; it is required so RLS policies can call them.
- Class **C** for the console set (`request_approval`, `decide_approval`,
  `console_act`, `close_break_glass`, `review_break_glass`, `console_audit_*`,
  `console_figures`, `console_command_center`, `my_capabilities`).
- Class **T** for the other ~190: `definer-sweep.check.sql` calls each as an
  empty-handed account; `grants.check.sql` holds the allowlist. They are covered
  generically, not per-scope. School-offboarding exposes 12 DEFINER RPCs to
  `authenticated` whose operator gate is the legacy `is_app_admin()` (class N:
  migrate to capabilities).
- Three INVOKER readers (`console_approvals`, `console_break_glass`,
  `console_customers`) depend on RLS only and return every tenant's rows to any
  `console:operate` holder. Class **M**: replace with scoped read models.

## 7. Operations-domain tables and the console rule

| Domain | Tables | Browser read today | Console rule |
|---|---|---|---|
| Billing | `billing_accounts, subscriptions, invoices, payment_events, credits_refunds, dunning_*` | RLS select via `can_read_billing`; `payment_events` none | RPC only; aggregates and redacted. |
| Support | `support_tickets, support_ticket_messages` | none (RPC only) | Aggregates only; message bodies never in console read models. |
| Trust | `trust_room_*` | staff select; token hash hidden | Counts, review dates; no tokens. |
| Compliance | `compliance_*, control_evidence, claims_register` | `compliance:manage` select | Status and expiry only. |
| Privacy | `data_subject_request, legal_holds` | own rows + tenant `audit:read` | Counts and deadlines; no subject identity. |
| Integrations | `integration_*` | `integration:view` select; connections: no `authenticated` select | Health counts; **no raw payloads, no credentials**. `lib/integration/dashboard.ts` reads these directly today (T). |
| Rollout | `tenant_rollout*` | `tenant:configure` / `audit:read` select | Via read model. |
| Audit | `audit_event`, per-domain audit tables, `private.console_audit_event` | `audit:read` select; chain private | `console_audit_read` RPC only. |

Direct browser reads of sensitive tables already exist outside the console
(`lib/membership.ts`, `lib/gtm/manager.ts`, `lib/integration/dashboard.ts`,
`lib/data-rights.ts`, and others; list in the frontend survey). They are
RLS-protected and are **not** to be copied into the console.

## 8. Other exposure notes

- No service-role credential in client code. Guard: `lib/ops/boundaries.test.ts`
  (`SERVICE_ROLE` regex). Browser key is `VITE_SUPABASE_KEY`, publishable.
- Realtime publication is only chat tables, so a console invalidation channel
  would be new surface and needs its own authorization (see Projection and
  Cache Policy). Supabase Realtime Broadcast **must not** carry ops payloads
  over a public channel.
- `pgmq`, `net`, `realtime`, `supabase_migrations` have tables with RLS off;
  those schemas are platform-managed. Class A, owner: platform lead, deadline:
  confirm schema exposure setting in the 2026-10 review (unverified: the exposed
  schema list was not readable through SQL here).
- `console_audit_event` is empty. Verify the writer role, hash chain and daily
  seal job run before relying on them (`console-audit-integrity` cron exists).

## 9. Owners and deadlines for accepted or tracked items

Owners are roles, because the repository does not name individuals for these.
Deadlines are proposals for the founder to confirm.

| ID | Item | Class | Owner role | Proposed deadline |
|---|---|---|---|---|
| F-1 | Operator writes bypass approval (kill switch, provider registry, trust, GTM) | X | security architect | design before Phase 1 ships; migration within Phase 4 |
| F-2 | INVOKER console readers return all tenants | M | platform engineer | Phase 2 |
| F-3 | `my_capabilities()` omits break-glass grants | T | platform engineer | Phase 1 |
| F-4 | `anon` select grants on per-user tables | N | security architect | next security review |
| F-5 | Offboarding RPCs gated by legacy `is_app_admin()` | N | platform engineer | Phase 4 |
| F-6 | Outbox has no publisher, retention sweep, or lag surface | M | platform engineer | Phase 1 |
| F-7 | Console audit chain unproven in production (0 rows) | T | security architect | before any Phase 1 write path ships |
