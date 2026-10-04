-- Rollback-only integration checks; no persistent accounts or student data.
begin;
create or replace function pg_temp.become(who uuid) returns void language plpgsql as $$
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',who::text,'role','authenticated')::text,true);
 execute 'set local role authenticated';
end $$;
insert into public.invites(email,note) values ('productivity-rls-a@example.invalid','rollback-only test'),('productivity-rls-b@example.invalid','rollback-only test');
insert into auth.users(id,email) values ('00000000-0000-4000-8000-00000000f101','productivity-rls-a@example.invalid'), ('00000000-0000-4000-8000-00000000f102','productivity-rls-b@example.invalid');
select pg_temp.become('00000000-0000-4000-8000-00000000f101');
do $$ declare r jsonb; begin
 r:=public.save_productivity_workspace(0,'{"version":1,"decisions":[],"captures":[],"drafts":[],"journal":[],"preferences":[]}');
 if r->>'revision'<>'1' then raise exception 'initial revision failed'; end if;
 r:=public.save_productivity_workspace(1,r->'data');
 if r->>'revision'<>'2' then raise exception 'revision advance failed'; end if;
 begin perform public.save_productivity_workspace(1,r->'data'); raise exception 'stale write accepted'; exception when serialization_failure then null; end;
 begin perform public.productivity_readiness_aggregate('semester-test-not-a-tenant'); raise exception 'nonadmin aggregate accepted'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.become('00000000-0000-4000-8000-00000000f102');
do $$ begin
 if exists(select 1 from public.productivity_workspace) then raise exception 'cross-account disclosure'; end if;
 delete from public.productivity_workspace where user_id='00000000-0000-4000-8000-00000000f101';
 if found then raise exception 'cross-account deletion'; end if;
 begin insert into public.productivity_workspace(user_id,data) values('00000000-0000-4000-8000-00000000f101','{"version":1}'); raise exception 'cross-account insert accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.schools(id,name,is_demo) values('productivity-rollback-fixture','Rollback fixture',true);
insert into public.institution_membership(tenant_id,auth_user_id,status,roles) values('productivity-rollback-fixture','00000000-0000-4000-8000-00000000f101','active',array['admin']);
select pg_temp.become('00000000-0000-4000-8000-00000000f102');
do $$ begin
 begin
  perform public.save_productivity_workspace(0,'{"version":1}', 'productivity-rollback-fixture',true);
  raise exception 'tenant assignment without membership accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.become('00000000-0000-4000-8000-00000000f101');
do $$ declare r jsonb; begin
 r:=public.productivity_readiness_aggregate('productivity-rollback-fixture');
 if r->>'state'<>'insufficient_cohort' then raise exception 'small cohort exposed'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.productivity_workspace where user_id='00000000-0000-4000-8000-00000000f101' and revision=2) then raise exception 'owner workspace missing'; end if;
 if public.lti_account_untouched('00000000-0000-4000-8000-00000000f101') then raise exception 'account holding productivity work classified empty'; end if;
 if has_table_privilege('anon','public.productivity_workspace','SELECT') then raise exception 'anonymous read granted'; end if;
 raise notice 'ok  productivity workspace: owner isolation, revisions, tenant membership, cohort suppression, account link';
end $$;
rollback;
