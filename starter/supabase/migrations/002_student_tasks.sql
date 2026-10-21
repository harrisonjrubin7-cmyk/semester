create table public.student_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  owner_account_id uuid not null references public.accounts(id),
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);

create index student_tasks_tenant_owner_idx
  on public.student_tasks (tenant_id, owner_account_id, created_at desc);

-- Empty or missing settings resolve to NULL, so every policy evaluates to
-- "no rows" instead of raising a cast error.
create or replace function public.current_tenant_id() returns uuid
language sql stable as $$ select nullif(current_setting('app.current_tenant_id', true), '')::uuid $$;

create or replace function public.current_account_id() returns uuid
language sql stable as $$ select nullif(current_setting('app.current_account_id', true), '')::uuid $$;

alter table public.student_tasks enable row level security;
alter table public.student_tasks force row level security;
revoke all on public.student_tasks from anon, authenticated;

create policy student_tasks_select on public.student_tasks for select to semester_app
  using (tenant_id = (select public.current_tenant_id())
     and owner_account_id = (select public.current_account_id()));

create policy student_tasks_insert on public.student_tasks for insert to semester_app
  with check (tenant_id = (select public.current_tenant_id())
          and owner_account_id = (select public.current_account_id()));

create policy student_tasks_update on public.student_tasks for update to semester_app
  using (tenant_id = (select public.current_tenant_id())
     and owner_account_id = (select public.current_account_id()))
  with check (tenant_id = (select public.current_tenant_id())
          and owner_account_id = (select public.current_account_id()));

create policy student_tasks_delete on public.student_tasks for delete to semester_app
  using (tenant_id = (select public.current_tenant_id())
     and owner_account_id = (select public.current_account_id()));

grant usage on schema public to semester_app;
grant select, insert, update, delete on public.student_tasks to semester_app;
grant execute on function public.current_tenant_id(), public.current_account_id() to semester_app;
