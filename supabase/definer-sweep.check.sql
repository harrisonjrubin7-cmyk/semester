-- Every definer function a signed-in account can call, called by one that
-- holds nothing.
--
-- `docs/DEFINER-RLS-REGISTER.md` holds each of the 153 `security definer`
-- functions in `grants.check.sql`'s allowlist to the checks its body makes —
-- `auth.uid()`, a capability helper, an ownership test. That proves the check
-- is present. It does not prove it works, and its entry DR-02 said so: the
-- behavioural suites each walk their own feature, and not every function had
-- one that calls it as somebody with no business calling it.
--
-- This is that call, made to every one of them. A stranger — signed in, no
-- school, no role grant, no capability, no share — calls each function with a
-- neutral argument of each type it takes, and must be refused or told
-- nothing. The functions that do answer a stranger are the ones whose whole
-- job is the caller's own account (mint my code, export my data, forget my
-- history); each is named in `expected` below with why, and a new one that
-- answers is a failure until somebody decides which it is.
--
-- A second account, the victim, is given real data first — a referral code
-- and a support ticket, made through its own functions — and nothing the
-- stranger is answered may carry the victim's id, email, code or ticket
-- subject. That is what makes "answered" a finding and not just a count: a
-- function that answers everybody with everybody's data fails here even if
-- it is on the list.
--
-- ## What it does not prove
--
-- Neutral arguments name nothing real. A function that answers anyone who
-- holds a real id of somebody else's object — the shape of the
-- `gtm_pilot_problems` fault fixed in 20260929120000 — answers a random id
-- with "no such thing" here, and passes. That class stays with the feature
-- suites, which hold real ids; this sweep is the floor under them, not a
-- replacement for them.
--
-- ## Where it has been shown to fail
--
-- Two probes are planted below and must be named: a definer function that
-- counts every account (answers a stranger with a number), and one that
-- returns the first account's email (answers with the victim's). If either
-- stops being named, the sweep has stopped being a guard.
--
--   How to run it: supabase/check.sh definer-sweep

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  return who;
end $$;

/** A neutral argument of each type a callable definer function takes; null for a type nobody has thought about. */
create or replace function pg_temp.neutral(t text)
returns text language plpgsql as $$
begin
  return case t
    when 'uuid' then quote_literal(gen_random_uuid()::text) || '::uuid'
    when 'text' then quote_literal('x')
    when 'text[]' then '''{}''::text[]'
    when 'uuid[]' then '''{}''::uuid[]'
    when 'jsonb' then '''{}''::jsonb'
    when 'boolean' then 'false'
    when 'integer' then '1'
    when 'numeric' then '1::numeric'
    when 'timestamp with time zone' then 'now()'
    when 'date' then 'current_date'
    else null
  end;
end $$;

/**
 * What one call answers a caller: 'refused' when it raises, 'empty' when it
 * returns nothing a caller could learn from, 'done' when a void function
 * succeeds, and otherwise the whole answer as text.
 */
create or replace function pg_temp.call_as(who uuid, fn oid)
returns text language plpgsql as $$
declare
  args text;
  missing text;
  n bigint;
  rows text;
  j jsonb;
  p pg_proc;
begin
  select * into p from pg_proc where oid = fn;
  select string_agg(pg_temp.neutral(format_type(t, null)), ', ' order by i),
         string_agg(format_type(t, null), ', ') filter (where pg_temp.neutral(format_type(t, null)) is null)
    into args, missing
    from unnest(p.proargtypes::oid[]) with ordinality as a(t, i);
  if missing is not null then
    raise exception 'FAILED: % takes %, which the sweep has no neutral value for — add one', p.proname, missing;
  end if;
  args := coalesce(args, '');
  begin
    perform pg_temp.become(who);
    if p.proretset then
      execute format('select count(*), coalesce(string_agg(to_jsonb(r)::text, '' ''), '''') from public.%I(%s) r', p.proname, args)
        into n, rows;
      execute 'reset role';
      return case when n = 0 then 'empty' else n || ' rows: ' || rows end;
    elsif p.prorettype = 'void'::regtype then
      execute format('select public.%I(%s)', p.proname, args);
      execute 'reset role';
      return 'done';
    else
      execute format('select to_jsonb(public.%I(%s))', p.proname, args) into j;
      execute 'reset role';
      if j is null or j in ('false', '0', '[]', '{}', '""', '["not_found"]', 'null') then
        return 'empty';
      end if;
      return j::text;
    end if;
  exception when others then
    execute 'reset role';
    return 'refused';
  end;
