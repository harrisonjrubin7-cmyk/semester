\set ON_ERROR_STOP on
begin;
-- The generator and the catalog agree: one rule per single-column FK between two tenant-scoped tables
-- that does not carry tenant_id. (If the generator silently emitted nothing, this is where it shows.)
do $$ declare expected int; got int; failed text; r record; res private.dq_result; bad int := 0; begin
  select count(*) into expected from pg_constraint k
   where k.contype = 'f' and cardinality(k.conkey) = 1 and k.connamespace in ('public'::regnamespace, 'private'::regnamespace)
     and k.confrelid <> 'public.schools'::regclass and k.confrelid <> 'auth.users'::regclass
     and exists (select 1 from pg_attribute a where a.attrelid = k.conrelid  and a.attname = 'tenant_id' and not a.attisdropped)
     and exists (select 1 from pg_attribute a where a.attrelid = k.confrelid and a.attname = 'tenant_id' and not a.attisdropped);
  select count(*) into got from private.dq_rule where rule_id like 'tenant.%';
  if expected < 30 or got <> expected then raise exception 'FAIL generated % rules, catalog says % (expected at least 30)', got, expected; end if;

  -- every generated rule EXECUTES against the real columns (a wrong column name raises undefined_column) and
  -- passes on an empty database (nothing to mismatch)
  for r in select rule_id from private.dq_rule where rule_id like 'tenant.%' order by rule_id loop
    res := private.dq_run_rule(r.rule_id);
    if not res.passed or res.observed <> 0 then bad := bad + 1; failed := coalesce(failed || ',', '') || r.rule_id; end if;
  end loop;
  if bad > 0 then raise exception 'FAIL % generated rules did not pass on an empty schema: %', bad, failed; end if;
end $$;

-- and a generated rule catches a real cross-tenant reference (control: a rule that can never fire is not a rule).
-- community_posts.community_id -> communities(id) is a single-column FK between two tenant-scoped tables.
insert into public.schools(id,name) values ('zz-a','School A'),('zz-b','School B');
insert into public.communities(id, tenant_id, kind, name) values ('00000000-0000-0000-0000-00000000c0a1', 'zz-a', 'study_group', 'Club A');
insert into public.community_posts(community_id, tenant_id, author_ref, author_name, body)
  values ('00000000-0000-0000-0000-00000000c0a1', 'zz-a', 'ref-a', 'Ann', 'same tenant: fine');        -- control: consistent
do $$ declare res private.dq_result; begin
  res := private.dq_run_rule('tenant.public.community_posts.community_id');
  if not res.passed then raise exception 'FAIL rule fired on consistent rows (observed %)', res.observed; end if;
end $$;
-- the database accepts this: that is the finding. A post in tenant B referencing tenant A's community.
insert into public.community_posts(community_id, tenant_id, author_ref, author_name, body)
  values ('00000000-0000-0000-0000-00000000c0a1', 'zz-b', 'ref-b', 'Bo', 'cross tenant: accepted by the schema');
do $$ declare res private.dq_result; begin
  res := private.dq_run_rule('tenant.public.community_posts.community_id');
  if res.passed or res.observed <> 1 then raise exception 'FAIL rule missed the cross-tenant reference (observed %, passed %)', res.observed, res.passed; end if;
  if not exists (select 1 from private.dq_blocking_failed where rule_id = 'tenant.public.community_posts.community_id')
  then raise exception 'FAIL a failed block rule is not in the blocking view'; end if;
end $$;

-- Operational rules named in 07: the nightly integrity jobs must have run. On an empty database they have not,
-- so a `stale` rule FAILS (a job that never ran is not healthy); and each names a real table and column.
insert into private.dq_rule(rule_id,table_schema,table_name,kind,params,severity,steward) values
  ('ops.ledger_chain_verified_nightly','private','ledger_chain_verification','stale','{"column":"ran_at","max_age_seconds":129600}','block','Platform data steward'),
  ('ops.console_audit_verified_nightly','private','console_audit_verification','stale','{"column":"ran_at","max_age_seconds":129600}','block','Platform data steward'),
  ('ops.source_freshness_monitor_alive','public','source_freshness_events','stale','{"column":"observed_at","max_age_seconds":604800}','warn','Integration owner');
do $$ declare r record; res private.dq_result; begin
  for r in select rule_id from private.dq_rule where rule_id like 'ops.%' loop
    res := private.dq_run_rule(r.rule_id);
    if res.passed then raise exception 'FAIL % passed on an empty table: a job that never ran must fail', r.rule_id; end if;
  end loop;
  insert into private.ledger_chain_verification(ran_at, ok, chains_checked, sealed_today) values (now(), true, 2, 0);
  res := private.dq_run_rule('ops.ledger_chain_verified_nightly');
  if not res.passed then raise exception 'FAIL a verification moments ago still reads stale (observed %)', res.observed; end if;
end $$;
rollback;
\echo 12 OK
