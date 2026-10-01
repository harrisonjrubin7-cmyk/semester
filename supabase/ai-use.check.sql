-- The per-school, per-module AI use policy and its log (20260930290000).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- Core prompt 13 (D-1063). What this walks: with no policy every module and
-- class reads DENIED; the five never classes are denied whatever a row says,
-- and no row for one can be written, by a client or by the table's owner;
-- turning AI on needs a second person; turning it off does not; the kill
-- switch overrides a school's yes; every answer is logged without a prompt;
-- nothing in the policy or the log can be edited; another school sees none of it.
--
--   How to run it: supabase/check.sh ai-use

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.nobody()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- Runs one statement as `who` and returns the error message it drew, or null
-- when it went through. A refusal is asserted on its message, not on the fact
-- of an exception: "it raised" is also what a typo looks like.
create or replace function pg_temp.attempt(who uuid, statement text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  perform pg_temp.nobody();
  return null;
exception when others then
  perform pg_temp.nobody();
  return sqlerrm;
end $$;

create or replace function pg_temp.refused_with(what text, got text, expected text)
returns void language plpgsql as $$
begin
  if got is null then
    raise exception 'FAILED: % — it went through', what;
  end if;
  if got not ilike '%' || expected || '%' then
    raise exception 'FAILED: % — refused, but for another reason: %', what, got;
  end if;
  raise notice 'ok  % ("%")', what, got;
end $$;

create or replace function pg_temp.went_through(what text, got text)
returns void language plpgsql as $$
begin
  if got is not null then
    raise exception 'FAILED: % — refused: %', what, got;
  end if;
  raise notice 'ok  %', what;
end $$;

create temp table ids (k text primary key, v text not null);
create or replace function pg_temp.remember(k text, v text) returns void language sql as
  $$ insert into ids values (k, v) on conflict (k) do update set v = excluded.v $$;
create or replace function pg_temp.who(k text) returns uuid language sql stable as
  $$ select v::uuid from ids where ids.k = who.k $$;

-- ── The people ────────────────────────────────────────────────────────────

do $$
declare a uuid; b uuid; member uuid; other uuid; reader uuid;
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('au-check', 'AI Use Check University', array['au-check.example'], false),
    ('au-other', 'Other AI Use University', array['au-other.example'], false);

  a      := pg_temp.newuser('adm.alpha@au-check.example', 'au-check');
  b      := pg_temp.newuser('adm.bravo@au-check.example', 'au-check');
  reader := pg_temp.newuser('registrar@au-check.example', 'au-check');
  member := pg_temp.newuser('member@au-check.example', 'au-check');
  other  := pg_temp.newuser('adm.outsider@au-other.example', 'au-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (a, 'university_admin', 'school', 'au-check', 'institution'),
    (b, 'university_admin', 'school', 'au-check', 'institution'),
    (reader, 'registrar', 'school', 'au-check', 'institution'),
    (other, 'university_admin', 'school', 'au-other', 'institution');

  perform pg_temp.remember('a', a::text);
  perform pg_temp.remember('b', b::text);
  perform pg_temp.remember('reader', reader::text);
  perform pg_temp.remember('member', member::text);
  perform pg_temp.remember('other', other::text);
  raise notice 'ok  two schools, two administrators, a registrar, a member, an outsider';
end $$;

-- ── The lists ─────────────────────────────────────────────────────────────

do $$
begin
  perform pg_temp.counted('five never classes', cardinality(private.ai_use_never_classes()), 5);
  perform pg_temp.counted('five permittable classes', cardinality(private.ai_use_permittable_classes()), 5);
  perform pg_temp.counted('and no class is on both lists',
    (select count(*) from unnest(private.ai_use_never_classes()) n where n = any (private.ai_use_permittable_classes())), 0);
end $$;

-- ── The default is no ─────────────────────────────────────────────────────

do $$
declare r record;
begin
  select * into r from public.ai_use_permitted('au-check', 'lms_assignments', 'instructor_material', pg_temp.who('member'), 'a provider', 'a model');
  if r.allowed or r.reason <> 'no_policy' then raise exception 'FAILED: default was %/%', r.allowed, r.reason; end if;
  raise notice 'ok  with no policy, a Core module and a permittable class is denied (no_policy)';

  perform pg_temp.counted('and that decision was logged, with the names as text',
    (select count(*) from public.ai_use_log where tenant_id = 'au-check' and not allowed and reason = 'no_policy'
        and provider_name = 'a provider' and model_name = 'a model' and actor_id = pg_temp.who('member')), 1);

  select * into r from public.ai_use_permitted('au-check', 'not_a_module', 'instructor_material');
  if r.allowed or r.reason <> 'unknown_module' then raise exception 'FAILED: unknown module was %/%', r.allowed, r.reason; end if;
  select * into r from public.ai_use_permitted('au-check', 'degree_audit', 'a_made_up_class');
  if r.allowed or r.reason <> 'unknown_class' then raise exception 'FAILED: unknown class was %/%', r.allowed, r.reason; end if;
  select * into r from public.ai_use_permitted('no-such-school', 'degree_audit', 'catalog_public');
  if r.allowed then raise exception 'FAILED: an unknown school was allowed'; end if;
  raise notice 'ok  an unknown module, an unknown class and an unknown school are all denied';
end $$;

-- ── Asking: who may ──────────────────────────────────────────────────────

do $$
begin
  perform pg_temp.refused_with('a member cannot propose',
    pg_temp.attempt(pg_temp.who('member'),
      $q$select public.ai_use_propose('au-check','degree_audit','catalog_public',true,'x')$q$), 'cannot change');
  perform pg_temp.refused_with('the registrar reads but cannot propose',
    pg_temp.attempt(pg_temp.who('reader'),
      $q$select public.ai_use_propose('au-check','degree_audit','catalog_public',true,'x')$q$), 'cannot change');
  perform pg_temp.refused_with('an administrator elsewhere cannot propose for this school',
    pg_temp.attempt(pg_temp.who('other'),
      $q$select public.ai_use_propose('au-check','degree_audit','catalog_public',true,'x')$q$), 'cannot change');
  perform pg_temp.refused_with('a module that does not exist is refused',
    pg_temp.attempt(pg_temp.who('a'),
      $q$select public.ai_use_propose('au-check','not_a_module','catalog_public',true,'x')$q$), 'violates check constraint');
  perform pg_temp.refused_with('a class that does not exist is refused',
    pg_temp.attempt(pg_temp.who('a'),
      $q$select public.ai_use_propose('au-check','degree_audit','made_up',true,'x')$q$), 'violates check constraint');
  perform pg_temp.refused_with('a reason is required',
    pg_temp.attempt(pg_temp.who('a'),
      $q$select public.ai_use_propose('au-check','degree_audit','catalog_public',true,'  ')$q$), 'violates check constraint');
end $$;

-- ── The never classes: no row, by anyone ─────────────────────────────────

do $$
declare c text; m text;
begin
  foreach c in array private.ai_use_never_classes() loop
    perform pg_temp.refused_with('proposing to allow AI on ' || c || ' is refused, with the reason',
      pg_temp.attempt(pg_temp.who('a'),
        format($q$select public.ai_use_propose('au-check','records',%L,true,'x')$q$, c)), 'never permitted');
    perform pg_temp.refused_with('and proposing a "stop" for it is refused too: it is not a policy subject',
      pg_temp.attempt(pg_temp.who('a'),
        format($q$select public.ai_use_propose('au-check','records',%L,false,'x')$q$, c)), 'never permitted');
  end loop;

  -- The table itself refuses, even to its owner: the by-construction half.
  foreach m in array array['admissions', 'financial_aid'] loop
    begin
      insert into public.ai_use_proposal (tenant_id, module, data_class, permitted, reason, proposed_by)
      values ('au-check', m, case m when 'admissions' then 'admissions_decision' else 'aid_amount' end,
              true, 'owner tries', pg_temp.who('a'));
      raise exception 'FAILED: a row enabling AI on % was written', m;
    exception when check_violation then
      raise notice 'ok  the owner cannot write a policy row on the % never class either', m;
    end;
  end loop;
end $$;

-- ── Two people to turn it on ─────────────────────────────────────────────

do $$
declare pid uuid;
begin
  perform pg_temp.went_through('an administrator proposes AI on instructor material in lms_assignments',
    pg_temp.attempt(pg_temp.who('a'),
      $q$select public.ai_use_propose('au-check','lms_assignments','instructor_material',true,'Pilot: instructors only')$q$));
  select id into pid from public.ai_use_proposal where tenant_id = 'au-check' and module = 'lms_assignments';

  perform pg_temp.refused_with('a second pending proposal for the same module and class is refused',
    pg_temp.attempt(pg_temp.who('a'),
      $q$select public.ai_use_propose('au-check','lms_assignments','instructor_material',true,'again')$q$), 'already waiting');

  perform pg_temp.counted('proposed is not permitted: still denied',
    (select count(*) from public.ai_use_permitted('au-check', 'lms_assignments', 'instructor_material') where not allowed and reason = 'no_policy'), 1);

  perform pg_temp.refused_with('the proposer cannot approve their own proposal',
    pg_temp.attempt(pg_temp.who('a'), format($q$select public.ai_use_approve(%L)$q$, pid)), 'cannot approve it');
  perform pg_temp.refused_with('a member cannot approve',
    pg_temp.attempt(pg_temp.who('member'), format($q$select public.ai_use_approve(%L)$q$, pid)), 'cannot approve');
  perform pg_temp.refused_with('an administrator elsewhere cannot approve',
    pg_temp.attempt(pg_temp.who('other'), format($q$select public.ai_use_approve(%L)$q$, pid)), 'cannot approve');
  perform pg_temp.refused_with('the registrar, who may read, cannot approve',
    pg_temp.attempt(pg_temp.who('reader'), format($q$select public.ai_use_approve(%L)$q$, pid)), 'cannot approve');

  perform pg_temp.went_through('a second administrator approves',
    pg_temp.attempt(pg_temp.who('b'), format($q$select public.ai_use_approve(%L)$q$, pid)));
  perform pg_temp.refused_with('approving twice is refused',
    pg_temp.attempt(pg_temp.who('b'), format($q$select public.ai_use_approve(%L)$q$, pid)), 'already decided');

  perform pg_temp.counted('now that module and class is allowed',
    (select count(*) from public.ai_use_permitted('au-check', 'lms_assignments', 'instructor_material', pg_temp.who('member'), 'p', 'm') where allowed and reason = 'permitted_by_school'), 1);
  perform pg_temp.counted('control: another class in the same module is still denied',
    (select count(*) from public.ai_use_permitted('au-check', 'lms_assignments', 'requesters_own_work') where not allowed and reason = 'no_policy'), 1);
  perform pg_temp.counted('control: the same class in another module is still denied',
    (select count(*) from public.ai_use_permitted('au-check', 'scheduling', 'instructor_material') where not allowed and reason = 'no_policy'), 1);
  perform pg_temp.counted('control: another school is unaffected',
    (select count(*) from public.ai_use_permitted('au-other', 'lms_assignments', 'instructor_material') where not allowed and reason = 'no_policy'), 1);
  perform pg_temp.counted('and the never classes stay denied in a school with a yes on file',
    (select count(*) from public.ai_use_permitted('au-check', 'records', 'grade_or_transcript') where not allowed and reason = 'never_class'), 1);
  perform pg_temp.counted('whatever case or spacing they are asked in',
    (select count(*) from public.ai_use_permitted('au-check', ' Admissions ', ' ADMISSIONS_DECISION ') where not allowed and reason = 'never_class'), 1);
end $$;

-- An expired proposal cannot be approved.
do $$
declare pid uuid;
begin
  perform pg_temp.went_through('an administrator proposes another',
    pg_temp.attempt(pg_temp.who('a'),
      $q$select public.ai_use_propose('au-check','scheduling','schedule_structure',true,'Timetable explainer')$q$));
  select id into pid from public.ai_use_proposal where module = 'scheduling';
  -- Not even the owner edits a row, so the clock is wound by lifting the guard for one statement.
  alter table public.ai_use_proposal disable trigger ai_use_proposal_immutable;
  update public.ai_use_proposal set expires_at = clock_timestamp() - interval '1 second' where id = pid;
  alter table public.ai_use_proposal enable trigger ai_use_proposal_immutable;
  perform pg_temp.refused_with('a proposal past its seven days takes no approval',
    pg_temp.attempt(pg_temp.who('b'), format($q$select public.ai_use_approve(%L)$q$, pid)), 'expired');
end $$;

-- ── Turning it off waits for nobody ──────────────────────────────────────

do $$
begin
  perform pg_temp.went_through('one administrator turns AI off',
    pg_temp.attempt(pg_temp.who('b'),
      $q$select public.ai_use_propose('au-check','lms_assignments','instructor_material',false,'Pause while we review')$q$));
  perform pg_temp.counted('and it is denied at once, by the school',
    (select count(*) from public.ai_use_permitted('au-check', 'lms_assignments', 'instructor_material') where not allowed and reason = 'denied_by_school'), 1);

  perform pg_temp.went_through('proposed on again', pg_temp.attempt(pg_temp.who('a'),
    $q$select public.ai_use_propose('au-check','lms_assignments','instructor_material',true,'Review done')$q$));
  perform pg_temp.went_through('and approved', pg_temp.attempt(pg_temp.who('b'),
    format($q$select public.ai_use_approve(%L)$q$, (select id from public.ai_use_proposal where reason = 'Review done'))));
  perform pg_temp.counted('allowed again',
    (select count(*) from public.ai_use_permitted('au-check', 'lms_assignments', 'instructor_material') where allowed), 1);

  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason)
  values ('au-check', 'kill.ai_generation', true, 'drill');
  perform pg_temp.counted('under kill.ai_generation the school''s yes is overridden',
    (select count(*) from public.ai_use_permitted('au-check', 'lms_assignments', 'instructor_material') where not allowed and reason = 'kill_switch'), 1);
  update public.feature_kill_switch set engaged = false where switch_key = 'kill.ai_generation';
  perform pg_temp.counted('released: the yes is back, and nobody had to re-propose',
    (select count(*) from public.ai_use_permitted('au-check', 'lms_assignments', 'instructor_material') where allowed), 1);
end $$;

-- ── The log ───────────────────────────────────────────────────────────────

do $$
declare cols text; total bigint;
begin
  select string_agg(column_name, ',' order by ordinal_position) into cols
    from information_schema.columns where table_schema = 'public' and table_name = 'ai_use_log';
  if cols <> 'id,at,tenant_id,module,data_class,actor_id,allowed,reason,provider_name,model_name' then
    raise exception 'FAILED: the log has columns %', cols;
  end if;
  raise notice 'ok  the log has no column that could hold a prompt or a response (%)', cols;

  perform pg_temp.counted('the allowed lines are all permitted_by_school',
    (select count(*) from public.ai_use_log where allowed and reason <> 'permitted_by_school'), 0);
  select count(*) into total from public.ai_use_log where tenant_id = 'au-check';
  if total < 10 then raise exception 'FAILED: only % decisions logged', total; end if;
  raise notice 'ok  % decisions logged for the school', total;

  perform pg_temp.become(pg_temp.who('reader'));
  perform pg_temp.counted('the registrar reads the school''s whole log',
    (select count(*) from public.ai_use_log where tenant_id = 'au-check'), total);
  perform pg_temp.counted('and the policy in force',
    (select count(*) from public.ai_use_policy('au-check')), 1);
  perform pg_temp.nobody();
  perform pg_temp.become(pg_temp.who('member'));
  perform pg_temp.counted('a member reads none of the log', (select count(*) from public.ai_use_log), 0);
  perform pg_temp.counted('and none of the proposals', (select count(*) from public.ai_use_proposal), 0);
  perform pg_temp.nobody();
  perform pg_temp.become(pg_temp.who('other'));
  perform pg_temp.counted('another school''s administrator reads none of it', (select count(*) from public.ai_use_log where tenant_id = 'au-check'), 0);
  perform pg_temp.nobody();

  perform pg_temp.refused_with('no signed-in account may call the decision function',
    pg_temp.attempt(pg_temp.who('a'), $q$select * from public.ai_use_permitted('au-check','degree_audit','catalog_public')$q$), 'permission denied');
  perform pg_temp.refused_with('nor write the log',
    pg_temp.attempt(pg_temp.who('a'), $q$insert into public.ai_use_log (tenant_id,module,data_class,allowed,reason) values ('au-check','records','catalog_public',true,'permitted_by_school')$q$), 'permission denied');
end $$;

do $$
begin
  begin
    insert into public.ai_use_log (tenant_id, module, data_class, allowed, reason)
    values ('au-check', 'records', 'grade_or_transcript', true, 'never_class');
    raise exception 'FAILED: a never class was logged as allowed';
  exception when check_violation then
    raise notice 'ok  a never class cannot be logged as allowed, even by the owner';
  end;
end $$;

-- ── Append-only, even to the owner ───────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['ai_use_proposal', 'ai_use_approval', 'ai_use_log'] loop
    begin
      execute format('update public.%I set %I = %I', t,
        case t when 'ai_use_proposal' then 'reason' when 'ai_use_approval' then 'approver' else 'reason' end,
        case t when 'ai_use_proposal' then 'reason' when 'ai_use_approval' then 'approver' else 'reason' end);
      raise exception 'FAILED: % was updated', t;
    exception when others then
      if sqlerrm not ilike '%append-only%' then raise; end if;
      raise notice 'ok  % cannot be edited, even by the owner', t;
    end;
    begin
      execute format('delete from public.%I', t);
      raise exception 'FAILED: % was deleted from', t;
    exception when others then
      if sqlerrm not ilike '%append-only%' then raise; end if;
      raise notice 'ok  nor deleted from (%)', t;
    end;
  end loop;
end $$;

rollback;
