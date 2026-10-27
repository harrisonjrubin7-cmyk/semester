-- The student access-office route derives tenant and identity, exposes only
-- own status, requires exact-school human ownership, and preserves corrections.

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
  student_a uuid := 'ac100000-0000-0000-0000-000000000001';
  student_b uuid := 'bc100000-0000-0000-0000-000000000001';
  reviewer_a uuid := 'ac200000-0000-0000-0000-000000000001';
  reviewer_b uuid := 'bc200000-0000-0000-0000-000000000001';
begin
  insert into public.schools (id, name, short_name) values
    ('access-a', 'Synthetic Access A', 'A'), ('access-b', 'Synthetic Access B', 'B')
  on conflict (id) do nothing;
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (student_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'access-student-a@example.test', now(), now(), now()),
    (student_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'access-student-b@example.test', now(), now(), now()),
    (reviewer_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'access-reviewer-a@example.test', now(), now(), now()),
    (reviewer_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'access-reviewer-b@example.test', now(), now(), now())
  on conflict (id) do nothing;
  insert into public.profiles (user_id, handle, school_id) values
    (student_a, 'access-student-a', 'access-a'), (student_b, 'access-student-b', 'access-b'),
    (reviewer_a, 'access-reviewer-a', 'access-a'), (reviewer_b, 'access-reviewer-b', 'access-b')
  on conflict (user_id) do update set school_id = excluded.school_id;
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reviewer_a, 'disability_services_officer', 'school', 'access-a', 'institution'),
    (reviewer_b, 'disability_services_officer', 'school', 'access-b', 'institution')
  on conflict (subject, role, scope_kind, scope_id) do update set revoked_at = null, expires_at = null;
end $$;

do $$
declare
  made uuid;
  replay uuid;
  correction uuid;
  seen bigint;
  item public.accommodation_support_request%rowtype;
  latest text;
begin
  perform pg_temp.become('ac100000-0000-0000-0000-000000000001');
  made := public.raise_accommodation_support_request(
    'ac300000-0000-0000-0000-000000000001', 'accessibility_barrier',
    'The caption control is unavailable.', '2026-10-27', true
  );
  replay := public.raise_accommodation_support_request(
    'ac300000-0000-0000-0000-000000000001', 'accessibility_barrier',
    'The caption control is unavailable.', '2026-10-27', true
  );
  perform pg_temp.check('an exact replay returns the original receipt', replay = made);
  correction := public.correct_accommodation_support_request(
    made, 'ac400000-0000-0000-0000-000000000001', 'The caption control is missing on the lecture player.'
  );

  reset role;
  select * into item from public.accommodation_support_request where id = made;
  perform pg_temp.check('tenant and student are derived from the authenticated profile',
    item.tenant_id = 'access-a' and item.reporter = 'ac100000-0000-0000-0000-000000000001');
  perform pg_temp.check('the original evidence remains bound and the privacy notice is recorded',
    item.summary = 'The caption control is unavailable.' and item.content_sha256 ~ '^[0-9a-f]{64}$'
    and item.privacy_notice = '2026-10-27' and item.consented_at is not null);
  perform pg_temp.check('a blocking barrier carries the urgent SLA and escalation',
    item.response_due_at <= item.created_at + interval '4 hours 1 second'
    and item.escalation_at <= item.created_at + interval '8 hours 1 second');
  perform pg_temp.check('the correction is append-only evidence',
    (select count(*) = 1 from public.accommodation_support_request_revision where request_id = made)
    and (select content_sha256 ~ '^[0-9a-f]{64}$' from public.accommodation_support_request_revision where id = correction));

  perform pg_temp.become('ac100000-0000-0000-0000-000000000001');
  select count(*), max(summary) into seen, latest from public.my_accommodation_support_requests();
  perform pg_temp.check('the student reads only their own latest corrected status',
    seen = 1 and latest = 'The caption control is missing on the lecture player.');
  perform pg_temp.refused('a request key cannot be rebound to different evidence',
    $q$select public.raise_accommodation_support_request('ac300000-0000-0000-0000-000000000001', 'other', 'Different', '2026-10-27', true)$q$);
  perform pg_temp.refused('a student cannot rewrite the immutable original evidence',
    format('update public.accommodation_support_request set summary = %L where id = %L', 'Changed', made));
  perform pg_temp.refused('a student cannot rewrite an earlier correction',
    format('update public.accommodation_support_request_revision set summary = %L where id = %L', 'Changed', correction));

  perform pg_temp.become('bc100000-0000-0000-0000-000000000001');
  select count(*) into seen from public.my_accommodation_support_requests();
  perform pg_temp.check('another student sees no request status', seen = 0);
  perform pg_temp.refused('another student cannot correct the request',
    format('select public.correct_accommodation_support_request(%L, %L, %L)', made, 'bc400000-0000-0000-0000-000000000001', 'Tampered'));
  perform pg_temp.refused('another student cannot withdraw the request',
    format('select public.withdraw_accommodation_support_request(%L)', made));

  perform pg_temp.become('bc200000-0000-0000-0000-000000000001');
  perform pg_temp.refused('an access officer cannot read another school queue',
    $q$select * from public.accommodation_support_request_queue('access-a')$q$);
  perform pg_temp.refused('an access officer cannot claim another school request',
    format('select public.claim_accommodation_support_request(%L)', made));

  perform pg_temp.become('ac200000-0000-0000-0000-000000000001');
  select count(*), max(summary) into seen, latest from public.accommodation_support_request_queue('access-a');
  perform pg_temp.check('an exact-school human sees the corrected queue entry',
    seen = 1 and latest = 'The caption control is missing on the lecture player.');
  perform pg_temp.check('the exact-school human must claim before resolving',
    public.claim_accommodation_support_request(made) = 'in_review');
  perform pg_temp.check('the assigned human records only a routing outcome',
    public.resolve_accommodation_support_request(made, 'barrier_referred', 'case:SYNTHETIC-ACCESS-1') = 'resolved');

  reset role;
  select * into item from public.accommodation_support_request where id = made;
  perform pg_temp.check('resolution records human ownership and evidence',
    item.status = 'resolved' and item.assigned_to = 'ac200000-0000-0000-0000-000000000001'
    and item.resolved_by = item.assigned_to and item.resolution_evidence = 'case:SYNTHETIC-ACCESS-1');
  perform pg_temp.check('the audit trail contains submit correct claim and resolve events',
    (select count(*) = 4 from public.audit_event a
      where a.tenant_id = 'access-a' and a.action like 'accommodation_request.%'));
  perform pg_temp.check('audit detail contains neither request wording nor student identity',
    not exists (select 1 from public.audit_event a where a.tenant_id = 'access-a'
      and (a.detail::text ilike '%caption control%' or a.detail::text ilike '%ac100000%')));
