# Privileged surface map

- **Purpose:** list every place that runs with more authority than the signed-in browser user: definer functions, service-role code, direct browser grants, Edge Function entry points, secrets, break-glass, support access, admin consoles. For each: its guard, evidence, gap, classification.
- **Scope:** `supabase/`, `app/server/`, `app/api/`, `.github/workflows/`, `database/`, `docs/DEFINER-RLS-REGISTER.md`. Repository audit only. Nothing was run against production or a database.
- **Date:** 2026-10-04. **Status:** Phase 0 baseline — evidence-cited, not a readiness claim.
- **Method:** `ls supabase/functions`; `sed`/`grep` of each `supabase/functions/*/index.ts` for `getUser`, `SERVICE_ROLE`, `CRON_SECRET`, signature checks; `supabase/config.toml` `[functions.*]` blocks; `grep -rhE 'grant execute on function .* to .*service_role' supabase/migrations | wc -l` (94 statements across history); reads of `database/FUNCTION_AUTHORIZATION_MATRIX.md`, `database/GRANT_ALLOWLIST.md`, `docs/DEFINER-RLS-REGISTER.md`, `app/src/lib/definerregister.ts`, `supabase/grants.check.sql`, `supabase/definer-sweep.check.sql`, `SECRETS.md`. Companion: `docs/architecture/tenancy/tenant-boundary-map.md`.
- Repo documents are claims. "Measured" means the document says it read the production catalog on 2026-10-04 (`database/README.md`); this audit could not re-measure.

## 1. Security definer functions

Counts (measured by catalog per `database/FUNCTION_AUTHORIZATION_MATRIX.md`, schema `inventory.sql` q4/q5): public 290 functions, 269 definer, 205 executable by `authenticated`, 0 by `anon`, 0 without pinned `search_path`, 0 PUBLIC. private 336 functions, 235 definer, 45 `authenticated`, 22 `anon` (policy helpers), 0 unpinned, 0 PUBLIC.

Register (`docs/DEFINER-RLS-REGISTER.md`, rendered from `app/src/lib/definerregister.ts`): 205 callable definers in public by category.

| Category | Count | Required controls per register | Guard | Gap | Classification |
|---|---|---|---|---|---|
| self-service | 60 | `auth.uid()`, scope, ownership, validation, rate limit, audit | `app/src/lib/definerregister.test.ts` (row set must equal winning definitions intersected with `supabase/grants.check.sql` allowlist; literal gates must be in body); `supabase/definer-sweep.check.sql` | Gates structural (DR-02 in `definerregister.ts`). Audit and rate limit not required by the test | PARTIAL |
| sharing | 19 | consent, narrow scope, expiry, revocation, view audit | same; `supabase/share-audit.check.sql`, `supportshares.check.sql` | Only some sharing paths write audit (`20260930190000_advisor_share_audit.sql`) | PARTIAL |
| admin | 74 | capability, MFA for high risk, dual control, immutable audit | register rule: an admin row must name a non-`auth.uid()` gate; `supabase/console-control-plane.check.sql`, `console-approvals.check.sql`, `role-grant-audit.check.sql`, `rolegrants.check.sql` | MFA/dual control are in the console duty matrix only; most admin functions are single-capability. Not every function mapped to a duty (not verified) | OPERATIONAL-UNDER-GOVERNED |
| integration | 6 | server-only, signed, replay protection | `supabase/integration-hardening.check.sql`, `integration-tick-auth.check.sql` | Counted as browser-callable (205 is the authenticated-executable set), contrary to the register's own "server-only preferred" | UNKNOWN-INVESTIGATE |
| financial | 3 | webhook verification, idempotency, no client final state | `database/FUNCTION_AUTHORIZATION_MATRIX.md` correction: `purge_financial_records`, `run_dunning`, `apply_payment_event`, `upsert_provider_invoice(_v2)`, `gateway_write_audit_v2` are service-only (tested with `has_function_privilege`) | The 3 category rows are browser-callable; their names were not read in this audit | UNKNOWN-INVESTIGATE |
| moderation | 15 | capability, reason, appeals, audit | `supabase/moderation-audit.check.sql`, `reports.check.sql`, `community.check.sql` | `community:review` is checked at platform scope (`20260928032000_community.sql:private.media_read_allowed`) | OPERATIONAL-UNDER-GOVERNED |
| read-helper | 28 | minimal fields, no hidden cross-tenant aggregation, pagination | register rows | `kill_switch_engaged(switch, tenant)` answers for any tenant (DR-01, accepted, severity low) | PARTIAL |

