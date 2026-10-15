-- Per-operation RLS for one table, as the reference pattern for all 227. Applies to semester_core.student_tasks (#94).
-- Corrections vs. the starter PDF: identity comes from auth.uid() (the verified JWT), not current_setting('app.current_*'),
-- which a client can set on its own connection and which is lost outside a transaction.

create or replace function semester_core.is_active_member(p_tenant uuid)
returns boolean language sql stable security definer set search_path = semester_core, pg_temp as $$
  select exists (
    select 1 from semester_core.memberships m
    where m.tenant_id = p_tenant and m.owner_account_id = auth.uid()
      and m.status = 'active' and m.deleted_at is null
  )
$$;
revoke execute on function semester_core.is_active_member(uuid) from public, anon;
grant execute on function semester_core.is_active_member(uuid) to authenticated;

revoke all on semester_core.student_tasks from anon, authenticated;
grant select, insert, update, delete on semester_core.student_tasks to authenticated;
grant usage on schema semester_core to authenticated;

create policy student_tasks_select on semester_core.student_tasks for select to authenticated
  using (owner_account_id = auth.uid() and semester_core.is_active_member(tenant_id) and deleted_at is null);
create policy student_tasks_insert on semester_core.student_tasks for insert to authenticated
  with check (owner_account_id = auth.uid() and semester_core.is_active_member(tenant_id));
create policy student_tasks_update on semester_core.student_tasks for update to authenticated
  using (owner_account_id = auth.uid() and semester_core.is_active_member(tenant_id))
  with check (owner_account_id = auth.uid() and semester_core.is_active_member(tenant_id));
-- No delete policy on purpose: soft-delete via update (deleted_at), so history and audit survive.

create index if not exists student_tasks_owner_idx on semester_core.student_tasks (tenant_id, owner_account_id, created_at desc);
create index if not exists memberships_lookup_idx on semester_core.memberships (tenant_id, owner_account_id) where status = 'active' and deleted_at is null;
