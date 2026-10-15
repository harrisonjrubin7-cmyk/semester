-- PROPOSAL 11 · a structural guard that every deleting sweep is hold-aware
--
-- Legal holds are enforced sweep by sweep. Nothing says a NEW sweep must check one, and the
-- header of 20260930140000_erase_respects_holds.sql already records the failure mode (a later
-- create-or-replace silently dropping the check). When this was first written, on the schema of
-- 4 October 2026, functions that DELETE and are named like sweeps/purges/retention/forget split
-- as: 6 hold-aware; 11 reached only through the hold-checking erase wrapper; 2 ephemeral; and 3
-- GAPS (gateway_purge_journal, purge_financial_records, sweep_tombstones). Those three are fixed
-- by 20261004150000_holds_reach_the_last_three_sweeps.sql, so this file no longer carries them
-- as known gaps.
--
-- The guard has already earned its place: a fourth sweep, private.productivity_sweep_commands
-- (20261004090000_productivity_commands.sql), landed on main after that count and was flagged
-- the first time the guard ran. It deletes a 35-day command window and may be ephemeral like
-- the gateway's replay window; whether it is, is the owner of that work's decision, so it
-- is parked below as a dated known gap, not decided here.
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
  -- A sweep that landed after the guard was written: parked with a date until its owner decides
  -- whether a 35-day command window is ephemeral (exempt) or a record (hold-aware).
  ('private.productivity_sweep_commands', 'GAP: deletes a 35-day command window without checking a hold; decide whether it is ephemeral', 'known_gap', current_date + 30)
on conflict do nothing;