Open items recorded by the repo itself: `app/src/lib/definerregister.ts` `OPEN` DR-01 (`kill_switch_engaged`), DR-02 (structural gates; closed by sweep), DR-03 (49 policy-less tables pinned to a reading), DR-04 (anon table over-grants).

Findings from reading the measured docs: 36 of 250 authenticated-executable definers show no regex-visible gate; two bodies were read (`gradebook_export`, `community_session_counts`) and are gated; the `beta_*`, `support_*`, `*_school`, offboarding, `help_inbox`, `my_beta`, `beta_known_issues_for_me` set is "unreviewed" (`database/FUNCTION_AUTHORIZATION_MATRIX.md`). Production has 25 more authenticated-callable definers than the register's last count (205 vs 180), "unreconciled" in the same file. The register file itself now reports 205, so part of this may be resolved; the diff of names was not done.

`private` schema: not exposed to PostgREST (`supabase/rls-coverage.check.sql` header: "`config.toml` names no extra schemas"); `anon` EXECUTE on 22 private helpers is how policies reach them.

## 2. Service-role use

| Place | Key | What it does | Guard | Evidence | Gap | Classification |
|---|---|---|---|---|---|---|
| 13 of 16 Edge Functions (not billing-cancel, billing-portal, productivity-sourcecheck) create a client with `SUPABASE_SERVICE_ROLE_KEY` | injected by platform | see section 4 | each function's own credential check | `grep -c SERVICE_ROLE supabase/functions/*/index.ts` (13 files) | Service key bypasses RLS (`SECRETS.md` row `SUPABASE_SERVICE_ROLE_KEY`: "Everything"). Tenant filtering is code-level | OPERATIONAL-UNDER-GOVERNED |
| Institution gateway (`SEMESTER_AUTH_SERVICE_KEY`) | env (`.env.example` name per `docs/developers/ONBOARDING.md:129`) | membership directory, SSO config, action journal, rate limiter, SCIM, intelligence repository | token verify then membership reload; `.eq('tenant_id', identity.institutionId)` | `app/server/institution/runtime.ts:40-49`, `membership.ts`, `postgres-journal.ts`, `postgres-scim.ts`, `intelligence-repository.ts`, `rate-limit.ts` | No structural test that every service query is tenant-filtered; deployed state unknown | PARTIAL |
| 94 `grant execute ... to service_role` statements | n/a | service-only definers (`trust_room_open`, `read_feed`, `erase_account`, `claim_support_notifications`, `private.record_audit`, ...) | revoked from PUBLIC/anon/authenticated | `20260928100000_trust_room.sql:304-305`; `20260921143653_access_log.sql:265-266` | `supabase/grants.check.sql` asks about functions a signed-in account can call; service-only set is not separately enumerated in a register. 77 service-only tables are in `database/DATA_CLASSIFICATION_REGISTER.md` | PARTIAL |
| Retention and hold sweeps | pg_cron runs as owner | delete/purge by policy | holds respected | `20260929030000_retention_sweeps.sql`; `20260930100000_legal_holds.sql`; `supabase/hold-aware-sweeps.check.sql`, `hold-blind-sweeps.check.sql`, `hold-gated-sweeps.check.sql` | Applied schedule is manual (`supabase/scheduler.sql`) | OPERATIONAL-UNDER-GOVERNED |
| CI/ops | `SUPABASE_ACCESS_TOKEN` (account-wide) | deploy functions, per `functions.yml` | deploy only after CI succeeds (`workflow_run`, "Refuse a stale release") | `.github/workflows/functions.yml:60, 189-206`; `SECRETS.md` | Branch protection is a definition, "Not active until the owner applies it" (`docs/BRANCH-PROTECTION.md`); applied state not verified | UNKNOWN-INVESTIGATE |

