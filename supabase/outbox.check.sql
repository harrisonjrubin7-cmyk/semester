-- The transactional outbox and the consumer receipts: service-role only, and
-- the constraints that make a mislabelled or a duplicated event fail in the
-- transaction that tried to write it.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
-- How to run it: supabase/check.sh outbox

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
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

/** Whether a statement, run as the signed-in account, is refused. */
create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

/** Whether a statement, run as the owner, is refused by a constraint. */
create or replace function pg_temp.constrained(statement text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when check_violation or unique_violation or not_null_violation or foreign_key_violation then
  return true;
end $$;

insert into public.schools (id, name, email_domains) values
  ('outbox-a', 'Outbox A', array['a.example']);

do $$
declare
  student uuid;
  good text := $q$
    insert into private.domain_outbox_events
      (aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id, producer,
       correlation_id, idempotency_key, payload, data_classification, retention_class)
    values ('grade_line_item', 'li-4', 'grade.posted', 1, 'production', 'outbox-a', 'gradebook',
            'req-0123456789abcdef', %L, '{"lineItemId":"li-4"}', 'education_record', 'student_record')
  $q$;
  pending integer;
  parked integer;
begin
  student := pg_temp.newuser('student@a.example', 'outbox-a');

  -- ── The control: the owner can write a well-formed event ────────────────
  execute format(good, 'li-4:v1');
  select count(*) into pending from private.domain_outbox_events where published_at is null and dead_lettered_at is null;
  if pending <> 1 then raise exception 'FAILED: control — a well-formed event was not stored (%)', pending; end if;
  raise notice 'ok  a well-formed event is stored and pending';

  -- ── Nobody signed in can see or write it ────────────────────────────────
  if not pg_temp.refused(student, 'select * from private.domain_outbox_events') then
    raise exception 'FAILED: a signed-in account read the outbox';
  end if;
  if not pg_temp.refused(student, format(good, 'li-4:v2')) then
    raise exception 'FAILED: a signed-in account wrote to the outbox';
  end if;
  if not pg_temp.refused(student, 'select * from private.domain_event_receipts') then
    raise exception 'FAILED: a signed-in account read the receipts';
  end if;
  if not pg_temp.refused(student, $r$insert into private.domain_event_receipts (consumer, event_id, outcome) values ('x', gen_random_uuid(), 'processed')$r$) then
    raise exception 'FAILED: a signed-in account wrote a receipt';
  end if;
  raise notice 'ok  the outbox and the receipts are not reachable by a signed-in account';

  -- ── The same event twice, by its idempotency key, is one event ──────────
  if not pg_temp.constrained(format(good, 'li-4:v1')) then
    raise exception 'FAILED: the same idempotency key was stored twice for one aggregate';
  end if;
  execute format(good, 'li-4:v2');
  raise notice 'ok  an idempotency key is unique per aggregate';

  -- ── A mislabelled event does not get in ─────────────────────────────────
  if not pg_temp.constrained(replace(format(good, 'k-1'), '''grade.posted''', '''GradePosted''')) then
    raise exception 'FAILED: an event type that is not domain.name was stored';
  end if;
  if not pg_temp.constrained(replace(format(good, 'k-2'), '''education_record'', ''student_record''', '''secret'', ''student_record''')) then
    raise exception 'FAILED: an unknown classification was stored';
  end if;
  if not pg_temp.constrained(replace(format(good, 'k-3'), '''student_record'')', '''forever'')')) then
    raise exception 'FAILED: an unknown retention class was stored';
  end if;
  if not pg_temp.constrained(replace(format(good, 'k-4'), '''req-0123456789abcdef''', '''short''')) then
    raise exception 'FAILED: a malformed correlation id was stored';
  end if;
  if not pg_temp.constrained(replace(format(good, 'k-5'), '''{"lineItemId":"li-4"}''', '''[1,2]''')) then
    raise exception 'FAILED: a payload that is not an object was stored';
  end if;
  if not pg_temp.constrained(replace(format(good, 'k-6'), '''outbox-a''', '''no-such-school''')) then
    raise exception 'FAILED: an event for a school that does not exist was stored';
  end if;
  raise notice 'ok  six mislabelled events were refused';

  -- ── One outcome: published or parked, never both ────────────────────────
  if not pg_temp.constrained($u$update private.domain_outbox_events set published_at = now(), dead_lettered_at = now() where idempotency_key = 'li-4:v1'$u$) then
    raise exception 'FAILED: an event was both published and dead-lettered';
  end if;
  update private.domain_outbox_events set dead_lettered_at = now(), last_error = 'bus refused', publish_attempts = 5 where idempotency_key = 'li-4:v1';
  update private.domain_outbox_events set published_at = now() where idempotency_key = 'li-4:v2';
  select count(*) into pending from private.domain_outbox_events where published_at is null and dead_lettered_at is null;
  select count(*) into parked from private.domain_outbox_events where dead_lettered_at is not null;
  if pending <> 0 or parked <> 1 then raise exception 'FAILED: after publishing one and parking one, % pending and % parked', pending, parked; end if;
  if not pg_temp.constrained($u$update private.domain_outbox_events set last_error = repeat('x', 501) where idempotency_key = 'li-4:v1'$u$) then
    raise exception 'FAILED: an unbounded error text was stored';
  end if;
  raise notice 'ok  an event is published or parked, and a parked one is not pending';

  -- ── A consumer's second receipt for one event is refused ────────────────
  insert into private.domain_event_receipts (consumer, event_id, outcome)
    select 'notifications', id, 'processed' from private.domain_outbox_events where idempotency_key = 'li-4:v2';
  if not pg_temp.constrained($r$insert into private.domain_event_receipts (consumer, event_id, outcome)
    select 'notifications', id, 'processed' from private.domain_outbox_events where idempotency_key = 'li-4:v2'$r$) then
    raise exception 'FAILED: one consumer recorded the same event twice';
  end if;
  insert into private.domain_event_receipts (consumer, event_id, outcome)
    select 'analytics', id, 'skipped' from private.domain_outbox_events where idempotency_key = 'li-4:v2';
  if not pg_temp.constrained($r$insert into private.domain_event_receipts (consumer, event_id, outcome) values ('x', gen_random_uuid(), 'maybe')$r$) then
    raise exception 'FAILED: an outcome that is not one of the three was stored';
  end if;
  raise notice 'ok  a receipt is one per consumer per event';

  -- The control for `constrained`: a statement that should pass does.
  if pg_temp.constrained($r$insert into private.domain_event_receipts (consumer, event_id, outcome) values ('passback', gen_random_uuid(), 'failed')$r$) then
    raise exception 'FAILED: control — the constraint probe refused a valid row';
  end if;
  raise notice 'ok  control: the constraint probe passes a valid row';
end $$;

rollback;
