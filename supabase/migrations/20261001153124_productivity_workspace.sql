-- Private, opt-in productivity cloud copies. CAS protects edits across devices.
create table if not exists public.productivity_workspace (
 user_id uuid primary key references auth.users(id) on delete cascade,
 tenant_id text references public.schools(id) on delete restrict,
 revision bigint not null default 1 check (revision > 0),
 data jsonb not null check (jsonb_typeof(data)='object' and data->>'version'='1' and octet_length(data::text)<=3000000),
 share_aggregate boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.productivity_workspace enable row level security;
revoke all on public.productivity_workspace from anon, authenticated;
grant select, insert, update, delete on public.productivity_workspace to authenticated;
drop policy if exists "productivity owner read" on public.productivity_workspace;
create policy "productivity owner read" on public.productivity_workspace for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "productivity owner delete" on public.productivity_workspace;
create policy "productivity owner delete" on public.productivity_workspace for delete to authenticated using ((select auth.uid())=user_id);
drop policy if exists "productivity owner insert" on public.productivity_workspace;
create policy "productivity owner insert" on public.productivity_workspace for insert to authenticated with check (
 (select auth.uid())=user_id and (tenant_id is null or exists(select 1 from public.institution_membership m where m.auth_user_id=(select auth.uid()) and m.tenant_id=productivity_workspace.tenant_id and m.status='active'))
);
drop policy if exists "productivity owner update" on public.productivity_workspace;
create policy "productivity owner update" on public.productivity_workspace for update to authenticated using ((select auth.uid())=user_id) with check (
 (select auth.uid())=user_id and (tenant_id is null or exists(select 1 from public.institution_membership m where m.auth_user_id=(select auth.uid()) and m.tenant_id=productivity_workspace.tenant_id and m.status='active'))
);
create index if not exists productivity_workspace_tenant on public.productivity_workspace(tenant_id) where share_aggregate;
create or replace function public.save_productivity_workspace(p_expected bigint, p_data jsonb, p_tenant text default null, p_aggregate boolean default false)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare row public.productivity_workspace; who uuid := auth.uid();
begin
 if who is null then raise exception 'Sign in first' using errcode='42501'; end if;
 if p_expected < 0 or p_expected is null then raise exception 'Invalid revision'; end if;
 if p_expected=0 then
  insert into public.productivity_workspace(user_id,data,tenant_id,share_aggregate) values(who,p_data,p_tenant,p_aggregate) on conflict(user_id) do nothing returning * into row;
 else
  update public.productivity_workspace set data=p_data,tenant_id=p_tenant,share_aggregate=p_aggregate,revision=revision+1,updated_at=now() where user_id=who and revision=p_expected returning * into row;
 end if;
 if row.user_id is null then raise exception 'Workspace changed on another device; review before replacing' using errcode='40001'; end if;
 return jsonb_build_object('revision',row.revision,'data',row.data,'tenantId',row.tenant_id,'shareAggregate',row.share_aggregate,'updatedAt',row.updated_at);
end $$;
revoke all on function public.save_productivity_workspace(bigint,jsonb,text,boolean) from public,anon;
grant execute on function public.save_productivity_workspace(bigint,jsonb,text,boolean) to authenticated;
-- Privilege is needed only to aggregate across consenting owners. Never returns person IDs or private content.
create or replace function public.productivity_readiness_aggregate(p_tenant text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owners bigint; decisions bigint; decided bigint;
begin
 if not exists(select 1 from public.institution_membership m where m.auth_user_id=auth.uid() and m.tenant_id=p_tenant and m.status='active' and 'admin'=any(m.roles)) then raise exception 'Active tenant admin required' using errcode='42501'; end if;
 select count(*) into owners from public.productivity_workspace w where w.tenant_id=p_tenant and w.share_aggregate and exists(select 1 from public.institution_membership m where m.auth_user_id=w.user_id and m.tenant_id=p_tenant and m.status='active');
 if owners<10 then return jsonb_build_object('state','insufficient_cohort','minimum',10); end if;
 select count(*),count(*) filter(where d->>'decided'='true') into decisions,decided from public.productivity_workspace w cross join lateral jsonb_array_elements(case when jsonb_typeof(w.data->'decisions')='array' then w.data->'decisions' else '[]'::jsonb end) d where w.tenant_id=p_tenant and w.share_aggregate and exists(select 1 from public.institution_membership m where m.auth_user_id=w.user_id and m.tenant_id=p_tenant and m.status='active');
 return jsonb_build_object('state','ready','cohort',owners,'decisions',decisions,'decided',decided,'updatedAt',now());
end $$;
revoke all on function public.productivity_readiness_aggregate(text) from public,anon;
grant execute on function public.productivity_readiness_aggregate(text) to authenticated;
;