## 3. Direct browser grants

| Surface | State | Evidence | Gap | Classification |
|---|---|---|---|---|
| `anon` table DML | 32 public tables, 1 view. Intended: commercial plans/prices/products, entitlement catalog, `form_publications`, `form_responses` INSERT, `schools` SELECT. Over-granted: 24-26 owner-scoped tables with full default grant incl. TRUNCATE/TRIGGER | `database/GRANT_ALLOWLIST.md`; `app/src/lib/definerregister.ts` DR-04 | Revocation proposed, **not applied** (`database/proposed/anon_grant_reduction.sql`). `supabase/grants.check.sql` guards function EXECUTE, not table privileges (DR-04 text). TRUNCATE ignores RLS; no exploit path found by the author, none tested | PARTIAL |
| `schools` readable by `anon` with every column | `schools_read` policy `true` (`20260921170000_schools.sql:59`); columns now include `enforce_membership`, `edition`, `is_demo`, `email_domains` (`grep -hE 'alter table public\.schools'`) | `database/GRANT_ALLOWLIST.md` Q1 (open product/counsel question) | Discloses customer list, each school's claim domains, and per-school enforcement and demo flags to unauthenticated callers. No column-level revoke found | PARTIAL |
| `authenticated` table grants | 270 SELECT, 129 write tables | `database/TENANT_ISOLATION_MATRIX.md` | Allowlist not written; 16 write-granted tables lack tenant or owner column and are unread | PARTIAL |
| Column-pinned writes | `profiles.school_id`, `schools.enforce_membership`, `reports.status` pinned by column grants plus trigger | `20260921170000_schools.sql`; `20260930185000_school_membership_enforcement.sql` (`refuse_direct_enforcement_change`); `20260921214500_report_status.sql` | Pattern is per column; no sweep that finds an unpinned authority column | OPERATIONAL-UNDER-GOVERNED |
| Storage policies | `community-media` upload and read via definer predicates | `20260928032000_community.sql` | Real Storage not exercised in CI (`ci.yml:589` excludes `storage-api`) | PARTIAL |
| `FORCE ROW LEVEL SECURITY` | none | `database/TENANT_ISOLATION_MATRIX.md`; migrations grep = 0 | Owner-role traffic bypasses RLS. Decision pending with owner | PARTIAL |

## 4. Edge Function entry points

All 16 `[functions.*]` blocks in `supabase/config.toml` set `verify_jwt = false`; `.github/workflows/functions.yml:239` deploys with `--no-verify-jwt`. `app/src/lib/deployfunctions.test.ts` holds config to the directory. The platform JWT check is replaced by the function's own, so each row below is the only gate. Directory has 17 entries; `_shared` is not a function. Last deploy provenance: `supabase/functions.snapshot` (read 2026-09-29, stale).