end $$;

/** Every callable definer function in `public`, and what it answered `who`. */
create or replace function pg_temp.sweep(who uuid)
returns table (fn text, answer text) language plpgsql as $$
declare f record;
begin
  for f in
    select p.oid, p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.prokind = 'f'
       and has_function_privilege('authenticated', p.oid, 'execute')
     order by p.proname
  loop
    fn := f.proname;
    answer := pg_temp.call_as(who, f.oid);
    return next;
  end loop;
end $$;

/**
 * Of a sweep, the functions that answered in a way nobody decided on: not
 * refused, not empty, and not on `expected` with an answer matching its
 * pattern — or carrying anything of the victim's at all.
 */
create or replace function pg_temp.offenders(swept jsonb, expected jsonb, secrets text[])
returns text language plpgsql as $$
declare
  s record;
  out text := '';
  leak text;
begin
  for s in select * from jsonb_to_recordset(swept) as x(fn text, answer text) loop
    select string_agg(k, ', ') into leak from unnest(secrets) k where position(k in s.answer) > 0;
    if leak is not null then
      out := out || format(' | %s leaked %s', s.fn, leak);
    elsif s.answer not in ('refused', 'empty')
          and not (expected ? s.fn and s.answer ~ (expected -> s.fn ->> 'answers')) then
      out := out || format(' | %s answered %s', s.fn, left(s.answer, 80));
    end if;
  end loop;
  return nullif(out, '');
end $$;

do $$
declare
  stranger uuid := pg_temp.newuser('stranger@sweep.example');
  victim uuid := pg_temp.newuser('victim@sweep.example');
  code text;
  secrets text[];
  swept jsonb;
  total int;
  bad text;
  stale text;
  /*
   * The functions that answer a stranger, each with the shape of what it may
   * say and why saying it is right. Every one acts on the caller's own
   * account or answers with a fixed status word that names nothing.
   */
  expected constant jsonb := jsonb_build_object(
    'adopt_lti_identity',          jsonb_build_object('answers', '^"stale"$',   'why', 'a ticket nobody minted is "stale"; attaches nothing'),
    'claim_family_invite',         jsonb_build_object('answers', '^"unknown"$', 'why', 'a code nobody made is "unknown"; grants nothing'),
    'claim_referral',              jsonb_build_object('answers', '^"unknown"$', 'why', 'a code nobody made is "unknown"; records nothing'),
    'community_reviewer_standing', jsonb_build_object('answers', '^"none"$',    'why', 'the caller''s own reviewer standing, which is none'),
    'export_my_data',              jsonb_build_object('answers', '^\{"format": "semester\.account-export"', 'why', 'the caller''s own export; the leak check holds it to the caller'),
    'forget_my_beta',              jsonb_build_object('answers', '^done$', 'why', 'deletes the caller''s own beta rows'),
    'forget_my_community',         jsonb_build_object('answers', '^done$', 'why', 'deletes the caller''s own community rows'),
    'forget_my_help_requests',     jsonb_build_object('answers', '^done$', 'why', 'deletes the caller''s own help requests'),
    'forget_my_support_tickets',   jsonb_build_object('answers', '^done$', 'why', 'deletes the caller''s own tickets'),
    'make_referral_code',          jsonb_build_object('answers', '^"[A-Z0-9]{8}"$', 'why', 'mints the caller''s own code'),
    'my_age_status',               jsonb_build_object('answers', '^"(adult|unknown|under_minimum)"$', 'why', 'the caller''s own age standing, a fixed word'),
    'my_community_standing',       jsonb_build_object('answers', '^"Your Community account is in good standing\."$', 'why', 'the caller''s own standing'),
    'my_moderation_access',        jsonb_build_object('answers', '^1 rows: \{"can_act": false, "can_read": false\}$', 'why', 'the caller''s own two capabilities, both false'),
    'note_activity',               jsonb_build_object('answers', '^done$', 'why', 'marks the caller''s own day'),
    'referral_standing',           jsonb_build_object('answers', '^1 rows: ', 'why', 'the caller''s own code and counts; the leak check holds it to the caller'),
    'state_my_age',                jsonb_build_object('answers', '^"(already_stated|under_minimum_age)"$', 'why', 'states the caller''s own age, once; check.sh records the stranger as an adult who already said'),
    'stop_contributing',           jsonb_build_object('answers', '^done$', 'why', 'withdraws the caller''s own course plan')
  );
