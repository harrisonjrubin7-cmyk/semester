-- PROPOSAL 11 · a structural guard that every deleting sweep is hold-aware
--
-- Legal holds are enforced sweep by sweep. Nothing says a NEW sweep must check one, and the
-- header of 20260930140000_erase_respects_holds.sql already records the failure mode (a later
-- create-or-replace silently dropping the check). Measured on the migrated schema, functions that
-- DELETE and are named like sweeps/purges/retention/forget, and what they check:
--   hold-aware (6):  sweep_abandoned_signups, sweep_ai_runtime_metadata, sweep_audit_retention,
--                    sweep_community_retention, sweep_stale_invites, integration_retention_sweep
--   NOT hold-aware (16), of which
--     covered by the hold-checking erase wrapper (11): erase_account_unheld + ten forget_my_*
--     ephemeral by design (2): sweep_lti_nonce, sweep_lti_link_ticket
--     GAPS (3): gateway_purge_journal (gateway/AI audit, 180 d), purge_financial_records
--       (individual billing records, 7 y), sweep_tombstones (student-deleted work, 90 d)
-- RETENTION.md says of the financial sweep "there is none to gate"; the function exists.
--
-- Same shape as src/rootunmount.test.ts: a structural check that cannot be fooled by a race.
-- It reads function SOURCE, so it is a heuristic with a stated name pattern; the exemption table is
-- how a human says "this one is deliberate", with a reason and a review date.
-- Requires: 01 (private schema only).

create table if not exists private.hold_exemption (
  function_name text primary key,                       -- schema-qualified
  reason        text not null check (length(btrim(reason)) >= 10),
  kind          text not null check (kind in ('ephemeral','covered_by_wrapper','known_gap')),
  review_by     date not null,
  check (kind <> 'known_gap' or review_by <= current_date + 120)   -- a gap may not be parked indefinitely
);
alter table private.hold_exemption enable row level security;
revoke all on private.hold_exemption from public, anon, authenticated;

create or replace function private.sweeps_without_hold_awareness()
returns table (function_name text) language sql stable as $$
  select n.nspname || '.' || p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private')
     and p.prosrc ~* 'delete\s+from'
     and p.proname ~* '(sweep|purge|retention|forget|expire|prune|tombstone|cleanup|erase)'
     and p.prosrc !~* '(is_held|legal_hold)'
     and not exists (select 1 from private.hold_exemption e
                      where e.function_name = n.nspname || '.' || p.proname and e.review_by >= current_date);
$$;
revoke all on function private.sweeps_without_hold_awareness() from public, anon, authenticated;

insert into private.hold_exemption(function_name, reason, kind, review_by) values
  ('public.sweep_lti_nonce',        'one-hour replay-protection rows; not personal data, not evidence', 'ephemeral', current_date + 365),
  ('public.sweep_lti_link_ticket',  'one-hour launch tickets; not personal data, not evidence',         'ephemeral', current_date + 365),
  ('private.erase_account_unheld',  'revoked from every role; reachable only through erase_account, which checks account_is_held first', 'covered_by_wrapper', current_date + 365),
  ('public.forget_my_advisor_shares','called only by erase_account (hold-checked)', 'covered_by_wrapper', current_date + 365),
  ('public.forget_my_beta',         'called only by erase_account (hold-checked)', 'covered_by_wrapper', current_date + 365),
  ('public.forget_my_community',    'called only by erase_account (hold-checked)', 'covered_by_wrapper', current_date + 365),
  ('public.forget_my_course_demand','called only by erase_account (hold-checked)', 'covered_by_wrapper', current_date + 365),
  ('public.forget_my_help_requests','called only by erase_account (hold-checked)', 'covered_by_wrapper', current_date + 365),
  ('public.forget_my_mentor_requests','called only by erase_account (hold-checked)', 'covered_by_wrapper', current_date + 365),
  ('public.forget_my_organizations','called only by erase_account (hold-checked)', 'covered_by_wrapper', current_date + 365),
  ('public.forget_my_support_access','called only by erase_account (hold-checked)', 'covered_by_wrapper', current_date + 365),
  ('public.forget_my_support_shares','called only by erase_account (hold-checked)', 'covered_by_wrapper', current_date + 365),
  ('public.forget_my_support_tickets','called only by erase_account (hold-checked)', 'covered_by_wrapper', current_date + 365),
  -- the three real gaps, parked for at most 120 days each, then the guard fails
  ('private.gateway_purge_journal', 'GAP: ages out gateway and AI audit rows without checking a tenant or platform hold', 'known_gap', current_date + 90),
  ('public.purge_financial_records','GAP: purges individual billing records after seven years without checking an account hold', 'known_gap', current_date + 90),
  ('public.sweep_tombstones',       'GAP: physically removes student-deleted work after 90 days without checking an account hold', 'known_gap', current_date + 90)
on conflict do nothing;
