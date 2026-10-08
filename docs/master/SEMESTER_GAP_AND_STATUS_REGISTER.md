# Gap and status register — Phase 0 findings

**As of** 2026-10-05 · **Base** `origin/main` `114ac32`. Row-level gaps live in [`SEMESTER_GAP_REGISTER.md`](SEMESTER_GAP_REGISTER.md) (203 workflow steps, 57 screens). This page lists what this session newly verified.

## Top verified gaps

| # | Gap | Evidence | Class |
| --- | --- | --- | --- |
| 1 | No projection worker, watermarks, read-model registry or rebuild | grep of `supabase/`, `app/server`, `app/api` | Not started |
| 2 | None of 17 `ops_*` read contracts exist by name | grep; nearest are `console_command_center`, `console_figures`, `console_audit_read`, `integration_health`, `help_inbox` | Not started / partial |
| 3 | Console lacks Tenant directory/360, Pilot, Implementation, Integration ops, Privacy, Security, Access reviews, SLOs, Vendors, Board reports, Capacity | `screens/Console.tsx` tabs | Not started |
| 4 | Dead-letter/replay only for integrations; domain outbox has a column but no replay path found | migrations | Native but incomplete |
| 5 | 33 of 51 requested components have no export under that name | component search | Mapping, not rebuild |
| 6 | Requested style files and `design-tokens/*.ts` do not exist | `ls` | Duplicate-by-design (token authority is `look.ts`/`tokens.css`) |
| 7 | Edu-API, OneRoster REST: docs only; OneRoster has staging migration only | grep | Planned |
| 8 | HTTP SCIM endpoint not found (DB gateway exists) | `supabase/functions` | Native but incomplete |
| 9 | Dedicated Registration Readiness Pilot page and Security page absent from company site | `company-site/index.html` routes | Not started |
| 10 | `lead-intake` validates, honeypots and rate-limits; whether it records consent or checks suppression was **not verified** | `_shared/leadintake.ts` | Unverified |
| 11 | Nearly all operational tables hold 0 rows | live listing | Pilot-only at best |
| 12 | `npm run build`, `test:shuffle`, secret scan, migration validation not run | this pass | Evidence gap |
| 13 | 86 raw-value warnings against the design-system ledgers | `design-system:check` | Native but incomplete |
| 14 | 63 nav rows vs PDF's 64 destinations | `lib/nav.ts` | Reconcile |
| 15 | 589 catalogued screens vs PDFs' 673; 51 roles vs 69 live | catalogs | Unreconciled |

## Security / RLS / function exposure (read-only advisor, project `lzrqvlug…`)

591 findings, **0 ERROR**. No SECURITY DEFINER views; no anon-executable definer functions; no mutable-search_path findings.

| Advisor | Count | Action |
| --- | --- | --- |
| `rls_enabled_no_policy` (INFO) | 63 (30 `private`, 33 `public`) | Confirm `app_admins`, `scim_credential`, `payment_events` are reached only through definer RPCs |
| `pg_graphql_anon_table_exposed` (WARN) | 32 | Verify anon grants/policies on `profiles`, `messages`, `notes`, `enrollments`, `push_*`, `family_grants`; the lint shows schema visibility only |
| `pg_graphql_authenticated_table_exposed` (WARN) | 289 | Same; consider restricting GraphQL exposure |
| `authenticated_security_definer_function_executable` (WARN) | 207 | Audit the 18 sensitive ones first: `console_act`, `decide_approval`, `request_approval`, `registrar_grant_override`, `authorize_school_purge`, `trust_room_grant`, `approve_offboarding`, `integration_approve_*`, … each must authorize in-body |

These are leads, not confirmed vulnerabilities: grants and function bodies were not read.

## Duplicates and staleness

- Open draft PR #1304 (`cursor/full-semester-system-integration-83d9`) already adds `docs/design-system/HANDOFF-INTEGRATION-CROSSWALK.md` and two task files; the design-doc half of this program overlaps it.
- `docs/finish-line/*` (17) and most of `docs/master/*` already existed; they were not recreated.
- Open PRs older than a week: #1005, #1024, #1028, #1033, #1039, #1047–#1049, #1058–#1063 (draft Core prompts), #1080 — candidates for owner triage; not touched here.

## RPC exposure audit — 18 flagged definer functions (2026-10-05, read-only)

Method: `pg_proc` metadata and `pg_get_functiondef` against project `lzrqvlug…`. No data read, nothing changed.

| Check | Result |
| --- | --- |
| `SECURITY DEFINER` with `search_path` set to empty | all 18 |
| `EXECUTE` held by `anon` | none of the 18 |
| `EXECUTE` held by `authenticated` | all 18 (expected: they authorize in-body) |
| Body references a caller check (`auth.uid()`, `has_capability`, `holds_role`, `is_app_admin`) | 17 of 18 by pattern match; **presence only, not proof the check is correct** |
| `authorize_school_purge` (the 18th) | authorizes through `private.offboarding_operator()` → `private.is_app_admin()`; requires neither proposer nor approver, a reason, `school_purge_eligibility` (retention window, no live legal hold) and writes `private.record_audit` |

Functions: `accept_family_grant`, `approve_community_pseudonymity`, `approve_offboarding`, `authorize_school_purge`, `console_act`, `console_audit_read`, `console_audit_status`, `console_command_center`, `console_figures`, `decide_approval`, `delete_community_post`, `integration_approve_connection`, `integration_approve_scope`, `registrar_grant_override`, `request_approval`, `school_purge_eligibility`, `school_requests_for_admin`, `trust_room_grant`.

**Not done:** only `authorize_school_purge`, `school_purge_eligibility` and `offboarding_operator` were read in full. The other 15 were checked by pattern only, so their authorization logic is unreviewed. The other ~189 definer functions flagged by the advisor were not examined. The `anon` GraphQL visibility of `profiles`, `messages`, `notes`, `enrollments`, `push_*`, `family_grants` and the three RLS-no-policy tables is also still open.