| Function | Caller | Credential and check | Actor / tenant derivation | Privilege | Gap | Classification |
|---|---|---|---|---|---|---|
| `billing-checkout` | signed-in user | `db.auth.getUser(token)` | actor = JWT subject; billing account per user; no tenant | service key, Stripe secret | no school/tenant concept in billing | OPERATIONAL-UNDER-GOVERNED |
| `billing-cancel` | signed-in user | `getUser` on a client built with caller's token | same | caller-scope client plus Stripe | none found beyond above | OPERATIONAL-UNDER-GOVERNED |
| `billing-portal` | signed-in user | `getUser` | same | Stripe | same | OPERATIONAL-UNDER-GOVERNED |
| `billing-webhook` | Stripe | `Stripe-Signature` over raw body, 503 if `STRIPE_WEBHOOK_SECRET` unset (`_shared/billingwebhook.ts:107-108`) | from event payload, applied via service-only definers (`apply_payment_event`) | service key | replay window and idempotency are in the RPC; not read here | OPERATIONAL-UNDER-GOVERNED |
| `calendar` | calendar clients (anonymous) | unguessable token in URL path (`TOKEN` regex), RPC `read_feed` (service_role only) | owner resolved inside the database; `user_id` not returned | service key | capability-URL: possession is access; revocation by feed row | OPERATIONAL-UNDER-GOVERNED |
| `canvas` | signed-in user | `admin.auth.getUser(session)` | actor from JWT; Canvas token supplied by user | service key | outbound fetch to user-supplied host (SSRF controls not reviewed) | UNKNOWN-INVESTIGATE |
| `claude` | signed-in user | `admin.auth.getUser(token)`; plan read from `billing_accounts`; call and dollar meters (`add_spend`, `count_call`) | actor from JWT; **no school**; only global kill switch | service key, `ANTHROPIC_API_KEY` | no tenant AI policy on this path; spend meter per account only | OPERATIONAL-UNDER-GOVERNED |
| `delete-account` | signed-in user | `admin.auth.getUser(token)`; calls `erase_account(target)` | target = own JWT subject | service key | no audit row written by erase (see tenant map section 5); `erase_respects_holds` migration governs holds | OPERATIONAL-VERIFIED for the self-delete path: `account-sync` CI job runs the real function and checks old session invalid (`ci.yml` job `account-sync`); deployed state not proven from repo, so downgrade if the "deployed" bar is required |
| `fetchcal` | signed-in user | `admin.auth.getUser(token)` | actor from JWT | service key | fetches a user-supplied ICS URL (SSRF controls not reviewed) | UNKNOWN-INVESTIGATE |
| `integration-tick` | pg_cron | token checked in the DB: `integration_tick_authorized(presented)` (Vault `integration_cron_secret`) | iterates all approved connections; tenant carried by each `connection.tenant_id` | service key | tick filter is in generated `_shared/integration/tick.ts` | PARTIAL |
| `lead-intake` | anonymous site visitor | origin allowlist (`_shared/cors.ts:strictOrigin`), hashed-IP one-hour rate limit, RPC `submit_site_lead` | no actor; writes a lead | service key, `RESEND_API_KEY` | public write endpoint; abuse controls limited to the rate limit; `LEAD_IP_SALT` falls back to the service key (`SECRETS.md`) | OPERATIONAL-UNDER-GOVERNED |
| `lti` | Brightspace (signed JWT) and signed-in user (score report) | RS256 verify against registration key set (`index.ts:650`); user path `client.auth.getUser(bearer)` (`index.ts:425`) | tenant from `lti_registration.tenant_id` (`index.ts:192-218`); user from LTI identity mapping | service key, `LTI_PRIVATE_KEY` | `launchTenant` warns when tenant null (`index.ts:668-669`); null-tenant registrations not measured | PARTIAL |
| `productivity-sourcecheck` | signed-in user | `auth.getUser()` on caller-token client | actor from JWT | caller-scope client (anon key plus caller token), not service | the one function that does not hold the service key | OPERATIONAL-UNDER-GOVERNED |
| `push` | pg_cron | `Authorization: Bearer ${CRON_SECRET}`; refuses all if unset (`index.ts:77-80`) | processes `push_queue` for all users | service key, `VAPID_PRIVATE_KEY` | `!==` string comparison, not constant-time (low) | OPERATIONAL-UNDER-GOVERNED |
| `support-reply-notify` | support agent browser or cron | user token plus `mayAnswer` (platform-scope `support:ticket`), or `cronSecret` bearer equality (`_shared/supportnotify.ts:55`) | actor from JWT; agent authority **platform-wide** | service key, `RESEND_API_KEY` | not tenant-scoped; non-constant-time equality | PARTIAL |
| `trust-room` | external reviewer, no account | link token in POST body; RPC `trust_room_open` (service_role only); signed URL for private `trust-packet` bucket | grant row decides artifacts; logged to `trust_room_access_log` | service key | token is bearer; expiry and revocation in DB | OPERATIONAL-UNDER-GOVERNED |

