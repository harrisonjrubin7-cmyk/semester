\set ON_ERROR_STOP on
begin;
-- Independent of the generated seed: only zz_ tables are asserted on.
create table public.zz_ok_tenant (id int primary key, tenant_id text not null references public.schools(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table public.zz_bad_tenant (id int primary key, tenant_id text, created_at timestamptz default now());   -- nullable, no FK, no updated_at
create table public.zz_evidence  (id int primary key, occurred_at timestamptz default now());
grant select, insert, update on public.zz_evidence to authenticated;                                              -- a client may rewrite "evidence"
create table public.zz_unregistered (id int primary key);

insert into private.data_registry(table_schema,table_name,domain,record_class) values
  ('public','zz_ok_tenant','academic','tenant_record'),
  ('public','zz_bad_tenant','academic','tenant_record'),
  ('public','zz_evidence','governance','append_only_evidence'),
  ('public','zz_missing','academic','tenant_record');                                                            -- registered, no such table

do $$ declare v text; g text; begin
  select string_agg(table_name || ':' || rule, ',' order by table_name, rule) into v from private.convention_violations where table_name like 'zz\_%';
  if v <> 'zz_bad_tenant:tenant_fk_to_schools,zz_bad_tenant:tenant_id_not_null,zz_bad_tenant:updated_at,zz_evidence:evidence_not_client_updatable'
  then raise exception 'FAIL violations: %', v; end if;                                                         -- zz_ok_tenant is absent: the control
  select string_agg(kind || ':' || table_name, ',' order by kind, table_name) into g from private.data_registry_gaps where table_name like 'zz\_%' and kind <> 'unconfirmed';
  if g <> 'orphan_registry:zz_missing,unregistered:zz_unregistered' then raise exception 'FAIL gaps: %', g; end if;
end $$;

-- an exemption silences exactly one rule, and only until its review date
insert into private.convention_exemption(table_schema,table_name,rule,reason,review_by) values
  ('public','zz_bad_tenant','updated_at','append-only in practice; confirmed with steward',current_date + 30),
  ('public','zz_bad_tenant','tenant_fk_to_schools','expired exemption must not count',current_date - 1);
do $$ declare v text; begin
  select string_agg(rule, ',' order by rule) into v from private.convention_violations where table_name = 'zz_bad_tenant';
  if v <> 'tenant_fk_to_schools,tenant_id_not_null' then raise exception 'FAIL exemption handling: %', v; end if;
  begin insert into private.convention_exemption values ('public','zz_bad_tenant','created_at','short',current_date + 1);
    raise exception 'FAIL one-word reason accepted'; exception when check_violation then null; end;
end $$;

-- a confirmed row must be complete; a clock needs a number
do $$ begin
  begin update private.data_registry set review_state = 'steward_confirmed' where table_name = 'zz_ok_tenant';
    raise exception 'FAIL incomplete row confirmed'; exception when check_violation then null; end;
  begin update private.data_registry set retention_class = 'fixed_term' where table_name = 'zz_ok_tenant';
    raise exception 'FAIL fixed_term without days'; exception when check_violation then null; end;
  update private.data_registry set record_class='tenant_record', classification='T2', authority='student', retention_class='fixed_term',
         retention_days=365, deletion_mode='erase_with_account', steward='Registrar office', review_state='steward_confirmed'
   where table_name = 'zz_ok_tenant';                                                                          -- control: complete row accepted
  begin update private.data_registry set analytics_eligible = true, classification = 'T3' where table_name = 'zz_ok_tenant';
    raise exception 'FAIL T3 table made analytics-eligible'; exception when check_violation then null; end;
end $$;
rollback;
\echo 01 OK
