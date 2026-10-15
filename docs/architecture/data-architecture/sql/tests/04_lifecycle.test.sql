\set ON_ERROR_STOP on
begin;
insert into public.schools(id,name) values ('zz-m1','M1'),('zz-m2','M2');
insert into public.audit_event(tenant_id, action, object_kind, outcome, actor_kind, detail)
  values ('zz-m1','probe.write','probe','allowed','service','{}');
do $$ declare n bigint; begin
  -- control for the loop: the manifest lists every table the catalog says carries tenant_id
  select count(*) into n from private.tenant_data_manifest('zz-m1');
  if n <> (select count(*) from pg_class c join pg_namespace s on s.oid=c.relnamespace
            join pg_attribute a on a.attrelid=c.oid and a.attname='tenant_id' and not a.attisdropped
           where s.nspname in ('public','private') and c.relkind in ('r','p') and not c.relispartition)
  then raise exception 'FAIL manifest table count % differs from catalog', n; end if;
  if (select row_count from private.tenant_data_manifest('zz-m1') where table_name='audit_event') <> 1
  then raise exception 'FAIL zz-m1 audit_event count'; end if;
  if (select row_count from private.tenant_data_manifest('zz-m2') where table_name='audit_event') <> 0
  then raise exception 'FAIL zz-m2 audit_event count (tenant leak)'; end if;
end $$;
rollback;

begin;
-- restore window
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-0000000000b2');
insert into public.activity(user_id, day, mark) values
 ('00000000-0000-0000-0000-0000000000b1', '2026-10-01', 'opened'),     -- inside window
 ('00000000-0000-0000-0000-0000000000b2', '2026-09-20', 'opened');     -- before window
do $$ declare n int; begin
  select count(*) into n from private.accounts_to_notify_after_restore('2026-09-30 00:00+00','2026-10-02 12:00+00');
  if n <> 1 then raise exception 'FAIL window returned % accounts, want 1', n; end if;
  begin
    insert into private.restore_event(kind,environment,restore_point,restored_at,accounts_notified_at)
      values ('pitr','production','2026-10-01','2026-10-02', now());
    raise exception 'FAIL production restore closed before sweeps ran';
  exception when check_violation then null; end;
  insert into private.restore_event(kind,environment,restore_point,restored_at,sweeps_run_at,accounts_notified_at)
    values ('pitr','production','2026-10-01','2026-10-02', now(), now());   -- control: passes
end $$;
rollback;
\echo 04 OK
