-- Re-run of 20260901001500_function_grants.sql, now that access_log has
-- landed. That file is written to be run again: each revoke is applied only if
-- the function is actually there, so the entries that were "not present yet"
-- on the first pass are what this closes.
--
-- The reason it is needed at all: Supabase's default privileges say
--
--     alter default privileges in schema public
--       grant execute on functions to anon, authenticated, service_role;
--
-- so a new function in `public` lands with a DIRECT grant to anon and
-- authenticated. `access_log.sql` revokes from PUBLIC, which is the other
-- spelling and does not remove a direct grant.

do $$
declare
  targets constant text[][] := array[
    ['public.set_invite_only(boolean)',            'anon, authenticated'],
    ['public.only_invited()',                      'anon, authenticated'],
    ['public.gen_referral_code()',                 'anon, authenticated'],
    ['public.referral_active_days()',              'anon, authenticated'],
    ['public.referral_new_days()',                 'anon, authenticated'],

    -- The two this re-run exists for.
    ['public.note_access(uuid, text, text)',       'anon, authenticated'],
    ['public.read_feed(text, text)',               'anon, authenticated'],

    -- And the one the usage migration brought with it.
    ['public.count_call(uuid, text)',              'anon, authenticated'],

    -- Signed in only.
    ['public.make_referral_code()',                'anon'],
    ['public.claim_referral(text)',                'anon'],
    ['public.referral_standing()',                 'anon']
  ];
  target text[];
  closed integer := 0;
  absent integer := 0;
begin
  foreach target slice 1 in array targets loop
    if to_regprocedure(target[1]) is null then
      absent := absent + 1;
      continue;
    end if;
    execute format('revoke all on function %s from %s', target[1], target[2]);
    closed := closed + 1;
  end loop;

  raise notice 'function grants: % closed, % not present yet', closed, absent;
end $$;