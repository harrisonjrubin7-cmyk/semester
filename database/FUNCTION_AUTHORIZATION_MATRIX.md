# SECURITY DEFINER posture

Measured 2026-10-04 (`schema/inventory.sql` queries 4, 5).

| Schema | Functions | SECURITY DEFINER | anon can EXECUTE | authenticated can EXECUTE | no pinned search_path | PUBLIC can EXECUTE |
|---|---|---|---|---|---|---|
| public | 290 | 269 | 0 | 205 | **0** | **0** |
| private | 336 | 235 | 22 | 45 | **0** | **0** |

Every definer function pins `search_path`; none is executable via PUBLIC. Good controls, measured, not inferred.

## Delta against the register
`docs/DEFINER-RLS-REGISTER.md` last counted 180 authenticated-callable definers (2026-09-30). Production now has 205 in `public` (counted differently: this reading includes the whole `public` schema). The difference of 25 is **unreconciled**: I did not diff names against the register's rows, so I cannot say whether any lacks a row. That diff is the open item.

## Regex-visible gate review queue (not findings)
Of 250 authenticated-executable definers (205 public + 45 private), 24 public and 12 private show no `auth.uid()` or recognised `private.*` gate by regex. I read the bodies of the ones that neither raise nor name a gate: `gradebook_export` (requires `grades:export` scoped by tenant, released rows only) and `community_session_counts` (requires community membership) are **gated**. `kill_switch_engaged` is the already-registered DR-01. The remaining names (`beta_*`, `support_*`, `*_school`, offboarding, `help_inbox`, `my_beta`, `beta_known_issues_for_me`, `gtm_pilot_problems`) raise on failure but I did not read each body; **they remain unreviewed**. `gtm_pilot_problems` was fixed by `20260929120000_gtm_pilot_problems_visibility.sql`.

Correction recorded: an earlier pass listed `purge_financial_records`, `run_dunning`, `apply_payment_event`, `upsert_provider_invoice(_v2)` and `gateway_write_audit_v2` as signed-in-callable. They are **not**: `authenticated` has no EXECUTE on any of them (`public.gateway_write_audit_v2` is `service_role` only; the `private.` twin has no browser or service grant). Service-only as intended, tested directly with `has_function_privilege`.

## Not done
No per-function matrix; no adversarial forged-argument tests written or run; the 24 public names above are not individually body-reviewed.
