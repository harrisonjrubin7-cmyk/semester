-- The storage half of the productivity command API: that the commit function is
-- atomic, idempotent, gapless and refuses a stale writer; that row-level security
-- lets a person read their own live rows in a tenant they belong to and nothing
-- else; that no client role can write, or call the commit; and that the ledger
-- sweep removes only what can no longer be replayed.
--
-- Every refusal is attempted as the role that should be refused, and every one
-- sits beside the same statement succeeding, so a check that refused everything
-- would fail rather than pass.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh productivity-commands

begin;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

create or replace function pg_temp.become(who uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- The statement's SQLSTATE, or null if it succeeded.
create or replace function pg_temp.state_as(r text, q text)
returns text language plpgsql as $$
begin
  execute 'set local role ' || r;
  execute q;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlstate;
end $$;

insert into public.invites (email, note) values
  ('pc-a@example.invalid', 'rollback-only'), ('pc-b@example.invalid', 'rollback-only');
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000c101', 'pc-a@example.invalid'),
  ('00000000-0000-4000-8000-00000000c102', 'pc-b@example.invalid');
insert into public.schools (id, name, is_demo) values
  ('pc-school-a', 'Productivity Check A', true), ('pc-school-b', 'Productivity Check B', true);
insert into public.institution_membership (tenant_id, auth_user_id, status, roles) values
  ('pc-school-a', '00000000-0000-4000-8000-00000000c101', 'active', array['student']),
  ('pc-school-a', '00000000-0000-4000-8000-00000000c102', 'active', array['student']);

-- What the service hands the commit, in the shape the TypeScript produces.
create or replace function pg_temp.task(id uuid, seq_read bigint, over jsonb default '{}')
returns jsonb language sql as $$
  select jsonb_build_object('type', 'task', 'expectedSeq', seq_read, 'row', jsonb_build_object(
    'id', id, 'title', 'Read chapter 4', 'notes', 'for Thursday', 'status', 'open', 'completedAt', null,
    'dueAt', '2026-10-08T17:00:00.000Z', 'priority', 'high', 'courseId', null,
    'source', jsonb_build_object('kind', 'student_entered'),
    'clocks', jsonb_build_object('title', '1790000000000.0000.dev-a'),
    'version', 1, 'createdAt', '2026-10-05T15:00:00.000Z', 'updatedAt', '2026-10-05T15:00:00.000Z',
    'deletedAt', null, 'deleteClock', null) || over)
$$;

create or replace function pg_temp.cmd(cid uuid, hash text default null)
returns jsonb language sql as $$
  select jsonb_build_object('commandId', cid, 'requestSha256', coalesce(hash, repeat('a', 64)),
    'result', jsonb_build_object('status', 'applied'))
$$;

create or replace function pg_temp.audit(action text, outcome text default 'allowed')
returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object(
    'correlationId', 'req-0123456789abcdef', 'actorId', '00000000-0000-4000-8000-00000000c101', 'actorType', 'user',
    'deviceId', 'dev-a', 'action', action, 'objectKind', 'task', 'objectId', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'outcome', outcome, 'fields', jsonb_build_array('title'), 'commandId', null))
$$;

