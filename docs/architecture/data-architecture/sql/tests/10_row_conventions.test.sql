\set ON_ERROR_STOP on
begin;
insert into public.schools(id,name) values ('zz-a','School A'),('zz-b','School B');
-- a legacy table with rows that predate the convention
create table public.zz_legacy (id int primary key, tenant_id text not null, v text);
insert into public.zz_legacy values (1,'zz-a','old');
select private.add_row_conventions('public.zz_legacy', array['tenant_id']);
insert into public.zz_legacy(id,tenant_id,v) values (2,'zz-a','new');
do $$ declare old_row record; new_row record; ts timestamptz; begin
  select * into old_row from public.zz_legacy where id = 1; select * into new_row from public.zz_legacy where id = 2;
  if old_row.created_at is not null then raise exception 'FAIL legacy row got a fabricated created_at'; end if;
  if new_row.created_at is null or new_row.row_version <> 1 then raise exception 'FAIL new row not stamped'; end if;
  -- update: version up, updated_at moves, created_at held, a forged value is overwritten
  ts := new_row.updated_at;
  update public.zz_legacy set v = 'edited', updated_at = '2000-01-01', created_at = '2000-01-01', row_version = 99 where id = 2;
  select * into new_row from public.zz_legacy where id = 2;
  if new_row.row_version <> 2 then raise exception 'FAIL row_version forged/skipped: %', new_row.row_version; end if;
  if new_row.updated_at <= ts then raise exception 'FAIL updated_at did not advance'; end if;
  if new_row.created_at = '2000-01-01' then raise exception 'FAIL created_at was rewritten by the client'; end if;
  -- a row never changes tenant
  begin update public.zz_legacy set tenant_id = 'zz-b' where id = 2; raise exception 'FAIL row moved tenant';
  exception when check_violation then null; end;
  -- an update that changes nothing about tenant is fine (control)
  update public.zz_legacy set v = 'again' where id = 2;
end $$;

-- append-only guard
create table public.zz_evidence (id int primary key, note text);
create trigger t_no_update before update on public.zz_evidence for each row execute function private.refuse_mutation('update');
create trigger t_no_delete before delete on public.zz_evidence for each row execute function private.refuse_mutation('delete');
insert into public.zz_evidence values (1,'a');                                           -- control: insert allowed
do $$ begin
  begin update public.zz_evidence set note = 'b'; raise exception 'FAIL evidence updated'; exception when sqlstate '55000' then null; end;
  begin delete from public.zz_evidence;           raise exception 'FAIL evidence deleted'; exception when sqlstate '55000' then null; end;
end $$;
-- scope argument: 'update' guard leaves delete alone
create table public.zz_half (id int primary key);
create trigger t before update on public.zz_half for each row execute function private.refuse_mutation('update');
insert into public.zz_half values (1); delete from public.zz_half;                       -- control: delete allowed under update-only scope
rollback;
\echo 10 OK
