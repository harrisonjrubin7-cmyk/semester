\set ON_ERROR_STOP on
begin;
insert into public.schools(id,name) values ('zz-held','Held School'),('zz-open','Open School');
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000c1');
do $$ declare a int; b int; begin
  a := private.ensure_month_partitions('private.audit_event_p', 2);
  b := private.ensure_month_partitions('private.audit_event_p', 2);
  if a <> 3 or b <> 0 then raise exception 'FAIL ensure: first %, second % (want 3, 0)', a, b; end if;
end $$;
create table private.audit_event_p_old_a partition of private.audit_event_p for values from ('2024-01-01') to ('2024-02-01');
create table private.audit_event_p_old_b partition of private.audit_event_p for values from ('2024-02-01') to ('2024-03-01');
insert into private.audit_event_p(occurred_at, tenant_id, action, object_kind, outcome, actor_kind) values
  ('2024-01-10','zz-open','a','k','allowed','service'),
  ('2024-02-10','zz-held','a','k','allowed','service'),
  (now(),'zz-open','a','k','allowed','service');
insert into public.legal_holds(subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('tenant','zz-held','zz-held','proposal test','ZZ-3','00000000-0000-0000-0000-0000000000c1');
create or replace function pg_temp.plan_of(q text) returns text language plpgsql as $$
declare r text; acc text := '';
begin for r in execute 'explain (costs off) ' || q loop acc := acc || r || E'\n'; end loop; return acc; end $$;
select pg_temp.plan_of($q$select * from private.audit_event_p where occurred_at >= '2024-01-01' and occurred_at < '2024-02-01'$q$) as pruned \gset
select pg_temp.plan_of($q$select * from private.audit_event_p where action = 'a'$q$) as unpruned \gset
create temp table plans(k text, v text);
insert into plans values ('pruned', :'pruned'), ('unpruned', :'unpruned');
do $$ declare p int; u int; begin
  select count(*) into p from regexp_matches((select v from plans where k='pruned'), 'audit_event_p_', 'g');
  select count(*) into u from regexp_matches((select v from plans where k='unpruned'), 'audit_event_p_', 'g');
  if p <> 1 then raise exception 'FAIL pruned query scanned % partitions (want 1): %', p, (select v from plans where k='pruned'); end if;
  if u < 4 then raise exception 'FAIL control: unbounded query scanned only % partitions', u; end if;
end $$;
-- detach: A goes (only zz-open inside); B stays (a held tenant inside); current month never offered
create temp table det as select * from private.detach_old_partitions('private.audit_event_p', interval '365 days');
do $$ begin
  if (select count(*) from det) <> 2 then raise exception 'FAIL detach considered % partitions, want 2', (select count(*) from det); end if;
  if (select held from det where partition_name like '%old_a') then raise exception 'FAIL A reported held'; end if;
  if not (select held from det where partition_name like '%old_b') then raise exception 'FAIL B not reported held'; end if;
  if (select count(*) from private.audit_event_p where occurred_at < '2025-01-01') <> 1 then raise exception 'FAIL after detach parent holds wrong old rows'; end if;
  if (select count(*) from private.audit_event_p_old_a) <> 1 then raise exception 'FAIL detached partition lost its row'; end if;
end $$;
rollback;
\echo 08 OK