create or replace function pg_temp.event(eid uuid, type text default 'task.created', key text default null)
returns jsonb language sql as $$
  select jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'eventId', eid, 'eventType', type, 'eventVersion', 1, 'occurredAt', '2026-10-05T15:00:00.000Z',
    'producer', 'productivity-api', 'environment', 'staging', 'correlationId', 'req-0123456789abcdef',
    'idempotencyKey', key, 'dataClassification', 'student_private', 'retentionClass', 'student_record',
    'subject', jsonb_build_object('type', 'task', 'id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    'payload', jsonb_build_object('entityId', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))))
$$;

-- ── Who can reach the commit ───────────────────────────────────────────────

do $$
declare sig text := 'public.productivity_commit(text, uuid, jsonb, jsonb, jsonb, jsonb)';
begin
  perform pg_temp.must('anon cannot call the commit', not has_function_privilege('anon', sig, 'execute'));
  perform pg_temp.must('a signed-in person cannot call the commit', not has_function_privilege('authenticated', sig, 'execute'));
  perform pg_temp.must('the service role can', has_function_privilege('service_role', sig, 'execute'));
  perform pg_temp.must('nobody but the service writes the tables',
    not has_table_privilege('authenticated', 'public.productivity_task', 'insert')
    and not has_table_privilege('authenticated', 'public.productivity_task', 'update')
    and not has_table_privilege('authenticated', 'public.productivity_task', 'delete')
    and not has_table_privilege('authenticated', 'public.productivity_event', 'insert')
    and not has_table_privilege('anon', 'public.productivity_task', 'select')
    and has_table_privilege('authenticated', 'public.productivity_task', 'select'));
  perform pg_temp.must('the ledger and the sequence are not the clients''',
    not has_table_privilege('authenticated', 'private.productivity_command', 'select')
    and not has_table_privilege('authenticated', 'private.productivity_owner_seq', 'select'));
end $$;

-- ── A first commit writes everything, together ─────────────────────────────

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-00000000c101';
  t constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  got jsonb;
begin
  got := public.productivity_commit('pc-school-a', a, pg_temp.cmd('c0000000-0000-4000-8000-000000000001'),
    jsonb_build_array(pg_temp.task(t, 0)), pg_temp.audit('task.created'),
    pg_temp.event('e0000000-0000-4000-8000-000000000001', 'task.created', 'c0000000-0000-4000-8000-000000000001'));
  perform pg_temp.must('the commit reports the sequence it wrote', got = '{"seqs": [1]}'::jsonb);
  perform pg_temp.must('the record is there, at seq 1',
    (select seq from public.productivity_task where tenant_id = 'pc-school-a' and owner_id = a and id = t) = 1);
  perform pg_temp.must('the ledger row is there',
    exists (select 1 from private.productivity_command where tenant_id = 'pc-school-a' and owner_id = a and command_id = 'c0000000-0000-4000-8000-000000000001'));
  perform pg_temp.must('the audit row is there, with a pseudonymous actor and no content',
    exists (select 1 from public.audit_event where tenant_id = 'pc-school-a' and action = 'task.created'
            and actor_sha256 = private.role_audit_sha256(a::text)
            and detail ? 'fields' and not detail::text like '%Read chapter%'));
  perform pg_temp.must('the outbox event is there',
    exists (select 1 from private.domain_outbox_events where tenant_id = 'pc-school-a' and event_type = 'task.created'
            and aggregate_id = t::text and published_at is null));
end $$;

-- ── Idempotency, staleness, and what a failed commit leaves behind ─────────

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-00000000c101';
  t constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  t2 constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  code text;
  audits_before bigint;
  got jsonb;
begin
  -- The same command again: the ledger refuses it, and nothing else is written.
  select count(*) into audits_before from public.audit_event where tenant_id = 'pc-school-a';
  begin
    perform public.productivity_commit('pc-school-a', a, pg_temp.cmd('c0000000-0000-4000-8000-000000000001'),
      jsonb_build_array(pg_temp.task(t, 1, '{"title": "again"}')), pg_temp.audit('task.updated'),
      pg_temp.event('e0000000-0000-4000-8000-000000000002', 'task.updated', 'c0000000-0000-4000-8000-000000000001'));
    code := null;
  exception when others then code := sqlstate; end;
  perform pg_temp.must('a repeated command id is refused as a duplicate (23505)', code = '23505');
  perform pg_temp.must('and wrote nothing else',
    (select count(*) from public.audit_event where tenant_id = 'pc-school-a') = audits_before
    and (select title from public.productivity_task where id = t and owner_id = a) = 'Read chapter 4');

  -- A writer who read the row before somebody else changed it.
  begin
    perform public.productivity_commit('pc-school-a', a, pg_temp.cmd('c0000000-0000-4000-8000-000000000003'),
      jsonb_build_array(pg_temp.task(t, 0, '{"title": "stale"}')), '[]', '[]');
    code := null;
  exception when others then code := sqlstate; end;
  perform pg_temp.must('a stale writer is refused with 40001, to read again', code = '40001');
  perform pg_temp.must('and its ledger row went with it',
    not exists (select 1 from private.productivity_command where command_id = 'c0000000-0000-4000-8000-000000000003'));

  -- The sequence is spent by commits, not by attempts.
  got := public.productivity_commit('pc-school-a', a, pg_temp.cmd('c0000000-0000-4000-8000-000000000004'),
    jsonb_build_array(pg_temp.task(t2, 0), pg_temp.task(t, 1, '{"title": "second edit", "version": 2}')), '[]', '[]');
  perform pg_temp.must('the next commit continues the sequence with no gap, in order', got = '{"seqs": [2, 3]}'::jsonb);
  perform pg_temp.must('and the first record moved to its new position',
    (select seq from public.productivity_task where id = t and owner_id = a) = 3);
  perform pg_temp.must('the owner''s counter agrees',
    (select last_seq from private.productivity_owner_seq where owner_id = a and tenant_id = 'pc-school-a') = 3);
end $$;

-- A commit that fails in its last step must undo its first.
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-00000000c101';
  t3 constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  code text;
begin
  begin
    perform public.productivity_commit('pc-school-a', a, pg_temp.cmd('c0000000-0000-4000-8000-000000000005'),
      jsonb_build_array(pg_temp.task(t3, 0)), pg_temp.audit('task.created'),
      -- an event type the outbox refuses
      pg_temp.event('e0000000-0000-4000-8000-000000000005', 'NOT A TYPE'));
    code := null;
  exception when others then code := sqlstate; end;
  perform pg_temp.must('a commit whose event is refused is refused whole (23514)', code = '23514');
  perform pg_temp.must('the record was not kept', not exists (select 1 from public.productivity_task where id = t3));
  perform pg_temp.must('nor the ledger row', not exists (select 1 from private.productivity_command where command_id = 'c0000000-0000-4000-8000-000000000005'));
  perform pg_temp.must('and the sequence was not spent', (select last_seq from private.productivity_owner_seq where owner_id = a) = 3);
end $$;

-- An audit-only commit: a refused probe at an owner who does not exist.
do $$
declare ghost constant uuid := '00000000-0000-4000-8000-00000000dead';
begin
  perform public.productivity_commit('pc-school-a', ghost, null, '[]', pg_temp.audit('productivity.shared_read', 'denied'), '[]');
  perform pg_temp.must('a refused read of a nonexistent owner is audited, and takes no place in anyone''s history',
    exists (select 1 from public.audit_event where action = 'productivity.shared_read' and outcome = 'denied')
    and not exists (select 1 from private.productivity_owner_seq where owner_id = ghost));
end $$;

-- ── A predicted sequence number is held to, and the read functions are scoped ──

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-00000000c101';
  p1 constant uuid := 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1';
  p2 constant uuid := 'f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2';
  p3 constant uuid := 'f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3';
  last bigint;
  code text;
  got jsonb;
begin
  select (public.productivity_tx_state('pc-school-a', a))->>'lastSeq' into last;
  perform pg_temp.must('the state function reports the owner''s counter', last = (select last_seq from private.productivity_owner_seq where tenant_id = 'pc-school-a' and owner_id = a));

  -- A prediction that no longer holds: another writer moved the counter after it was read.
  begin
    perform public.productivity_commit('pc-school-a', a, null,
      jsonb_build_array(jsonb_set(pg_temp.task(p1, 0), '{seq}', to_jsonb(last))), '[]', '[]');
    code := null;
  exception when others then code := sqlstate; end;
  perform pg_temp.must('a stale prediction is refused with 40001', code = '40001');
  perform pg_temp.must('and nothing of it was kept',
    not exists (select 1 from public.productivity_task where id = p1)
    and (select last_seq from private.productivity_owner_seq where tenant_id = 'pc-school-a' and owner_id = a) = last);

  -- The same commit with the right prediction, for two entities in order.
  got := public.productivity_commit('pc-school-a', a, null,
    jsonb_build_array(jsonb_set(pg_temp.task(p1, 0), '{seq}', to_jsonb(last + 1)), jsonb_set(pg_temp.task(p2, 0), '{seq}', to_jsonb(last + 2))), '[]', '[]');
  perform pg_temp.must('the right prediction is written where it said', got->'seqs' = jsonb_build_array(last + 1, last + 2)
    and (select seq from public.productivity_task where id = p2) = last + 2);

  -- A task that is already a tombstone, for what the reads must hide and the feed must carry.
  perform public.productivity_commit('pc-school-a', a, null,
    jsonb_build_array(jsonb_set(jsonb_set(jsonb_set(pg_temp.task(p3, 0, '{"deletedAt": "2026-10-05T16:00:00.000Z", "deleteClock": "1790000000001.0000.dev-a", "version": 2}'), '{seq}', to_jsonb(last + 3)), '{title}', '"gone"'), '{notes}', 'null')), '[]', '[]');

  -- And the read functions return the entity the service holds, scoped to the tenant and the owner.
  perform pg_temp.must('get returns the task in the service''s shape',
    (public.productivity_get('pc-school-a', a, 'task', p1)) ?& array['id','tenantId','ownerId','version','seq','source','clocks','createdAt','updatedAt','deletedAt','deleteClock','title','notes','status','completedAt','dueAt','priority','courseId']
    and (public.productivity_get('pc-school-a', a, 'task', p1))->>'createdAt' = '2026-10-05T15:00:00.000Z');
  perform pg_temp.must('get is scoped: not the other tenant''s, not the other owner''s',
    public.productivity_get('pc-school-b', a, 'task', p1) is null
    and public.productivity_get('pc-school-a', '00000000-0000-4000-8000-00000000c102', 'task', p1) is null);
  perform pg_temp.must('a tombstone is hidden unless asked for',
    public.productivity_get('pc-school-a', a, 'task', p3) is null
    and public.productivity_get('pc-school-a', a, 'task', p3, true) is not null);
  perform pg_temp.must('the feed carries the tombstone, in sequence order, for this owner only',
    (select bool_and(s.v > coalesce(lag, 0)) from (select (j->>'seq')::bigint v, lag((j->>'seq')::bigint) over (order by (j->>'seq')::bigint) lag
       from jsonb_array_elements(public.productivity_changes('pc-school-a', a, 0, 100)) j) s)
    and exists (select 1 from jsonb_array_elements(public.productivity_changes('pc-school-a', a, 0, 100)) j where j->>'deletedAt' is not null)
    and jsonb_array_length(public.productivity_changes('pc-school-a', '00000000-0000-4000-8000-00000000c102', 0, 100)) = 0);
  perform pg_temp.must('a task list is ordered by due date, undated last, and cut at the limit',
    jsonb_array_length(public.productivity_list_tasks('pc-school-a', a, null, null, null, null, null, 2)) = 2);
  perform pg_temp.must('and the cursor continues after the row it names',
    (select j->>'id' from jsonb_array_elements(public.productivity_list_tasks('pc-school-a', a, null, null, null, '2026-10-08T17:00:00.000Z', p1, 50)) j limit 1) is distinct from p1::text);
end $$;

do $$
declare
  fns text[] := array[
    'public.productivity_tx_state(text, uuid, uuid)', 'public.productivity_get(text, uuid, text, uuid, boolean)',
    'public.productivity_list_tasks(text, uuid, text, timestamptz, timestamptz, text, uuid, integer)',
    'public.productivity_list_events(text, uuid, timestamptz, timestamptz, text, uuid, integer)',
    'public.productivity_changes(text, uuid, bigint, integer)', 'public.productivity_outbox_stats()'];
  f text;
begin
  foreach f in array fns loop
    perform pg_temp.must(f || ' is the service role''s alone',
      has_function_privilege('service_role', f, 'execute')
      and not has_function_privilege('authenticated', f, 'execute')
      and not has_function_privilege('anon', f, 'execute'));
  end loop;
  -- Another producer's pending event: in the shared outbox, but not this service's to count.
  insert into private.domain_outbox_events (aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id, producer, correlation_id, payload, data_classification, retention_class)
  values ('x', 'y', 'task.created', 1, 'staging', 'pc-school-a', 'somebody-else', 'req-0123456789abcdef', '{}', 'internal', 'operational');
  perform pg_temp.must('the outbox stats leave out another producer''s events',
    (public.productivity_outbox_stats()->>'pending')::int
      < (select count(*) from private.domain_outbox_events where published_at is null and dead_lettered_at is null));
  perform pg_temp.must('the outbox stats count only this producer''s events',
    (public.productivity_outbox_stats()->>'pending')::int = (select count(*) from private.domain_outbox_events where producer = 'productivity-api' and published_at is null and dead_lettered_at is null));
end $$;

-- ── The table's own constraints, as the last wall ──────────────────────────

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-00000000c101';
  n int := 0;
  e uuid;
  bad jsonb;
  code text;
begin
  for bad in select * from jsonb_array_elements(jsonb_build_array(
    '{"title": ""}'::jsonb, '{"status": "archived"}'::jsonb, '{"priority": "urgent"}'::jsonb,
    '{"status": "done"}'::jsonb,                                   -- done with no completion time
    '{"deletedAt": "2026-10-05T16:00:00.000Z"}'::jsonb,            -- a tombstone with no clock
    '{"source": {"kind": "student_entered", "ref": "feed:x"}}'::jsonb,
    '{"source": {"kind": "from_the_moon"}}'::jsonb
  )) loop
    n := n + 1;
    e := ('bbbbbbbb-bbbb-4bbb-8bbb-' || lpad(n::text, 12, '0'))::uuid;
    begin
      perform public.productivity_commit('pc-school-a', a, null, jsonb_build_array(pg_temp.task(e, 0, bad)), '[]', '[]');
      code := null;
    exception when others then code := sqlstate; end;
    perform pg_temp.must('the table refuses ' || bad::text, code = '23514');
  end loop;
  perform pg_temp.must('and still takes an ordinary one',
    (public.productivity_commit('pc-school-a', a, null, jsonb_build_array(pg_temp.task('bbbbbbbb-bbbb-4bbb-8bbb-0000000000ff', 0)), '[]', '[]')) ? 'seqs');

  begin
    perform public.productivity_commit('pc-school-a', a, null, jsonb_build_array(jsonb_build_object(
      'type', 'calendar_event', 'expectedSeq', 0, 'row', jsonb_build_object(
        'id', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'title', 'Backwards', 'startsAt', '2026-10-06T20:00:00.000Z',
        'endsAt', '2026-10-06T19:00:00.000Z', 'allDay', false, 'timezone', 'America/Chicago', 'kind', 'event',
        'source', jsonb_build_object('kind', 'student_entered'), 'clocks', '{}'::jsonb, 'version', 1,
        'createdAt', '2026-10-05T15:00:00.000Z', 'updatedAt', '2026-10-05T15:00:00.000Z', 'deletedAt', null, 'deleteClock', null))), '[]', '[]');
    code := null;
  exception when others then code := sqlstate; end;
  perform pg_temp.must('an event that ends before it starts is refused', code = '23514');
end $$;

-- ── Row-level security: your own live rows, in a tenant you belong to ──────

-- Alice: a task and an event in school A, a tombstoned task, and a task in
-- school B where she has no membership. Bob: one task of his own in school A.
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-00000000c101';
  b constant uuid := '00000000-0000-4000-8000-00000000c102';
begin
  perform public.productivity_commit('pc-school-a', a, null, jsonb_build_array(
    jsonb_build_object('type', 'calendar_event', 'expectedSeq', 0, 'row', jsonb_build_object(
      'id', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'title', 'Office hours', 'startsAt', '2026-10-06T19:00:00.000Z',
      'endsAt', '2026-10-06T20:00:00.000Z', 'allDay', false, 'timezone', 'America/Chicago', 'kind', 'event',
      'source', jsonb_build_object('kind', 'student_entered'), 'clocks', '{}'::jsonb, 'version', 1,
      'createdAt', '2026-10-05T15:00:00.000Z', 'updatedAt', '2026-10-05T15:00:00.000Z', 'deletedAt', null, 'deleteClock', null)),
    pg_temp.task('ffffffff-ffff-4fff-8fff-ffffffffffff', 0, '{"title": "to be deleted"}')), '[]', '[]');
  perform public.productivity_commit('pc-school-a', a, null, jsonb_build_array(
    pg_temp.task('ffffffff-ffff-4fff-8fff-ffffffffffff', (select seq from public.productivity_task where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
      '{"version": 2, "deletedAt": "2026-10-05T16:00:00.000Z", "deleteClock": "1790000000001.0000.dev-a"}')), '[]', '[]');
  -- An event that is already a tombstone: it must not be readable either.
  perform public.productivity_commit('pc-school-a', a, null, jsonb_build_array(
    jsonb_build_object('type', 'calendar_event', 'expectedSeq', 0, 'row', jsonb_build_object(
      'id', 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1', 'title', 'Cancelled', 'startsAt', '2026-10-07T19:00:00.000Z',
      'endsAt', '2026-10-07T20:00:00.000Z', 'allDay', false, 'timezone', 'America/Chicago', 'kind', 'event',
      'source', jsonb_build_object('kind', 'student_entered'), 'clocks', '{}'::jsonb, 'version', 2,
      'createdAt', '2026-10-05T15:00:00.000Z', 'updatedAt', '2026-10-05T16:00:00.000Z',
      'deletedAt', '2026-10-05T16:00:00.000Z', 'deleteClock', '1790000000001.0000.dev-a'))), '[]', '[]');
  perform public.productivity_commit('pc-school-b', a, null, jsonb_build_array(pg_temp.task('abababab-abab-4bab-8bab-abababababab', 0, '{"title": "in a school she left"}')), '[]', '[]');
  perform public.productivity_commit('pc-school-a', b, null, jsonb_build_array(pg_temp.task('babababa-baba-4aba-8aba-babababababa', 0, '{"title": "bobs task"}')), '[]', '[]');
end $$;

select pg_temp.become('00000000-0000-4000-8000-00000000c101');
do $$
declare titles text;
begin
  -- School A holds five live tasks of hers (the first, the second, the two from the
  -- prediction block and the ordinary one from the constraint block); two more are
  -- tombstones; one is in school B, where she has no membership.
  select string_agg(title, '|' order by title) into titles from public.productivity_task;
  perform pg_temp.must('Alice sees exactly her five live tasks in the tenant she belongs to',
    titles = 'Read chapter 4|Read chapter 4|Read chapter 4|Read chapter 4|second edit');
  perform pg_temp.must('Alice does not see the tombstone', not exists (select 1 from public.productivity_task where title = 'to be deleted'));
  perform pg_temp.must('Alice does not see the task in a school she has no membership in', not exists (select 1 from public.productivity_task where tenant_id = 'pc-school-b'));
  perform pg_temp.must('Alice does not see the other person''s task', not exists (select 1 from public.productivity_task where title = 'bobs task'));
  perform pg_temp.must('Alice sees her live event and not the cancelled one', (select count(*) from public.productivity_event) = 1
    and not exists (select 1 from public.productivity_event where title = 'Cancelled'));
end $$;
reset role;

select pg_temp.become('00000000-0000-4000-8000-00000000c102');
do $$
begin
  perform pg_temp.must('Bob sees his own and none of Alice''s',
    (select count(*) from public.productivity_task) = 1 and (select count(*) from public.productivity_event) = 0
    and (select title from public.productivity_task) = 'bobs task');
end $$;
reset role;

-- Nobody writes through the client roles; the attempt and the control are the same statement.
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-00000000c101';
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', a::text, 'role', 'authenticated')::text, true);
  perform pg_temp.must('a signed-in person cannot insert a task',
    pg_temp.state_as('authenticated', 'insert into public.productivity_task (tenant_id, owner_id, id, title, seq) values (''pc-school-a'', ''' || a || ''', gen_random_uuid(), ''x'', 1)') = '42501');
  perform pg_temp.must('cannot update one of their own',
    pg_temp.state_as('authenticated', 'update public.productivity_task set title = ''x''') = '42501');
  perform pg_temp.must('cannot delete one of their own',
    pg_temp.state_as('authenticated', 'delete from public.productivity_task') = '42501');
  perform pg_temp.must('and cannot read the ledger', pg_temp.state_as('authenticated', 'select * from private.productivity_command') in ('42501', '3F000'));
  perform pg_temp.must('the control: the service role can read the same table', pg_temp.state_as('service_role', 'select count(*) from public.productivity_task') is null);
  perform pg_temp.must('and anon cannot read it', pg_temp.state_as('anon', 'select count(*) from public.productivity_task') = '42501');
end $$;

-- A membership that ends takes the direct read with it.
update public.institution_membership set status = 'suspended'
  where tenant_id = 'pc-school-a' and auth_user_id = '00000000-0000-4000-8000-00000000c101';
select pg_temp.become('00000000-0000-4000-8000-00000000c101');
do $$
begin
  perform pg_temp.must('a person whose membership ended reads nothing of it',
    (select count(*) from public.productivity_task) = 0 and (select count(*) from public.productivity_event) = 0);
end $$;
reset role;

-- ── The ledger sweep removes only what can no longer be replayed ───────────

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-00000000c101';
  removed bigint;
begin
  update private.productivity_command set stored_at = now() - interval '36 days'
    where command_id = 'c0000000-0000-4000-8000-000000000001';
  update private.productivity_command set stored_at = now() - interval '34 days'
    where command_id = 'c0000000-0000-4000-8000-000000000004';
  removed := private.productivity_sweep_commands();
  perform pg_temp.must('the sweep removed the one past 35 days', removed = 1
    and not exists (select 1 from private.productivity_command where command_id = 'c0000000-0000-4000-8000-000000000001'));
  perform pg_temp.must('and kept the one at 34', exists (select 1 from private.productivity_command where command_id = 'c0000000-0000-4000-8000-000000000004'));
  perform pg_temp.must('and left the evidence alone',
    exists (select 1 from public.audit_event where action = 'task.created' and tenant_id = 'pc-school-a')
    and exists (select 1 from private.domain_outbox_events where tenant_id = 'pc-school-a' and event_type = 'task.created'));
  perform pg_temp.must('the sweep is not the clients''', not has_function_privilege('authenticated', 'private.productivity_sweep_commands()', 'execute'));
end $$;

-- ── An account with these rows is not untouched, is exported, and is erased ──

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-00000000c101';
  nobody constant uuid := '00000000-0000-4000-8000-00000000beef';
begin
  perform pg_temp.must('an account holding tasks and events is not untouched', not public.lti_account_untouched(a));
  perform pg_temp.must('the control: an account holding nothing is', public.lti_account_untouched(nobody));
end $$;

select pg_temp.become('00000000-0000-4000-8000-00000000c101');
do $$
declare dump jsonb;
begin
  dump := public.export_my_data();
  perform pg_temp.must('the export carries the productivity tables',
    dump::text like '%productivity_task%' and dump::text like '%productivity_event%');
end $$;
reset role;

do $$
declare a constant uuid := '00000000-0000-4000-8000-00000000c101';
begin
  perform public.erase_account(a);
  perform pg_temp.must('erasing the account removes its tasks, events, counter and ledger',
    not exists (select 1 from public.productivity_task where owner_id = a)
    and not exists (select 1 from public.productivity_event where owner_id = a)
    and not exists (select 1 from private.productivity_owner_seq where owner_id = a)
    and not exists (select 1 from private.productivity_command where owner_id = a));
end $$;

rollback;
