-- supabase/outbox_publisher_store.check.sql — for 20261014010000_outbox_publisher_store.sql.
-- Runs as the superuser the harness connects as, then as anon/authenticated to prove they're refused.
-- Everything rolls back.   How to run it: supabase/check.sh outbox_publisher_store
--
-- Holds the store to:
--   * a claim returns pending rows oldest first, as an envelope drainOutbox can validate;
--   * a claimed row isn't offered to a second claim until its lease runs out;
--   * marks only land with the claim that holds the row; a stale claim changes nothing;
--   * failed releases the lease and counts; dead-lettered parks the row for good; published is final;
--   * nobody but the service role can call any of it.

begin;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused_as(what text, who text, statement text)
returns void language plpgsql as $$
begin
  execute format('set local role %I', who);
  begin
    execute statement;
    execute 'reset role';
    raise exception 'FAILED: % — was allowed', what;
  exception when insufficient_privilege then
    execute 'reset role';
    raise notice 'ok  % is refused for %', what, who;
  end;
end $$;

do $$
declare
  e1 uuid; e2 uuid; e3 uuid; c1 uuid; c2 uuid; n bigint; env jsonb; ok boolean;
begin
  insert into public.schools (id, name, email_domains) values ('ob-u', 'Outbox University', array['ob-u.example']);
  -- Only this check's rows are in play: park anything already pending so counts are exact.
  update private.domain_outbox_events set dead_lettered_at = now(), last_error = 'parked by outbox check'
   where published_at is null and dead_lettered_at is null;

  e1 := private.emit_domain_event('task', 't-1', 'task.created', 1, 'ob-u', 'outbox-check', 'corr-ob-0001', 'k-1',
          '{"taskId":"t-1","fields":["title"]}', 'student_private', 'student_record');
  e2 := private.emit_domain_event('task', 't-2', 'task.updated', 1, 'ob-u', 'outbox-check', 'corr-ob-0002', 'k-2',
          '{"taskId":"t-2","fields":["due"]}', 'student_private', 'student_record');
  e3 := private.emit_domain_event('task', 't-3', 'task.completed', 1, 'ob-u', 'outbox-check', 'corr-ob-0003', 'k-3',
          '{"taskId":"t-3"}', 'student_private', 'student_record');
  update private.domain_outbox_events set occurred_at = now() - interval '3 minutes' where id = e1;
  update private.domain_outbox_events set occurred_at = now() - interval '2 minutes' where id = e2;
  update private.domain_outbox_events set occurred_at = now() - interval '1 minute' where id = e3;

  -- ── Claim ──
  select count(*), min(c.claim_id::text)::uuid into n, c1 from private.outbox_claim(2) c;
  perform pg_temp.counted('the first claim takes a batch of two', n, 2);
  perform pg_temp.counted('the two oldest',
    (select count(*) from private.domain_outbox_events where id in (e1, e2) and claim_id = c1), 2);
  select c.envelope into env from private.outbox_claim(1) c;  -- e3, the only one left
  perform pg_temp.said('the envelope carries the event id drainOutbox validates', env->>'eventId', e3::text);
  perform pg_temp.said('and the catalog version', env->>'eventVersion', '1');
  perform pg_temp.said('and the subject, from the aggregate', env->'subject'->>'id', 't-3');
  perform pg_temp.counted('a third claim finds nothing while the leases hold',
    (select count(*) from private.outbox_claim(10)), 0);

  -- ── A lease that ran out ──
  update private.domain_outbox_events set claimed_until = now() - interval '1 second' where id = e2;
  select c.claim_id into c2 from private.outbox_claim(10) c;
  perform pg_temp.counted('an expired lease is claimable again, by a new claim',
    (select count(*) from private.domain_outbox_events where id = e2 and claim_id = c2 and c2 <> c1), 1);
  perform pg_temp.counted('the first publisher''s late mark on that row changes nothing',
    private.outbox_mark_published(e2, c1)::int, 0);
  perform pg_temp.counted('and it is still pending',
    (select count(*) from private.domain_outbox_events where id = e2 and published_at is null), 1);

  -- ── Marks ──
  perform pg_temp.counted('published with the right claim', private.outbox_mark_published(e1, c1)::int, 1);
  perform pg_temp.counted('publishing it again does nothing', private.outbox_mark_published(e1, c1)::int, 0);
  perform pg_temp.counted('and the lease is cleared',
    (select count(*) from private.domain_outbox_events where id = e1 and claim_id is null and claimed_until is null and published_at is not null), 1);

  perform pg_temp.counted('a failed send is recorded', private.outbox_mark_failed(e2, c2, 'provider 503')::int, 1);
  perform pg_temp.counted('counted once, lease released, still pending',
    (select count(*) from private.domain_outbox_events where id = e2 and publish_attempts = 1 and claim_id is null and published_at is null and dead_lettered_at is null), 1);
  perform pg_temp.counted('so it comes straight back in the next claim',
    (select count(*) from private.outbox_claim(10) c where c.id = e2), 1);

  select claim_id into c2 from private.domain_outbox_events where id = e2;
  perform pg_temp.counted('dead-lettered after the last attempt', private.outbox_mark_dead_lettered(e2, c2, repeat('x', 600))::int, 1);
  perform pg_temp.counted('parked: never offered again',
    (select count(*) from private.outbox_claim(10) c where c.id = e2), 0);
  perform pg_temp.counted('and can''t then be marked published',
    private.outbox_mark_published(e2, c2)::int, 0);
  perform pg_temp.counted('the one-outcome constraint still holds on every row',
    (select count(*) from private.domain_outbox_events where published_at is not null and dead_lettered_at is not null), 0);
  perform pg_temp.said('a long error is bounded at 500 characters',
    (select length(last_error)::text from private.domain_outbox_events where id = e2), '500');

  -- ── Bad arguments ──
  begin perform private.outbox_claim(0); raise exception 'FAILED: a zero batch was accepted';
  exception when invalid_parameter_value then raise notice 'ok  a zero batch is refused'; end;
  begin perform private.outbox_claim(10, interval '1 second'); raise exception 'FAILED: a one-second lease was accepted';
  exception when invalid_parameter_value then raise notice 'ok  a lease under ten seconds is refused'; end;
  begin perform public.outbox_mark(e3, gen_random_uuid(), 'sent'); raise exception 'FAILED: an unknown outcome was accepted';
  exception when invalid_parameter_value then raise notice 'ok  an unknown outcome is refused'; end;
end $$;

-- ── Only the service role ──
select pg_temp.refused_as('claiming outbox rows', 'authenticated', 'select * from public.outbox_claim(1)');
select pg_temp.refused_as('claiming outbox rows', 'anon', 'select * from public.outbox_claim(1)');
select pg_temp.refused_as('marking a row published', 'authenticated',
  'select public.outbox_mark(gen_random_uuid(), gen_random_uuid(), ''published'')');
select pg_temp.refused_as('the private claim directly', 'authenticated', 'select * from private.outbox_claim(1)');

rollback;
