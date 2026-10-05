-- The consent-filtered index from the original productivity migration serves
-- aggregate reads, but a partial index cannot support every tenant_id foreign
-- key check. Add the full covering index under a new name so databases that
-- already applied the original migration receive the repair too.
create index if not exists productivity_workspace_tenant_fk
  on public.productivity_workspace (tenant_id);