Evidence for table: `supabase/config.toml`, `supabase/functions/*/index.ts`, `supabase/DEPLOY.md`, `app/src/lib/trust/room-server.test.ts` (trust-room), `app/src/lib/deployfunctions.test.ts`.

## 5. Secrets surfaces

Inventory is `SECRETS.md` (4 stores; guarded by `app/src/lib/secrets.test.ts` and `app/src/lib/security.test.ts` per its header). Highest-authority items:

| Secret | Authority | Store | Gap | Classification |
|---|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | all rows, all tenants | injected into every function | Also the fallback salt for `LEAD_IP_SALT` | OPERATIONAL-UNDER-GOVERNED |
| `SUPABASE_ACCESS_TOKEN` | whole Supabase account: deploy, migrations, secrets | GitHub Actions | personal-account token, not scoped | UNKNOWN-INVESTIGATE |
| `SEMESTER_AUTH_SERVICE_KEY` | gateway database access | Env (named in `app/server/institution/runtime.ts`); `grep -n SEMESTER_AUTH_SERVICE_KEY SECRETS.md` returns nothing | Absent from the secrets inventory and rotation table; the repo's own `docs/integrated-trust/CONTROL-FRAMEWORK.md` (TC-SEC-13) and `REMEDIATION-SEQUENCE.md` (TR-09) say the same, and add `SEMESTER_JOURNAL_KEY` (journal key, no key id) | UNKNOWN-INVESTIGATE |
| `LTI_PRIVATE_KEY`, `STRIPE_*`, `ANTHROPIC_API_KEY`, `VAPID_PRIVATE_KEY`, `RESEND_API_KEY`, `CRON_SECRET` | per `SECRETS.md` rows | function secrets / Vault | `CRON_SECRET` lives in Vault and function secrets and must be rotated in both | OPERATIONAL-UNDER-GOVERNED |
| `INFRA_GITHUB_TOKEN`, `VERCEL_API_TOKEN`, `TF_STATE_*` | change repo and host controls; Terraform state | Actions environment secrets | `drift.yml` reports NOT CHECKED when state unset | UNKNOWN-INVESTIGATE |
| `.env.production` (committed) | publishable key, URL | git | public by design; `.gitleaks.toml` allowlists the prefix | OPERATIONAL-UNDER-GOVERNED |
| Integration credentials | provider tokens | `_shared/integration/vault.ts` | "No credential services: an adapter that declares a credential is refused" (`integration-tick/index.ts` comment) so no production provider credentials flow yet | DOCUMENTED-UNIMPLEMENTED |

## 6. Break-glass

| Item | Guard | Evidence | Gap | Classification |
|---|---|---|---|---|
| School-scoped emergency access | opened only by `console_act` on two-person duty; self-approval refused; max four hours; reviewer other than holder; overdue review blocks the next grant; scope must name existing capabilities; audit event written before effect and call fails if audit fails | `20260929110000_console_approvals_and_break_glass.sql`; `20260929100000_console_control_plane.sql` (hash-chained `private.console_audit_event`, manifests, verification) | Never grants platform scope. No evidence in repo of use. `private.has_capability` is the shared predicate, so a defect here is a defect for every tenant policy | OPERATIONAL-UNDER-GOVERNED |
| Tests | tamper detection, fail-closed with writer INSERT revoked, approval rules | `supabase/console-approvals.check.sql`, `console-control-plane.check.sql`, `ledger-chains.check.sql`, `ledger-seals.check.sql` | In CI glob; not production evidence | n/a |