begin
  -- The victim, with something to lose.
  perform pg_temp.become(victim);
  code := public.make_referral_code();
  perform public.open_support_ticket('how_to', 'Victim ticket subject', 'Victim ticket body', '{}'::jsonb, false);
  execute 'reset role';
  secrets := array[victim::text, 'victim@sweep.example', code, 'Victim ticket subject', 'Victim ticket body'];

  select jsonb_agg(to_jsonb(s)), count(*) into swept, total from pg_temp.sweep(stranger) s;
  if total < 153 then
    raise exception 'FAILED: the sweep found % callable definer functions; the register holds 153', total;
  end if;
  raise notice 'ok  every one of the % callable definer functions was called by a stranger', total;

  bad := pg_temp.offenders(swept, expected, secrets);
  if bad is not null then
    raise exception 'FAILED: a stranger was answered where nobody decided it should be:%', bad;
  end if;
  raise notice 'ok  each was refused, empty, or on the list, and none carried the victim''s data';

  select string_agg(k, ', ') into stale from jsonb_object_keys(expected) k
   where not exists (select 1 from jsonb_to_recordset(swept) as x(fn text, answer text)
                      where x.fn = k and x.answer not in ('refused', 'empty'));
  if stale is not null then
    raise exception 'FAILED: on the list but no longer answers a stranger: % — take it off', stale;
  end if;
  raise notice 'ok  every function on the list still answers, so the list is not stale';
end $$;

-- ── The probes: the sweep must name both, or it is not a guard ──────────────

create function public.zz_sweep_probe_count() returns bigint
language sql stable security definer set search_path = '' as $$ select count(*) from auth.users $$;
create function public.zz_sweep_probe_email() returns text
language sql stable security definer set search_path = '' as $$
  select email from auth.users where email like 'victim@%' limit 1 $$;
grant execute on function public.zz_sweep_probe_count() to authenticated;
grant execute on function public.zz_sweep_probe_email() to authenticated;

do $$
declare
  stranger uuid := (select id from auth.users where email = 'stranger@sweep.example');
  swept jsonb;
  bad text;
begin
  select jsonb_agg(to_jsonb(s)) into swept from pg_temp.sweep(stranger) s where s.fn like 'zz_sweep_probe_%';
  bad := coalesce(pg_temp.offenders(swept, '{}'::jsonb, array['victim@sweep.example']), '');
  if position('zz_sweep_probe_count answered' in bad) = 0 then
    raise exception 'FAILED: the probe that counts every account was not named: %', bad;
  end if;
  if position('zz_sweep_probe_email leaked victim@sweep.example' in bad) = 0 then
    raise exception 'FAILED: the probe that returns the victim''s email was not named: %', bad;
  end if;
  raise notice 'ok  both planted probes are named';
end $$;

rollback;
