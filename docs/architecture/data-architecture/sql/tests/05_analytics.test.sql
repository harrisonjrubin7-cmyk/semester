\set ON_ERROR_STOP on
begin;
insert into auth.users(id) select ('00000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid from generate_series(100,111) g;
-- 12 accounts active in one week, 3 in another
insert into public.activity(user_id, day, mark) select ('00000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid, '2026-09-28', 'opened' from generate_series(100,111) g;
insert into public.activity(user_id, day, mark) select ('00000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid, '2026-10-05', 'opened' from generate_series(100,102) g;

do $$ declare a bigint; b bigint; c bigint; begin
  select active_accounts into a from analytics.v_weekly_active_institution where week = '2026-09-28';
  select active_accounts into b from analytics.v_weekly_active_institution where week = '2026-10-05';
  select active_accounts into c from analytics.v_weekly_active_owner where week = '2026-10-05';
  if a <> 12 then raise exception 'FAIL week of 12 returned %', a; end if;
  if b is not null then raise exception 'FAIL institution view: week of 3 not withheld (got %)', b; end if;
  if c <> 3 then raise exception 'FAIL owner view must show the pilot small count (3), got %', c; end if;
end $$;

-- the reader sees analytics and nothing else
set local role analytics_reader;
do $$ begin
  perform active_accounts from analytics.v_weekly_active_owner;      -- control: allowed
  begin perform count(*) from public.activity; raise exception 'FAIL reader can read public.activity';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.profiles; raise exception 'FAIL reader can read public.profiles';
  exception when insufficient_privilege then null; end;
  begin perform analytics.subject_key(gen_random_uuid()); raise exception 'FAIL reader can mint subject keys';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- the institution reader sees only the suppressed view
set local role analytics_institution_reader;
do $$ begin
  perform active_accounts from analytics.v_weekly_active_institution;     -- control: allowed
  begin perform active_accounts from analytics.v_weekly_active_owner; raise exception 'FAIL institution reader can read the unsuppressed owner view';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.activity; raise exception 'FAIL institution reader can read public.activity';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- pseudonym rotates with the epoch
create temp table k(epoch text, key text);
insert into private.analytics_salt(epoch, active) values ('2026-FA', true);
insert into k select '2026-FA', analytics.subject_key('00000000-0000-0000-0000-000000000100');
update private.analytics_salt set active = false;
insert into private.analytics_salt(epoch, active) values ('2027-SP', true);
insert into k select '2027-SP', analytics.subject_key('00000000-0000-0000-0000-000000000100');
do $$ declare k1 text; k2 text; begin
  select key into k1 from k where epoch = '2026-FA'; select key into k2 from k where epoch = '2027-SP';
  if k1 = k2 then raise exception 'FAIL pseudonym did not change across epochs'; end if;
  if length(k1) <> 64 then raise exception 'FAIL key is not sha256 hex'; end if;
end $$;

-- guards: clean first (control), then a leak and a non-derived table are both caught
do $$ begin
  if exists (select 1 from analytics.identifier_leaks()) then raise exception 'FAIL guard flags a clean schema'; end if;
  if exists (select 1 from analytics.non_derived_tables()) then raise exception 'FAIL guard flags a clean schema (derived)'; end if;
end $$;
create table analytics.bad_fact (user_id uuid, email text, n int);
do $$ declare c int; begin
  select count(*) into c from analytics.identifier_leaks();
  if c <> 2 then raise exception 'FAIL leak guard found % columns, want 2', c; end if;
  if (select count(*) from analytics.non_derived_tables()) <> 1 then raise exception 'FAIL non-derived guard missed bad_fact'; end if;
end $$;
-- registering it as derived clears the second guard only
insert into private.data_registry(table_schema,table_name,domain,record_class,review_state) values ('analytics','bad_fact','governance','derived','proposed');
do $$ begin
  if exists (select 1 from analytics.non_derived_tables()) then raise exception 'FAIL registering as derived did not clear the guard'; end if;
  if (select count(*) from analytics.identifier_leaks()) <> 2 then raise exception 'FAIL registry changed the leak guard'; end if;
end $$;

-- guard 3: the pilot view reads only an eligible table; a view over profiles, or over the AI retrieval log, is caught
do $$ begin
  if exists (select 1 from analytics.ineligible_sources()) then
    raise exception 'FAIL guard 3 flags the clean schema: %', (select string_agg(view_name || '<-' || source_table, ',') from analytics.ineligible_sources()); end if;
end $$;
create view analytics.v_bad_profiles as select count(*)::bigint as n from public.profiles;
create view analytics.v_nested_bad as select n from analytics.v_bad_profiles;
do $$ declare got text; begin
  select string_agg(view_name || '<-' || source_table, ',' order by view_name) into got from analytics.ineligible_sources();
  if got is distinct from 'v_bad_profiles<-public.profiles,v_nested_bad<-public.profiles' then
    raise exception 'FAIL guard 3 result (nested view must be caught too): %', got; end if;
  -- an eligible flag is what clears it, nothing else
  insert into private.data_registry(table_schema,table_name,domain,record_class,analytics_eligible,review_state) values ('public','profiles','identity','account_record',true,'proposed')
    on conflict (table_schema,table_name) do update set analytics_eligible = true;
  if exists (select 1 from analytics.ineligible_sources()) then raise exception 'FAIL registering as eligible did not clear guard 3'; end if;
end $$;

-- metric definitions: floor of 10, forbidden sources refused, a good one accepted (control)
do $$ begin
  insert into analytics.metric_definition(metric_id, owner_role, meaning, grain, source_events)
    values ('weekly_active_accounts','Founder','Distinct accounts with the app open in a week, from the activity table','week', array['activity.opened']);
  begin insert into analytics.metric_definition(metric_id, owner_role, meaning, grain, min_cohort)
          values ('small_floor','Founder','An institution-readable metric asking for a cohort floor of five','week', 5);
    raise exception 'FAIL institution floor below 10 accepted'; exception when check_violation then null; end;
  insert into analytics.metric_definition(metric_id, owner_role, meaning, grain, min_cohort, audience)
    values ('pilot_weekly_active','Founder','The owner reads the pilot of five to ten people without a floor, as ANALYTICS.md does','week', 1, 'owner');   -- control: allowed
  begin insert into analytics.metric_definition(metric_id, owner_role, meaning, grain, source_events)
          values ('ai_usage_per_student','Founder','Per-student AI usage, which the platform refuses to measure','week', array['ai_usage']);
    raise exception 'FAIL forbidden source accepted'; exception when check_violation then null; end;
  begin insert into analytics.metric_definition(metric_id, owner_role, meaning, grain, source_events)
          values ('risk_score','Founder','An individual student risk score, which the platform refuses to measure','week', '{}');
    raise exception 'FAIL forbidden metric id accepted'; exception when check_violation then null; end;
  begin update analytics.metric_definition set status = 'approved' where metric_id = 'weekly_active_accounts';
    raise exception 'FAIL approved without a review date'; exception when check_violation then null; end;
end $$;
rollback;
\echo 05 OK