## 7. Support access

| Item | Guard | Evidence | Gap | Classification |
|---|---|---|---|---|
| Student-granted, time-boxed support access | `support_access_grant`, `support_access_event` log, reason, expiry | `20260925103000_support_access.sql`; `supabase/support-access.check.sql` | Read audit on every access not confirmed for all record types | PARTIAL |
| Support tickets and replies | in-app reply first; email hint carries no body; outbox with claim and dead-letter | `20260928210000_support_tickets.sql`; `20261002003000_support_notification_outbox.sql`; `20261003120000_support_notification_consent_boundary.sql`; `supabase/functions/support-reply-notify/index.ts` | Agent capability is platform-scope; no tenant partition of agents | PARTIAL |
| Platform-admin status as a data entitlement | `docs/architecture/multi-tenant-isolation.md` invariant 7 says it should grant nothing | `20260921161500_roles.sql:private.is_app_admin`; `20260922012000_capabilities.sql` ("`app_admins` ... is not consulted by it") | `is_app_admin()` callers across policies were not enumerated | UNKNOWN-INVESTIGATE |

## 8. Admin consoles

| Console | Authority source | Evidence | Gap | Classification |
|---|---|---|---|---|
| Operations console (approvals, break-glass, duty matrix, figures, customers) | `console:operate` capability, seats, fresh-MFA JWT claim, duty matrix; server-side in definer functions, UI in `app/src/screens/Console.tsx`, `app/src/components/console/*` | `20260929100000_console_control_plane.sql`; `20260929110000_console_approvals_and_break_glass.sql`; `20260930173030_console_command_center.sql` | UI is not the boundary (ADR 0002); MFA freshness depends on JWT claim shape tested on a stub (`supabase/local.stub.sql`) | OPERATIONAL-UNDER-GOVERNED |
| Moderation queue | `report:read`, `moderation:action` | `20260922012000_capabilities.sql`; `app/src/screens/Moderation.tsx`; `supabase/reports.check.sql`, `moderation-audit.check.sql` | Platform scope | OPERATIONAL-UNDER-GOVERNED |
| Support console | `support:ticket` | `app/src/screens/Support.tsx`; `supabase/support-tickets.check.sql` | See section 7 | PARTIAL |
| School offboarding / enforcement / SCIM | school-scoped capabilities | `20260930200000_school_offboarding.sql`; `20260930185000_school_membership_enforcement.sql`; `20260928200000_scim_gateway.sql`; `supabase/school-offboarding.check.sql`, `scim-gateway.check.sql` | `school_enforcement_readiness()` locks out count must be acknowledged; switch default off everywhere | PARTIAL |
| Operator SQL (`supabase/analytics.sql`, `health.sql`, `advisor-probe.sql`) | dashboard SQL Editor, owner rights | the files themselves | Manual, unaudited by the repo | UNKNOWN-INVESTIGATE |

## Open questions / not verified

1. Whether the 25-function difference between production's 205 and the register's earlier 180 is fully covered by register rows (register now totals 205; no name diff was run).
2. Rotation state and storage location of `SEMESTER_AUTH_SERVICE_KEY` and `SEMESTER_JOURNAL_KEY` (absent from `SECRETS.md`).
3. Bodies of the `beta_*`, `support_*`, `*_school`, offboarding and `help_inbox` definers (named unreviewed by `database/FUNCTION_AUTHORIZATION_MATRIX.md`).
4. The 3 financial and 6 integration browser-callable definers' names and gates.
5. SSRF controls in `fetchcal` and `canvas`.
6. Whether branch protection and the `functions.yml` secret are active (`docs/BRANCH-PROTECTION.md`).
7. Whether any production tenant uses the gateway or has `enforce_membership` on.
8. Compliance questions (FERPA access by platform support, student consent sufficiency) are for counsel.
