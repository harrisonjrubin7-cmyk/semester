-- A student AI-answer remedy stays in their tenant, reaches only an exact-school
-- human reviewer, binds immutable evidence and creates content-free audit events.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.check(what text, got boolean)
returns void language plpgsql as $$
begin
  if got is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

create or replace function pg_temp.refused(what text, sql text)
returns void language plpgsql as $$
begin
  begin execute sql;
  exception when others then raise notice 'ok  %', what; return;
  end;
  raise exception 'FAILED: % -- action was allowed', what;
end $$;

do $$
declare
  student_a uuid := 'a1000000-0000-0000-0000-000000000001';
  student_b uuid := 'b1000000-0000-0000-0000-000000000001';
  reviewer_a uuid := 'a2000000-0000-0000-0000-000000000001';
  reviewer_b uuid := 'b2000000-0000-0000-0000-000000000001';
begin
  insert into public.schools (id, name, short_name) values
    ('remedy-a', 'Synthetic Remedy A', 'A'), ('remedy-b', 'Synthetic Remedy B', 'B')
  on conflict (id) do nothing;
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (student_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student-a@example.test', now(), now(), now()),
    (student_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student-b@example.test', now(), now(), now()),
    (reviewer_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reviewer-a@example.test', now(), now(), now()),
    (reviewer_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reviewer-b@example.test', now(), now(), now())
  on conflict (id) do nothing;
  insert into public.profiles (user_id, handle, school_id) values
    (student_a, 'student-a', 'remedy-a'), (student_b, 'student-b', 'remedy-b'),
    (reviewer_a, 'reviewer-a', 'remedy-a'), (reviewer_b, 'reviewer-b', 'remedy-b')
  on conflict (user_id) do update set school_id = excluded.school_id;
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reviewer_a, 'trust_officer', 'school', 'remedy-a', 'institution'),
    (reviewer_b, 'trust_officer', 'school', 'remedy-b', 'institution')
  on conflict (subject, role, scope_kind, scope_id) do update set revoked_at = null, expires_at = null;
end $$;

do $$
declare
  made uuid;
  replay uuid;
  seen bigint;
  item public.ai_answer_remedy%rowtype;
begin
  perform pg_temp.become('a1000000-0000-0000-0000-000000000001');
  made := public.raise_ai_answer_remedy(
    'a3000000-0000-0000-0000-000000000001', 'harmful', 'This answer could cause harm.',
    repeat('a', 64), 'limited', 'allowed', 1
  );
  replay := public.raise_ai_answer_remedy(
    'a3000000-0000-0000-0000-000000000001', 'harmful', 'This answer could cause harm.',
    repeat('a', 64), 'limited', 'allowed', 1
  );
  perform pg_temp.check('an exact replay returns the original receipt', replay = made);

  reset role;
  select * into item from public.ai_answer_remedy where id = made;
  perform pg_temp.check('tenant is derived from the reporter profile', item.tenant_id = 'remedy-a');
  perform pg_temp.check('only a hash and quality snapshot link the answer',
    item.answer_sha256 = repeat('a', 64) and item.evidence_reference = 'ask-semester:aaaaaaaaaaaaaaaa');
  perform pg_temp.check('harm reports carry the urgent SLA and escalation',
    item.response_due_at <= item.created_at + interval '4 hours 1 second'
    and item.escalation_at <= item.created_at + interval '8 hours 1 second');
  perform pg_temp.check('the row begins unassigned for human review',
    item.status = 'submitted' and item.owner_seat = 'trust_officer' and item.assigned_to is null);

  perform pg_temp.become('a1000000-0000-0000-0000-000000000001');
  select count(*) into seen from public.my_ai_answer_remedies();
  perform pg_temp.check('reporter can read their own status', seen = 1);
  perform pg_temp.refused('an idempotency key cannot be rebound to different evidence',
    $q$select public.raise_ai_answer_remedy('a3000000-0000-0000-0000-000000000001', 'incorrect', 'different', repeat('b', 64), 'none', 'limited', 0)$q$);
  perform pg_temp.refused('authenticated clients cannot rewrite immutable evidence',
    format('update public.ai_answer_remedy set summary = %L where id = %L', 'changed', made));

  perform pg_temp.become('b2000000-0000-0000-0000-000000000001');
  perform pg_temp.refused('a reviewer cannot read another tenant queue',
    $q$select * from public.ai_answer_remedy_queue('remedy-a')$q$);
  perform pg_temp.refused('a reviewer cannot claim another tenant report',
    format('select public.claim_ai_answer_remedy(%L)', made));

  perform pg_temp.become('a2000000-0000-0000-0000-000000000001');
  select count(*) into seen from public.ai_answer_remedy_queue('remedy-a');
  perform pg_temp.check('an exact-school human reviewer can read the queue', seen = 1);
  perform pg_temp.check('the reviewer must claim before resolving', public.claim_ai_answer_remedy(made) = 'in_review');
  perform pg_temp.check('only the assigned human can record an allowed outcome',
    public.resolve_ai_answer_remedy(made, 'referred_to_owner', 'case:SYNTHETIC-001') = 'resolved');

  reset role;
  select * into item from public.ai_answer_remedy where id = made;
  perform pg_temp.check('resolution records human ownership and evidence',
    item.status = 'resolved' and item.assigned_to = 'a2000000-0000-0000-0000-000000000001'
    and item.resolved_by = item.assigned_to and item.resolution_evidence = 'case:SYNTHETIC-001');
  delete from auth.users where id = 'a2000000-0000-0000-0000-000000000001';
  select * into item from public.ai_answer_remedy where id = made;
  perform pg_temp.check('reviewer account erasure clears direct identities without deleting the outcome',
    item.status = 'resolved' and item.assigned_to is null and item.resolved_by is null
    and item.assigned_at is not null and item.resolved_at is not null
    and item.resolution_code = 'referred_to_owner');
  perform pg_temp.check('the audit trail contains submit claim and resolve events',
    (select count(*) = 3 from public.audit_event a
      where a.tenant_id = 'remedy-a' and a.action like 'ai_remedy.%'));
  perform pg_temp.check('audit detail contains neither answer nor student summary',
    not exists (select 1 from public.audit_event a
      where a.tenant_id = 'remedy-a'
        and (a.detail::text ilike '%This answer could cause harm%'
             or a.detail::text ilike '%' || repeat('a', 64) || '%')));
end $$;

do $$
begin
  reset role;
  perform pg_temp.check('RLS is enabled',
    (select relrowsecurity from pg_class where oid = 'public.ai_answer_remedy'::regclass));
  perform pg_temp.check('authenticated clients have no direct table privileges',
    not has_table_privilege('authenticated', 'public.ai_answer_remedy', 'select,insert,update,delete'));
  perform pg_temp.refused('audit events remain immutable',
    $q$update public.audit_event set outcome = 'failed' where tenant_id = 'remedy-a' and action = 'ai_remedy.submitted'$q$);
  perform pg_temp.check('the remedy schema has no automated adverse-action field',
    not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'ai_answer_remedy'
        and column_name in ('grade', 'enrollment', 'discipline', 'adverse_action', 'automated_decision')));
end $$;

rollback;
