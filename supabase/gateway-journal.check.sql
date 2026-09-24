-- Shared action state must remain tenant-scoped, atomic and conservative.
-- How to run it: supabase/check.sh gateway-journal

begin;

insert into public.schools (id, name, email_domains) values
  ('gateway-a', 'Gateway A', array['a.example']),
  ('gateway-b', 'Gateway B', array['b.example']);

do $$
declare
  first_id uuid := '10000000-0000-4000-8000-000000000001';
  second_id uuid := '10000000-0000-4000-8000-000000000002';
  intelligence_id uuid := '10000000-0000-4000-8000-000000000010';
  operation text := repeat('a', 64);
  rows_seen integer;
begin
  if not public.gateway_journal_health() then
    raise exception 'FAILED: the write readiness probe did not succeed';
  end if;

  if not public.gateway_save_review(first_id, 'gateway-a', 'student-a', now() + interval '10 minutes', operation, repeat('x', 40)) then
    raise exception 'FAILED: a valid review was not saved';
  end if;

  select count(*) into rows_seen from public.gateway_get_review(first_id, 'gateway-a', 'student-a');
  if rows_seen <> 1 then raise exception 'FAILED: the owner could not load their review'; end if;
  select count(*) into rows_seen from public.gateway_get_review(first_id, 'gateway-a', 'student-b');
  if rows_seen <> 0 then raise exception 'FAILED: another actor loaded the review'; end if;
  select count(*) into rows_seen from public.gateway_get_review(first_id, 'gateway-b', 'student-a');
  if rows_seen <> 0 then raise exception 'FAILED: another tenant loaded the review'; end if;

  if not public.gateway_claim_review(first_id, 'gateway-a', 'student-a', now()) then
    raise exception 'FAILED: the owner could not atomically claim a ready review';
  end if;
  if public.gateway_claim_review(first_id, 'gateway-a', 'student-a', now()) then
    raise exception 'FAILED: the same review was claimed twice';
  end if;
  if not public.gateway_finish_review(first_id, 'gateway-a', 'student-a', 'uncertain', repeat('u', 40)) then
    raise exception 'FAILED: processing could not become uncertain';
  end if;

  perform public.gateway_save_review(second_id, 'gateway-a', 'student-a', now() + interval '10 minutes', operation, repeat('y', 40));
  if public.gateway_claim_review(second_id, 'gateway-a', 'student-a', now()) then
    raise exception 'FAILED: a duplicate operation was claimed while the first was uncertain';
  end if;

  if not public.gateway_finish_review(first_id, 'gateway-a', 'student-a', 'completed', repeat('c', 40)) then
    raise exception 'FAILED: reconciliation could not resolve uncertain to completed';
  end if;
  if not public.gateway_claim_review(second_id, 'gateway-a', 'student-a', now()) then
    raise exception 'FAILED: a resolved operation continued blocking a later review';
  end if;
  if not public.gateway_finish_review(second_id, 'gateway-a', 'student-a', 'uncertain', repeat('z', 40)) then
    raise exception 'FAILED: the second processing action could not become uncertain';
  end if;
  if public.gateway_finish_review(first_id, 'gateway-a', 'student-a', 'uncertain', repeat('q', 40)) then
    raise exception 'FAILED: a completed action moved back to uncertain';
  end if;

  update private.gateway_review set expires_at = now() - interval '200 days';
  perform public.gateway_purge_journal();
  if exists (select 1 from private.gateway_review where id = first_id) then
    raise exception 'FAILED: an old completed action was not purged';
  end if;
  if not exists (select 1 from private.gateway_review where id = second_id and state = 'uncertain') then
    raise exception 'FAILED: retention erased an unresolved action';
  end if;

  if not public.gateway_write_audit('gateway-a', 'student-a', 'assignments', 'action.checked', second_id) then
    raise exception 'FAILED: an audit event was not recorded';
  end if;
  if not public.gateway_write_intelligence_audit(
    'gateway-a', 'student-a', 'study', 'openai', 'gpt-5-mini', 100, 20, 1.25,
    'sandbox:explain', null, null
  ) then raise exception 'FAILED: an intelligence audit event was not recorded'; end if;

  if not public.gateway_take_rate_limit('gateway-a', 'student-a', '2026-09-24T18:00:01Z', 60, 2)
     or not public.gateway_take_rate_limit('gateway-a', 'student-a', '2026-09-24T18:00:02Z', 60, 2) then
    raise exception 'FAILED: requests inside the shared allowance were refused';
  end if;
  if public.gateway_take_rate_limit('gateway-a', 'student-a', '2026-09-24T18:00:03Z', 60, 2) then
    raise exception 'FAILED: a request above the shared allowance was accepted';
  end if;
  if not public.gateway_take_rate_limit('gateway-a', 'student-b', '2026-09-24T18:00:03Z', 60, 2)
     or not public.gateway_take_rate_limit('gateway-a', 'student-a', '2026-09-24T18:01:00Z', 60, 2) then
    raise exception 'FAILED: rate-limit identities or fixed windows were not isolated';
  end if;

  if not public.gateway_save_intelligence_action(
    intelligence_id, 'gateway-a', 'student-a', now() + interval '5 minutes', repeat('i', 40)
  ) then raise exception 'FAILED: an intelligence action was not saved'; end if;
  select count(*) into rows_seen
    from public.gateway_claim_intelligence_action(intelligence_id, 'gateway-a', 'student-b', now());
  if rows_seen <> 0 then raise exception 'FAILED: another actor claimed an intelligence action'; end if;
  select count(*) into rows_seen
    from public.gateway_claim_intelligence_action(intelligence_id, 'gateway-a', 'student-a', now());
  if rows_seen <> 1 then raise exception 'FAILED: the owner could not claim an intelligence action'; end if;
  select count(*) into rows_seen
    from public.gateway_claim_intelligence_action(intelligence_id, 'gateway-a', 'student-a', now());
  if rows_seen <> 0 then raise exception 'FAILED: an intelligence action was claimed twice'; end if;
end $$;

do $$
begin
  if has_table_privilege('authenticated', 'private.gateway_review', 'select')
     or has_table_privilege('anon', 'private.gateway_review', 'select') then
    raise exception 'FAILED: browser roles can read encrypted action state';
  end if;
  if has_function_privilege('authenticated', 'public.gateway_get_review(uuid,text,text)', 'execute')
     or has_function_privilege('anon', 'public.gateway_get_review(uuid,text,text)', 'execute') then
    raise exception 'FAILED: browser roles can call the server-only journal RPC';
  end if;
  if not has_function_privilege('service_role', 'public.gateway_get_review(uuid,text,text)', 'execute') then
    raise exception 'FAILED: the service role cannot call the journal RPC';
  end if;
  if has_table_privilege('authenticated', 'private.gateway_rate_limit', 'select')
     or has_function_privilege('authenticated', 'public.gateway_take_rate_limit(text,text,timestamptz,integer,integer)', 'execute') then
    raise exception 'FAILED: browser roles can reach shared rate-limit state';
  end if;
  if has_table_privilege('authenticated', 'private.gateway_intelligence_action', 'select')
     or has_function_privilege('authenticated', 'public.gateway_claim_intelligence_action(uuid,text,text,timestamptz)', 'execute') then
    raise exception 'FAILED: browser roles can reach intelligence action state';
  end if;
end $$;

rollback;
