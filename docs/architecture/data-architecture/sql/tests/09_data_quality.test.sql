\set ON_ERROR_STOP on
begin;
-- A fixture with known defects: 1 null of 4, one duplicate pair, one orphan, one cross-tenant child.
insert into public.schools(id,name) values ('zz-a','School A'),('zz-b','School B');
create table public.zz_parent(id int primary key, tenant_id text);
create table public.zz_child(id int, parent_id int, tenant_id text, note text, seen timestamptz);
insert into public.zz_parent values (1,'zz-a'),(2,'zz-a');
insert into public.zz_child values
  (1,1,'zz-a','x', now() - interval '2 hours'),
  (2,1,'zz-a',null, now() - interval '3 hours'),
  (2,2,'zz-a','y', now() - interval '4 hours'),        -- duplicate id 2
  (3,99,'zz-a','z', now() - interval '5 hours'),       -- orphan
  (4,2,'zz-b','w', now() - interval '6 hours');        -- tenant mismatch
-- (the fixture is not in the registry, and it need not be: rules do not require registration)

insert into private.dq_rule(rule_id,table_schema,table_name,kind,params,severity,steward) values
 ('zz.null_rate_fail','public','zz_child','null_rate','{"column":"note","max_rate":0.1}','block','Dana Okafor'),
 ('zz.null_rate_pass','public','zz_child','null_rate','{"column":"note","max_rate":0.5}','block','Dana Okafor'),
 ('zz.unique_fail','public','zz_child','unique','{"columns":["id"]}','warn','Dana Okafor'),
 ('zz.unique_pass','public','zz_parent','unique','{"columns":["id"]}','warn','Dana Okafor'),
 ('zz.orphan_fail','public','zz_child','orphan','{"column":"parent_id","parent":"public.zz_parent","parent_column":"id"}','block','Dana Okafor'),
 ('zz.tenant_fail','public','zz_child','tenant_mismatch','{"column":"parent_id","parent":"public.zz_parent","parent_column":"id","parent_tenant_column":"tenant_id"}','block','Dana Okafor'),
 ('zz.stale_pass','public','zz_child','stale','{"column":"seen","max_age_seconds":3600}','warn','Dana Okafor'),
 ('zz.stale_fail','public','zz_child','stale','{"column":"seen","max_age_seconds":3600}','warn','Dana Okafor'),
 ('zz.count_pass','public','zz_child','row_count','{"min":5,"max":5}','info','Dana Okafor');
-- stale_pass uses a looser window by editing its params, so the pair is a control
update private.dq_rule set params = '{"column":"seen","max_age_seconds":86400}' where rule_id = 'zz.stale_pass';

do $$ declare r private.dq_result; begin
  r := private.dq_run_rule('zz.null_rate_fail');  if r.passed or r.observed <> 0.2 then raise exception 'FAIL null_rate_fail: % %', r.observed, r.passed; end if;   -- 1 null of 5 rows
  r := private.dq_run_rule('zz.null_rate_pass');  if not r.passed then raise exception 'FAIL null_rate_pass'; end if;
  r := private.dq_run_rule('zz.unique_fail');     if r.passed or r.observed <> 1 then raise exception 'FAIL unique_fail: %', r.observed; end if;
  r := private.dq_run_rule('zz.unique_pass');     if not r.passed then raise exception 'FAIL unique_pass'; end if;
  r := private.dq_run_rule('zz.orphan_fail');     if r.passed or r.observed <> 1 then raise exception 'FAIL orphan_fail: %', r.observed; end if;
  r := private.dq_run_rule('zz.tenant_fail');     if r.passed or r.observed <> 1 then raise exception 'FAIL tenant_fail: %', r.observed; end if;
  r := private.dq_run_rule('zz.stale_pass');      if not r.passed then raise exception 'FAIL stale_pass'; end if;
  r := private.dq_run_rule('zz.stale_fail');      if r.passed then raise exception 'FAIL stale_fail (newest row is 2h old, limit 1h)'; end if;
  r := private.dq_run_rule('zz.count_pass');      if not r.passed then raise exception 'FAIL count_pass'; end if;
  -- the blocking view lists exactly the failed block-severity rules
  if (select string_agg(rule_id, ',' order by rule_id) from private.dq_blocking_failed) <> 'zz.null_rate_fail,zz.orphan_fail,zz.tenant_fail' then
    raise exception 'FAIL blocking set: %', (select string_agg(rule_id, ',' order by rule_id) from private.dq_blocking_failed); end if;
  -- a rule that names a bad column fails loudly, not silently green
  insert into private.dq_rule(rule_id,table_schema,table_name,kind,params,severity,steward)
    values ('zz.bad_col','public','zz_child','null_rate','{"column":"nope","max_rate":0.1}','warn','Dana Okafor');
  begin perform private.dq_run_rule('zz.bad_col'); raise exception 'FAIL bad column evaluated as pass';
  exception when undefined_column then null; end;
  -- repairing the data turns a block green on the next run (the view reads the LATEST result)
  update public.zz_child set note = 'filled' where note is null;
  r := private.dq_run_rule('zz.null_rate_fail');  if not r.passed then raise exception 'FAIL repaired data still failing'; end if;
  if exists (select 1 from private.dq_blocking_failed where rule_id = 'zz.null_rate_fail') then raise exception 'FAIL blocking view not refreshed'; end if;
end $$;
rollback;
\echo 09 OK
