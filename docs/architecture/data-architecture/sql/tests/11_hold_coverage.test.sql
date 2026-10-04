\set ON_ERROR_STOP on
begin;
-- 1. On the real schema, with the seeded exemptions, the guard is silent: every known deleting sweep is either
--    hold-aware, exempt for a stated reason, or a dated known gap.
do $$ begin
  if exists (select 1 from private.sweeps_without_hold_awareness()) then
    raise exception 'FAIL real schema has unexplained hold-blind sweeps: %', (select string_agg(function_name, ', ') from private.sweeps_without_hold_awareness());
  end if;
end $$;

-- 2. Control: the detector is not blind. Remove the three gap exemptions and exactly those three appear.
delete from private.hold_exemption where kind = 'known_gap';
do $$ declare got text; begin
  select string_agg(function_name, ',' order by function_name) into got from private.sweeps_without_hold_awareness();
  if got is distinct from 'private.gateway_purge_journal,public.purge_financial_records,public.sweep_tombstones'
  then raise exception 'FAIL detector returned: %', got; end if;
end $$;

-- 3. A new sweep that deletes with no hold check is flagged; the same sweep with one is not; an exemption silences only until its date.
create function public.sweep_zz_blind() returns int language sql as $f$ with d as (delete from public.profiles where false returning 1) select count(*)::int from d $f$;
create function public.sweep_zz_aware() returns int language sql as $f$ with d as (delete from public.profiles where false and private.platform_is_held() returning 1) select count(*)::int from d $f$;
create function public.zz_unrelated_name() returns int language sql as $f$ with d as (delete from public.profiles where false returning 1) select count(*)::int from d $f$;
do $$ declare got text; begin
  select string_agg(function_name, ',' order by function_name) into got from private.sweeps_without_hold_awareness();
  if got is distinct from 'private.gateway_purge_journal,public.purge_financial_records,public.sweep_tombstones,public.sweep_zz_blind'
  then raise exception 'FAIL new blind sweep not isolated: %', got; end if;                         -- aware one and the oddly named one are absent
  insert into private.hold_exemption values ('public.sweep_zz_blind','test: deliberate, reviewed by the steward','ephemeral', current_date - 1);
  if not exists (select 1 from private.sweeps_without_hold_awareness() where function_name = 'public.sweep_zz_blind')
  then raise exception 'FAIL expired exemption still silences'; end if;
  update private.hold_exemption set review_by = current_date + 30 where function_name = 'public.sweep_zz_blind';
  if exists (select 1 from private.sweeps_without_hold_awareness() where function_name = 'public.sweep_zz_blind')
  then raise exception 'FAIL live exemption does not silence'; end if;
  begin insert into private.hold_exemption values ('public.zz_gap','gap parked far too long for policy','known_gap', current_date + 400);
    raise exception 'FAIL a gap parked for 400 days was accepted'; exception when check_violation then null; end;
end $$;
rollback;
\echo 11 OK
