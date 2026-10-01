-- The original productivity workspace migration indexed only rows that had
-- opted into aggregate sharing. That is useful for the aggregate query, but
-- it does not cover the tenant foreign key: deleting a school must inspect
-- every workspace row, including rows that did not opt in.
--
-- Keep the selective index and add a complete one for referential checks.
-- This is a forward migration because the original migration already exists
-- in production; changing only that historical file would not repair the
-- deployed schema.
create index if not exists productivity_workspace_tenant_fk
  on public.productivity_workspace(tenant_id);