end $$;

do $$
declare
  made uuid;
  item public.accommodation_support_request%rowtype;
begin
  perform pg_temp.become('ac100000-0000-0000-0000-000000000001');
  made := public.raise_accommodation_support_request(
    'ac300000-0000-0000-0000-000000000002', 'accommodation_support',
    'Please tell me how to start the official process.', '2026-10-27', true
  );
  perform pg_temp.check('a student can withdraw their still-open request',
    public.withdraw_accommodation_support_request(made) = 'withdrawn');
  perform pg_temp.check('withdrawal is idempotent', public.withdraw_accommodation_support_request(made) = 'withdrawn');
  perform pg_temp.refused('a withdrawn request cannot be corrected',
    format('select public.correct_accommodation_support_request(%L, %L, %L)', made, 'ac400000-0000-0000-0000-000000000002', 'Changed'));
  reset role;
  select * into item from public.accommodation_support_request where id = made;
  perform pg_temp.check('withdrawal preserves the request and records its state',
    item.status = 'withdrawn' and item.withdrawn_at is not null and item.summary = 'Please tell me how to start the official process.');
end $$;

do $$
begin
  reset role;
  perform pg_temp.check('RLS is enabled on both request evidence tables',
    (select relrowsecurity from pg_class where oid = 'public.accommodation_support_request'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.accommodation_support_request_revision'::regclass));
  perform pg_temp.check('authenticated clients have no direct request-table privileges',
    not has_table_privilege('authenticated', 'public.accommodation_support_request', 'select,insert,update,delete')
    and not has_table_privilege('authenticated', 'public.accommodation_support_request_revision', 'select,insert,update,delete'));
  perform pg_temp.refused('audit events remain immutable',
    $q$update public.audit_event set outcome = 'failed' where tenant_id = 'access-a' and action = 'accommodation_request.submitted'$q$);
  perform pg_temp.check('the schema contains no automated eligibility or adverse-decision field',
    not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name in ('accommodation_support_request', 'accommodation_support_request_revision')
        and column_name in ('eligible', 'eligibility', 'approved', 'denied', 'grade', 'enrollment', 'discipline', 'adverse_action', 'automated_decision')));
end $$;

rollback;
