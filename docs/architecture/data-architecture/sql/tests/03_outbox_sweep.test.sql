\set ON_ERROR_STOP on
begin;
insert into public.schools(id,name) values ('zz-open','Open'),('zz-held','Held');
-- Hold on zz-held. legal_holds needs two distinct people to release; placing needs one actor.
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.legal_holds(subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('tenant','zz-held','zz-held','proposal test hold','ZZ-1','00000000-0000-0000-0000-0000000000a1');

create or replace function pg_temp.ev(_n text, _tenant text, _class text, _pub interval, _dead interval, _payload jsonb default '{"x":1}')
returns void language sql as $f$
  insert into private.domain_outbox_events(id,aggregate_type,aggregate_id,event_type,event_version,environment,tenant_id,producer,
     correlation_id,payload,data_classification,retention_class,occurred_at,published_at,dead_lettered_at)
  values (gen_random_uuid(),'t',_n,'zz.probe',1,'staging',_tenant,'test','corr-'||lpad(_n,8,'0'),_payload,'student_private',_class,
          now() - interval '400 days', case when _pub is null then null else now() - _pub end, case when _dead is null then null else now() - _dead end);
$f$;
select pg_temp.ev('a','zz-open','operational','40 days',null);       -- a: scrub, keep
select pg_temp.ev('b','zz-open','operational','100 days',null);      -- b: expire
select pg_temp.ev('c','zz-held','operational','100 days',null);      -- c: held, untouched
select pg_temp.ev('d','zz-open','operational',null,null);            -- d: pending, untouched
select pg_temp.ev('e','zz-open','operational',null,'100 days');      -- e: parked, scrub payload, keep row
select pg_temp.ev('f','zz-open','audit','100 days',null);            -- f: audit class, kept (3y)
select pg_temp.ev('g','zz-open','operational','5 days',null);        -- g: fresh, untouched
insert into private.domain_event_receipts(consumer,event_id,outcome)
  select 'probe', id, 'processed' from private.domain_outbox_events where aggregate_id in ('b','a');

select private.sweep_outbox() as result \gset
\echo :result
do $$ declare r record; ok boolean := true; n int; begin
  for r in select aggregate_id a, payload <> '{}'::jsonb has_payload, true as present from private.domain_outbox_events where event_type='zz.probe' loop null; end loop;
  -- a scrubbed, present
  if (select payload from private.domain_outbox_events where aggregate_id='a') <> '{}' then raise exception 'FAIL a not scrubbed'; end if;
  -- b gone, with its receipt
  if exists (select 1 from private.domain_outbox_events where aggregate_id='b') then raise exception 'FAIL b not expired'; end if;
  select count(*) into n from private.domain_event_receipts where consumer='probe';
  if n <> 1 then raise exception 'FAIL receipts left=% (want 1: only a)', n; end if;
  -- c held: payload intact, row present
  if (select payload from private.domain_outbox_events where aggregate_id='c') = '{}' then raise exception 'FAIL c (held tenant) was scrubbed'; end if;
  -- d pending and g fresh intact
  if (select payload from private.domain_outbox_events where aggregate_id='d') = '{}' then raise exception 'FAIL d pending was scrubbed'; end if;
  if (select payload from private.domain_outbox_events where aggregate_id='g') = '{}' then raise exception 'FAIL g fresh was scrubbed'; end if;
  -- e parked: scrubbed but present
  if (select payload from private.domain_outbox_events where aggregate_id='e') <> '{}' then raise exception 'FAIL e parked payload kept'; end if;
  -- f audit: scrubbed (>30d) but present (3y class)
  if not exists (select 1 from private.domain_outbox_events where aggregate_id='f') then raise exception 'FAIL f audit envelope expired early'; end if;
end $$;

-- platform hold stops everything
insert into public.legal_holds(subject_kind, subject_id, reason, matter_ref, placed_by)
  values ('platform','','proposal test platform hold','ZZ-2','00000000-0000-0000-0000-0000000000a1');
do $$ begin
  if private.sweep_outbox() ->> 'skipped' is distinct from 'legal_hold' then raise exception 'FAIL platform hold did not stop the sweep'; end if;
end $$;
rollback;
\echo 03 OK
